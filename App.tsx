import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// i18n initialization
import './src/locales';

// Contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

// Screens
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
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
  const { isInitialized, isAuthenticated, isLoading } = useAuth();

  // Show loading screen while initializing
  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {!isAuthenticated ? (
        // Not authenticated - show login
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // Authenticated - show main app
        <Stack.Screen name="Home" component={HomeScreen} />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
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
