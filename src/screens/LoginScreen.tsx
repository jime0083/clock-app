import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';

const { width } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const { setUser } = useAuth();

  const handleAuthSuccess = (user: AppUser) => {
    setUser(user);
  };

  const handleAuthError = (error: string) => {
    console.error('Auth error:', error);
  };

  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth(
    handleAuthSuccess,
    handleAuthError
  );

  const {
    signIn: signInWithApple,
    isLoading: isAppleLoading,
    isAvailable: isAppleAvailable,
  } = useAppleAuth(handleAuthSuccess, handleAuthError);

  const isLoading = isGoogleLoading || isAppleLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animation Section */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('@assets/animations/Alarm Clock.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>

        {/* Tagline Section */}
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>{t('auth.tagline1')}</Text>
          <Text style={styles.tagline}>{t('auth.tagline2')}</Text>
          <Text style={styles.taglineAccent}>{t('auth.tagline3')}</Text>
        </View>

        {/* Login Buttons */}
        <View style={styles.buttonContainer}>
          {/* Google Login Button */}
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={signInWithGoogle}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{t('auth.loginWithGoogle')}</Text>
          </TouchableOpacity>

          {/* Apple Login Button */}
          {isAppleAvailable && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={signInWithApple}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, styles.appleButtonText]}>
                {t('auth.loginWithApple')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: width * 0.7,
    marginBottom: 24,
  },
  animation: {
    width: width * 0.8,
    height: width * 0.8,
  },
  taglineContainer: {
    alignItems: 'flex-start',
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  taglineAccent: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: Colors.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  googleButton: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
  },
  appleButton: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  appleButtonText: {
    color: Colors.textInverse,
  },
});

export default LoginScreen;
