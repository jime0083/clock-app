/**
 * AlarmKit JS ブリッジのテスト（Problem 56 / Phase 26.18）
 */

const mockNative = {
  isAvailable: jest.fn(() => true),
  getAuthorizationState: jest.fn(() => 'authorized'),
  requestAuthorization: jest.fn(async () => 'authorized'),
  scheduleAlarm: jest.fn(),
  cancelAlarm: jest.fn(),
  cancelAllAlarms: jest.fn(() => 0),
  getAlarms: jest.fn(() => []),
  consumeStopEvents: jest.fn(() => []),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

const mockRequireOptionalNativeModule = jest.fn();

jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => mockRequireOptionalNativeModule(name),
}));

type Bridge = typeof import('../index');

const loadBridge = (os: 'ios' | 'android', native: typeof mockNative | null): Bridge => {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  mockRequireOptionalNativeModule.mockReturnValue(native);

  return require('../index');
};

describe('alarm-kit bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNative.isAvailable.mockReturnValue(true);
  });

  describe('when the native module is missing (Android / iOS without rebuild)', () => {
    it.each(['android', 'ios'] as const)('falls back safely on %s', async os => {
      const bridge = loadBridge(os, null);
      expect(bridge.isAlarmKitAvailable()).toBe(false);
      expect(bridge.getAuthorizationState()).toBe('unsupported');
      await expect(bridge.requestAuthorization()).resolves.toBe('unsupported');
      expect(bridge.getAlarms()).toEqual([]);
      expect(bridge.consumeStopEvents()).toEqual([]);
      expect(bridge.addAlarmStopListener(jest.fn())).toBeNull();
      expect(() => bridge.cancelAllAlarms()).toThrow('iOS 26.0+');
    });

    it('does not load the native module on Android', () => {
      loadBridge('android', mockNative);
      expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled();
    });
  });

  describe('when iOS is older than 26', () => {
    it('rejects scheduling', () => {
      mockNative.isAvailable.mockReturnValue(false);
      const bridge = loadBridge('ios', mockNative);
      expect(bridge.isAlarmKitAvailable()).toBe(false);
      expect(() => bridge.scheduleAlarm({ epochMillis: Date.now() + 60_000, title: 't' })).toThrow(
        'iOS 26.0+'
      );
      expect(mockNative.scheduleAlarm).not.toHaveBeenCalled();
    });
  });

  describe('scheduleAlarmWithBackups', () => {
    const base = { epochMillis: 1_000_000, title: 'オキロヤ', soundName: 'alarm.caf' };

    it('schedules the main alarm and backups at the given interval', async () => {
      const bridge = loadBridge('ios', mockNative);
      mockNative.scheduleAlarm
        .mockResolvedValueOnce('id-0')
        .mockResolvedValueOnce('id-1')
        .mockResolvedValueOnce('id-2')
        .mockResolvedValueOnce('id-3');

      const ids = await bridge.scheduleAlarmWithBackups(base, 3, 60);

      expect(ids).toEqual(['id-0', 'id-1', 'id-2', 'id-3']);
      expect(mockNative.scheduleAlarm.mock.calls.map(([o]) => o.epochMillis)).toEqual([
        1_000_000, 1_060_000, 1_120_000, 1_180_000,
      ]);
      expect(mockNative.scheduleAlarm).toHaveBeenCalledWith({ ...base, epochMillis: 1_000_000 });
    });

    it('schedules only the main alarm when backupCount is 0', async () => {
      const bridge = loadBridge('ios', mockNative);
      mockNative.scheduleAlarm.mockResolvedValueOnce('id-0');
      await expect(bridge.scheduleAlarmWithBackups(base, 0, 60)).resolves.toEqual(['id-0']);
    });

    it('cancels already scheduled alarms and rethrows when one fails', async () => {
      const bridge = loadBridge('ios', mockNative);
      const failure = new Error('maximumLimitReached');
      mockNative.scheduleAlarm
        .mockResolvedValueOnce('id-0')
        .mockResolvedValueOnce('id-1')
        .mockRejectedValueOnce(failure);
      mockNative.cancelAlarm.mockImplementationOnce(() => {
        throw new Error('cancel failed');
      });

      await expect(bridge.scheduleAlarmWithBackups(base, 3, 60)).rejects.toBe(failure);
      expect(mockNative.cancelAlarm.mock.calls).toEqual([['id-0'], ['id-1']]);
    });

    it.each([
      [-1, 60, 'backupCount'],
      [1.5, 60, 'backupCount'],
      [3, 0, 'intervalSeconds'],
      [3, Number.NaN, 'intervalSeconds'],
    ])('rejects invalid input (backupCount=%p, interval=%p)', async (count, interval, message) => {
      const bridge = loadBridge('ios', mockNative);
      await expect(bridge.scheduleAlarmWithBackups(base, count, interval)).rejects.toThrow(message);
      expect(mockNative.scheduleAlarm).not.toHaveBeenCalled();
    });
  });

  it('forwards stop events from the native module', () => {
    const bridge = loadBridge('ios', mockNative);
    const events = [{ alarmId: 'a', stoppedAt: 1 }];
    mockNative.consumeStopEvents.mockReturnValueOnce(events as never);
    expect(bridge.consumeStopEvents()).toEqual(events);

    const listener = jest.fn();
    bridge.addAlarmStopListener(listener);
    expect(mockNative.addListener).toHaveBeenCalledWith('onAlarmStopped', listener);
  });
});
