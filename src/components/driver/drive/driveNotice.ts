import { perLocale, t } from '../../../i18n';
import type { IconName } from '../../ui';
import type { TextColor } from '../../ui/AppText';

export type DriveStatus = 'checking' | 'offline' | 'online' | 'onRide';

/** What the Drive sheet's subtitle slot says (driver-drive-home D2), in table order. */
export type DriveNoticeKind =
  | 'checking'
  | 'deviceOffline'
  | 'uploadsFailing'
  | 'feedFailed'
  | 'noFix'
  | 'weakGps'
  | 'onRide'
  | 'autoAccept'
  | 'online'
  | 'offline';

export type DriveNoticeInput = {
  status: DriveStatus;
  /** NetInfo: the device has no connection. */
  deviceOffline: boolean;
  /** Three location uploads in a row failed (tracker). */
  uploadsFailing: boolean;
  /** The request feed failed (after the first-poll grace, R6). */
  feedFailed: boolean;
  /** The device has a position. */
  hasFix: boolean;
  /** Accuracy worse than 100 m for 30 s. */
  weakGps: boolean;
  /** Auto-accept is on and allowed. */
  autoAccept: boolean;
};

/**
 * The D2 subtitle, first match wins: checking → device offline → uploads failing (while
 * tracking) → feed failed (online) → no fix yet (online) → weak GPS (while tracking) → on a ride
 * → online with auto-accept → online → offline. Pure, so the order is unit-tested.
 */
export const driveNotice = (input: DriveNoticeInput): DriveNoticeKind => {
  const { status } = input;
  const tracking = status === 'online' || status === 'onRide';
  if (status === 'checking') return 'checking';
  if (input.deviceOffline) return 'deviceOffline';
  if (tracking && input.uploadsFailing) return 'uploadsFailing';
  if (status === 'online' && input.feedFailed) return 'feedFailed';
  if (status === 'online' && !input.hasFix) return 'noFix';
  if (tracking && input.weakGps) return 'weakGps';
  if (status === 'onRide') return 'onRide';
  if (status === 'online') return input.autoAccept ? 'autoAccept' : 'online';
  return 'offline';
};

/** A notice is a problem worth announcing (and it hides the searching shimmer). */
export const isProblemNotice = (kind: DriveNoticeKind): boolean =>
  kind === 'deviceOffline' ||
  kind === 'uploadsFailing' ||
  kind === 'feedFailed' ||
  kind === 'noFix' ||
  kind === 'weakGps';

export type DriveNoticeView = {
  text: string;
  icon: IconName | null;
  tone: TextColor;
};

/** Copy, glyph and tone of each notice (D2 table). `checking` draws a skeleton instead. */
export const DRIVE_NOTICE = perLocale(
  (): Record<DriveNoticeKind, DriveNoticeView> => ({
    checking: { text: t('drive.checking'), icon: null, tone: 'textSecondary' },
    deviceOffline: {
      text: t('drive.noticeDeviceOffline'),
      icon: 'offline',
      tone: 'warning',
    },
    uploadsFailing: {
      text: t('drive.noticeUploadsFailing'),
      icon: 'networkError',
      tone: 'danger',
    },
    feedFailed: {
      text: t('drive.noticeFeedFailed'),
      icon: 'networkError',
      tone: 'danger',
    },
    noFix: {
      text: t('drive.noticeNoFix'),
      icon: 'gpsSearching',
      tone: 'textSecondary',
    },
    weakGps: {
      text: t('drive.noticeWeakGps'),
      icon: 'gpsWeak',
      tone: 'warning',
    },
    onRide: { text: t('drive.onRideHint'), icon: null, tone: 'textSecondary' },
    autoAccept: {
      text: t('autoAccept.onlineHint'),
      icon: null,
      tone: 'textSecondary',
    },
    online: { text: t('drive.onlineHint'), icon: null, tone: 'textSecondary' },
    offline: {
      text: t('drive.offlineHint'),
      icon: null,
      tone: 'textSecondary',
    },
  }),
);
