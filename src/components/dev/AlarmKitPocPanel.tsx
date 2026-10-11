import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { logger } from '@/utils/logger';
import {
  isAlarmKitAvailable,
  getAuthorizationState,
  requestAuthorization,
  scheduleAlarm,
  scheduleAlarmWithBackups,
  cancelAllAlarms,
  getAlarms,
  consumeStopEvents,
  addAlarmStopListener,
  type AlarmKitAlarm,
  type AlarmKitAuthorizationState,
} from '../../../modules/alarm-kit/src';

/**
 * AlarmKit 試作パネル（Problem 56 / Phase 26.18 PoC）。開発ビルド（__DEV__）でのみ表示する。
 * 本実装（アラーム設定画面との統合）までの検証用。リリースビルドには表示されない。
 */

const ALARM_TITLE = 'オキロヤ（AlarmKit試作）';
const ALARM_SOUND = 'alarm.caf';
const LEAD_SECONDS = 60;
const BACKUP_COUNT = 3;
const BACKUP_INTERVAL_SECONDS = 60;
const MAX_LOG_LINES = 12;
const POLL_INTERVAL_MS = 5000;

type BusyAction = 'auth' | 'one' | 'backups' | 'cancel' | null;

const AUTH_COLOR: Record<AlarmKitAuthorizationState, string> = {
  authorized: Colors.success,
  denied: Colors.error,
  notDetermined: Colors.warning,
  unsupported: Colors.disconnected,
};

const STATE_COLOR: Record<AlarmKitAlarm['state'], string> = {
  scheduled: Colors.primary,
  alerting: Colors.error,
  countdown: Colors.warning,
  paused: Colors.textTertiary,
  unknown: Colors.textTertiary,
};

const formatClock = (date: Date): string =>
  [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const AlarmKitPocPanel: React.FC = () => {
  const [available, setAvailable] = useState(false);
  const [authState, setAuthState] = useState<AlarmKitAuthorizationState>('unsupported');
  const [alarms, setAlarms] = useState<AlarmKitAlarm[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<BusyAction>(null);

  const appendLog = useCallback((message: string) => {
    setLog(prev => [`${formatClock(new Date())}  ${message}`, ...prev].slice(0, MAX_LOG_LINES));
  }, []);

  const refresh = useCallback(() => {
    try {
      setAvailable(isAlarmKitAvailable());
      setAuthState(getAuthorizationState());
      setAlarms(getAlarms());
    } catch (error) {
      logger.error('[AlarmKitPoC] refresh failed:', error);
      appendLog(`取得失敗: ${describeError(error)}`);
    }
  }, [appendLog]);

  const drainStopEvents = useCallback(() => {
    consumeStopEvents().forEach(event => {
      appendLog(`停止 ${event.alarmId.slice(0, 8)} @${formatClock(new Date(event.stoppedAt))}`);
    });
  }, [appendLog]);

  useEffect(() => {
    refresh();
    drainStopEvents();

    const subscription = addAlarmStopListener(event => {
      appendLog(`停止(受信) ${event.alarmId.slice(0, 8)}`);
      refresh();
    });
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        drainStopEvents();
        refresh();
      }
    });
    const timer = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      subscription?.remove();
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [refresh, drainStopEvents, appendLog]);

  const run = useCallback(
    async (action: Exclude<BusyAction, null>, task: () => Promise<string>) => {
      if (busy) return;
      setBusy(action);
      try {
        appendLog(await task());
      } catch (error) {
        logger.error(`[AlarmKitPoC] ${action} failed:`, error);
        appendLog(`失敗: ${describeError(error)}`);
      } finally {
        setBusy(null);
        refresh();
      }
    },
    [busy, appendLog, refresh]
  );

  const handleRequestAuth = () => run('auth', async () => `許可: ${await requestAuthorization()}`);

  const handleScheduleOne = () =>
    run('one', async () => {
      const fireAt = new Date(Date.now() + LEAD_SECONDS * 1000);
      const id = await scheduleAlarm({
        epochMillis: fireAt.getTime(),
        title: ALARM_TITLE,
        soundName: ALARM_SOUND,
        openAppOnStop: true,
      });
      return `予約 ${id.slice(0, 8)} → ${formatClock(fireAt)}`;
    });

  const handleScheduleWithBackups = () =>
    run('backups', async () => {
      const fireAt = new Date(Date.now() + LEAD_SECONDS * 1000);
      const ids = await scheduleAlarmWithBackups(
        {
          epochMillis: fireAt.getTime(),
          title: ALARM_TITLE,
          soundName: ALARM_SOUND,
          openAppOnStop: true,
        },
        BACKUP_COUNT,
        BACKUP_INTERVAL_SECONDS
      );
      return `予約 ${ids.length}件 → ${formatClock(fireAt)}から${BACKUP_INTERVAL_SECONDS}秒おき`;
    });

  const handleCancelAll = () => run('cancel', async () => `取り消し ${cancelAllAlarms()}件`);

  if (Platform.OS !== 'ios') return null;

  const renderButton = (
    action: Exclude<BusyAction, null>,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    variant: 'primary' | 'secondary' | 'danger'
  ) => {
    const disabled = !available || busy !== null;
    const tint =
      variant === 'primary'
        ? Colors.textInverse
        : variant === 'danger'
          ? Colors.error
          : Colors.textPrimary;
    return (
      <TouchableOpacity
        key={action}
        style={[
          styles.button,
          variant === 'primary' && styles.buttonPrimary,
          variant === 'danger' && styles.buttonDanger,
          disabled && styles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {busy === action ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Ionicons name={icon} size={16} color={tint} />
        )}
        <Text style={[styles.buttonText, { color: tint }]} numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>DEV</Text>
        </View>
        <Text style={styles.title}>AlarmKit 試作</Text>
        <TouchableOpacity onPress={refresh} hitSlop={8} style={styles.refresh}>
          <Ionicons name="refresh" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.readout}>
        <View style={styles.readoutRow}>
          <Text style={styles.readoutLabel}>iOS 26+</Text>
          <View
            style={[
              styles.dot,
              { backgroundColor: available ? Colors.success : Colors.disconnected },
            ]}
          />
          <Text style={styles.readoutValue}>{available ? 'available' : 'unavailable'}</Text>
        </View>
        <View style={styles.readoutRow}>
          <Text style={styles.readoutLabel}>許可</Text>
          <View style={[styles.dot, { backgroundColor: AUTH_COLOR[authState] }]} />
          <Text style={styles.readoutValue}>{authState}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {renderButton('auth', '許可を求める', 'key-outline', handleRequestAuth, 'secondary')}
        {renderButton(
          'one',
          `${LEAD_SECONDS}秒後に1件`,
          'alarm-outline',
          handleScheduleOne,
          'primary'
        )}
        {renderButton(
          'backups',
          `${LEAD_SECONDS}秒後＋予備${BACKUP_COUNT}件`,
          'albums-outline',
          handleScheduleWithBackups,
          'primary'
        )}
        {renderButton('cancel', 'すべて取り消す', 'trash-outline', handleCancelAll, 'danger')}
      </View>

      <Text style={styles.sectionLabel}>予約中 {alarms.length}</Text>
      {alarms.length === 0 ? (
        <Text style={styles.mono}>—</Text>
      ) : (
        alarms.map(alarm => (
          <View key={alarm.id} style={styles.alarmRow}>
            <View style={[styles.dot, { backgroundColor: STATE_COLOR[alarm.state] }]} />
            <Text style={[styles.mono, styles.monoInline]}>
              {alarm.id.slice(0, 8)} {alarm.state}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>ログ</Text>
      <View style={styles.logBox}>
        {log.length === 0 ? (
          <Text style={styles.logText}>（まだありません）</Text>
        ) : (
          log.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.logText}>
              {line}
            </Text>
          ))
        )}
      </View>
    </View>
  );
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.textTertiary,
    backgroundColor: Colors.backgroundSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.textPrimary,
  },
  tagText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textInverse,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  refresh: {
    padding: 4,
  },
  readout: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 10,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readoutLabel: {
    width: 64,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  readoutValue: {
    fontFamily: MONO,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  button: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.buttonSecondary,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonDanger: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  mono: {
    fontFamily: MONO,
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  monoInline: {
    marginBottom: 0,
  },
  logBox: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.textPrimary,
    minHeight: 48,
  },
  logText: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.backgroundTertiary,
  },
});
