import { useCallback, useMemo, useState } from 'react';
import { calculateFare } from '../services/rideService';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type VehicleType = 'car' | 'bike' | 'van';

export const useFare = () => {
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');

  const getFare = useCallback((pickup: Coordinates, destination: Coordinates) => {
    return calculateFare(pickup as any, destination as any, vehicleType);
  }, [vehicleType]);

  return { vehicleType, setVehicleType, getFare };
};

export default useFare;


