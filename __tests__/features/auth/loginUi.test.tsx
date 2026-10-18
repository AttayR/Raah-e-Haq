/**
 * UI-R6: sign-in validation, where a refusal is shown, and the auth intro (logo badge + title).
 */
import React from 'react';
import * as RN from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import AuthIntro from '../../../src/features/auth/components/AuthIntro';
import { inlineLoginErrors, isValidEmail, validateLogin } from '../../../src/features/auth/loginValidation';
import type { ThunkRejection } from '../../../src/core/api/errors';

let mockWindow = { width: 375, height: 852, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const rejection = (over: Partial<ThunkRejection>): ThunkRejection => ({
  message: 'Refused',
  kind: 'auth',
  fieldErrors: {},
  ...over,
});

describe('validateLogin', () => {
  it('trims the email but checks the password as typed', () => {
    expect(validateLogin(' rider@example.test ', '  pass  ')).toEqual({});
    expect(validateLogin('', '')).toEqual({ email: 'Enter your email.', password: 'Enter your password.' });
    expect(validateLogin('rider@', '12345')).toEqual({
      email: 'Enter a valid email, like name@example.com.',
      password: 'Password must be at least 6 characters.',
    });
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a b@c.co')).toBe(false);
  });
});

describe('inlineLoginErrors', () => {
  it('401: the server message under the password', () => {
    expect(inlineLoginErrors(rejection({ status: 401 }), 'fallback')).toEqual({ password: 'Refused' });
    expect(inlineLoginErrors(rejection({ message: '' }), 'fallback')).toEqual({ password: 'fallback' });
  });

  it('422: the first message of each field', () => {
    expect(
      inlineLoginErrors(rejection({ kind: 'validation', fieldErrors: { password: ['', 'Too short'] } }), 'fallback'),
    ).toEqual({ email: undefined, password: 'Too short' });
  });

  it.each(['forbidden', 'network', 'rate_limited', 'server'] as const)('%s: not inline (a toast)', (kind) => {
    expect(inlineLoginErrors(rejection({ kind }), 'fallback')).toBeNull();
  });

  it('no rejection: not inline', () => {
    expect(inlineLoginErrors(undefined, 'fallback')).toBeNull();
  });
});

describe('AuthIntro', () => {
  const renderIntro = async (height: number, logo: boolean) => {
    mockWindow = { width: 375, height, scale: 2, fontScale: 1 };
    render(
      <ThemeProvider>
        <AuthIntro logo={logo} title="Sign in to Raah-e-Haq" subtitle="Ride or drive." testID="intro" />
      </ThemeProvider>,
    );
    await act(async () => {});
  };
  const flat = (testID: string) => RN.StyleSheet.flatten(screen.getByTestId(testID).props.style);

  it('a 72pt logo badge and an h1 title on a regular phone', async () => {
    await renderIntro(852, true);
    expect(flat('intro-logo')).toMatchObject({ width: 72, height: 72 });
    expect(screen.getByRole('header').props.children).toBe('Sign in to Raah-e-Haq');
    expect(screen.getByText('Ride or drive.')).toBeTruthy();
  });

  it('the 56pt badge on a small phone (iPhone SE)', async () => {
    await renderIntro(667, true);
    expect(flat('intro-logo')).toMatchObject({ width: 56, height: 56 });
  });

  it('no badge when logo is off (phone and code steps)', async () => {
    await renderIntro(852, false);
    expect(screen.queryByTestId('intro-logo')).toBeNull();
  });
});
