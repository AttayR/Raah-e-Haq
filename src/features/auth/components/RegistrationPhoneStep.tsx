import React, { useEffect } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../../app/navigation/stacks/AuthStack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ThemedTextInput from '../../../components/ThemedTextInput';
import BrandButton from '../../../components/BrandButton';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { formatCountdown, OTP_LENGTH } from '../../../services/otpService';
import type { PendingPhoneVerification } from '../../../store/thunks/apiThunks';
import { styles } from '../../../screens/Auth/PhoneAuthScreen.styles';
import { KEYBOARD_DONE_ID } from '../../../screens/Auth/PhoneAuthParts';
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
 * The code step after Create Account (T-201, BE-35/BE-38). There is no way back to the form
 * from here: a second registration with the same email would be a taken-email decoy whose
 * codes never verify. Leaving is "Go to Sign In" (after a confirm while the code is being
 * entered); the hint explains the emailed link.
 */
export default function RegistrationPhoneStep({ pending, role, onGoToSignIn }: Props) {
  const { theme } = useAppTheme();
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
    Alert.alert(COPY.verify.leaveTitle, COPY.verify.leaveMessage, [
      { text: COPY.verify.leaveCancel, style: 'cancel' },
      { text: COPY.verify.leaveConfirm, style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const errorBox = (text: string, extra?: string) => (
    <View style={styles.errorContainer} accessibilityRole="alert">
      <Icon name="error" size={16} color={styles.errorText.color} />
      <Text style={styles.errorText}>{extra ? `${text}\n${extra}` : text}</Text>
    </View>
  );

  const signInButton = (
    <View style={styles.buttonContainer}>
      <BrandButton
        title={COPY.verify.goToSignIn}
        onPress={onGoToSignIn}
        variant={step.status === 'code' ? 'secondary' : 'primary'}
        style={styles.backButton}
        textStyle={styles.buttonText}
      />
    </View>
  );

  if (step.status === 'done') {
    return (
      <View style={styles.formCard}>
        <View style={styles.verificationIconContainer}>
          <Icon name="verified-user" size={48} color={theme.colors.success} />
        </View>
        <Text style={styles.sectionTitle}>{COPY.verify.doneTitle}</Text>
        <Text style={styles.sectionSubtitle}>{step.doneMessage}</Text>
        {signInButton}
      </View>
    );
  }

  if (step.status !== 'code') {
    // verification_token_invalid or phone_needs_review: the server's message says what next.
    return (
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{COPY.verify.title}</Text>
        {errorBox(step.error, step.hint)}
        <View style={styles.inputContainer} />
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
    <View style={styles.formCard}>
      <Text style={styles.sectionTitle}>{COPY.verify.title}</Text>
      <Text style={styles.sectionSubtitle}>{COPY.verify.subtitle(step.phone)}</Text>
      {expiryText ? (
        <Text style={[styles.expiryHint, (step.isExpired || step.burned) && styles.expiryHintExpired]}>
          {expiryText}
        </Text>
      ) : null}

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder={CODE.placeholder(OTP_LENGTH)}
          value={step.code}
          onChangeText={step.setCode}
          keyboardType="number-pad"
          returnKeyType="done"
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus
          editable={step.canVerify}
          style={[styles.input, step.error ? styles.inputError : null]}
        />
        {step.error ? errorBox(step.error, step.hint) : null}
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={step.verifying ? CODE.verifying : CODE.verify}
          onPress={step.verify}
          variant="primary"
          disabled={step.verifying || !step.canVerify || step.code.length !== OTP_LENGTH}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>

      <View style={styles.resendContainer}>
        {step.resendIn > 0 ? (
          <Text style={styles.resendText}>{CODE.resendIn(formatCountdown(step.resendIn))}</Text>
        ) : (
          <BrandButton
            title={step.resending ? CODE.resending : CODE.resend}
            onPress={step.resend}
            variant="secondary"
            disabled={step.resending || step.verifying}
            style={styles.resendButton}
            textStyle={styles.buttonText}
          />
        )}
      </View>

      <Text style={[styles.emailFallbackText, { color: theme.colors.mutedText }]}>{COPY.verify.signInHint}</Text>
      <Text style={[styles.emailFallbackText, { color: theme.colors.mutedText }]}>{COPY.verify.wrongNumber}</Text>
      <View style={styles.inputContainer} />
      {signInButton}
    </View>
  );
}
