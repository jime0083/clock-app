const mockIsHealthDataAvailable = jest.fn();
const mockRequestAuthorization = jest.fn();
const mockSaveWorkoutSample = jest.fn();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: (...args: unknown[]) => mockIsHealthDataAvailable(...args),
  requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
  saveWorkoutSample: (...args: unknown[]) => mockSaveWorkoutSample(...args),
  WorkoutActivityType: { functionalStrengthTraining: 20 },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { healthKitService } from '../../services/healthKitService';

describe('healthKitService (iOS)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should return true when HealthKit reports available', async () => {
      mockIsHealthDataAvailable.mockResolvedValue(true);

      expect(await healthKitService.checkAvailability()).toBe(true);
    });

    it('should return false when the availability check throws', async () => {
      mockIsHealthDataAvailable.mockRejectedValue(new Error('native error'));

      expect(await healthKitService.checkAvailability()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should request authorization and succeed when available', async () => {
      mockIsHealthDataAvailable.mockResolvedValue(true);
      mockRequestAuthorization.mockResolvedValue(undefined);

      const result = await healthKitService.initialize();

      expect(result).toBe(true);
      expect(mockRequestAuthorization).toHaveBeenCalledWith({
        toShare: ['HKWorkoutTypeIdentifier'],
        toRead: ['HKWorkoutTypeIdentifier'],
      });
      expect(healthKitService.isReady()).toBe(true);
    });

    it('should return true immediately if already initialized (no repeat authorization request)', async () => {
      const result = await healthKitService.initialize();

      expect(result).toBe(true);
      expect(mockRequestAuthorization).not.toHaveBeenCalled();
    });
  });

  describe('saveSquatWorkout', () => {
    it('should save the workout when already initialized', async () => {
      mockSaveWorkoutSample.mockResolvedValue({ uuid: 'workout-1' });

      const result = await healthKitService.saveSquatWorkout(
        new Date('2026-07-06T09:00:00Z'),
        new Date('2026-07-06T09:05:00Z'),
        10
      );

      expect(result).toBe(true);
      expect(mockSaveWorkoutSample).toHaveBeenCalledWith(
        20,
        [],
        expect.any(Date),
        expect.any(Date),
        undefined,
        expect.objectContaining({ HKMetadataKeyExternalUUID: expect.any(String) })
      );
    });

    it('should return false when saving throws', async () => {
      mockSaveWorkoutSample.mockRejectedValue(new Error('save error'));

      const result = await healthKitService.saveSquatWorkout(new Date(), new Date(), 10);

      expect(result).toBe(false);
    });
  });
});

describe('healthKitService (non-iOS platforms)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('@kingstinct/react-native-healthkit', () => ({
      isHealthDataAvailable: (...args: unknown[]) => mockIsHealthDataAvailable(...args),
      requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
      saveWorkoutSample: (...args: unknown[]) => mockSaveWorkoutSample(...args),
      WorkoutActivityType: { functionalStrengthTraining: 20 },
    }));
    jest.clearAllMocks();
  });

  it('should report unavailable on checkAvailability without calling the native API', async () => {
    const { healthKitService: androidService } = require('../../services/healthKitService');

    expect(await androidService.checkAvailability()).toBe(false);
    expect(mockIsHealthDataAvailable).not.toHaveBeenCalled();
  });

  it('should fail to initialize without calling the native API', async () => {
    const { healthKitService: androidService } = require('../../services/healthKitService');

    expect(await androidService.initialize()).toBe(false);
    expect(mockRequestAuthorization).not.toHaveBeenCalled();
  });

  it('should skip saving the workout (not ready, cannot initialize)', async () => {
    const { healthKitService: androidService } = require('../../services/healthKitService');

    const result = await androidService.saveSquatWorkout(new Date(), new Date(), 10);

    expect(result).toBe(false);
    expect(mockSaveWorkoutSample).not.toHaveBeenCalled();
  });
});
