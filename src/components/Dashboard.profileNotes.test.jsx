import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

vi.mock('../api/client', () => ({
  __esModule: true,
  default: {
    getSectionReviews: () => Promise.resolve({ reviews: [], acknowledgements: [] }),
    submitSectionSignoff: () => Promise.resolve({}),
    acknowledgeSectionEntry: () => Promise.resolve({ acknowledged: true }),
    getAudit: () => Promise.resolve({}),
  },
}));

vi.mock('../hooks/useReports', () => ({
  __esModule: true,
  LOCATIONS: [{
    id: 'tustin',
    name: 'Tustin',
    squareId: 'G0X353MBKGTCW',
    color: '#3498db',
  }],
  useFullReport: () => ({
    data: {
      generatedAt: '2026-08-30T17:00:00.000Z',
      technicians: [],
      byTechnician: {},
      anyoneAvailable: [{
        id: 'booking-3',
        customerName: 'Current Notes Client',
        serviceName: 'Classic Fill',
        technicianName: 'Technician',
        appointmentTime: '2026-08-30T19:00:00.000Z',
        daysSinceLastAppointment: 14,
      }],
      totalAppointments: 3,
      rankedByLikelihood: [{
        id: 'booking-1',
        customerName: 'Test Client',
        serviceName: 'Classic Fill',
        technicianName: 'Technician',
        appointmentTime: '2026-08-30T17:00:00.000Z',
        daysSinceLastAppointment: 21,
        customerProfileNote: 'Persistent profile preference',
        customerNote: '',
        sellerNote: '',
        appointmentNoteHistory: [],
        appointmentNoteHistoryTotal: 0,
        appointmentNoteHistoryNoteCount: 0,
        appointmentNoteHistoryAvailable: true,
      }, {
        id: 'booking-2',
        customerName: 'History Client',
        serviceName: 'Volume Fill',
        technicianName: 'Technician',
        appointmentTime: '2026-08-30T18:00:00.000Z',
        daysSinceLastAppointment: 30,
        customerProfileNote: '',
        customerNote: '',
        sellerNote: '',
        appointmentNoteHistory: [{
          id: 'booking-past-1',
          customerNote: '',
          sellerNote: 'Historic business detail',
          serviceName: 'Natural Fill',
          technicianName: 'Past Technician',
          appointmentTime: '2026-08-01T17:00:00.000Z',
          status: 'ACCEPTED',
          locationName: 'Tustin',
        }],
        appointmentNoteHistoryTotal: 1,
        appointmentNoteHistoryNoteCount: 1,
        appointmentNoteHistoryAvailable: true,
      }, {
        id: 'booking-3',
        customerName: 'Current Notes Client',
        serviceName: 'Classic Fill',
        technicianName: 'Technician',
        appointmentTime: '2026-08-30T19:00:00.000Z',
        daysSinceLastAppointment: 14,
        customerNote: 'Current appointment request',
        sellerNote: 'Current business detail',
        appointmentNoteHistory: [],
        appointmentNoteHistoryTotal: 0,
        appointmentNoteHistoryNoteCount: 0,
        appointmentNoteHistoryAvailable: true,
      }],
    },
    loading: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
  }),
  useAllLocationAppointments: () => ({
    data: { date: '2026-08-30', appointments: [] },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

test('keeps profile and current notes visible above anyone-available bookings with history collapsed', async () => {
  render(<Dashboard user={{ id: 'ross-id', username: 'Ross' }} onLogout={vi.fn()} initialInterfaceMode="new" />);

  expect(await screen.findByRole('heading', { name: 'Client & Appointment Notes' })).toBeInTheDocument();
  expect(screen.getByText('Client profile')).toBeInTheDocument();
  expect(screen.getByText('Persistent profile preference')).toBeVisible();
  expect(screen.getByText('Current appointment request')).toBeVisible();
  expect(screen.getByText('Current business detail')).toBeVisible();
  expect(screen.getByText('History Client')).toBeInTheDocument();
  expect(screen.getByText('Historic business detail')).not.toBeVisible();

  const notesHeading = screen.getByRole('heading', { name: 'Client & Appointment Notes' });
  const anyoneHeading = screen.getByRole('heading', { name: 'Clients Booked for Anyone Available' });
  expect(notesHeading.compareDocumentPosition(anyoneHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Past appointments\s*1 past appointment/ }));
  expect(screen.getByText('Historic business detail')).toBeVisible();
  expect(screen.getByText('Current appointment request')).toBeVisible();
});

test('Old shows profile and current notes without prior-note controls, counts or content', async () => {
  render(<Dashboard user={{ id: 'ross-id', username: 'Ross' }} onLogout={vi.fn()} initialInterfaceMode="old" />);
  expect(await screen.findByText('Persistent profile preference')).toBeVisible();
  expect(screen.getByText('Current appointment request')).toBeVisible();
  expect(screen.getByText('Current business detail')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Past appointments/ })).not.toBeInTheDocument();
  expect(screen.getByText('1 past appointment · 1 with notes')).not.toBeVisible();
  expect(screen.getByText('Historic business detail')).not.toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'New interface' }));
  fireEvent.click(screen.getByRole('button', { name: /Past appointments\s*1 past appointment/ }));
  expect(screen.getByText('Historic business detail')).toBeVisible();
});

test('uses a date-neutral current-note heading for tomorrow\'s report', async () => {
  render(<Dashboard user={{ id: 'ross-id', username: 'Ross' }} onLogout={vi.fn()} />);
  expect(await screen.findByText('Current appointment request')).toBeVisible();
  expect(screen.getAllByRole('heading', { name: "Today's appointment notes" })).toHaveLength(3);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
  });

  expect(screen.queryByRole('heading', { name: "Today's appointment notes" })).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { name: 'Appointment notes' })).toHaveLength(3);
  expect(screen.getByText('Current appointment request')).toBeVisible();
});
