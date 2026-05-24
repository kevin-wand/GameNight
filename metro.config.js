const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname, {
  // Enable CSS support
  isCSSEnabled: true,
});

// Add the additional resolver
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;