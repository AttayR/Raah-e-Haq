import { formatRelativeDate } from '../../utils/format';
import type { ThreadItem } from './thread';

/** Messages from one side within this gap (and on the same day) form one run. */
export const RUN_GAP_MS = 5 * 60_000;

/** A bubble with its place in its run: the time and status show under the run's last bubble. */
export interface BubbleRow {
  kind: 'bubble';
  key: string;
  item: ThreadItem;
  mine: boolean;
  /** Oldest bubble of its run (16 above it instead of 4). */
  firstInRun: boolean;
  /** Newest bubble of its run (time and status under it). */
  lastInRun: boolean;
}

/** A centred "Today" / "Yesterday" / "Mon, 28 Sep" pill above a day's first message. */
export interface DayRow {
  kind: 'day';
  key: string;
  label: string;
}

export type ThreadRow = BubbleRow | DayRow;

const isMine = (item: ThreadItem): boolean => item.kind === 'pending' || item.message.isMine;

const timeOf = (item: ThreadItem): number => {
  const at = Date.parse(item.kind === 'pending' ? item.pending.createdAt : item.message.createdAt);
  return Number.isNaN(at) ? 0 : at;
};

const dayKeyOf = (at: number): string => {
  if (!at) return 'undated';
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * UI-R14 (shared-chat-thread): the inverted list's rows, newest first, from the thread items
 * (also newest first). Consecutive messages from one side, on the same day and within
 * `RUN_GAP_MS`, form a run; a day pill follows (sits visually above) each day's oldest message.
 */
export const chatRowsNewestFirst = (items: ReadonlyArray<ThreadItem>, now: Date = new Date()): ThreadRow[] => {
  const rows: ThreadRow[] = [];
  items.forEach((item, index) => {
    const newer = index > 0 ? items[index - 1] : null;
    const older = index < items.length - 1 ? items[index + 1] : null;
    const at = timeOf(item);
    const day = dayKeyOf(at);
    const sameRun = (other: ThreadItem | null): boolean =>
      !!other &&
      isMine(other) === isMine(item) &&
      dayKeyOf(timeOf(other)) === day &&
      Math.abs(timeOf(other) - at) <= RUN_GAP_MS;
    rows.push({
      kind: 'bubble',
      key: item.key,
      item,
      mine: isMine(item),
      firstInRun: !sameRun(older),
      lastInRun: !sameRun(newer),
    });
    const olderDay = older ? dayKeyOf(timeOf(older)) : null;
    if (day !== 'undated' && olderDay !== day) {
      rows.push({ kind: 'day', key: `day-${day}-${item.key}`, label: formatRelativeDate(at, now) });
    }
  });
  return rows;
};
