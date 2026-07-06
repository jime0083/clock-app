import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { PlanType } from '@/services/purchaseService';

export type MenuItemId =
  | 'alarmSetting'
  | 'squatCalibration'
  | 'snsConnection'
  | 'language'
  | 'deleteAccount'
  | 'logout';

interface MenuItem {
  id: MenuItemId;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  section: 'settings' | 'account';
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'alarmSetting',
    labelKey: 'settings.alarmSettings',
    icon: 'alarm-outline',
    section: 'settings',
  },
  {
    id: 'squatCalibration',
    labelKey: 'settings.squatCalibration',
    icon: 'body-outline',
    section: 'settings',
  },
  {
    id: 'snsConnection',
    labelKey: 'settings.snsConnection',
    icon: 'share-social-outline',
    section: 'settings',
  },
  {
    id: 'language',
    labelKey: 'settings.language',
    icon: 'language-outline',
    section: 'settings',
  },
  {
    id: 'logout',
    labelKey: 'auth.logout',
    icon: 'log-out-outline',
    section: 'account',
  },
  {
    id: 'deleteAccount',
    labelKey: 'settings.deleteAccount',
    icon: 'trash-outline',
    danger: true,
    section: 'account',
  },
];

interface MenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  onMenuItemPress: (itemId: MenuItemId) => void;
  userEmail?: string | null;
  userName?: string | null;
  planType?: PlanType;
}

const PLAN_ICONS: Record<PlanType, keyof typeof Ionicons.glyphMap> = {
  monthly: 'ribbon',
  yearly: 'ribbon',
  admin: 'shield-checkmark',
  none: 'alert-circle-outline',
};

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  visible,
  onClose,
  onMenuItemPress,
  userEmail,
  userName,
  planType = 'none',
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const settingsItems = MENU_ITEMS.filter(item => item.section === 'settings');
  const accountItems = MENU_ITEMS.filter(item => item.section === 'account');

  const renderMenuItem = (item: MenuItem, index: number) => (
    <Animated.View key={item.id} entering={FadeIn.delay(100 + index * 50).duration(300)}>
      <Pressable
        onPress={() => onMenuItemPress(item.id)}
        style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      >
        <Ionicons
          name={item.icon}
          size={22}
          color={item.danger ? Colors.error : Colors.textPrimary}
        />
        <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>
          {t(item.labelKey)}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          entering={SlideInRight.duration(250)}
          exiting={SlideOutRight.duration(250)}
          style={[
            styles.drawer,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          </View>

          {/* User Info */}
          {(userName || userEmail) && (
            <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.userInfo}>
              {userName && <Text style={styles.userName}>{userName}</Text>}
              {userEmail && <Text style={styles.userEmail}>{userEmail}</Text>}
              <View
                style={[
                  styles.planBadge,
                  planType === 'admin' && styles.planBadgeAdmin,
                  planType === 'none' && styles.planBadgeMuted,
                ]}
              >
                <Ionicons
                  name={PLAN_ICONS[planType]}
                  size={14}
                  color={
                    planType === 'admin'
                      ? Colors.accent
                      : planType === 'none'
                        ? Colors.textTertiary
                        : Colors.primary
                  }
                />
                <Text
                  style={[
                    styles.planText,
                    planType === 'admin' && styles.planTextAdmin,
                    planType === 'none' && styles.planTextMuted,
                  ]}
                >
                  {t(`plan.${planType}`)}
                </Text>
              </View>
            </Animated.View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Settings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.title')}</Text>
              {settingsItems.map((item, index) => renderMenuItem(item, index))}
            </View>

            {/* Account Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
              {accountItems.map((item, index) =>
                renderMenuItem(item, settingsItems.length + index)
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 320,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userInfo: {
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 120, 246, 0.12)',
  },
  planBadgeAdmin: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  planBadgeMuted: {
    backgroundColor: Colors.backgroundTertiary,
  },
  planText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 5,
  },
  planTextAdmin: {
    color: Colors.accent,
  },
  planTextMuted: {
    color: Colors.textTertiary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginLeft: 14,
  },
  menuItemTextDanger: {
    color: Colors.error,
  },
});
