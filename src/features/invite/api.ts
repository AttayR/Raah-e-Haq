import { apiService, unwrap } from '../../services/api';
import { isRecord, readNumber, readNumberOrNull, readText } from '../../core/api/read';

/**
 * Invite programme (UI-R18 §I; BE-31 + BE-131, CONTRACT_NOTES), through the shared client:
 * - GET /referrals/code/mine -> { referral_code, share_url, referral_url, programme }
 * - GET /referrals/stats     -> { total_referrals, completed_referrals, total_rewards, … }
 * The reward copy comes only from `programme` (never a hardcoded amount).
 */

export interface InviteProgramme {
  /** False when both rewards are 0: no amounts anywhere. */
  active: boolean;
  referrerReward: number;
  refereeReward: number;
  currency: string | null;
  rewardType: string;
  minRides: number;
  expiresDays: number | null;
}

export interface InviteCode {
  code: string;
  /** The owner-configured link with ref=<code>; null until set (then no link in the share text). */
  shareUrl: string | null;
  programme: InviteProgramme | null;
}

export interface InviteStats {
  joined: number;
  rode: number;
  /** The amount actually credited from the user's invites (BE-131). */
  earned: number;
}

const toProgramme = (raw: unknown): InviteProgramme | null => {
  if (!isRecord(raw)) return null;
  const referrerReward = Math.max(0, readNumber(raw.referrer_reward));
  const refereeReward = Math.max(0, readNumber(raw.referee_reward));
  return {
    active: raw.active === true && (referrerReward > 0 || refereeReward > 0),
    referrerReward,
    refereeReward,
    currency: readText(raw.currency),
    rewardType: readText(raw.reward_type) ?? '',
    minRides: Math.max(1, Math.floor(readNumber(raw.min_rides, 1))),
    expiresDays: readNumberOrNull(raw.expires_days),
  };
};

const isHttpUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value);

export const toInviteCode = (raw: unknown): InviteCode => {
  const data = isRecord(raw) ? raw : {};
  const code = readText(data.referral_code)?.trim();
  if (!code) throw new Error('Invalid referral code response');
  const shareUrl = readText(data.share_url)?.trim() ?? null;
  return { code, shareUrl: shareUrl && isHttpUrl(shareUrl) ? shareUrl : null, programme: toProgramme(data.programme) };
};

export const toInviteStats = (raw: unknown): InviteStats => {
  const data = isRecord(raw) ? raw : {};
  return {
    joined: Math.max(0, readNumber(data.total_referrals)),
    rode: Math.max(0, readNumber(data.completed_referrals)),
    earned: Math.max(0, readNumber(data.total_rewards)),
  };
};

export const inviteApi = {
  async code(): Promise<InviteCode> {
    return toInviteCode(unwrap(await apiService.get<unknown>('/referrals/code/mine')));
  },
  async stats(): Promise<InviteStats> {
    return toInviteStats(unwrap(await apiService.get<unknown>('/referrals/stats')));
  },
};
