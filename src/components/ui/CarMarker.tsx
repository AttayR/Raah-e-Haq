/**
 * T-517: the upright car badge (UI-R5) was replaced by the top-down VehicleMarker, which picks
 * the art by vehicle type and turns with the heading. These names stay as thin aliases for
 * existing callers; new code uses VehicleMarker.
 */
import { VEHICLE_MARKER_SETTLE_MS, VEHICLE_MARKER_SIZE, VehicleMarker, VehicleMarkerGlyph } from './VehicleMarker';

/** @deprecated Use VEHICLE_MARKER_SIZE. */
export const CAR_MARKER_SIZE = VEHICLE_MARKER_SIZE;
/** @deprecated Use VEHICLE_MARKER_SETTLE_MS. */
export const CAR_MARKER_SETTLE_MS = VEHICLE_MARKER_SETTLE_MS;
/** @deprecated Use VehicleMarkerGlyph. */
export const CarMarkerGlyph = VehicleMarkerGlyph;
/** @deprecated Use VehicleMarker. */
export const CarMarker = VehicleMarker;

export default VehicleMarker;
