import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { MapControls } from '../../../components/ui/MapControls';
import { componentTokens, space } from '../../../theme';
import { ACTIVE_RIDE_COPY } from '../../active-ride/copy';
import { BOOKING_COPY } from '../copy';

/** Height of the top control row (48 pt floating buttons) plus its top gap. */
export const MAP_TOP_CONTROLS_HEIGHT = componentTokens.iconButton.floatingVisual + space[2];

type Props = {
  /** None while finding a driver (passenger-finding-driver.md: no back button). */
  onBack?: () => void;
  onRecenter: () => void;
  /** The booking sheet's height, so the end-side control rides 16 above it. */
  sheetHeight: SharedValue<number>;
  /**
   * T-549: the passenger panned the live-ride map; the end-side control becomes "follow your
   * ride" (fits the ride again) instead of "show my location".
   */
  followRide?: { visible: boolean; onPress: () => void };
};

/**
 * The booking map's floating chrome on the kit MapControls (DESIGN_SYSTEM §9 v1.1, UI-R10): at
 * most two controls, back at the top start (below the status bar / Dynamic Island) and one
 * end-side control riding 16 above the sheet. No "start over" and no refresh: Back steps through
 * the booking and the data refreshes itself.
 */
export const MapTopControls: React.FC<Props> = ({ onBack, onRecenter, sheetHeight, followRide }) => {
  const follow = followRide?.visible === true;
  return (
    <MapControls
      testID="map-top-controls"
      onBack={onBack}
      backLabel={BOOKING_COPY.backA11y}
      backTestID="map-back"
      onLocate={follow ? followRide.onPress : onRecenter}
      locateIcon={follow ? 'navigate' : 'locate'}
      locateLabel={follow ? ACTIVE_RIDE_COPY.recentreA11y : BOOKING_COPY.recenterA11y}
      locateTestID={follow ? 'ride-recentre' : 'map-recenter'}
      sheetHeight={sheetHeight}
    />
  );
};

export default MapTopControls;
