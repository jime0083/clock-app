import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors } from '@/constants/colors';
import { changeLanguage } from '@/locales';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POPUP_WIDTH = SCREEN_WIDTH * 0.85;

interface LanguageSelectionScreenProps {
  onComplete: () => void;
}

type LanguageOption = 'ja' | 'en';

const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({
  onComplete,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);

  const handleLanguageSelect = (language: LanguageOption) => {
    setSelectedLanguage(language);
  };

  const handleConfirm = async () => {
    if (!selectedLanguage) return;

    try {
      // Apply language change (this also saves to AsyncStorage)
      await changeLanguage(selectedLanguage);
      // Notify parent that selection is complete
      onComplete();
    } catch (error) {
      console.error('Error saving language preference:', error);
      // Still proceed even if storage fails
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.popup}>
        {/* Animation */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('@assets/animations/Change Language.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>

        {/* Title - Both languages displayed */}
        <Text style={styles.titleJa}>言語を選択してください</Text>
        <Text style={styles.titleEn}>Please select a language</Text>

        {/* Language Selection Buttons */}
        <View style={styles.languageOptions}>
          <TouchableOpacity
            style={[
              styles.languageButton,
              selectedLanguage === 'ja' && styles.languageButtonSelected,
            ]}
            onPress={() => handleLanguageSelect('ja')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageButtonText,
                selectedLanguage === 'ja' && styles.languageButtonTextSelected,
              ]}
            >
              日本語
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.languageButton,
              selectedLanguage === 'en' && styles.languageButtonSelected,
            ]}
            onPress={() => handleLanguageSelect('en')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageButtonText,
                selectedLanguage === 'en' && styles.languageButtonTextSelected,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedLanguage && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!selectedLanguage}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: POPUP_WIDTH,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.cardShadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  animationContainer: {
    width: POPUP_WIDTH * 0.6,
    height: POPUP_WIDTH * 0.45,
    marginBottom: 16,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  titleJa: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  titleEn: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  languageOptions: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  languageButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  languageButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(52, 120, 246, 0.08)',
  },
  languageButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  languageButtonTextSelected: {
    color: Colors.primary,
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textInverse,
    letterSpacing: 0.5,
  },
});

export default LanguageSelectionScreen;
