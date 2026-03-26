import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { AlarmSettingModal } from '@/components/modals/AlarmSettingModal';
import { updateUserSettings } from '@/services/userService';
import { useXAuth } from '@/hooks/useXAuth';
import { hasXTokens } from '@/services/secureTokenService';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupStep = 1 | 2 | 3;

const TOTAL_STEPS = 3;

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connectX, isConnecting } = useXAuth();
  const [isXConnected, setIsXConnected] = useState(false);

  // Check X connection status on mount
  useEffect(() => {
    const checkXConnection = async () => {
      const hasTokens = await hasXTokens();
      setIsXConnected(hasTokens);
    };
    checkXConnection();
  }, []);

  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [isAlarmModalVisible, setIsAlarmModalVisible] = useState(false);
  const [alarmTime, setAlarmTime] = useState<string | null>(null);
  const [alarmDays, setAlarmDays] = useState<number[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleSaveAlarm = async (time: string, days: number[]) => {
    setAlarmTime(time);
    setAlarmDays(days);
    setIsAlarmModalVisible(false);

    // Save to Firestore
    if (user?.uid) {
      try {
        await updateUserSettings(user.uid, {
          alarmTime: time,
          alarmDays: days,
        });
      } catch (error) {
        console.error('Error saving alarm settings:', error);
      }
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!alarmTime) {
        setIsAlarmModalVisible(true);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isXConnected) {
        Alert.alert(t('setup.connectRequired'), t('sns.description'));
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      await handleComplete();
    }
  };

  const handleConnectX = async () => {
    const success = await connectX();
    if (success) {
      setIsXConnected(true);
      // Auto-advance to next step after successful connection
      setTimeout(() => {
        setCurrentStep(3);
      }, 500);
    }
  };

  const handleComplete = async () => {
    if (!user?.uid) return;

    setIsCompleting(true);
    try {
      await updateUserSettings(user.uid, {
        setupCompleted: true,
      });
      onComplete();
    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setIsCompleting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Animated.View
            key="step1"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContent}
          >
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#FF6B35', '#F7931E']}
                style={styles.iconGradient}
              >
                <Ionicons name="alarm" size={48} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.stepTitle}>{t('setup.step1Title')}</Text>
            <Text style={styles.stepDescription}>{t('setup.step1Description')}</Text>

            {alarmTime ? (
              <View style={styles.alarmPreview}>
                <Text style={styles.alarmTime}>{alarmTime}</Text>
                <Text style={styles.alarmDays}>
                  {alarmDays.length === 7
                    ? t('alarm.days.mon') + '〜' + t('alarm.days.sun')
                    : alarmDays
                        .map((d) => t(`alarm.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d]}`))
                        .join(', ')}
                </Text>
                <Pressable
                  style={styles.changeButton}
                  onPress={() => setIsAlarmModalVisible(true)}
                >
                  <Text style={styles.changeButtonText}>{t('alarm.changeAlarm')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.setupButton}
                onPress={() => setIsAlarmModalVisible(true)}
              >
                <Ionicons name="add-circle" size={24} color={Colors.primary} />
                <Text style={styles.setupButtonText}>{t('alarm.title')}</Text>
              </Pressable>
            )}
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View
            key="step2"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContent}
          >
            <View style={styles.iconContainer}>
              <View style={styles.xIconGradient}>
                <Text style={styles.xLogo}>𝕏</Text>
              </View>
            </View>

            <Text style={styles.stepTitle}>{t('setup.step2Title')}</Text>
            <Text style={styles.stepDescription}>{t('setup.step2Description')}</Text>

            {isXConnected ? (
              <View style={styles.connectedContainer}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={styles.connectedText}>{t('sns.connected')}</Text>
              </View>
            ) : (
              <Pressable
                style={styles.connectButton}
                onPress={handleConnectX}
                disabled={isConnecting}
              >
                <Text style={styles.xLogoButton}>𝕏</Text>
                <Text style={styles.connectButtonText}>
                  {isConnecting ? t('sns.connecting') : t('sns.connectX')}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View
            key="step3"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContent}
          >
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                style={styles.iconGradient}
              >
                <Ionicons name="checkmark" size={56} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.stepTitle}>{t('setup.step3Title')}</Text>
            <Text style={styles.stepDescription}>{t('setup.step3Description')}</Text>

            <View style={styles.summaryContainer}>
              <View style={styles.summaryItem}>
                <Ionicons name="alarm" size={24} color={Colors.primary} />
                <Text style={styles.summaryText}>{alarmTime}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryXLogo}>𝕏</Text>
                <Text style={styles.summaryText}>{t('sns.connected')}</Text>
              </View>
            </View>
          </Animated.View>
        );
    }
  };

  const getNextButtonText = () => {
    if (currentStep === 3) {
      return t('setup.start');
    }
    return t('setup.next');
  };

  const isNextDisabled = () => {
    if (currentStep === 1 && !alarmTime) return true;
    if (currentStep === 2 && !isXConnected) return true;
    if (isCompleting) return true;
    return false;
  };

  return (
    <LinearGradient
      colors={['#1A1A2E', '#16213E', '#0F3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Text style={styles.welcome}>{t('setup.welcome')}</Text>
          <Text style={styles.stepIndicator}>
            {t('setup.step', { current: currentStep, total: TOTAL_STEPS })}
          </Text>
        </Animated.View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                step <= currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Step Content */}
        <View style={styles.contentContainer}>
          {renderStepContent()}
        </View>

        {/* Next Button */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.footer}>
          <Pressable
            style={[
              styles.nextButton,
              isNextDisabled() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={isNextDisabled()}
          >
            <Text style={styles.nextButtonText}>{getNextButtonText()}</Text>
            <Ionicons
              name={currentStep === 3 ? 'rocket' : 'arrow-forward'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Alarm Setting Modal */}
      <AlarmSettingModal
        visible={isAlarmModalVisible}
        onClose={() => setIsAlarmModalVisible(false)}
        onSave={handleSaveAlarm}
        initialTime={alarmTime}
        initialDays={alarmDays}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#FFFFFF80',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF20',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  xIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  xLogo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000000',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#FFFFFF99',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF15',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
    borderStyle: 'dashed',
    gap: 12,
  },
  setupButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  alarmPreview: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF10',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  alarmTime: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  alarmDays: {
    fontSize: 14,
    color: '#FFFFFF80',
    marginTop: 8,
    marginBottom: 16,
  },
  changeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  xLogoButton: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectedContainer: {
    alignItems: 'center',
    gap: 12,
  },
  connectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 24,
    gap: 16,
    width: '100%',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryXLogo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonDisabled: {
    backgroundColor: '#666666',
    shadowOpacity: 0,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SetupScreen;
