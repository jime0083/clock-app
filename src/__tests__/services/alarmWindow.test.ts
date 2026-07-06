/**
 * evaluateAlarmWindow / extractAlarmWindowState unit tests (Problem 40)
 *
 * The module is pure (no Firebase / native dependencies), so times are
 * constructed with the local-time Date constructor to stay timezone-agnostic.
 */
import {
  evaluateAlarmWindow,
  extractAlarmWindowState,
  SQUAT_WINDOW_MS,
  AlarmWindowState,
} from '../../services/alarmWindow';

// 2026-07-06 (Monday) in the runner's local calendar
const at = (h: number, m: number, s = 0, dayOffset = 0) =>
  new Date(2026, 6, 6 + dayOffset, h, m, s, 0).getTime();

const MONDAY = new Date(2026, 6, 6).getDay(); // 1
const TUESDAY = (MONDAY + 1) % 7;

const state = (over: Partial<AlarmWindowState>): AlarmWindowState => ({
  alarmTime: null,
  alarmDays: [],
  lastAlarmSentAt: null,
  squatCompletedAt: null,
  alarmFailedAt: null,
  ...over,
});

describe('evaluateAlarmWindow - schedule-based (primary signal)', () => {
  it('is true 3 minutes after the scheduled alarm time', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00', alarmDays: [MONDAY] }), at(7, 3))).toBe(
      true
    );
  });

  it('is true at 4:59 elapsed (just inside the window)', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00' }), at(7, 4, 59))).toBe(true);
  });

  it('is true at exactly 5:00 elapsed (window is inclusive)', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00' }), at(7, 0) + SQUAT_WINDOW_MS)).toBe(
      true
    );
  });

  it('is false at 5:01 elapsed (past the window)', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00' }), at(7, 5, 1))).toBe(false);
  });

  it('is false before the alarm time', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00' }), at(6, 59))).toBe(false);
  });

  it('is false when today is not an alarm day', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00', alarmDays: [TUESDAY] }), at(7, 3))).toBe(
      false
    );
  });

  it('treats empty alarmDays as every day', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: '07:00', alarmDays: [] }), at(7, 3))).toBe(true);
  });

  it("covers a window crossing midnight (yesterday's 23:58 occurrence at 00:01)", () => {
    // Occurrence belongs to Monday July 6 even though "now" is Tuesday July 7
    expect(
      evaluateAlarmWindow(
        state({ alarmTime: '23:58', alarmDays: [MONDAY] }),
        at(0, 1, 0, 1) // July 7 00:01
      )
    ).toBe(true);
    // The occurrence day (Monday) is what must match, not "today" (Tuesday)
    expect(
      evaluateAlarmWindow(state({ alarmTime: '23:58', alarmDays: [TUESDAY] }), at(0, 1, 0, 1))
    ).toBe(false);
  });

  it('is false once squats were completed for this occurrence', () => {
    expect(
      evaluateAlarmWindow(state({ alarmTime: '07:00', squatCompletedAt: at(7, 1) }), at(7, 3))
    ).toBe(false);
  });

  it('ignores a stale completion from before this occurrence', () => {
    expect(
      evaluateAlarmWindow(state({ alarmTime: '07:00', squatCompletedAt: at(6, 50) }), at(7, 3))
    ).toBe(true);
  });

  it('is false once the alarm was recorded as failed for this occurrence', () => {
    expect(
      evaluateAlarmWindow(state({ alarmTime: '07:00', alarmFailedAt: at(7, 1) }), at(7, 3))
    ).toBe(false);
  });

  it('ignores an invalid alarmTime string', () => {
    expect(evaluateAlarmWindow(state({ alarmTime: 'invalid' }), at(7, 3))).toBe(false);
  });
});

describe('evaluateAlarmWindow - lastAlarmSentAt-based (secondary signal)', () => {
  it('is true within 5 minutes of lastAlarmSentAt (no schedule needed)', () => {
    const now = at(9, 0);
    expect(evaluateAlarmWindow(state({ lastAlarmSentAt: now - (4 * 60 + 59) * 1000 }), now)).toBe(
      true
    );
  });

  it('is false past 5 minutes of lastAlarmSentAt', () => {
    const now = at(9, 0);
    expect(evaluateAlarmWindow(state({ lastAlarmSentAt: now - (5 * 60 + 1) * 1000 }), now)).toBe(
      false
    );
  });

  it('tolerates a server timestamp slightly ahead of the device clock', () => {
    const now = at(9, 0);
    expect(evaluateAlarmWindow(state({ lastAlarmSentAt: now + 60 * 1000 }), now)).toBe(true);
    expect(evaluateAlarmWindow(state({ lastAlarmSentAt: now + 3 * 60 * 1000 }), now)).toBe(false);
  });
});

describe('evaluateAlarmWindow - consecutive alarms (Problem 40 regression)', () => {
  it('opens for a new scheduled occurrence even though the previous one was completed', () => {
    // Previous alarm 07:00 was completed at 07:01; the alarm was then re-set
    // to 07:03. At 07:04 the new occurrence must open regardless of the old
    // completion and the old lastAlarmSentAt.
    expect(
      evaluateAlarmWindow(
        state({
          alarmTime: '07:03',
          lastAlarmSentAt: at(7, 0),
          squatCompletedAt: at(7, 1),
        }),
        at(7, 4)
      )
    ).toBe(true);
  });

  it('stays closed when the newest occurrence was already completed', () => {
    expect(
      evaluateAlarmWindow(
        state({
          alarmTime: '07:03',
          lastAlarmSentAt: at(7, 3),
          squatCompletedAt: at(7, 3, 30),
        }),
        at(7, 4)
      )
    ).toBe(false);
  });
});

describe('extractAlarmWindowState', () => {
  it('reads settings and converts Firestore Timestamps (toMillis duck-typing)', () => {
    const result = extractAlarmWindowState({
      settings: { alarmTime: '07:00', alarmDays: [1, 2] },
      lastAlarmSentAt: { toMillis: () => 1234 },
      squatCompletedAt: '2026-07-06T07:01:00.000Z',
      alarmFailedAt: null,
    });

    expect(result.alarmTime).toBe('07:00');
    expect(result.alarmDays).toEqual([1, 2]);
    expect(result.lastAlarmSentAt).toBe(1234);
    expect(result.squatCompletedAt).toBe(new Date('2026-07-06T07:01:00.000Z').getTime());
    expect(result.alarmFailedAt).toBeNull();
  });

  it('handles missing data safely', () => {
    expect(extractAlarmWindowState(undefined)).toEqual({
      alarmTime: null,
      alarmDays: [],
      lastAlarmSentAt: null,
      squatCompletedAt: null,
      alarmFailedAt: null,
    });
  });
});
