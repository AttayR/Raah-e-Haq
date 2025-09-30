import { useEffect, useMemo, useRef, useState } from 'react';
import { listenToRideRequests, acceptRideRequest, startRide, completeRide, cancelRide, RideRequest } from '../services/rideService';
import { submitBid } from '../services/bidService';
import { useAppSelector } from '../store';

export function useDriverRequests() {
  const auth = useAppSelector((s) => s.auth);
  const [pending, setPending] = useState<RideRequest[]>([]);
  const unsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!auth.uid) return;
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = listenToRideRequests(auth.uid, setPending);
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [auth.uid]);

  const actions = useMemo(
    () => ({
      submitBid: (rideId: string, price: number) => submitBid(rideId, auth.uid!, price, auth.userProfile?.name || undefined),
      accept: (rideId: string) => acceptRideRequest(rideId, auth.uid!, {
        name: auth.userProfile?.name,
        phone: auth.userProfile?.phone,
        rating: auth.userProfile?.rating,
        vehicleInfo: auth.userProfile?.vehicleInfo,
      }),
      start: (rideId: string) => startRide(rideId),
      complete: (rideId: string) => completeRide(rideId),
      cancel: (rideId: string, reason: string) => cancelRide(rideId, reason, 'driver'),
    }),
    [auth.uid, auth.userProfile]
  );

  return { pending, actions };
}


