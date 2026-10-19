import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText, Button, KeyboardAwareScrollView, Screen, SegmentedControl } from '../../components/ui';
import { useApiAuth } from '../../hooks/useApiAuth';
import { toast } from '../../core/toast';
import { haptics } from '../../core/haptics';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalParts, REFUSAL_TOAST_DURATION_MS } from '../../core/auth/accountRefusal';
import { routesHome } from '../../core/auth/normalizeUser';
import { forgotPassword, loginUser } from '../../store/thunks/apiThunks';
import { layout, space } from '../../theme';
import AuthIntro from '../../features/auth/components/AuthIntro';
import LoginEmailForm from '../../features/auth/components/LoginEmailForm';
import ForgotPasswordSheet, { type ForgotPasswordResult } from '../../features/auth/components/ForgotPasswordSheet';
import { LOGIN_COPY as COPY } from '../../features/auth/copy/login';
import { inlineLoginErrors, validateLogin, type LoginFieldErrors } from '../../features/auth/loginValidation';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import { perLocale } from '../../i18n';

type LoginMethod = 'phone' | 'email';

const METHODS = perLocale(() => [
  { value: 'phone', label: COPY.methods.phone },
  { value: 'email', label: COPY.methods.email },
] as const);

/**
 * Sign in (UI-R6, spec auth-login; absorbs T-603). Form archetype on the theme background, no
 * hero or wallpaper: logo badge, title, Phone | Email segments, then "New to Raah-e-Haq? Create
 * account" at the end of the content (pinned to the bottom on tall screens, after the form on
 * short ones, so nothing clips it). The kit scroll view keeps the focused field above the
 * keyboard and lets the first tap with the keyboard up reach the button (T-204).
 */
export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { login, isLoading, clearAuthError, forgotPasswordRequest } = useApiAuth();

  const route = useRoute<RouteProp<AuthStackParamList, 'Login'>>();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(route.params?.method ?? 'phone');

  // PhoneAuth's "Sign in with email" comes back here with method 'email' (T-113). Each return
  // is a new params object, so the tab switches every time, even after the user changed it.
  useEffect(() => {
    if (route.params?.method) {
      setLoginMethod(route.params.method);
    }
  }, [route.params]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // One sign-in at a time: a second tap lands before isLoading re-renders the button (T-107).
  const signInInFlight = useRef(false);

  // The auth error is shared with PhoneAuth and Signup: clear it whenever Login is shown
  // again (mount and every focus, e.g. back from PhoneAuth), so an old one never shows.
  useEffect(() => {
    clearAuthError();
    return navigation.addListener('focus', () => clearAuthError());
  }, [navigation, clearAuthError]);

  const go = (target: 'PhoneAuth' | 'Signup') => {
    try {
      setFieldErrors({});
      navigation.navigate(target);
    } catch (err) {
      logger.error('Navigation error:', err);
      toast.error(COPY.toasts.navigation);
    }
  };

  const handleEmailSignIn = async () => {
    if (signInInFlight.current) {
      return;
    }
    signInInFlight.current = true;
    try {
      clearAuthError();
      const errors = validateLogin(email, password);
      setFieldErrors(errors);
      if (errors.email || errors.password) {
        haptics.notificationError();
        return;
      }

      setSubmitting(true);
      // The password is sent exactly as typed: spaces can be part of it (T-204, AUTH-14).
      const result = await login({ email: email.trim(), password });

      if (loginUser.fulfilled.match(result)) {
        // Only when it opens a home screen: a pending/blocked/admin account lands on account
        // status, which explains itself (T-106). Navigation is handled by AuthFlow.
        if (routesHome(result.payload.user)) {
          toast.success(COPY.toasts.success);
        }
        return;
      }

      haptics.notificationError();
      const rejection = loginUser.rejected.match(result) ? result.payload : undefined;
      logger.debug('Login failed', { kind: rejection?.kind, status: rejection?.status, code: rejection?.code });
      // One message per failure (T-603): wrong credentials next to the fields, anything else a toast.
      const inline = inlineLoginErrors(rejection, COPY.toasts.failed);
      if (inline) {
        setFieldErrors(inline);
        return;
      }
      // 403 ACCOUNT_*: the server's message, plus the rejection reason as the second line (T-106).
      const { message, reason } = accountRefusalParts(rejection, COPY.toasts.failed);
      toast.error(message, reason ?? undefined, reason ? { duration: REFUSAL_TOAST_DURATION_MS } : undefined);
    } catch (err: unknown) {
      logger.error('Email sign in error:', err);
      toast.error(COPY.toasts.unexpected);
    } finally {
      signInInFlight.current = false;
      setSubmitting(false);
    }
  };

  const requestReset = async (address: string): Promise<ForgotPasswordResult> => {
    clearAuthError();
    const result = await forgotPasswordRequest(address);
    if (forgotPassword.fulfilled.match(result)) {
      return { ok: true, message: result.payload || null };
    }
    return { ok: false, message: rejectionMessage(result.payload, COPY.forgot.failed) };
  };

  const changeMethod = (method: LoginMethod) => {
    setFieldErrors({});
    // An error from the other method must not show under this one.
    clearAuthError();
    setLoginMethod(method);
  };

  const busy = submitting || isLoading;

  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} testID="login">
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="login-scroll"
      >
        <View style={styles.main}>
          <AuthIntro logo brandBar title={COPY.title} subtitle={COPY.subtitle} testID="login-intro" />
          <View style={styles.form}>
            <SegmentedControl
              options={METHODS()}
              value={loginMethod}
              onChange={changeMethod}
              accessibilityLabel={COPY.methodA11y}
              disabled={busy}
              testID="login-method"
            />
            {loginMethod === 'phone' ? (
              <View style={styles.phone} testID="login-phone">
                <AppText variant="bodySmall" color="textSecondary">
                  {COPY.phone.hint}
                </AppText>
                <Button
                  label={COPY.phone.action}
                  size="lg"
                  onPress={() => go('PhoneAuth')}
                  disabled={busy}
                  trailingIcon="arrowForward"
                  testID="login-phone-continue"
                />
              </View>
            ) : (
              <LoginEmailForm
                email={email}
                password={password}
                onEmailChange={(text) => {
                  setEmail(text);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                onPasswordChange={(text) => {
                  setPassword(text);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                errors={fieldErrors}
                submitting={submitting}
                onSubmit={handleEmailSignIn}
                onForgotPassword={() => setForgotOpen(true)}
              />
            )}
          </View>
        </View>

        <View style={styles.footer} testID="login-footer">
          <AppText variant="bodySmall" color="textSecondary">
            {COPY.footer.prompt}
          </AppText>
          <Button
            label={COPY.footer.action}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => go('Signup')}
            disabled={busy}
            testID="login-create-account"
          />
        </View>
      </KeyboardAwareScrollView>

      <ForgotPasswordSheet
        visible={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
        onSubmit={requestReset}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // flexGrow + space-between: the footer sits at the bottom on tall screens and follows the form
  // (min 32 below it) when the content is taller than the screen (font scaling, small phones).
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingBottom: space[4],
    gap: space[8],
  },
  main: { gap: space[8] },
  form: { gap: space[6] },
  phone: { gap: space[6] },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
});
