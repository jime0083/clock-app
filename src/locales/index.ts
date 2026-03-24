import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ja from './ja.json';
import en from './en.json';

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

// Get device language
const getDeviceLanguage = (): string => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode;
  return deviceLocale === 'ja' ? 'ja' : 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export const changeLanguage = (language: 'ja' | 'en') => {
  i18n.changeLanguage(language);
};

export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export default i18n;
