import React, { useState, useEffect, useRef } from 'react';
import { Platform, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { useTranslation } from 'react-i18next';

import { TERMS_URL, PRIVACY_URL } from '@/constants/urls';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { updateUserSettings, getUserDocument } from '@/services/userService';
import { useXAuth } from '@/hooks/useXAuth';
import { accelerometerService, AccelerometerData } from '@/services/accelerometerService';
import { alarmService } from '@/services/alarmService';
import { styles, REQUIRED_SQUATS } from './setup/styles';
import { TimeStep } from './setup/TimeStep';
import { DaysStep } from './setup/DaysStep';
import { XConnectStep } from './setup/XConnectStep';
import { CalibrationStep } from './setup/CalibrationStep';
import { SubscriptionStep } from './setup/SubscriptionStep';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupStep = 'alarm_time' | 'alarm_days' | 'x_connect' | 'calibration' | 'subscription';
type CalibrationPhase = 'ready' | 'measuring' | 'complete';

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connectX, isConnecting } = useXAuth();
  const {
    isSubscribed,
    offerings,
    purchase,
    restore,
    isLoading: isSubscriptionLoading,
  } = useSubscription();

  const [currentStep, setCurrentStep] = useState<SetupStep>('alarm_time');
  const [isXConnected, setIsXConnected] = useState(false);

  // Alarm settings
  const [alarmTime, setAlarmTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Calibration state
  const [calibrationPhase, setCalibrationPhase] = useState<CalibrationPhase>('ready');
  const [squatCount, setSquatCount] = useState(0);
  const calibrationDataRef = useRef<AccelerometerData[]>([]);

  // Subscription state
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const hasAutoCompletedRef = useRef(false);

  // Check X connection status on mount (Firestore is the source of truth)
  useEffect(() => {
    const checkXConnection = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getUserDocument(user.uid);
        setIsXConnected(userDoc?.snsConnections?.x?.connected ?? false);
      } catch (error) {
        console.error('Error checking X connection:', error);
      }
    };
    checkXConnection();
  }, [user?.uid]);

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
    setSelectedDays(prev =>
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleDaysConfirm = async () => {
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
        Alert.alert(t('calibration.sensorError'), '', [
          { text: t('common.ok'), onPress: () => setCurrentStep('subscription') },
        ]);
        return;
      }

      setCalibrationPhase('measuring');
      setSquatCount(0);
      calibrationDataRef.current = [];

      accelerometerService.startCalibration();
      accelerometerService.onSquatDetected(() => {
        setSquatCount(prev => {
          const newCount = prev + 1;
          if (newCount >= REQUIRED_SQUATS) {
            handleCalibrationComplete();
          }
          return newCount;
        });
      });

      await accelerometerService.startListening(data => {
        calibrationDataRef.current.push(data);
      });
    } catch (error) {
      console.error('Error starting calibration:', error);
      Alert.alert(t('common.error'), '', [
        { text: t('common.ok'), onPress: () => setCurrentStep('subscription') },
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
      const targetPackageType =
        selectedPlan === 'monthly' ? PACKAGE_TYPE.MONTHLY : PACKAGE_TYPE.ANNUAL;
      const pkg = offerings.availablePackages.find(p => p.packageType === targetPackageType);

      if (!pkg) {
        // If package type not found, try to find by identifier
        const fallbackIdentifier = selectedPlan === 'monthly' ? '$rc_monthly' : '$rc_annual';
        const fallbackPkg = offerings.availablePackages.find(
          p => p.identifier === fallbackIdentifier
        );

        if (!fallbackPkg) {
          Alert.alert(t('common.error'), t('paywall.errorMessage'));
          setIsPurchasing(false);
          return;
        }

        const success = await purchase(fallbackPkg);
        if (success) {
          Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'), [
            { text: t('common.ok'), onPress: handleCompleteSetup },
          ]);
        } else {
          Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
        }
        return;
      }

      const success = await purchase(pkg);
      if (success) {
        Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'), [
          { text: t('common.ok'), onPress: handleCompleteSetup },
        ]);
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
        // Server-side alarm checks need the user's timezone (Problem 26)
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      onComplete();
    } catch (error) {
      console.error('Error completing setup:', error);
    }
  };

  // Admins (adminUsers collection) and already-subscribed users skip the
  // purchase step automatically (Problem 23)
  useEffect(() => {
    if (
      currentStep === 'subscription' &&
      !isSubscriptionLoading &&
      isSubscribed &&
      !hasAutoCompletedRef.current
    ) {
      hasAutoCompletedRef.current = true;
      handleCompleteSetup();
    }
  }, [currentStep, isSubscribed, isSubscriptionLoading]);

  const handleRestore = async () => {
    if (isRestoring || isPurchasing) return;

    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert(t('paywall.restoreSuccessTitle'), t('paywall.restoreSuccessMessage'), [
          { text: t('common.ok'), onPress: handleCompleteSetup },
        ]);
      } else {
        Alert.alert(t('paywall.restoreFailTitle'), t('paywall.restoreFailMessage'));
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(t('paywall.restoreFailTitle'), t('paywall.restoreFailMessage'));
    } finally {
      setIsRestoring(false);
    }
  };

  const openTermsOfService = () => {
    Linking.openURL(TERMS_URL);
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_URL);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'alarm_time':
        return (
          <TimeStep
            formattedTime={formatTime(alarmTime)}
            alarmTime={alarmTime}
            showTimePicker={showTimePicker}
            onShowTimePicker={() => setShowTimePicker(true)}
            onTimeChange={handleTimeChange}
            onConfirm={handleTimeConfirm}
          />
        );
      case 'alarm_days':
        return (
          <DaysStep
            selectedDays={selectedDays}
            onToggleDay={toggleDay}
            onConfirm={handleDaysConfirm}
          />
        );
      case 'x_connect':
        return (
          <XConnectStep
            isXConnected={isXConnected}
            isConnecting={isConnecting}
            onConnect={handleConnectX}
            onNext={() => setCurrentStep('calibration')}
          />
        );
      case 'calibration':
        return (
          <CalibrationStep
            calibrationPhase={calibrationPhase}
            squatCount={squatCount}
            onStart={handleStartCalibration}
          />
        );
      case 'subscription':
        return (
          <SubscriptionStep
            selectedPlan={selectedPlan}
            isPurchasing={isPurchasing}
            isRestoring={isRestoring}
            onSelectPlan={handleSelectPlan}
            onPurchase={handlePurchase}
            onRestore={handleRestore}
            onOpenTerms={openTermsOfService}
            onOpenPrivacy={openPrivacyPolicy}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SetupScreen;
