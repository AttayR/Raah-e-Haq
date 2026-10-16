/**
 * T-541: wall-clock budgets in the test setup. The first render in a suite can load (and in a
 * fresh worktree compile) lazy React Native modules, which under load took seconds and failed
 * runs at random: Jest's 5 s test timeout and RNTL's 1 s findBy/waitFor timeout.
 */
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

// Real timers on purpose: this stands in for a first render that is slow in wall-clock time.
const LATE_MS = 1200;

function ShowsLate() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), LATE_MS);
    return () => clearTimeout(id);
  }, []);
  return shown ? <Text>arrived</Text> : null;
}

describe('test timeouts (T-541)', () => {
  it('findBy waits longer than 1 s of real time before giving up', async () => {
    render(<ShowsLate />);
    expect(await screen.findByText('arrived')).toBeTruthy();
  });

  it('Jest gives a test 20 s, and the RNTL wait stays well under it', () => {
    const { testTimeout } = require('../../jest.config') as { testTimeout?: number };
    const { getConfig } = require('@testing-library/react-native/build/config') as {
      getConfig: () => { asyncUtilTimeout: number };
    };
    expect(testTimeout).toBe(20000);
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });
});
