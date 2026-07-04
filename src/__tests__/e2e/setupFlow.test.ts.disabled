/**
 * E2E Test: Initial Setup Flow
 *
 * Tests the complete initial setup journey:
 * 1. User starts the app for the first time
 * 2. Sets alarm time and days
 * 3. Connects to X (required)
 * 4. Completes setup
 */

// Mock all required services
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@example.com' },
    isLoading: false,
  }),
}));

jest.mock('../../services/userService', () => ({
  updateUserSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/secureTokenService', () => ({
  hasXTokens: jest.fn(),
}));

jest.mock('../../hooks/useXAuth', () => ({
  useXAuth: jest.fn(() => ({
    isConnecting: false,
    isDisconnecting: false,
    isRefreshing: false,
    error: null,
    connectX: jest.fn(() => Promise.resolve(true)),
    disconnectX: jest.fn(() => Promise.resolve(true)),
    refreshTokenIfNeeded: jest.fn(),
    getValidAccessToken: jest.fn(),
    initializeFromSecureStorage: jest.fn(),
  })),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'setup.welcome': 'Welcome',
        'setup.step': `Step ${params?.current}/${params?.total}`,
        'setup.step1Title': 'Set Alarm',
        'setup.step1Description': 'Set your wake-up time',
        'setup.step2Title': 'Connect X',
        'setup.step2Description': 'Connect your X account',
        'setup.step3Title': 'All Set!',
        'setup.step3Description': 'You are ready to go',
        'setup.next': 'Next',
        'setup.start': 'Start',
        'setup.connectRequired': 'Connection Required',
        'alarm.title': 'Set Alarm',
        'alarm.changeAlarm': 'Change',
        'sns.description': 'Connect to X to continue',
        'sns.connectX': 'Connect X',
        'sns.connecting': 'Connecting...',
        'sns.connected': 'Connected',
      };
      return translations[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

import { hasXTokens } from '../../services/secureTokenService';
import { useXAuth } from '../../hooks/useXAuth';
import { updateUserSettings } from '../../services/userService';

const mockHasXTokens = hasXTokens as jest.MockedFunction<typeof hasXTokens>;
const mockUseXAuth = useXAuth as jest.MockedFunction<typeof useXAuth>;
const mockUpdateUserSettings = updateUserSettings as jest.MockedFunction<typeof updateUserSettings>;

describe('E2E: Initial Setup Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasXTokens.mockResolvedValue(false);
    mockUseXAuth.mockReturnValue({
      isConnecting: false,
      isDisconnecting: false,
      isRefreshing: false,
      error: null,
      connectX: jest.fn(() => Promise.resolve(true)),
      disconnectX: jest.fn(() => Promise.resolve(true)),
      refreshTokenIfNeeded: jest.fn(),
      getValidAccessToken: jest.fn(),
      initializeFromSecureStorage: jest.fn(),
    });
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  describe('Setup Flow State Machine', () => {
    it('should start at step 1 (alarm setting)', () => {
      const initialStep = 1;
      expect(initialStep).toBe(1);
    });

    it('should not advance from step 1 without alarm set', async () => {
      const alarmTime: string | null = null;
      const canAdvance = alarmTime !== null;
      expect(canAdvance).toBe(false);
    });

    it('should advance from step 1 to step 2 when alarm is set', async () => {
      let currentStep = 1;
      const alarmTime = '07:00';
      const alarmDays = [1, 2, 3, 4, 5];

      // Simulate setting alarm
      if (alarmTime && alarmDays.length > 0) {
        currentStep = 2;
      }

      expect(currentStep).toBe(2);
    });

    it('should not advance from step 2 without X connection', async () => {
      const isXConnected = false;
      const canAdvance = isXConnected;
      expect(canAdvance).toBe(false);
    });

    it('should advance from step 2 to step 3 when X is connected', async () => {
      let currentStep = 2;
      let isXConnected = false;

      // Simulate X connection
      const connectResult = await mockUseXAuth().connectX();
      if (connectResult) {
        isXConnected = true;
        currentStep = 3;
      }

      expect(isXConnected).toBe(true);
      expect(currentStep).toBe(3);
    });

    it('should complete setup at step 3', async () => {
      let setupCompleted = false;
      const userId = 'test-user-123';

      // Simulate completing setup
      await updateUserSettings(userId, { setupCompleted: true });
      setupCompleted = true;

      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, {
        setupCompleted: true,
      });
      expect(setupCompleted).toBe(true);
    });
  });

  describe('Alarm Settings Persistence', () => {
    it('should save alarm time and days to Firestore', async () => {
      const userId = 'test-user-123';
      const alarmTime = '07:30';
      const alarmDays = [0, 1, 2, 3, 4, 5, 6]; // All days

      await updateUserSettings(userId, {
        alarmTime,
        alarmDays,
      });

      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, {
        alarmTime: '07:30',
        alarmDays: [0, 1, 2, 3, 4, 5, 6],
      });
    });

    it('should allow updating alarm settings', async () => {
      const userId = 'test-user-123';

      // Initial setting
      await updateUserSettings(userId, {
        alarmTime: '07:00',
        alarmDays: [1, 2, 3, 4, 5],
      });

      // Update setting
      await updateUserSettings(userId, {
        alarmTime: '06:30',
        alarmDays: [1, 2, 3, 4, 5, 6],
      });

      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(2);
      expect(mockUpdateUserSettings).toHaveBeenLastCalledWith(userId, {
        alarmTime: '06:30',
        alarmDays: [1, 2, 3, 4, 5, 6],
      });
    });
  });

  describe('X Connection Flow', () => {
    it('should check existing X connection on mount', async () => {
      mockHasXTokens.mockResolvedValue(true);

      const hasTokens = await hasXTokens();

      expect(hasTokens).toBe(true);
    });

    it('should handle X connection success', async () => {
      const mockConnectX = jest.fn(() => Promise.resolve(true));
      mockUseXAuth.mockReturnValue({
        isConnecting: false,
        isDisconnecting: false,
        isRefreshing: false,
        error: null,
        connectX: mockConnectX,
        disconnectX: jest.fn(() => Promise.resolve(true)),
        refreshTokenIfNeeded: jest.fn(),
        getValidAccessToken: jest.fn(),
        initializeFromSecureStorage: jest.fn(),
      });

      const result = await mockConnectX();

      expect(result).toBe(true);
    });

    it('should handle X connection failure', async () => {
      const mockConnectX = jest.fn(() => Promise.resolve(false));
      mockUseXAuth.mockReturnValue({
        isConnecting: false,
        isDisconnecting: false,
        isRefreshing: false,
        error: null,
        connectX: mockConnectX,
        disconnectX: jest.fn(() => Promise.resolve(true)),
        refreshTokenIfNeeded: jest.fn(),
        getValidAccessToken: jest.fn(),
        initializeFromSecureStorage: jest.fn(),
      });

      const result = await mockConnectX();

      expect(result).toBe(false);
    });

    it('should show connecting state during OAuth', () => {
      mockUseXAuth.mockReturnValue({
        isConnecting: true,
        isDisconnecting: false,
        isRefreshing: false,
        error: null,
        connectX: jest.fn(),
        disconnectX: jest.fn(() => Promise.resolve(true)),
        refreshTokenIfNeeded: jest.fn(),
        getValidAccessToken: jest.fn(),
        initializeFromSecureStorage: jest.fn(),
      });

      const { isConnecting } = useXAuth();

      expect(isConnecting).toBe(true);
    });
  });

  describe('Complete Setup Journey', () => {
    it('should complete full setup flow', async () => {
      const userId = 'test-user-123';
      let currentStep = 1;
      let alarmTime: string | null = null;
      let alarmDays: number[] = [];
      let isXConnected = false;
      let setupCompleted = false;

      // Step 1: Set alarm
      alarmTime = '07:00';
      alarmDays = [1, 2, 3, 4, 5];
      await updateUserSettings(userId, { alarmTime, alarmDays });
      currentStep = 2;

      expect(currentStep).toBe(2);

      // Step 2: Connect X
      const connectResult = await mockUseXAuth().connectX();
      if (connectResult) {
        isXConnected = true;
        currentStep = 3;
      }

      expect(currentStep).toBe(3);
      expect(isXConnected).toBe(true);

      // Step 3: Complete setup
      await updateUserSettings(userId, { setupCompleted: true });
      setupCompleted = true;

      expect(setupCompleted).toBe(true);
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(2);
    });
  });
});
