/**
 * UI-R18 §H5: a support-reply push (`type: support`, BE-130) that arrives while the app is open
 * tells the ticket thread for that ticket to read itself again. The thread never polls.
 */
type Listener = (ticketId: number) => void;

const listeners = new Set<Listener>();

export const onSupportReplyPush = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitSupportReplyPush = (ticketId: number): void => {
  listeners.forEach((listener) => listener(ticketId));
};

/** Route name of the ticket thread (registered in both role stacks). */
export const SUPPORT_TICKET_ROUTE = 'SupportTicket';
