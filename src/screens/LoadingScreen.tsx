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
      <View style={styles.animationContainer}>
        <LottieView
          source={require('@assets/animations/Loading Dots Blue.json')}
          autoPlay
          loop
          style={styles.animation}
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  animationContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 300,
    height: 200,
  },
});

export default LoadingScreen;
