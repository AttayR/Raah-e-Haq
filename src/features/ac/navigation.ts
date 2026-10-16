/** Driver-only route of T-522, registered in DriverStack and opened from Account. */
export type VehicleAcRoutes = {
  /** BE-86: declare / withdraw the car's AC, and its review status. */
  VehicleAc: undefined;
};

export const VEHICLE_AC_ROUTE = 'VehicleAc' as const;
