import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { styles } from './styles';

interface XConnectStepProps {
  isXConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onNext: () => void;
}

export const XConnectStep: React.FC<XConnectStepProps> = ({
  isXConnected,
  isConnecting,
  onConnect,
  onNext,
}) => {
  const { t } = useTranslation();

  return (
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
          <TouchableOpacity style={styles.primaryButton} onPress={onNext} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onConnect}
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
};
