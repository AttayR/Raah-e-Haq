/**
 * The one product-dialog API (DESIGN_SYSTEM §5.15, UI-R3). Replaces `Alert.alert` for product
 * confirmations so dialogs follow the theme (native Alert stays only for OS-level prompts).
 * A module-level queue rendered by `DialogHost` (mounted once by NotificationManager); callable
 * from screens (`useConfirm()`), hooks and thunks. One dialog is visible at a time.
 *
 *   if (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true })) { … }
 */

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** Primary action label, e.g. "Sign out" (verb, sentence case; §7). */
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** The confirm button uses the `destructive` variant. */
  destructive?: boolean;
  /**
   * [UI-R18 review] `stacked` always stacks the two buttons (primary on top), for flows whose
   * spec asks for it (account deletion). `auto` (default): side by side only when both fit.
   */
  layout?: DialogLayout;
}

export type DialogLayout = 'auto' | 'stacked';

export interface AlertOptions {
  title: string;
  body?: string;
  /** Defaults to "Done". */
  confirmLabel?: string;
}

export interface DialogRequest {
  id: string;
  kind: 'confirm' | 'alert';
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive: boolean;
  layout?: DialogLayout;
  /** Called once with the user's answer (scrim tap and Android back answer `false`). */
  resolve: (confirmed: boolean) => void;
}

type Listener = () => void;

let queue: DialogRequest[] = [];
const listeners = new Set<Listener>();
let counter = 0;
/**
 * Mounted hosts, oldest first. A native Modal (ModalRoot) mounts its own host at a higher level,
 * because iOS cannot present the dialog's Modal from the root while another Modal is up. The
 * active host is the newest one at the highest level (mount order alone is not enough: a child
 * Modal's effects can run before the root host's).
 */
let hosts: Array<{ id: number; level: number }> = [];
let hostCounter = 0;

const emit = () => listeners.forEach(listener => listener());

const enqueue = (request: Omit<DialogRequest, 'id'>): string => {
  counter += 1;
  const id = `dialog_${counter}`;
  queue = [...queue, { ...request, id }];
  emit();
  return id;
};

/** Resolves the dialog with `id` and shows the next one. Answering twice is a no-op. */
const answer = (id: string, confirmed: boolean): void => {
  const request = queue.find(r => r.id === id);
  if (!request) return;
  queue = queue.filter(r => r.id !== id);
  emit();
  request.resolve(confirmed);
};

/** Asks a yes/no question; resolves `true` only when the confirm button is pressed. */
export const confirm = (options: ConfirmOptions): Promise<boolean> =>
  new Promise(resolve => {
    enqueue({
      kind: 'confirm',
      title: options.title,
      body: options.body,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      destructive: options.destructive ?? false,
      layout: options.layout,
      resolve,
    });
  });

/** A confirm that can change its question while it is open (T-589). */
export interface ConfirmHandle {
  /** Resolves `true` only when the confirm button is pressed. */
  result: Promise<boolean>;
  /** Replaces the question's text and labels; a no-op once it was answered. */
  update: (options: ConfirmOptions) => void;
}

/**
 * `confirm`, plus `update` to change the open question in place (same dialog, no flicker), e.g.
 * "Cancel request?" becoming "Cancel ride?" with its fee when a driver accepts meanwhile.
 */
export const openConfirm = (options: ConfirmOptions): ConfirmHandle => {
  let id = '';
  const result = new Promise<boolean>(resolve => {
    id = enqueue({
      kind: 'confirm',
      title: options.title,
      body: options.body,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      destructive: options.destructive ?? false,
      layout: options.layout,
      resolve,
    });
  });
  const update = (next: ConfirmOptions): void => {
    if (!queue.some(r => r.id === id)) return;
    queue = queue.map(r =>
      r.id === id
        ? {
            ...r,
            title: next.title,
            body: next.body,
            confirmLabel: next.confirmLabel,
            cancelLabel: next.cancelLabel,
            destructive: next.destructive ?? false,
            layout: next.layout,
          }
        : r,
    );
    emit();
  };
  return { result, update };
};

/** A single-button notice; resolves when it is dismissed. */
export const alert = (options: AlertOptions): Promise<void> =>
  new Promise(resolve => {
    enqueue({
      kind: 'alert',
      title: options.title,
      body: options.body,
      confirmLabel: options.confirmLabel,
      destructive: false,
      resolve: () => resolve(),
    });
  });

/** Dismisses every open and queued dialog as cancelled (sign-out, navigation reset). */
const dismissAll = (): void => {
  const pending = queue;
  queue = [];
  emit();
  pending.forEach(r => r.resolve(false));
};

export const dialog = { confirm, alert, answer, dismissAll };

export type DialogApi = typeof dialog;

/** Store access for the host component (useSyncExternalStore). */
export const dialogStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getCurrent: (): DialogRequest | null => queue[0] ?? null,
  /** Registers a host; returns its id and an unregister function. */
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
  /** The host that renders dialogs: the newest one at the highest level. */
  getActiveHost: (): number | null =>
    hosts.reduce<{ id: number; level: number } | null>(
      (best, h) => (best === null || h.level >= best.level ? h : best),
      null,
    )?.id ?? null,
};

/** Hook form for components: `const confirm = useConfirm();`. Stable across renders. */
export const useConfirm = (): typeof confirm => confirm;
