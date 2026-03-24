import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaywallScreenProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const PaywallScreen: React.FC<PaywallScreenProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { offerings, purchase, restore, isLoading: contextLoading } = useSubscription();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Animation values
  const crownScale = useSharedValue(1);

  useEffect(() => {
    // Subtle crown pulse animation
    crownScale.value = withRepeat(
      withSequence(
        withSpring(1.05, { damping: 10 }),
        withSpring(1, { damping: 10 })
      ),
      -1,
      true
    );
  }, []);

  const crownAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: crownScale.value }],
  }));

  // Get packages from offerings
  const monthlyPackage = offerings?.availablePackages.find(
    (pkg) => pkg.packageType === 'MONTHLY'
  );
  const annualPackage = offerings?.availablePackages.find(
    (pkg) => pkg.packageType === 'ANNUAL'
  );

  // Set default selection to annual (better value)
  useEffect(() => {
    if (annualPackage && !selectedPackage) {
      setSelectedPackage(annualPackage);
    } else if (monthlyPackage && !selectedPackage) {
      setSelectedPackage(monthlyPackage);
    }
  }, [offerings]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    try {
      const success = await purchase(selectedPackage);
      if (success) {
        Alert.alert(
          t('paywall.successTitle'),
          t('paywall.successMessage'),
          [{ text: 'OK', onPress: () => onSuccess?.() || onClose() }]
        );
      }
    } catch (error) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert(
          t('paywall.restoreSuccessTitle'),
          t('paywall.restoreSuccessMessage'),
          [{ text: 'OK', onPress: () => onSuccess?.() || onClose() }]
        );
      } else {
        Alert.alert(t('paywall.restoreFailTitle'), t('paywall.restoreFailMessage'));
      }
    } catch (error) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorMessage'));
    } finally {
      setIsRestoring(false);
    }
  };

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const calculateSavings = (): string => {
    if (!monthlyPackage || !annualPackage) return '';
    const monthlyPrice = monthlyPackage.product.price;
    const annualPrice = annualPackage.product.price;
    const yearlyIfMonthly = monthlyPrice * 12;
    const savings = Math.round(((yearlyIfMonthly - annualPrice) / yearlyIfMonthly) * 100);
    return `${savings}%`;
  };

  if (contextLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#1A1A2E', '#16213E', '#0F3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFFFFF80" />
        </TouchableOpacity>

        {/* Header Section */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.headerSection}
        >
          <Animated.View style={[styles.crownContainer, crownAnimatedStyle]}>
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              style={styles.crownGradient}
            >
              <Ionicons name="diamond" size={40} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.title}>{t('paywall.title')}</Text>
          <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
        </Animated.View>

        {/* Features List */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          style={styles.featuresContainer}
        >
          <FeatureItem icon="alarm" text={t('paywall.feature1')} delay={300} />
          <FeatureItem icon="fitness" text={t('paywall.feature2')} delay={400} />
          <FeatureItem icon="analytics" text={t('paywall.feature3')} delay={500} />
          <FeatureItem icon="notifications" text={t('paywall.feature4')} delay={600} />
        </Animated.View>

        {/* Plans Section */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(400)}
          style={styles.plansContainer}
        >
          {/* Annual Plan */}
          {annualPackage && (
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPackage === annualPackage && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPackage(annualPackage)}
              activeOpacity={0.8}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>{t('paywall.bestValue')}</Text>
              </View>
              <View style={styles.planContent}>
                <View>
                  <Text style={styles.planName}>{t('paywall.annual')}</Text>
                  <Text style={styles.planPrice}>{formatPrice(annualPackage)}</Text>
                  <Text style={styles.planSubtext}>
                    {t('paywall.perYear')} · {t('paywall.save')} {calculateSavings()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedPackage === annualPackage && styles.radioButtonSelected,
                  ]}
                >
                  {selectedPackage === annualPackage && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Monthly Plan */}
          {monthlyPackage && (
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPackage === monthlyPackage && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPackage(monthlyPackage)}
              activeOpacity={0.8}
            >
              <View style={styles.planContent}>
                <View>
                  <Text style={styles.planName}>{t('paywall.monthly')}</Text>
                  <Text style={styles.planPrice}>{formatPrice(monthlyPackage)}</Text>
                  <Text style={styles.planSubtext}>{t('paywall.perMonth')}</Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedPackage === monthlyPackage && styles.radioButtonSelected,
                  ]}
                >
                  {selectedPackage === monthlyPackage && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Purchase Button */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(500)}
          style={styles.buttonContainer}
        >
          <TouchableOpacity
            style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedPackage}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B35', '#F7931E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.purchaseButtonGradient}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.purchaseButtonText}>{t('paywall.subscribe')}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Restore Button */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#FFFFFF80" />
            ) : (
              <Text style={styles.restoreButtonText}>{t('paywall.restore')}</Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>{t('paywall.terms')}</Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Feature Item Component
const FeatureItem: React.FC<{ icon: string; text: string; delay: number }> = ({
  icon,
  text,
  delay,
}) => (
  <Animated.View
    entering={FadeInDown.duration(400).delay(delay)}
    style={styles.featureItem}
  >
    <View style={styles.featureIconContainer}>
      <Ionicons name={icon as any} size={20} color="#FF6B35" />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </Animated.View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 24,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crownGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF99',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B3520',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#FFFFFFDD',
    flex: 1,
  },
  plansContainer: {
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FF6B3515',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B35',
    marginBottom: 2,
  },
  planSubtext: {
    fontSize: 13,
    color: '#FFFFFF80',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#FF6B35',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  purchaseButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#FFFFFF80',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 11,
    color: '#FFFFFF50',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});

export default PaywallScreen;
