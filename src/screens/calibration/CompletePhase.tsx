import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';
import { styles } from './styles';

interface CompletePhaseProps {
  onFinish: () => void;
}

export const CompletePhase: React.FC<CompletePhaseProps> = ({ onFinish }) => {
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#1A1A2E', '#16213E', '#0F3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.completeContent}>
          <View style={styles.completeIconContainer}>
            <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.completeIconGradient}>
              <Ionicons name="checkmark" size={80} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.completeTitle}>{t('calibration.complete')}</Text>
          <Text style={styles.completeSubtitle}>{t('calibration.completeDesc')}</Text>

          <TouchableOpacity style={styles.finishButton} onPress={onFinish} activeOpacity={0.9}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.finishButtonGradient}
            >
              <Text style={styles.finishButtonText}>{t('calibration.finish')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};
