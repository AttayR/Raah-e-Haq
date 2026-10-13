import type { IconName } from '../../components/ui/Icon';
import type { RecentRideRow } from '../../components/ui/ride/RecentRidesCard';

/**
 * Shapes the passenger Home sections render. T-506 maps the API onto them: stats from
 * `GET /me/stats` (BE-08), offers from `GET /public/banners` (BE-10), recent rides from
 * `GET /rides` (BE-01). Until then Home passes empty lists and the sections stay hidden.
 */
export type HomeStat = { label: string; value: string; icon: IconName };
export type HomeOffer = { id: string; title: string; description: string; validUntil: string };
/** A recent-rides row; the card is shared with the driver (components/ui/ride/RecentRidesCard). */
export type HomeRecentRide = RecentRideRow;
