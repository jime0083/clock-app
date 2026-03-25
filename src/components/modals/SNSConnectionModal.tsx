import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useXAuth } from '@/hooks/useXAuth';
import { SNSConnection, defaultSNSConnection } from '@/types/firestore';

interface SNSConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  currentConnection: SNSConnection | null;
  onConnectionChange: () => void;
}

export const SNSConnectionModal: React.FC<SNSConnectionModalProps> = ({
  visible,
  onClose,
  currentConnection,
  onConnectionChange,
}) => {
  const { t } = useTranslation();
  const {
    isConnecting,
    isDisconnecting,
    error,
    connectX,
    disconnectX,
  } = useXAuth();

  const isConnected = currentConnection?.connected ?? false;
  const username = currentConnection?.username;

  const handleConnect = async () => {
    const success = await connectX();
    if (success) {
      onConnectionChange();
      Alert.alert(t('sns.connected'), t('sns.connectSuccess'));
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('sns.disconnectConfirm'),
      t('sns.disconnectConfirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('sns.disconnect'),
          style: 'destructive',
          onPress: async () => {
            const connection = currentConnection ?? defaultSNSConnection;
            const success = await disconnectX(connection);
            if (success) {
              onConnectionChange();
              Alert.alert(t('sns.disconnect'), t('sns.disconnectSuccess'));
            }
          },
        },
      ]
    );
  };

  const isLoading = isConnecting || isDisconnecting;

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
          <Text style={styles.title}>{t('settings.snsConnection')}</Text>
          <Text style={styles.subtitle}>{t('sns.description')}</Text>

          {/* Connection Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusHeader}>
              <View style={styles.xLogoContainer}>
                <Text style={styles.xLogo}>𝕏</Text>
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>{t('sns.connectionStatus')}</Text>
                {isConnected ? (
                  <Text style={styles.connectedText}>
                    {t('sns.connectedAs', { username })}
                  </Text>
                ) : (
                  <Text style={styles.disconnectedText}>
                    {t('sns.disconnect')}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusIndicator,
                  isConnected ? styles.statusConnected : styles.statusDisconnected,
                ]}
              />
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Action Button */}
          {isConnected ? (
            <Pressable
              onPress={handleDisconnect}
              style={[styles.actionButton, styles.disconnectButton]}
              disabled={isLoading}
            >
              {isDisconnecting ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="unlink" size={20} color={Colors.error} />
                  <Text style={styles.disconnectButtonText}>
                    {t('sns.disconnect')}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConnect}
              style={[styles.actionButton, styles.connectButton]}
              disabled={isLoading}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <>
                  <Text style={styles.xLogoButton}>𝕏</Text>
                  <Text style={styles.connectButtonText}>
                    {t('sns.connectX')}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Close Button */}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  statusContainer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xLogoContainer: {
    width: 48,
    height: 48,
    backgroundColor: Colors.textPrimary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLogo: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  connectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.success,
  },
  disconnectedText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusConnected: {
    backgroundColor: Colors.success,
  },
  statusDisconnected: {
    backgroundColor: Colors.textTertiary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '15',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginLeft: 8,
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: Colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disconnectButton: {
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  xLogoButton: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textInverse,
    marginRight: 8,
  },
  connectButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
  },
  closeButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
