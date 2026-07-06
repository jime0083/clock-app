/**
 * checkAlarms duplicate-prevention tests (Problem 26)
 *
 * Verifies the lastAlarmSentAt dedupe window: an alarm that was already sent
 * recently must not be sent again, even though the 2-minute time-match
 * window (current + previous minute) would otherwise match every run.
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

  it('should send the alarm on first match (no lastAlarmSentAt yet)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [userDoc('user-1', { ...baseUser })],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
    expect(mockAlarmHistoryAdd).toHaveBeenCalledTimes(1);
    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ lastAlarmSentAt: 'MOCK_SERVER_TIMESTAMP' })
    );
  });

  it('should NOT resend when lastAlarmSentAt is within the dedupe window (2 minutes ago)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 2 * 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  it('should resend once the dedupe window (10 minutes) has fully elapsed', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...baseUser,
          lastAlarmSentAt: { toMillis: () => FIXED_NOW.getTime() - 15 * 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
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
