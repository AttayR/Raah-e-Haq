/**
 * T-508: the shared paged list. A new entry on page 1 shifts later pages, so page 2 can repeat
 * a row already shown; it must appear once. A filter change restarts from page 1.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePagedList } from '../../../src/core/api/usePagedList';
import type { Page } from '../../../src/core/api/types';

type Row = { id: number };

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
});
