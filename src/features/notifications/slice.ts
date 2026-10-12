import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { staleSessionRejection } from '../../store/thunks/apiThunks';
import { notificationsApi } from './api';
import { NOTIFICATIONS_COPY } from './copy';
import type { AppNotification, NotificationFilter, NotificationPage } from './types';

/**
 * The signed-in user's notifications (T-502, BE-11): the one copy for the list screens of
 * both roles, the tab badge and the bell. Not persisted; `resetApp` (logout) clears it.
 *
 * The unread count has one owner (useNotificationsSync, mounted once per role stack); every
 * other reader only selects it. `fetchUnreadCount` never overlaps itself, so several callers
 * at once still send one request (QA T-104: the Map tab sent /unread-count three times).
 */
export type NotificationsListStatus = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'ready' | 'failed';

export interface NotificationsState {
  items: AppNotification[];
  filter: NotificationFilter;
  page: number;
  lastPage: number;
  status: NotificationsListStatus;
  /** First load / refresh failed (display-safe). */
  error: string | null;
  /** Next page failed; the loaded items stay. */
  loadMoreError: string | null;
  /** requestId of the newest list request; older answers are dropped. */
  listRequestId: string | null;
  /**
   * The list may be missing rows: a push arrived or the unread count went up since it was
   * loaded (T-513). The screen reloads it while it is shown, or the next time it is.
   */
  stale: boolean;
  unreadCount: number;
  unreadInFlight: boolean;
  markingAll: boolean;
}

export const initialNotificationsState: NotificationsState = {
  items: [],
  filter: 'all',
  page: 0,
  lastPage: 0,
  status: 'idle',
  error: null,
  loadMoreError: null,
  listRequestId: null,
  stale: false,
  unreadCount: 0,
  unreadInFlight: false,
  markingAll: false,
};

type SliceRoot = { notifications: NotificationsState };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

export type FetchMode = 'initial' | 'refresh' | 'more';

export interface FetchNotificationsArg {
  mode: FetchMode;
}

/**
 * GET /notifications for the current filter. `initial` loads page 1 (the newest request
 * wins); `refresh` loads page 1 too but is skipped while a page-1 load already runs (focus,
 * a rising count and pull-to-refresh at once send one request); `more` loads the next page
 * and is skipped while any list request runs or when the last page is loaded.
 */
export const fetchNotifications = createAsyncThunk<
  NotificationPage,
  FetchNotificationsArg,
  ThunkConfig
>(
  'notifications/fetch',
  async ({ mode }, { getState, rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    const { filter, page } = getState().notifications;
    try {
      const result = await notificationsApi.list({ page: mode === 'more' ? page + 1 : 1, filter });
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : result;
    } catch (error) {
      const fallback = mode === 'more' ? NOTIFICATIONS_COPY.loadMoreFailed : NOTIFICATIONS_COPY.loadFailed;
      return rejectWithValue(toThunkRejection(error, fallback));
    }
  },
  {
    condition: ({ mode }, { getState }) => {
      if (mode === 'initial') return true;
      const { status, page, lastPage } = getState().notifications;
      if (mode === 'refresh') return status !== 'loading' && status !== 'refreshing';
      const busy = status === 'loading' || status === 'refreshing' || status === 'loadingMore';
      return !busy && page > 0 && page < lastPage;
    },
  },
);

/** GET /notifications/unread-count. Never two at once (dedupe for every caller). */
export const fetchUnreadCount = createAsyncThunk<number, void, ThunkConfig>(
  'notifications/unreadCount',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const count = await notificationsApi.unreadCount();
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : count;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, NOTIFICATIONS_COPY.loadFailed));
    }
  },
  { condition: (_, { getState }) => !getState().notifications.unreadInFlight },
);

/**
 * POST /notifications/{id}/read. Optimistic: the row reads as read and the count drops at
 * once; a failure puts both back, except 404 (not the caller's any more), which drops the row.
 * Skipped for a row the list already shows as read.
 */
export const markNotificationRead = createAsyncThunk<AppNotification | null, number, ThunkConfig>(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const item = await notificationsApi.markRead(id);
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : item;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, NOTIFICATIONS_COPY.markReadFailed));
    }
  },
  {
    condition: (id, { getState }) => {
      const item = getState().notifications.items.find((n) => n.id === id);
      return !item || item.readAt === null;
    },
  },
);

/** POST /notifications/read-all. Skipped while one runs. */
export const markAllNotificationsRead = createAsyncThunk<number, void, ThunkConfig>(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const count = await notificationsApi.markAllRead();
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : count;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, NOTIFICATIONS_COPY.markAllFailed));
    }
  },
  { condition: (_, { getState }) => !getState().notifications.markingAll },
);

/** Merges a page into the list without duplicates (a new row can shift pages by one). */
const appendUnique = (current: AppNotification[], next: AppNotification[]): AppNotification[] => {
  const seen = new Set(current.map((n) => n.id));
  return [...current, ...next.filter((n) => !seen.has(n.id))];
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: initialNotificationsState,
  reducers: {
    /** Switches All/Unread; the screen then loads page 1 of the new filter. */
    setNotificationFilter(state, action: { payload: NotificationFilter }) {
      if (state.filter === action.payload) return;
      state.filter = action.payload;
      state.items = [];
      state.page = 0;
      state.lastPage = 0;
      state.status = 'idle';
      state.error = null;
      state.loadMoreError = null;
    },
    /** A push arrived (foreground): the list reloads when it is next shown. */
    notificationsStale(state) {
      state.stale = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        const { mode } = action.meta.arg;
        state.listRequestId = action.meta.requestId;
        if (mode === 'more') {
          state.status = 'loadingMore';
          state.loadMoreError = null;
        } else {
          state.status = mode === 'refresh' && state.items.length > 0 ? 'refreshing' : 'loading';
          state.error = null;
        }
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.listRequestId) return;
        const { items, page, lastPage } = action.payload;
        state.items = action.meta.arg.mode === 'more' ? appendUnique(state.items, items) : items;
        state.page = page;
        state.lastPage = lastPage;
        state.status = 'ready';
        state.error = null;
        state.loadMoreError = null;
        state.listRequestId = null;
        if (action.meta.arg.mode !== 'more') state.stale = false;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        if (action.meta.condition || action.meta.requestId !== state.listRequestId) return;
        state.listRequestId = null;
        // Not stale any more: the error is shown and pull-to-refresh retries; staying stale
        // would make the screen reload again at once, in a loop while the server fails.
        if (action.meta.arg.mode !== 'more') state.stale = false;
        const message = action.payload?.message ?? NOTIFICATIONS_COPY.loadFailed;
        if (action.meta.arg.mode === 'more') {
          state.status = 'ready';
          state.loadMoreError = message;
        } else {
          // Rows from an earlier load stay visible; the screen shows the error over or instead of them.
          state.status = state.items.length > 0 ? 'ready' : 'failed';
          state.error = message;
        }
      })
      .addCase(fetchUnreadCount.pending, (state) => {
        state.unreadInFlight = true;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadInFlight = false;
        // More unread than before: new rows exist that a loaded list does not show (T-513).
        if (action.payload > state.unreadCount && state.status !== 'idle') state.stale = true;
        state.unreadCount = action.payload;
      })
      .addCase(fetchUnreadCount.rejected, (state, action) => {
        if (action.meta.condition) return;
        // The last known count stays; the next foreground or poll tries again.
        state.unreadInFlight = false;
      })
      .addCase(markNotificationRead.pending, (state, action) => {
        const item = state.items.find((n) => n.id === action.meta.arg);
        // A row opened from a push may not be loaded: its caller re-reads the server count.
        if (item && item.readAt === null) {
          item.readAt = new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        const index = state.items.findIndex((n) => n.id === updated.id);
        if (index >= 0) state.items[index] = updated;
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        if (action.meta.condition) return;
        const index = state.items.findIndex((n) => n.id === action.meta.arg);
        if (index < 0) return;
        if (action.payload?.kind === 'not_found') {
          state.items.splice(index, 1);
          return;
        }
        if (action.payload?.kind === 'cancelled') return;
        state.items[index].readAt = null;
        state.unreadCount += 1;
      })
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.markingAll = true;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        state.markingAll = false;
        const now = new Date().toISOString();
        state.items.forEach((n) => {
          if (n.readAt === null) n.readAt = now;
        });
        if (state.filter === 'unread') {
          state.items = [];
          state.page = 1;
          state.lastPage = 1;
        }
        state.unreadCount = action.payload;
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.markingAll = false;
      });
  },
});

export const { setNotificationFilter, notificationsStale } = notificationsSlice.actions;

export const selectNotificationsState = (state: SliceRoot): NotificationsState => state.notifications;
export const selectUnreadNotificationCount = (state: SliceRoot): number => state.notifications.unreadCount;
export const selectHasMoreNotifications = (state: SliceRoot): boolean =>
  state.notifications.page > 0 && state.notifications.page < state.notifications.lastPage;

export default notificationsSlice.reducer;
