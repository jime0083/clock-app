import React from 'react';
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
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface WeeklySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  successCount: number;
  squatCount: number;
}

export const WeeklySummaryModal: React.FC<WeeklySummaryModalProps> = ({
  visible,
  onClose,
  successCount,
  squatCount,
}) => {
  const { t } = useTranslation();

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
          entering={SlideInUp.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modal}
          >
            <View style={styles.handle} />

            {/* Header Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={40} color="#667eea" />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Weekly Summary</Text>

            {/* Summary Message */}
            <Text style={styles.summaryText}>
              {t('weekly.summary', { successCount, squatCount })}
            </Text>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="sunny" size={28} color="#FFD93D" />
                <Text style={styles.statValue}>{successCount}</Text>
                <Text style={styles.statLabel}>{t('home.day')}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statCard}>
                <Ionicons name="fitness" size={28} color="#6BCB77" />
                <Text style={styles.statValue}>{squatCount}</Text>
                <Text style={styles.statLabel}>{t('home.times')}</Text>
              </View>
            </View>

            {/* Close Button */}
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('common.ok')}</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  modalContainer: {
    width: '85%',
    maxWidth: 360,
  },
  modal: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
});
