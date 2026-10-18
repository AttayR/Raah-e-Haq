import React, { useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Button, KeyboardRevealGroup, TextField } from '../../../components/ui';
import { space } from '../../../theme';
import { LOGIN_COPY } from '../copy/login';
import type { LoginFieldErrors } from '../loginValidation';

const COPY = LOGIN_COPY.email;

interface Props {
  email: string;
  password: string;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  errors: LoginFieldErrors;
  submitting: boolean;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

/**
 * The Email segment of Login (UI-R6, spec auth-login): Email → 16 → Password (show/hide) → 8 →
 * end-aligned "Forgot password?" → 24 → "Sign in". Errors sit under their field, so a wrong
 * password shows next to the inputs, never below the fold (QA T-104). Return moves email →
 * password → sign in. While signing in the fields are read-only and the button shows a spinner.
 */
export default function LoginEmailForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  errors,
  submitting,
  onSubmit,
  onForgotPassword,
}: Props) {
  const passwordRef = useRef<TextInput>(null);
  return (
    // T-570 (QA 2026-10-18 #4): one reveal group, so focusing either field scrolls the fields,
    // "Forgot password?" and "Sign in" above the keyboard together, not just the focused field.
    <KeyboardRevealGroup style={styles.wrap} testID="login-email-form">
      <View style={styles.fields}>
        <TextField
          label={COPY.emailLabel}
          placeholder={COPY.emailPlaceholder}
          value={email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          disabled={submitting}
          error={errors.email}
          testID="login-email"
        />
        <View style={styles.passwordBlock}>
          <TextField
            ref={passwordRef}
            variant="password"
            label={COPY.passwordLabel}
            placeholder={COPY.passwordPlaceholder}
            value={password}
            onChangeText={onPasswordChange}
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            disabled={submitting}
            error={errors.password}
            testID="login-password"
          />
          <View style={styles.forgot}>
            <Button
              label={COPY.forgot}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={onForgotPassword}
              disabled={submitting}
              testID="login-forgot-password"
            />
          </View>
        </View>
      </View>
      <Button
        label={COPY.submit}
        size="lg"
        onPress={onSubmit}
        loading={submitting}
        accessibilityLabel={submitting ? COPY.submitting : undefined}
        haptic="impactLight"
        testID="login-submit"
      />
    </KeyboardRevealGroup>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[6] },
  fields: { gap: space[4] },
  passwordBlock: { gap: space[2] },
  forgot: { alignItems: 'flex-end' },
});
