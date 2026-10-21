import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PassengerStackParamList } from '../../../app/navigation/stacks/PassengerStack';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, Button, EmptyState, ErrorState, Header, KeyboardAwareScrollView, Screen, SkeletonList } from '../../../components/ui';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useNativeLocation } from '../../../hooks/useNativeLocation';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { topUpParamsFor } from '../../wallet/navigation';
import { OfferStepper } from '../../fare/components/OfferStepper';
import { ParcelDeclaration } from '../components/ParcelDeclaration';
import { ParcelDetailsSection } from '../components/ParcelDetailsSection';
import { ParcelRouteSection } from '../components/ParcelRouteSection';
import { useParcelOptions } from '../hooks';
import { useSendParcel, type SendParcelForm } from '../useSendParcel';
import { useBookingCooldownSeconds } from '../../ride-booking/bookingCooldown';
import { formatCountdown } from '../../safety/pin';

type Nav = NativeStackNavigationProp<PassengerStackParamList>;

/**
 * The quote line above "Send parcel": the server's fare for this route, never a local guess, or
 * the sender's offer inside the server's band (T-559, BE-83).
 */
function FareLine({ form }: { form: SendParcelForm }) {
  const { estimates, quote, offer } = form;
  const amount = quote ? (offer.band ? offer.value ?? quote.fare : quote.fare) : null;
  let text: string | null = null;
  if (estimates.status === 'loading') text = t('parcel.fareLoading');
  else if (estimates.status === 'error') text = estimates.error ?? t('parcel.fareFailed');
  else if (estimates.status === 'ready' && !quote) text = t('parcel.fareNone');
  return (
    <View style={styles.fareRow} testID="parcel-fare">
      <AppText variant="label" color="textSecondary">
        {t('parcel.fareLabel')}
      </AppText>
      {quote && amount !== null ? (
        <AppText variant="numericL" testID="parcel-fare-amount">
          {formatMoney(amount, quote.currency)}
        </AppText>
      ) : text ? (
        <AppText variant="bodySmall" color={estimates.status === 'error' ? 'danger' : 'textSecondary'} testID="parcel-fare-status">
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * "Send parcel". While a BOOKING_COOLDOWN (429) runs it is disabled as "Send again in m:ss"; only
 * this button re-renders each second.
 */
function SendParcelButton({ form }: { form: SendParcelForm }) {
  const cooldown = useBookingCooldownSeconds();
  const label = form.submitting
    ? t('parcel.booking')
    : cooldown > 0
      ? t('parcel.bookIn', { time: formatCountdown(cooldown) })
      : t('parcel.book');
  return (
    <Button
      label={label}
      size="lg"
      haptic="impactLight"
      leadingIcon="parcel"
      onPress={form.submit}
      loading={form.submitting}
      // Without both points the press shows what is missing; with them it needs the fare.
      disabled={(form.estimates.status !== 'idle' && !form.quote) || cooldown > 0}
      testID="send-parcel-submit"
    />
  );
}

/**
 * Passenger Home → "Send a parcel" (T-522, BE-88): pickup and drop-off, the receiver, what is
 * sent (category, size, declared value), the prohibited list with the declaration, and the
 * server's fare, with an offer inside its band (T-559). "Send parcel" books a ride of type `parcel` (cash at the pickup, no stops, no
 * cash on delivery) and opens it on the booking screen. Every list and limit comes from
 * GET /parcels/options.
 */
export default function SendParcelScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const options = useParcelOptions(isFocused);
  const { currentLocation } = useNativeLocation({ active: isFocused });
  const form = useSendParcel(options.data, currentLocation, {
    // The ride replaces the form, so Back from the ride goes Home.
    onBooked: () => navigation.replace('Booking'),
    onPhoneNotVerified: () => navigation.navigate('Profile'),
    onBalanceOwed: (owed) => navigation.navigate('AddMoney', topUpParamsFor(owed)),
    onRulesChanged: options.reload,
  });
  const opts = options.data;

  let body: React.ReactNode;
  if (opts && !opts.tierActive) {
    body = <EmptyState icon="parcel" title={t('parcel.unavailableTitle')} body={t('parcel.unavailableBody')} testID="send-parcel-unavailable" />;
  } else if (opts) {
    body = (
      <>
        <ParcelRouteSection
          anchor={form.anchor}
          pickup={form.pickup}
          pickupIsGps={form.pickupIsGps}
          dropoff={form.dropoff}
          near={currentLocation}
          pickupError={form.errors.pickup}
          dropoffError={form.errors.dropoff}
          onPickup={form.setPickup}
          onDropoff={form.setDropoff}
        />
        <ParcelDetailsSection options={opts} draft={form.draft} errors={form.errors} update={form.update} anchor={form.anchor} />
        <ParcelDeclaration
          items={opts.prohibitedItems}
          declaration={opts.declaration}
          accepted={form.draft.declarationAccepted}
          onChange={(on) => form.update('declarationAccepted', on, 'declaration')}
          error={form.errors.declaration}
          anchorRef={form.anchor('declaration')}
        />
        {form.quote && form.offer.band ? <OfferStepper offer={form.offer} testID="parcel-offer" /> : null}
        <Banner tone="info" icon="cash" text={t('parcel.noCod')} testID="send-parcel-cash" />
      </>
    );
  } else if (options.status === 'failed') {
    body = <ErrorState title={t('parcel.loadFailed')} body={options.error ?? undefined} retryLabel={t('parcel.retry')} onRetry={options.reload} testID="send-parcel-error" />;
  } else {
    body = <SkeletonList rows={4} testID="send-parcel-loading" />;
  }

  const ready = !!opts && opts.tierActive;
  // T-561: while typing (a place search, the receiver's number) the footer steps aside, so the
  // suggestions and the field keep the space above the keyboard; it is back once it closes.
  const keyboardUp = useKeyboardVisible();
  return (
    <Screen testID="send-parcel" keyboardAvoiding>
      <Header tone="background" title={t('parcel.screenTitle')} backLabel={t('parcel.back')} onBack={() => navigation.goBack()} testID="send-parcel-header" />
      <KeyboardAwareScrollView
        ref={form.scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="send-parcel-scroll"
      >
        {/* T-578: a refused "Send parcel" scrolls to the topmost red field inside this container. */}
        <View
          ref={form.containerRef}
          style={styles.body}
          onLayout={(e) => {
            form.containerY.current = e.nativeEvent.layout.y;
          }}
        >
          {body}
        </View>
      </KeyboardAwareScrollView>
      {ready && !keyboardUp ? (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + space[3], borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          testID="send-parcel-footer"
        >
          {form.formError ? <Banner tone="danger" text={form.formError} testID="send-parcel-form-error" /> : null}
          <FareLine form={form} />
          <SendParcelButton form={form} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  body: { gap: space[6] },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[3], borderTopWidth: StyleSheet.hairlineWidth },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
});
