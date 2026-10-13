import type { IconName } from '../../components/ui/Icon';
import type { TextColor } from '../../components/ui/AppText';
import { formatMoney } from '../../core/format/money';
import { t } from '../../i18n';
import type { TopUp, TopUpMethod, TopUpProvider } from './types';

/** Brand spelling for the known gateways when GET /wallet's provider list is not at hand. */
const KNOWN_PROVIDER_NAMES: Readonly<Record<string, string>> = { jazzcash: 'JazzCash', easypaisa: 'Easypaisa' };

/** The provider's display name: from GET /wallet `top_up.providers`, else the brand spelling, else the id. */
export const providerDisplayName = (id: string, providers: ReadonlyArray<TopUpProvider> = []): string => {
  const listed = providers.find((provider) => provider.id === id)?.name;
  if (listed) return listed;
  if (KNOWN_PROVIDER_NAMES[id]) return KNOWN_PROVIDER_NAMES[id];
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : '';
};

export const topUpMethodLabel = (method: TopUpMethod): string =>
  method === 'mwallet' ? t('topUp.methodMwalletShort') : t('topUp.methodCardShort');

export interface TopUpStatusView {
  icon: IconName;
  color: TextColor;
  title: string;
  body: string;
}

/**
 * Hero copy for a top-up's state. `timedOut` = still open after `expires_at` (polling stopped).
 * A failure's server message is shown as is (it is written for people).
 */
export const topUpStatusView = (topUp: TopUp, providerName: string, timedOut: boolean): TopUpStatusView => {
  const amount = formatMoney(topUp.amount, { currency: topUp.currency });
  switch (topUp.status) {
    case 'succeeded':
      return { icon: 'check', color: 'success', title: t('topUp.statusSucceeded'), body: t('topUp.statusSucceededBody', { amount }) };
    case 'failed':
      return {
        icon: 'failed',
        color: 'danger',
        title: t('topUp.statusFailed'),
        body: topUp.failure?.message || t('topUp.statusFailedBody'),
      };
    case 'expired':
      return {
        icon: 'failed',
        color: 'danger',
        title: t('topUp.statusExpired'),
        body: topUp.failure?.message || t('topUp.statusExpiredBody'),
      };
    case 'cancelled':
      return {
        icon: 'failed',
        color: 'textSecondary',
        title: t('topUp.statusCancelled'),
        body: topUp.failure?.message || t('topUp.statusExpiredBody'),
      };
    default:
      if (timedOut) {
        return {
          icon: 'pending',
          color: 'warning',
          title: t('topUp.statusTimedOut'),
          body: t('topUp.statusTimedOutBody', { provider: providerName }),
        };
      }
      return {
        icon: 'pending',
        color: 'primaryText',
        title: t('topUp.statusPending'),
        body:
          topUp.method === 'mwallet'
            ? t('topUp.statusPendingBody', { provider: providerName })
            : t('topUp.statusCheckingBody', { provider: providerName }),
      };
  }
};
