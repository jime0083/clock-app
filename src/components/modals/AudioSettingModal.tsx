import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '@/constants/colors';
import { uploadAlarmSound } from '@/services/storageService';

interface AudioSettingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (audioUrl: string | null) => void;
  currentAudioUrl: string | null;
  uid: string;
}

export const AudioSettingModal: React.FC<AudioSettingModalProps> = ({
  visible,
  onClose,
  onSave,
  currentAudioUrl,
  uid,
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<'default' | 'custom'>(
    currentAudioUrl ? 'custom' : 'default'
  );
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(currentAudioUrl);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setCustomAudioName(file.name);
        setIsUploading(true);

        try {
          const uploadResult = await uploadAlarmSound(uid, file.uri, file.name);
          setCustomAudioUrl(uploadResult.url);
          setSelectedOption('custom');
        } catch (error) {
          console.error('Upload failed:', error);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking audio:', error);
    }
  };

  const handleSave = () => {
    if (selectedOption === 'default') {
      onSave(null);
    } else {
      onSave(customAudioUrl);
    }
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
          <Text style={styles.title}>{t('alarm.uploadSound')}</Text>

          <View style={styles.optionsContainer}>
            {/* Default Sound Option */}
            <Pressable
              onPress={() => setSelectedOption('default')}
              style={[
                styles.optionButton,
                selectedOption === 'default' && styles.optionButtonSelected,
              ]}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="musical-notes"
                  size={24}
                  color={selectedOption === 'default' ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedOption === 'default' && styles.optionLabelSelected,
                  ]}
                >
                  {t('alarm.defaultSound') || 'デフォルト音源'}
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedOption === 'default' && styles.radioOuterSelected,
                ]}
              >
                {selectedOption === 'default' && <View style={styles.radioInner} />}
              </View>
            </Pressable>

            {/* Custom Sound Option */}
            <Pressable
              onPress={() => customAudioUrl && setSelectedOption('custom')}
              style={[
                styles.optionButton,
                selectedOption === 'custom' && styles.optionButtonSelected,
                !customAudioUrl && styles.optionButtonDisabled,
              ]}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="cloud-upload"
                  size={24}
                  color={selectedOption === 'custom' ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedOption === 'custom' && styles.optionLabelSelected,
                  ]}
                >
                  {t('alarm.customSound') || 'カスタム音源'}
                </Text>
                {customAudioName && (
                  <Text style={styles.audioFileName}>{customAudioName}</Text>
                )}
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedOption === 'custom' && styles.radioOuterSelected,
                ]}
              >
                {selectedOption === 'custom' && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          </View>

          {/* Upload Button */}
          <Pressable
            onPress={handlePickAudio}
            style={styles.uploadButton}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>
                  {t('alarm.uploadSound')}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={handleSave} style={styles.saveButton} disabled={isUploading}>
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
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
    marginBottom: 24,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  audioFileName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  uploadButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
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
