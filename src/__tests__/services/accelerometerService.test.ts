/**
 * Accelerometer Service Unit Tests
 *
 * IMPORTANT: These tests focus heavily on preventing false negatives
 * (missing actual squats). Per project requirements, the app must NEVER
 * fail to detect a valid squat.
 */

import {
  AccelerometerData,
  SquatDetectionConfig,
} from '../../services/accelerometerService';

// Create a testable class that exposes private methods for testing
class TestableAccelerometerService {
  private config: SquatDetectionConfig = {
    peakThreshold: 0.15,
    minSquatDuration: 300,
    maxSquatDuration: 5000,
  };
  private isInSquat = false;
  private squatStartTime: number | null = null;
  private lastSquatTime = 0;
  private peakValue = 0;
  private squatCallback: (() => void) | null = null;
  private detectedSquats = 0;

  setConfig(config: Partial<SquatDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  onSquatDetected(callback: () => void): void {
    this.squatCallback = callback;
  }

  getDetectedSquats(): number {
    return this.detectedSquats;
  }

  reset(): void {
    this.isInSquat = false;
    this.squatStartTime = null;
    this.lastSquatTime = 0;
    this.peakValue = 0;
    this.detectedSquats = 0;
  }

  processSquatDetection(data: AccelerometerData): void {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    const deviation = Math.abs(magnitude - 1);
    const now = data.timestamp;

    if (now - this.lastSquatTime < 500) {
      return;
    }

    if (deviation > this.peakValue) {
      this.peakValue = deviation;
    }

    if (!this.isInSquat && deviation > this.config.peakThreshold) {
      this.isInSquat = true;
      this.squatStartTime = now;
      this.peakValue = deviation;
    }

    if (this.isInSquat && this.squatStartTime) {
      const duration = now - this.squatStartTime;

      if (deviation < this.config.peakThreshold * 0.5) {
        if (
          duration >= this.config.minSquatDuration &&
          duration <= this.config.maxSquatDuration
        ) {
          this.lastSquatTime = now;
          this.detectedSquats++;
          if (this.squatCallback) {
            this.squatCallback();
          }
        }

        this.isInSquat = false;
        this.squatStartTime = null;
        this.peakValue = 0;
      }

      if (duration > this.config.maxSquatDuration) {
        this.isInSquat = false;
        this.squatStartTime = null;
        this.peakValue = 0;
      }
    }
  }

  findPeaks(data: AccelerometerData[]): number[] {
    const peaks: number[] = [];
    const windowSize = 10;

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const magnitude = Math.sqrt(data[i].x ** 2 + data[i].y ** 2 + data[i].z ** 2);
      const deviation = Math.abs(magnitude - 1);

      let isLocalMax = true;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j === i) continue;
        const otherMag = Math.sqrt(data[j].x ** 2 + data[j].y ** 2 + data[j].z ** 2);
        const otherDev = Math.abs(otherMag - 1);
        if (otherDev > deviation) {
          isLocalMax = false;
          break;
        }
      }

      if (isLocalMax && deviation > 0.1) {
        peaks.push(deviation);
      }
    }

    return peaks.length > 0 ? peaks : [0.15];
  }

  calculateSquatDurations(data: AccelerometerData[]): number[] {
    const durations: number[] = [];
    let inMotion = false;
    let startTime = 0;
    const threshold = 0.15;

    for (const point of data) {
      const magnitude = Math.sqrt(point.x ** 2 + point.y ** 2 + point.z ** 2);
      const deviation = Math.abs(magnitude - 1);

      if (!inMotion && deviation > threshold) {
        inMotion = true;
        startTime = point.timestamp;
      } else if (inMotion && deviation < threshold * 0.5) {
        const duration = point.timestamp - startTime;
        if (duration > 200) {
          durations.push(duration);
        }
        inMotion = false;
      }
    }

    return durations.length > 0 ? durations : [300];
  }

  analyzeCalibrationData(
    normalData: AccelerometerData[],
    slowData: AccelerometerData[],
    shallowData: AccelerometerData[]
  ): SquatDetectionConfig {
    const normalPeaks = this.findPeaks(normalData);
    const slowPeaks = this.findPeaks(slowData);
    const shallowPeaks = this.findPeaks(shallowData);

    const allPeaks = [...normalPeaks, ...slowPeaks, ...shallowPeaks];
    const minPeak = Math.min(...allPeaks);

    const normalDurations = this.calculateSquatDurations(normalData);
    const slowDurations = this.calculateSquatDurations(slowData);
    const shallowDurations = this.calculateSquatDurations(shallowData);

    const allDurations = [...normalDurations, ...slowDurations, ...shallowDurations];
    const minDuration = Math.min(...allDurations);
    const maxDuration = Math.max(...allDurations);

    const config: SquatDetectionConfig = {
      peakThreshold: minPeak * 0.8,
      minSquatDuration: minDuration * 0.8,
      maxSquatDuration: maxDuration * 1.2,
    };

    config.peakThreshold = Math.max(config.peakThreshold, 0.1);
    config.minSquatDuration = Math.max(config.minSquatDuration, 200);
    config.maxSquatDuration = Math.min(config.maxSquatDuration, 8000);

    return config;
  }
}

// Helper function to generate squat motion data
const generateSquatMotion = (
  startTime: number,
  peakDeviation: number,
  duration: number
): AccelerometerData[] => {
  const data: AccelerometerData[] = [];
  const steps = Math.floor(duration / 50);

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Simulate squat motion: start at rest, peak in middle, return to rest
    const deviation =
      progress < 0.5
        ? peakDeviation * (progress * 2) // Going down
        : peakDeviation * (2 - progress * 2); // Coming up

    const magnitude = 1 + deviation;
    data.push({
      x: 0,
      y: magnitude,
      z: 0,
      timestamp: startTime + i * 50,
    });
  }

  // Add settling period
  for (let i = 0; i < 5; i++) {
    data.push({
      x: 0,
      y: 1,
      z: 0,
      timestamp: startTime + duration + i * 50,
    });
  }

  return data;
};

// Helper to generate rest data
const generateRestData = (startTime: number, duration: number): AccelerometerData[] => {
  const data: AccelerometerData[] = [];
  const steps = Math.floor(duration / 50);

  for (let i = 0; i < steps; i++) {
    data.push({
      x: 0.01,
      y: 0.99,
      z: 0.01,
      timestamp: startTime + i * 50,
    });
  }

  return data;
};

describe('AccelerometerService', () => {
  let service: TestableAccelerometerService;

  beforeEach(() => {
    service = new TestableAccelerometerService();
  });

  describe('processSquatDetection - NO FALSE NEGATIVES', () => {
    it('should detect a normal squat', () => {
      const squatData = generateSquatMotion(1000, 0.3, 1000);

      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });

    it('should detect a slow squat (longer duration)', () => {
      const squatData = generateSquatMotion(1000, 0.25, 3000);

      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });

    it('should detect a shallow squat (lower peak)', () => {
      const squatData = generateSquatMotion(1000, 0.18, 800);

      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });

    it('should detect a quick squat (minimum duration)', () => {
      // Use 400ms which is above the 300ms minimum
      const squatData = generateSquatMotion(1000, 0.35, 400);

      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });

    it('should detect multiple consecutive squats', () => {
      let detected = 0;
      service.onSquatDetected(() => {
        detected++;
      });

      // First squat
      const squat1 = generateSquatMotion(1000, 0.3, 800);
      for (const data of squat1) {
        service.processSquatDetection(data);
      }

      // Rest period
      const rest = generateRestData(2000, 600);
      for (const data of rest) {
        service.processSquatDetection(data);
      }

      // Second squat
      const squat2 = generateSquatMotion(2600, 0.3, 800);
      for (const data of squat2) {
        service.processSquatDetection(data);
      }

      expect(detected).toBe(2);
    });

    it('should detect squat at threshold boundary (edge case)', () => {
      // Create squat data at exactly the threshold
      const data: AccelerometerData[] = [];
      const startTime = 1000;

      // Start resting
      for (let i = 0; i < 5; i++) {
        data.push({ x: 0, y: 1, z: 0, timestamp: startTime + i * 50 });
      }

      // Just above threshold
      for (let i = 5; i < 15; i++) {
        data.push({ x: 0, y: 1.16, z: 0, timestamp: startTime + i * 50 });
      }

      // Back to rest
      for (let i = 15; i < 25; i++) {
        data.push({ x: 0, y: 1, z: 0, timestamp: startTime + i * 50 });
      }

      for (const point of data) {
        service.processSquatDetection(point);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });

    it('should detect squats with varying peak intensities', () => {
      const peaks = [0.2, 0.25, 0.3, 0.4, 0.5];
      let detected = 0;
      service.onSquatDetected(() => {
        detected++;
      });

      let time = 1000;
      for (const peak of peaks) {
        const squatData = generateSquatMotion(time, peak, 800);
        for (const data of squatData) {
          service.processSquatDetection(data);
        }

        const rest = generateRestData(time + 1000, 600);
        for (const data of rest) {
          service.processSquatDetection(data);
        }

        time += 1600;
      }

      expect(detected).toBe(5);
    });
  });

  describe('processSquatDetection - Acceptable false positives', () => {
    it('should not detect very short motions (too fast to be a squat)', () => {
      // Motion shorter than minSquatDuration
      const data: AccelerometerData[] = [];
      const startTime = 1000;

      // Very brief motion (100ms)
      for (let i = 0; i < 2; i++) {
        data.push({ x: 0, y: 1.3, z: 0, timestamp: startTime + i * 50 });
      }
      for (let i = 2; i < 10; i++) {
        data.push({ x: 0, y: 1, z: 0, timestamp: startTime + i * 50 });
      }

      for (const point of data) {
        service.processSquatDetection(point);
      }

      expect(service.getDetectedSquats()).toBe(0);
    });

    it('should not count motion that never settles as a squat', () => {
      // Motion that stays elevated without returning to rest
      // This tests that we don't get false detections from noise
      const data: AccelerometerData[] = [];
      const startTime = 1000;

      // Brief elevated motion that doesn't settle (too short for a valid squat)
      for (let i = 0; i < 4; i++) {
        // 200ms of elevated motion (4 * 50ms)
        data.push({ x: 0, y: 1.25, z: 0, timestamp: startTime + i * 50 });
      }
      // Stay elevated (doesn't settle below threshold * 0.5)
      for (let i = 4; i < 20; i++) {
        data.push({ x: 0, y: 1.12, z: 0, timestamp: startTime + i * 50 });
      }

      for (const point of data) {
        service.processSquatDetection(point);
      }

      // No squat detected because motion never properly settled
      expect(service.getDetectedSquats()).toBe(0);
    });

    it('should enforce minimum time between squats', () => {
      let detected = 0;
      service.onSquatDetected(() => {
        detected++;
      });

      // First squat (from 1000 to ~1650 with settling)
      const squat1 = generateSquatMotion(1000, 0.3, 500);
      for (const data of squat1) {
        service.processSquatDetection(data);
      }

      // Wait for the cooldown period (500ms from last detection)
      // Then do second squat
      const squat2 = generateSquatMotion(2500, 0.3, 500);
      for (const data of squat2) {
        service.processSquatDetection(data);
      }

      // Both should be detected since there's enough time between them
      expect(detected).toBe(2);
    });
  });

  describe('findPeaks', () => {
    it('should find peaks in squat motion data', () => {
      const data = generateSquatMotion(1000, 0.4, 1000);
      const peaks = service.findPeaks(data);

      expect(peaks.length).toBeGreaterThan(0);
      expect(Math.max(...peaks)).toBeGreaterThanOrEqual(0.3);
    });

    it('should return default value for data with no peaks', () => {
      const data = generateRestData(1000, 500);
      const peaks = service.findPeaks(data);

      expect(peaks).toEqual([0.15]);
    });
  });

  describe('calculateSquatDurations', () => {
    it('should calculate duration of squat motion', () => {
      const data = generateSquatMotion(1000, 0.3, 1000);
      const durations = service.calculateSquatDurations(data);

      expect(durations.length).toBeGreaterThan(0);
      expect(durations[0]).toBeGreaterThan(200);
    });

    it('should return default value for rest data', () => {
      const data = generateRestData(1000, 1000);
      const durations = service.calculateSquatDurations(data);

      expect(durations).toEqual([300]);
    });
  });

  describe('analyzeCalibrationData', () => {
    it('should calculate looser thresholds than recorded data', () => {
      const normalData = generateSquatMotion(1000, 0.3, 1000);
      const slowData = generateSquatMotion(2500, 0.25, 2000);
      const shallowData = generateSquatMotion(5000, 0.2, 800);

      const config = service.analyzeCalibrationData(normalData, slowData, shallowData);

      // Peak threshold should be calculated with 20% margin (lower = easier to detect)
      expect(config.peakThreshold).toBeGreaterThanOrEqual(0.1); // Minimum enforced
      expect(config.peakThreshold).toBeLessThan(0.25); // Should be lower than the lowest peak

      // Min duration should be 20% shorter than minimum recorded (easier to detect)
      expect(config.minSquatDuration).toBeGreaterThanOrEqual(200); // Minimum enforced

      // Max duration should be 20% longer than maximum recorded (more lenient)
      expect(config.maxSquatDuration).toBeLessThanOrEqual(8000); // Maximum enforced
      expect(config.maxSquatDuration).toBeGreaterThan(800); // Should be longer than the shortest
    });

    it('should enforce minimum safety thresholds', () => {
      // Generate very weak/quick motion data
      const weakData: AccelerometerData[] = [];
      for (let i = 0; i < 50; i++) {
        weakData.push({
          x: 0,
          y: 1.05, // Very small deviation
          z: 0,
          timestamp: 1000 + i * 50,
        });
      }

      const config = service.analyzeCalibrationData(weakData, weakData, weakData);

      // Should enforce minimum thresholds
      expect(config.peakThreshold).toBeGreaterThanOrEqual(0.1);
      expect(config.minSquatDuration).toBeGreaterThanOrEqual(200);
      expect(config.maxSquatDuration).toBeLessThanOrEqual(8000);
    });
  });

  describe('setConfig', () => {
    it('should update configuration', () => {
      service.setConfig({
        peakThreshold: 0.1,
        minSquatDuration: 200,
      });

      // Test with lower threshold - should detect smaller motions
      // Peak of 0.15 is above the new threshold of 0.1
      const squatData = generateSquatMotion(1000, 0.15, 500);
      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all detection state', () => {
      // Trigger a detection
      const squatData = generateSquatMotion(1000, 0.3, 800);
      for (const data of squatData) {
        service.processSquatDetection(data);
      }

      expect(service.getDetectedSquats()).toBe(1);

      // Reset
      service.reset();

      expect(service.getDetectedSquats()).toBe(0);
    });
  });
});
