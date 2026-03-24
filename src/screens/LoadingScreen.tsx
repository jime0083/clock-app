import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import LottieView from 'lottie-react-native';

const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 180,
    height: 180,
    borderRadius: 36,
  },
  loadingContainer: {
    marginTop: 40,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loading: {
    width: 80,
    height: 80,
  },
});

export default LoadingScreen;
