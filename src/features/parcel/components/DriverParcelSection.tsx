import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Banner, Button } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { formatCountdown } from '../../safety/pin';
import { itemLine, receiverLine } from '../format';
import { useSecondsUntil } from '../hooks';
import type { ParcelView } from '../types';

type Props = {
  parcel: ParcelView;
  /** The fare to collect from the sender (whole rupees), when known. */
  fare: number | null;
  /** Masked call to the receiver (only while the parcel is with the driver). */
  onCallReceiver?: () => void;
  callingReceiver: boolean;
  /** "Send the code again" for the receiver; absent when the server says it cannot be sent. */
  onResend?: () => void;
  resending: boolean;
  /** A driver's step is in flight. */
  resendDisabled?: boolean;
  /** ISO time the next resend is allowed from (counted down here only). */
  resendAvailableAt: string | null;
};

/**
 * What the driver sees of a parcel on the ride panel (T-522, BE-88): the item and declared
 * value, the receiver (name and masked number, never the number itself), the cash to collect
 * from the sender at the pickup (there is no cash on delivery), a call through the bridge and
 * "Send the code again" while the parcel is with the driver, and the code's block state.
 */
export function DriverParcelSection({ parcel, fare, onCallReceiver, callingReceiver, onResend, resending, resendDisabled = false, resendAvailableAt }: Props) {
  // Ticks only while the cool-down runs, and only in this leaf.
  const resendWait = useSecondsUntil(onResend ? resendAvailableAt : null);
  const item = itemLine(parcel);
  const receiver = receiverLine(parcel.receiver);
  const atOrBeforePickup = parcel.status === 'accepted' || parcel.status === 'arrived';
  const code = parcel.code;
  return (
    <View style={styles.wrap} testID="driver-parcel">
      <View style={styles.row}>
        <Badge label={t('parcel.badge')} tone="info" />
        {item ? (
          <AppText variant="bodySmall" style={styles.flex} testID="driver-parcel-item">
            {item}
          </AppText>
        ) : null}
      </View>
      {parcel.itemDescription ? (
        <AppText variant="bodySmall" color="textSecondary" testID="driver-parcel-description">
          {parcel.itemDescription}
        </AppText>
      ) : null}
      {parcel.declaredValue !== null ? (
        <AppText variant="caption" color="textSecondary" testID="driver-parcel-value">
          {t('parcel.declaredValue', { amount: formatMoney(parcel.declaredValue) })}
        </AppText>
      ) : null}
      {receiver ? (
        <AppText variant="bodySmall" testID="driver-parcel-receiver">
          {`${t('parcel.receiver')}: ${receiver}`}
        </AppText>
      ) : null}

      {fare !== null && (atOrBeforePickup || parcel.status === 'picked_up') ? (
        <Banner
          tone={parcel.status === 'arrived' ? 'warning' : 'info'}
          icon="cash"
          title={t('parcel.collectCash', { amount: formatMoney(fare) })}
          text={t('parcel.collectCashBody')}
          testID="driver-parcel-collect"
        />
      ) : null}

      {parcel.status === 'picked_up' && code && (code.blocked || code.deliveryBlocked) ? (
        <Banner tone="danger" icon="lock" text={t('parcel.codeBlocked')} testID="driver-parcel-code-blocked" />
      ) : null}
      {parcel.status === 'picked_up' && code?.smsFailed && !code.blocked ? (
        <Banner tone="warning" icon="sms" text={t('parcel.codeSmsFailed')} testID="driver-parcel-sms-failed" />
      ) : null}
      {parcel.status === 'returning' ? (
        <Banner tone="info" icon="pinCode" text={t('parcel.returnedBody')} testID="driver-parcel-returning" />
      ) : null}

      {onCallReceiver || onResend ? (
        <View style={styles.actions}>
          {onCallReceiver ? (
            <Button
              label={callingReceiver ? t('parcel.callingReceiver') : t('parcel.callReceiver')}
              variant="secondary"
              size="md"
              leadingIcon="phone"
              onPress={onCallReceiver}
              disabled={callingReceiver}
              testID="driver-parcel-call-receiver"
            />
          ) : null}
          {onResend ? (
            <Button
              label={resendWait > 0 ? t('parcel.resendIn', { time: formatCountdown(resendWait) }) : t('parcel.resend')}
              variant="outline"
              size="md"
              leadingIcon="sms"
              onPress={onResend}
              loading={resending}
              disabled={resendWait > 0 || resendDisabled}
              testID="driver-parcel-resend"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
  actions: { gap: space[2] },
});
