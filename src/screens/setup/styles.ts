import { StyleSheet, Dimensions, Platform } from 'react-native';
import { Colors } from '@/constants/colors';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const ANIMATION_SIZE = SCREEN_WIDTH * 0.55;
export const ANIMATION_SIZE_SMALL = SCREEN_WIDTH * 0.4;

export const REQUIRED_SQUATS = 10;

export const DAYS_OF_WEEK = [
  { key: 0, labelKey: 'alarm.days.sun' },
  { key: 1, labelKey: 'alarm.days.mon' },
  { key: 2, labelKey: 'alarm.days.tue' },
  { key: 3, labelKey: 'alarm.days.wed' },
  { key: 4, labelKey: 'alarm.days.thu' },
  { key: 5, labelKey: 'alarm.days.fri' },
  { key: 6, labelKey: 'alarm.days.sat' },
];

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  stepContainer: {
    alignItems: 'center',
  },
  animationContainer: {
    width: ANIMATION_SIZE,
    height: ANIMATION_SIZE,
    marginBottom: 32,
  },
  animationContainerSmall: {
    width: ANIMATION_SIZE_SMALL,
    height: ANIMATION_SIZE_SMALL,
    marginBottom: 16,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  inputField: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    marginBottom: 16,
  },
  timePickerContainer: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timePickerContainerCompact: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    maxHeight: 180,
  },
  timePickerIOS: {
    height: 160,
  },
  inputText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  placeholderText: {
    color: Colors.textTertiary,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  connectedContainer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  connectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 16,
  },
  // Day selection styles
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  // Progress styles
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  // Subscription styles
  subscriptionContainer: {
    flex: 1,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  taglineContainer: {
    flex: 1,
    paddingRight: 16,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  metaAnimationContainer: {
    width: 80,
    height: 80,
  },
  metaAnimation: {
    width: '100%',
    height: '100%',
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  planCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#FFA500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDuration: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planOriginalPrice: {
    fontSize: 12,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planPerMonth: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  planPriceMonthly: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  autoRenewText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 'auto',
    paddingTop: 20,
  },
  footerLink: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
