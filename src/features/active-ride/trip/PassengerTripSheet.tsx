import React, { useCallback, useContext, useMemo } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import type { SharedValue } from 'react-native-reanimated';
import { TripSheet, useIsOffline } from '../../../components/ui';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import type { RideRatingFields } from '../../rating/types';
import { openRideChat, type RideChatNavigator } from '../../chat/navigation';
import { useRideCall } from '../../safety/hooks';
import { canCallOn } from '../../safety/rules';
import { activeRideRatingChanged } from '../slice';
import type { PassengerRideStageState } from '../stage';
import { t } from '../../../i18n';
import { PassengerReceiptBody, PassengerReceiptFooter, usePassengerReceipt, type ReceiptRating } from './PassengerReceipt';
import { PassengerTripCancel, PassengerTripDetails, PassengerTripExtras, PassengerTripHeader, PassengerTripPeek } from './TripSections';
import { usePassengerTripActions, usePassengerTripView } from './usePassengerTripView';
import { useTripMoments } from './useTripMoments';
import { useTripShare } from './useTripShare';

type Props = {
  stageState: PassengerRideStageState;
  ride: RideResource | null;
  driverLocation: DriverLocation | null;
  onCancel: () => void;
  /** Done on the receipt (and after a submitted rating): back Home. */
  onFinish: () => void;
  /** A cancel or another write is in flight. */
  busy?: boolean;
  animatedHeight?: SharedValue<number>;
  onHeightChange?: (height: number) => void;
  onExpandedChange?: (expanded: boolean) => void;
  /** The booking sheet's last height (finding a driver), so this one continues from it. */
  openFrom?: number;
  active?: boolean;
};

/**
 * The passenger's trip sheet on the booking map (UI-R12): driver on the way / arrived, on trip,
 * and the receipt with the inline rating, on the shared TripSheet (shared-trip-sheet TS1–TS8).
 * Searching stays in the booking sheet (UI-R10). One sheet instance carries every trip state, so
 * on the way → arrived → on trip → receipt only swaps content and springs to the new height.
 */
export function PassengerTripSheet({
  stageState,
  ride,
  driverLocation,
  onCancel,
  onFinish,
  busy = false,
  animatedHeight,
  onHeightChange,
  onExpandedChange,
  openFrom,
  active = true,
}: Props) {
  const dispatch = useDispatch();
  const offline = useIsOffline();
  const { stage } = stageState;
  const view = usePassengerTripView(stage, ride, { offline, driverLocation });
  const share = useTripShare(ride);
  // T-520 (BE-78): a masked call (POST /rides/{id}/call), or the chat when calls are chat only.
  const navigation: RideChatNavigator | undefined = useContext(NavigationContext);
  const rideId = ride?.id ?? null;
  const openChat = useCallback(() => {
    if (navigation && rideId !== null) openRideChat(navigation, rideId);
  }, [navigation, rideId]);
  const rideCall = useRideCall(rideId, { onChatOnly: openChat });
  const onCall = canCallOn(ride) ? rideCall.call : undefined;
  const calling = rideCall.calling;
  const actions = usePassengerTripActions(view, { onCall, calling, share: share.action });
  const rating = useMemo<ReceiptRating>(
    () => ({
      onRatingChange: (id: number, fields: RideRatingFields) => dispatch(activeRideRatingChanged({ rideId: id, ...fields })),
    }),
    [dispatch],
  );
  const receipt = usePassengerReceipt(view, rating, onFinish);
  const done = useCallback(() => onFinish(), [onFinish]);
  useTripMoments(view);
  const ended = stage === 'completed' || stage === 'cancelled';

  return (
    <>
      <TripSheet
        mode={ended ? 'receipt' : 'trip'}
        stateKey={stage}
        header={<PassengerTripHeader view={view} />}
        peek={
          ended ? <PassengerReceiptBody view={view} receipt={receipt} /> : <PassengerTripPeek view={view} actions={actions} />
        }
        details={
          ended ? undefined : (
            <PassengerTripDetails view={view} sharing={share.sharing} onStopSharing={share.stop} shareBusy={share.busy} />
          )
        }
        persistent={<PassengerTripExtras view={view} />}
        detailsEnd={<PassengerTripCancel view={view} onCancel={onCancel} busy={busy} />}
        footer={ended ? <PassengerReceiptFooter receipt={receipt} offline={offline} onDone={done} /> : undefined}
        animatedHeight={animatedHeight}
        onHeightChange={onHeightChange}
        onExpandedChange={onExpandedChange}
        openFrom={openFrom}
        active={active}
        accessibilityLabel={t('kit.sheetHandleA11y')}
        testID="trip-sheet"
      />
      {share.dialog}
    </>
  );
}
