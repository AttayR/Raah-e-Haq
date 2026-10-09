module.exports = {
  preset: 'react-native',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|@react-native-firebase|@react-native-async-storage|@react-navigation|react-native-.*|redux-persist|react-redux|@reduxjs/toolkit|immer|reselect|redux)/)',
  ],
  // .claude/worktrees holds other agents' checkouts (with their own tests and node_modules).
  // Anchored to <rootDir>: a bare '/.claude/' also matches every test of a run *inside* a
  // worktree (its path contains /.claude/worktrees/), which then finds no tests at all.
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
};
