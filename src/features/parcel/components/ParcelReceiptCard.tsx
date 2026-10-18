import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Card, Icon, RideTimeline, type BadgeTone } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { formatDateTime } from '../../ride-history/format';
import { itemLine, receiverLine } from '../format';
import { useParcelOptions } from '../hooks';
import { needsReasonLabels, parcelOutcome, parcelReceiptSteps, pickupPhotoState, type ParcelOutcomeKind, type ParcelRideTimes } from '../receipt';
import type { ParcelView } from '../types';

/** The pickup photo's height on the receipt (the signed URL serves the re-encoded JPEG). */
const PHOTO_HEIGHT = 160;

const OUTCOME_TONE: Record<ParcelOutcomeKind, BadgeTone> = {
  delivered: 'success',
  returned: 'info',
  refused: 'danger',
  cancelled: 'neutral',
};

function Line({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.line} testID={testID}>
      <AppText variant="bodySmall" color="textSecondary" style={styles.lineLabel}>
        {label}
      </AppText>
      <AppText variant="bodySmall" align="end" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

/**
 * The pickup photo (UI-R15): a `surfaceAlt` block with the image glyph until the signed URL has
 * loaded, and in its place if it fails, so the card never shows a black box.
 */
function PickupPhoto({ uri }: { uri: string }) {
  const { theme } = useAppTheme();
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    <View style={[styles.photo, { backgroundColor: theme.colors.surfaceAlt }]} testID="ride-details-parcel-photo-frame">
      {state !== 'failed' ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, state === 'loaded' ? null : styles.hidden]}
          resizeMode="cover"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          accessible
          accessibilityLabel={t('parcel.receiptPhotoA11y')}
          testID="ride-details-parcel-photo"
        />
      ) : null}
      {state !== 'loaded' ? (
        <View style={styles.photoPlaceholder} pointerEvents="none" testID={`ride-details-parcel-photo-${state}`}>
          <Icon name="image" size={32} color="textMuted" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The parcel on the ride receipt (T-559, BE-88), for the sender and the ride's driver: how it
 * ended (delivered, returned, refused at the pickup, cancelled) with the reason, what was sent,
 * the receiver (name and masked number only), the declared value, the parcel's steps with their
 * times and the pickup photo (a short-lived signed URL; gone after the retention period). The
 * reason labels come from GET /parcels/options (cached), read only when a reason is shown.
 */
export function ParcelReceiptCard({ parcel, times }: { parcel: ParcelView; times: ParcelRideTimes }) {
  const options = useParcelOptions(needsReasonLabels(parcel));
  const outcome = parcelOutcome(parcel, options.data);
  const item = itemLine(parcel);
  const receiver = receiverLine(parcel.receiver);
  const steps = parcelReceiptSteps(times, parcel);
  const photo = pickupPhotoState(parcel);
  return (
    <Card testID="ride-details-parcel">
      <View style={styles.block}>
        <View style={styles.head}>
          <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.flex}>
            {t('parcel.receiptTitle')}
          </AppText>
          {outcome ? <Badge tone={OUTCOME_TONE[outcome.kind]} label={outcome.title} testID={`ride-details-parcel-outcome-${outcome.kind}`} /> : null}
        </View>
        {outcome?.reason ? (
          <AppText variant="bodySmall" testID="ride-details-parcel-reason">
            {t('parcel.outcomeReason', { reason: outcome.reason })}
          </AppText>
        ) : null}
        <View>
          {item ? <Line label={t('parcel.categoryLabel')} value={item} testID="ride-details-parcel-item" /> : null}
          {receiver ? <Line label={t('parcel.receiver')} value={receiver} testID="ride-details-parcel-receiver" /> : null}
          {parcel.declaredValue !== null ? (
            <Line label={t('parcel.receiptValue')} value={formatMoney(parcel.declaredValue)} testID="ride-details-parcel-value" />
          ) : null}
        </View>
        {steps.length > 0 ? (
          <RideTimeline
            cancelled={parcel.status === 'cancelled'}
            entries={steps.map((step) => ({
              key: step.key,
              label: step.label,
              time: formatDateTime(step.at),
              testID: `ride-details-parcel-step-${step.key}`,
            }))}
            testID="ride-details-parcel-timeline"
          />
        ) : null}
        {photo === 'shown' && parcel.pickupPhotoUrl ? (
          <View style={styles.block}>
            <AppText variant="label" color="textSecondary">
              {t('parcel.pickupPhoto')}
            </AppText>
            <PickupPhoto uri={parcel.pickupPhotoUrl} />
          </View>
        ) : null}
        {photo === 'removed' ? (
          <AppText variant="caption" color="textMuted" testID="ride-details-parcel-photo-removed">
            {t('parcel.photoRemoved')}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[1] },
  lineLabel: { flexShrink: 0, maxWidth: '45%' },
  lineValue: { flex: 1, minWidth: 0 },
  photo: { width: '100%', height: PHOTO_HEIGHT, borderRadius: radius.md, overflow: 'hidden' },
  hidden: { opacity: 0 },
  photoPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
