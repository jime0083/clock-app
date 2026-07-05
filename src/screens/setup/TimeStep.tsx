import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { styles } from './styles';

interface TimeStepProps {
  formattedTime: string;
  alarmTime: Date;
  showTimePicker: boolean;
  onShowTimePicker: () => void;
  onTimeChange: (event: unknown, selectedDate?: Date) => void;
  onConfirm: () => void;
}

export const TimeStep: React.FC<TimeStepProps> = ({
  formattedTime,
  alarmTime,
  showTimePicker,
  onShowTimePicker,
  onTimeChange,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
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

      <TouchableOpacity style={styles.inputField} onPress={onShowTimePicker} activeOpacity={0.7}>
        <Text style={styles.inputText}>{formattedTime}</Text>
      </TouchableOpacity>

      {showTimePicker && (
        <View style={styles.timePickerContainerCompact}>
          <DateTimePicker
            value={alarmTime}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
            style={Platform.OS === 'ios' ? styles.timePickerIOS : undefined}
          />
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onConfirm} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );
};
