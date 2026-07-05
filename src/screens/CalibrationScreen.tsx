import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useCalibration } from '@/hooks/useAccelerometer';
import { SquatDetectionConfig } from '@/services/accelerometerService';
import { IntroPhase } from './calibration/IntroPhase';
import { CompletePhase } from './calibration/CompletePhase';
import { CalibratingPhase } from './calibration/CalibratingPhase';

interface CalibrationScreenProps {
  onComplete: (config: SquatDetectionConfig) => void;
  onClose: () => void;
}

type Phase = 'intro' | 'normal' | 'slow' | 'shallow' | 'complete';

const CalibrationScreen: React.FC<CalibrationScreenProps> = ({ onComplete, onClose }) => {
  const { t } = useTranslation();
  const {
    calibrationPhase,
    currentCount,
    targetCount,
    startCalibration,
    recordSquat,
    nextPhase,
    getCalibrationConfig,
    resetCalibration,
  } = useCalibration();

  const [phase, setPhase] = useState<Phase>('intro');
  const [detected, setDetected] = useState(false);

  // Animation values
  const pulseScale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const progressRotation = useSharedValue(0);

  // Map calibration phase to local phase
  useEffect(() => {
    if (calibrationPhase === 'normal') setPhase('normal');
    else if (calibrationPhase === 'slow') setPhase('slow');
    else if (calibrationPhase === 'shallow') setPhase('shallow');
    else if (calibrationPhase === 'complete') setPhase('complete');
  }, [calibrationPhase]);

  // Pulse animation
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'complete') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [phase]);

  // Progress ring animation
  useEffect(() => {
    const progress = targetCount > 0 ? currentCount / targetCount : 0;
    progressRotation.value = withSpring(progress * 360, {
      damping: 15,
      stiffness: 100,
    });
  }, [currentCount, targetCount]);

  // Show detection feedback
  const showDetectionFeedback = useCallback(() => {
    setDetected(true);
    ringScale.value = withSequence(withSpring(1.3, { damping: 5 }), withSpring(1, { damping: 10 }));
    setTimeout(() => setDetected(false), 500);
  }, []);

  // Handle squat detection
  const handleSquatDetected = useCallback(() => {
    recordSquat();
    showDetectionFeedback();

    // Check if phase is complete
    if (currentCount + 1 >= targetCount) {
      setTimeout(() => {
        if (calibrationPhase === 'shallow') {
          // Final phase complete
          const config = getCalibrationConfig();
          if (config) {
            onComplete(config);
          }
        } else {
          nextPhase();
        }
      }, 1000);
    }
  }, [
    currentCount,
    targetCount,
    calibrationPhase,
    recordSquat,
    nextPhase,
    getCalibrationConfig,
    onComplete,
  ]);

  // Start calibration
  const handleStart = async () => {
    try {
      await startCalibration();
    } catch (error) {
      Alert.alert(t('common.error'), t('calibration.sensorError'));
    }
  };

  // Handle close
  const handleClose = () => {
    resetCalibration();
    onClose();
  };

  const handleFinish = () => {
    const config = getCalibrationConfig();
    if (config) {
      onComplete(config);
    }
  };

  // Animated styles
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  // Get phase info
  const getPhaseInfo = () => {
    switch (phase) {
      case 'normal':
        return {
          title: t('calibration.phaseNormal'),
          description: t('calibration.phaseNormalDesc'),
          color: '#4CAF50',
        };
      case 'slow':
        return {
          title: t('calibration.phaseSlow'),
          description: t('calibration.phaseSlowDesc'),
          color: '#FF9800',
        };
      case 'shallow':
        return {
          title: t('calibration.phaseShallow'),
          description: t('calibration.phaseShallowDesc'),
          color: '#2196F3',
        };
      default:
        return {
          title: '',
          description: '',
          color: '#4CAF50',
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  if (phase === 'intro') {
    return <IntroPhase onStart={handleStart} onClose={handleClose} />;
  }

  if (phase === 'complete') {
    return <CompletePhase onFinish={handleFinish} />;
  }

  return (
    <CalibratingPhase
      phase={phase as 'normal' | 'slow' | 'shallow'}
      phaseInfo={phaseInfo}
      currentCount={currentCount}
      targetCount={targetCount}
      detected={detected}
      pulseStyle={pulseStyle}
      ringStyle={ringStyle}
      onClose={handleClose}
      onDetect={handleSquatDetected}
    />
  );
};

export default CalibrationScreen;
