import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';

interface AlarmCardProps {
  alarmTime: string | null;
  onChangeAlarm: () => void;
}

export const AlarmCard: React.FC<AlarmCardProps> = ({ alarmTime, onChangeAlarm }) => {
  const { t } = useTranslation();
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const displayTime = alarmTime || '--:--';

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(600).springify()}
      style={styles.card}
    >
      <Text style={styles.label}>{t('alarm.currentTime')}</Text>
      <Text style={styles.time}>{displayTime}</Text>
      <Pressable
        onPress={onChangeAlarm}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.button, animatedButtonStyle]}>
          <Text style={styles.buttonText}>{t('alarm.changeAlarm')}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  time: {
    fontSize: 72,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -2,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 80,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
