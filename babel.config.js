/**
 * Babel config.
 *
 * - Release bundles (Metro sets BABEL_ENV=production when `dev` is false) strip every
 *   console call except `console.error`, which `src/core/logging/logger.ts` uses for
 *   `logger.error` (already redacted).
 * - `react-native-worklets/plugin` must stay last.
 */
module.exports = api => {
  const isProduction = api.env('production');

  const plugins = [
    [
      'module-resolver',
      {
        alias: {
          src: './src',
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    ],
  ];

  if (isProduction) {
    plugins.push(['transform-remove-console', {exclude: ['error']}]);
  }

  plugins.push('react-native-worklets/plugin'); // Must be last

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
