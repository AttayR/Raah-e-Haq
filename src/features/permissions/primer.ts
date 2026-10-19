import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';

/**
 * Permission pre-prompts (UI-R8, docs/design/screens/shared-permissions.md; behaviour T-308 and
 * T-502). Before the OS asks for location or notifications the first time, the app explains why
 * on its own full-screen page; "Continue" goes on to the OS prompt, "Not now" skips it.
 *
 * - Shown once per kind, only while the OS has not been answered yet (`osUndetermined`), and only
 *   while a host is mounted (`PermissionPrimerHost`, signed-in app). Without a host the caller
 *   goes straight on, as before this existed.
 * - The answer is stored (AsyncStorage), so "Not now" is not asked again at the next lookup; the
 *   screen's own "Turn on" / "Enable" button (an explicit tap) asks the OS directly.
 * - Driver location has no "Not now": the driver cannot go online without it.
 */
export type PrimerKind = 'locationPassenger' | 'locationDriver' | 'notifications';
export type PrimerChoice = 'continue' | 'later';

export const PRIMER_STORAGE_PREFIX = 'permission_primer_';

/** Kinds whose page offers "Not now". */
export const primerCanSkip = (kind: PrimerKind): boolean => kind !== 'locationDriver';

type Listener = () => void;

type Pending = { kind: PrimerKind; resolve: (choice: PrimerChoice) => void; waiters: Array<(choice: PrimerChoice) => void> };

let current: Pending | null = null;
let queue: Pending[] = [];
let hostCount = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(listener => listener());

/** One page at a time; a second request for a kind already asked waits for the same answer. */
const ask = (kind: PrimerKind): Promise<PrimerChoice> =>
  new Promise(resolve => {
    const same = current?.kind === kind ? current : queue.find(p => p.kind === kind);
    if (same) {
      same.waiters.push(resolve);
      return;
    }
    const pending: Pending = { kind, resolve, waiters: [] };
    if (current) {
      queue = [...queue, pending];
    } else {
      current = pending;
      emit();
    }
  });

export const permissionPrimer = {
  /** The kind whose page is up, or null. */
  current(): PrimerKind | null {
    return current?.kind ?? null;
  },
  /** Answers the page that is up and shows the next one. A second answer is a no-op. */
  answer(choice: PrimerChoice): void {
    const done = current;
    if (!done) return;
    const effective = choice === 'later' && !primerCanSkip(done.kind) ? 'continue' : choice;
    current = queue[0] ?? null;
    queue = queue.slice(1);
    emit();
    done.resolve(effective);
    done.waiters.forEach(waiter => waiter(effective));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Called by PermissionPrimerHost while it is mounted. */
  registerHost(): () => void {
    hostCount += 1;
    return () => {
      hostCount = Math.max(0, hostCount - 1);
      if (hostCount === 0 && current) {
        // Signed out with a page up: nobody can answer it any more; let the caller go on later.
        const all = [current, ...queue];
        current = null;
        queue = [];
        emit();
        all.forEach(p => {
          p.resolve('later');
          p.waiters.forEach(waiter => waiter('later'));
        });
      }
    };
  },
  hasHost(): boolean {
    return hostCount > 0;
  },
  /** Tests only. */
  reset(): void {
    current = null;
    queue = [];
    hostCount = 0;
    emit();
  },
};

const readChoice = async (kind: PrimerKind): Promise<PrimerChoice | null> => {
  try {
    const value = await AsyncStorage.getItem(PRIMER_STORAGE_PREFIX + kind);
    return value === 'continue' || value === 'later' ? value : null;
  } catch {
    return null;
  }
};

const storeChoice = async (kind: PrimerKind, choice: PrimerChoice): Promise<void> => {
  try {
    await AsyncStorage.setItem(PRIMER_STORAGE_PREFIX + kind, choice);
  } catch (error) {
    logger.debug('[permissions] primer choice not stored', { error: error instanceof Error ? error.message : 'unknown' });
  }
};

/**
 * Before an automatic OS permission prompt:
 * - `proceed`: no pre-prompt needed (the OS has answered, or it was answered "Continue" before, or
 *   no host is mounted); carry on as without it.
 * - `continued`: the pre-prompt was just shown and the user tapped "Continue": ask the OS now.
 * - `skip`: the user said "Not now"; leave the OS unasked and show the screen's "Turn on" state.
 * Never throws.
 */
export type PrimerOutcome = 'proceed' | 'continued' | 'skip';

export const primeBeforeOsPrompt = async (
  kind: PrimerKind,
  osUndetermined: () => Promise<boolean>,
): Promise<PrimerOutcome> => {
  try {
    if (!(await osUndetermined())) return 'proceed';
    const stored = await readChoice(kind);
    if (stored) return stored === 'continue' || !primerCanSkip(kind) ? 'proceed' : 'skip';
    if (!permissionPrimer.hasHost()) return 'proceed';
    const choice = await ask(kind);
    // The host went away with the page up (signed out): nobody answered, so nothing is stored.
    if (!permissionPrimer.hasHost()) return 'skip';
    await storeChoice(kind, choice);
    return choice === 'continue' ? 'continued' : 'skip';
  } catch (error) {
    logger.debug('[permissions] primer failed', { error: error instanceof Error ? error.message : 'unknown' });
    return 'proceed';
  }
};
