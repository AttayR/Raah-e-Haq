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
  // T-541: the first test of a screen suite also loads (and, in a fresh worktree, compiles)
  // the React Native modules its first render reaches: react-native's exports are lazy getters,
  // so Modal, TextInput, VirtualizedList, Animated... are required inside the test, not at
  // import. Measured for PhoneAuthScreen's first test: 0.23 s alone, 1.5 s alone on a cold
  // transform cache, 3.3 s in a full run, 17-19 s with three cold runs at once on a loaded
  // machine; its later tests take ~20 ms. Jest's 5 s default failed those runs at random.
  // A hang still fails, it just fails after 20 s. See also asyncUtilTimeout in jest.setup.js.
  testTimeout: 20000,
};
