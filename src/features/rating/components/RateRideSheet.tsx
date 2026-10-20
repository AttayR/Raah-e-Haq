import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, BottomSheet, Button } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { RaterRole, RideRatingState } from '../types';
import { RatingForm, useRatingForm } from './RatingForm';

export type RateRideSheetProps = {
  visible: boolean;
  rideId: number;
  /** The signed-in user's side: a passenger rates the driver, a driver rates the passenger. */
  role: RaterRole;
  /** The person being rated (first name from the ride card); null shows "Your driver" / "Your passenger". */
  personName: string | null;
  photoUri?: string | null;
  /**
   * BE-107 / T-569: a parcel ride. The sheet offers the parcel tags (`parcel_tags[role]`, the
   * ride tags on an older server) and names the other side "Your rider" / "Your sender".
   */
  parcel?: boolean;
  /** 201: the ride's new rating state. The host updates the ride and closes the sheet. */
  onRated: (state: RideRatingState) => void;
  /** 409 / window closed: the ride was re-read (null when that failed). The host closes quietly. */
  onStale: (state: RideRatingState | null) => void;
  /** Skip, the scrim, Android back or a drag down. */
  onSkip: () => void;
};

export function RateRideSheet({ visible, rideId, role, personName, photoUri, parcel = false, onRated, onStale, onSkip }: RateRideSheetProps) {
  // [T-519] While the comment is being typed the header shrinks to the name, so the comment box
  // and Submit / Skip stay visible above the keyboard (the kit grows the sheet and scrolls to it).
  const keyboardUp = useKeyboardVisible();
  const handleRated = useCallback(
    (state: RideRatingState) => {
      toast.success(t('rating.thanks'));
      onRated(state);
    },
    [onRated],
  );
  // [UI-R12] One rating behaviour: the form is shared with the trip receipt (RatingForm).
  const form = useRatingForm({ rideId, role, parcel, enabled: visible, onRated: handleRated, onStale });
  const { stars, submitting, error } = form;
  const fallbackName = parcel
    ? role === 'passenger'
      ? t('rating.yourRider')
      : t('rating.yourSender')
    : role === 'passenger'
      ? t('rating.yourDriver')
      : t('rating.yourPassenger');
  const name = personName || fallbackName;

  const onSubmit = form.submit;

  const skip = () => {
    if (!submitting) onSkip();
  };

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={skip}
      accessibilityLabel={t('rating.sheetA11y')}
      testID="rate-ride-sheet"
      header={
        keyboardUp ? (
          <View style={[styles.header, styles.headerCompact]} testID="rate-ride-header-compact">
            <AppText variant="h3" align="center" numberOfLines={1} testID="rate-ride-name">
              {name}
            </AppText>
          </View>
        ) : (
          <View style={styles.header}>
            <Avatar name={name} uri={photoUri} size={56} testID="rate-ride-avatar" />
            <AppText variant="caption" color="textSecondary">
              {fallbackName}
            </AppText>
            <AppText variant="h3" align="center" numberOfLines={1} testID="rate-ride-name">
              {name}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" align="center" accessibilityRole="header">
              {parcel ? t('rating.titleParcel') : t('rating.title')}
            </AppText>
          </View>
        )
      }
      footer={
        <View style={styles.footer}>
          {error ? (
            <AppText variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite" testID="rate-ride-error">
              {error}
            </AppText>
          ) : null}
          <Button
            label={error ? t('rating.retry') : t('rating.submit')}
            size="lg"
            haptic="impactLight"
            onPress={onSubmit}
            disabled={stars < 1}
            loading={submitting}
            testID="rate-ride-submit"
          />
          <Button label={t('rating.skip')} variant="ghost" onPress={skip} disabled={submitting} testID="rate-ride-skip" />
        </View>
      }
    >
      <View style={styles.body}>
        <RatingForm form={form} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[1], paddingHorizontal: space[4], paddingBottom: space[3] },
  headerCompact: { paddingBottom: space[2] },
  body: { paddingHorizontal: space[4], paddingBottom: space[2] },
  footer: { paddingHorizontal: space[4], gap: space[2] },
});
