import React, { useCallback, useMemo, useState } from 'react';
import { Dialog, type PersonAction } from '../../../components/ui';
import type { RideResource } from '../../../services/rideService';
import { shareTripLink, useLiveShare } from '../../safety/hooks';
import { canShareTrip } from '../../safety/rules';
import { ACTIVE_RIDE_COPY } from '../copy';

/** What the trip sheet needs to show and run "Share trip" (TS5.1). */
export type TripShare = {
  /** The PersonCard's third action; null when the ride cannot be shared. */
  action: PersonAction | null;
  /** A live link exists (the "Sharing" cell and the details row). */
  sharing: boolean;
  busy: boolean;
  stop: () => void;
  /** The "You're sharing this trip" dialog; render it once with the sheet. */
  dialog: React.ReactNode;
};

/**
 * Share trip on the passenger's PersonCard (shared-trip-sheet TS5.1, BE-80 via the shipped
 * `useLiveShare`): not sharing → create the link and open the native share sheet (a spinner in
 * the cell meanwhile); sharing → the dialog "Share link again" / "Stop sharing" / "Close".
 * Absent while `canShareTrip` is false.
 */
export const useTripShare = (ride: RideResource | null): TripShare => {
  const shareable = !!ride && canShareTrip(ride);
  const live = useLiveShare(shareable && ride ? ride.id : null);
  const [open, setOpen] = useState(false);
  const sharing = shareable && !!live.link;
  const { start, stop: stopShare, busy, link } = live;

  const onPress = useCallback(() => {
    if (sharing) setOpen(true);
    else start();
  }, [sharing, start]);
  const close = useCallback(() => setOpen(false), []);
  const stop = useCallback(() => {
    setOpen(false);
    stopShare();
  }, [stopShare]);
  const again = useCallback(() => {
    setOpen(false);
    if (link) shareTripLink(link.url);
  }, [link]);

  const action = useMemo<PersonAction | null>(
    () =>
      shareable
        ? {
            key: 'share',
            icon: sharing ? 'sharing' : 'share',
            label: sharing ? ACTIVE_RIDE_COPY.sharingCell : ACTIVE_RIDE_COPY.shareCell,
            accessibilityLabel: sharing ? ACTIVE_RIDE_COPY.sharingCellA11y : undefined,
            onPress,
            busy,
            dot: sharing,
            testID: 'trip-share-button',
          }
        : null,
    [busy, onPress, shareable, sharing],
  );

  const dialog = shareable ? (
    <Dialog
      visible={open && sharing}
      onDismiss={close}
      title={ACTIVE_RIDE_COPY.shareDialogTitle}
      body={ACTIVE_RIDE_COPY.shareDialogBody}
      actions={[
        { label: ACTIVE_RIDE_COPY.shareAgain, onPress: again, variant: 'primary', testID: 'trip-share-again' },
        { label: ACTIVE_RIDE_COPY.stopSharing, onPress: stop, variant: 'destructive', testID: 'trip-share-stop' },
        { label: ACTIVE_RIDE_COPY.close, onPress: close, variant: 'ghost', testID: 'trip-share-close' },
      ]}
      testID="trip-share-dialog"
    />
  ) : null;

  return { action, sharing, busy, stop, dialog };
};
