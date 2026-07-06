/**
 * checkSquatCompletion duplicate-prevention tests (Problem 20/21/26)
 *
 * Verifies that the penalty tweet is posted exactly once per alarm:
 * - not before the 5-minute window (unless the client already reported failure)
 * - not if squats were completed after the alarm
 * - not if a penalty was already posted for this alarm
 */

const mockUsersGet = jest.fn();
const mockUserDocUpdate = jest.fn();
const mockPenaltyPostsAdd = jest.fn();

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
      if (name === 'penaltyPosts') {
        return { add: (data: unknown) => mockPenaltyPostsAdd(data) };
      }
      return { add: jest.fn(), get: jest.fn(), doc: jest.fn(() => ({ update: jest.fn() })) };
    },
  }) as unknown) as jest.Mock;
  (firestoreFn as unknown as { FieldValue: unknown }).FieldValue = {
    serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  };

  return {
    initializeApp: jest.fn(),
    firestore: firestoreFn,
    messaging: jest.fn(() => ({ send: jest.fn() })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const functionsTest = require('firebase-functions-test')();

import { checkSquatCompletion } from '../index';

const NOW_MS = Date.parse('2026-07-06T00:20:00.000Z');

const userDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

const connectedXUser = {
  snsConnections: { x: { connected: true, accessToken: 'tok', refreshToken: null } },
  settings: { language: 'ja' },
};

describe('checkSquatCompletion - duplicate prevention (Problem 20/21/26)', () => {
  const wrapped = functionsTest.wrap(checkSquatCompletion);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW_MS });
    mockUserDocUpdate.mockResolvedValue(undefined);
    mockPenaltyPostsAdd.mockResolvedValue(undefined);
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'tweet-123' } }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  it('should NOT post a penalty before the 5-minute window (no client failure reported)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 3 * 60 * 1000 }, // 3 min ago
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).not.toHaveBeenCalled();
  });

  it('should post a penalty once the 5-minute window has elapsed with no completion', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 6 * 60 * 1000 }, // 6 min ago
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).toHaveBeenCalledTimes(1);
    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ penaltyPostedAt: 'MOCK_SERVER_TIMESTAMP' })
    );
  });

  it('should post immediately when the client already reported alarmFailedAt (before the 5-minute window)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 2 * 60 * 1000 }, // 2 min ago
          alarmFailedAt: { toMillis: () => NOW_MS - 60 * 1000 }, // reported 1 min ago, after the alarm
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).toHaveBeenCalledTimes(1);
  });

  it('should NOT post a penalty if squats were completed after the alarm', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 6 * 60 * 1000 },
          squatCompletedAt: { toMillis: () => NOW_MS - 5 * 60 * 1000 }, // after the alarm
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).not.toHaveBeenCalled();
  });

  it('should NOT post a duplicate penalty if one was already posted for this alarm', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 6 * 60 * 1000 },
          penaltyPostedAt: { toMillis: () => NOW_MS - 5 * 60 * 1000 }, // after the alarm
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).not.toHaveBeenCalled();
  });

  it('should ignore stale data from a much older alarm (more than 30 minutes ago)', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        userDoc('user-1', {
          ...connectedXUser,
          lastAlarmSentAt: { toMillis: () => NOW_MS - 40 * 60 * 1000 },
        }),
      ],
    });

    await wrapped();

    expect(mockPenaltyPostsAdd).not.toHaveBeenCalled();
  });
});
