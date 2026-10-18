import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../../app/navigation/stacks/AuthStack';
import { AppText, Banner, Button, Icon, TextField } from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { formatCountdown, OTP_LENGTH } from '../../../services/otpService';
import type { PendingPhoneVerification } from '../../../store/thunks/apiThunks';
import { space } from '../../../theme';
import { PHONE_AUTH_COPY } from '../copy/phoneAuth';
import { REGISTRATION_COPY as COPY } from '../copy/registration';
import { useRegistrationPhoneVerify } from '../hooks/useRegistrationPhoneVerify';

const CODE = PHONE_AUTH_COPY.codeStep;

interface Props {
  pending: PendingPhoneVerification;
  role: 'driver' | 'passenger' | null;
  onGoToSignIn: () => void;
}

/**
 * The code step after Create account (T-201, BE-35/BE-38; kit since UI-R7). There is no way back
 * to the form from here: a second registration with the same email would be a taken-email decoy
 * whose codes never verify. Leaving is "Go to Sign In" (after a confirm Dialog while the code is
 * being entered); the hint explains the emailed link.
 */
export default function RegistrationPhoneStep({ pending, role, onGoToSignIn }: Props) {
  const step = useRegistrationPhoneVerify(pending, role);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const entering = step.status === 'code';

  // Leaving while the code is being entered drops the in-memory verification token. A JS
  // beforeRemove cannot stop the native iOS swipe (the screen would leave natively while the
  // JS stack kept it, so the auth stack stopped responding), so the swipe is switched off and
  // every JS removal (Android back, header back, "Go to Sign In") asks first.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !entering });
  }, [entering, navigation]);

  usePreventRemove(entering, ({ data }) => {
    confirm({
      title: COPY.verify.leaveTitle,
      body: COPY.verify.leaveMessage,
      confirmLabel: COPY.verify.leaveConfirm,
      cancelLabel: COPY.verify.leaveCancel,
      destructive: true,
    }).then((leave) => {
      if (leave) navigation.dispatch(data.action);
    });
  });

  const errorBanner = (text: string, extra?: string) => (
    <Banner tone="danger" text={extra ? `${text}\n${extra}` : text} testID="registration-code-error" />
  );

  const signInButton = (
    <Button
      label={COPY.verify.goToSignIn}
      onPress={onGoToSignIn}
      variant={entering ? 'ghost' : 'primary'}
      testID="registration-go-to-sign-in"
    />
  );

  if (step.status === 'done') {
    return (
      <View style={styles.wrap}>
        <View style={styles.doneGlyph}>
          <Icon name="verified" size={48} color="success" />
        </View>
        <AppText variant="h2" accessibilityRole="header" align="center">
          {COPY.verify.doneTitle}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {step.doneMessage}
        </AppText>
        {signInButton}
      </View>
    );
  }

  if (step.status !== 'code') {
    // verification_token_invalid or phone_needs_review: the server's message says what next.
    return (
      <View style={styles.wrap}>
        <AppText variant="h2" accessibilityRole="header">
          {COPY.verify.title}
        </AppText>
        {errorBanner(step.error, step.hint)}
        {signInButton}
      </View>
    );
  }

  // One state at a time: while a refusal is shown, it replaces the expiry line.
  const expiryText = step.error
    ? ''
    : step.burned
      ? CODE.burned
      : step.isExpired
        ? CODE.expired
        : step.expiresIn > 0
          ? CODE.expiresIn(formatCountdown(step.expiresIn))
          : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.titleBlock}>
        <AppText variant="h2" accessibilityRole="header">
          {COPY.verify.title}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary">
          {COPY.verify.subtitle(step.phone)}
        </AppText>
        {expiryText ? (
          <AppText variant="caption" color={step.isExpired || step.burned ? 'danger' : 'textMuted'}>
            {expiryText}
          </AppText>
        ) : null}
      </View>

      <TextField
        placeholder={CODE.placeholder(OTP_LENGTH)}
        accessibilityLabel={COPY.verify.title}
        value={step.code}
        onChangeText={step.setCode}
        keyboardType="number-pad"
        returnKeyType="done"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus
        disabled={!step.canVerify}
        doneBar
        error={step.error ? (step.hint ? `${step.error}\n${step.hint}` : step.error) : undefined}
        testID="registration-code"
      />

      <Button
        label={step.verifying ? CODE.verifying : CODE.verify}
        onPress={step.verify}
        loading={step.verifying}
        disabled={!step.canVerify || step.code.length !== OTP_LENGTH}
        testID="registration-verify"
      />

      <View style={styles.resend}>
        {step.resendIn > 0 ? (
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {CODE.resendIn(formatCountdown(step.resendIn))}
          </AppText>
        ) : (
          <Button
            label={step.resending ? CODE.resending : CODE.resend}
            onPress={step.resend}
            variant="secondary"
            loading={step.resending}
            disabled={step.verifying}
            testID="registration-resend"
          />
        )}
      </View>

      <AppText variant="caption" color="textSecondary">
        {COPY.verify.signInHint}
      </AppText>
      {/* T-564: the approval wait the register message used to carry in its toast. */}
      {role === 'driver' ? (
        <AppText variant="caption" color="textSecondary" testID="registration-driver-approval-hint">
          {COPY.verify.driverApprovalHint}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {COPY.verify.wrongNumber}
      </AppText>
      {signInButton}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  titleBlock: { gap: space[1] },
  doneGlyph: { alignItems: 'center', paddingVertical: space[4] },
  resend: { alignItems: 'stretch' },
});
