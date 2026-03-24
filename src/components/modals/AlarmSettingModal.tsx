import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { DayOfWeek } from '@/types/firestore';

interface AlarmSettingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (time: string, days: number[]) => void;
  initialTime: string | null;
  initialDays: number[];
}

const DAYS: { key: string; value: DayOfWeek }[] = [
  { key: 'mon', value: 1 },
  { key: 'tue', value: 2 },
  { key: 'wed', value: 3 },
  { key: 'thu', value: 4 },
  { key: 'fri', value: 5 },
  { key: 'sat', value: 6 },
  { key: 'sun', value: 0 },
];

export const AlarmSettingModal: React.FC<AlarmSettingModalProps> = ({
  visible,
  onClose,
  onSave,
  initialTime,
  initialDays,
}) => {
  const { t } = useTranslation();
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays);
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
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

  useEffect(() => {
    if (visible) {
      setSelectedDays(initialDays);
      if (initialTime) {
        const [hours, minutes] = initialTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setSelectedTime(date);
      }
    }
  }, [visible, initialTime, initialDays]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedTime(date);
    }
  };

  const handleSave = () => {
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    onSave(`${hours}:${minutes}`, selectedDays);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={styles.modal}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{t('alarm.title')}</Text>

          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              locale="ja-JP"
              textColor={Colors.textPrimary}
              style={styles.picker}
            />
          </View>

          <Text style={styles.sectionTitle}>{t('alarm.selectDays')}</Text>
          <View style={styles.daysContainer}>
            {DAYS.map(day => (
              <Pressable
                key={day.key}
                onPress={() => toggleDay(day.value)}
                style={[
                  styles.dayButton,
                  selectedDays.includes(day.value) && styles.dayButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selectedDays.includes(day.value) && styles.dayTextSelected,
                  ]}
                >
                  {t(`alarm.days.${day.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{t('alarm.saveSettings')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  picker: {
    width: 300,
    height: 180,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dayTextSelected: {
    color: Colors.textInverse,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
