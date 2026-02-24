import { useCallback, useMemo, useState } from 'react';
import rideService from '../services/rideService';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type VehicleType = 'bike' | 'rickshaw' | 'car';

export const useFare = () => {
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');

  const getFare = useCallback(async (pickup: Coordinates, destination: Coordinates, pickupAddress?: string, dropoffAddress?: string) => {
    try {
      const estimateRes = await rideService.getFareEstimate({
        pickupLocation: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          address: pickupAddress || 'Pickup',
        },
        dropoffLocation: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: dropoffAddress || 'Destination',
        },
        additionalStops: [],
        vehicleType,
        rideMode: 'uber',
      });
      const d = estimateRes?.data;
      if (d) {
        const total = d.fareBreakdown?.total ?? 0;
        const distance = d.totalDistance ?? 0;
        const duration = d.totalDuration ?? 0;
        return { fare: total, distance, duration };
      }
      const result = await rideService.calculateFare(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude,
        vehicleType
      );
      console.log('✅ Fare calculated via useFare hook:', result);
      return result;
    } catch (error) {
      console.error('❌ Error calculating fare via useFare hook:', error);
      const distance = Math.sqrt(
        Math.pow(destination.latitude - pickup.latitude, 2) +
        Math.pow(destination.longitude - pickup.longitude, 2)
      ) * 111;
      const baseFare = 50;
      const perKmRate = 25;
      const fare = Math.round(baseFare + (distance * perKmRate));
      return { fare, distance, duration: Math.round(distance * 2) };
    }
  }, [vehicleType]);

  return { vehicleType, setVehicleType, getFare };
};

export default useFare;


