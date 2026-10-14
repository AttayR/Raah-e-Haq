import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export type OtpInputProps = {
  value: string;
  onChange: (code: string) => void;
  /** Called once the last digit is entered (typed, pasted or autofilled). */
  onComplete?: (code: string) => void;
  length?: number;
  label?: string;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  /**
   * Offer the SMS code autofill (iOS `oneTimeCode`, Android `sms-otp`). Default true; false for a
   * code that never arrives by SMS (the ride PIN the passenger reads out, T-520).
   */
  oneTimeCode?: boolean;
  testID?: string;
};

const k = componentTokens.otp;
/** Idle and filled boxes: 1pt `borderStrong`; active: 2pt `focusRing`; error: 2pt `danger` (§5.6 [UI-R2]). */
const IDLE_BORDER = 1;
const ACTIVE_BORDER = 2;

/** Keeps digits only and caps at `length`: a pasted "123 456" or "Code: 123456" gives "123456". */
export const sanitizeOtp = (text: string, length: number = k.length): string =>
  text.replace(/\D/g, '').slice(0, length);

/**
 * OTP input (DESIGN_SYSTEM §5.6 `otp`): `length` boxes, 48×56, 8 gap, `numericL`. One real
 * TextInput spans the row (near-transparent, so iOS SMS autofill and paste work) and the boxes
 * mirror it, so typing auto-advances and backspace steps back. The active box shows the 2pt
 * focus ring; an error turns every box `danger` and shows the message. Screen readers get one
 * field: "Verification code, 6 digits".
 */
export const OtpInput = forwardRef<TextInput, OtpInputProps>(function OtpInput(
  { value, onChange, onComplete, length = k.length, label, error, disabled = false, autoFocus = false, oneTimeCode = true, testID },
  ref,
) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  const code = sanitizeOtp(value, length);
  const active = Math.min(code.length, length - 1);
  const hasError = !!error;

  const handleChange = (text: string) => {
    const next = sanitizeOtp(text, length);
    onChange(next);
    if (next.length === length && code.length !== length) {
      onComplete?.(next);
    }
  };

  const name = [label ?? t('kit.otpA11y', { length }), hasError ? t('kit.errorA11y', { message: error as string }) : null]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.container, disabled && styles.disabled]} testID={testID}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const isActive = focused && i === active;
          const borderColor = hasError ? c.danger : isActive ? c.focusRing : c.borderStrong;
          const borderWidth = hasError || isActive ? ACTIVE_BORDER : IDLE_BORDER;
          return (
            <View
              key={i}
              testID={testID ? `${testID}-box-${i}` : undefined}
              style={[styles.box, { borderColor, borderWidth, backgroundColor: isActive ? c.surface : c.surfaceAlt }]}
              importantForAccessibility="no-hide-descendants"
            >
              <AppText variant="numericL" accessible={false}>
                {code.charAt(i)}
              </AppText>
            </View>
          );
        })}
        <TextInput
          ref={ref}
          testID={testID ? `${testID}-input` : undefined}
          value={code}
          onChangeText={handleChange}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType={oneTimeCode ? 'oneTimeCode' : 'none'}
          autoComplete={oneTimeCode ? 'sms-otp' : 'off'}
          caretHidden
          contextMenuHidden={false}
          selectTextOnFocus={false}
          accessibilityLabel={name}
          accessibilityValue={{ text: code.split('').join(' ') }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[StyleSheet.absoluteFill, styles.hiddenInput]}
        />
      </View>
      {hasError ? (
        <View style={styles.helper} accessibilityLiveRegion="polite">
          <Icon name="warning" size={componentTokens.textField.helperIconSize} color="danger" />
          <AppText variant="caption" color="danger" style={styles.helperText}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: { marginBottom: componentTokens.textField.labelGap },
  row: { flexDirection: 'row', gap: k.gap, alignSelf: 'center' },
  box: {
    width: k.boxWidth,
    height: k.boxHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not opacity 0: iOS skips fully transparent inputs for one-time-code autofill.
  // Its own glyphs are transparent too, so no ghost digits show through the boxes.
  hiddenInput: { opacity: 0.02, color: 'transparent' },
  helper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginTop: componentTokens.textField.helperGap,
    alignSelf: 'center',
  },
  helperText: { flexShrink: 1 },
  disabled: { opacity: componentTokens.textField.disabledOpacity },
});
