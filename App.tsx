import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// i18n initialization
import './src/locales';
import { loadSavedLanguage, hasLanguageBeenSelected } from '@/locales';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors (e.g., if already hidden)
});

// Services
import { initializeOfflineService } from '@/services/offlineService';
import { getUserDocument } from '@/services/userService';
import { alarmService } from '@/services/alarmService';
import {
  initializeFCM,
  setForegroundMessageHandler,
  setNotificationOpenedHandler,
  getInitialNotification,
} from '@/services/fcmService';

// Contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

// Screens
import LoadingScreen from '@/screens/LoadingScreen';
import LanguageSelectionScreen from '@/screens/LanguageSelectionScreen';
import LoginScreen from '@/screens/LoginScreen';
import SetupScreen from '@/screens/SetupScreen';
import HomeScreen from '@/screens/HomeScreen';
import SquatMeasureScreen from '@/screens/SquatMeasureScreen';

export type RootStackParamList = {
  Loading: undefined;
  LanguageSelection: undefined;
  Login: undefined;
  Setup: undefined;
  Home: undefined;
  SquatMeasure: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// App initialization state
type AppInitState = 'loading' | 'language_selection' | 'ready';

const AppNavigator: React.FC = () => {
  const { isInitialized, isAuthenticated, isLoading, user } = useAuth();
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(false);
  const [appInitState, setAppInitState] = useState<AppInitState>('loading');
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const alarmInitializedRef = useRef(false);

  // Initialize app (check language selection)
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load saved language preference
        await loadSavedLanguage();

        // Check if language has been selected before
        const languageSelected = await hasLanguageBeenSelected();

        if (!languageSelected) {
          setAppInitState('language_selection');
        } else {
          setAppInitState('ready');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setAppInitState('ready');
      }
    };

    initializeApp();
  }, []);

  // Initialize alarm service and FCM when user is authenticated
  useEffect(() => {
    let foregroundUnsubscribe: (() => void) | null = null;
    let notificationOpenedUnsubscribe: (() => void) | null = null;

    const initAlarmAndFCM = async () => {
      if (!user?.uid || alarmInitializedRef.current) return;

      alarmInitializedRef.current = true;

      // Set callback for when alarm is triggered
      alarmService.setOnAlarmTriggered(() => {
        setIsAlarmRinging(true);
      });

      // Initialize alarm service
      await alarmService.initialize(user.uid);

      // Initialize FCM
      await initializeFCM(user.uid);

      // Handle foreground messages
      foregroundUnsubscribe = setForegroundMessageHandler(async (message) => {
        console.log('Foreground message:', message);
        if (message.data?.type === 'alarm') {
          // Trigger alarm sound and show squat screen
          await alarmService.triggerAlarmFromFCM();
          setIsAlarmRinging(true);
        }
      });

      // Handle notification opened (app in background)
      notificationOpenedUnsubscribe = setNotificationOpenedHandler(async (message) => {
        console.log('Notification opened:', message);
        if (message.data?.type === 'alarm') {
          // Trigger alarm sound and show squat screen
          await alarmService.triggerAlarmFromFCM();
          setIsAlarmRinging(true);
        }
      });

      // Check if app was opened from notification
      const initialNotification = await getInitialNotification();
      if (initialNotification?.data?.type === 'alarm') {
        // Trigger alarm sound and show squat screen
        await alarmService.triggerAlarmFromFCM();
        setIsAlarmRinging(true);
      }

      // Check if there's a pending alarm from notification launch
      if (alarmService.hasPendingAlarm()) {
        setIsAlarmRinging(true);
      }
    };

    if (isAuthenticated && user?.uid && isSetupCompleted) {
      initAlarmAndFCM();
    }

    return () => {
      if (foregroundUnsubscribe) foregroundUnsubscribe();
      if (notificationOpenedUnsubscribe) notificationOpenedUnsubscribe();
    };
  }, [isAuthenticated, user?.uid, isSetupCompleted]);

  // Handle squat measurement completion
  const handleSquatComplete = useCallback(async (success: boolean, squatCount: number) => {
    // Stop alarm
    await alarmService.stopAlarm();
    setIsAlarmRinging(false);

    // Clear pending alarm flag
    alarmService.clearPendingAlarm();
  }, []);

  // Handle squat screen close (without completing)
  const handleSquatClose = useCallback(async () => {
    await alarmService.stopAlarm();
    setIsAlarmRinging(false);
    alarmService.clearPendingAlarm();
  }, []);

  const handleLanguageSelectionComplete = useCallback(() => {
    setAppInitState('ready');
  }, []);

  const checkSetupStatus = useCallback(async () => {
    if (!user?.uid) {
      setIsSetupCompleted(null);
      return;
    }

    setIsCheckingSetup(true);
    try {
      const userData = await getUserDocument(user.uid);
      setIsSetupCompleted(userData?.settings?.setupCompleted ?? false);
    } catch (error) {
      console.error('Error checking setup status:', error);
      setIsSetupCompleted(false);
    } finally {
      setIsCheckingSetup(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      checkSetupStatus();
    } else {
      setIsSetupCompleted(null);
    }
  }, [isAuthenticated, user?.uid, checkSetupStatus]);

  const handleSetupComplete = useCallback(() => {
    setIsSetupCompleted(true);
  }, []);

  // Determine the actual screen to show
  const getScreenToShow = () => {
    if (appInitState === 'loading') {
      return 'loading';
    }
    if (appInitState === 'language_selection') {
      return 'language_selection';
    }
    if (!isInitialized || isLoading) {
      return 'loading';
    }
    if (!isAuthenticated) {
      return 'login';
    }
    // Still checking setup status - show loading
    if (isCheckingSetup || isSetupCompleted === null) {
      return 'loading';
    }
    if (!isSetupCompleted) {
      return 'setup';
    }
    return 'home';
  };

  const screenToShow = getScreenToShow();

  // Determine if we're ready to show content (not loading state)
  const isReadyToShowContent = screenToShow !== 'loading';

  // Show LoadingScreen during app initialization
  if (!isReadyToShowContent) {
    return <LoadingScreen />;
  }

  // Show language selection screen (first launch only)
  if (screenToShow === 'language_selection') {
    return <LanguageSelectionScreen onComplete={handleLanguageSelectionComplete} />;
  }

  // Not authenticated - show login
  if (screenToShow === 'login') {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated but setup not completed - show setup
  if (screenToShow === 'setup') {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  // If alarm is ringing, show squat measurement screen
  if (isAlarmRinging) {
    return (
      <SquatMeasureScreen
        onComplete={handleSquatComplete}
        onClose={handleSquatClose}
      />
    );
  }

  // Authenticated and setup completed - show home
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
};

// Wrapper component to show LoadingScreen while contexts initialize
const AppContent: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const splashHiddenRef = useRef(false);

  // Hide native splash when LoadingScreen is ready to be displayed
  useEffect(() => {
    const hideSplashAndPrepare = async () => {
      // Hide native splash screen to show LoadingScreen
      if (!splashHiddenRef.current) {
        splashHiddenRef.current = true;
        try {
          await SplashScreen.hideAsync();
        } catch {
          // Ignore errors
        }
      }
      // Small delay to ensure LoadingScreen is rendered
      setTimeout(() => setIsReady(true), 50);
    };
    hideSplashAndPrepare();
  }, []);

  // Show LoadingScreen immediately while contexts initialize
  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SubscriptionProvider>
    </AuthProvider>
  );
};

export default function App() {
  useEffect(() => {
    // Initialize offline service for network monitoring
    const unsubscribe = initializeOfflineService();
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
