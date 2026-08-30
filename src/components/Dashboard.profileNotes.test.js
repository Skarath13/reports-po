import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: {
    getAppointmentNoteHistory: jest.fn(),
  },
}));

jest.mock('../hooks/useReports', () => ({
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
      anyoneAvailable: [],
      totalAppointments: 2,
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
      }],
    },
    loading: false,
    error: null,
    lastUpdated: null,
    refresh: jest.fn(),
  }),
  useAllLocationAppointments: () => ({ data: { appointments: [] } }),
}));

test('includes profile-only notes in the notes section', async () => {
  render(<Dashboard user={{ id: 'ross-id', username: 'Ross' }} onLogout={jest.fn()} />);

  expect(await screen.findByRole('heading', { name: 'Client & Appointment Notes' })).toBeInTheDocument();
  expect(screen.getByText('Client profile')).toBeInTheDocument();
  expect(screen.getByText('Persistent profile preference')).toBeInTheDocument();
  expect(screen.getByText('History Client')).toBeInTheDocument();
  expect(screen.getByText('Historic business detail')).toBeInTheDocument();
});
