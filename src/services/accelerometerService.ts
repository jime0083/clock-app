import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

// Accelerometer update interval in milliseconds
const UPDATE_INTERVAL = 50; // 20Hz sampling rate

// Types for squat detection
export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface CalibrationData {
  // Normal squat patterns
  normalSquatPeaks: number[];
  normalSquatDuration: number; // Average duration in ms

  // Slow squat patterns
  slowSquatPeaks: number[];
  slowSquatDuration: number;

  // Shallow squat patterns
  shallowSquatPeaks: number[];
  shallowSquatDuration: number;

  // Calculated thresholds (20% looser than recorded)
  peakThreshold: number;
  minSquatDuration: number;
  maxSquatDuration: number;
}

export interface SquatDetectionConfig {
  peakThreshold: number;
  minSquatDuration: number;
  maxSquatDuration: number;
}

// Default thresholds (very loose to avoid false negatives)
const DEFAULT_CONFIG: SquatDetectionConfig = {
  peakThreshold: 0.15, // Very low threshold to catch all squats
  minSquatDuration: 300, // Minimum 300ms for a squat
  maxSquatDuration: 5000, // Maximum 5 seconds for a squat
};

class AccelerometerService {
  private subscription: Subscription | null = null;
  private dataBuffer: AccelerometerData[] = [];
  private isListening = false;
  private dataCallback: ((data: AccelerometerData) => void) | null = null;

  // Squat detection state
  private config: SquatDetectionConfig = DEFAULT_CONFIG;
  private isInSquat = false;
  private squatStartTime: number | null = null;
  private lastSquatTime = 0;
  private peakValue = 0;
  private squatCallback: (() => void) | null = null;

  // Calibration state
  private isCalibrating = false;
  private calibrationData: AccelerometerData[] = [];
  private calibrationCallback: ((data: AccelerometerData[]) => void) | null = null;

  /**
   * Check if accelerometer is available on the device
   */
  async isAvailable(): Promise<boolean> {
    return Accelerometer.isAvailableAsync();
  }

  /**
   * Start listening to accelerometer data
   */
  async startListening(callback?: (data: AccelerometerData) => void): Promise<void> {
    if (this.isListening) {
      return;
    }

    const available = await this.isAvailable();
    if (!available) {
      throw new Error('Accelerometer is not available on this device');
    }

    this.dataCallback = callback || null;

    // Set update interval
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL);

    this.subscription = Accelerometer.addListener((measurement: AccelerometerMeasurement) => {
      const data: AccelerometerData = {
        x: measurement.x,
        y: measurement.y,
        z: measurement.z,
        timestamp: Date.now(),
      };

      // Store in buffer (keep last 2 seconds of data)
      this.dataBuffer.push(data);
      const bufferTimeLimit = Date.now() - 2000;
      this.dataBuffer = this.dataBuffer.filter(d => d.timestamp > bufferTimeLimit);

      // Callback for real-time data
      if (this.dataCallback) {
        this.dataCallback(data);
      }

      // Store calibration data if calibrating
      if (this.isCalibrating) {
        this.calibrationData.push(data);
      }

      // Process for squat detection
      this.processSquatDetection(data);
    });

    this.isListening = true;
  }

  /**
   * Stop listening to accelerometer data
   */
  stopListening(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isListening = false;
    this.dataCallback = null;
    this.dataBuffer = [];
  }

  /**
   * Configure squat detection thresholds
   */
  setConfig(config: Partial<SquatDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set callback for squat detection
   */
  onSquatDetected(callback: () => void): void {
    this.squatCallback = callback;
  }

  /**
   * Start calibration mode
   */
  startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationData = [];
  }

  /**
   * Stop calibration and return collected data
   */
  stopCalibration(): AccelerometerData[] {
    this.isCalibrating = false;
    const data = [...this.calibrationData];
    this.calibrationData = [];
    return data;
  }

  /**
   * Process accelerometer data for squat detection
   * IMPORTANT: This algorithm is designed to NEVER miss a squat (no false negatives)
   * It may occasionally detect false positives, which is acceptable per requirements
   */
  private processSquatDetection(data: AccelerometerData): void {
    // Calculate the magnitude of acceleration change
    // When squatting, the vertical (Y when phone held in front) acceleration changes
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // Detect deviation from gravity (1g ≈ 9.8 m/s², normalized to ~1 in expo-sensors)
    const deviation = Math.abs(magnitude - 1);

    const now = Date.now();

    // Prevent detecting the same squat twice (minimum 500ms between squats)
    if (now - this.lastSquatTime < 500) {
      return;
    }

    // Track peak during potential squat
    if (deviation > this.peakValue) {
      this.peakValue = deviation;
    }

    // Check if we're entering a squat motion
    if (!this.isInSquat && deviation > this.config.peakThreshold) {
      this.isInSquat = true;
      this.squatStartTime = now;
      this.peakValue = deviation;
    }

    // Check if squat motion is complete
    if (this.isInSquat && this.squatStartTime) {
      const duration = now - this.squatStartTime;

      // Motion has settled (deviation returned to low)
      if (deviation < this.config.peakThreshold * 0.5) {
        // Validate squat duration
        if (duration >= this.config.minSquatDuration &&
            duration <= this.config.maxSquatDuration) {
          // SQUAT DETECTED!
          this.lastSquatTime = now;
          if (this.squatCallback) {
            this.squatCallback();
          }
        }

        // Reset state
        this.isInSquat = false;
        this.squatStartTime = null;
        this.peakValue = 0;
      }

      // Timeout - motion too long, reset
      if (duration > this.config.maxSquatDuration) {
        this.isInSquat = false;
        this.squatStartTime = null;
        this.peakValue = 0;
      }
    }
  }

  /**
   * Analyze calibration data and calculate thresholds
   * Returns config that is 20% LOOSER than recorded data to avoid false negatives
   */
  analyzeCalibrationData(
    normalData: AccelerometerData[],
    slowData: AccelerometerData[],
    shallowData: AccelerometerData[]
  ): SquatDetectionConfig {
    // Calculate peaks from each dataset
    const normalPeaks = this.findPeaks(normalData);
    const slowPeaks = this.findPeaks(slowData);
    const shallowPeaks = this.findPeaks(shallowData);

    // Find minimum peak value across all squat types
    const allPeaks = [...normalPeaks, ...slowPeaks, ...shallowPeaks];
    const minPeak = Math.min(...allPeaks);

    // Calculate durations
    const normalDurations = this.calculateSquatDurations(normalData);
    const slowDurations = this.calculateSquatDurations(slowData);
    const shallowDurations = this.calculateSquatDurations(shallowData);

    const allDurations = [...normalDurations, ...slowDurations, ...shallowDurations];
    const minDuration = Math.min(...allDurations);
    const maxDuration = Math.max(...allDurations);

    // Apply 20% LOOSER thresholds to avoid false negatives
    // Lower peak threshold = easier to detect
    // Shorter min duration = easier to detect
    // Longer max duration = easier to detect
    const config: SquatDetectionConfig = {
      peakThreshold: minPeak * 0.8, // 20% lower threshold
      minSquatDuration: minDuration * 0.8, // 20% shorter minimum
      maxSquatDuration: maxDuration * 1.2, // 20% longer maximum
    };

    // Ensure minimum thresholds for sanity
    config.peakThreshold = Math.max(config.peakThreshold, 0.1);
    config.minSquatDuration = Math.max(config.minSquatDuration, 200);
    config.maxSquatDuration = Math.min(config.maxSquatDuration, 8000);

    return config;
  }

  /**
   * Find peak acceleration values in data
   */
  private findPeaks(data: AccelerometerData[]): number[] {
    const peaks: number[] = [];
    const windowSize = 10;

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const magnitude = Math.sqrt(data[i].x ** 2 + data[i].y ** 2 + data[i].z ** 2);
      const deviation = Math.abs(magnitude - 1);

      // Check if this is a local maximum
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

    return peaks.length > 0 ? peaks : [DEFAULT_CONFIG.peakThreshold];
  }

  /**
   * Calculate squat durations from data
   */
  private calculateSquatDurations(data: AccelerometerData[]): number[] {
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

    return durations.length > 0 ? durations : [DEFAULT_CONFIG.minSquatDuration];
  }

  /**
   * Reset detection state
   */
  reset(): void {
    this.isInSquat = false;
    this.squatStartTime = null;
    this.lastSquatTime = 0;
    this.peakValue = 0;
    this.dataBuffer = [];
  }

  /**
   * Get current listening state
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}

// Export singleton instance
export const accelerometerService = new AccelerometerService();
