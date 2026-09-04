import { act, renderHook } from '@testing-library/react';
import { useReportUpdates } from './useReportUpdates';

const base = {
  userKey: 'id:updates-test',
  date: '2026-09-04',
  locationId: 'tustin',
};
const snapshots = (hash) => ({
  calendar: {
    snapshotHash: hash,
    entries: [{ customerName: 'Do not store me' }],
  },
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('detects changes before sign-off, survives reloads, and clears only when the section is opened', () => {
  const first = renderHook((props) => useReportUpdates(props), {
    initialProps: { ...base, snapshots: snapshots('before') },
  });
  expect(first.result.current.unreadSections).toEqual([]);
  first.rerender({ ...base, snapshots: snapshots('after') });
  expect(first.result.current.unreadSections).toEqual(['calendar']);
  first.unmount();
  const second = renderHook(() =>
    useReportUpdates({ ...base, snapshots: snapshots('after') }),
  );
  expect(second.result.current.unreadSections).toEqual(['calendar']);
  act(() => second.result.current.markSeen('calendar'));
  expect(second.result.current.unreadSections).toEqual([]);
  expect(
    localStorage.getItem('reports_updates_v1:id:updates-test'),
  ).not.toContain('Do not store me');
});

test('keeps scope isolated and preserves unread changes during pending or failed refreshes', () => {
  const { result, rerender } = renderHook(
    (props) => useReportUpdates(props),
    { initialProps: { ...base, snapshots: snapshots('one') } },
  );
  rerender({ ...base, snapshots: snapshots('two') });
  rerender({ ...base, snapshots: {} });
  act(() => result.current.markSeen('calendar'));
  expect(result.current.unreadSections).toEqual(['calendar']);
  rerender({
    ...base,
    locationId: 'irvine',
    snapshots: snapshots('different-scope'),
  });
  expect(result.current.unreadSections).toEqual([]);
  rerender({ ...base, snapshots: snapshots('two') });
  expect(result.current.unreadSections).toEqual(['calendar']);
  const other = renderHook(() =>
    useReportUpdates({
      ...base,
      userKey: 'id:another-user',
      snapshots: snapshots('two'),
    }),
  );
  expect(other.result.current.unreadSections).toEqual([]);
});

test('ignores unchanged content, includes deletions through the server fingerprint, and recovers from invalid storage', () => {
  localStorage.setItem('reports_updates_v1:id:updates-test', '{broken');
  const { result, rerender } = renderHook(
    (props) => useReportUpdates(props),
    { initialProps: { ...base, snapshots: snapshots('same') } },
  );
  rerender({ ...base, snapshots: snapshots('same') });
  expect(result.current.unreadSections).toEqual([]);
  rerender({
    ...base,
    snapshots: {
      calendar: { snapshotHash: 'empty-after-deletion', entries: [] },
    },
  });
  expect(result.current.unreadSections).toEqual(['calendar']);
});
