const mockCreateChannel = jest.fn();
const mockRequestPermission = jest.fn();
const mockIsBatteryOptimizationEnabled = jest.fn();
const mockOpenBatteryOptimizationSettings = jest.fn();
const mockGetNotificationSettings = jest.fn();
const mockCreateTriggerNotification = jest.fn();
const mockGetTriggerNotificationIds = jest.fn();
const mockCancelTriggerNotification = jest.fn();
const mockGetDisplayedNotifications = jest.fn();
const mockCancelNotification = jest.fn();
const mockCancelAllNotifications = jest.fn();
const mockCancelTriggerNotifications = jest.fn();
const mockOnForegroundEvent = jest.fn();
const mockOnBackgroundEvent = jest.fn();
const mockGetInitialNotification = jest.fn();
const mockDisplayNotification = jest.fn();
const mockSetNotificationCategories = jest.fn();

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: (...args: unknown[]) => mockCreateChannel(...args),
    requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
    isBatteryOptimizationEnabled: (...args: unknown[]) => mockIsBatteryOptimizationEnabled(...args),
    openBatteryOptimizationSettings: (...args: unknown[]) =>
      mockOpenBatteryOptimizationSettings(...args),
    getNotificationSettings: (...args: unknown[]) => mockGetNotificationSettings(...args),
    createTriggerNotification: (...args: unknown[]) => mockCreateTriggerNotification(...args),
    getTriggerNotificationIds: (...args: unknown[]) => mockGetTriggerNotificationIds(...args),
    cancelTriggerNotification: (...args: unknown[]) => mockCancelTriggerNotification(...args),
    getDisplayedNotifications: (...args: unknown[]) => mockGetDisplayedNotifications(...args),
    cancelNotification: (...args: unknown[]) => mockCancelNotification(...args),
    cancelAllNotifications: (...args: unknown[]) => mockCancelAllNotifications(...args),
    cancelTriggerNotifications: (...args: unknown[]) => mockCancelTriggerNotifications(...args),
    onForegroundEvent: (...args: unknown[]) => mockOnForegroundEvent(...args),
    onBackgroundEvent: (...args: unknown[]) => mockOnBackgroundEvent(...args),
    getInitialNotification: (...args: unknown[]) => mockGetInitialNotification(...args),
    displayNotification: (...args: unknown[]) => mockDisplayNotification(...args),
    setNotificationCategories: (...args: unknown[]) => mockSetNotificationCategories(...args),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidVisibility: { PUBLIC: 1 },
  AndroidCategory: { ALARM: 'alarm' },
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { WEEKLY: 2, NONE: -1 },
  EventType: { DISMISSED: 0, PRESS: 1, DELIVERED: 2, ACTION_PRESS: 3, UNKNOWN: -1 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import {
  createAlarmChannel,
  requestNotificationPermissions,
  checkNotificationPermissions,
  scheduleAlarmNotification,
  scheduleAlarmRepeatNotifications,
  cancelAlarmRepeatNotifications,
  cancelAllAlarmNotifications,
  cancelNotification,
  getScheduledNotifications,
  dismissAllNotifications,
  setForegroundEventHandler,
  setBackgroundEventHandler,
  getInitialNotification,
  scheduleOneTimeAlarm,
  displayImmediateNotification,
  scheduleSuccessNotification,
  scheduleFailureNotification,
  setNotificationCategories,
} from '../../services/notificationService';

describe('notificationService (iOS)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTriggerNotification.mockResolvedValue('notification-id');
    mockCancelAllNotifications.mockResolvedValue(undefined);
    mockCancelTriggerNotifications.mockResolvedValue(undefined);
  });

  it('should create the Android alarm channel with the expected settings', async () => {
    mockCreateChannel.mockResolvedValue('alarm-channel');

    await createAlarmChannel();

    expect(mockCreateChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alarm-channel', importance: 4 })
    );
  });

  describe('requestNotificationPermissions', () => {
    it('should return true when authorized (no Android channel setup on iOS)', async () => {
      mockRequestPermission.mockResolvedValue({ authorizationStatus: 1 }); // AUTHORIZED

      expect(await requestNotificationPermissions()).toBe(true);
      expect(mockCreateChannel).not.toHaveBeenCalled();
    });

    it('should return false when not authorized', async () => {
      mockRequestPermission.mockResolvedValue({ authorizationStatus: 0 }); // DENIED

      expect(await requestNotificationPermissions()).toBe(false);
    });
  });

  describe('checkNotificationPermissions', () => {
    it('should return true when authorized', async () => {
      mockGetNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      expect(await checkNotificationPermissions()).toBe(true);
    });

    it('should return false when denied', async () => {
      mockGetNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

      expect(await checkNotificationPermissions()).toBe(false);
    });
  });

  describe('scheduleAlarmNotification', () => {
    it('should cancel existing alarms and schedule one per specified day', async () => {
      const ids = await scheduleAlarmNotification('07:00', [1, 3], 'Wake up', 'Time to rise');

      expect(mockCancelAllNotifications).toHaveBeenCalled();
      expect(mockCancelTriggerNotifications).toHaveBeenCalled();
      expect(ids).toHaveLength(2);
      expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(2);
    });

    it('should schedule for every day when alarmDays is empty', async () => {
      const ids = await scheduleAlarmNotification('07:00', [], 'Wake up', 'Time to rise');

      expect(ids).toHaveLength(7);
    });
  });

  describe('scheduleAlarmRepeatNotifications', () => {
    it('should schedule 10 repeat notifications', async () => {
      const ids = await scheduleAlarmRepeatNotifications('Wake up', 'Time to rise');

      expect(ids).toHaveLength(10);
      expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(10);
    });
  });

  describe('cancelAlarmRepeatNotifications', () => {
    it('should cancel only trigger and displayed notifications with the repeat prefix', async () => {
      mockGetTriggerNotificationIds.mockResolvedValue([
        'alarm-repeat-1',
        'alarm-repeat-2',
        'alarm-0',
      ]);
      mockGetDisplayedNotifications.mockResolvedValue([
        { id: 'alarm-repeat-1', notification: {} },
        { id: 'alarm-0', notification: {} },
      ]);

      await cancelAlarmRepeatNotifications();

      expect(mockCancelTriggerNotification).toHaveBeenCalledTimes(2);
      expect(mockCancelTriggerNotification).toHaveBeenCalledWith('alarm-repeat-1');
      expect(mockCancelTriggerNotification).toHaveBeenCalledWith('alarm-repeat-2');
      expect(mockCancelNotification).toHaveBeenCalledTimes(1);
      expect(mockCancelNotification).toHaveBeenCalledWith('alarm-repeat-1');
    });
  });

  it('cancelAllAlarmNotifications should cancel both displayed and trigger notifications', async () => {
    await cancelAllAlarmNotifications();

    expect(mockCancelAllNotifications).toHaveBeenCalled();
    expect(mockCancelTriggerNotifications).toHaveBeenCalled();
  });

  it('cancelNotification should cancel by id', async () => {
    await cancelNotification('some-id');
    expect(mockCancelNotification).toHaveBeenCalledWith('some-id');
  });

  it('getScheduledNotifications should return trigger notification ids', async () => {
    mockGetTriggerNotificationIds.mockResolvedValue(['a', 'b']);

    expect(await getScheduledNotifications()).toEqual(['a', 'b']);
  });

  it('dismissAllNotifications should cancel all displayed notifications', async () => {
    await dismissAllNotifications();
    expect(mockCancelAllNotifications).toHaveBeenCalled();
  });

  describe('setForegroundEventHandler', () => {
    it('should ignore events for non-alarm notifications', () => {
      const onAlarm = jest.fn();
      const onSnooze = jest.fn();
      const onDismiss = jest.fn();
      setForegroundEventHandler(onAlarm, onSnooze, onDismiss);
      const handler = mockOnForegroundEvent.mock.calls[0][0];

      handler({ type: 1, detail: { notification: { data: { type: 'success' } } } });

      expect(onAlarm).not.toHaveBeenCalled();
    });

    it('should call onAlarmTriggered on DELIVERED and PRESS', () => {
      const onAlarm = jest.fn();
      setForegroundEventHandler(onAlarm, jest.fn(), jest.fn());
      const handler = mockOnForegroundEvent.mock.calls[0][0];

      handler({ type: 2, detail: { notification: { data: { type: 'alarm' } } } }); // DELIVERED
      handler({ type: 1, detail: { notification: { data: { type: 'alarm' } } } }); // PRESS

      expect(onAlarm).toHaveBeenCalledTimes(2);
    });

    it('should call onSnooze / onDismiss on ACTION_PRESS', () => {
      const onSnooze = jest.fn();
      const onDismiss = jest.fn();
      setForegroundEventHandler(jest.fn(), onSnooze, onDismiss);
      const handler = mockOnForegroundEvent.mock.calls[0][0];

      handler({
        type: 3, // ACTION_PRESS
        detail: { notification: { data: { type: 'alarm' } }, pressAction: { id: 'snooze' } },
      });
      handler({
        type: 3,
        detail: { notification: { data: { type: 'alarm' } }, pressAction: { id: 'dismiss' } },
      });

      expect(onSnooze).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('setBackgroundEventHandler', () => {
    it('should ignore events for non-alarm notifications', async () => {
      setBackgroundEventHandler();
      const handler = mockOnBackgroundEvent.mock.calls[0][0];

      await handler({ type: 1, detail: { notification: { data: { type: 'success' } } } });

      expect(mockCreateTriggerNotification).not.toHaveBeenCalled();
    });

    it('should schedule a snooze notification and cancel the current one on snooze action', async () => {
      setBackgroundEventHandler();
      const handler = mockOnBackgroundEvent.mock.calls[0][0];

      await handler({
        type: 3, // ACTION_PRESS
        detail: {
          notification: { id: 'alarm-0', data: { type: 'alarm' }, title: 'Wake up', body: 'Go' },
          pressAction: { id: 'snooze' },
        },
      });

      expect(mockCreateTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'alarm-snooze' }),
        expect.anything()
      );
      expect(mockCancelNotification).toHaveBeenCalledWith('alarm-0');
    });

    it('should cancel repeat notifications and the current one on dismiss action', async () => {
      mockGetTriggerNotificationIds.mockResolvedValue([]);
      mockGetDisplayedNotifications.mockResolvedValue([]);
      setBackgroundEventHandler();
      const handler = mockOnBackgroundEvent.mock.calls[0][0];

      await handler({
        type: 3,
        detail: {
          notification: { id: 'alarm-0', data: { type: 'alarm' } },
          pressAction: { id: 'dismiss' },
        },
      });

      expect(mockCancelNotification).toHaveBeenCalledWith('alarm-0');
    });
  });

  it('getInitialNotification should return the notifee result', async () => {
    mockGetInitialNotification.mockResolvedValue({ notification: { data: { type: 'alarm' } } });

    const result = await getInitialNotification();

    expect(result).toEqual({ notification: { data: { type: 'alarm' } } });
  });

  it('scheduleOneTimeAlarm should create a test trigger notification', async () => {
    const id = await scheduleOneTimeAlarm(30, 'Test alarm', 'body');

    expect(id).toBe('notification-id');
    expect(mockCreateTriggerNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alarm-test' }),
      expect.anything()
    );
  });

  it('displayImmediateNotification should display immediately with given data', async () => {
    mockDisplayNotification.mockResolvedValue('immediate-id');

    const id = await displayImmediateNotification('Title', 'Body', { foo: 'bar' });

    expect(id).toBe('immediate-id');
    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Title', body: 'Body', data: { foo: 'bar' } })
    );
  });

  it('scheduleSuccessNotification should display a success-type notification', async () => {
    await scheduleSuccessNotification('Success', 'Great job');

    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ data: { type: 'success' } })
    );
  });

  it('scheduleFailureNotification should display a failure-type notification', async () => {
    await scheduleFailureNotification('Failure', 'Missed it');

    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ data: { type: 'failure' } })
    );
  });

  it('setNotificationCategories should configure the alarm category with snooze/dismiss actions', async () => {
    await setNotificationCategories();

    expect(mockSetNotificationCategories).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'alarm',
        actions: [
          expect.objectContaining({ id: 'snooze' }),
          expect.objectContaining({ id: 'dismiss' }),
        ],
      }),
    ]);
  });
});

describe('notificationService (Android)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('@notifee/react-native', () => ({
      __esModule: true,
      default: {
        createChannel: (...args: unknown[]) => mockCreateChannel(...args),
        requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
        isBatteryOptimizationEnabled: (...args: unknown[]) =>
          mockIsBatteryOptimizationEnabled(...args),
        openBatteryOptimizationSettings: (...args: unknown[]) =>
          mockOpenBatteryOptimizationSettings(...args),
      },
      AndroidImportance: { HIGH: 4, DEFAULT: 3 },
      AndroidVisibility: { PUBLIC: 1 },
      AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    }));
    jest.clearAllMocks();
  });

  it('should create the Android channel and prompt to disable battery optimization when enabled', async () => {
    mockRequestPermission.mockResolvedValue({ authorizationStatus: 1 });
    mockIsBatteryOptimizationEnabled.mockResolvedValue(true);
    mockCreateChannel.mockResolvedValue('alarm-channel');

    const {
      requestNotificationPermissions: requestOnAndroid,
    } = require('../../services/notificationService');
    const result = await requestOnAndroid();

    expect(result).toBe(true);
    expect(mockCreateChannel).toHaveBeenCalled();
    expect(mockOpenBatteryOptimizationSettings).toHaveBeenCalled();
  });

  it('should skip the battery optimization prompt when already disabled', async () => {
    mockRequestPermission.mockResolvedValue({ authorizationStatus: 1 });
    mockIsBatteryOptimizationEnabled.mockResolvedValue(false);
    mockCreateChannel.mockResolvedValue('alarm-channel');

    const {
      requestNotificationPermissions: requestOnAndroid,
    } = require('../../services/notificationService');
    await requestOnAndroid();

    expect(mockOpenBatteryOptimizationSettings).not.toHaveBeenCalled();
  });
});
