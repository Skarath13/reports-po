import { act, fireEvent, render, screen } from '@testing-library/react';
import PacificClock from './PacificClock';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('shows Pacific hours, minutes and seconds and ticks through midnight', () => {
  vi.setSystemTime(new Date('2026-09-05T06:59:59Z'));
  const { unmount } = render(<PacificClock />);
  expect(screen.getByText('11:59:59 PM')).toHaveAttribute(
    'datetime',
    '2026-09-05T06:59:59.000Z',
  );
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText('12:00:00 AM')).toBeVisible();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('follows Pacific daylight saving time and catches up when a tab returns', () => {
  vi.setSystemTime(new Date('2026-11-01T08:59:59Z'));
  render(<PacificClock />);
  expect(screen.getByText('1:59:59 AM')).toBeVisible();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText('1:00:00 AM')).toBeVisible();
  vi.setSystemTime(new Date('2026-12-01T20:12:34Z'));
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByText('12:12:34 PM')).toBeVisible();
});
