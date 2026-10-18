import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * [T-560] One native modal sheet at a time.
 *
 * On iOS a native `Modal` is presented by the app's root view controller, which can present only
 * one view controller at a time. A second Modal asked for while another is still up (a sheet
 * still sliding out, e.g. the parcel code sheet while the ride's rating sheet opens) is refused
 * by UIKit ("Attempt to present … which is already presenting …"): it never shows, React still
 * believes it is up, its inline dialog and toast hosts swallow every `confirm()` and toast, and
 * the screen can stop answering touches. Top-level modal sheets therefore take turns: a sheet
 * that wants to open waits in this queue until every sheet ahead of it has unmounted its Modal
 * (its close animation finished), then presents.
 *
 * A sheet rendered inside another Modal (`ModalRoot`) is presented by that Modal, not by the root,
 * so it does not queue (it would otherwise wait for its own parent to close).
 */
type Listener = () => void;

let queue: number[] = [];
let nextTicket = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(listener => listener());

export const modalQueue = {
  /** Joins the queue; the returned ticket holds the turn while it is first. */
  enter(): number {
    const ticket = nextTicket++;
    queue = [...queue, ticket];
    emit();
    return ticket;
  },
  leave(ticket: number): void {
    if (!queue.includes(ticket)) return;
    queue = queue.filter(t => t !== ticket);
    emit();
  },
  /** The ticket whose sheet may have its Modal up now, or null. */
  current(): number | null {
    return queue[0] ?? null;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Tests only: forget every ticket. */
  reset(): void {
    queue = [];
    emit();
  },
};

/** True inside a native Modal's content (set by `ModalRoot`). */
export const InsideModalContext = createContext(false);

const noSubscription = () => () => {};
const noTurn = (): number | null => null;

/**
 * Whether a modal sheet that `wants` its Modal up may render it now. Nested sheets (inside a
 * Modal) never wait. The turn is held from the first render that wants it until the sheet stops
 * wanting it (its Modal unmounted), so the next sheet presents only after this one is dismissed.
 *
 * [T-562] Only a sheet that wants a turn listens to the queue: a closed sheet, a nested one and
 * every map sheet (`wants` always false) never re-render when other sheets open or close.
 */
export const useModalTurn = (wants: boolean): boolean => {
  const nested = useContext(InsideModalContext);
  const [ticket, setTicket] = useState<number | null>(null);
  const queued = wants && !nested;
  useEffect(() => {
    if (!queued) return undefined;
    const mine = modalQueue.enter();
    setTicket(mine);
    return () => {
      modalQueue.leave(mine);
      setTicket(null);
    };
  }, [queued]);
  const current = useSyncExternalStore(
    queued ? modalQueue.subscribe : noSubscription,
    queued ? modalQueue.current : noTurn,
  );
  if (nested) return wants;
  return wants && ticket !== null && current === ticket;
};

/** iOS reports `onDismiss` after its dismiss animation; this releases the turn if it never does. */
export const MODAL_DISMISS_FALLBACK_MS = 1000;

/**
 * [T-562] The queue for a raw native `Modal` (the root Dialog, legacy sheets) that animates
 * itself out: pass `show` as the Modal's `visible` and `onDismiss` as its `onDismiss`. The turn is
 * held while the Modal is shown and, on iOS, until its dismiss animation has finished (`onDismiss`,
 * or a fallback timer), because UIKit refuses to present the next Modal while one is still going
 * away. Android removes its dialog window at once, so there the turn ends when `visible` does.
 */
export const useQueuedModal = (visible: boolean): { show: boolean; onDismiss: () => void } => {
  // True from the first render that shows the Modal until it has been dismissed.
  const [held, setHeld] = useState(false);
  // [T-565] True from the render that hides a shown Modal until its dismiss has finished. A Modal
  // asked for again meanwhile (a new confirm() during the dialog fade-out) waits for `onDismiss`:
  // UIKit cannot present it again while it is still going away.
  const [dismissing, setDismissing] = useState(false);
  const turn = useModalTurn(visible || held);
  const show = visible && turn && !dismissing;
  // Set during render (not in an effect) so no render in between lets the turn go.
  if (show && !held) setHeld(true);
  if (held && !visible && !dismissing) setDismissing(true);
  const release = useCallback(() => {
    setHeld(false);
    setDismissing(false);
  }, []);
  useEffect(() => {
    if (!dismissing) return undefined;
    if (Platform.OS !== 'ios') {
      release();
      return undefined;
    }
    const timer = setTimeout(release, MODAL_DISMISS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [dismissing, release]);
  return { show, onDismiss: release };
};
