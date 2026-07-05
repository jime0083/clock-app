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
import { AlarmCard } from '@/components/home/AlarmCard';
import { StatCard } from '@/components/home/StatCard';
import { SNSConnectionCard } from '@/components/home/SNSConnectionCard';
import AlarmSettingScreen from '@/screens/AlarmSettingScreen';
import { LanguageSettingModal } from '@/components/modals/LanguageSettingModal';
import { DeleteAccountModal } from '@/components/modals/DeleteAccountModal';
import { SNSConnectionModal } from '@/components/modals/SNSConnectionModal';
import { WeeklySummaryModal } from '@/components/modals/WeeklySummaryModal';
import { MenuDrawer, MenuItemId } from '@/components/menu/MenuDrawer';
import CalibrationScreen from '@/screens/CalibrationScreen';
import { getUserDocument, updateUserSettings } from '@/services/userService';
import { SquatDetectionConfig } from '@/services/accelerometerService';
import { signOut, deleteAccount } from '@/services/authService';
import { auth } from '@/services/firebase';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import {
  shouldShowWeeklySummary,
  getWeeklySummary,
  markWeeklySummaryShown,
} from '@/services/weeklySummaryService';
import { alarmService } from '@/services/alarmService';
import { healthKitService } from '@/services/healthKitService';
import { UserDocument } from '@/types/firestore';

const HomeScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAlarmSettingVisible, setIsAlarmSettingVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isDeleteAccountModalVisible, setIsDeleteAccountModalVisible] = useState(false);
  const [isCalibrationVisible, setIsCalibrationVisible] = useState(false);
  const [isSNSModalVisible, setIsSNSModalVisible] = useState(false);
  const [isWeeklySummaryVisible, setIsWeeklySummaryVisible] = useState(false);
  // Re-authentication (used only when account deletion hits 'auth/requires-recent-login')
  const { signIn: reauthWithGoogle } = useGoogleAuth(
    () => {},
    (error) => console.error('Re-auth (Google) error:', error)
  );
  const { signIn: reauthWithApple } = useAppleAuth(
    () => {},
    (error) => console.error('Re-auth (Apple) error:', error)
  );

  const [weeklySummaryData, setWeeklySummaryData] = useState<{
    successCount: number;
    squatCount: number;
  } | null>(null);

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

  // Initialize HealthKit for workout tracking
  useEffect(() => {
    const initializeHealthKit = async () => {
      try {
        const initialized = await healthKitService.initialize();
        if (initialized) {
          console.log('[HomeScreen] HealthKit initialized successfully');
        } else {
          console.log('[HomeScreen] HealthKit not available or user declined');
        }
      } catch (error) {
        console.error('[HomeScreen] Error initializing HealthKit:', error);
      }
    };

    initializeHealthKit();
  }, []);

  // Re-schedule local alarm notifications when settings exist
  // NOTE: alarm service initialization, alarm-triggered callback, and the squat
  // screen are all managed by App.tsx (single source of truth) — see Problem 19
  useEffect(() => {
    const rescheduleAlarm = async () => {
      if (!user?.uid) return;

      try {
        if (userData?.settings?.alarmTime && userData?.settings?.alarmDays) {
          await alarmService.scheduleAlarm({
            alarmTime: userData.settings.alarmTime,
            alarmDays: userData.settings.alarmDays,
            customAlarmSound: userData.settings.customAlarmSound || null,
          });
        }
      } catch (error) {
        console.error('Error scheduling alarm:', error);
      }
    };

    rescheduleAlarm();
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
        case 'alarmSetting':
          setIsAlarmSettingVisible(true);
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
      }
    }, 300);
  };

  const handleChangeAlarm = () => {
    setIsAlarmSettingVisible(true);
  };

  const handleSaveAlarm = async (time: string, days: number[]) => {
    if (!user?.uid) return;
    try {
      // Save to Firestore
      await updateUserSettings(user.uid, {
        alarmTime: time,
        alarmDays: days,
      });

      // Schedule the alarm notification
      await alarmService.scheduleAlarm({
        alarmTime: time,
        alarmDays: days,
        customAlarmSound: null,
      });

      await fetchUserData();
    } catch (error) {
      console.error('Error saving alarm settings:', error);
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
      // Session is stale (e.g. signed in a while ago) — the Firestore data
      // has already been deleted by this point (Problem 29). Prompt the
      // user to sign in again, then retry so the Auth account is removed too.
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'auth/requires-recent-login') {
        Alert.alert(t('settings.reauthRequiredTitle'), t('settings.reauthRequiredMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.signInAgain'),
            onPress: async () => {
              try {
                const providerId = auth.currentUser?.providerData[0]?.providerId;
                if (providerId === 'apple.com') {
                  await reauthWithApple();
                } else {
                  await reauthWithGoogle();
                }
                await deleteAccount(user.uid);
                setIsDeleteAccountModalVisible(false);
              } catch (retryError) {
                console.error('Error re-authenticating for account deletion:', retryError);
                Alert.alert(t('common.error'), t('settings.reauthFailedMessage'));
              }
            },
          },
        ]);
        return;
      }
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
      />

      {/* Alarm Setting Screen */}
      {isAlarmSettingVisible && (
        <View style={StyleSheet.absoluteFill}>
          <AlarmSettingScreen
            onSave={handleSaveAlarm}
            onClose={() => setIsAlarmSettingVisible(false)}
            initialTime={settings?.alarmTime ?? null}
            initialDays={settings?.alarmDays ?? []}
          />
        </View>
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

      {/* Calibration Screen */}
      {isCalibrationVisible && (
        <View style={StyleSheet.absoluteFill}>
          <CalibrationScreen
            onComplete={handleCalibrationComplete}
            onClose={() => setIsCalibrationVisible(false)}
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
