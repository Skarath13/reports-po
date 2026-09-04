import { act, renderHook } from '@testing-library/react';
import { useReportUpdates } from './useReportUpdates';

const base = {
  userKey: 'id:updates-test',
  date: '2026-09-04',
  locationId: 'tustin',
};
const entry = (key, version = 'v1') => ({
  entryKey: key,
  contentVersion: version,
  customerName: 'Never store this',
});
const snapshots = (...entries) => ({
  calendar: {
    snapshotHash:
      entries.map((e) => e.entryKey + e.contentVersion).join('-') || 'empty',
    entries,
  },
});
const storageKey = 'reports_updates_v2:id:updates-test';
const stored = () =>
  JSON.parse(localStorage.getItem(storageKey))['2026-09-04|tustin'].sections
    .calendar;
const setup = (props = {}) =>
  renderHook((input) => useReportUpdates(input), {
    initialProps: {
      ...base,
      snapshots: snapshots(entry('a'), entry('b')),
      ...props,
    },
  });
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('loading a snapshot never records offscreen items as seen, and only an observed item gets a baseline', () => {
  const { result } = setup();
  expect(result.current.unreadSections).toEqual([]);
  expect(stored().entries.a.seen).toBeNull();
  expect(stored().entries.b.seen).toBeNull();
  act(() => result.current.markEntrySeen('calendar', entry('a')));
  expect(stored().entries.a.seen).toBe('v1');
  expect(stored().entries.b.seen).toBeNull();
  expect(localStorage.getItem(storageKey)).not.toContain('Never store this');
});

test('each changed or added item stays new through reloads until that exact version is seen', () => {
  const first = setup();
  const changed = snapshots(entry('a', 'v2'), entry('b', 'v2'), entry('c'));
  first.rerender({ ...base, snapshots: changed });
  expect(first.result.current.sectionStates.calendar.unseenCount).toBe(3);
  first.unmount();
  const second = setup({ snapshots: changed });
  expect(second.result.current.sectionStates.calendar.unseenCount).toBe(3);
  act(() => second.result.current.markEntrySeen('calendar', entry('a', 'v1')));
  expect(second.result.current.sectionStates.calendar.unseenCount).toBe(3);
  act(() => second.result.current.markEntrySeen('calendar', entry('a', 'v2')));
  expect(second.result.current.sectionStates.calendar.unseenCount).toBe(2);
  expect(second.result.current.unreadSections).toEqual(['calendar']);
  second.rerender({
    ...base,
    snapshots: snapshots(entry('a', 'v3'), entry('b', 'v2'), entry('c')),
  });
  expect(second.result.current.sectionStates.calendar.unseenCount).toBe(3);
});

test('pending refreshes, another location, another date and another viewer cannot clear an update', () => {
  const { result, rerender } = setup();
  const changed = snapshots(entry('a', 'v2'), entry('b'));
  rerender({ ...base, snapshots: changed });
  rerender({ ...base, snapshots: {} });
  act(() => result.current.markEntrySeen('calendar', entry('a', 'v2')));
  expect(result.current.unreadSections).toEqual(['calendar']);
  for (const scope of [
    { locationId: 'irvine' },
    { date: '2026-09-05' },
    { userKey: 'id:other' },
  ]) {
    rerender({ ...base, ...scope, snapshots: changed });
    expect(result.current.unreadSections).toEqual([]);
    rerender({ ...base, snapshots: changed });
    expect(result.current.unreadSections).toEqual(['calendar']);
  }
});

test('removals get their own notice; dismissing it does not clear changed rows', () => {
  const { result, rerender } = setup();
  rerender({ ...base, snapshots: snapshots(entry('a', 'v2')) });
  expect(result.current.sectionStates.calendar.unseenRemovedCount).toBe(1);
  act(() => result.current.markRemovedSeen('calendar'));
  expect(result.current.sectionStates.calendar.unseenRemovedCount).toBe(0);
  expect(result.current.sectionStates.calendar.unseenCount).toBe(1);
  act(() => result.current.markEntrySeen('calendar', entry('a', 'v2')));
  expect(result.current.unreadSections).toEqual([]);
});

test('the saved review and server acknowledgements govern updates after sign-off, including refresh and failed saves', () => {
  const current = snapshots(entry('a', 'v2'));
  const reviewState = {
    signedOff: true,
    ready: true,
    review: { entries: [entry('a'), entry('b')] },
    snapshot: current.calendar,
    unseenEntries: new Set(['a']),
  };
  const { result, rerender } = setup({
    snapshots: current,
    reviewStates: { calendar: reviewState },
  });
  expect(result.current.sectionStates.calendar.unseenCount).toBe(1);
  expect(result.current.sectionStates.calendar.unseenRemovedCount).toBe(1);
  act(() => result.current.markRemovedSeen('calendar'));
  rerender({
    ...base,
    snapshots: {},
    reviewStates: {
      calendar: {
        ...reviewState,
        ready: false,
        snapshot: null,
        unseenEntries: new Set(),
      },
    },
  });
  expect(result.current.sectionStates.calendar.unseenCount).toBe(1);
  expect(result.current.sectionStates.calendar.unseenRemovedCount).toBe(0);
  rerender({
    ...base,
    snapshots: current,
    reviewStates: { calendar: { ...reviewState, unseenEntries: new Set() } },
  });
  expect(result.current.unreadSections).toEqual([]);
  // A rejected optimistic acknowledgement restores the server's unread version.
  rerender({
    ...base,
    snapshots: current,
    reviewStates: { calendar: reviewState },
  });
  expect(result.current.unreadSections).toEqual(['calendar']);
});

test('invalid or blocked storage does not prevent in-session tracking', () => {
  localStorage.setItem(storageKey, '{broken');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('Storage blocked');
  });
  const { result, rerender } = setup();
  rerender({ ...base, snapshots: snapshots(entry('a', 'v2'), entry('b')) });
  expect(result.current.sectionStates.calendar.unseenCount).toBe(1);
  act(() => result.current.markEntrySeen('calendar', entry('a', 'v2')));
  expect(result.current.unreadSections).toEqual([]);
});
