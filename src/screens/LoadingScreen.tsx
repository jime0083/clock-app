import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = SCREEN_WIDTH * 0.45;

const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <View style={styles.iconContainer}>
          <Image
            source={require('@assets/images/okiroya-icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
        <View style={styles.loadingContainer}>
          <LottieView
            source={require('@assets/animations/Loading Dots Blue.json')}
            autoPlay
            loop
            style={styles.loading}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.22,
  },
  loadingContainer: {
    marginTop: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loading: {
    width: 60,
    height: 60,
  },
});

export default LoadingScreen;
