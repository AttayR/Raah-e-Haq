module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // App code logs only through src/core/logging/logger.ts, which redacts secrets and PII.
      // Node scripts (scripts/) and tests may print to the console.
      files: ['src/**/*.{js,jsx,ts,tsx}'],
      excludedFiles: ['src/core/logging/logger.ts'],
      rules: {'no-console': 'error'},
    },
  ],
};
