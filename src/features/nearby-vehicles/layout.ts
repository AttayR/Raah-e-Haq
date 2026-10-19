/**
 * Where the map count chip sits (T-586, map-vehicles.md §4), shared by the chip and the booking
 * route fit. Pure numbers from tokens.
 */
import { componentTokens, space } from '../../theme';

const c = componentTokens.ride.nearbyChip;
/** The locate button's visual size: the chip sits on its baseline, centred on it (§4). */
const LOCATE_VISUAL = componentTokens.iconButton.floatingVisual;

/** From the sheet's top edge to the chip's bottom: locate's gap + half the size difference (24). */
export const NEARBY_CHIP_BOTTOM_GAP = componentTokens.mapControls.sheetGap + (LOCATE_VISUAL - c.minHeight) / 2;

/**
 * T-586 design review (the chip covered the drop-off pin): room a route fit keeps above the sheet
 * while the chip shows: the chip's gap and height plus 16 for a pin (24 + 32 + 16 = 72).
 */
export const NEARBY_CHIP_ROUTE_CLEARANCE = NEARBY_CHIP_BOTTOM_GAP + c.minHeight + space[4];
