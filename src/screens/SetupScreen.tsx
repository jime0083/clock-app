import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserSettings } from '@/services/userService';
import { useXAuth } from '@/hooks/useXAuth';
import { hasXTokens } from '@/services/secureTokenService';
import { uploadAlarmSound } from '@/services/storageService';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupStep = 'alarm' | 'x_connect' | 'calibration';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ANIMATION_SIZE = SCREEN_WIDTH * 0.55;

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connectX, isConnecting } = useXAuth();

  const [currentStep, setCurrentStep] = useState<SetupStep>('alarm');
  const [isXConnected, setIsXConnected] = useState(false);

  // Alarm settings
  const [alarmTime, setAlarmTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedSoundName, setSelectedSoundName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check X connection status on mount
  useEffect(() => {
    const checkXConnection = async () => {
      const hasTokens = await hasXTokens();
      setIsXConnected(hasTokens);
    };
    checkXConnection();
  }, []);

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleTimeChange = (_: unknown, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setAlarmTime(selectedDate);
    }
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
      await updateUserSettings(user.uid, {
        alarmTime: formatTime(alarmTime),
        alarmDays: [0, 1, 2, 3, 4, 5, 6], // All days by default
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

  const handleStartCalibration = async () => {
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

  // Step 1: Alarm Settings
  const renderAlarmStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/Morning and night in the city.json')}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <Text style={styles.title}>{t('setup.setWakeUpTime')}</Text>

      {/* Time Picker Field */}
      <TouchableOpacity
        style={styles.inputField}
        onPress={() => setShowTimePicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.inputText}>{formatTime(alarmTime)}</Text>
      </TouchableOpacity>

      {showTimePicker && (
        <DateTimePicker
          value={alarmTime}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      {/* Sound Upload Field */}
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

      {/* Save Button */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSaveAlarmSettings}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{t('setup.saveSettings')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 2: X Connection
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

  // Step 3: Calibration
  const renderCalibrationStep = () => (
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
        <Text style={styles.title}>{t('squat.instruction')}</Text>
      </View>
      <Text style={styles.description}>{t('squat.description')}</Text>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleStartCalibration}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{t('setup.startCalibration')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'alarm':
        return renderAlarmStep();
      case 'x_connect':
        return renderXConnectStep();
      case 'calibration':
        return renderCalibrationStep();
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
});

export default SetupScreen;
