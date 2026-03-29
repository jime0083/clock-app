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

// Contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

// Screens
import LoadingScreen from '@/screens/LoadingScreen';
import LanguageSelectionScreen from '@/screens/LanguageSelectionScreen';
import LoginScreen from '@/screens/LoginScreen';
import SetupScreen from '@/screens/SetupScreen';
import HomeScreen from '@/screens/HomeScreen';

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
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  const splashHiddenRef = useRef(false);

  // Hide splash screen helper
  const hideSplashScreen = useCallback(async () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    try {
      await SplashScreen.hideAsync();
      setIsSplashHidden(true);
    } catch (error) {
      // Ignore errors
      setIsSplashHidden(true);
    }
  }, []);

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
    if (!isInitialized || isLoading || (isAuthenticated && isCheckingSetup)) {
      return 'loading';
    }
    if (!isAuthenticated) {
      return 'login';
    }
    if (!isSetupCompleted) {
      return 'setup';
    }
    return 'home';
  };

  const screenToShow = getScreenToShow();

  // Determine if we're ready to show content (not loading state)
  const isReadyToShowContent = screenToShow !== 'loading';

  // Hide splash screen when we know what to show (not loading)
  useEffect(() => {
    if (isReadyToShowContent && !splashHiddenRef.current) {
      // Small delay to ensure the target screen is ready
      const timer = setTimeout(() => {
        hideSplashScreen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isReadyToShowContent, hideSplashScreen]);

  // Show loading screen during app initialization
  // Keep showing LoadingScreen until splash is hidden to prevent white flash
  if (!isReadyToShowContent || !isSplashHidden) {
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

export default function App() {
  useEffect(() => {
    // Initialize offline service for network monitoring
    const unsubscribe = initializeOfflineService();
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </SubscriptionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
