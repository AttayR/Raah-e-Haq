import { useIsOffline } from '../../ui';
import { useLocationUploadsFailing, useWeakGpsSignal } from '../../../features/driver-location/hooks';
import type { LatLng } from '../../../features/driver-requests/api';
import { useRideRequestFeedNotice } from '../../../features/driver-requests/hooks';
import { componentTokens } from '../../../theme';
import { driveNotice, type DriveNoticeKind, type DriveStatus } from './driveNotice';

const d = componentTokens.drive;

/**
 * The Drive sheet's subtitle notice (UI-R11 D2) from the live signals: NetInfo, the tracker's
 * failed uploads, the request feed (after its first-poll grace), the fix and its accuracy. Each
 * source re-renders only when its boolean flips. `retry` polls the feed once (feed-error notice).
 */
export function useDriveNotice({
  status,
  location,
  autoAccept,
}: {
  status: DriveStatus;
  location: LatLng | null;
  autoAccept: boolean;
}): { notice: DriveNoticeKind; retry: (() => void) | undefined } {
  const tracking = status === 'online' || status === 'onRide';
  const deviceOffline = useIsOffline();
  const uploadsFailing = useLocationUploadsFailing(d.uploadFailuresNotice);
  const weakGps = useWeakGpsSignal(tracking, d.weakGpsAccuracyM, d.weakGpsMs);
  const feed = useRideRequestFeedNotice(location, d.feedFailuresNotice);
  const notice = driveNotice({
    status,
    deviceOffline,
    uploadsFailing,
    feedFailed: feed.failed,
    hasFix: location !== null,
    weakGps,
    autoAccept,
  });
  return {
    notice,
    retry: notice === 'feedFailed' && feed.canRetry ? feed.retry : undefined,
  };
}
