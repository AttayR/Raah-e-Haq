import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { RootState } from '../../../store';
import { AppText, Button, Header, OtpInput, Screen, TextField } from '../../../components/ui';
import { formatCountdown, OTP_LENGTH } from '../../../services/otpService';
import { formatPkPhone } from '../../safety/rules';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useChangePhone } from '../useChangePhone';
import type { ProfileEditNavigator } from '../navigation';

/**
 * Change number / Verify your number (T-504b, BE-35), both roles. Step 1: the new Pakistani
 * mobile (kit phone field, +92) → POST /profile/phone. Step 2: the 6-digit code →
 * POST /profile/phone/verify, with Resend after the cooldown and "Cancel change"
 * (DELETE /profile/phone/pending). The account's number never changes before the code is
 * verified, and no refusal here signs out.
 */
export default function ChangePhoneScreen() {
  const navigation = useNavigation<ProfileEditNavigator>();
  const user = useSelector((state: RootState) => state.apiAuth.user);
  const flow = useChangePhone(user, () => navigation.goBack());
  const hasNumber = !!user?.phone;

  const expiry = flow.burned
    ? t('phoneChange.burned')
    : flow.isExpired
      ? t('phoneChange.expired')
      : flow.expiresIn > 0
        ? t('phoneChange.expiresIn', { time: formatCountdown(flow.expiresIn) })
        : null;

  return (
    <Screen testID="change-phone" keyboardAvoiding edges={['top', 'bottom']}>
      <Header
        tone="background"
        title={hasNumber ? t('phoneChange.title') : t('phoneChange.verifyTitle')}
        backLabel={t('phoneChange.back')}
        onBack={() => navigation.goBack()}
        testID="change-phone-header"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {flow.step === 'number' ? (
          <>
            <AppText variant="body" color="textSecondary">
              {hasNumber ? t('phoneChange.intro') : t('phoneChange.introVerify')}
            </AppText>
            {user?.phone ? (
              <AppText variant="bodySmall" color="textSecondary" testID="change-phone-current">
                {t('phoneChange.current', { phone: formatPkPhone(user.phone) })}
              </AppText>
            ) : null}
            <TextField
              variant="phone"
              label={t('phoneChange.phoneLabel')}
              value={flow.digits}
              onChangeText={flow.setDigits}
              error={flow.phoneError}
              autoFocus
              testID="change-phone-number"
            />
            {flow.error ? <ErrorLine text={flow.error} /> : null}
            <Button
              label={
                flow.resendIn > 0
                  ? t('phoneChange.resendIn', { time: formatCountdown(flow.resendIn) })
                  : t('phoneChange.sendCode')
              }
              onPress={flow.send}
              loading={flow.busy === 'send'}
              disabled={flow.resendIn > 0 || (flow.busy !== null && flow.busy !== 'send')}
              testID="change-phone-send"
            />
          </>
        ) : (
          <>
            <AppText variant="h3" accessibilityRole="header">
              {t('phoneChange.codeTitle')}
            </AppText>
            <AppText variant="body" color="textSecondary" testID="change-phone-sent-to">
              {t('phoneChange.codeSentTo', { phone: formatPkPhone(flow.pendingPhone ?? '') })}
            </AppText>
            <OtpInput
              label={t('phoneChange.codeLabel')}
              value={flow.code}
              onChange={flow.setCode}
              onComplete={(entered) => flow.verify(entered)}
              length={OTP_LENGTH}
              error={flow.error}
              disabled={!flow.canVerify || flow.busy !== null}
              autoFocus
              testID="change-phone-code"
            />
            {expiry && !flow.error ? (
              <AppText variant="bodySmall" color={flow.isExpired || flow.burned ? 'danger' : 'textSecondary'}>
                {expiry}
              </AppText>
            ) : null}
            <Button
              label={t('phoneChange.verify')}
              onPress={() => flow.verify()}
              loading={flow.busy === 'verify'}
              disabled={!flow.canVerify || flow.code.length !== OTP_LENGTH || (flow.busy !== null && flow.busy !== 'verify')}
              haptic="impactLight"
              testID="change-phone-verify"
            />
            <View style={styles.secondary}>
              <Button
                variant="ghost"
                label={
                  flow.resendIn > 0
                    ? t('phoneChange.resendIn', { time: formatCountdown(flow.resendIn) })
                    : t('phoneChange.resend')
                }
                onPress={flow.resend}
                loading={flow.busy === 'send'}
                disabled={flow.resendIn > 0 || (flow.busy !== null && flow.busy !== 'send')}
                testID="change-phone-resend"
              />
              <Button
                variant="ghost"
                label={t('phoneChange.useAnother')}
                onPress={flow.chooseAnotherNumber}
                disabled={flow.busy !== null}
                testID="change-phone-another"
              />
              <Button
                variant="destructiveSoft"
                label={t('phoneChange.cancelChange')}
                onPress={flow.cancel}
                loading={flow.busy === 'cancel'}
                disabled={flow.busy !== null && flow.busy !== 'cancel'}
                testID="change-phone-cancel"
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="change-phone-error">
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[8],
    gap: space[4],
  },
  secondary: { gap: space[2] },
});
