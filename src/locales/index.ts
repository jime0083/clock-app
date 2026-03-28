import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ja from './ja.json';
import en from './en.json';

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

const LANGUAGE_STORAGE_KEY = '@okiroya_language';

// Get device language as fallback
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

// Load saved language preference from AsyncStorage
export const loadSavedLanguage = async (): Promise<string | null> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && (savedLanguage === 'ja' || savedLanguage === 'en')) {
      i18n.changeLanguage(savedLanguage);
      return savedLanguage;
    }
    return null;
  } catch (error) {
    console.error('Error loading saved language:', error);
    return null;
  }
};

// Check if language has been selected (first launch check)
export const hasLanguageBeenSelected = async (): Promise<boolean> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return savedLanguage !== null;
  } catch (error) {
    console.error('Error checking language selection:', error);
    return false;
  }
};

export const changeLanguage = async (language: 'ja' | 'en'): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    i18n.changeLanguage(language);
  } catch (error) {
    console.error('Error saving language:', error);
    // Still change the language even if storage fails
    i18n.changeLanguage(language);
  }
};

export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export default i18n;
