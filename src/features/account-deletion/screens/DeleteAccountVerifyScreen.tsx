import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, Button, Header, OtpInput, Screen } from '../../../components/ui';
import { toApiError } from '../../../core/api/errors';
import { confirm } from '../../../core/dialog';
import { triggerHaptic } from '../../../core/haptics';
import { toast } from '../../../core/toast';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useLogout } from '../../../hooks/useLogout';
import { t } from '../../../i18n';
import { useAppDispatch } from '../../../store';
import { getUserProfile } from '../../../store/thunks/apiThunks';
import { componentTokens, layout, space } from '../../../theme';
import { accountDeletionApi, DELETION_CODES } from '../api';
import { formatDeletionDate, formatWait, keepTogether } from '../format';
import { requestFailureOf, type Notice } from '../requestFailure';
import { useCountdown, useSendDeletionCode } from '../hooks';
import type { AccountDeletionNavigator, AccountDeletionRoutes } from '../navigation';

const CODE_LENGTH = 6;

/**
 * "Confirm it's you" (UI-R18 §D2): the 6-digit SMS code sent from Delete account, a resend
 * countdown from the server's `retry_after`, and "Delete my account" behind a destructive
 * Dialog. On 200 the server has already revoked every token, so the app signs out locally
 * (`serverAlreadySignedOut`, no /auth/logout) and the Login screen gets the date Toast.
 */
export default function DeleteAccountVerifyScreen() {
  const navigation = useNavigation<AccountDeletionNavigator>();
  const { params } = useRoute<RouteProp<AccountDeletionRoutes, 'DeleteAccountVerify'>>();
  const dispatch = useAppDispatch();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardVisible();
  const { signOut } = useLogout();
  const { send, sending } = useSendDeletionCode();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [wait, setWait] = useState({ seconds: params.retryAfter, key: 0 });
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const left = useCountdown(wait.seconds, wait.key);

  const restartWait = (seconds: number) => setWait((current) => ({ seconds, key: current.key + 1 }));

  const onResend = useCallback(async () => {
    setNotice(null);
    const outcome = await send();
    if (!outcome || outcome.kind === 'cancelled') return;
    if (outcome.kind === 'sent') {
      setCode('');
      setCodeError(null);
      restartWait(outcome.sent.retryAfter);
      toast.success(t('accountDeletion.codeResent'));
    } else if (outcome.kind === 'wait') {
      restartWait(outcome.retryAfter);
    } else if (outcome.kind === 'stale') {
      if (outcome.code === DELETION_CODES.alreadyScheduled) dispatch(getUserProfile()).catch(() => undefined);
      navigation.goBack();
    } else {
      setNotice({ tone: 'danger', text: outcome.message });
    }
  }, [send, dispatch, navigation]);

  const onDelete = useCallback(async () => {
    if (inFlight.current || code.length !== CODE_LENGTH) return;
    const date = formatDeletionDate(params.scheduledForIfNow);
    const confirmed = await confirm({
      title: t('accountDeletion.confirmTitle'),
      body: date ? t('accountDeletion.confirmBody', { date }) : t('accountDeletion.confirmBodyNoDate'),
      confirmLabel: t('accountDeletion.confirmAction'),
      cancelLabel: t('accountDeletion.cancel'),
      destructive: true,
      // §D2.4: stacked, destructive on top.
      layout: 'stacked',
    });
    if (!confirmed) return;
    inFlight.current = true;
    setDeleting(true);
    setNotice(null);
    setCodeError(null);
    try {
      const scheduledFor = await accountDeletionApi.request({
        code,
        reason: params.reason,
        acknowledgeBalance: params.acknowledgeBalance,
      });
      // Tokens and push devices are already gone on the server: clear the session here only.
      await signOut({ serverAlreadySignedOut: true });
      const closedOn = formatDeletionDate(scheduledFor);
      toast.show({
        type: 'success',
        title: closedOn ? t('accountDeletion.closedToast', { date: closedOn }) : t('accountDeletion.closedToastNoDate'),
        duration: 4000,
      });
    } catch (cause: unknown) {
      const error = toApiError(cause);
      if (error.kind === 'cancelled' || !mounted.current) return;
      const failure = requestFailureOf(error);
      if (failure.kind === 'code') {
        triggerHaptic('notificationError');
        setCode('');
        setCodeError(failure.message);
        if (failure.retryAfter !== undefined) restartWait(failure.retryAfter);
      } else if (failure.kind === 'back') {
        if (failure.reprofile) dispatch(getUserProfile()).catch(() => undefined);
        navigation.goBack();
      } else {
        setNotice(failure.notice);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setDeleting(false);
    }
  }, [code, params, signOut, dispatch, navigation]);

  return (
    <Screen keyboardAvoiding testID="delete-account-verify-screen">
      <Header
        tone="background"
        title={t('accountDeletion.verifyTitle')}
        backLabel={t('accountDeletion.back')}
        onBack={() => navigation.goBack()}
        testID="delete-account-verify-header"
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="body" color="textSecondary" testID="delete-account-verify-body">
          {params.phoneMasked
            ? t('accountDeletion.verifyBody', { phone: keepTogether(params.phoneMasked) })
            : t('accountDeletion.verifyBodyNoPhone')}
        </AppText>
        <View style={styles.otp}>
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (codeError) setCodeError(null);
            }}
            length={CODE_LENGTH}
            error={codeError}
            disabled={deleting}
            autoFocus
            testID="delete-account-code"
          />
        </View>
        <View style={styles.resend} testID="delete-account-resend-row">
          {left > 0 ? (
            <AppText variant="caption" color="textMuted" testID="delete-account-resend-wait">
              {t('accountDeletion.resendIn', { time: formatWait(left) })}
            </AppText>
          ) : (
            // §D2.3: the visible label starts where the countdown caption did (the button's own
            // inset is pulled back), so nothing jumps when the countdown ends.
            <View style={styles.resendButton} testID="delete-account-resend-wrap">
              <Button
                label={t('accountDeletion.resend')}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={onResend}
                loading={sending}
                disabled={deleting}
                testID="delete-account-resend"
              />
            </View>
          )}
        </View>
        {notice ? <Banner tone={notice.tone} text={notice.text} testID="delete-account-verify-notice" /> : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            // Above the keyboard the home-indicator inset is covered: only the 16 minimum.
            paddingBottom: keyboardUp
              ? layout.bottomActionMinOffset
              : Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset),
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.borderWidth.hairline,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Button
          label={t('accountDeletion.deleteMyAccount')}
          variant="destructive"
          size="lg"
          onPress={onDelete}
          disabled={code.length !== CODE_LENGTH || deleting}
          loading={deleting}
          testID="delete-account-confirm"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
    paddingBottom: space[6],
  },
  otp: { marginTop: space[6] },
  resend: { marginTop: space[4], alignItems: 'flex-start', justifyContent: 'center', minHeight: layout.touchTargetIOS },
  resendButton: { marginStart: -componentTokens.button.paddingHorizontal.sm },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
  },
});
