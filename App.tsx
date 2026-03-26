import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// i18n initialization
import './src/locales';

// Services
import { initializeOfflineService } from '@/services/offlineService';
import { getUserDocument } from '@/services/userService';

// Contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

// Screens
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
import SetupScreen from '@/screens/SetupScreen';
import HomeScreen from '@/screens/HomeScreen';

export type RootStackParamList = {
  Loading: undefined;
  Login: undefined;
  Setup: undefined;
  Home: undefined;
  SquatMeasure: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isInitialized, isAuthenticated, isLoading, user } = useAuth();
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(false);

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

  // Show loading screen while initializing
  if (!isInitialized || isLoading || (isAuthenticated && isCheckingSetup)) {
    return <LoadingScreen />;
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
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
  if (!isSetupCompleted) {
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
