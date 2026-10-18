import React, { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Header,
  HeaderLargeTitle,
  ListGroup,
  ListItem,
  Screen,
  SegmentedControl,
  Skeleton,
  SkeletonCard,
  SkeletonGroup,
  SkeletonList,
  TextField,
  useHeaderScroll,
} from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { formatMoney } from '../../../core/format/money';
import {
  LOGOUT_CONFIRM_BUTTON,
  LOGOUT_CONFIRM_MESSAGE,
  LOGOUT_CONFIRM_TITLE,
} from '../../../hooks/useLogout';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { BalanceCard } from '../../wallet/components/BalanceCard';
import { CommissionCard } from '../../wallet/components/CommissionCard';
import { SettlementRow } from '../../wallet/components/SettlementRow';
import { TransactionRow } from '../../wallet/components/TransactionRow';
import { WALLET_COPY } from '../../wallet/copy';
import { validateSettlementForm } from '../../wallet/settlementForm';
import type { Wallet } from '../../wallet/types';
import {
  galleryDriverWallet,
  galleryEmptyPassengerWallet,
  galleryPassengerWallet,
  gallerySettlements,
  galleryTransactions,
} from '../fixtures/walletFixtures';

/**
 * Debug kit gallery: the migrated wallet screens' states (UI-R3), composed from the same kit
 * pieces and wallet components the screens use, fed by API-shaped fixtures through the real
 * mappers. Shown full screen with `-RHKitGallerySection screen-…` for design screenshots;
 * product screens never import this.
 */
const noop = () => {};
const sk = componentTokens.skeleton.heights;
/**
 * The gallery opens in a sliding native Modal. Content laid out during that slide can measure a
 * zero width (BalanceCard's auto-fitting balance then shrinks to a sliver) and a second Modal
 * cannot be presented until the slide ends, so previews mount once it is over.
 */
const AFTER_MODAL_SLIDE_MS = 900;

function useAfterModalSlide(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), AFTER_MODAL_SLIDE_MS);
    return () => clearTimeout(timer);
  }, []);
  return ready;
}

function WalletHeader({ title = WALLET_COPY.title }: { title?: string }) {
  return (
    <Header
      title={title}
      onBack={noop}
      backLabel={WALLET_COPY.back}
      tone="background"
    />
  );
}

const FILTERS = [
  { value: 'all', label: WALLET_COPY.filterAll },
  { value: 'credit', label: WALLET_COPY.filterIn },
  { value: 'debit', label: WALLET_COPY.filterOut },
] as const;

function WalletTop({ driver, wallet: given }: { driver: boolean; wallet?: Wallet }) {
  const wallet = given ?? (driver ? galleryDriverWallet : galleryPassengerWallet);
  return (
    <View style={styles.block}>
      <BalanceCard wallet={wallet} isDriver={driver} />
      <Banner
        tone="info"
        icon="cash"
        title={WALLET_COPY.cashOnlyTitle}
        text={
          driver ? WALLET_COPY.cashOnlyDriver : WALLET_COPY.cashOnlyPassenger
        }
      />
      {driver ? (
        <CommissionCard
          wallet={wallet}
          onPay={noop}
          onOpenReports={noop}
          onCancel={noop}
          cancellingId={null}
        />
      ) : null}
      <AppText
        variant="overline"
        color="textMuted"
        accessibilityRole="header"
        style={styles.section}
      >
        {WALLET_COPY.transactions}
      </AppText>
      {/* UI-R15: the live wallet filters are FilterChips, not a segmented control. */}
      <FilterChips
        options={FILTERS}
        value="all"
        onChange={noop}
        accessibilityLabel={WALLET_COPY.filterLabel}
      />
    </View>
  );
}

export function WalletLoadedPreview() {
  const ready = useAfterModalSlide();
  return (
    <Screen testID="preview-wallet">
      <WalletHeader />
      {!ready ? null : (
        /* A FlatList with a header, like WalletScreen's SectionList. */
        <FlatList
          data={galleryTransactions}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TransactionRow item={item} onPress={noop} />
          )}
          ListHeaderComponent={<WalletTop driver />}
          contentContainerStyle={styles.content}
        />
      )}
    </Screen>
  );
}

export function WalletSkeletonPreview() {
  return (
    <Screen testID="preview-wallet-skeleton">
      <WalletHeader />
      <SkeletonList heroHeight={sk.walletHero} rows={5} />
    </Screen>
  );
}

export function WalletErrorPreview() {
  return (
    <Screen testID="preview-wallet-error">
      <WalletHeader />
      <ErrorState
        kind="network"
        title={WALLET_COPY.loadFailed}
        body={t('kitGallery.errorNetworkBody')}
        onRetry={noop}
      />
    </Screen>
  );
}

const ACTIVITY_SEGMENTS = [
  { value: 'rides', label: t('activity.rides') },
  { value: 'wallet', label: t('activity.wallet') },
] as const;

/** UI-R15: a new passenger's wallet as it appears in Activity › Wallet (Rs 0, empty ledger). */
export function WalletEmptyPreview() {
  const ready = useAfterModalSlide();
  return (
    <Screen testID="preview-wallet-empty">
      <Header variant="large" inlineTitle title={t('activity.title')} tone="background" />
      <View style={styles.segments}>
        <SegmentedControl
          options={ACTIVITY_SEGMENTS}
          value="wallet"
          onChange={noop}
          accessibilityLabel={t('activity.segmentLabel')}
        />
      </View>
      {ready ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={<WalletTop driver={false} wallet={galleryEmptyPassengerWallet} />}
          ListEmptyComponent={
            <EmptyState
              placement="center"
              icon="activity"
              title={WALLET_COPY.emptyTitle}
              body={WALLET_COPY.emptyBody}
            />
          }
          contentContainerStyle={[styles.content, styles.grow]}
        />
      ) : null}
    </Screen>
  );
}

export function SettlementsPreview({
  state,
}: {
  state: 'loaded' | 'empty' | 'error' | 'skeleton';
}) {
  return (
    <Screen testID={`preview-settlements-${state}`}>
      <WalletHeader title={WALLET_COPY.settlementsTitle} />
      {state === 'loaded' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {gallerySettlements.map(s => (
            <SettlementRow key={s.id} settlement={s} onCancel={noop} />
          ))}
        </ScrollView>
      ) : state === 'empty' ? (
        <EmptyState
          icon="receipt"
          title={WALLET_COPY.settlementsEmptyTitle}
          body={WALLET_COPY.settlementsEmptyBody}
        />
      ) : state === 'error' ? (
        <ErrorState
          title={WALLET_COPY.settlementsFailed}
          body={t('kitGallery.errorServerBody')}
          onRetry={noop}
        />
      ) : (
        <SkeletonList rows={6} leading="none" />
      )}
    </Screen>
  );
}

export function PayCommissionPreview() {
  const owed = galleryDriverWallet.commissionOwed;
  // The real form validation: 200 against Rs 116 owed gives the screen's own error copy.
  const check = validateSettlementForm(
    { amount: '200', method: 'bank_transfer', reference: 'IBFT-123', note: '' },
    owed,
    'PKR',
  );
  const amountError = check.ok ? undefined : check.errors.amount;
  return (
    <Screen testID="preview-pay" keyboardAvoiding>
      <WalletHeader title={WALLET_COPY.formTitle} />
      <ScrollView contentContainerStyle={[styles.content, styles.form]}>
        <Card>
          <AppText variant="caption" color="textSecondary">
            {WALLET_COPY.formOwed}
          </AppText>
          <AppText variant="numericL">
            {formatMoney(owed, { currency: 'PKR' })}
          </AppText>
        </Card>
        <TextField
          label={WALLET_COPY.formAmount}
          value="200"
          onChangeText={noop}
          keyboardType="decimal-pad"
          error={amountError}
        />
        <View style={styles.field}>
          <AppText variant="label" color="textSecondary">
            {WALLET_COPY.formMethod}
          </AppText>
          <SegmentedControl
            options={[
              { value: 'cash', label: WALLET_COPY.methodCash },
              { value: 'bank_transfer', label: WALLET_COPY.methodBank },
            ]}
            value="bank_transfer"
            onChange={noop}
            accessibilityLabel={WALLET_COPY.formMethod}
          />
        </View>
        <TextField
          label={WALLET_COPY.formReference}
          value="IBFT-123"
          onChangeText={noop}
          helper={WALLET_COPY.formReferenceHint}
        />
        <Banner tone="info" icon="info" text={WALLET_COPY.formInfo} />
        <Button label={WALLET_COPY.formSubmit} onPress={noop} />
      </ScrollView>
    </Screen>
  );
}

export function TransactionPreview({ state }: { state: 'skeleton' | 'error' }) {
  return (
    <Screen testID={`preview-transaction-${state}`}>
      <WalletHeader title={WALLET_COPY.detailTitle} />
      {state === 'error' ? (
        <ErrorState
          title={WALLET_COPY.detailFailed}
          body={t('kitGallery.errorServerBody')}
          onRetry={noop}
        />
      ) : (
        <SkeletonGroup style={styles.detail}>
          <View style={styles.hero}>
            <Skeleton width={56} height={56} shape="pill" />
            <Skeleton width="50%" textVariant="numericXL" />
            <Skeleton width="35%" textVariant="bodySmall" />
          </View>
          <SkeletonCard height={sk.detailCard} />
        </SkeletonGroup>
      )}
    </Screen>
  );
}

/** The live sign-out dialog (real `confirm()` + DialogHost Modal) over the wallet. */
export function SignOutDialogPreview() {
  useEffect(() => {
    const timer = setTimeout(() => {
      confirm({
        title: LOGOUT_CONFIRM_TITLE,
        body: LOGOUT_CONFIRM_MESSAGE,
        confirmLabel: LOGOUT_CONFIRM_BUTTON,
        destructive: true,
      });
    }, AFTER_MODAL_SLIDE_MS * 2);
    return () => clearTimeout(timer);
  }, []);
  return <WalletLoadedPreview />;
}

/** `large` Header on a tab root: at rest, or scrolled past the collapse range. */
export function LargeTitlePreview({ scrolled }: { scrolled: boolean }) {
  const { scrollY, onScroll } = useHeaderScroll();
  const ref = useRef<Animated.ScrollView>(null);
  useEffect(() => {
    if (!scrolled) return undefined;
    const timer = setTimeout(
      () => ref.current?.scrollTo({ y: 160, animated: true }),
      800,
    );
    return () => clearTimeout(timer);
  }, [scrolled]);
  const title = t('kitGallery.headerLarge');
  return (
    <Screen testID="preview-large-title">
      <Header
        variant="large"
        title={title}
        scrollY={scrollY}
        tone="background"
      />
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.largeContent}
      >
        <HeaderLargeTitle title={title} scrollY={scrollY} />
        <View style={styles.block}>
          {[0, 1, 2].map(g => (
            <ListGroup key={g} title={t('kitGallery.groupAccount')}>
              <ListItem
                title={t('kitGallery.rowSavedPlaces')}
                icon="bookmark"
                onPress={noop}
              />
              <ListItem
                title={t('kitGallery.rowAppearance')}
                icon="theme"
                value={t('kitGallery.rowAppearanceValue')}
                onPress={noop}
                chevron
              />
              <ListItem
                title={t('kitGallery.rowNotifications')}
                icon="bell"
                onPress={noop}
              />
            </ListGroup>
          ))}
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: space[8],
  },
  grow: { flexGrow: 1 },
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  block: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
    gap: space[3],
  },
  section: { marginTop: space[3] },
  form: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[4] },
  field: { gap: space[1] },
  detail: { paddingHorizontal: space[4], gap: space[4] },
  hero: { alignItems: 'center', gap: space[2], paddingVertical: space[4] },
  largeContent: { paddingBottom: space[16] },
});
