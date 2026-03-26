module.exports = function (api) {
  api.cache(true);

  const plugins = [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@hooks': './src/hooks',
          '@contexts': './src/contexts',
          '@services': './src/services',
          '@utils': './src/utils',
          '@types': './src/types',
          '@constants': './src/constants',
          '@locales': './src/locales',
          '@assets': './assets',
        },
      },
    ],
  ];

  // Only add reanimated plugin when not in test environment
  if (process.env.NODE_ENV !== 'test') {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
