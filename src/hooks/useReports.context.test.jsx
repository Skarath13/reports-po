import { act, renderHook, waitFor } from '@testing-library/react';
import { useFullReport } from './useReports';
import api from '../api/client';

vi.mock('../api/client', () => ({ default: { getFullReport: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

test('never exposes the prior location snapshot during a context switch', async () => {
  let resolveNext;
  api.getFullReport
    .mockResolvedValueOnce({ marker: 'tustin-data' })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
    );
  const rendered = [];
  const { result, rerender } = renderHook(
    ({ location }) => {
      const report = useFullReport(
        location,
        '2026-09-04',
        'context-test-viewer',
      );
      rendered.push({ location, data: report.data });
      return report;
    },
    { initialProps: { location: 'tustin' } },
  );
  await waitFor(() =>
    expect(result.current.data?.marker).toBe('tustin-data'),
  );
  rerender({ location: 'irvine' });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  expect(
    rendered
      .filter((entry) => entry.location === 'irvine')
      .every((entry) => entry.data === null),
  ).toBe(true);
  await act(async () => resolveNext({ marker: 'irvine-data' }));
  expect(result.current.data?.marker).toBe('irvine-data');
});

test('a late response cannot replace the current report after returning to a cached location', async () => {
  let resolveIrvine;
  api.getFullReport
    .mockResolvedValueOnce({ marker: 'cached-tustin' })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveIrvine = resolve;
        }),
    );
  const { result, rerender } = renderHook(
    ({ location }) =>
      useFullReport(location, '2026-09-04', 'cache-race-test-viewer'),
    {
      initialProps: { location: 'tustin' },
    },
  );
  await waitFor(() =>
    expect(result.current.data?.marker).toBe('cached-tustin'),
  );
  rerender({ location: 'irvine' });
  rerender({ location: 'tustin' });
  expect(result.current.data?.marker).toBe('cached-tustin');
  await act(async () => resolveIrvine({ marker: 'late-irvine' }));
  expect(result.current.data?.marker).toBe('cached-tustin');
  expect(result.current.loading).toBe(false);
});
