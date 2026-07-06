/**
 * Pure alarm-window evaluation (Problem 40).
 *
 * Decides whether the squat screen must be showing right now. The primary
 * signal is the user's own alarm schedule (settings.alarmTime / alarmDays),
 * evaluated entirely on-device — so the decision does NOT depend on the
 * server having written lastAlarmSentAt, on FCM delivery, or on Firestore
 * cache freshness. The server-recorded lastAlarmSentAt is kept as a
 * secondary signal (covers testAlarm and timezone mismatches).
 *
 * This module is dependency-free on purpose so it can be unit-tested
 * without mocking Firebase or native modules.
 */

// 5-minute squat window measured from the alarm occurrence
export const SQUAT_WINDOW_MS = 5 * 60 * 1000;

// The server clock may be slightly ahead of the device clock; a
// lastAlarmSentAt up to this far in the "future" still counts as now.
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AlarmWindowState {
  alarmTime: string | null; // "HH:mm"
  alarmDays: number[]; // 0-6 (0 = Sunday); empty = every day
  lastAlarmSentAt: number | null; // epoch ms
  squatCompletedAt: number | null; // epoch ms
  alarmFailedAt: number | null; // epoch ms
}

// Firestore Timestamp (duck-typed to avoid importing the SDK) or ISO string / Date
const toMillisOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const maybeTimestamp = value as { toMillis?: () => number };
  if (typeof maybeTimestamp.toMillis === 'function') {
    return maybeTimestamp.toMillis();
  }
  const ms = new Date(value as string | number | Date).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Convert a Firestore user document's data into an AlarmWindowState.
 */
export const extractAlarmWindowState = (
  data: Record<string, unknown> | undefined
): AlarmWindowState => {
  const settings = (data?.settings ?? {}) as {
    alarmTime?: string | null;
    alarmDays?: number[];
  };

  return {
    alarmTime: settings.alarmTime ?? null,
    alarmDays: Array.isArray(settings.alarmDays) ? settings.alarmDays : [],
    lastAlarmSentAt: toMillisOrNull(data?.lastAlarmSentAt),
    squatCompletedAt: toMillisOrNull(data?.squatCompletedAt),
    alarmFailedAt: toMillisOrNull(data?.alarmFailedAt),
  };
};

/**
 * Returns true when the squat screen must be showing at `nowMs`.
 *
 * A window is open when either:
 *  - the alarm schedule itself says an occurrence started within the last
 *    5 minutes (today's or yesterday's alarmTime, respecting alarmDays), or
 *  - the server recorded lastAlarmSentAt within the last 5 minutes,
 * and the most recent open occurrence has not yet been handled
 * (no squatCompletedAt / alarmFailedAt at or after it).
 */
export function evaluateAlarmWindow(state: AlarmWindowState, nowMs: number): boolean {
  const candidates: number[] = [];

  // 1) Schedule-based occurrences (device-local time; no server dependency)
  const timeMatch = state.alarmTime ? /^(\d{1,2}):(\d{2})$/.exec(state.alarmTime) : null;
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    // Check today's and yesterday's occurrence (yesterday covers windows
    // that cross midnight, e.g. alarm 23:58 evaluated at 00:01)
    for (const dayOffset of [0, 1]) {
      const base = new Date(nowMs - dayOffset * DAY_MS);
      const occurrence = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        hours,
        minutes,
        0,
        0
      ).getTime();

      if (occurrence > nowMs || nowMs - occurrence > SQUAT_WINDOW_MS) continue;

      const day = new Date(occurrence).getDay();
      if (state.alarmDays.length > 0 && !state.alarmDays.includes(day)) continue;

      candidates.push(occurrence);
    }
  }

  // 2) Server-recorded occurrence (covers testAlarm and timezone mismatches)
  if (
    state.lastAlarmSentAt !== null &&
    nowMs - state.lastAlarmSentAt <= SQUAT_WINDOW_MS &&
    state.lastAlarmSentAt - nowMs <= FUTURE_TOLERANCE_MS
  ) {
    // Clamp slightly-future server timestamps so the guards below behave
    candidates.push(Math.min(state.lastAlarmSentAt, nowMs));
  }

  if (candidates.length === 0) return false;

  // Judge against the most recent open occurrence: an older completion must
  // not suppress a newer alarm (consecutive-alarms regression, Problem 40)
  const occurrenceStart = Math.max(...candidates);

  if (state.squatCompletedAt !== null && state.squatCompletedAt >= occurrenceStart) {
    return false; // already completed for this occurrence
  }
  if (state.alarmFailedAt !== null && state.alarmFailedAt >= occurrenceStart) {
    return false; // already recorded as failed (penalty handled server-side)
  }

  return true;
}
