import { useState, useEffect, useCallback, useRef } from 'react';
import {
  accelerometerService,
  AccelerometerData,
  SquatDetectionConfig,
} from '@/services/accelerometerService';

interface UseAccelerometerResult {
  isAvailable: boolean;
  isListening: boolean;
  currentData: AccelerometerData | null;
  squatCount: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetSquatCount: () => void;
  setConfig: (config: Partial<SquatDetectionConfig>) => void;
}

export const useAccelerometer = (): UseAccelerometerResult => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentData, setCurrentData] = useState<AccelerometerData | null>(null);
  const [squatCount, setSquatCount] = useState(0);
  const squatCountRef = useRef(0);

  // Check availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await accelerometerService.isAvailable();
      setIsAvailable(available);
    };
    checkAvailability();
  }, []);

  // Set up squat detection callback
  useEffect(() => {
    accelerometerService.onSquatDetected(() => {
      squatCountRef.current += 1;
      setSquatCount(squatCountRef.current);
    });

    return () => {
      accelerometerService.stopListening();
    };
  }, []);

  const startListening = useCallback(async () => {
    try {
      await accelerometerService.startListening((data) => {
        setCurrentData(data);
      });
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start accelerometer:', error);
      throw error;
    }
  }, []);

  const stopListening = useCallback(() => {
    accelerometerService.stopListening();
    setIsListening(false);
  }, []);

  const resetSquatCount = useCallback(() => {
    squatCountRef.current = 0;
    setSquatCount(0);
    accelerometerService.reset();
  }, []);

  const setConfig = useCallback((config: Partial<SquatDetectionConfig>) => {
    accelerometerService.setConfig(config);
  }, []);

  return {
    isAvailable,
    isListening,
    currentData,
    squatCount,
    startListening,
    stopListening,
    resetSquatCount,
    setConfig,
  };
};

interface UseCalibrationResult {
  isCalibrating: boolean;
  calibrationPhase: 'idle' | 'normal' | 'slow' | 'shallow' | 'complete';
  phaseProgress: number;
  targetCount: number;
  currentCount: number;
  startCalibration: () => Promise<void>;
  recordSquat: () => void;
  nextPhase: () => void;
  getCalibrationConfig: () => SquatDetectionConfig | null;
  resetCalibration: () => void;
}

export const useCalibration = (): UseCalibrationResult => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPhase, setCalibrationPhase] = useState<
    'idle' | 'normal' | 'slow' | 'shallow' | 'complete'
  >('idle');
  const [currentCount, setCurrentCount] = useState(0);

  // Data storage for each phase
  const normalDataRef = useRef<AccelerometerData[]>([]);
  const slowDataRef = useRef<AccelerometerData[]>([]);
  const shallowDataRef = useRef<AccelerometerData[]>([]);
  const configRef = useRef<SquatDetectionConfig | null>(null);

  // Target counts for each phase
  const targetCounts = {
    idle: 0,
    normal: 5,
    slow: 3,
    shallow: 3,
    complete: 0,
  };

  const phaseProgress = calibrationPhase === 'idle' || calibrationPhase === 'complete'
    ? 0
    : (currentCount / targetCounts[calibrationPhase]) * 100;

  const startCalibration = useCallback(async () => {
    // Start accelerometer
    await accelerometerService.startListening();

    // Reset state
    normalDataRef.current = [];
    slowDataRef.current = [];
    shallowDataRef.current = [];
    configRef.current = null;

    setIsCalibrating(true);
    setCalibrationPhase('normal');
    setCurrentCount(0);

    // Start recording
    accelerometerService.startCalibration();
  }, []);

  const recordSquat = useCallback(() => {
    const newCount = currentCount + 1;
    setCurrentCount(newCount);

    // Check if phase is complete
    if (newCount >= targetCounts[calibrationPhase]) {
      // Save data for this phase
      const data = accelerometerService.stopCalibration();

      if (calibrationPhase === 'normal') {
        normalDataRef.current = data;
      } else if (calibrationPhase === 'slow') {
        slowDataRef.current = data;
      } else if (calibrationPhase === 'shallow') {
        shallowDataRef.current = data;
      }
    }
  }, [currentCount, calibrationPhase]);

  const nextPhase = useCallback(() => {
    if (calibrationPhase === 'normal') {
      setCalibrationPhase('slow');
      setCurrentCount(0);
      accelerometerService.startCalibration();
    } else if (calibrationPhase === 'slow') {
      setCalibrationPhase('shallow');
      setCurrentCount(0);
      accelerometerService.startCalibration();
    } else if (calibrationPhase === 'shallow') {
      // Calculate final config
      const config = accelerometerService.analyzeCalibrationData(
        normalDataRef.current,
        slowDataRef.current,
        shallowDataRef.current
      );
      configRef.current = config;

      // Apply config
      accelerometerService.setConfig(config);

      setCalibrationPhase('complete');
      setIsCalibrating(false);
      accelerometerService.stopListening();
    }
  }, [calibrationPhase]);

  const getCalibrationConfig = useCallback((): SquatDetectionConfig | null => {
    return configRef.current;
  }, []);

  const resetCalibration = useCallback(() => {
    setIsCalibrating(false);
    setCalibrationPhase('idle');
    setCurrentCount(0);
    normalDataRef.current = [];
    slowDataRef.current = [];
    shallowDataRef.current = [];
    configRef.current = null;
    accelerometerService.stopListening();
  }, []);

  return {
    isCalibrating,
    calibrationPhase,
    phaseProgress,
    targetCount: targetCounts[calibrationPhase],
    currentCount,
    startCalibration,
    recordSquat,
    nextPhase,
    getCalibrationConfig,
    resetCalibration,
  };
};
