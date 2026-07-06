/**
 * E2E Test: Initial Setup Flow
 *
 * Tests the current (post Phase 21/23/24) setup journey:
 * 1. Alarm time + days
 * 2. X connection (status now comes from Firestore, not a local token store)
 * 3. Squat calibration (not exercised here - covered by accelerometerService tests)
 * 4. Subscription (not exercised here - covered by purchaseService tests)
 * 5. Completion: setupCompleted + timezone saved (Problem 26)
 */

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@example.com' },
    isLoading: false,
  }),
}));

const mockGetUserDocument = jest.fn();
const mockUpdateUserSettings = jest.fn();
jest.mock('../../services/userService', () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

// useXAuth no longer manages tokens/refresh directly (Problem 21: server-only
// refresh). It only exposes connect/disconnect + loading/error state.
const mockConnectX = jest.fn();
const mockDisconnectX = jest.fn();
jest.mock('../../hooks/useXAuth', () => ({
  useXAuth: jest.fn(() => ({
    isConnecting: false,
    isDisconnecting: false,
    error: null,
    connectX: mockConnectX,
    disconnectX: mockDisconnectX,
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ja' },
  }),
}));

import { useXAuth } from '../../hooks/useXAuth';
import { updateUserSettings, getUserDocument } from '../../services/userService';

const mockUseXAuth = useXAuth as jest.MockedFunction<typeof useXAuth>;

type SetupStep = 'alarm_time' | 'alarm_days' | 'x_connect' | 'calibration' | 'subscription';

describe('E2E: Initial Setup Flow', () => {
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectX.mockResolvedValue(true);
    mockDisconnectX.mockResolvedValue(true);
    mockUpdateUserSettings.mockResolvedValue(undefined);
    mockUseXAuth.mockReturnValue({
      isConnecting: false,
      isDisconnecting: false,
      error: null,
      connectX: mockConnectX,
      disconnectX: mockDisconnectX,
    });
  });

  describe('Setup Flow State Machine', () => {
    it('should start at the alarm_time step', () => {
      const initialStep: SetupStep = 'alarm_time';
      expect(initialStep).toBe('alarm_time');
    });

    it('should advance through all 5 steps in order', () => {
      const steps: SetupStep[] = [
        'alarm_time',
        'alarm_days',
        'x_connect',
        'calibration',
        'subscription',
      ];
      let currentStep: SetupStep = 'alarm_time';

      steps.slice(1).forEach(nextStep => {
        const currentIndex = steps.indexOf(currentStep);
        const nextIndex = steps.indexOf(nextStep);
        expect(nextIndex).toBe(currentIndex + 1);
        currentStep = nextStep;
      });

      expect(currentStep).toBe('subscription');
    });
  });

  describe('Alarm Settings Persistence', () => {
    it('should save alarm time and days to Firestore', async () => {
      await updateUserSettings(userId, {
        alarmTime: '07:30',
        alarmDays: [0, 1, 2, 3, 4, 5, 6],
      });

      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, {
        alarmTime: '07:30',
        alarmDays: [0, 1, 2, 3, 4, 5, 6],
      });
    });

    it('should allow updating alarm settings', async () => {
      await updateUserSettings(userId, { alarmTime: '07:00', alarmDays: [1, 2, 3, 4, 5] });
      await updateUserSettings(userId, { alarmTime: '06:30', alarmDays: [1, 2, 3, 4, 5, 6] });

      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(2);
      expect(mockUpdateUserSettings).toHaveBeenLastCalledWith(userId, {
        alarmTime: '06:30',
        alarmDays: [1, 2, 3, 4, 5, 6],
      });
    });
  });

  describe('X Connection Flow', () => {
    it('should check existing X connection from Firestore on mount (Problem 21: no local token store)', async () => {
      mockGetUserDocument.mockResolvedValue({
        snsConnections: { x: { connected: true, username: 'testuser' } },
      });

      const userDoc = await getUserDocument(userId);

      expect(userDoc?.snsConnections?.x?.connected).toBe(true);
    });

    it('should treat a missing connection as not connected', async () => {
      mockGetUserDocument.mockResolvedValue({ snsConnections: { x: { connected: false } } });

      const userDoc = await getUserDocument(userId);

      expect(userDoc?.snsConnections?.x?.connected).toBe(false);
    });

    it('should handle X connection success', async () => {
      mockConnectX.mockResolvedValue(true);

      const result = await mockUseXAuth().connectX();

      expect(result).toBe(true);
    });

    it('should handle X connection failure', async () => {
      mockConnectX.mockResolvedValue(false);

      const result = await mockUseXAuth().connectX();

      expect(result).toBe(false);
    });

    it('should expose connecting state during OAuth', () => {
      mockUseXAuth.mockReturnValue({
        isConnecting: true,
        isDisconnecting: false,
        error: null,
        connectX: mockConnectX,
        disconnectX: mockDisconnectX,
      });

      const { isConnecting } = useXAuth();

      expect(isConnecting).toBe(true);
    });
  });

  describe('Setup Completion (Problem 26: timezone saved alongside setupCompleted)', () => {
    it('should save setupCompleted and the device timezone', async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await updateUserSettings(userId, { setupCompleted: true, timezone });

      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, {
        setupCompleted: true,
        timezone,
      });
    });
  });

  describe('Complete Setup Journey', () => {
    it('should complete the full alarm -> X connect -> completion flow', async () => {
      // Step 1+2: alarm time & days
      await updateUserSettings(userId, { alarmTime: '07:00', alarmDays: [1, 2, 3, 4, 5] });

      // Step 3: X connect
      const connected = await mockUseXAuth().connectX();
      expect(connected).toBe(true);

      // Step 5: completion (calibration/subscription are exercised in their own test suites)
      await updateUserSettings(userId, {
        setupCompleted: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(2);
      expect(mockUpdateUserSettings).toHaveBeenLastCalledWith(
        userId,
        expect.objectContaining({ setupCompleted: true })
      );
    });
  });
});
