/**
 * checkAlarms duplicate-prevention tests (Problem 26 / Problem 40)
 *
 * Verifies the per-occurrence dedupe (lastAlarmOccurrence = "YYYY-MM-DD HH:mm"):
 * the same occurrence must not be sent twice even though the 2-minute
 * time-match window (current + previous minute) matches on consecutive runs,
 * while a NEW occurrence (alarm re-set minutes later) must always fire.
 * Also verifies that the alarm state (lastAlarmSentAt etc.) is written even
 * when the FCM send fails.
 */

const mockUsersGet = jest.fn();
const mockUserDocUpdate = jest.fn();
const mockAlarmHistoryAdd = jest.fn();
const mockMessagingSend = jest.fn();

jest.mock('firebase-admin', () => {
  const firestoreFn = jest.fn(() => ({
    collection: (name: string) => {
      if (name === 'users') {
        return {
          get: mockUsersGet,
          doc: (id: string) => ({
            update: (patch: unknown) => mockUserDocUpdate(id, patch),
          }),
        };
      }
      if (name === 'alarmHistory') {
        return { add: (data: unknown) => mockAlarmHistoryAdd(data) };
      }
      return { add: jest.fn(), get: jest.fn(), doc: jest.fn(() => ({ update: jest.fn() })) };
    },
  }) as unknown) as jest.Mock & { FieldValue: { serverTimestamp: jest.Mock } };
  (firestoreFn as unknown as { FieldValue: unknown }).FieldValue = {
    serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  };

  return {
    initializeApp: jest.fn(),
    firestore: firestoreFn,
    messaging: jest.fn(() => ({
      send: (...args: unknown[]) => mockMessagingSend(...args),
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const functionsTest = require('firebase-functions-test')();

import { checkAlarms } from '../index';

// 2026-07-06T00:00:00.000Z = Monday 09:00 JST
const FIXED_NOW = new Date('2026-07-06T00:00:00.000Z');
const ALARM_TIME = '09:00';
const MONDAY = 1;

const userDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

describe('checkAlarms - duplicate prevention (Problem 26)', () => {
  const wrapped = functionsTest.wrap(checkAlarms);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: FIXED_NOW });
    mockMessagingSend.mockResolvedValue('message-id-123');
    mockUserDocUpdate.mockResolvedValue(undefined);
    mockAlarmHistoryAdd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const baseUser = {
    settings: { alarmTime: ALARM_TIME, alarmDays: [MONDAY], timezone: 'Asia/Tokyo', language: 'ja' },
    fcmToken: 'test-fcm-token',
  };

  it('should send the alarm on first match (no lastAlarmOccurrence yet)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [userDoc('user-1', { ...baseUser })],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
    expect(mockAlarmHistoryAdd).toHaveBeenCalledTimes(1);
    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        lastAlarmOccurrence: '2026-07-06 09:00',
        lastAlarmSentAt: 'MOCK_SERVER_TIMESTAMP',
        squatCompletedAt: null,
        alarmFailedAt: null,
        alarmAcknowledgedAt: null,
      })
    );
  });

  it('should re-alert (notification only, no state update) for an unacknowledged occurrence (Problem 43)', async () => {
    // The same occurrence must not re-write state, but while the user has
    // not opened the squat screen the alarm is resent every cron run so the
    // phone keeps ringing (iOS plays a notification sound only once)
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmOccurrence: '2026-07-06 09:00',
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
    expect(mockUserDocUpdate).not.toHaveBeenCalled();
    expect(mockAlarmHistoryAdd).not.toHaveBeenCalled();
  });

  it('should NOT re-alert once the squat screen was opened (alarmAcknowledgedAt set)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmOccurrence: '2026-07-06 09:00',
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 60 * 1000 },
          alarmAcknowledgedAt: { toMillis: () => FIXED_NOW.getTime() - 30 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).not.toHaveBeenCalled();
    expect(mockUserDocUpdate).not.toHaveBeenCalled();
  });

  it('should NOT re-alert once squats were completed', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmOccurrence: '2026-07-06 09:00',
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 60 * 1000 },
          squatCompletedAt: { toMillis: () => FIXED_NOW.getTime() - 30 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  it('should NOT re-alert after the 5-minute window has closed', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          settings: { ...baseUser.settings, alarmTime: '08:50' }, // no time match now
          lastAlarmOccurrence: '2026-07-06 08:50',
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 6 * 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  it('should send a NEW occurrence even when the previous alarm was only minutes ago (Problem 40)', async () => {
    // Regression: consecutive alarms (e.g. re-set from 08:57 to 09:00) were
    // silently skipped by the old 10-minute time-based dedupe
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmOccurrence: '2026-07-06 08:57',
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 3 * 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        lastAlarmOccurrence: '2026-07-06 09:00',
        squatCompletedAt: null,
        alarmFailedAt: null,
      })
    );
  });

  it('should still record the alarm state when the FCM send fails (Problem 40)', async () => {
    mockMessagingSend.mockRejectedValue(new Error('invalid registration token'));
    mockUsersGet.mockResolvedValue({
      docs: [userDoc('user-1', { ...baseUser })],
    });

    await wrapped();

    // State written before the send: window check and penalty check still work
    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        lastAlarmOccurrence: '2026-07-06 09:00',
        lastAlarmSentAt: 'MOCK_SERVER_TIMESTAMP',
      })
    );
    // Delivery log is only recorded on successful sends
    expect(mockAlarmHistoryAdd).not.toHaveBeenCalled();
  });

  it('should skip users whose alarm day does not include today', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          settings: { ...baseUser.settings, alarmDays: [2, 3] }, // Tue/Wed only, today is Monday
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  it('should treat an empty alarmDays array as "every day"', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          settings: { ...baseUser.settings, alarmDays: [] },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
  });
});
