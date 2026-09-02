import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AppointmentNoteHistory from './AppointmentNoteHistory';

const initialAppointments = [
  {
    id: 'past-1',
    appointmentTime: '2026-08-20T18:00:00.000Z',
    serviceName: 'Natural Fill',
    technicianName: 'Technician One',
    locationName: 'Tustin',
    status: 'ACCEPTED',
    customerNote: '',
    sellerNote: '',
  },
  {
    id: 'past-2',
    appointmentTime: '2026-08-01T18:00:00.000Z',
    serviceName: 'Volume Fill',
    technicianName: 'Technician Two',
    locationName: 'Irvine',
    status: 'CANCELLED',
    customerNote: '',
    sellerNote: 'Historic detail',
  },
  ...[3, 4, 5].map((number) => ({
    id: `past-${number}`,
    appointmentTime: `2026-07-0${8 - number}T18:00:00.000Z`,
    serviceName: `Past service ${number}`,
    technicianName: 'Technician',
    locationName: 'Tustin',
    status: 'ACCEPTED',
    customerNote: '',
    sellerNote: '',
  })),
];

test('starts with history collapsed and opens the most recent historical note on request', () => {
  render(
    <AppointmentNoteHistory
      currentCustomerNote=""
      currentSellerNote=""
      initialAppointments={initialAppointments}
      total={7}
      noteCount={2}
      hasMore
      available
    />
  );

  expect(screen.getByRole('region', { name: "Today's appointment notes" })).toBeVisible();
  expect(screen.getByText('No notes for this appointment.')).toBeVisible();
  expect(screen.getByText('7 past appointments · 2 with notes')).toBeVisible();
  expect(screen.getByText('Historic detail')).not.toBeVisible();
  expect(screen.queryByRole('button', { name: 'Show 2 older' })).not.toBeInTheDocument();

  const toggle = screen.getByRole('button', { name: /^Past appointments/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(toggle.getAttribute('aria-controls'))).not.toBeVisible();
  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Historic detail')).toBeVisible();
  expect(screen.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.getAllByText('No appointment note')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'Show 2 older' })).toBeInTheDocument();
});

test('keeps current notes visible and preserves historical selection when the dropdown is toggled', () => {
  const onLoadMore = jest.fn();
  render(
    <AppointmentNoteHistory
      currentCustomerNote="Current customer request"
      currentSellerNote="Current business instruction"
      initialAppointments={initialAppointments}
      total={7}
      noteCount={2}
      hasMore
      onLoadMore={onLoadMore}
    />
  );

  const currentNotes = screen.getByRole('region', { name: "Today's appointment notes" });
  const toggle = screen.getByRole('button', { name: /^Past appointments/ });
  expect(within(currentNotes).getByText('Current customer request')).toBeVisible();
  expect(within(currentNotes).getByText('Current business instruction')).toBeVisible();
  expect(within(currentNotes).queryByText('Historic detail')).not.toBeInTheDocument();

  fireEvent.click(toggle);
  const historicalNote = screen.getByRole('button', { name: /Volume Fill/ });
  fireEvent.click(historicalNote);
  expect(historicalNote).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Historic detail')).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(currentNotes).toBeVisible();
  fireEvent.click(toggle);
  expect(historicalNote).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Historic detail')).not.toBeInTheDocument();
  expect(onLoadMore).not.toHaveBeenCalled();
});

test('each appointment has an independent history dropdown', () => {
  render(
    <>
      <AppointmentNoteHistory initialAppointments={initialAppointments} total={5} noteCount={1} />
      <AppointmentNoteHistory initialAppointments={initialAppointments} total={5} noteCount={1} />
    </>
  );

  const [first, second] = screen.getAllByRole('button', { name: /^Past appointments/ });
  expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));
  fireEvent.click(first);

  expect(first).toHaveAttribute('aria-expanded', 'true');
  expect(second).toHaveAttribute('aria-expanded', 'false');
  const [firstNote, secondNote] = screen.getAllByText('Historic detail');
  expect(firstNote).toBeVisible();
  expect(secondNote).not.toBeVisible();
});

test('loads older appointments in batches and preserves incomplete-coverage disclosure', async () => {
  const onLoadMore = jest.fn().mockResolvedValue({
    appointments: [{
      id: 'past-6',
      appointmentTime: '2026-06-01T18:00:00.000Z',
      serviceName: 'Older Fill',
      technicianName: 'Technician Three',
      locationName: 'Costa Mesa',
      status: 'NO_SHOW',
      customerNote: 'Older customer detail',
      sellerNote: '',
    }],
    total: 6,
    noteCount: 2,
    hasMore: false,
    coveragePending: false,
    coverageUnavailable: true,
  });

  render(
    <AppointmentNoteHistory
      initialAppointments={initialAppointments}
      total={6}
      noteCount={1}
      hasMore
      available
      coveragePending
      onLoadMore={onLoadMore}
    />
  );

  const toggle = screen.getByRole('button', { name: /^Past appointments/ });
  fireEvent.click(toggle);
  expect(screen.getByText('Older archived appointment notes are still being indexed.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show 1 older' }));

  expect(await screen.findByText('Older Fill')).toBeVisible();
  expect(onLoadMore).toHaveBeenCalledWith(5, 5);
  expect(screen.queryByText(/^Show \d+ older$/)).not.toBeInTheDocument();
  expect(screen.getByText('Some older appointments could not be checked for notes.')).toBeVisible();
  expect(screen.queryByText('Older archived appointment notes are still being indexed.')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Older Fill/ }));
  fireEvent.click(toggle);
  expect(screen.getByText('Older customer detail')).not.toBeVisible();
  fireEvent.click(toggle);
  expect(screen.getByText('Older customer detail')).toBeVisible();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

test('keeps current notes visible after a history load failure and allows retrying the same page', async () => {
  const onLoadMore = jest.fn()
    .mockRejectedValueOnce(new Error('Could not load older appointment notes.'))
    .mockResolvedValueOnce({
      appointments: [{ ...initialAppointments[0], id: 'past-6', serviceName: 'Recovered Fill' }],
      total: 6,
      noteCount: 1,
      hasMore: false,
    });
  render(
    <AppointmentNoteHistory
      currentSellerNote="Current appointment instruction"
      initialAppointments={initialAppointments}
      total={6}
      noteCount={1}
      hasMore
      onLoadMore={onLoadMore}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /^Past appointments/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Show 1 older' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load older appointment notes.');
  expect(screen.getByText('Current appointment instruction')).toBeVisible();
  expect(screen.getByText('Historic detail')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Show 1 older' }));
  expect(await screen.findByText('Recovered Fill')).toBeVisible();
  expect(onLoadMore.mock.calls).toEqual([[5, 5], [5, 5]]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([
  [true, '0 past appointments', 'No earlier appointments are available.'],
  [false, 'History temporarily unavailable', 'Past appointment notes are temporarily unavailable.'],
])('describes empty or unavailable history without hiding current notes (available: %s)', (available, summary, message) => {
  render(<AppointmentNoteHistory currentSellerNote="Current instruction" available={available} />);

  expect(screen.getByText(summary)).toBeVisible();
  expect(screen.getByText('Current instruction')).toBeVisible();
  expect(screen.getByText(message)).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Past appointments/ }));
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Show \d+ older$/ })).not.toBeInTheDocument();
});
