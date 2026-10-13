import { createContext, useContext } from 'react';

/**
 * Whether an incoming ride request is on screen (DESIGN_SYSTEM §8.3). DriverBottomTabs owns it
 * (RideRequestHost reports it); the tab bar hides and the Drive tab hides its own sheet and map
 * controls while it is true, so the request is the only thing on the map.
 */
export const IncomingRequestShownContext = createContext(false);

export const useIncomingRequestShown = (): boolean => useContext(IncomingRequestShownContext);
