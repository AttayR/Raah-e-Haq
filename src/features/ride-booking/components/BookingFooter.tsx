import React from 'react';
import type { RideResource } from '../../../services/rideService';
import { ActiveRideDoneButton, isPassengerRideFinished } from '../../active-ride/components/ActiveRidePanel';
import { NoDriverActions, PassengerCancelButton } from '../../active-ride/components/FindingDriver';
import { isNoDriverCancel, type PassengerRideStage } from '../../active-ride/stage';
import { ChooseRideFooter } from './BookingStages';

type Props = {
  /** The ride on screen (null before one is created). */
  ride: RideResource | null;
  rideStage: PassengerRideStage | null | undefined;
  /** Finding a driver (POST in flight, or `requested`). */
  searching: boolean;
  /** "Choose a ride" with the keyboard down: its Request button. */
  choose: React.ComponentProps<typeof ChooseRideFooter> | null;
  onFinish: () => void;
  onCancel: () => void;
  cancelDisabled: boolean;
  noDriver: { retry: () => void; retrying: boolean };
};

/**
 * The booking sheet's single pinned action (T-564, UI-R10), or null for no footer at all:
 * BE-114 "No driver found" → Try again + Close (T-583); a finished ride → Done; finding a driver
 * → Cancel request; Choose a ride → Request. A plain function (not a component), so "no footer"
 * stays null and the sheet leaves its footer slot out.
 */
export const bookingFooter = ({ ride, rideStage, searching, choose, onFinish, onCancel, cancelDisabled, noDriver }: Props): React.ReactNode => {
  if (ride && isNoDriverCancel(ride)) {
    return <NoDriverActions onRetry={noDriver.retry} onClose={onFinish} retrying={noDriver.retrying} />;
  }
  if (ride && isPassengerRideFinished(rideStage)) return <ActiveRideDoneButton onPress={onFinish} />;
  if (searching) return <PassengerCancelButton stage="searching" ride={ride} onPress={onCancel} disabled={cancelDisabled} />;
  return choose ? <ChooseRideFooter {...choose} /> : null;
};
