import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import DuplicateBookingViews from './DuplicateBookingViews';
import api from '../api/client';

vi.mock('../api/client', () => ({ default: { getWeeklyDuplicateBookings: vi.fn() } }));
const location = { squareId: 'tustin', name: 'Tustin' };
const response = (date = '2026-10-01') => ({ date, endDate: '2026-10-07', refreshedAt: '2026-10-01T19:00:00Z', cacheSeconds: 300,
  groups: [{ customer: 'Test Client', isCrossLocation: true, locations: ['Tustin', 'Irvine'], appointments: [
    { id: 'one', appointmentTime: '2026-10-01T16:00:00Z', locationId: 'tustin', locationName: 'Tustin', serviceName: 'Natural Fill', technicianName: 'Alice' },
    { id: 'two', appointmentTime: '2026-10-06T17:00:00Z', locationId: 'irvine', locationName: 'Irvine', serviceName: 'Volume Set', technicianName: 'Chloe' },
  ] }],
});
function TestView(props) {
  const [weekly, setWeekly] = useState(false);
  return <DuplicateBookingViews date="2026-10-01" location={location} dayLabel="Today" visible {...props} weekly={weekly} onRangeChange={setWeekly}>
  <button>Sign off daily duplicates</button>
  </DuplicateBookingViews>;
}
const renderView = (props = {}) => render(<TestView {...props} />);
beforeEach(() => { vi.clearAllMocks(); api.getWeeklyDuplicateBookings.mockResolvedValue(response()); });

test('fetches weekly data only after selection and keeps daily sign-off scoped to daily results', async () => {
  renderView();
  expect(api.getWeeklyDuplicateBookings).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Sign off daily duplicates' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  expect(await screen.findByText('Test Client')).toBeVisible();
  expect(screen.getByText('Tue, Oct 6')).toBeVisible();
  expect(screen.getByText('Natural Fill')).toBeVisible();
  expect(screen.queryByText('New', { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign off daily duplicates' })).not.toBeInTheDocument();
  expect(screen.getByText(/Daily sign-off applies to the Today view/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show duplicate bookings for Today' }));
  expect(screen.getByRole('button', { name: 'Sign off daily duplicates' })).toBeVisible();
});

test('filters groups by selected location while retaining all appointments in a cross-location match', async () => {
  renderView({ location: { squareId: 'other', name: 'Other' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  expect(await screen.findByText('No duplicate bookings found in this 7-day range.')).toBeVisible();
  expect(screen.queryByText('Test Client')).not.toBeInTheDocument();
});

test('first-fetch failure is unavailable, never a no-duplicates claim', async () => {
  api.getWeeklyDuplicateBookings.mockRejectedValue(new Error('Unavailable'));
  renderView();
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Weekly check unavailable');
  expect(screen.queryByText(/No duplicate bookings/)).not.toBeInTheDocument();
});

test('refresh failure preserves the previous result and labels it stale', async () => {
  api.getWeeklyDuplicateBookings.mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error('Unavailable'));
  renderView();
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  await screen.findByText('Test Client');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh weekly duplicate bookings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('previous result; it may be out of date');
  expect(screen.getByText('Test Client')).toBeVisible();
});

test('a late response from the previous date cannot replace the new weekly check', async () => {
  let resolveFirst;
  api.getWeeklyDuplicateBookings.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ ...response('2026-10-02'), groups: [] });
  const { rerender } = renderView();
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  const firstSignal = api.getWeeklyDuplicateBookings.mock.calls[0][1].signal;
  rerender(<TestView date="2026-10-02" dayLabel="Tomorrow" />);
  expect(firstSignal.aborted).toBe(true);
  await screen.findByText('No duplicate bookings found in this 7-day range.');
  await act(async () => resolveFirst(response()));
  expect(screen.queryByText('Test Client')).not.toBeInTheDocument();
});

test('leaving the duplicate panel cancels work and avoids requests while hidden', async () => {
  api.getWeeklyDuplicateBookings.mockImplementation(() => new Promise(() => {}));
  const { rerender } = renderView();
  fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
  const signal = api.getWeeklyDuplicateBookings.mock.calls[0][1].signal;
  rerender(<TestView visible={false} />);
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(api.getWeeklyDuplicateBookings).toHaveBeenCalledTimes(1));
});
