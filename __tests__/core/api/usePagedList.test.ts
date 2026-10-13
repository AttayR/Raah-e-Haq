/**
 * T-508: the shared paged list. A new entry on page 1 shifts later pages, so page 2 can repeat
 * a row already shown; it must appear once. A filter change restarts from page 1.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePagedList } from '../../../src/core/api/usePagedList';
import type { Page } from '../../../src/core/api/types';

type Row = { id: number; note?: string };

const page = (n: number, ids: number[], last = 2): Page<Row> => ({
  items: ids.map((id) => ({ id })),
  page: n,
  lastPage: last,
  total: 4,
});

describe('usePagedList', () => {
  it('skips a row on page 2 that page 1 already showed', async () => {
    const fetchPage = jest.fn((n: number) => Promise.resolve(n === 1 ? page(1, [4, 3]) : page(2, [3, 2, 1])));
    const { result } = renderHook(() =>
      usePagedList<Row>({ fetchPage, keyOf: (row) => row.id, queryKey: 'all', fallbackError: 'failed' }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual([4, 3, 2, 1]));
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('restarts from page 1 when the query key changes', async () => {
    const fetchPage = jest.fn((n: number) => Promise.resolve(page(n, [n * 10], 1)));
    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: string }) =>
        usePagedList<Row>({ fetchPage, keyOf: (row) => row.id, queryKey, fallbackError: 'failed' }),
      { initialProps: { queryKey: 'all' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ queryKey: 'credit' });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith(1);
  });

  // T-518: back on the wallet after a top-up, the history must show the new entry.
  describe('refocus', () => {
    type Props = { enabled: boolean };
    const deferred = () => {
      let resolve: (value: Page<Row>) => void = () => undefined;
      const promise = new Promise<Page<Row>>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    };

    /** Two pages loaded ([4, 3] then [2, 1]), then the screen loses and regains focus. */
    const scrolledThenRefocused = async (fresh: Promise<Page<Row>>) => {
      const fetchPage = jest
        .fn<Promise<Page<Row>>, [number]>()
        .mockResolvedValueOnce(page(1, [4, 3]))
        .mockResolvedValueOnce(page(2, [2, 1]))
        .mockReturnValueOnce(fresh);
      const hook = renderHook(
        ({ enabled }: Props) =>
          usePagedList<Row>({ fetchPage, keyOf: (row) => row.id, queryKey: 'all', fallbackError: 'failed', enabled }),
        { initialProps: { enabled: true } },
      );
      await waitFor(() => expect(hook.result.current.status).toBe('ready'));
      await act(async () => {
        hook.result.current.loadMore();
      });
      await waitFor(() => expect(hook.result.current.items.map((row) => row.id)).toEqual([4, 3, 2, 1]));
      hook.rerender({ enabled: false });
      hook.rerender({ enabled: true });
      return { ...hook, fetchPage };
    };

    it('merges a fresh page 1 quietly: new rows on top, updated rows in place, page 2 rows kept', async () => {
      const fresh = deferred();
      const { result, rerender, fetchPage } = await scrolledThenRefocused(fresh.promise);
      expect(fetchPage).toHaveBeenCalledTimes(3);
      expect(fetchPage).toHaveBeenLastCalledWith(1);
      // No skeleton and no spinner: the old rows stay while page 1 loads.
      expect(result.current.status).toBe('ready');
      expect(result.current.items.map((row) => row.id)).toEqual([4, 3, 2, 1]);

      // A second focus while the refresh is in flight sends nothing.
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(fetchPage).toHaveBeenCalledTimes(3);

      await act(async () => {
        fresh.resolve({
          items: [{ id: 6 }, { id: 5 }, { id: 4, note: 'reversed' }],
          page: 1,
          lastPage: 3,
          total: 6,
        });
      });
      expect(result.current.items).toEqual([{ id: 6 }, { id: 5 }, { id: 4, note: 'reversed' }, { id: 3 }, { id: 2 }, { id: 1 }]);
      expect(result.current.status).toBe('ready');
      expect(result.current.total).toBe(6);
      // Still on page 2 of the new 3: scrolling on asks for page 3, not page 2 again.
      expect(result.current.hasMore).toBe(true);
      fetchPage.mockResolvedValueOnce(page(3, [1, 0], 3));
      await act(async () => {
        result.current.loadMore();
      });
      expect(fetchPage).toHaveBeenLastCalledWith(3);
      await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual([6, 5, 4, 3, 2, 1, 0]));
    });

    it('starts over from page 1 when the fresh page shares no row with the list', async () => {
      const { result } = await scrolledThenRefocused(Promise.resolve(page(1, [9, 8], 1)));
      await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual([9, 8]));
      expect(result.current.hasMore).toBe(false);
      expect(result.current.status).toBe('ready');
    });

    it('keeps the rows without an error when the quiet refresh fails', async () => {
      const fetchPage = jest
        .fn<Promise<Page<Row>>, [number]>()
        .mockResolvedValueOnce(page(1, [4, 3], 1))
        .mockRejectedValueOnce(new Error('offline'));
      const { result, rerender } = renderHook(
        ({ enabled }: Props) =>
          usePagedList<Row>({ fetchPage, keyOf: (row) => row.id, queryKey: 'all', fallbackError: 'failed', enabled }),
        { initialProps: { enabled: true } },
      );
      await waitFor(() => expect(result.current.status).toBe('ready'));
      rerender({ enabled: false });
      await act(async () => {
        rerender({ enabled: true });
      });
      expect(fetchPage).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
      expect(result.current.items.map((row) => row.id)).toEqual([4, 3]);
    });

    it('retries with the loading state when the first load had failed', async () => {
      const fetchPage = jest
        .fn<Promise<Page<Row>>, [number]>()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(page(1, [1], 1));
      const { result, rerender } = renderHook(
        ({ enabled }: Props) =>
          usePagedList<Row>({ fetchPage, keyOf: (row) => row.id, queryKey: 'all', fallbackError: 'failed', enabled }),
        { initialProps: { enabled: true } },
      );
      await waitFor(() => expect(result.current.status).toBe('failed'));
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(result.current.status).toBe('loading');
      await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual([1]));
    });
  });
});
