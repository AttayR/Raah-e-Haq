/**
 * UI-R7 (spec auth-registration): the registration page header is a segmented progress bar (one
 * segment per step, done and current in `primary`), "Step n of m", the page title and its
 * description. The role page and the phone step pass no progress. (Replaces the T-556 step-icon
 * test: the navy header with icon circles is gone.)
 */
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import RegistrationHeader from '../../src/screens/Auth/RegistrationHeader';
import { LightTheme } from '../../src/theme';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';

const renderHeader = async (progress: { current: number; total: number } | null) => {
  render(
    <ThemeProvider>
      <RegistrationHeader title="About you" description="Your details" progress={progress} />
    </ThemeProvider>,
  );
  await act(async () => {});
};

const fill = (testID: string) =>
  String(StyleSheet.flatten(screen.getByTestId(testID).props.style as ViewStyle).backgroundColor);

describe('RegistrationHeader (UI-R7)', () => {
  it('fills the done and current segments in primary and leaves the rest', async () => {
    await renderHeader({ current: 2, total: 5 });
    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
    expect(fill('registration-progress-1')).toBe(LightTheme.colors.primary);
    expect(fill('registration-progress-2')).toBe(LightTheme.colors.primary);
    expect(fill('registration-progress-3')).toBe(LightTheme.colors.border);
    expect(screen.queryByTestId('registration-progress-6')).toBeNull();
    expect(screen.getByTestId('registration-progress').props.accessibilityValue).toEqual({ min: 0, max: 5, now: 2 });
  });

  it('shows the title and description, and no progress when none is given', async () => {
    await renderHeader(null);
    expect(screen.getByText('About you')).toBeTruthy();
    expect(screen.getByText('Your details')).toBeTruthy();
    expect(screen.queryByTestId('registration-progress')).toBeNull();
    expect(screen.queryByText(/^Step /)).toBeNull();
  });
});
