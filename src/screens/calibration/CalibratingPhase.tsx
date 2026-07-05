import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, AnimatedStyle } from 'react-native-reanimated';
import { StyleProp, ViewStyle } from 'react-native';
import { styles } from './styles';

type Phase = 'normal' | 'slow' | 'shallow';

interface PhaseInfo {
  title: string;
  description: string;
  color: string;
}

interface CalibratingPhaseProps {
  phase: Phase;
  phaseInfo: PhaseInfo;
  currentCount: number;
  targetCount: number;
  detected: boolean;
  pulseStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  ringStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  onClose: () => void;
  onDetect: () => void;
}

export const CalibratingPhase: React.FC<CalibratingPhaseProps> = ({
  phase,
  phaseInfo,
  currentCount,
  targetCount,
  detected,
  pulseStyle,
  ringStyle,
  onClose,
  onDetect,
}) => {
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#1A1A2E', '#16213E', '#0F3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFFFFF80" />
        </TouchableOpacity>

        {/* Phase indicator */}
        <View style={styles.phaseIndicator}>
          <View
            style={[
              styles.phaseDot,
              phase === 'normal' && styles.phaseDotActive,
              (phase === 'slow' || phase === 'shallow') && styles.phaseDotDone,
            ]}
          />
          <View style={styles.phaseLine} />
          <View
            style={[
              styles.phaseDot,
              phase === 'slow' && styles.phaseDotActive,
              phase === 'shallow' && styles.phaseDotDone,
            ]}
          />
          <View style={styles.phaseLine} />
          <View style={[styles.phaseDot, phase === 'shallow' && styles.phaseDotActive]} />
        </View>

        {/* Phase title */}
        <Animated.View key={phase} entering={FadeInDown.duration(400)} style={styles.phaseHeader}>
          <Text style={[styles.phaseTitle, { color: phaseInfo.color }]}>{phaseInfo.title}</Text>
          <Text style={styles.phaseDescription}>{phaseInfo.description}</Text>
        </Animated.View>

        {/* Count display */}
        <View style={styles.countContainer}>
          <Animated.View style={[styles.countRing, ringStyle]}>
            <LinearGradient
              colors={[phaseInfo.color, `${phaseInfo.color}80`]}
              style={styles.countRingGradient}
            >
              <View style={styles.countInner}>
                <Animated.View style={pulseStyle}>
                  <Text style={styles.countText}>
                    {currentCount}/{targetCount}
                  </Text>
                </Animated.View>
                <Text style={styles.countLabel}>
                  {detected ? t('calibration.detected') : t('calibration.detecting')}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: targetCount }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < currentCount && { backgroundColor: phaseInfo.color },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Detection button (for manual testing/demo) */}
        <TouchableOpacity style={styles.detectButton} onPress={onDetect} activeOpacity={0.8}>
          <LinearGradient
            colors={[phaseInfo.color, `${phaseInfo.color}CC`]}
            style={styles.detectButtonGradient}
          >
            <Ionicons name="fitness" size={32} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Instruction */}
        <View style={styles.bottomInstruction}>
          <Ionicons name="information-circle-outline" size={20} color="#FFFFFF80" />
          <Text style={styles.bottomInstructionText}>{t('calibration.holdPosition')}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};
