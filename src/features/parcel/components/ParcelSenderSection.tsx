import React, { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { AppText, Banner, Button, Card } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import type { RideResource } from '../../../services/rideService';
import { formatCountdown } from '../../safety/pin';
import { activeRideReplaced, refreshActiveRide, type ActiveRideState } from '../../active-ride/slice';
import { useParcelOptions, useParcelResend, useSecondsUntil } from '../hooks';
import { itemLine, receiverLine } from '../format';
import { needsReasonLabels, parcelOutcome } from '../receipt';
import { resendState } from '../rules';
import type { ParcelView } from '../types';
import { ParcelTimeline } from './ParcelTimeline';

type Dispatch = ThunkDispatch<{ activeRide: ActiveRideState }, unknown, UnknownAction>;

/** The pickup photo is shown at this height (the signed URL serves the re-encoded JPEG). */
const PHOTO_HEIGHT = 160;

/** The delivery code's state for the sender (never the code: the receiver got it by SMS). */
function CodeStatus({ parcel, rideId }: { parcel: ParcelView; rideId: number }) {
  const dispatch = useDispatch<Dispatch>();
  const onRide = useCallback((ride: RideResource) => dispatch(activeRideReplaced(ride)), [dispatch]);
  const onStale = useCallback(() => {
    dispatch(refreshActiveRide(rideId));
  }, [dispatch, rideId]);
  const { sending, resend } = useParcelResend(rideId, { onRide, onStale });
  const code = parcel.code;
  const { visible } = resendState(parcel, 0);
  // Ticks only while the cool-down runs (stops at 0), in this leaf only.
  const waitSeconds = useSecondsUntil(visible ? code?.resendAvailableAt ?? null : null);
  if (!code || parcel.status !== 'picked_up') return null;

  let banner: React.ReactNode;
  if (code.blocked || code.deliveryBlocked) {
    banner = <Banner tone="danger" icon="lock" text={t('parcel.codeBlockedSender')} testID="parcel-code-blocked" />;
  } else if (code.smsFailed) {
    banner = <Banner tone="warning" icon="sms" text={t('parcel.codeSmsFailed')} testID="parcel-code-sms-failed" />;
  } else if (code.sent) {
    banner = <Banner tone="info" icon="sms" text={t('parcel.codeSent')} testID="parcel-code-sent" />;
  }

  return (
    <View style={styles.block}>
      {banner}
      {visible ? (
        <Button
          label={sending ? t('parcel.resendSending') : waitSeconds > 0 ? t('parcel.resendIn', { time: formatCountdown(waitSeconds) }) : t('parcel.resend')}
          variant="secondary"
          leadingIcon="sms"
          onPress={resend}
          loading={sending}
          disabled={waitSeconds > 0}
          accessibilityHint={code.sendsLeft > 0 ? t('parcel.sendsLeft', { n: code.sendsLeft }) : undefined}
          testID="parcel-resend"
        />
      ) : null}
    </View>
  );
}

/**
 * T-561: a parcel the rider refused at the pickup says so with the reason's label (from the
 * cached GET /parcels/options; the key, readable, until it loads or when the list lacks it).
 */
function RefusalNotice({ parcel }: { parcel: ParcelView }) {
  const wanted = needsReasonLabels(parcel) && parcel.status === 'cancelled';
  const options = useParcelOptions(wanted);
  const outcome = wanted ? parcelOutcome(parcel, options.data) : null;
  if (!outcome || outcome.kind !== 'refused') return null;
  return (
    <Banner
      tone="danger"
      icon="parcel"
      title={outcome.title}
      text={outcome.reason ? t('parcel.outcomeReason', { reason: outcome.reason }) : t('parcel.senderRefused')}
      testID="parcel-refused"
    />
  );
}

/**
 * The sender's parcel on the live ride panel (T-522, BE-88): the status timeline, the receiver
 * (name, masked number) and the item, the pickup photo (a short-lived signed URL; absent before
 * pickup or once it is scrubbed), the delivery code's state with "Send the code again", and the
 * return code only while the parcel is coming back.
 */
export function ParcelSenderSection({
  parcel,
  rideId,
  times,
}: {
  parcel: ParcelView;
  rideId: number;
  /** T-578: the ride's accepted / arrived times, kept on the timeline of a cancelled parcel. */
  times?: { acceptedAt?: string | null; arrivedAt?: string | null };
}) {
  const receiver = receiverLine(parcel.receiver);
  const item = itemLine(parcel);
  return (
    <View style={styles.block} testID="parcel-sender">
      <ParcelTimeline parcel={parcel} times={times} />
      <RefusalNotice parcel={parcel} />
      {receiver || item ? (
        <Card>
          <View style={styles.details}>
            {receiver ? (
              <AppText variant="bodySmall" testID="parcel-sender-receiver">
                {`${t('parcel.receiver')}: ${receiver}`}
              </AppText>
            ) : null}
            {item ? (
              <AppText variant="bodySmall" color="textSecondary" testID="parcel-sender-item">
                {item}
              </AppText>
            ) : null}
          </View>
        </Card>
      ) : null}
      {parcel.returnCode ? (
        <Card testID="parcel-return-code">
          <View style={styles.details}>
            <AppText variant="title" accessibilityRole="header">
              {t('parcel.returnCodeTitle')}
            </AppText>
            <AppText
              variant="numericL"
              style={styles.code}
              accessibilityLabel={t('parcel.returnCodeA11y', { code: parcel.returnCode.split('').join(' ') })}
              testID="parcel-return-code-value"
            >
              {parcel.returnCode}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary">
              {t('parcel.returnCodeBody')}
            </AppText>
          </View>
        </Card>
      ) : null}
      <CodeStatus parcel={parcel} rideId={rideId} />
      {parcel.pickupPhotoUrl ? (
        <View style={styles.details}>
          <AppText variant="label" color="textSecondary">
            {t('parcel.pickupPhoto')}
          </AppText>
          <Image
            source={{ uri: parcel.pickupPhotoUrl }}
            style={styles.photo}
            resizeMode="cover"
            accessible
            accessibilityLabel={t('parcel.pickupPhotoA11y')}
            testID="parcel-pickup-photo"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[3] },
  details: { gap: space[2] },
  code: { letterSpacing: space[2] },
  photo: { width: '100%', height: PHOTO_HEIGHT, borderRadius: radius.md },
});
