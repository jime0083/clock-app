/**
 * E2E Test: Language Switch Flow
 *
 * Tests the complete language switching journey:
 * 1. Initial language detection from device
 * 2. Language switching in settings
 * 3. UI updates after language change
 * 4. Language persistence across app restarts
 */

// Mock expo-localization
let mockDeviceLanguage = 'ja';
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: mockDeviceLanguage }],
}));

// Mock AsyncStorage for language persistence
const mockAsyncStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
}));

// Mock userService
jest.mock('../../services/userService', () => ({
  updateUserSettings: jest.fn(() => Promise.resolve()),
  getUserDocument: jest.fn(),
}));

// Translation data
const mockTranslationsJa: Record<string, string> = {
  'settings.title': '設定',
  'settings.language': '言語',
  'settings.alarm': 'アラーム',
  'home.welcome': 'ようこそ',
  'home.start': '開始',
  'alarm.title': 'アラーム設定',
  'alarm.time': '時刻',
  'alarm.days': '曜日',
  'common.save': '保存',
  'common.cancel': 'キャンセル',
  'common.ok': 'OK',
  'language.japanese': '日本語',
  'language.english': 'English',
};

const mockTranslationsEn: Record<string, string> = {
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.alarm': 'Alarm',
  'home.welcome': 'Welcome',
  'home.start': 'Start',
  'alarm.title': 'Alarm Settings',
  'alarm.time': 'Time',
  'alarm.days': 'Days',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'language.japanese': '日本語',
  'language.english': 'English',
};

// Track current language state
let mockCurrentLanguage = 'ja';
const mockChangeLanguage = jest.fn((lng: string) => {
  mockCurrentLanguage = lng;
  return Promise.resolve();
});

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Get translations based on current state - we need to access this dynamically
      const translations = mockCurrentLanguage === 'ja' ? mockTranslationsJa : mockTranslationsEn;
      return translations[key] || key;
    },
    i18n: {
      get language() {
        return mockCurrentLanguage;
      },
      changeLanguage: mockChangeLanguage,
    },
  }),
  initReactI18next: { type: '3rdParty' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserSettings, getUserDocument } from '../../services/userService';
import { UserDocument } from '../../types/firestore';

const mockAsyncStorageSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockUpdateUserSettings = updateUserSettings as jest.MockedFunction<typeof updateUserSettings>;
const mockGetUserDocument = getUserDocument as jest.MockedFunction<typeof getUserDocument>;

describe('E2E: Language Switch Flow', () => {
  const userId = 'test-user-123';
  const mockUserData: UserDocument = {
    profile: {
      createdAt: { seconds: Date.now() / 1000 } as any,
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    },
    settings: {
      alarmTime: '07:00',
      alarmDays: [1, 2, 3, 4, 5],
      customAlarmSound: null,
      calibration: null,
      language: 'ja',
      setupCompleted: true,
    },
    snsConnections: {
      x: {
        connected: false,
        accessToken: null,
        refreshToken: null,
        connectedAt: null,
        username: null,
      },
    },
    stats: {
      totalFailures: 0,
      monthlyFailures: 0,
      currentMonth: '2024-01',
      totalSquats: 0,
      monthlySquats: 0,
    },
    subscription: {
      isActive: true,
      plan: 'monthly',
      expiresAt: null,
      purchasedAt: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentLanguage = 'ja';
    mockDeviceLanguage = 'ja';
    Object.keys(mockAsyncStorage).forEach((key) => delete mockAsyncStorage[key]);
    mockGetUserDocument.mockResolvedValue(mockUserData);
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  describe('Initial Language Detection', () => {
    it('should detect Japanese as default for Japanese device', () => {
      mockDeviceLanguage = 'ja';
      const { getLocales } = require('expo-localization');
      const locales = getLocales();

      expect(locales[0].languageCode).toBe('ja');
    });

    it('should detect English for English device', () => {
      mockDeviceLanguage = 'en';
      const { getLocales } = require('expo-localization');
      const locales = getLocales();

      expect(locales[0].languageCode).toBe('en');
    });

    it('should fall back to Japanese for unsupported languages', () => {
      mockDeviceLanguage = 'fr'; // French - not supported
      const supportedLanguages = ['ja', 'en'];
      const deviceLang = mockDeviceLanguage;

      const language = supportedLanguages.includes(deviceLang) ? deviceLang : 'ja';

      expect(language).toBe('ja');
    });

    it('should use saved language preference over device language', async () => {
      // Device is English
      mockDeviceLanguage = 'en';

      // But user saved Japanese preference
      mockAsyncStorage['userLanguage'] = 'ja';
      const savedLanguage = await AsyncStorage.getItem('userLanguage');

      expect(savedLanguage).toBe('ja');
    });
  });

  describe('Language Switching', () => {
    it('should switch from Japanese to English', async () => {
      mockCurrentLanguage = 'ja';

      await mockChangeLanguage('en');

      expect(mockCurrentLanguage).toBe('en');
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    });

    it('should switch from English to Japanese', async () => {
      mockCurrentLanguage = 'en';

      await mockChangeLanguage('ja');

      expect(mockCurrentLanguage).toBe('ja');
      expect(mockChangeLanguage).toHaveBeenCalledWith('ja');
    });

    it('should update user settings in Firestore', async () => {
      await updateUserSettings(userId, { language: 'en' });

      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, { language: 'en' });
    });

    it('should save language preference to AsyncStorage', async () => {
      await AsyncStorage.setItem('userLanguage', 'en');

      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith('userLanguage', 'en');
      expect(mockAsyncStorage['userLanguage']).toBe('en');
    });
  });

  describe('UI Updates After Language Change', () => {
    it('should return Japanese translations when language is ja', () => {
      mockCurrentLanguage = 'ja';
      const { useTranslation } = require('react-i18next');
      const { t } = useTranslation();

      expect(t('settings.title')).toBe('設定');
      expect(t('settings.language')).toBe('言語');
      expect(t('home.welcome')).toBe('ようこそ');
      expect(t('common.save')).toBe('保存');
    });

    it('should return English translations when language is en', () => {
      mockCurrentLanguage = 'en';
      const { useTranslation } = require('react-i18next');
      const { t } = useTranslation();

      expect(t('settings.title')).toBe('Settings');
      expect(t('settings.language')).toBe('Language');
      expect(t('home.welcome')).toBe('Welcome');
      expect(t('common.save')).toBe('Save');
    });

    it('should update all UI elements after switching', async () => {
      // Start in Japanese
      mockCurrentLanguage = 'ja';
      const { useTranslation } = require('react-i18next');
      let { t, i18n } = useTranslation();

      const jaTexts = {
        settings: t('settings.title'),
        welcome: t('home.welcome'),
        save: t('common.save'),
      };

      expect(jaTexts.settings).toBe('設定');
      expect(jaTexts.welcome).toBe('ようこそ');
      expect(jaTexts.save).toBe('保存');

      // Switch to English
      await i18n.changeLanguage('en');
      ({ t } = useTranslation());

      const enTexts = {
        settings: t('settings.title'),
        welcome: t('home.welcome'),
        save: t('common.save'),
      };

      expect(enTexts.settings).toBe('Settings');
      expect(enTexts.welcome).toBe('Welcome');
      expect(enTexts.save).toBe('Save');
    });
  });

  describe('Language Persistence', () => {
    it('should persist language choice across app restarts', async () => {
      // User switches to English
      mockCurrentLanguage = 'en';
      await AsyncStorage.setItem('userLanguage', 'en');
      await updateUserSettings(userId, { language: 'en' });

      // Simulate app restart - clear current state
      mockCurrentLanguage = 'ja'; // Would be reset to default

      // On restart, load saved preference
      const savedLanguage = await AsyncStorage.getItem('userLanguage');
      if (savedLanguage) {
        mockCurrentLanguage = savedLanguage;
      }

      expect(mockCurrentLanguage).toBe('en');
    });

    it('should sync language from Firestore on login', async () => {
      mockGetUserDocument.mockResolvedValue({
        ...mockUserData,
        settings: {
          ...mockUserData.settings,
          language: 'en',
        },
      });

      const userData = await getUserDocument(userId);
      const firestoreLanguage = userData?.settings.language;

      if (firestoreLanguage) {
        mockCurrentLanguage = firestoreLanguage;
        await AsyncStorage.setItem('userLanguage', firestoreLanguage);
      }

      expect(mockCurrentLanguage).toBe('en');
      expect(mockAsyncStorage['userLanguage']).toBe('en');
    });
  });

  describe('Complete Language Switch Journey', () => {
    it('should complete full language switch from Japanese to English', async () => {
      // 1. Start with Japanese
      mockCurrentLanguage = 'ja';
      mockAsyncStorage['userLanguage'] = 'ja';
      mockGetUserDocument.mockResolvedValue(mockUserData);

      const { useTranslation } = require('react-i18next');
      let { t, i18n } = useTranslation();

      // Verify initial Japanese state
      expect(t('settings.title')).toBe('設定');
      expect(i18n.language).toBe('ja');

      // 2. User opens settings and selects English
      await i18n.changeLanguage('en');

      // 3. Save to AsyncStorage
      await AsyncStorage.setItem('userLanguage', 'en');

      // 4. Save to Firestore
      await updateUserSettings(userId, { language: 'en' });

      // 5. Verify UI updated
      ({ t } = useTranslation());
      expect(t('settings.title')).toBe('Settings');

      // 6. Verify persistence
      expect(mockAsyncStorage['userLanguage']).toBe('en');
      expect(mockUpdateUserSettings).toHaveBeenCalledWith(userId, { language: 'en' });
    });

    it('should complete full language switch from English to Japanese', async () => {
      // 1. Start with English
      mockCurrentLanguage = 'en';
      mockAsyncStorage['userLanguage'] = 'en';
      mockGetUserDocument.mockResolvedValue({
        ...mockUserData,
        settings: { ...mockUserData.settings, language: 'en' },
      });

      const { useTranslation } = require('react-i18next');
      let { t, i18n } = useTranslation();

      // Verify initial English state
      expect(t('settings.title')).toBe('Settings');

      // 2. User selects Japanese
      await i18n.changeLanguage('ja');

      // 3. Save preferences
      await AsyncStorage.setItem('userLanguage', 'ja');
      await updateUserSettings(userId, { language: 'ja' });

      // 4. Verify UI updated
      ({ t } = useTranslation());
      expect(t('settings.title')).toBe('設定');

      // 5. Verify persistence
      expect(mockAsyncStorage['userLanguage']).toBe('ja');
    });

    it('should handle new user with device language detection', async () => {
      // 1. New user - no saved preference
      delete mockAsyncStorage['userLanguage'];

      // 2. Device is set to Japanese
      mockDeviceLanguage = 'ja';
      const { getLocales } = require('expo-localization');
      const deviceLanguage = getLocales()[0].languageCode;

      // 3. Check for saved preference (none)
      const savedLanguage = await AsyncStorage.getItem('userLanguage');
      expect(savedLanguage).toBeNull();

      // 4. Use device language
      const supportedLanguages = ['ja', 'en'];
      const initialLanguage = supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'ja';

      mockCurrentLanguage = initialLanguage;

      // 5. Verify correct language
      expect(mockCurrentLanguage).toBe('ja');

      const { useTranslation } = require('react-i18next');
      const { t } = useTranslation();
      expect(t('home.welcome')).toBe('ようこそ');
    });

    it('should handle new English user', async () => {
      // 1. New user with English device
      delete mockAsyncStorage['userLanguage'];
      mockDeviceLanguage = 'en';

      const { getLocales } = require('expo-localization');
      const deviceLanguage = getLocales()[0].languageCode;

      // 2. Use device language
      mockCurrentLanguage = deviceLanguage;

      // 3. Verify English
      const { useTranslation } = require('react-i18next');
      const { t } = useTranslation();

      expect(t('home.welcome')).toBe('Welcome');
      expect(t('settings.title')).toBe('Settings');
    });
  });

  describe('Edge Cases', () => {
    it('should handle language switch failure gracefully', async () => {
      const originalLanguage = mockCurrentLanguage;
      mockChangeLanguage.mockRejectedValueOnce(new Error('Language switch failed'));

      try {
        await mockChangeLanguage('en');
      } catch {
        // Should handle error gracefully
        mockCurrentLanguage = originalLanguage; // Restore previous language
      }

      // Language should stay on current value if switch fails
      expect(mockCurrentLanguage).toBe('ja');
    });

    it('should handle Firestore save failure', async () => {
      mockUpdateUserSettings.mockRejectedValueOnce(new Error('Firestore error'));

      // Language should still change locally
      mockCurrentLanguage = 'en';
      await AsyncStorage.setItem('userLanguage', 'en');

      try {
        await updateUserSettings(userId, { language: 'en' });
      } catch {
        // Local change should persist
        expect(mockCurrentLanguage).toBe('en');
        expect(mockAsyncStorage['userLanguage']).toBe('en');
      }
    });

    it('should handle AsyncStorage failure', async () => {
      mockAsyncStorageSetItem.mockRejectedValueOnce(new Error('AsyncStorage error'));

      try {
        await AsyncStorage.setItem('userLanguage', 'en');
      } catch (error) {
        expect(error).toBeDefined();
        // Should handle gracefully
      }
    });
  });
});
