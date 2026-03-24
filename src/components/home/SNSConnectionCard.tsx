import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';

interface SNSConnectionCardProps {
  isConnected: boolean;
  username?: string | null;
}

export const SNSConnectionCard: React.FC<SNSConnectionCardProps> = ({
  isConnected,
  username,
}) => {
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInUp.delay(600).duration(500).springify()}
      style={styles.card}
    >
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>{t('sns.connectionStatus')}</Text>
          <Text style={styles.service}>X(Twitter){username ? ` @${username}` : ''}</Text>
        </View>
        <Text style={[styles.status, isConnected && styles.statusConnected]}>
          {isConnected ? t('sns.connected') : t('sns.disconnect')}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 8,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  service: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  statusConnected: {
    color: Colors.primary,
  },
});
