/**
 * T-570 (QA 2026-10-18, UI-R6/R7 follow-ups): email sign-in reveals the fields, "Forgot password?"
 * and "Sign in" together; the PhoneAuth code step reveals "Change number" with the field and shows
 * the "code sent" message inline; the send hold outlives the screen; the dark selected segment has
 * a ≥3:1 outline; the driver Make list follows the vehicle type; a refused Continue scrolls to the
 * topmost highlighted field.
 */
import React from 'react';
import { StyleSheet, useColorScheme, type View, type ViewStyle } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../src/theme';
import { AA_NON_TEXT, contrastRatio } from '../../src/theme/contrast';
import { KeyboardRevealContext, SegmentedControl, type KeyboardReveal } from '../../src/components/ui';
import LoginEmailForm from '../../src/features/auth/components/LoginEmailForm';
import { PhoneCodeStep } from '../../src/screens/Auth/PhoneAuthParts';
import VehicleInfoStep from '../../src/screens/Auth/steps/VehicleInfoStep';
import { VEHICLE_MAKES_BY_TYPE, vehicleMakesFor } from '../../src/features/auth/copy/registrationFields';
import { activeOtpSendHold, rememberOtpSendHold, resetOtpSendHold } from '../../src/features/auth/otpSendHold';
import { INITIAL_REGISTRATION_FORM, VEHICLE_TYPE_IDS, type RegistrationFormData } from '../../src/features/auth/registration/registrationForm';
import { useRegistrationWizard } from '../../src/features/auth/registration/useRegistrationWizard';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

// The vehicle step's server rules (BE-105) are not under test here.
jest.mock('../../src/features/ac/hooks', () => ({
  ...jest.requireActual('../../src/features/ac/hooks'),
  useRegistrationVehicleRules: () => null,
}));

// The wizard only needs registerWithImages from the auth hook.
jest.mock('../../src/hooks/useApiAuth', () => ({
  useApiAuth: () => ({ registerWithImages: jest.fn() }),
}));

const fakeReveal = (): KeyboardReveal => ({ focus: jest.fn(), blur: jest.fn(), layoutChanged: jest.fn(), error: jest.fn() });

afterEach(() => mockScheme.mockReturnValue('light'));

describe('T-570: email sign-in keeps Sign in and Forgot password above the keyboard', () => {
  it('both fields report one group (fields, Forgot password, Sign in) to the reveal', async () => {
    const reveal = fakeReveal();
    render(
      <ThemeProvider>
        <KeyboardRevealContext.Provider value={reveal}>
          <LoginEmailForm
            email=""
            password=""
            onEmailChange={jest.fn()}
            onPasswordChange={jest.fn()}
            errors={{}}
            submitting={false}
            onSubmit={jest.fn()}
            onForgotPassword={jest.fn()}
          />
        </KeyboardRevealContext.Provider>
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent(screen.getByTestId('login-email-input'), 'focus');
    fireEvent(screen.getByTestId('login-password-input'), 'focus');
    const focus = reveal.focus as jest.Mock;
    const group = focus.mock.calls[0][0];
    expect(group).toBeTruthy();
    expect(focus.mock.calls[1][0]).toBe(group);
    // The group holds the submit and the forgot link, so revealing it shows them too.
    const form = screen.getByTestId('login-email-form');
    expect(form).toContainElement(screen.getByTestId('login-submit'));
    expect(form).toContainElement(screen.getByTestId('login-forgot-password'));
  });
});

describe('T-570: PhoneAuth code step', () => {
  const renderStep = async (props: Partial<React.ComponentProps<typeof PhoneCodeStep>> = {}, reveal = fakeReveal()) => {
    render(
      <ThemeProvider>
        <KeyboardRevealContext.Provider value={reveal}>
          <PhoneCodeStep
            code=""
            onChange={jest.fn()}
            error=""
            notice="If this number is registered, a code is on its way."
            expiryText="Code expires in 45s"
            expiryAlert={false}
            locked={false}
            resendIn="45s"
            resending={false}
            onResend={jest.fn()}
            onChangeNumber={jest.fn()}
            onSubmit={jest.fn()}
            emailFallback={null}
            {...props}
          />
        </KeyboardRevealContext.Provider>
      </ThemeProvider>,
    );
    await act(async () => {});
    return reveal;
  };

  it('the code field reveals its group, which holds Resend and Change number', async () => {
    const reveal = await renderStep();
    fireEvent(screen.getByTestId('phone-auth-code-input'), 'focus');
    const target = (reveal.focus as jest.Mock).mock.calls[0][0];
    expect(target).toBeTruthy();
    const group = screen.getByTestId('phone-auth-code-group');
    expect(group).toContainElement(screen.getByTestId('phone-auth-change-number'));
    expect(group).toContainElement(screen.getByTestId('phone-auth-resend-countdown'));
  });

  it('shows the code-sent message inline, above the field', async () => {
    await renderStep();
    expect(screen.getByTestId('phone-auth-sent-notice')).toHaveTextContent(/If this number is registered, a code is on its way\.$/);
  });

  it.each([
    ['a refusal', { error: 'Invalid or expired code' }],
    ['an expired code', { expiryAlert: true }],
    ['no message', { notice: '' }],
  ])('hides the notice with %s (one message at a time)', async (_label, props) => {
    await renderStep(props);
    expect(screen.queryByTestId('phone-auth-sent-notice')).toBeNull();
  });
});

describe('T-570: the send hold outlives the screen (in memory)', () => {
  beforeEach(() => resetOtpSendHold());

  it('remembers the last hold and forgets it once it has passed', () => {
    const t0 = 1_000_000;
    expect(activeOtpSendHold(t0)).toBeNull();
    rememberOtpSendHold('+923001234567', false, 60, t0);
    expect(activeOtpSendHold(t0 + 15_500)).toEqual({ phone: '+923001234567', global: false, seconds: 45 });
    expect(activeOtpSendHold(t0 + 60_000)).toBeNull();
    // Gone for good, not just hidden.
    expect(activeOtpSendHold(t0)).toBeNull();
  });

  it('ignores a hold without a usable length', () => {
    rememberOtpSendHold('+923001234567', true, 0);
    rememberOtpSendHold('+923001234567', true, Number.NaN);
    expect(activeOtpSendHold()).toBeNull();
  });
});

describe('T-570: dark Login segment contrast (kit SegmentedControl)', () => {
  const OPTIONS = [
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
  ] as const;

  it.each([
    ['dark', DarkTheme.colors.borderStrong],
    ['light', LightTheme.colors.surface],
  ] as const)('%s: the selected pill is outlined; resting segments carry the same border in the track colour', async (mode, outline) => {
    mockScheme.mockReturnValue(mode);
    const theme = mode === 'dark' ? DarkTheme : LightTheme;
    render(
      <ThemeProvider>
        <SegmentedControl options={OPTIONS} value="phone" onChange={jest.fn()} accessibilityLabel="Sign in with" />
      </ThemeProvider>,
    );
    await act(async () => {});
    const selected = StyleSheet.flatten(screen.getByRole('radio', { name: 'Sign in with, Phone' }).props.style) as ViewStyle;
    const resting = StyleSheet.flatten(screen.getByRole('radio', { name: 'Sign in with, Email' }).props.style) as ViewStyle;
    expect(selected.borderColor).toBe(outline);
    expect(selected.borderWidth).toBe(resting.borderWidth);
    expect(resting.borderColor).toBe(theme.colors.surfaceAlt);
  });

  it('the dark outline meets 3:1 against the track', () => {
    expect(contrastRatio(DarkTheme.colors.borderStrong, DarkTheme.colors.surfaceAlt)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe('T-570: the Make list follows the vehicle type', () => {
  const driver: RegistrationFormData = { ...INITIAL_REGISTRATION_FORM, role: 'driver' };

  it('every vehicle type has its own list ending in Other; bikes get bike makes', () => {
    VEHICLE_TYPE_IDS.forEach((type) => {
      const makes = vehicleMakesFor(type);
      expect(makes.length).toBeGreaterThan(1);
      expect(makes[makes.length - 1]).toBe('Other');
      expect(new Set(makes).size).toBe(makes.length);
    });
    expect(vehicleMakesFor('bike')).toEqual(expect.arrayContaining(['Honda', 'Yamaha', 'United', 'Road Prince']));
    expect(vehicleMakesFor('bike')).not.toContain('Toyota');
    expect(vehicleMakesFor('')).toEqual([]);
    expect(Object.keys(VEHICLE_MAKES_BY_TYPE).sort()).toEqual([...VEHICLE_TYPE_IDS].sort());
  });

  it('without a type the Make field is disabled and says why', async () => {
    render(
      <ThemeProvider>
        <VehicleInfoStep data={driver} onDataChange={jest.fn()} errors={{}} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('Choose the vehicle type first.')).toBeTruthy();
    expect(screen.getByTestId('registration-vehicle-make-field').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('Bike lists bike makes in the sheet', async () => {
    render(
      <ThemeProvider>
        <VehicleInfoStep data={{ ...driver, vehicleType: 'bike' }} onDataChange={jest.fn()} errors={{}} />
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent.press(screen.getByTestId('registration-vehicle-make-field'));
    await act(async () => {});
    expect(screen.getByText('Yamaha')).toBeTruthy();
    expect(screen.queryByText('Toyota')).toBeNull();
  });

  it('switching to a type that does not list the chosen make clears it; a shared make is kept', async () => {
    const onDataChange = jest.fn();
    render(
      <ThemeProvider>
        <VehicleInfoStep data={{ ...driver, vehicleType: 'car', vehicleBrand: 'Toyota' }} onDataChange={onDataChange} errors={{}} />
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent.press(screen.getByTestId('registration-vehicle-type-bike'));
    expect(onDataChange).toHaveBeenCalledWith({ vehicleType: 'bike' });
    expect(onDataChange).toHaveBeenCalledWith({ vehicleBrand: '' });

    onDataChange.mockClear();
    fireEvent.press(screen.getByTestId('registration-vehicle-type-van'));
    expect(onDataChange).toHaveBeenCalledWith({ vehicleType: 'van' });
    expect(onDataChange).not.toHaveBeenCalledWith({ vehicleBrand: '' });
  });
});

describe('T-570: "Please fix the highlighted fields" points at a field in view', () => {
  it('a refused Continue scrolls to the topmost errored field on the page', async () => {
    const { result } = renderHook(() => useRegistrationWizard('driver'));
    const scrollTo = jest.fn();
    // The hook's refs, pointed at fakes: the scroll view, its form container and two anchors.
    (result.current.scrollRef as { current: unknown }).current = { scrollTo };
    (result.current.containerRef as { current: unknown }).current = {};
    result.current.containerY.current = 40;
    const at = (y: number) => ({ measureLayout: (_c: unknown, ok: (x: number, y: number) => void) => ok(0, y) }) as unknown as View;
    act(() => result.current.goTo('payout'));
    act(() => {
      result.current.anchor('bankName')(at(300));
      result.current.anchor('bankBranch')(at(380));
      result.current.anchor('bankAccountNumber')(at(460));
    });
    scrollTo.mockClear();

    act(() => result.current.handleNext());
    expect(Object.keys(result.current.errors).sort()).toEqual(['bankAccountNumber', 'bankBranch', 'bankName']);
    // 40 (container) + 300 (Bank name, the topmost) - 72 (FIELD_SCROLL_OFFSET, T-574: below the toast).
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 268, animated: true }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('only the errored fields count: a later field alone is scrolled to', async () => {
    const { result } = renderHook(() => useRegistrationWizard('driver'));
    const scrollTo = jest.fn();
    (result.current.scrollRef as { current: unknown }).current = { scrollTo };
    (result.current.containerRef as { current: unknown }).current = {};
    result.current.containerY.current = 0;
    const at = (y: number) => ({ measureLayout: (_c: unknown, ok: (x: number, y: number) => void) => ok(0, y) }) as unknown as View;
    act(() => result.current.goTo('payout'));
    act(() => result.current.updateFormData({ bankName: 'HBL', bankBranch: 'Gulberg' }));
    act(() => {
      result.current.anchor('bankName')(at(300));
      result.current.anchor('bankBranch')(at(380));
      result.current.anchor('bankAccountNumber')(at(460));
    });
    scrollTo.mockClear();

    act(() => result.current.handleNext());
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 388, animated: true }));
  });
});
