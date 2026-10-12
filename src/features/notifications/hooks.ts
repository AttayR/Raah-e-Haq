import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { toApiError } from '../../core/api/errors';
import { toast } from '../../core/toast';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { notificationsApi } from './api';
import { NOTIFICATIONS_COPY } from './copy';
import { getPushPermission, syncPushRegistration, type PushPermission } from './push';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  selectHasMoreNotifications,
  selectNotificationsState,
  selectUnreadNotificationCount,
  setNotificationFilter,
  type NotificationsState,
} from './slice';
import type {
  NotificationFilter,
  NotificationPreferenceKey,
  NotificationPreferences,
} from './types';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { notifications: NotificationsState };
type NotificationsDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/**
 * Unread count poll while the app is in the foreground. The ride screens poll every few
 * seconds; the badge does not need that, so it is read once a minute, on foreground and
 * after a push (QA T-104: one owner instead of three mounts each fetching).
 */
export const UNREAD_POLL_MS = 60_000;

/** The unread count for a tab badge or a bell. Reads the store only; never fetches. */
export const useUnreadNotificationCount = (): number => useSelector(selectUnreadNotificationCount);

/** Badge text: nothing for 0, "99+" above 99. */
export const unreadBadgeLabel = (count: number): string | undefined =>
  count <= 0 ? undefined : count > 99 ? '99+' : String(count);

/**
 * The one owner of GET /notifications/unread-count: mounted once per role (PassengerStack,
 * DriverStack). Reads on mount, when the app returns to the foreground and every
 * UNREAD_POLL_MS while it stays there. Timer and listener are removed on unmount (sign-out).
 */
export const useNotificationsSync = (): void => {
  const dispatch = useDispatch<NotificationsDispatch>();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      dispatch(fetchUnreadCount());
      timer = setInterval(() => dispatch(fetchUnreadCount()), UNREAD_POLL_MS);
    };
    if (AppState.currentState !== 'background') start();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else if (next === 'background') stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [dispatch]);
};

export interface NotificationsList {
  state: NotificationsState;
  hasMore: boolean;
  /** Pull-to-refresh: page 1 and the count. */
  refresh: () => void;
  /** Next page (infinite scroll); skipped while loading or on the last page. */
  loadMore: () => void;
  /** First load / retry. */
  reload: () => void;
  setFilter: (filter: NotificationFilter) => void;
  /** Marks one row read (optimistic). */
  markRead: (id: number) => void;
  markAllRead: () => Promise<void>;
}

/**
 * The list screen's state and actions; the caller passes `isFocused` so a hidden tab does not
 * fetch. Page 1 loads when the screen is shown with nothing loaded, again each time it gains
 * focus (T-513: the badge could show 4 while the list stayed empty), and while it is shown
 * whenever the list went stale (a push, or the unread count went up). A reload is skipped
 * while one runs (`fetchNotifications` refresh condition), so this never sends two at once.
 */
export const useNotificationsList = (isFocused: boolean): NotificationsList => {
  const dispatch = useDispatch<NotificationsDispatch>();
  const state = useSelector(selectNotificationsState);
  const hasMore = useSelector(selectHasMoreNotifications);
  const { status, stale } = state;
  const wasFocused = useRef(false);

  useEffect(() => {
    const gainedFocus = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;
    if (!isFocused) return;
    if (status === 'idle') {
      dispatch(fetchNotifications({ mode: 'initial' }));
    } else if (gainedFocus && status === 'failed') {
      dispatch(fetchNotifications({ mode: 'initial' }));
    } else if ((gainedFocus || stale) && status === 'ready') {
      dispatch(fetchNotifications({ mode: 'refresh' }));
    }
  }, [dispatch, isFocused, status, stale]);

  const refresh = useCallback(() => {
    dispatch(fetchNotifications({ mode: 'refresh' }));
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  const reload = useCallback(() => {
    dispatch(fetchNotifications({ mode: 'initial' }));
  }, [dispatch]);

  const loadMore = useCallback(() => {
    dispatch(fetchNotifications({ mode: 'more' }));
  }, [dispatch]);

  const setFilter = useCallback(
    (next: NotificationFilter) => {
      dispatch(setNotificationFilter(next));
    },
    [dispatch],
  );

  const markRead = useCallback(
    (id: number) => {
      dispatch(markNotificationRead(id)).then((action) => {
        if (
          markNotificationRead.rejected.match(action) &&
          !action.meta.condition &&
          action.payload?.kind !== 'not_found' &&
          !isStaleSessionRejection(action.payload)
        ) {
          toast.error(NOTIFICATIONS_COPY.markReadFailed);
        }
      });
    },
    [dispatch],
  );

  const markAllRead = useCallback(async () => {
    const action = await dispatch(markAllNotificationsRead());
    if (
      markAllNotificationsRead.rejected.match(action) &&
      !action.meta.condition &&
      !isStaleSessionRejection(action.payload)
    ) {
      toast.error(action.payload?.message ?? NOTIFICATIONS_COPY.markAllFailed);
    }
  }, [dispatch]);

  return { state, hasMore, refresh, loadMore, reload, setFilter, markRead, markAllRead };
};

export type PreferencesStatus = 'loading' | 'ready' | 'failed';

export interface NotificationPreferencesState {
  preferences: NotificationPreferences | null;
  status: PreferencesStatus;
  /** True while any change is waiting to be saved (switches stay usable). */
  saving: boolean;
  reload: () => void;
  toggle: (key: NotificationPreferenceKey, value: boolean) => Promise<void>;
}

/**
 * GET/PUT /notifications/preferences for the settings screen. A switch moves at once; changes are
 * saved one PUT at a time in tap order, so rapid taps queue instead of being dropped. A refused
 * change puts back only its own switch (to the last saved value) with a toast.
 */
export const useNotificationPreferences = (): NotificationPreferencesState => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<PreferencesStatus>('loading');
  const [inFlight, setInFlight] = useState(0);
  const mounted = useRef(true);
  /** Last values the server confirmed (the rollback target). */
  const confirmed = useRef<NotificationPreferences | null>(null);
  /** Queued changes per key; a key with queued changes keeps its on-screen (optimistic) value. */
  const queued = useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    setStatus('loading');
    notificationsApi
      .getPreferences()
      .then((loaded) => {
        if (!mounted.current) return;
        confirmed.current = loaded;
        setPreferences(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (mounted.current) setStatus('failed');
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Server values for every key without a newer queued tap; queued keys keep what the user sees. */
  const mergeServer = useCallback((current: NotificationPreferences | null, server: NotificationPreferences) => {
    if (!current) return server;
    const next = { ...server };
    (Object.keys(queued.current) as NotificationPreferenceKey[]).forEach((k) => {
      if ((queued.current[k] ?? 0) > 0) next[k] = current[k];
    });
    return next;
  }, []);

  const toggle = useCallback(
    (key: NotificationPreferenceKey, value: boolean): Promise<void> => {
      if (!confirmed.current) return Promise.resolve();
      setPreferences((current) => (current ? { ...current, [key]: value } : current));
      queued.current[key] = (queued.current[key] ?? 0) + 1;
      setInFlight((n) => n + 1);

      const run = async () => {
        let saved: NotificationPreferences | null = null;
        let failure: unknown = null;
        try {
          saved = await notificationsApi.updatePreferences({ [key]: value });
        } catch (error) {
          failure = error;
        }
        queued.current[key] = (queued.current[key] ?? 1) - 1;
        if (saved) confirmed.current = saved;
        if (!mounted.current) return;
        setInFlight((n) => n - 1);
        if (saved) {
          const server = saved;
          setPreferences((current) => mergeServer(current, server));
          return;
        }
        const base = confirmed.current;
        if (base && (queued.current[key] ?? 0) === 0) {
          setPreferences((current) => (current ? { ...current, [key]: base[key] } : current));
        }
        const apiError = toApiError(failure);
        if (apiError.kind !== 'cancelled') {
          toast.error(apiError.kind === 'rate_limited' ? apiError.message : NOTIFICATIONS_COPY.preferencesSaveFailed);
        }
      };

      const next = queue.current.then(run);
      queue.current = next;
      return next;
    },
    [mergeServer],
  );

  return { preferences, status, saving: inFlight > 0, reload, toggle };
};

export interface PushPermissionState {
  /** null until read. */
  permission: PushPermission | null;
  /** Asks (first time) or opens the phone settings (after a denial). */
  enable: () => Promise<void>;
}

/** Push permission for the "Turn on notifications" banner; re-read on foreground. */
export const usePushPermission = (): PushPermissionState => {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    let active = true;
    const read = () => {
      getPushPermission()
        .then((next) => {
          if (active) setPermission(next);
        })
        .catch(() => undefined);
    };
    read();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const enable = useCallback(async () => {
    if (permission === 'denied') {
      await Linking.openSettings().catch(() => undefined);
      return;
    }
    setPermission(await syncPushRegistration({ prompt: true }));
  }, [permission]);

  return { permission, enable };
};
