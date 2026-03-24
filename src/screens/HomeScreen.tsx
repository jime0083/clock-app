import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
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
import { AlarmSettingModal } from '@/components/modals/AlarmSettingModal';
import { getUserDocument, updateUserSettings } from '@/services/userService';
import { UserDocument } from '@/types/firestore';

const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isAlarmModalVisible, setIsAlarmModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, [fetchUserData]);

  const handleOpenMenu = () => {
    // TODO: Open hamburger menu (Phase 5)
  };

  const handleChangeAlarm = () => {
    setIsAlarmModalVisible(true);
  };

  const handleSaveAlarm = async (time: string, days: number[]) => {
    if (!user?.uid) return;
    try {
      await updateUserSettings(user.uid, {
        alarmTime: time,
        alarmDays: days,
      });
      await fetchUserData();
    } catch (error) {
      console.error('Error saving alarm settings:', error);
    }
  };

  const stats = userData?.stats;
  const settings = userData?.settings;
  const snsConnections = userData?.snsConnections;

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

      <AlarmSettingModal
        visible={isAlarmModalVisible}
        onClose={() => setIsAlarmModalVisible(false)}
        onSave={handleSaveAlarm}
        initialTime={settings?.alarmTime ?? null}
        initialDays={settings?.alarmDays ?? []}
      />
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
