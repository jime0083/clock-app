import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { styles, DAYS_OF_WEEK } from './styles';

interface DaysStepProps {
  selectedDays: number[];
  onToggleDay: (dayKey: number) => void;
  onConfirm: () => void;
}

export const DaysStep: React.FC<DaysStepProps> = ({ selectedDays, onToggleDay, onConfirm }) => {
  const { t } = useTranslation();

  return (
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
        {DAYS_OF_WEEK.map(day => (
          <TouchableOpacity
            key={day.key}
            style={[styles.dayButton, selectedDays.includes(day.key) && styles.dayButtonSelected]}
            onPress={() => onToggleDay(day.key)}
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
        onPress={onConfirm}
        activeOpacity={0.8}
        disabled={selectedDays.length === 0}
      >
        <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );
};
