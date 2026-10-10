/**
 * Layout shared by the driver Map screen's control column and the ride request panel
 * (RideRequestHost, T-408), so the panel never covers the Map controls.
 */

/** The Map screen's bottom-right control column: my-location over Go Online/Offline. */
export const DRIVER_MAP_CONTROLS = {
  bottom: 30,
  locationButtonSize: 50,
  locationButtonGap: 15,
  onlineButtonSize: 60,
} as const;

/** Height of the control column above the bottom of the Map tab's content. */
export const DRIVER_MAP_CONTROLS_CLEARANCE =
  DRIVER_MAP_CONTROLS.bottom +
  DRIVER_MAP_CONTROLS.onlineButtonSize +
  DRIVER_MAP_CONTROLS.locationButtonGap +
  DRIVER_MAP_CONTROLS.locationButtonSize;

/**
 * Where the ride request panel sits above the bottom of the tab area: over the tab bar, and on
 * the Map tab also over the control column, which it would otherwise cover.
 */
export const rideRequestBottomOffset = (tabBarHeight: number, activeTab: string): number =>
  tabBarHeight + (activeTab === 'Map' ? DRIVER_MAP_CONTROLS_CLEARANCE : 0);
