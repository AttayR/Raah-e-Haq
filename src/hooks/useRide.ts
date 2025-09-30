import { useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addBid, setActiveRide, setBids, setCurrentRequestId, setIsRequesting } from '../store/slices/rideSlice';
import { createRideRequest, listenToActiveRide, RideRequest } from '../services/rideService';
import { listenRideBids } from '../services/bidService';

type Coords = { latitude: number; longitude: number };

export function useRide() {
  const dispatch = useAppDispatch();
  const ride = useAppSelector((s) => s.ride);
  const auth = useAppSelector((s) => s.auth);
  const bidsUnsubRef = useRef<null | (() => void)>(null);
  const activeRideUnsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!auth.uid) return;
    if (activeRideUnsubRef.current) activeRideUnsubRef.current();
    activeRideUnsubRef.current = listenToActiveRide(auth.uid, (r) => {
      if (!r) {
        dispatch(setActiveRide(undefined));
        return;
      }
      const summary = {
        rideId: r.id!,
        status: r.status,
        pickup: r.pickup,
        destination: r.destination,
        fare: r.fare,
        distance: r.distance,
        duration: r.duration,
        vehicleType: r.vehicleInfo?.type || 'car',
        driverId: r.driverId,
        driverName: r.driverName,
      };
      dispatch(setActiveRide(summary));
    });
    return () => {
      if (activeRideUnsubRef.current) activeRideUnsubRef.current();
    };
  }, [auth.uid, dispatch]);

  useEffect(() => {
    if (bidsUnsubRef.current) {
      bidsUnsubRef.current();
      bidsUnsubRef.current = null;
    }
    if (ride.currentRequestId) {
      bidsUnsubRef.current = listenRideBids(ride.currentRequestId, (bids) => {
        dispatch(
          setBids(
            bids.map((b) => ({
              id: b.id!,
              rideId: b.rideId,
              driverId: b.driverId,
              driverName: b.driverName,
              price: b.price,
              createdAt: Date.now(),
            }))
          )
        );
      });
    }
    return () => {
      if (bidsUnsubRef.current) bidsUnsubRef.current();
    };
  }, [ride.currentRequestId, dispatch]);

  const requestRide = async (
    pickup: Coords,
    destination: Coords,
    fareInfo: { fare: number; distance: string; duration: string },
    vehicleType: string,
    paymentMethod: 'cash' | 'card' | 'wallet' = 'cash'
  ) => {
    if (!auth.uid || !auth.userProfile) throw new Error('Not authenticated');
    try {
      dispatch(setIsRequesting(true));
      const rideId = await createRideRequest({
        passengerId: auth.uid,
        passengerName: auth.userProfile.name || 'Passenger',
        passengerPhone: auth.userProfile.phone || '',
        passengerRating: auth.userProfile.rating || 5,
        pickup: { ...pickup },
        destination: { ...destination },
        fare: fareInfo.fare,
        distance: fareInfo.distance,
        duration: fareInfo.duration,
        status: 'pending',
        vehicleInfo: { type: vehicleType, brand: '', model: '', color: '', plateNumber: '' },
        paymentMethod,
      } as unknown as RideRequest);
      dispatch(setCurrentRequestId(rideId));
      return rideId;
    } finally {
      dispatch(setIsRequesting(false));
    }
  };

  const value = useMemo(
    () => ({
      ride,
      requestRide,
    }),
    [ride]
  );

  return value;
}


