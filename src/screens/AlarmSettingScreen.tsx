import React, { useState } from 'react';
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

import { Colors } from '@/constants/colors';

interface AlarmSettingScreenProps {
  onSave: (time: string, days: number[]) => void;
  onClose: () => void;
  initialTime: string | null;
  initialDays: number[];
}

type SettingStep = 'time' | 'days';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ANIMATION_SIZE = SCREEN_WIDTH * 0.55;
const ANIMATION_SIZE_SMALL = SCREEN_WIDTH * 0.4;

const DAYS_OF_WEEK = [
  { key: 0, labelKey: 'alarm.days.sun' },
  { key: 1, labelKey: 'alarm.days.mon' },
  { key: 2, labelKey: 'alarm.days.tue' },
  { key: 3, labelKey: 'alarm.days.wed' },
  { key: 4, labelKey: 'alarm.days.thu' },
  { key: 5, labelKey: 'alarm.days.fri' },
  { key: 6, labelKey: 'alarm.days.sat' },
];

const AlarmSettingScreen: React.FC<AlarmSettingScreenProps> = ({
  onSave,
  onClose,
  initialTime,
  initialDays,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<SettingStep>('time');
  const [showTimePicker, setShowTimePicker] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays.length > 0 ? initialDays : [1, 2, 3, 4, 5]);

  const [alarmTime, setAlarmTime] = useState<Date>(() => {
    if (initialTime) {
      const [hours, minutes] = initialTime.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
    const date = new Date();
    date.setHours(7, 0, 0, 0);
    return date;
  });

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
    setCurrentStep('days');
  };

  const toggleDay = (dayKey: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey)
        ? prev.filter((d) => d !== dayKey)
        : [...prev, dayKey]
    );
  };

  const handleSave = () => {
    onSave(formatTime(alarmTime), selectedDays);
    onClose();
  };

  // Time selection step
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

  // Day selection step
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
        onPress={handleSave}
        activeOpacity={0.8}
        disabled={selectedDays.length === 0}
      >
        <Text style={styles.primaryButtonText}>{t('alarm.saveSettings')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'time':
        return renderTimeStep();
      case 'days':
        return renderDaysStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={28} color={Colors.textPrimary} />
      </TouchableOpacity>

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
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 24,
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
});

export default AlarmSettingScreen;
