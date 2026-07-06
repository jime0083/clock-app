type Listener = (data: { x: number; y: number; z: number }) => void;

const mockIsAvailableAsync = jest.fn();
const mockSetUpdateInterval = jest.fn();
const mockRemove = jest.fn();
let capturedListener: Listener | null = null;

const mockAddListener = jest.fn((cb: Listener) => {
  capturedListener = cb;
  return { remove: mockRemove };
});

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
    setUpdateInterval: (...args: unknown[]) => mockSetUpdateInterval(...args),
    addListener: (cb: Listener) => mockAddListener(cb),
  },
}));

import { accelerometerService, AccelerometerData } from '../../services/accelerometerService';

// Feed one data point and advance the fake clock by `stepMs`
const feed = (z: number, stepMs = 50) => {
  jest.advanceTimersByTime(stepMs);
  capturedListener?.({ x: 0, y: 0, z });
};

describe('accelerometerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListener = null;
    accelerometerService.reset();
    accelerometerService.stopListening();
  });

  describe('isAvailable', () => {
    it('should delegate to the native availability check', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);

      expect(await accelerometerService.isAvailable()).toBe(true);
    });
  });

  describe('startListening / stopListening', () => {
    it('should throw when the accelerometer is not available', async () => {
      mockIsAvailableAsync.mockResolvedValue(false);

      await expect(accelerometerService.startListening()).rejects.toThrow(
        'Accelerometer is not available on this device'
      );
    });

    it('should register a listener and report isListening=true', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);

      await accelerometerService.startListening();

      expect(mockSetUpdateInterval).toHaveBeenCalledWith(50);
      expect(mockAddListener).toHaveBeenCalled();
      expect(accelerometerService.getIsListening()).toBe(true);
    });

    it('should not register twice when already listening', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);

      await accelerometerService.startListening();
      await accelerometerService.startListening();

      expect(mockAddListener).toHaveBeenCalledTimes(1);
    });

    it('should forward each reading to the data callback', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const onData = jest.fn();

      await accelerometerService.startListening(onData);
      capturedListener?.({ x: 0.1, y: 0.2, z: 0.9 });

      expect(onData).toHaveBeenCalledWith(expect.objectContaining({ x: 0.1, y: 0.2, z: 0.9 }));
    });

    it('should remove the subscription and report isListening=false', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      await accelerometerService.startListening();

      accelerometerService.stopListening();

      expect(mockRemove).toHaveBeenCalled();
      expect(accelerometerService.getIsListening()).toBe(false);
    });
  });

  describe('squat detection via the real listener callback', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should detect a squat that stays above threshold for a valid duration', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const onSquat = jest.fn();
      await accelerometerService.startListening();
      accelerometerService.onSquatDetected(onSquat);

      feed(1.0, 0); // resting
      feed(1.3); // enters squat (deviation 0.3 > default 0.15 threshold)
      feed(1.3, 400); // stay in motion for a valid duration (>= 300ms)
      feed(1.0, 50); // settle back to rest (deviation < threshold * 0.5) -> detected

      expect(onSquat).toHaveBeenCalledTimes(1);
    });

    it('should NOT count a motion shorter than the minimum squat duration', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const onSquat = jest.fn();
      await accelerometerService.startListening();
      accelerometerService.onSquatDetected(onSquat);

      feed(1.0, 0);
      feed(1.3); // enters squat
      feed(1.0, 50); // settles almost immediately (well under 300ms) -> rejected

      expect(onSquat).not.toHaveBeenCalled();
    });

    it('should reset state when motion exceeds the maximum squat duration (timeout)', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const onSquat = jest.fn();
      await accelerometerService.startListening();
      accelerometerService.onSquatDetected(onSquat);

      feed(1.0, 0);
      feed(1.3); // enters squat
      feed(1.3, 6000); // exceeds default maxSquatDuration (5000ms) without settling
      feed(1.0, 50); // now settles, but state was already reset by the timeout

      expect(onSquat).not.toHaveBeenCalled();
    });

    it('should enforce the minimum time between two detected squats', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const onSquat = jest.fn();
      await accelerometerService.startListening();
      accelerometerService.onSquatDetected(onSquat);

      // First squat
      feed(1.0, 0);
      feed(1.3);
      feed(1.3, 400);
      feed(1.0, 50);
      expect(onSquat).toHaveBeenCalledTimes(1);

      // Immediately attempt a second squat within the 500ms cooldown
      feed(1.3, 50);
      feed(1.3, 400);
      feed(1.0, 50);

      expect(onSquat).toHaveBeenCalledTimes(1); // still just one - cooldown blocked it
    });
  });

  describe('setConfig', () => {
    it('should allow a looser threshold to catch smaller motions', async () => {
      jest.useFakeTimers();
      mockIsAvailableAsync.mockResolvedValue(true);
      const onSquat = jest.fn();
      await accelerometerService.startListening();
      accelerometerService.onSquatDetected(onSquat);
      accelerometerService.setConfig({ peakThreshold: 0.05 });

      feed(1.0, 0);
      feed(1.08); // deviation 0.08, above the loosened 0.05 threshold
      feed(1.08, 400);
      feed(1.0, 50);

      expect(onSquat).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  describe('calibration', () => {
    it('should collect accelerometer data while calibrating', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      await accelerometerService.startListening();

      accelerometerService.startCalibration();
      capturedListener?.({ x: 0, y: 1, z: 0 });
      capturedListener?.({ x: 0, y: 1.2, z: 0 });
      const data = accelerometerService.stopCalibration();

      expect(data.length).toBe(2);
    });

    it('should return looser thresholds than the recorded calibration data', () => {
      const makeData = (peak: number, duration: number): AccelerometerData[] => {
        const points: AccelerometerData[] = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          const progress = i / steps;
          const deviation = progress < 0.5 ? peak * (progress * 2) : peak * (2 - progress * 2);
          points.push({ x: 0, y: 1 + deviation, z: 0, timestamp: i * (duration / steps) });
        }
        return points;
      };

      const config = accelerometerService.analyzeCalibrationData(
        makeData(0.3, 1000),
        makeData(0.25, 2000),
        makeData(0.2, 800)
      );

      expect(config.peakThreshold).toBeGreaterThanOrEqual(0.1);
      expect(config.minSquatDuration).toBeGreaterThanOrEqual(200);
      expect(config.maxSquatDuration).toBeLessThanOrEqual(8000);
    });
  });

  describe('reset', () => {
    it('should clear detection state', () => {
      expect(() => accelerometerService.reset()).not.toThrow();
    });
  });
});
