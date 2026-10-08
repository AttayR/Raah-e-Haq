const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// Never watch or bundle files under docs/ (QA screenshots, reports, specs): saving one there
// must not reload the app in the middle of a test. src/ and the rest stay watched.
const escapeForRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const docsBlockPattern = new RegExp(
  `^${escapeForRegExp(path.resolve(__dirname, 'docs'))}[\\/\\\\].*`,
);
// Agent git worktrees (.claude/worktrees) are full checkouts with their own node_modules.
const claudeBlockPattern = new RegExp(
  `^${escapeForRegExp(path.resolve(__dirname, '.claude'))}[\\/\\\\].*`,
);
const defaultBlockList = defaultConfig.resolver.blockList;
const blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList]).filter(Boolean),
  docsBlockPattern,
  claudeBlockPattern,
];

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList,
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

module.exports = mergeConfig(defaultConfig, config);
