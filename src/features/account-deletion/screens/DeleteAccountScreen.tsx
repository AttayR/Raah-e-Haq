import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Banner, Button, ErrorState, Header, Screen, useIsOffline, type BannerTone } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { t } from '../../../i18n';
import { useAppDispatch, type RootState } from '../../../store';
import { getUserProfile } from '../../../store/thunks/apiThunks';
import { layout, space } from '../../../theme';
import { DELETION_CODES, type DeletionBlocker, type DeletionStatus } from '../api';
import {
  BalanceAcknowledge,
  BlockerBanners,
  ConsequenceList,
  ConsequenceSkeleton,
  DeletionHero,
  ReasonChips,
} from '../components/DeletionParts';
import { RestoreHero } from '../components/RestoreHero';
import {
  eraseLines,
  formatDeletionDate,
  formatWait,
  keepLines,
  payNowTarget,
  reasonOptions,
  type BlockerAction,
} from '../format';
import { useDeletionStatus, useSendDeletionCode } from '../hooks';
import { useKeepAccount } from '../keepAccount';
import { useGoToRide } from '../useGoToRide';
import type { AccountDeletionNavigator } from '../navigation';

type Notice = { tone: BannerTone; text: string };

/**
 * Delete account, both roles (UI-R18 §D1; BE-129). Everything on it is the server's answer to
 * GET /account/deletion: the date a request made now would get, what is erased and kept (known
 * keys only), the blockers (each with its way out), the forfeited balance and its checkbox, the
 * driver's "you'll go offline" note and the optional reason. Continue sends the SMS code and
 * opens the code step; any blocker, an unchecked balance, loading or an error keeps it disabled.
 */
export default function DeleteAccountScreen() {
  const navigation = useNavigation<AccountDeletionNavigator>();
  const dispatch = useAppDispatch();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const focused = useIsFocused();
  const role = useSelector((s: RootState) => s.apiAuth.user?.role ?? null);
  const status = useDeletionStatus(focused);
  const { send, sending } = useSendDeletionCode();
  const restore = useKeepAccount();
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const data: DeletionStatus | null = status.data;
  const isDriver = role === 'driver' || data?.isDriver === true;
  const scheduled = data?.state === 'scheduled';
  const hasBalance = !!data && data.walletBalance > 0;
  const blocked = !data || data.blockers.length > 0;
  const canContinue = !!data && !scheduled && !blocked && (!hasBalance || acknowledged) && !sending;

  const openRide = useCallback((route: 'DriverRide' | 'Booking') => navigation.navigate(route), [navigation]);
  const goToRide = useGoToRide(role === 'driver', openRide);

  const onBlockerAction = useCallback(
    (action: BlockerAction, blocker: DeletionBlocker) => {
      if (action === 'goToRide') goToRide().catch(() => undefined);
      else if (action === 'verifyPhone') navigation.navigate('ChangePhone');
      else if (blocker.code === 'COMMISSION_OWED') {
        const target = payNowTarget(blocker, role === 'driver');
        if (target.route === 'PayCommission') navigation.navigate('PayCommission', target.params);
        else navigation.navigate('AddMoney', target.params);
      }
    },
    [navigation, role, goToRide],
  );

  const onContinue = useCallback(async () => {
    if (!data || !canContinue) return;
    setNotice(null);
    const outcome = await send();
    if (!outcome || outcome.kind === 'cancelled') return;
    if (outcome.kind === 'sent') {
      navigation.navigate('DeleteAccountVerify', {
        phoneMasked: outcome.sent.phoneMasked ?? data.phoneMasked,
        retryAfter: outcome.sent.retryAfter,
        scheduledForIfNow: data.scheduledForIfNow,
        acknowledgeBalance: hasBalance && acknowledged,
        reason,
      });
    } else if (outcome.kind === 'wait') {
      setNotice({ tone: 'warning', text: t('accountDeletion.codeWait', { time: formatWait(outcome.retryAfter) }) });
    } else if (outcome.kind === 'stale') {
      // Phone no longer verified, or a deletion was scheduled elsewhere: show the server's state.
      status.refresh();
      if (outcome.code === DELETION_CODES.alreadyScheduled) dispatch(getUserProfile()).catch(() => undefined);
    } else {
      setNotice({ tone: 'danger', text: outcome.message });
    }
  }, [data, canContinue, send, navigation, hasBalance, acknowledged, reason, status, dispatch]);

  const onKeep = useCallback(async () => {
    if (await restore.keep()) navigation.goBack();
  }, [restore, navigation]);

  const date = formatDeletionDate(data?.scheduledForIfNow);
  const footerPadding = Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset);

  return (
    <Screen edges={['top']} testID="delete-account-screen">
      <Header
        tone="background"
        title={t('accountDeletion.title')}
        backLabel={t('accountDeletion.back')}
        onBack={() => navigation.goBack()}
        testID="delete-account-header"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status.status === 'refreshing'}
            onRefresh={status.refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        testID="delete-account-scroll"
      >
        {scheduled ? (
          <RestoreHero scheduledFor={data?.scheduledFor} isDriver={isDriver} />
        ) : (
          <DeletionHero
            title={t('accountDeletion.heroTitle')}
            body={date ? t('accountDeletion.heroBody', { date }) : undefined}
          />
        )}
        {!data && status.status === 'failed' ? (
          <ErrorState
            title={t('accountDeletion.loadFailed')}
            kind={offline ? 'network' : 'server'}
            retryLabel={t('accountDeletion.tryAgain')}
            onRetry={status.reload}
            placement="top"
            testID="delete-account-error"
          />
        ) : null}
        {!data && status.status !== 'failed' ? <ConsequenceSkeleton /> : null}
        {data && !scheduled ? (
          <>
            <BlockerBanners blockers={data.blockers} onAction={onBlockerAction} />
            <ConsequenceList
              overline={t('accountDeletion.eraseOverline')}
              icon="delete"
              lines={eraseLines(data.erase)}
              testID="delete-account-erase"
            />
            <ConsequenceList
              overline={t('accountDeletion.keepOverline')}
              icon="lock"
              lines={keepLines(data.keep)}
              helper={
                data.retentionYears
                  ? t('accountDeletion.keepHelper', { n: data.retentionYears })
                  : t('accountDeletion.keepHelperNoYears')
              }
              testID="delete-account-keep"
            />
            {hasBalance ? (
              <BalanceAcknowledge
                amount={formatMoney(data.walletBalance, { currency: data.currency })}
                checked={acknowledged}
                onChange={setAcknowledged}
              />
            ) : null}
            {isDriver ? <Banner tone="info" text={t('accountDeletion.driverOffline')} testID="delete-account-driver-note" /> : null}
            <ReasonChips options={reasonOptions(data.reasons)} selected={reason} onSelect={setReason} />
          </>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: footerPadding,
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.borderWidth.hairline,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        {notice ? <Banner tone={notice.tone} text={notice.text} testID="delete-account-notice" /> : null}
        {restore.error ? <Banner tone="danger" text={restore.error} testID="delete-account-keep-error" /> : null}
        {scheduled ? (
          <Button
            label={t('accountDeletion.restoreKeep')}
            size="lg"
            onPress={onKeep}
            loading={restore.keeping}
            testID="delete-account-restore"
          />
        ) : (
          <>
            <Button
              label={t('accountDeletion.continue')}
              variant="destructive"
              size="lg"
              onPress={onContinue}
              disabled={!canContinue}
              loading={sending}
              testID="delete-account-continue"
            />
            <Button
              label={t('accountDeletion.keep')}
              variant="ghost"
              size="lg"
              onPress={() => navigation.goBack()}
              testID="delete-account-keep-button"
            />
          </>
        )}
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
    gap: layout.sectionGap,
  },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
    gap: space[2],
  },
});
