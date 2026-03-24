// Okiroya Color Palette
// Morning-inspired blue theme with energetic accents

export const Colors = {
  // Primary - Vibrant morning blue
  primary: '#3478F6',
  primaryLight: '#5B93F8',
  primaryDark: '#2563EB',

  // Background
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',

  // Text
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Accent
  accent: '#10B981',
  accentLight: '#34D399',
  warning: '#F59E0B',
  error: '#EF4444',

  // Card & Surface
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardShadow: 'rgba(15, 23, 42, 0.08)',

  // Button
  buttonPrimary: '#3478F6',
  buttonPrimaryPressed: '#2563EB',
  buttonSecondary: '#F1F5F9',
  buttonSecondaryPressed: '#E2E8F0',

  // Status
  success: '#10B981',
  connected: '#10B981',
  disconnected: '#94A3B8',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.5)',
  overlayLight: 'rgba(255, 255, 255, 0.9)',
} as const;

export type ColorKey = keyof typeof Colors;
