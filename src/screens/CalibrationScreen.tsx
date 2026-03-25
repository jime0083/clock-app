import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useCalibration } from '@/hooks/useAccelerometer';
import { SquatDetectionConfig } from '@/services/accelerometerService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CalibrationScreenProps {
  onComplete: (config: SquatDetectionConfig) => void;
  onClose: () => void;
}

type Phase = 'intro' | 'normal' | 'slow' | 'shallow' | 'complete';

const CalibrationScreen: React.FC<CalibrationScreenProps> = ({
  onComplete,
  onClose,
}) => {
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
    ringScale.value = withSequence(
      withSpring(1.3, { damping: 5 }),
      withSpring(1, { damping: 10 })
    );
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
  }, [currentCount, targetCount, calibrationPhase, recordSquat, nextPhase, getCalibrationConfig, onComplete]);

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

  // Render intro phase
  if (phase === 'intro') {
    return (
      <LinearGradient
        colors={['#1A1A2E', '#16213E', '#0F3460']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#FFFFFF80" />
          </TouchableOpacity>

          <Animated.View
            entering={FadeInDown.duration(600).delay(100)}
            style={styles.introContent}
          >
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.iconGradient}
              >
                <Ionicons name="fitness" size={60} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.introTitle}>{t('calibration.title')}</Text>
            <Text style={styles.introSubtitle}>{t('calibration.subtitle')}</Text>

            <View style={styles.instructionCard}>
              <Ionicons name="phone-portrait-outline" size={40} color="#4CAF50" />
              <Text style={styles.instructionText}>
                {t('calibration.instruction')}
              </Text>
            </View>

            <Animated.View
              entering={FadeInUp.duration(600).delay(400)}
              style={styles.startButtonContainer}
            >
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStart}
                activeOpacity={0.9}
              >
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
  }

  // Render complete phase
  if (phase === 'complete') {
    return (
      <LinearGradient
        colors={['#1A1A2E', '#16213E', '#0F3460']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.completeContent}
          >
            <View style={styles.completeIconContainer}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.completeIconGradient}
              >
                <Ionicons name="checkmark" size={80} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.completeTitle}>{t('calibration.complete')}</Text>
            <Text style={styles.completeSubtitle}>
              {t('calibration.completeDesc')}
            </Text>

            <TouchableOpacity
              style={styles.finishButton}
              onPress={() => {
                const config = getCalibrationConfig();
                if (config) {
                  onComplete(config);
                }
              }}
              activeOpacity={0.9}
            >
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
  }

  // Render calibration phase
  return (
    <LinearGradient
      colors={['#1A1A2E', '#16213E', '#0F3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="#FFFFFF80" />
        </TouchableOpacity>

        {/* Phase indicator */}
        <View style={styles.phaseIndicator}>
          <View
            style={[
              styles.phaseDot,
              phase === 'normal' && styles.phaseDotActive,
              (phase === 'slow' || phase === 'shallow') && styles.phaseDotDone,
            ]}
          />
          <View style={styles.phaseLine} />
          <View
            style={[
              styles.phaseDot,
              phase === 'slow' && styles.phaseDotActive,
              phase === 'shallow' && styles.phaseDotDone,
            ]}
          />
          <View style={styles.phaseLine} />
          <View
            style={[
              styles.phaseDot,
              phase === 'shallow' && styles.phaseDotActive,
            ]}
          />
        </View>

        {/* Phase title */}
        <Animated.View
          key={phase}
          entering={FadeInDown.duration(400)}
          style={styles.phaseHeader}
        >
          <Text style={[styles.phaseTitle, { color: phaseInfo.color }]}>
            {phaseInfo.title}
          </Text>
          <Text style={styles.phaseDescription}>{phaseInfo.description}</Text>
        </Animated.View>

        {/* Count display */}
        <View style={styles.countContainer}>
          <Animated.View style={[styles.countRing, ringStyle]}>
            <LinearGradient
              colors={[phaseInfo.color, `${phaseInfo.color}80`]}
              style={styles.countRingGradient}
            >
              <View style={styles.countInner}>
                <Animated.View style={pulseStyle}>
                  <Text style={styles.countText}>
                    {currentCount}/{targetCount}
                  </Text>
                </Animated.View>
                <Text style={styles.countLabel}>
                  {detected ? t('calibration.detected') : t('calibration.detecting')}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: targetCount }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < currentCount && { backgroundColor: phaseInfo.color },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Detection button (for manual testing/demo) */}
        <TouchableOpacity
          style={styles.detectButton}
          onPress={handleSquatDetected}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[phaseInfo.color, `${phaseInfo.color}CC`]}
            style={styles.detectButtonGradient}
          >
            <Ionicons name="fitness" size={32} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Instruction */}
        <View style={styles.bottomInstruction}>
          <Ionicons name="information-circle-outline" size={20} color="#FFFFFF80" />
          <Text style={styles.bottomInstructionText}>
            {t('calibration.holdPosition')}
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  // Intro styles
  introContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 16,
    color: '#FFFFFF99',
    marginBottom: 40,
    textAlign: 'center',
  },
  instructionCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFFCC',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  startButtonContainer: {
    width: '100%',
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Phase indicator
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  phaseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF30',
  },
  phaseDotActive: {
    backgroundColor: '#4CAF50',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  phaseDotDone: {
    backgroundColor: '#4CAF50',
  },
  phaseLine: {
    width: 40,
    height: 2,
    backgroundColor: '#FFFFFF30',
    marginHorizontal: 8,
  },
  // Phase header
  phaseHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  phaseTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  phaseDescription: {
    fontSize: 16,
    color: '#FFFFFF99',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Count display
  countContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  countRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 24,
  },
  countRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    padding: 8,
  },
  countInner: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 92,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  countLabel: {
    fontSize: 14,
    color: '#FFFFFF80',
    marginTop: 4,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF20',
  },
  // Detect button
  detectButton: {
    marginTop: 20,
    marginBottom: 40,
  },
  detectButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bottom instruction
  bottomInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 40,
  },
  bottomInstructionText: {
    fontSize: 14,
    color: '#FFFFFF80',
  },
  // Complete styles
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  completeIconContainer: {
    marginBottom: 32,
  },
  completeIconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#FFFFFF99',
    marginBottom: 48,
    textAlign: 'center',
  },
  finishButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  finishButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CalibrationScreen;
