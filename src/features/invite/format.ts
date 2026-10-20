import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import type { InviteCode, InviteProgramme } from './api';

/** The programme when it pays something; null shows the generic copy with no amounts (§I1). */
const paying = (programme: InviteProgramme | null): InviteProgramme | null => (programme?.active ? programme : null);

const money = (amount: number, programme: InviteProgramme): string => formatMoney(amount, programme.currency);

/** The card's title and description (§I2.1), from `programme` only. */
export const inviteCardText = (programme: InviteProgramme | null): { title: string; description: string } => {
  const p = paying(programme);
  const title = p && p.referrerReward > 0 ? t('invite.titleReward', { amount: money(p.referrerReward, p) }) : t('invite.titlePlain');
  let description = p && p.refereeReward > 0 ? t('invite.descriptionReward', { amount: money(p.refereeReward, p) }) : t('invite.descriptionPlain');
  // Rides are cash only: say where a reward lands, never "cash".
  if (p && p.rewardType === 'ride_credit') description = `${description} ${t('invite.walletNote')}`;
  return { title, description };
};

/** "How it works" (§I2.3): two steps, and the reward step when the referrer earns something. */
export const inviteSteps = (programme: InviteProgramme | null): { steps: string[]; expires: string | null } => {
  const steps = [t('invite.stepShare'), t('invite.stepSignUp')];
  const p = paying(programme);
  if (!p || p.referrerReward <= 0) return { steps, expires: null };
  const amount = money(p.referrerReward, p);
  steps.push(p.minRides > 1 ? t('invite.stepRewardMany', { n: p.minRides, amount }) : t('invite.stepRewardOne', { amount }));
  return { steps, expires: p.expiresDays && p.expiresDays > 0 ? t('invite.expires', { n: p.expiresDays }) : null };
};

/** The share text in the sender's language; the link only when the server sent one. */
export const inviteShareMessage = (invite: Pick<InviteCode, 'code' | 'shareUrl'>): string => {
  const text = t('invite.shareMessage', { code: invite.code });
  return invite.shareUrl ? `${text} ${invite.shareUrl}` : text;
};

/** "R, 7, K, 2" so VoiceOver reads the code character by character (§I3). */
export const spelledCode = (code: string): string => code.split('').join(', ');
