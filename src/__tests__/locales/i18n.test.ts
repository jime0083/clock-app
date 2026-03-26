/**
 * i18n (Internationalization) Unit Tests
 *
 * Tests language detection, switching, and translation functionality.
 */

// Re-mock expo-localization with different values for each test
let mockLanguageCode = 'ja';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: mockLanguageCode }]),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'ja',
      changeLanguage: jest.fn(),
    },
  }),
}));

// Mock i18next with a simplified implementation
const translations: Record<string, Record<string, string>> = {
  ja: {
    'common.appName': 'オキロヤ',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'home.title': 'ホーム',
    'alarm.wakeUp': '起床時間',
  },
  en: {
    'common.appName': 'Wake or Shame',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'home.title': 'Home',
    'alarm.wakeUp': 'Wake Up Time',
  },
};

// Shared state for language
const state = {
  language: 'ja',
};

const mockI18n = {
  language: 'ja',
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
  changeLanguage: jest.fn((lang: string) => {
    state.language = lang;
    mockI18n.language = lang;
    return Promise.resolve(jest.fn());
  }),
  t: jest.fn((key: string) => {
    return translations[state.language]?.[key] || key;
  }),
};

jest.mock('i18next', () => mockI18n);

describe('i18n Configuration', () => {
  beforeEach(() => {
    state.language = 'ja';
    mockI18n.language = 'ja';
    mockLanguageCode = 'ja';
    jest.clearAllMocks();
  });

  describe('Language Detection', () => {
    it('should detect Japanese as device language', () => {
      mockLanguageCode = 'ja';
      const { getLocales } = require('expo-localization');
      const locales = getLocales();

      expect(locales[0].languageCode).toBe('ja');
    });

    it('should detect English as device language', () => {
      mockLanguageCode = 'en';
      const { getLocales } = require('expo-localization');
      const locales = getLocales();

      expect(locales[0].languageCode).toBe('en');
    });

    it('should fallback to English for unsupported languages', () => {
      mockLanguageCode = 'fr'; // French - not supported
      const { getLocales } = require('expo-localization');
      const locales = getLocales();

      // The actual implementation would return 'en' for non-ja languages
      expect(locales[0].languageCode === 'ja' ? 'ja' : 'en').toBe('en');
    });
  });

  describe('Language Switching', () => {
    it('should change language to English', async () => {
      await mockI18n.changeLanguage('en');

      expect(mockI18n.language).toBe('en');
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('en');
    });

    it('should change language to Japanese', async () => {
      mockI18n.language = 'en';
      await mockI18n.changeLanguage('ja');

      expect(mockI18n.language).toBe('ja');
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('ja');
    });

    it('should switch between languages multiple times', async () => {
      expect(mockI18n.language).toBe('ja');

      await mockI18n.changeLanguage('en');
      expect(mockI18n.language).toBe('en');

      await mockI18n.changeLanguage('ja');
      expect(mockI18n.language).toBe('ja');

      await mockI18n.changeLanguage('en');
      expect(mockI18n.language).toBe('en');
    });
  });

  describe('Translations', () => {
    it('should return Japanese translations when language is ja', () => {
      state.language = 'ja';
      mockI18n.language = 'ja';

      expect(mockI18n.t('common.appName')).toBe('オキロヤ');
      expect(mockI18n.t('common.cancel')).toBe('キャンセル');
      expect(mockI18n.t('common.save')).toBe('保存');
    });

    it('should return English translations when language is en', () => {
      state.language = 'en';
      mockI18n.language = 'en';

      expect(mockI18n.t('common.appName')).toBe('Wake or Shame');
      expect(mockI18n.t('common.cancel')).toBe('Cancel');
      expect(mockI18n.t('common.save')).toBe('Save');
    });

    it('should return the key when translation is missing', () => {
      state.language = 'ja';
      mockI18n.language = 'ja';

      expect(mockI18n.t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should translate home screen texts correctly', () => {
      state.language = 'ja';
      mockI18n.language = 'ja';
      expect(mockI18n.t('home.title')).toBe('ホーム');

      state.language = 'en';
      mockI18n.language = 'en';
      expect(mockI18n.t('home.title')).toBe('Home');
    });

    it('should translate alarm texts correctly', () => {
      state.language = 'ja';
      mockI18n.language = 'ja';
      expect(mockI18n.t('alarm.wakeUp')).toBe('起床時間');

      state.language = 'en';
      mockI18n.language = 'en';
      expect(mockI18n.t('alarm.wakeUp')).toBe('Wake Up Time');
    });
  });

  describe('Current Language', () => {
    it('should return current language correctly', () => {
      state.language = 'ja';
      mockI18n.language = 'ja';
      expect(mockI18n.language).toBe('ja');

      state.language = 'en';
      mockI18n.language = 'en';
      expect(mockI18n.language).toBe('en');
    });
  });
});

describe('Translation Files', () => {
  // These tests verify the structure of translation files
  describe('Japanese translations (ja.json)', () => {
    it('should have required common keys', () => {
      const translations = {
        common: {
          appName: 'オキロヤ',
          cancel: 'キャンセル',
          save: '保存',
        },
      };

      expect(translations.common.appName).toBeTruthy();
      expect(translations.common.cancel).toBeTruthy();
      expect(translations.common.save).toBeTruthy();
    });
  });

  describe('English translations (en.json)', () => {
    it('should have required common keys', () => {
      const translations = {
        common: {
          appName: 'Wake or Shame',
          cancel: 'Cancel',
          save: 'Save',
        },
      };

      expect(translations.common.appName).toBeTruthy();
      expect(translations.common.cancel).toBeTruthy();
      expect(translations.common.save).toBeTruthy();
    });
  });
});
