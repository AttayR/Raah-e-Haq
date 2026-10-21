/**
 * T-708: room a top overlay (the driver's incoming request banner) takes under the Toast anchor,
 * so a Toast shown at the same time sits below it instead of on top of it. 0 when nothing is up.
 */
let clearance = 0;
const listeners = new Set<() => void>();

export const toastClearance = {
  get: (): number => clearance,
  set: (value: number): void => {
    if (value === clearance) return;
    clearance = value;
    listeners.forEach(listener => listener());
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
