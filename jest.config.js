module.exports = {
  preset: 'react-native',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|@react-native-firebase|@react-native-async-storage|@react-navigation|react-native-.*|redux-persist|react-redux|@reduxjs/toolkit|immer|reselect|redux)/)',
  ],
  // .claude/worktrees holds other agents' checkouts (with their own tests and node_modules).
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
};
