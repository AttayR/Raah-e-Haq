const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Add .cjs extension support
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs'],
    // Handle pretty-format module resolution issue
    resolveRequest: (context, moduleName, platform) => {
      // Handle pretty-format package resolution issue
      if (moduleName === 'pretty-format') {
        const prettyFormatPath = path.resolve(__dirname, 'node_modules/pretty-format/build/index.js');
        return {
          type: 'sourceFile',
          filePath: prettyFormatPath,
        };
      }
      
      // Use default resolver for other modules
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
