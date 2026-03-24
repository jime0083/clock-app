import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type Language = 'ja' | 'en';

interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'ja', label: '日本語', nativeLabel: 'Japanese' },
  { code: 'en', label: 'English', nativeLabel: '英語' },
];

interface LanguageSettingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (language: Language) => void;
  currentLanguage: Language;
}

export const LanguageSettingModal: React.FC<LanguageSettingModalProps> = ({
  visible,
  onClose,
  onSave,
  currentLanguage,
}) => {
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(currentLanguage);

  useEffect(() => {
    if (visible) {
      setSelectedLanguage(currentLanguage);
    }
  }, [visible, currentLanguage]);

  const handleSave = () => {
    onSave(selectedLanguage);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={styles.modal}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{t('settings.language')}</Text>
          <Text style={styles.subtitle}>{t('language.title')}</Text>

          <View style={styles.optionsContainer}>
            {LANGUAGES.map((lang, index) => (
              <LanguageOptionButton
                key={lang.code}
                option={lang}
                isSelected={selectedLanguage === lang.code}
                onPress={() => setSelectedLanguage(lang.code)}
                index={index}
              />
            ))}
          </View>

          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface LanguageOptionButtonProps {
  option: LanguageOption;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}

const LanguageOptionButton: React.FC<LanguageOptionButtonProps> = ({
  option,
  isSelected,
  onPress,
  index,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View
      entering={FadeIn.delay(100 + index * 80).duration(300)}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
      >
        <View style={styles.optionContent}>
          <Text
            style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
          >
            {option.label}
          </Text>
          <Text
            style={[
              styles.optionNativeLabel,
              isSelected && styles.optionNativeLabelSelected,
            ]}
          >
            {option.nativeLabel}
          </Text>
        </View>
        <View
          style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
        >
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.backgroundTertiary,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: Colors.primaryLight + '15',
    borderColor: Colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionNativeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  optionNativeLabelSelected: {
    color: Colors.primaryLight,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
