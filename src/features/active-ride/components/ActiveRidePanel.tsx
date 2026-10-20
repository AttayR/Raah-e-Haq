import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcBadge, AppText, Badge, Button, IndeterminateBar, type PersonAction } from '../../../components/ui';
import { componentTokens, space } from '../../../theme';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import { ACTIVE_RIDE_COPY } from '../copy';
import { t } from '../../../i18n';
import { isAcRide } from '../../ac/api';
import { isParcelRide, parcelOf } from '../../parcel/api';
import { parcelStatusText } from '../../parcel/rules';
import { ParcelSenderSection } from '../../parcel/components/ParcelSenderSection';
import { RequestReachStrip } from './RequestReachStrip';
import { FindingSubtitle, NoDriverFound, PassengerCancelButton, SearchingTripCard, searchingTripOf, type SearchDraft } from './FindingDriver';
import { isNoDriverCancel, type PassengerRideStage, type PassengerRideStageState } from '../stage';
import { PassengerReceiptBody, PassengerReceiptFooter, usePassengerReceipt, type ReceiptRating } from '../trip/PassengerReceipt';
import { PassengerTripCancel, PassengerTripDetails, PassengerTripExtras, PassengerTripHeader, PassengerTripPeek } from '../trip/TripSections';
import { usePassengerTripActions, usePassengerTripView } from '../trip/usePassengerTripView';

export { AssignedDriverMarker, trackingRouteFor } from './AssignedDriverMarker';

type Props = {
  /** The stage machine state (usePassengerRideStage); `ride` is null while POST /rides runs. */
  stageState: PassengerRideStageState;
  ride: RideResource | null;
  onCancel: () => void;
  /**
   * Shows Done inside the panel once the ride is over. The booking map leaves it out and pins
   * the receipt footer in its trip sheet instead (T-564, UI-R12).
   */
  onDone?: () => void;
  /** A masked call (T-520, BE-78 `contact.can_call`); no Call action without it. */
  onCall?: () => void;
  /** POST /rides/{id}/call is in flight. */
  calling?: boolean;
  /** UI-R12: the PersonCard's Share trip action (useTripShare) and whether a live link exists. */
  shareAction?: PersonAction | null;
  sharing?: boolean;
  /** UI-R12: the receipt's inline rating (patches the ride kept in Redux); none without it. */
  rating?: ReceiptRating | null;
  driverLocation?: DriverLocation | null;
  /** POST /rides or the cancel is in flight. */
  busy?: boolean;
  /** UI-R10: the booking just sent, for the searching card while POST /rides runs. */
  draft?: SearchDraft | null;
  /**
   * BE-87 "Looking for a female driver" while searching (WomenModeStatus). Its choice sheet and
   * state live once per ride at screen level (T-565, UI-R12), so the panel only places the block.
   */
  womenModeStatus?: React.ReactNode;
  /**
   * UI-R10: while searching, the booking map pins "Cancel request" in its sheet footer
   * (`PassengerCancelButton`), so the panel leaves it out.
   */
  cancelInFooter?: boolean;
  /**
   * Draw the searching bar inside the panel (default). The booking map puts it flush at the top
   * of its sheet instead (BookingSheet `topAccessory`) and passes false.
   */
  inlineSearchingBar?: boolean;
};

const noop = () => undefined;

/**
 * A trip stage drawn as one column (UI-R12 sections without the sheet): the status header, the
 * peek group and the details, or the receipt with its footer. The booking map draws the same
 * sections in the PassengerTripSheet; this is the gallery's and the tests' view of them.
 */
function TripInline({
  stageState,
  ride,
  onCancel,
  onDone,
  onCall,
  calling = false,
  shareAction = null,
  sharing = false,
  rating = null,
  driverLocation = null,
  busy = false,
}: Props) {
  const { stage } = stageState;
  const view = usePassengerTripView(stage, ride, { driverLocation });
  const actions = usePassengerTripActions(view, { onCall, calling, share: shareAction });
  const receipt = usePassengerReceipt(view, rating, onDone ?? noop);
  const ended = stage === 'completed' || stage === 'cancelled';
  return (
    <View style={styles.trip} testID="active-ride-trip">
      <PassengerTripHeader view={view} />
      {ended ? <PassengerReceiptBody view={view} receipt={receipt} /> : <PassengerTripPeek view={view} actions={actions} />}
      {/* The same slots as the TripSheet: the extras keep one instance through the states (T-565). */}
      <View style={styles.details}>
        {ended ? null : <PassengerTripDetails view={view} sharing={sharing} />}
        <PassengerTripExtras view={view} />
        {ended ? null : <PassengerTripCancel view={view} onCancel={onCancel} busy={busy} />}
      </View>
      {ended && onDone ? <PassengerReceiptFooter receipt={receipt} offline={false} onDone={onDone} /> : null}
    </View>
  );
}

/**
 * The bottom panel while a ride exists (T-304). Finding a driver (UI-R10) is drawn here for the
 * booking sheet; every later stage is the UI-R12 trip sheet's sections (`TripInline` here, the
 * PassengerTripSheet on the booking map). No driver found (BE-114, T-583) has its own state.
 */
const ActiveRidePanel: React.FC<Props> = (props) => {
  const { stageState, ride, onCancel, onDone, busy = false, draft = null, cancelInFooter = false, inlineSearchingBar = true, womenModeStatus = null } = props;
  const { stage } = stageState;

  // BE-114 (T-583): the request ended unanswered: its own state, no fee line, no report offer.
  if (stage === 'cancelled' && isNoDriverCancel(ride)) {
    return (
      <View testID={`active-ride-${stage}`} style={styles.wrap}>
        <NoDriverFound parcel={isParcelRide(ride)} />
        {onDone ? <ActiveRideDoneButton onPress={onDone} /> : null}
      </View>
    );
  }
  if (stage !== 'searching') return <TripInline {...props} />;

  // BE-88: a parcel says its own step and shows the sender's block.
  const parcel = parcelOf(ride);
  const warn = stageState.notice === 'driver_cancelled';
  const ac = isAcRide(ride);
  // UI-R10: the trip being searched for (a parcel shows its own block instead).
  const searchingTrip = !isParcelRide(ride) ? searchingTripOf(ride, draft) : null;
  const title = parcel && !warn ? parcelStatusText(parcel.status) : warn ? t('fare.requeuedTitle') : ACTIVE_RIDE_COPY.findingTitle;

  return (
    <View testID={`active-ride-${stage}`} style={styles.wrap}>
      {inlineSearchingBar ? <IndeterminateBar testID="active-ride-searching-bar" /> : null}
      <View style={styles.header} accessibilityLiveRegion="polite">
        <View style={styles.titleRow}>
          <AppText variant="h2" accessibilityRole="header" style={styles.title} testID="active-ride-title">
            {title}
          </AppText>
          {ac ? <AcBadge testID="active-ride-ac" /> : null}
          {parcel ? <Badge label={t('parcel.badge')} tone="info" testID="active-ride-parcel" /> : null}
        </View>
        {warn ? (
          <AppText variant="bodySmall" color="warning" testID="active-ride-subtitle">
            {ACTIVE_RIDE_COPY.driverCancelledRequeued}
          </AppText>
        ) : (
          // A re-queued search starts its own minute (not the first request's).
          <FindingSubtitle key={ride?.requeue_count ?? 0} requestedAt={ride?.requeue_count ? null : ride?.requested_at} />
        )}
      </View>

      {/* T-587: "Sent to {n} drivers · {m} viewing", from the ride poll's reach. */}
      <RequestReachStrip ride={ride} searching />

      {searchingTrip ? <SearchingTripCard trip={searchingTrip} /> : null}

      {parcel && ride ? (
        <ParcelSenderSection parcel={parcel} rideId={ride.id} times={{ acceptedAt: ride.accepted_at, arrivedAt: ride.arrived_at }} />
      ) : null}

      {/* BE-87: "Looking for a female driver" (its choice sheet is mounted by the screen). */}
      {womenModeStatus}

      {!cancelInFooter ? <PassengerCancelButton stage={stage} ride={ride} onPress={onCancel} disabled={busy} /> : null}
    </View>
  );
};

/** The ride is over (completed or cancelled): the passenger closes the panel with Done. */
export const isPassengerRideFinished = (stage: PassengerRideStage | null | undefined): boolean =>
  stage === 'completed' || stage === 'cancelled';

/** The finished ride's single primary action (no driver found; the receipt has its own footer). */
export const ActiveRideDoneButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <Button label={ACTIVE_RIDE_COPY.done} size="lg" onPress={onPress} testID="active-ride-done" />
);

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  header: { gap: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flexShrink: 1 },
  trip: { gap: componentTokens.tripSheet.headerGap },
  details: { marginTop: componentTokens.tripSheet.detailsGap, gap: componentTokens.tripSheet.zoneGap },
});

export default ActiveRidePanel;
