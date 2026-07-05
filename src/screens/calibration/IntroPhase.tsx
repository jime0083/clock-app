import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { styles } from './styles';

interface IntroPhaseProps {
  onStart: () => void;
  onClose: () => void;
}

export const IntroPhase: React.FC<IntroPhaseProps> = ({ onStart, onClose }) => {
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#1A1A2E', '#16213E', '#0F3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFFFFF80" />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.introContent}>
          <View style={styles.iconContainer}>
            <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.iconGradient}>
              <Ionicons name="fitness" size={60} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.introTitle}>{t('calibration.title')}</Text>
          <Text style={styles.introSubtitle}>{t('calibration.subtitle')}</Text>

          <View style={styles.instructionCard}>
            <Ionicons name="phone-portrait-outline" size={40} color="#4CAF50" />
            <Text style={styles.instructionText}>{t('calibration.instruction')}</Text>
          </View>

          <Animated.View
            entering={FadeInUp.duration(600).delay(400)}
            style={styles.startButtonContainer}
          >
            <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.9}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButtonGradient}
              >
                <Text style={styles.startButtonText}>{t('calibration.start')}</Text>
                <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};
