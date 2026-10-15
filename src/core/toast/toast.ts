import axios from 'axios';
import { isApiError, rejectionMessage, toApiError } from '../api/errors';

/**
 * The one toast API. A module-level queue rendered by the active `ToastHost` (NotificationManager
 * at the app root, or ModalRoot inside a native Modal). Callable from anywhere: screens
 * (`useToast()`), hooks, thunks and services.
 * One toast is visible at a time; the rest wait in order (DESIGN_SYSTEM 5.16).
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  /** Milliseconds; 0 keeps the toast until hidden. Defaults: 3 s, 4 s with an action, loading never. */
  duration?: number;
  action?: ToastAction;
  onHide?: () => void;
  /**
   * Points between `insets.top + 8` and the toast, so it clears whatever sits at the top of the
   * screen. Defaults to the Header bar height (56), which keeps a pushed screen's back button and
   * a map screen's 48 floating back button tappable (T-540); a screen with taller floating
   * controls passes its own (driver ride: 64).
   */
  topOffset?: number;
}

export interface ToastConfig extends ToastOptions {
  id: string;
  type: ToastType;
  duration: number;
}

export const TOAST_DURATION_MS = 3000;
export const TOAST_DURATION_WITH_ACTION_MS = 4000;
/** Pending toasts beyond this are dropped (oldest pending first) so a burst cannot pile up. */
const MAX_QUEUE = 5;

type Listener = () => void;

let queue: ToastConfig[] = [];
const listeners = new Set<Listener>();
let counter = 0;
/**
 * Mounted toast hosts, oldest first. A native Modal (ModalRoot) is a separate window that covers
 * the root host, so it mounts its own host at a higher level; the active host is the newest one
 * at the highest level, so a toast asked for while a modal sheet is up shows above that sheet.
 */
let hosts: Array<{ id: number; level: number }> = [];
let hostCounter = 0;

const emit = () => listeners.forEach(listener => listener());

const defaultDuration = (options: ToastOptions): number => {
  if (options.duration !== undefined) return options.duration;
  if (options.type === 'loading') return 0;
  return options.action ? TOAST_DURATION_WITH_ACTION_MS : TOAST_DURATION_MS;
};

const show = (options: ToastOptions): string => {
  const type = options.type ?? 'info';
  const duplicate = queue.find(
    t => t.type === type && t.title === options.title && t.message === options.message,
  );
  if (duplicate) return duplicate.id;

  counter += 1;
  const config: ToastConfig = {
    ...options,
    id: `toast_${counter}`,
    type,
    duration: defaultDuration({ ...options, type }),
  };
  queue = [...queue, config];
  if (queue.length > MAX_QUEUE) {
    // Keep the visible toast (index 0) and the newest ones.
    queue = [queue[0], ...queue.slice(queue.length - (MAX_QUEUE - 1))];
  }
  emit();
  return config.id;
};

/**
 * Hides one toast, or every toast when no id is given, and runs each removed toast's
 * `onHide`. This is the only place toasts leave the queue (the host calls it after its exit
 * animation). A visible toast hidden from code is removed at once, without the exit animation.
 */
const hide = (id?: string) => {
  const removed = id ? queue.filter(t => t.id === id) : queue;
  if (removed.length === 0) return;
  queue = id ? queue.filter(t => t.id !== id) : [];
  emit();
  removed.forEach(t => t.onHide?.());
};

/**
 * User-facing text for any error: ApiError and axios errors use the API layer's safe copy,
 * rejected thunk payloads use their message. Other thrown values get the fallback, because
 * their text is technical (stack traces, "undefined is not an object").
 * Returns null for cancelled requests, which the user caused and needs no message for.
 */
export const errorToastMessage = (error: unknown, fallback: string): string | null => {
  if (isApiError(error) || axios.isAxiosError(error) || axios.isCancel(error)) {
    const apiError = toApiError(error);
    return apiError.kind === 'cancelled' ? null : apiError.message || fallback;
  }
  if (error instanceof Error) return fallback;
  return rejectionMessage(error, fallback);
};

const withType =
  (type: ToastType) =>
  (title: string, message?: string, options?: Omit<ToastOptions, 'type' | 'title' | 'message'>) =>
    show({ ...options, type, title, message });

export const toast = {
  show,
  hide,
  success: withType('success'),
  error: withType('error'),
  warning: withType('warning'),
  info: withType('info'),
  loading: withType('loading'),
  /**
   * Shows the right message for an ApiError, axios error or rejected thunk payload.
   * Returns the toast id, or null when nothing was shown (cancelled request).
   */
  fromError: (error: unknown, fallback: string): string | null => {
    const message = errorToastMessage(error, fallback);
    return message ? show({ type: 'error', title: message }) : null;
  },
};

export type ToastApi = typeof toast;

/** Store access for the host component (useSyncExternalStore). */
export const toastStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getCurrent: (): ToastConfig | null => queue[0] ?? null,
  getQueue: (): readonly ToastConfig[] => queue,
  /** Adds a host (0 = the app root, 1 = inside a native Modal); unregister on unmount. */
  registerHost: (level = 0): { id: number; unregister: () => void } => {
    hostCounter += 1;
    const id = hostCounter;
    hosts = [...hosts, { id, level }];
    emit();
    return {
      id,
      unregister: () => {
        hosts = hosts.filter(h => h.id !== id);
        emit();
      },
    };
  },
  /** The host that renders toasts: the newest one at the highest level. */
  getActiveHost: (): number | null =>
    hosts.reduce<{ id: number; level: number } | null>(
      (best, h) => (best === null || h.level >= best.level ? h : best),
      null,
    )?.id ?? null,
};
