import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { styles } from './styles';

interface AutoPostConsentStepProps {
  alarmTime: string;
  onAgree: () => void;
  onDecline: () => void;
}

// 寝坊時のX自動投稿への同意（オプトイン）画面。課金ステップ後に表示（Problem 55）。
export const AutoPostConsentStep: React.FC<AutoPostConsentStepProps> = ({
  alarmTime,
  onAgree,
  onDecline,
}) => {
  const { t } = useTranslation();

  const examplePost = t('autoPost.examplePost', { time: alarmTime });

  return (
    <View style={styles.stepContainer}>
      <View style={styles.consentIconContainer}>
        <Ionicons name="notifications-outline" size={44} color={Colors.primary} />
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('autoPost.title')}</Text>
      </View>
      <Text style={styles.description}>{t('autoPost.description')}</Text>

      {/* 実際に投稿される内容の例（審査官・ユーザーに明示） */}
      <View style={styles.consentExampleBox}>
        <Text style={styles.consentExampleLabel}>{t('autoPost.exampleLabel')}</Text>
        <Text style={styles.consentExampleText}>{examplePost}</Text>
      </View>

      <Text style={styles.consentNote}>{t('autoPost.note')}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onAgree} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{t('autoPost.agree')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.skipButton} onPress={onDecline} activeOpacity={0.7}>
        <Text style={styles.skipButtonText}>{t('autoPost.decline')}</Text>
      </TouchableOpacity>
    </View>
  );
};
