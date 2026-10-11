import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * AlarmKit の JS ブリッジ（Problem 56 / Phase 26.18 試作）。
 * iOS 26 以上のみ有効。それ以外（Android・iOS 26 未満・ネイティブ未ビルド）では isAlarmKitAvailable() が false。
 */

export type AlarmKitAuthorizationState = 'notDetermined' | 'denied' | 'authorized' | 'unsupported';

export interface ScheduleAlarmOptions {
  /** 省略時はネイティブ側で UUID を振る */
  id?: string;
  /** 鳴らす日時（UNIX ミリ秒） */
  epochMillis: number;
  title: string;
  /** メインバンドル内の音ファイル名（例: 'alarm.caf'）。省略時はシステムの既定音 */
  soundName?: string;
  /** 「停止」でアプリを開かせるか（既定 true） */
  openAppOnStop?: boolean;
}

export interface AlarmKitAlarm {
  id: string;
  state: 'scheduled' | 'countdown' | 'paused' | 'alerting' | 'unknown';
}

export interface AlarmKitSubscription {
  remove(): void;
}

export interface AlarmStopEvent {
  alarmId: string;
  /** UNIX ミリ秒 */
  stoppedAt: number;
}

interface OkiroyaAlarmKitNativeModule {
  isAvailable(): boolean;
  getAuthorizationState(): AlarmKitAuthorizationState;
  requestAuthorization(): Promise<AlarmKitAuthorizationState>;
  scheduleAlarm(options: ScheduleAlarmOptions): Promise<string>;
  cancelAlarm(id: string): void;
  cancelAllAlarms(): number;
  getAlarms(): AlarmKitAlarm[];
  consumeStopEvents(): AlarmStopEvent[];
  addListener(
    eventName: 'onAlarmStopped',
    listener: (event: AlarmStopEvent) => void
  ): AlarmKitSubscription;
}

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<OkiroyaAlarmKitNativeModule>('OkiroyaAlarmKit')
    : null;

const requireModule = (): OkiroyaAlarmKitNativeModule => {
  if (!nativeModule || !nativeModule.isAvailable()) {
    throw new Error('AlarmKit is not available on this device (iOS 26.0+ required)');
  }
  return nativeModule;
};

export const isAlarmKitAvailable = (): boolean => nativeModule?.isAvailable() ?? false;

export const getAuthorizationState = (): AlarmKitAuthorizationState =>
  nativeModule?.getAuthorizationState() ?? 'unsupported';

export const requestAuthorization = async (): Promise<AlarmKitAuthorizationState> =>
  nativeModule ? nativeModule.requestAuthorization() : 'unsupported';

export const scheduleAlarm = (options: ScheduleAlarmOptions): Promise<string> =>
  requireModule().scheduleAlarm(options);

/**
 * 本体のアラームに加え、「停止」で止められた場合の予備アラームを intervalSeconds おきに count 件予約する。
 * 返り値は予約したアラームID（先頭が本体）。途中で失敗した場合は予約済みの分を取り消してから例外を投げる。
 */
export const scheduleAlarmWithBackups = async (
  options: Omit<ScheduleAlarmOptions, 'id'>,
  backupCount: number,
  intervalSeconds: number
): Promise<string[]> => {
  if (!Number.isInteger(backupCount) || backupCount < 0) {
    throw new Error('backupCount must be a non-negative integer');
  }
  if (!(intervalSeconds > 0)) {
    throw new Error('intervalSeconds must be positive');
  }

  const module = requireModule();
  const ids: string[] = [];
  try {
    for (let i = 0; i <= backupCount; i++) {
      const id = await module.scheduleAlarm({
        ...options,
        epochMillis: options.epochMillis + i * intervalSeconds * 1000,
      });
      ids.push(id);
    }
  } catch (error) {
    ids.forEach(id => {
      try {
        module.cancelAlarm(id);
      } catch {
        // 取り消しに失敗しても元のエラーを優先して投げる
      }
    });
    throw error;
  }
  return ids;
};

export const cancelAlarm = (id: string): void => requireModule().cancelAlarm(id);

export const cancelAllAlarms = (): number => requireModule().cancelAllAlarms();

export const getAlarms = (): AlarmKitAlarm[] => nativeModule?.getAlarms() ?? [];

export const consumeStopEvents = (): AlarmStopEvent[] => nativeModule?.consumeStopEvents() ?? [];

export const addAlarmStopListener = (
  listener: (event: AlarmStopEvent) => void
): AlarmKitSubscription | null => nativeModule?.addListener('onAlarmStopped', listener) ?? null;
