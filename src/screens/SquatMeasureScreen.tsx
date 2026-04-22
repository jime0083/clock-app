import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Vibration,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
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
import { useAccelerometer } from '@/hooks/useAccelerometer';
import { audioService } from '@/services/audioService';
import { recordWakeUpHistoryOfflineAware } from '@/services/offlineService';
import { postPenaltyWithRetry } from '@/services/penaltyRetryService';
import { healthKitService } from '@/services/healthKitService';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants
const TARGET_SQUATS = 10;
const TIME_LIMIT_SECONDS = 5 * 60; // 5 minutes
const WARNING_THRESHOLD_SECONDS = 60; // Show warning at 1 minute left

interface SquatMeasureScreenProps {
  onComplete: (success: boolean, squatCount: number) => void;
  onClose?: () => void;
}

type ScreenState = 'measuring' | 'success' | 'failure';

const SquatMeasureScreen: React.FC<SquatMeasureScreenProps> = ({
  onComplete,
  onClose,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    squatCount,
    startListening,
    stopListening,
    resetSquatCount,
    isListening,
  } = useAccelerometer();

  const [screenState, setScreenState] = useState<ScreenState>('measuring');
  const [remainingSeconds, setRemainingSeconds] = useState(TIME_LIMIT_SECONDS);
  const [isWarning, setIsWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);
  const workoutStartTimeRef = useRef<Date>(new Date());

  // Animation values
  const countScale = useSharedValue(1);
  const ringProgress = useSharedValue(0);
  const warningPulse = useSharedValue(1);
  const successScale = useSharedValue(0);

  // Start accelerometer and timer on mount
  useEffect(() => {
    const initialize = async () => {
      // Play default alarm sound
      await audioService.playAlarmSound(null, true);

      // Start accelerometer
      try {
        await startListening();
      } catch (error) {
        console.error('Failed to start accelerometer:', error);
      }

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    initialize();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopListening();
      audioService.stopAlarmSound();
    };
  }, []);

  // Check for warning threshold
  useEffect(() => {
    if (remainingSeconds <= WARNING_THRESHOLD_SECONDS && !isWarning) {
      setIsWarning(true);
      // Start warning pulse animation
      warningPulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        true
      );
      // Vibrate to warn user
      Vibration.vibrate([0, 200, 100, 200]);
    }
  }, [remainingSeconds, isWarning]);

  // Check for success
  useEffect(() => {
    if (squatCount >= TARGET_SQUATS && !hasCompletedRef.current) {
      handleSuccess();
    }
  }, [squatCount]);

  // Animate squat count
  useEffect(() => {
    if (squatCount > 0) {
      countScale.value = withSequence(
        withSpring(1.3, { damping: 5 }),
        withSpring(1, { damping: 10 })
      );
      // Vibrate on each squat
      Vibration.vibrate(100);
    }
  }, [squatCount]);

  // Update ring progress
  useEffect(() => {
    const progress = Math.min(squatCount / TARGET_SQUATS, 1);
    ringProgress.value = withSpring(progress, { damping: 15 });
  }, [squatCount]);

  // Handle timeout (failure)
  const handleTimeout = useCallback(async () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopListening();
    await audioService.stopAlarmSound();

    // Record failure (offline-aware)
    if (user?.uid) {
      try {
        await recordWakeUpHistoryOfflineAware(user.uid, {
          success: false,
          squatCount,
        });
      } catch (error) {
        console.error('Failed to record history:', error);
      }
    }

    // Post penalty tweet with retry support (X連携は必須)
    try {
      const result = await postPenaltyWithRetry();
      if (!result.success) {
        console.error('Failed to post penalty tweet (will retry):', result.error);
      }
    } catch (error) {
      console.error('Error posting penalty tweet:', error);
    }

    setScreenState('failure');
    Vibration.vibrate([0, 500, 200, 500]);

    // Notify parent after delay
    setTimeout(() => {
      onComplete(false, squatCount);
    }, 3000);
  }, [squatCount, user?.uid, onComplete, stopListening]);

  // Handle success
  const handleSuccess = useCallback(async () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopListening();
    await audioService.stopAlarmSound();

    // Record success (offline-aware)
    if (user?.uid) {
      try {
        await recordWakeUpHistoryOfflineAware(user.uid, {
          success: true,
          squatCount: TARGET_SQUATS,
        });
      } catch (error) {
        console.error('Failed to record history:', error);
      }
    }

    // Save workout to HealthKit
    try {
      const workoutEndTime = new Date();
      const saved = await healthKitService.saveSquatWorkout(
        workoutStartTimeRef.current,
        workoutEndTime,
        TARGET_SQUATS
      );
      if (saved) {
        console.log('[SquatMeasure] Workout saved to HealthKit');
      }
    } catch (error) {
      // HealthKit save failure should not affect user experience
      console.error('Failed to save workout to HealthKit:', error);
    }

    setScreenState('success');
    successScale.value = withSpring(1, { damping: 10 });
    Vibration.vibrate([0, 100, 100, 100, 100, 100]);

    // Notify parent after delay
    setTimeout(() => {
      onComplete(true, TARGET_SQUATS);
    }, 3000);
  }, [user?.uid, onComplete, stopListening]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animated styles
  const countAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  const warningAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: warningPulse.value }],
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  // Get gradient colors based on state
  const getGradientColors = (): [string, string, string] => {
    if (screenState === 'success') {
      return ['#1B5E20', '#2E7D32', '#388E3C'];
    }
    if (screenState === 'failure' || isWarning) {
      return ['#B71C1C', '#C62828', '#D32F2F'];
    }
    return ['#1A1A2E', '#16213E', '#0F3460'];
  };

  // Render success screen
  if (screenState === 'success') {
    return (
      <LinearGradient colors={getGradientColors()} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.resultContent}
          >
            <Animated.View style={[styles.resultIconContainer, successAnimatedStyle]}>
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                style={styles.resultIconGradient}
              >
                <Ionicons name="checkmark" size={80} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.duration(500).delay(200)}
              style={styles.resultTitle}
            >
              {t('wakeup.successTitle')}
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.duration(500).delay(400)}
              style={styles.resultMessage}
            >
              {t('wakeup.successMessage')}
            </Animated.Text>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Render failure screen
  if (screenState === 'failure') {
    return (
      <LinearGradient colors={getGradientColors()} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.resultContent}
          >
            <Animated.View style={styles.resultIconContainer}>
              <LinearGradient
                colors={['#F44336', '#EF5350']}
                style={styles.resultIconGradient}
              >
                <Ionicons name="close" size={80} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.duration(500).delay(200)}
              style={styles.resultTitle}
            >
              {t('wakeup.failureTitle')}
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.duration(500).delay(400)}
              style={styles.resultSubtitle}
            >
              {t('squat.count', { count: squatCount })} / {TARGET_SQUATS}
            </Animated.Text>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Render measuring screen
  return (
    <LinearGradient colors={getGradientColors()} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Timer */}
        <Animated.View
          style={[styles.timerContainer, isWarning && warningAnimatedStyle]}
        >
          <Text style={[styles.timerLabel, isWarning && styles.timerLabelWarning]}>
            {t('wakeup.timeRemaining')}
          </Text>
          <Text style={[styles.timerText, isWarning && styles.timerTextWarning]}>
            {formatTime(remainingSeconds)}
          </Text>
        </Animated.View>

        {/* Squat Count */}
        <View style={styles.countContainer}>
          <View style={styles.countRing}>
            <LinearGradient
              colors={isWarning ? ['#FF5252', '#FF1744'] : ['#FF6B35', '#F7931E']}
              style={styles.countRingGradient}
            >
              <View style={styles.countInner}>
                <Animated.View style={countAnimatedStyle}>
                  <Text style={styles.countText}>{squatCount}</Text>
                </Animated.View>
                <Text style={styles.countTarget}>/ {TARGET_SQUATS}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: TARGET_SQUATS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < squatCount && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Phone position guide */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(300)}
          style={styles.guideContainer}
        >
          <View style={styles.guideIconContainer}>
            <Ionicons name="phone-portrait-outline" size={32} color="#FFFFFF80" />
          </View>
          <Text style={styles.guideText}>{t('squat.description')}</Text>
        </Animated.View>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              isListening && styles.statusDotActive,
            ]}
          />
          <Text style={styles.statusText}>
            {isListening ? t('calibration.detecting') : t('common.loading')}
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
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  // Timer styles
  timerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerLabel: {
    fontSize: 14,
    color: '#FFFFFF80',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerLabelWarning: {
    color: '#FFCDD2',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  timerTextWarning: {
    color: '#FFCDD2',
  },
  // Count styles
  countContainer: {
    alignItems: 'center',
  },
  countRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    marginBottom: 24,
  },
  countRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
    padding: 10,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  countInner: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 80,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -4,
  },
  countTarget: {
    fontSize: 24,
    color: '#FFFFFF60',
    marginTop: -8,
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
  progressDotActive: {
    backgroundColor: '#4CAF50',
  },
  // Guide styles
  guideContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  guideIconContainer: {
    marginBottom: 12,
  },
  guideText: {
    fontSize: 14,
    color: '#FFFFFF80',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Status styles
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF10',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666666',
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF80',
  },
  // Result styles
  resultContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  resultIconContainer: {
    marginBottom: 32,
  },
  resultIconGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 18,
    color: '#FFFFFFCC',
    textAlign: 'center',
    lineHeight: 28,
  },
  resultSubtitle: {
    fontSize: 24,
    color: '#FFFFFF99',
    textAlign: 'center',
  },
});

export default SquatMeasureScreen;
