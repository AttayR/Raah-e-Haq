/**
 * Which point the explicit "choose on map" mode sets (T-304, PAX-14). UI-R9b: the mode is the
 * full-screen centre-pin picker; a tap on the booking map never changes a location (PAX-24: nor
 * does a marker press), and the picker never opens while a ride exists.
 */
export type MapPickTarget = 'pickup' | 'destination' | 'stop';
