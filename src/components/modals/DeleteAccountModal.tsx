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
import { Colors } from '@/constants/colors';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setIsDeleting(false);
    }
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
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={isDeleting ? undefined : onClose}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={styles.modal}
        >
          <View style={styles.handle} />

          <Animated.View
            entering={FadeIn.delay(100).duration(300)}
            style={styles.iconContainer}
          >
            <Ionicons name="warning" size={48} color={Colors.error} />
          </Animated.View>

          <Text style={styles.title}>{t('settings.deleteAccount')}</Text>
          <Text style={styles.message}>{t('settings.deleteAccountConfirm')}</Text>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.cancelButton]}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={[styles.button, styles.deleteButton]}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
              )}
            </Pressable>
          </View>
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
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: Colors.backgroundTertiary,
  },
  cancelButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
