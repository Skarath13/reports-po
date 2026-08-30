import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

test('shows today separately and opens the most recent historical note in a five-row trail', () => {
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

  expect(screen.getByText("Today's appointment")).toBeInTheDocument();
  expect(screen.getByText('No appointment note today')).toBeInTheDocument();
  expect(screen.getByText('7 past appointments · 2 with notes')).toBeInTheDocument();
  expect(screen.getByText('Historic detail')).toBeInTheDocument();
  expect(screen.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.getAllByText('No appointment note')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'Show 2 older' })).toBeInTheDocument();
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
      onLoadMore={onLoadMore}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Show 1 older' }));

  expect(await screen.findByText('Older Fill')).toBeInTheDocument();
  expect(onLoadMore).toHaveBeenCalledWith(5, 5);
  expect(screen.queryByText(/^Show \d+ older$/)).not.toBeInTheDocument();
  expect(screen.getByText('Some older appointments could not be checked for notes.')).toBeInTheDocument();
});
