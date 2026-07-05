import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  // Intro styles
  introContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 16,
    color: '#FFFFFF99',
    marginBottom: 40,
    textAlign: 'center',
  },
  instructionCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFFCC',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  startButtonContainer: {
    width: '100%',
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Phase indicator
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  phaseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF30',
  },
  phaseDotActive: {
    backgroundColor: '#4CAF50',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  phaseDotDone: {
    backgroundColor: '#4CAF50',
  },
  phaseLine: {
    width: 40,
    height: 2,
    backgroundColor: '#FFFFFF30',
    marginHorizontal: 8,
  },
  // Phase header
  phaseHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  phaseTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  phaseDescription: {
    fontSize: 16,
    color: '#FFFFFF99',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Count display
  countContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  countRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 24,
  },
  countRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    padding: 8,
  },
  countInner: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 92,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  countLabel: {
    fontSize: 14,
    color: '#FFFFFF80',
    marginTop: 4,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF20',
  },
  // Detect button
  detectButton: {
    marginTop: 20,
    marginBottom: 40,
  },
  detectButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bottom instruction
  bottomInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 40,
  },
  bottomInstructionText: {
    fontSize: 14,
    color: '#FFFFFF80',
  },
  // Complete styles
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  completeIconContainer: {
    marginBottom: 32,
  },
  completeIconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#FFFFFF99',
    marginBottom: 48,
    textAlign: 'center',
  },
  finishButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  finishButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
