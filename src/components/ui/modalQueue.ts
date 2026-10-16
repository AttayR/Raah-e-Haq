import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';

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

/**
 * Whether a modal sheet that `wants` its Modal up may render it now. Nested sheets (inside a
 * Modal) never wait. The turn is held from the first render that wants it until the sheet stops
 * wanting it (its Modal unmounted), so the next sheet presents only after this one is dismissed.
 */
export const useModalTurn = (wants: boolean): boolean => {
  const nested = useContext(InsideModalContext);
  const [ticket, setTicket] = useState<number | null>(null);
  useEffect(() => {
    if (!wants || nested) return undefined;
    const mine = modalQueue.enter();
    setTicket(mine);
    return () => {
      modalQueue.leave(mine);
      setTicket(null);
    };
  }, [nested, wants]);
  const current = useSyncExternalStore(modalQueue.subscribe, modalQueue.current);
  if (nested) return wants;
  return wants && ticket !== null && current === ticket;
};
