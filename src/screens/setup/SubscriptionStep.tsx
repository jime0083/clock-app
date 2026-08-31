import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { styles } from './styles';

interface SubscriptionStepProps {
  selectedPlan: 'monthly' | 'annual' | null;
  isPurchasing: boolean;
  isRestoring: boolean;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
  onPurchase: () => void;
  onRestore: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export const SubscriptionStep: React.FC<SubscriptionStepProps> = ({
  selectedPlan,
  isPurchasing,
  isRestoring,
  onSelectPlan,
  onPurchase,
  onRestore,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.subscriptionContainer}>
      <View style={styles.subscriptionHeader}>
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>{t('pay.tagline1')}</Text>
          <Text style={styles.tagline}>{t('pay.tagline2')}</Text>
          <Text style={styles.tagline}>{t('pay.tagline3')}</Text>
        </View>
        <View style={styles.metaAnimationContainer}>
          <LottieView
            source={require('@assets/animations/Meta animation.json')}
            autoPlay
            loop
            style={styles.metaAnimation}
          />
        </View>
      </View>

      <Text style={styles.planLabel}>{t('pay.plan')}</Text>

      {/* Annual Plan Card */}
      <TouchableOpacity
        style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
        onPress={() => onSelectPlan('annual')}
        activeOpacity={0.8}
      >
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>{t('pay.discount')}</Text>
        </View>
        <View style={styles.planCardContent}>
          <Text style={styles.planDuration}>{t('pay.yearly')}</Text>
          <View style={styles.planPriceContainer}>
            <Text style={styles.planOriginalPrice}>{t('pay.yearlyOriginal')}</Text>
            <Text style={styles.planPrice}>{t('pay.yearlyPrice')}</Text>
            <Text style={styles.planPerMonth}>{t('pay.yearlyPerMonth')}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Monthly Plan Card */}
      <TouchableOpacity
        style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
        onPress={() => onSelectPlan('monthly')}
        activeOpacity={0.8}
      >
        <View style={styles.planCardContent}>
          <Text style={styles.planDuration}>{t('pay.monthly')}</Text>
          <Text style={styles.planPriceMonthly}>{t('pay.monthlyPrice')}</Text>
        </View>
      </TouchableOpacity>

      {/* Purchase Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (!selectedPlan || isPurchasing) && styles.buttonDisabled]}
        onPress={onPurchase}
        activeOpacity={0.8}
        disabled={!selectedPlan || isPurchasing}
      >
        {isPurchasing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('paywall.subscribe')}</Text>
        )}
      </TouchableOpacity>

      {/* Auto-renewal disclosure (App Store Guideline 3.1.2) */}
      <Text style={styles.autoRenewText}>{t('paywall.terms')}</Text>

      {/* Restore Purchases */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={onRestore}
        activeOpacity={0.7}
        disabled={isRestoring || isPurchasing}
      >
        {isRestoring ? (
          <ActivityIndicator size="small" color={Colors.textSecondary} />
        ) : (
          <Text style={styles.restoreButtonText}>{t('paywall.restore')}</Text>
        )}
      </TouchableOpacity>

      {/* Footer Links */}
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={onOpenTerms}>
          <Text style={styles.footerLink}>{t('pay.termsOfService')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenPrivacy}>
          <Text style={styles.footerLink}>{t('pay.privacyPolicy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
