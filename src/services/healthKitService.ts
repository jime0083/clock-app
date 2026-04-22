import {
  isHealthDataAvailable,
  requestAuthorization,
  saveWorkoutSample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

class HealthKitService {
  private isInitialized = false;
  private isAvailable = false;

  /**
   * Check if HealthKit is available on this device
   * HealthKit is only available on iOS
   */
  async checkAvailability(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      const available = await isHealthDataAvailable();
      this.isAvailable = available;
      return available;
    } catch (error) {
      console.error('[HealthKit] Error checking availability:', error);
      return false;
    }
  }

  /**
   * Initialize HealthKit and request permissions
   * @returns Promise<boolean> - true if initialization succeeded
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('[HealthKit] Not available on this platform');
      return false;
    }

    if (this.isInitialized) {
      console.log('[HealthKit] Already initialized');
      return true;
    }

    try {
      console.log('[HealthKit] Starting initialization...');

      // Check if HealthKit is available
      const available = await isHealthDataAvailable();
      if (!available) {
        console.log('[HealthKit] HealthKit is not available on this device');
        return false;
      }

      // Request authorization for workout data
      await requestAuthorization({
        toShare: ['HKWorkoutTypeIdentifier'],
        toRead: ['HKWorkoutTypeIdentifier'],
      });

      console.log('[HealthKit] Successfully initialized and authorized');
      this.isInitialized = true;
      this.isAvailable = true;
      return true;
    } catch (error) {
      console.error('[HealthKit] Error initializing:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if HealthKit is initialized and available
   */
  isReady(): boolean {
    return Platform.OS === 'ios' && this.isInitialized && this.isAvailable;
  }

  /**
   * Save a squat workout to HealthKit
   * @param startDate - Workout start time
   * @param endDate - Workout end time
   * @param squatCount - Number of squats completed
   * @returns Promise<boolean> - true if save succeeded
   */
  async saveSquatWorkout(
    startDate: Date,
    endDate: Date,
    squatCount: number
  ): Promise<boolean> {
    if (!this.isReady()) {
      console.log('[HealthKit] Not ready, attempting to initialize...');
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('[HealthKit] Failed to initialize, skipping workout save');
        return false;
      }
    }

    try {
      // Calculate duration in minutes
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

      // Save workout using the new API
      // WorkoutActivityType.functionalStrengthTraining = 20
      const result = await saveWorkoutSample(
        WorkoutActivityType.functionalStrengthTraining,
        [], // No additional quantity samples
        startDate,
        endDate,
        undefined, // No totals
        {
          HKMetadataKeyExternalUUID: `okiroya-squat-${Date.now()}`,
        }
      );

      console.log('[HealthKit] Successfully saved squat workout:', {
        squatCount,
        durationMinutes,
        workoutId: result?.uuid,
      });
      return true;
    } catch (error) {
      console.error('[HealthKit] Error saving workout:', error);
      return false;
    }
  }
}

// Export singleton instance
export const healthKitService = new HealthKitService();
