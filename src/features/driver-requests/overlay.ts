import { createContext, useContext } from 'react';

/**
 * Whether an incoming ride request is on screen (DESIGN_SYSTEM §8.3). DriverBottomTabs owns it
 * (RideRequestHost reports it); the tab bar hides and the Drive tab hides its own sheet and map
 * controls while it is true, so the request is the only thing on the map.
 */
export const IncomingRequestShownContext = createContext(false);

export const useIncomingRequestShown = (): boolean => useContext(IncomingRequestShownContext);

/** UI-R11 R1: what the Drive map frames while a request sheet is up. */
export type IncomingRequestFraming = {
  /** The offer the host is showing (not the queue head, not the taken state); null otherwise. */
  rideId: number | null;
  /** The request sheet's height (0 while hidden), for the camera's bottom padding. */
  sheetHeight: number;
};

const NO_FRAMING: IncomingRequestFraming = { rideId: null, sheetHeight: 0 };

/** DriverBottomTabs owns it; RideRequestHost reports the shown offer and its sheet height. */
export const IncomingRequestFramingContext = createContext<IncomingRequestFraming>(NO_FRAMING);

export const useIncomingRequestFraming = (): IncomingRequestFraming => useContext(IncomingRequestFramingContext);
