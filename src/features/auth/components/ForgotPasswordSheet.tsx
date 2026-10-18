import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, BottomSheet, Button, Icon, TextField } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { logger } from '../../../core/logging/logger';
import { componentTokens, layout, space } from '../../../theme';
import { LOGIN_COPY } from '../copy/login';
import { isValidEmail } from '../loginValidation';

const COPY = LOGIN_COPY.forgot;

/** What the screen's forgot-password request resolves to (useApiAuth.forgotPasswordRequest). */
export type ForgotPasswordResult = { ok: true; message: string | null } | { ok: false; message: string };

interface Props {
  visible: boolean;
  /** The email typed on Login, so the user does not type it twice. */
  initialEmail: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<ForgotPasswordResult>;
}

/**
 * Forgot password (UI-R6, spec auth-forgot-password): a modal sheet over Login. Email → "Send
 * reset link"; once sent the content swaps to "Check your email" with the server's message (the
 * same whether or not the account exists, BE-27). A refusal shows under the field, inside the
 * sheet (a toast would sit behind the modal). The reset itself happens on the emailed web link.
 */
export default function ForgotPasswordSheet({ visible, initialEmail, onClose, onSubmit }: Props) {
  const { theme } = useAppTheme();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ email: string; message: string | null } | null>(null);
  const inFlight = useRef(false);

  // Every opening starts fresh, prefilled with what Login has.
  useEffect(() => {
    if (visible) {
      setEmail(initialEmail.trim());
      setError(null);
      setSent(null);
    }
  }, [visible, initialEmail]);

  const close = () => {
    if (!sending) onClose();
  };

  const submit = async () => {
    const value = email.trim();
    if (!value) {
      setError(LOGIN_COPY.validation.emailRequired);
      return;
    }
    if (!isValidEmail(value)) {
      setError(LOGIN_COPY.validation.emailInvalid);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSending(true);
    try {
      const result = await onSubmit(value);
      if (result.ok) {
        setSent({ email: value, message: result.message });
      } else {
        haptics.notificationError();
        setError(result.message || COPY.failed);
      }
    } catch (err: unknown) {
      logger.error('Password reset error:', err);
      haptics.notificationError();
      setError(COPY.failed);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const footer = sent ? (
    <Button label={COPY.done} size="lg" onPress={onClose} testID="forgot-password-done" />
  ) : (
    <View style={styles.footer}>
      <Button
        label={COPY.submit}
        size="lg"
        onPress={submit}
        loading={sending}
        haptic="impactLight"
        testID="forgot-password-submit"
      />
      <Button label={COPY.cancel} variant="ghost" size="lg" onPress={close} disabled={sending} testID="forgot-password-cancel" />
    </View>
  );

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={close}
      accessibilityLabel={COPY.sheetA11y}
      contentKey={sent ? 'sent' : 'form'}
      footer={footer}
      testID="forgot-password-sheet"
    >
      {sent ? (
        <View style={styles.body} testID="forgot-password-sent">
          <View style={[styles.glyph, { backgroundColor: theme.colors.successSoft }]}>
            <Icon name="email" size={32} color="success" />
          </View>
          <AppText variant="h3" accessibilityRole="header">
            {COPY.sentTitle}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {sent.message || COPY.sentBody(sent.email)}
          </AppText>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <AppText variant="h2" accessibilityRole="header">
              {COPY.title}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary">
              {COPY.body}
            </AppText>
          </View>
          <TextField
            label={LOGIN_COPY.email.emailLabel}
            placeholder={LOGIN_COPY.email.emailPlaceholder}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={submit}
            disabled={sending}
            error={error}
            testID="forgot-password-email"
          />
        </View>
      )}
    </BottomSheet>
  );
}

const glyph = componentTokens.auth.sentGlyph;

const styles = StyleSheet.create({
  // The sheet pads only its footer; the body takes the same side gutter (T-543).
  body: { gap: space[6], paddingHorizontal: layout.gutter, paddingTop: space[2] },
  titleBlock: { gap: space[2] },
  footer: { gap: space[2] },
  glyph: { width: glyph, height: glyph, borderRadius: glyph / 2, alignItems: 'center', justifyContent: 'center' },
});
