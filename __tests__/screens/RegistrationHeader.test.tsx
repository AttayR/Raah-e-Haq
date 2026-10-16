/**
 * T-556: the active registration step drew a white glyph on its white circle, so the current
 * step showed an empty dot. Each glyph must differ from the circle it sits on.
 */
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import RegistrationHeader from '../../src/screens/Auth/RegistrationHeader';
import { styles } from '../../src/screens/Auth/RegistrationScreen.styles';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';

const renderHeader = async (stepIndex: number) => {
  render(
    <ThemeProvider>
      <RegistrationHeader title="Create Account" subtitle="Join" stepIndex={stepIndex} />
    </ThemeProvider>,
  );
  await act(async () => {});
};

const circleColor = (style: ViewStyle) => String(StyleSheet.flatten(style).backgroundColor).toLowerCase();

describe('RegistrationHeader step icons (T-556)', () => {
  it('draws the active step glyph in a colour that shows on the white active circle', async () => {
    await renderHeader(0);
    const icon = screen.getByTestId('registration-step-icon-personal');
    expect(icon.props.color).toBe(styles.stepIconActive.color);
    expect(String(icon.props.color).toLowerCase()).not.toBe(circleColor(styles.stepCircleActive));
  });

  it('draws completed glyphs in a colour that shows on the green circle', async () => {
    await renderHeader(1);
    const done = screen.getByTestId('registration-step-icon-personal');
    expect(done.props.color).toBe(styles.stepIconCompleted.color);
    expect(String(done.props.color).toLowerCase()).not.toBe(circleColor(styles.stepCircleCompleted));
    expect(screen.getByTestId('registration-step-icon-vehicle').props.color).toBe(styles.stepIconActive.color);
  });
});
