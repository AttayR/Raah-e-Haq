import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText, Banner, BottomSheet, Button, OtpInput } from '../../../components/ui';
import { RIDE_PIN_LENGTH } from '../../../config/safety';
import { t } from '../../../i18n';
import type { MultipartFile } from '../../../services/api';
import { layout, radius, space } from '../../../theme';
import { formatCountdown } from '../../safety/pin';
import { isValidPin } from '../../safety/rules';

const PREVIEW_HEIGHT = 180;

export type ParcelPickupSheetProps = {
  visible: boolean;
  /** The photo taken for this pickup (sent as multipart `photo`), or null. */
  photo: MultipartFile | null;
  /** The ride needs the sender's PIN with the pickup (BE-81 `pin_required`). */
  pinRequired: boolean;
  /** BE-81 `pin_blocked`: the pickup cannot be confirmed until an admin clears it. */
  pinBlocked: boolean;
  pin: string;
  onPinChange: (pin: string) => void;
  /** The last refusal (photo missing, wrong PIN with the tries left), above the action. */
  error: string | null;
  /** Seconds until a locked PIN may be tried again; 0 when not locked. */
  lockedSeconds: number;
  /** "Collect Rs X in cash from the sender", from the ride's fare. */
  collectText: string | null;
  submitting: boolean;
  onTakePhoto: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

/**
 * Pickup of a parcel (T-522, BE-88): check the parcel, take its photo (camera only), give the
 * sender's PIN when the ride needs it, then "Confirm pickup" (POST /parcel/pickup, multipart). The
 * receiver then gets the delivery code by SMS, and the driver collects the fare from the sender.
 */
export function ParcelPickupSheet(props: ParcelPickupSheetProps) {
  const { visible, photo, pinRequired, pinBlocked, pin, onPinChange, error, lockedSeconds, collectText, submitting, onTakePhoto, onSubmit, onClose } = props;
  const locked = lockedSeconds > 0;
  const pinOk = !pinRequired || isValidPin(pin);
  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('parcel.pickupTitle')}
      testID="parcel-pickup-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {t('parcel.pickupTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('parcel.pickupBody')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={t('parcel.confirmPickup')}
            size="lg"
            haptic="impactLight"
            onPress={onSubmit}
            loading={submitting}
            disabled={!photo || !pinOk || locked || pinBlocked}
            testID="parcel-pickup-submit"
          />
          <Button label={t('parcel.cancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="parcel-pickup-cancel" />
        </View>
      }
    >
      <View style={styles.body}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" accessible accessibilityLabel={t('parcel.photoA11y')} testID="parcel-pickup-preview" />
        ) : null}
        <Button
          label={photo ? t('parcel.retakePhoto') : t('parcel.takePhoto')}
          variant={photo ? 'secondary' : 'primary'}
          leadingIcon="camera"
          onPress={onTakePhoto}
          disabled={submitting}
          testID="parcel-pickup-photo"
        />
        {pinBlocked ? (
          <Banner tone="danger" icon="lock" title={t('safety.pinBlockedTitle')} text={t('safety.pinBlockedBody')} testID="parcel-pickup-pin-blocked" />
        ) : pinRequired ? (
          <View style={styles.pin}>
            <OtpInput
              value={pin}
              onChange={(next) => {
                if (!submitting) onPinChange(next);
              }}
              length={RIDE_PIN_LENGTH}
              label={t('parcel.pinLabel')}
              disabled={locked}
              oneTimeCode={false}
              testID="parcel-pickup-pin"
            />
            <AppText variant="caption" color="textSecondary">
              {t('parcel.pinHelper')}
            </AppText>
          </View>
        ) : null}
        {locked ? <Banner tone="warning" icon="lockClock" text={t('safety.pinLocked', { time: formatCountdown(lockedSeconds) })} testID="parcel-pickup-locked" /> : null}
        {error && !locked ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="parcel-pickup-error">
            {error}
          </AppText>
        ) : null}
        {collectText ? <Banner tone="info" icon="cash" text={collectText} testID="parcel-pickup-collect" /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[2], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  body: { gap: space[3], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  pin: { gap: space[1] },
  preview: { width: '100%', height: PREVIEW_HEIGHT, borderRadius: radius.md },
  footer: { gap: space[2] },
});
