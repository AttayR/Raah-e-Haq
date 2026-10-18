import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppText, Button, TextField } from '../../components/ui';
import { OTP_LENGTH } from '../../services/otpService';
import { PHONE_AUTH_COPY as COPY } from '../../features/auth/copy/phoneAuth';
import { space } from '../../theme';

/**
 * Sections of PhoneAuthScreen (UI-R6, spec auth-phone-otp), kit only. Each number-pad field
 * renders its own iOS Done bar with its own id (`doneBar`, T-548/T-550): on Fabric an
 * InputAccessoryView attaches only to the first input in the window with its id.
 */

/** BE-28 otp_ip_limit / otp_verify_limit: phone sign-in is capped, so email is offered. */
export function EmailFallback({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.fallback} testID="phone-auth-email-fallback">
      <AppText variant="bodySmall" color="textSecondary">
        {COPY.emailFallback.hint}
      </AppText>
      <Button label={COPY.emailFallback.action} variant="secondary" onPress={onPress} testID="phone-auth-email-login" />
    </View>
  );
}

interface PhoneStepProps {
  /** National digits (no +92, no leading 0), as the kit phone field reports them. */
  digits: string;
  onChange: (digits: string) => void;
  error: string;
  disabled: boolean;
  onSubmit: () => void;
  emailFallback: React.ReactNode;
}

/** The number: kit phone field with the fixed +92 prefix; Send sits in the sticky footer. */
export function PhoneNumberStep({ digits, onChange, error, disabled, onSubmit, emailFallback }: PhoneStepProps) {
  return (
    <View style={styles.body}>
      <TextField
        variant="phone"
        label={COPY.phoneStep.label}
        helper={COPY.phoneStep.helper}
        value={digits}
        onChangeText={onChange}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoFocus
        doneBar
        disabled={disabled}
        error={error || undefined}
        testID="phone-auth-phone"
      />
      {emailFallback}
    </View>
  );
}

interface CodeStepProps {
  code: string;
  onChange: (code: string) => void;
  error: string;
  expiryText: string;
  expiryAlert: boolean;
  /** Verify is off (burned code): the field is read-only too. */
  locked: boolean;
  resendIn: string | null;
  resending: boolean;
  onResend: () => void;
  onChangeNumber: () => void;
  emailFallback: React.ReactNode;
}

/** The code: expiry line, the code field, Resend (or its countdown) and "Change number". */
export function PhoneCodeStep({
  code,
  onChange,
  error,
  expiryText,
  expiryAlert,
  locked,
  resendIn,
  resending,
  onResend,
  onChangeNumber,
  emailFallback,
}: CodeStepProps) {
  return (
    <View style={styles.body}>
      <AppText
        variant="caption"
        color={expiryAlert ? 'danger' : 'textMuted'}
        accessibilityLiveRegion="polite"
        testID="phone-auth-expiry"
      >
        {expiryText}
      </AppText>
      <TextField
        label={COPY.codeStep.label}
        placeholder={COPY.codeStep.placeholder(OTP_LENGTH)}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        returnKeyType="done"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus
        doneBar
        disabled={locked}
        error={error || undefined}
        testID="phone-auth-code"
      />
      {emailFallback}
      <View style={styles.actions}>
        {resendIn !== null ? (
          <AppText variant="bodySmall" color="textSecondary" align="center" testID="phone-auth-resend-countdown">
            {COPY.codeStep.resendIn(resendIn)}
          </AppText>
        ) : (
          <Button
            label={resending ? COPY.codeStep.resending : COPY.codeStep.resend}
            variant="secondary"
            onPress={onResend}
            loading={resending}
            testID="phone-auth-resend"
          />
        )}
        <Button label={COPY.codeStep.changePhone} variant="ghost" onPress={onChangeNumber} testID="phone-auth-change-number" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4] },
  fallback: { gap: space[2] },
  actions: { gap: space[2], marginTop: space[2] },
});
