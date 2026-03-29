import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { PACKAGE_TYPE } from 'react-native-purchases';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { updateUserSettings } from '@/services/userService';
import { useXAuth } from '@/hooks/useXAuth';
import { hasXTokens } from '@/services/secureTokenService';
import { uploadAlarmSound } from '@/services/storageService';
import { accelerometerService, AccelerometerData } from '@/services/accelerometerService';
import { alarmService } from '@/services/alarmService';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupStep = 'alarm_time' | 'alarm_days' | 'alarm_sound' | 'x_connect' | 'calibration' | 'subscription';
type CalibrationPhase = 'ready' | 'measuring' | 'complete';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ANIMATION_SIZE = SCREEN_WIDTH * 0.55;
const ANIMATION_SIZE_SMALL = SCREEN_WIDTH * 0.4;

const REQUIRED_SQUATS = 10;

const DAYS_OF_WEEK = [
  { key: 0, labelKey: 'alarm.days.sun' },
  { key: 1, labelKey: 'alarm.days.mon' },
  { key: 2, labelKey: 'alarm.days.tue' },
  { key: 3, labelKey: 'alarm.days.wed' },
  { key: 4, labelKey: 'alarm.days.thu' },
  { key: 5, labelKey: 'alarm.days.fri' },
  { key: 6, labelKey: 'alarm.days.sat' },
];

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connectX, isConnecting } = useXAuth();
  const { isSubscribed, offerings, purchase, isLoading: isSubscriptionLoading } = useSubscription();

  const [currentStep, setCurrentStep] = useState<SetupStep>('alarm_time');
  const [isXConnected, setIsXConnected] = useState(false);

  // Alarm settings
  const [alarmTime, setAlarmTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedSoundName, setSelectedSoundName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Calibration state
  const [calibrationPhase, setCalibrationPhase] = useState<CalibrationPhase>('ready');
  const [squatCount, setSquatCount] = useState(0);
  const calibrationDataRef = useRef<AccelerometerData[]>([]);

  // Subscription state
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Check X connection status on mount
  useEffect(() => {
    const checkXConnection = async () => {
      const hasTokens = await hasXTokens();
      setIsXConnected(hasTokens);
    };
    checkXConnection();
  }, []);

  // Cleanup accelerometer on unmount
  useEffect(() => {
    return () => {
      accelerometerService.stopListening();
    };
  }, []);

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleTimeChange = (_: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setAlarmTime(selectedDate);
    }
  };

  const handleTimeConfirm = () => {
    setShowTimePicker(false);
    setCurrentStep('alarm_days');
  };

  const toggleDay = (dayKey: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey)
        ? prev.filter((d) => d !== dayKey)
        : [...prev, dayKey]
    );
  };

  const handleDaysConfirm = () => {
    setCurrentStep('alarm_sound');
  };

  const handleSoundUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setIsUploading(true);

        if (user?.uid) {
          await uploadAlarmSound(user.uid, file.uri, file.name);
          setSelectedSoundName(file.name);
        }
      }
    } catch (error) {
      console.error('Error uploading sound:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAlarmSettings = async () => {
    if (!user?.uid) return;

    try {
      const timeString = formatTime(alarmTime);

      // Save to Firestore
      await updateUserSettings(user.uid, {
        alarmTime: timeString,
        alarmDays: selectedDays,
      });

      // Schedule the alarm notification
      await alarmService.initialize(user.uid);
      await alarmService.scheduleAlarm({
        alarmTime: timeString,
        alarmDays: selectedDays,
        customAlarmSound: null,
      });

      setCurrentStep('x_connect');
    } catch (error) {
      console.error('Error saving alarm settings:', error);
    }
  };

  const handleConnectX = async () => {
    const success = await connectX();
    if (success) {
      setIsXConnected(true);
      setTimeout(() => {
        setCurrentStep('calibration');
      }, 500);
    }
  };

  // Calibration functions
  const handleStartCalibration = async () => {
    try {
      const available = await accelerometerService.isAvailable();
      if (!available) {
        Alert.alert(
          t('calibration.sensorError'),
          '',
          [{ text: t('common.ok'), onPress: () => setCurrentStep('subscription') }]
        );
        return;
      }

      setCalibrationPhase('measuring');
      setSquatCount(0);
      calibrationDataRef.current = [];

      accelerometerService.startCalibration();
      accelerometerService.onSquatDetected(() => {
        setSquatCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= REQUIRED_SQUATS) {
            handleCalibrationComplete();
          }
          return newCount;
        });
      });

      await accelerometerService.startListening((data) => {
        calibrationDataRef.current.push(data);
      });
    } catch (error) {
      console.error('Error starting calibration:', error);
      Alert.alert(t('common.error'), '', [
        { text: t('common.ok'), onPress: () => setCurrentStep('subscription') }
      ]);
    }
  };

  const handleCalibrationComplete = async () => {
    accelerometerService.stopListening();
    const calibrationData = accelerometerService.stopCalibration();

    setCalibrationPhase('complete');

    // Analyze calibration data
    const config = accelerometerService.analyzeCalibrationData(
      calibrationData,
      calibrationData,
      calibrationData
    );

    // Save calibration data to Firestore
    if (user?.uid) {
      try {
        await updateUserSettings(user.uid, {
          calibration: {
            peakThreshold: config.peakThreshold,
            minSquatDuration: config.minSquatDuration,
            maxSquatDuration: config.maxSquatDuration,
            calibratedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error saving calibration:', error);
      }
    }

    // Move to subscription after a short delay
    setTimeout(() => {
      setCurrentStep('subscription');
    }, 1500);
  };

  // Subscription functions
  const handleSelectPlan = (plan: 'monthly' | 'annual') => {
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !offerings?.availablePackages) {
      Alert.alert(t('common.error'), t('paywall.errorMessage'));
      return;
    }

    setIsPurchasing(true);

    try {
      const targetPackageType = selectedPlan === 'monthly' ? PACKAGE_TYPE.MONTHLY : PACKAGE_TYPE.ANNUAL;
      const pkg = offerings.availablePackages.find(
        (p) => p.packageType === targetPackageType
      );

      if (!pkg) {
        // If package type not found, try to find by identifier
        const fallbackIdentifier = selectedPlan === 'monthly' ? '$rc_monthly' : '$rc_annual';
        const fallbackPkg = offerings.availablePackages.find(
          (p) => p.identifier === fallbackIdentifier
        );

        if (!fallbackPkg) {
          Alert.alert(t('common.error'), t('paywall.errorMessage'));
          setIsPurchasing(false);
          return;
        }

        const success = await purchase(fallbackPkg);
        if (success) {
          Alert.alert(
            t('paywall.successTitle'),
            t('paywall.successMessage'),
            [{ text: t('common.ok'), onPress: handleCompleteSetup }]
          );
        } else {
          Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
        }
        return;
      }

      const success = await purchase(pkg);
      if (success) {
        Alert.alert(
          t('paywall.successTitle'),
          t('paywall.successMessage'),
          [{ text: t('common.ok'), onPress: handleCompleteSetup }]
        );
      } else {
        Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!user?.uid) return;

    try {
      await updateUserSettings(user.uid, {
        setupCompleted: true,
      });
      onComplete();
    } catch (error) {
      console.error('Error completing setup:', error);
    }
  };

  const openTermsOfService = () => {
    Linking.openURL('https://okiroya.com/terms');
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://okiroya.com/privacy');
  };

  // Step 1: Time Selection
  const renderTimeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainerSmall}>
        <LottieView
          source={require('@assets/animations/Morning and night in the city.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <Text style={styles.title}>{t('setup.setWakeUpTime')}</Text>

      <TouchableOpacity
        style={styles.inputField}
        onPress={() => setShowTimePicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.inputText}>{formatTime(alarmTime)}</Text>
      </TouchableOpacity>

      {showTimePicker && (
        <View style={styles.timePickerContainerCompact}>
          <DateTimePicker
            value={alarmTime}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            style={Platform.OS === 'ios' ? styles.timePickerIOS : undefined}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleTimeConfirm}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 2: Day Selection
  const renderDaysStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/Morning and night in the city.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <Text style={styles.title}>{t('alarm.selectDays')}</Text>

      <View style={styles.daysContainer}>
        {DAYS_OF_WEEK.map((day) => (
          <TouchableOpacity
            key={day.key}
            style={[
              styles.dayButton,
              selectedDays.includes(day.key) && styles.dayButtonSelected,
            ]}
            onPress={() => toggleDay(day.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dayButtonText,
                selectedDays.includes(day.key) && styles.dayButtonTextSelected,
              ]}
            >
              {t(day.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, selectedDays.length === 0 && styles.buttonDisabled]}
        onPress={handleDaysConfirm}
        activeOpacity={0.8}
        disabled={selectedDays.length === 0}
      >
        <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 3: Sound Upload
  const renderSoundStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/Morning and night in the city.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <Text style={styles.title}>{t('alarm.soundSettings')}</Text>

      <TouchableOpacity
        style={styles.inputField}
        onPress={handleSoundUpload}
        activeOpacity={0.7}
        disabled={isUploading}
      >
        <Text style={[styles.inputText, !selectedSoundName && styles.placeholderText]}>
          {isUploading
            ? t('common.uploading')
            : selectedSoundName || t('setup.uploadSound')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSaveAlarmSettings}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{t('setup.saveSettings')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 4: X Connection
  const renderXConnectStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/contact us.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('sns.title')}</Text>
        <Text style={styles.title}>{t('sns.subtitle')}</Text>
      </View>
      <Text style={styles.description}>{t('sns.description')}</Text>

      {isXConnected ? (
        <View style={styles.connectedContainer}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
          <Text style={styles.connectedText}>{t('sns.connected')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setCurrentStep('calibration')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConnectX}
          activeOpacity={0.8}
          disabled={isConnecting}
        >
          <Text style={styles.primaryButtonText}>
            {isConnecting ? t('sns.connecting') : t('sns.connectX')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Step 5: Calibration
  const renderCalibrationStep = () => {
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
            <Text style={styles.title}>{t('calibration.progress', { current: squatCount, total: REQUIRED_SQUATS })}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${(squatCount / REQUIRED_SQUATS) * 100}%` }]} />
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
          <Text style={styles.title}>{t('calibration.phaseNormalDesc').replace('5', String(REQUIRED_SQUATS))}</Text>
        </View>
        <Text style={styles.description}>{t('squat.description')}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartCalibration}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{t('calibration.start')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Step 6: Subscription
  const renderSubscriptionStep = () => (
    <View style={styles.subscriptionContainer}>
      <View style={styles.subscriptionHeader}>
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>{t('pay.tagline1')}</Text>
          <Text style={styles.tagline}>{t('pay.tagline2')}</Text>
          <Text style={styles.tagline}>{t('pay.tagline3')}</Text>
        </View>
        <View style={styles.metaAnimationContainer}>
          <LottieView
            source={require('@assets/animations/Meta animation.json')}
            autoPlay
            loop
            style={styles.metaAnimation}
          />
        </View>
      </View>

      <Text style={styles.planLabel}>{t('pay.plan')}</Text>

      {/* Annual Plan Card */}
      <TouchableOpacity
        style={[
          styles.planCard,
          selectedPlan === 'annual' && styles.planCardSelected,
        ]}
        onPress={() => handleSelectPlan('annual')}
        activeOpacity={0.8}
      >
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>{t('pay.discount')}</Text>
        </View>
        <View style={styles.planCardContent}>
          <Text style={styles.planDuration}>{t('pay.yearly')}</Text>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planOriginalPrice}>{t('pay.yearlyOriginal')}</Text>
            <Text style={styles.planPrice}>{t('pay.yearlyPrice')}</Text>
            <Text style={styles.planPerMonth}>{t('pay.yearlyPerMonth')}</Text>
          </View>
        </View>
        {selectedPlan === 'annual' && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Monthly Plan Card */}
      <TouchableOpacity
        style={[
          styles.planCard,
          selectedPlan === 'monthly' && styles.planCardSelected,
        ]}
        onPress={() => handleSelectPlan('monthly')}
        activeOpacity={0.8}
      >
        <View style={styles.planCardContent}>
          <Text style={styles.planDuration}>{t('pay.monthly')}</Text>
          <Text style={styles.planPriceMonthly}>{t('pay.monthlyPrice')}</Text>
        </View>
        {selectedPlan === 'monthly' && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Purchase Button */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          (!selectedPlan || isPurchasing) && styles.buttonDisabled,
        ]}
        onPress={handlePurchase}
        activeOpacity={0.8}
        disabled={!selectedPlan || isPurchasing}
      >
        {isPurchasing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('paywall.subscribe')}</Text>
        )}
      </TouchableOpacity>

      {/* Footer Links */}
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={openTermsOfService}>
          <Text style={styles.footerLink}>{t('pay.termsOfService')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openPrivacyPolicy}>
          <Text style={styles.footerLink}>{t('pay.privacyPolicy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'alarm_time':
        return renderTimeStep();
      case 'alarm_days':
        return renderDaysStep();
      case 'alarm_sound':
        return renderSoundStep();
      case 'x_connect':
        return renderXConnectStep();
      case 'calibration':
        return renderCalibrationStep();
      case 'subscription':
        return renderSubscriptionStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  stepContainer: {
    alignItems: 'center',
  },
  animationContainer: {
    width: ANIMATION_SIZE,
    height: ANIMATION_SIZE,
    marginBottom: 32,
  },
  animationContainerSmall: {
    width: ANIMATION_SIZE_SMALL,
    height: ANIMATION_SIZE_SMALL,
    marginBottom: 16,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  inputField: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    marginBottom: 16,
  },
  timePickerContainer: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timePickerContainerCompact: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    maxHeight: 180,
  },
  timePickerIOS: {
    height: 160,
  },
  inputText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  placeholderText: {
    color: Colors.textTertiary,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectedContainer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  connectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 16,
  },
  // Day selection styles
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  // Progress styles
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  // Subscription styles
  subscriptionContainer: {
    flex: 1,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  taglineContainer: {
    flex: 1,
    paddingRight: 16,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  metaAnimationContainer: {
    width: 80,
    height: 80,
  },
  metaAnimation: {
    width: '100%',
    height: '100%',
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  planCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#FFA500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDuration: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planOriginalPrice: {
    fontSize: 12,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planPerMonth: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  planPriceMonthly: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  checkmark: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 'auto',
    paddingTop: 20,
  },
  footerLink: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});

export default SetupScreen;
