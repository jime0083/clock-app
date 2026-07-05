import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { styles, REQUIRED_SQUATS } from './styles';

type CalibrationPhase = 'ready' | 'measuring' | 'complete';

interface CalibrationStepProps {
  calibrationPhase: CalibrationPhase;
  squatCount: number;
  onStart: () => void;
}

export const CalibrationStep: React.FC<CalibrationStepProps> = ({
  calibrationPhase,
  squatCount,
  onStart,
}) => {
  const { t } = useTranslation();

  if (calibrationPhase === 'measuring') {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.animationContainer}>
          <LottieView
            source={require('@assets/animations/Character squat animation.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.subtitle}>{t('calibration.detecting')}</Text>
          <Text style={styles.title}>
            {t('calibration.progress', { current: squatCount, total: REQUIRED_SQUATS })}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { width: `${(squatCount / REQUIRED_SQUATS) * 100}%` }]}
          />
        </View>

        <Text style={styles.description}>{t('squat.description')}</Text>
      </View>
    );
  }

  if (calibrationPhase === 'complete') {
    return (
      <View style={styles.stepContainer}>
        <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        <Text style={[styles.title, { marginTop: 24 }]}>{t('calibration.complete')}</Text>
        <Text style={styles.description}>{t('calibration.completeDesc')}</Text>
      </View>
    );
  }

  // Ready state
  return (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/Character squat animation.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.subtitle}>{t('squat.title')}</Text>
        <Text style={styles.title}>
          {t('calibration.phaseNormalDesc').replace('5', String(REQUIRED_SQUATS))}
        </Text>
      </View>
      <Text style={styles.description}>{t('squat.description')}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onStart} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{t('calibration.start')}</Text>
      </TouchableOpacity>
    </View>
  );
};
