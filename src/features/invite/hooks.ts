import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_NAMES, CACHE_TTL } from '../../core/api/queryCache';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { logger } from '../../core/logging/logger';
import { t } from '../../i18n';
import { inviteApi, toInviteCode, type InviteCode, type InviteStats } from './api';

const CODE_CACHE = { name: CACHE_NAMES.inviteCode, ttlMs: CACHE_TTL.inviteCode } as const;
const STATS_CACHE = { name: CACHE_NAMES.inviteStats, ttlMs: CACHE_TTL.inviteStats } as const;

/** Per account, so another account on the phone never sees this one's code. */
export const inviteStorageKey = (userId: number): string => `rh.invite.code.${userId}`;

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'unknown');

const readStored = async (userId: number): Promise<InviteCode | null> => {
  try {
    const raw = await AsyncStorage.getItem(inviteStorageKey(userId));
    return raw ? toInviteCode(JSON.parse(raw)) : null;
  } catch (error: unknown) {
    logger.debug('[invite] no stored code', { error: errorName(error) });
    return null;
  }
};

const store = (userId: number, code: InviteCode): void => {
  const raw = { referral_code: code.code, share_url: code.shareUrl, programme: code.programme && {
    active: code.programme.active,
    referrer_reward: code.programme.referrerReward,
    referee_reward: code.programme.refereeReward,
    currency: code.programme.currency,
    reward_type: code.programme.rewardType,
    min_rides: code.programme.minRides,
    expires_days: code.programme.expiresDays,
  } };
  AsyncStorage.setItem(inviteStorageKey(userId), JSON.stringify(raw)).catch((error: unknown) =>
    logger.debug('[invite] could not store the code', { error: errorName(error) }),
  );
};

export interface InviteCodeState extends RemoteData<InviteCode> {
  /** The code to show: the server's, else the one stored after an earlier success (offline). */
  shown: InviteCode | null;
}

/**
 * GET /referrals/code/mine (§I1, §Z): read once and kept (the code never changes; the programme
 * is refreshed when the screen opens again after a day). The last good answer is stored on the
 * device, so offline the code still shows and Share still works.
 */
export function useInviteCode(userId: number | null): InviteCodeState {
  const fetch = useCallback(async () => {
    const code = await inviteApi.code();
    if (userId !== null) store(userId, code);
    return code;
  }, [userId]);
  const remote = useRemoteData<InviteCode>({
    fetch,
    key: String(userId ?? 0),
    fallbackError: t('invite.loadFailed'),
    cache: CODE_CACHE,
  });
  const [stored, setStored] = useState<InviteCode | null>(null);
  useEffect(() => {
    let alive = true;
    if (userId !== null) {
      readStored(userId).then((code) => {
        if (alive) setStored(code);
      });
    }
    return () => {
      alive = false;
    };
  }, [userId]);
  return { ...remote, shown: remote.data ?? stored };
}

/** GET /referrals/stats, at most once a minute. */
export function useInviteStats(): RemoteData<InviteStats> {
  const fetch = useCallback(() => inviteApi.stats(), []);
  return useRemoteData<InviteStats>({ fetch, fallbackError: t('invite.loadFailed'), cache: STATS_CACHE });
}
