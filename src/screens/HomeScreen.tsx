import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { AlarmCard } from '@/components/home/AlarmCard';
import { StatCard } from '@/components/home/StatCard';
import { SNSConnectionCard } from '@/components/home/SNSConnectionCard';
import AlarmSettingScreen from '@/screens/AlarmSettingScreen';
import { LanguageSettingModal } from '@/components/modals/LanguageSettingModal';
import { DeleteAccountModal } from '@/components/modals/DeleteAccountModal';
import { AudioSettingModal } from '@/components/modals/AudioSettingModal';
import { SNSConnectionModal } from '@/components/modals/SNSConnectionModal';
import { WeeklySummaryModal } from '@/components/modals/WeeklySummaryModal';
import { MenuDrawer, MenuItemId } from '@/components/menu/MenuDrawer';
import PaywallScreen from '@/screens/PaywallScreen';
import CalibrationScreen from '@/screens/CalibrationScreen';
import { getUserDocument, updateUserSettings } from '@/services/userService';
import { SquatDetectionConfig } from '@/services/accelerometerService';
import { signOut, deleteAccount } from '@/services/authService';
import {
  shouldShowWeeklySummary,
  getWeeklySummary,
  markWeeklySummaryShown,
} from '@/services/weeklySummaryService';
import { alarmService } from '@/services/alarmService';
import { scheduleSuccessNotification, scheduleFailureNotification } from '@/services/notificationService';
import SquatMeasureScreen from '@/screens/SquatMeasureScreen';
import { UserDocument } from '@/types/firestore';

const HomeScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isSubscribed } = useSubscription();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAlarmSettingVisible, setIsAlarmSettingVisible] = useState(false);
  const [isAudioModalVisible, setIsAudioModalVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isDeleteAccountModalVisible, setIsDeleteAccountModalVisible] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isCalibrationVisible, setIsCalibrationVisible] = useState(false);
  const [isSNSModalVisible, setIsSNSModalVisible] = useState(false);
  const [isWeeklySummaryVisible, setIsWeeklySummaryVisible] = useState(false);
  const [weeklySummaryData, setWeeklySummaryData] = useState<{
    successCount: number;
    squatCount: number;
  } | null>(null);

  // Squat measure screen state
  const [isSquatMeasureVisible, setIsSquatMeasureVisible] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await getUserDocument(user.uid);
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Initialize alarm service and set up notification listener
  useEffect(() => {
    const initializeAlarm = async () => {
      if (!user?.uid) return;

      try {
        // Initialize alarm service
        await alarmService.initialize(user.uid);

        // Set callback for when alarm triggers
        alarmService.setOnAlarmTriggered(() => {
          setIsSquatMeasureVisible(true);
        });

        // Re-schedule alarm if settings exist
        if (userData?.settings?.alarmTime && userData?.settings?.alarmDays) {
          await alarmService.scheduleAlarm({
            alarmTime: userData.settings.alarmTime,
            alarmDays: userData.settings.alarmDays,
            customAlarmSound: userData.settings.customAlarmSound || null,
          });
        }
      } catch (error) {
        console.error('Error initializing alarm:', error);
      }
    };

    initializeAlarm();
  }, [user?.uid, userData?.settings?.alarmTime, userData?.settings?.alarmDays]);

  // Check for weekly summary on mount
  useEffect(() => {
    const checkWeeklySummary = async () => {
      if (!user?.uid) return;

      try {
        const shouldShow = await shouldShowWeeklySummary();
        if (shouldShow) {
          const summary = await getWeeklySummary(user.uid);
          if (summary) {
            setWeeklySummaryData({
              successCount: summary.successCount,
              squatCount: summary.squatCount,
            });
            setIsWeeklySummaryVisible(true);
          }
        }
      } catch (error) {
        console.error('Error checking weekly summary:', error);
      }
    };

    checkWeeklySummary();
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, [fetchUserData]);

  const handleOpenMenu = () => {
    setIsMenuVisible(true);
  };

  const handleCloseMenu = () => {
    setIsMenuVisible(false);
  };

  const handleMenuItemPress = (itemId: MenuItemId) => {
    setIsMenuVisible(false);

    // Small delay to allow menu close animation
    setTimeout(() => {
      switch (itemId) {
        case 'alarmSettings':
          setIsAlarmSettingVisible(true);
          break;
        case 'soundSettings':
          setIsAudioModalVisible(true);
          break;
        case 'squatCalibration':
          setIsCalibrationVisible(true);
          break;
        case 'snsConnection':
          setIsSNSModalVisible(true);
          break;
        case 'language':
          setIsLanguageModalVisible(true);
          break;
        case 'account':
          // Show user info (already visible in menu)
          break;
        case 'logout':
          handleLogout();
          break;
        case 'deleteAccount':
          setIsDeleteAccountModalVisible(true);
          break;
        case 'premium':
          setIsPaywallVisible(true);
          break;
      }
    }, 300);
  };

  const handleChangeAlarm = () => {
    setIsAlarmSettingVisible(true);
  };

  const handleSaveAlarm = async (time: string, days: number[], soundName?: string | null) => {
    if (!user?.uid) return;
    try {
      // Save to Firestore
      await updateUserSettings(user.uid, {
        alarmTime: time,
        alarmDays: days,
        customAlarmSound: soundName || null,
      });

      // Schedule the alarm notification
      await alarmService.scheduleAlarm({
        alarmTime: time,
        alarmDays: days,
        customAlarmSound: soundName || null,
      });

      await fetchUserData();
    } catch (error) {
      console.error('Error saving alarm settings:', error);
    }
  };

  // Handle squat measurement completion
  const handleSquatComplete = async (success: boolean, squatCount: number) => {
    setIsSquatMeasureVisible(false);

    if (success) {
      // Show success notification
      await scheduleSuccessNotification(
        t('wakeup.successTitle'),
        t('notification.squatConfirmed')
      );
    } else {
      // Show failure notification (X posting is handled in SquatMeasureScreen)
      await scheduleFailureNotification(
        t('wakeup.failureTitle'),
        t('notification.oversleepPosted')
      );
    }

    // Refresh user data to update stats
    await fetchUserData();
  };

  const handleSaveAudio = async (audioUrl: string | null) => {
    if (!user?.uid) return;
    try {
      await updateUserSettings(user.uid, {
        customAlarmSound: audioUrl,
      });
      await fetchUserData();
    } catch (error) {
      console.error('Error saving audio settings:', error);
    }
  };

  const handleSaveLanguage = async (language: 'ja' | 'en') => {
    if (!user?.uid) return;
    try {
      // Change app language
      await i18n.changeLanguage(language);
      // Save to Firestore
      await updateUserSettings(user.uid, { language });
      await fetchUserData();
    } catch (error) {
      console.error('Error saving language settings:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;
    try {
      await deleteAccount(user.uid);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  const handleWeeklySummaryClose = async () => {
    setIsWeeklySummaryVisible(false);
    await markWeeklySummaryShown();
  };

  const handleCalibrationComplete = async (config: SquatDetectionConfig) => {
    if (!user?.uid) return;
    try {
      await updateUserSettings(user.uid, {
        calibration: {
          peakThreshold: config.peakThreshold,
          minSquatDuration: config.minSquatDuration,
          maxSquatDuration: config.maxSquatDuration,
          calibratedAt: new Date().toISOString(),
        },
      });
      setIsCalibrationVisible(false);
      await fetchUserData();
    } catch (error) {
      console.error('Error saving calibration:', error);
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  const stats = userData?.stats;
  const settings = userData?.settings;
  const snsConnections = userData?.snsConnections;
  const currentLanguage = (settings?.language || 'ja') as 'ja' | 'en';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable onPress={handleOpenMenu} style={styles.menuButton}>
          <Ionicons name="menu" size={28} color={Colors.textPrimary} />
        </Pressable>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <AlarmCard
          alarmTime={settings?.alarmTime ?? null}
          onChangeAlarm={handleChangeAlarm}
        />

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              value={stats?.totalFailures ?? 0}
              unit={t('home.day')}
              label={t('home.totalOversleepDays')}
              index={0}
            />
            <StatCard
              value={stats?.monthlyFailures ?? 0}
              unit={t('home.day')}
              label={t('home.monthlyOversleepDays')}
              index={1}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              value={stats?.totalSquats ?? 0}
              unit={t('home.times')}
              label={t('home.totalSquats')}
              index={2}
            />
            <StatCard
              value={stats?.monthlySquats ?? 0}
              unit={t('home.times')}
              label={t('home.monthlySquats')}
              index={3}
            />
          </View>
        </View>

        <SNSConnectionCard
          isConnected={snsConnections?.x?.connected ?? false}
          username={snsConnections?.x?.username}
        />
      </ScrollView>

      {/* Menu Drawer */}
      <MenuDrawer
        visible={isMenuVisible}
        onClose={handleCloseMenu}
        onMenuItemPress={handleMenuItemPress}
        userEmail={user?.email}
        userName={user?.displayName}
        isSubscribed={isSubscribed}
      />

      {/* Alarm Setting Screen */}
      {isAlarmSettingVisible && (
        <View style={StyleSheet.absoluteFill}>
          <AlarmSettingScreen
            onSave={handleSaveAlarm}
            onClose={() => setIsAlarmSettingVisible(false)}
            initialTime={settings?.alarmTime ?? null}
            initialDays={settings?.alarmDays ?? []}
            initialSoundName={settings?.customAlarmSound ?? null}
          />
        </View>
      )}

      {/* Audio Setting Modal */}
      {user?.uid && (
        <AudioSettingModal
          visible={isAudioModalVisible}
          onClose={() => setIsAudioModalVisible(false)}
          onSave={handleSaveAudio}
          currentAudioUrl={settings?.customAlarmSound ?? null}
          uid={user.uid}
        />
      )}

      {/* Language Setting Modal */}
      <LanguageSettingModal
        visible={isLanguageModalVisible}
        onClose={() => setIsLanguageModalVisible(false)}
        onSave={handleSaveLanguage}
        currentLanguage={currentLanguage}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        visible={isDeleteAccountModalVisible}
        onClose={() => setIsDeleteAccountModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />

      {/* Paywall Modal */}
      {isPaywallVisible && (
        <View style={StyleSheet.absoluteFill}>
          <PaywallScreen
            onClose={() => setIsPaywallVisible(false)}
            onSuccess={() => setIsPaywallVisible(false)}
          />
        </View>
      )}

      {/* Calibration Screen */}
      {isCalibrationVisible && (
        <View style={StyleSheet.absoluteFill}>
          <CalibrationScreen
            onComplete={handleCalibrationComplete}
            onClose={() => setIsCalibrationVisible(false)}
          />
        </View>
      )}

      {/* Squat Measure Screen (Alarm triggered) */}
      {isSquatMeasureVisible && (
        <View style={StyleSheet.absoluteFill}>
          <SquatMeasureScreen
            onComplete={handleSquatComplete}
            customAlarmSound={userData?.settings?.customAlarmSound}
          />
        </View>
      )}

      {/* SNS Connection Modal */}
      <SNSConnectionModal
        visible={isSNSModalVisible}
        onClose={() => setIsSNSModalVisible(false)}
        currentConnection={snsConnections?.x ?? null}
        onConnectionChange={fetchUserData}
      />

      {/* Weekly Summary Modal */}
      {weeklySummaryData && (
        <WeeklySummaryModal
          visible={isWeeklySummaryVisible}
          onClose={handleWeeklySummaryClose}
          successCount={weeklySummaryData.successCount}
          squatCount={weeklySummaryData.squatCount}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 44,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  statsGrid: {
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
  },
});

export default HomeScreen;
