import { useCallback, useMemo, useState } from 'react';
import rideService from '../services/rideService';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type VehicleType = 'car' | 'bike' | 'van';

export const useFare = () => {
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');

  const getFare = useCallback(async (pickup: Coordinates, destination: Coordinates) => {
    try {
      console.log('💰 Calculating fare via useFare hook:', { pickup, destination, vehicleType });
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
      // Return a fallback fare calculation
      const distance = Math.sqrt(
        Math.pow(destination.latitude - pickup.latitude, 2) +
        Math.pow(destination.longitude - pickup.longitude, 2)
      ) * 111; // Rough conversion to km
      const baseFare = 50;
      const perKmRate = 25;
      const fare = Math.round(baseFare + (distance * perKmRate));
      return { fare, distance, duration: Math.round(distance * 2) };
    }
  }, [vehicleType]);

  return { vehicleType, setVehicleType, getFare };
};

export default useFare;


