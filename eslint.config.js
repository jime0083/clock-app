const js = require('@eslint/js');
const globals = require('globals');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'functions/**',
      'coverage/**',
      'babel.config.js',
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  reactPlugin.configs.flat.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        __DEV__: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      'react-hooks': reactHooksPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prettier/prettier': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // require() is the standard way to reference static assets in React
      // Native (images/sounds) and is also used by CommonJS tooling config
      // files (this file, jest.config.js) - not a real code smell here.
      '@typescript-eslint/no-require-imports': 'off',
      ...prettierConfig.rules,
    },
  },
  {
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx,js}',
      'jest.setup.js',
      'jest.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
