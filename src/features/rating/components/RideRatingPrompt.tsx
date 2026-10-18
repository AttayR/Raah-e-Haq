import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { readText } from '../../../core/api/read';
import type { RideResource } from '../../../services/rideService';
import { firstNameOf } from '../../../utils/format';
import { isParcelRide } from '../../parcel/api';
import { NOT_RATABLE, toRideRatingFields } from '../api';
import { useRatingPrompt } from '../hooks';
import type { RaterRole, RideRatingFields, RideRatingState } from '../types';
import { RateRideSheet } from './RateRideSheet';
import { activeRideRatingChanged, selectActiveRide } from '../../active-ride/slice';
import { driverRideRatingChanged, selectDriverActiveRide } from '../../driver-ride/slice';

type Props = {
  /** The ride on screen (the passenger's active ride, the driver's ride). */
  ride: RideResource | null;
  role: RaterRole;
  /** False while another screen covers the host: the sheet never opens over someone else. */
  active: boolean;
  /** Patch the ride the host keeps (Redux) with the new `my_rating` / `can_rate`. */
  onRatingChange: (rideId: number, fields: RideRatingFields) => void;
};

/**
 * The person being rated, from the ride card: the driver for a passenger, the passenger for a
 * driver. [T-519] First name only, like the live ride card and ride details.
 */
const ratedPerson = (ride: RideResource, role: RaterRole): { name: string | null; photoUri: string | null } =>
  role === 'passenger'
    ? { name: firstNameOf(readText(ride.driver?.name)), photoUri: readText(ride.driver?.profile_image_url) }
    : { name: firstNameOf(readText(ride.passenger?.name)), photoUri: readText(ride.passenger?.profile_image_url) };

/**
 * The after-ride rating prompt (T-505) for the passenger map and the driver ride screen: opens the
 * rating sheet once the ride is `completed` and `can_rate`, over the trip summary. Skip (or any
 * close) is remembered for the session, so the same ride never asks again; a submitted or stale
 * rating patches the ride, which also closes the sheet (`can_rate` turns false).
 */
export function RideRatingPrompt({ ride, role, active, onRatingChange }: Props) {
  const { visible, dismiss } = useRatingPrompt(ride, active);
  const rideId = ride?.id ?? null;

  const apply = useCallback(
    (state: RideRatingState) => {
      if (rideId === null) return;
      dismiss();
      onRatingChange(rideId, toRideRatingFields(state));
    },
    [dismiss, onRatingChange, rideId],
  );
  const onStale = useCallback((state: RideRatingState | null) => apply(state ?? NOT_RATABLE), [apply]);

  // [T-565] The last ride stays rendered (closed) when the ride is cleared, so an open sheet
  // slides out through `visible` instead of unmounting a presented Modal.
  const lastRide = useRef(ride);
  if (ride) lastRide.current = ride;
  const shown = ride ?? lastRide.current;
  if (!shown) return null;
  const person = ratedPerson(shown, role);
  return (
    <RateRideSheet
      key={shown.id}
      visible={visible}
      rideId={shown.id}
      role={role}
      personName={person.name}
      photoUri={person.photoUri}
      parcel={isParcelRide(shown)}
      onRated={apply}
      onStale={onStale}
      onSkip={dismiss}
    />
  );
}

/** The passenger map's prompt: rates the driver of the active ride once it completes. */
export function PassengerRideRatingPrompt({ active }: { active: boolean }) {
  const dispatch = useDispatch();
  const ride = useSelector(selectActiveRide);
  const onRatingChange = useCallback(
    (rideId: number, fields: RideRatingFields) => dispatch(activeRideRatingChanged({ rideId, ...fields })),
    [dispatch],
  );
  return <RideRatingPrompt ride={ride} role="passenger" active={active} onRatingChange={onRatingChange} />;
}

/** The driver ride screen's prompt: rates the passenger after Complete trip (or a poll that saw it). */
export function DriverRideRatingPrompt({ active }: { active: boolean }) {
  const dispatch = useDispatch();
  const ride = useSelector(selectDriverActiveRide);
  const onRatingChange = useCallback(
    (rideId: number, fields: RideRatingFields) => dispatch(driverRideRatingChanged({ rideId, ...fields })),
    [dispatch],
  );
  return <RideRatingPrompt ride={ride} role="driver" active={active} onRatingChange={onRatingChange} />;
}
