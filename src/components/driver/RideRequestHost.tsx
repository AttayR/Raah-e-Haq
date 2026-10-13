import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { useDriverLastLocation } from '../../features/driver-location/hooks';
import {
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
} from '../../features/driver-requests/hooks';
import { selectDriverRequestsState } from '../../features/driver-requests/slice';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { selectDriverIsOnline, selectDriverIsOnRide } from '../../features/driver-status/slice';
import { RideRequestPanel } from './IncomingRequestCard';

type Props = {
  /** Distance from the bottom of the tab area to the panel: the tab bar when it shows, else the inset. */
  bottomOffset: number;
  /**
   * Called with true while a request (not an error) is on screen and false once it is gone, so
   * the tabs hide the tab bar and open the Drive map under it (§8.3).
   */
  onRequestShownChange?: (shown: boolean) => void;
};

/**
 * How many polls in a row have failed (0 after a good one). Counted when a poll finishes
 * (`isFetching` goes back to false).
 */
const useConsecutiveFeedFailures = (): number => {
  const { isFetching, loadStatus } = useSelector(selectDriverRequestsState);
  const [failures, setFailures] = useState(0);
  const wasFetching = useRef(isFetching);
  useEffect(() => {
    if (wasFetching.current && !isFetching) {
      setFailures((count) => (loadStatus === 'failed' ? count + 1 : 0));
    }
    wasFetching.current = isFetching;
  }, [isFetching, loadStatus]);
  return failures;
};

/**
 * Incoming ride requests for every driver tab (T-408). Mounted once, by DriverBottomTabs, so
 * GET /rides/pending is polled (T-403) whenever the driver is online, has no ride, the app is in
 * the foreground and the tabs are on screen, whichever tab is open. A request takes over the
 * Drive map (UI-R4, §8.3: the tabs switch to Drive and hide the tab bar through
 * `onRequestShownChange`). Accepting (T-404) opens the DriverRide screen. The position sent with
 * each poll is the location tracker's (T-402).
 */
export const RideRequestHost: React.FC<Props> = ({ bottomOffset, onRequestShownChange }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();

  const isFocused = useIsFocused();
  const location = useDriverLastLocation();
  usePendingRidePolling({ isFocused, location });
  const { view, retry } = useRideRequestFeed(location);
  const { acceptingId, accept, reject } = useRideRequestActions();

  const failures = useConsecutiveFeedFailures();
  const isOnline = useSelector(selectDriverIsOnline);
  const isOnRide = useSelector(selectDriverIsOnRide);
  const hasActiveRide = useSelector(selectDriverActiveRide) !== null;

  const handleAccept = useCallback(
    async (rideId: number) => {
      const ride = await accept(rideId);
      if (ride) {
        navigation.navigate('DriverRide');
      }
    },
    [accept, navigation],
  );

  // The first poll after going online can run before the tracker's first fix (422
  // LOCATION_REQUIRED); an error waits for a fix or a second failure in a row. Loading and
  // "no requests" are not shown here: the Drive sheet says "Looking for ride requests".
  const showError = location !== null || failures >= 2;
  const eligible = isFocused && isOnline && !isOnRide && !hasActiveRide;
  const requestShown = eligible && view.kind === 'request';
  const visible = requestShown || (eligible && view.kind === 'error' && showError);

  const onShownRef = useRef(onRequestShownChange);
  onShownRef.current = onRequestShownChange;
  useEffect(() => {
    onShownRef.current?.(requestShown);
  }, [requestShown]);
  // Unmount (sign-out, a ride screen replacing the tabs): the tab bar comes back.
  useEffect(() => () => onShownRef.current?.(false), []);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[styles.container, { bottom: bottomOffset + theme.space[4] }]}
      pointerEvents="box-none"
      testID="ride-request-host"
    >
      <RideRequestPanel
        view={view}
        acceptingId={acceptingId}
        onAccept={handleAccept}
        onReject={reject}
        onRetry={retry}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    // Positions the panel over the tab content; the card itself is themed (IncomingRequestCard).
    container: {
      position: 'absolute',
      left: theme.space[5],
      right: theme.space[5],
    },
  });

export default RideRequestHost;
