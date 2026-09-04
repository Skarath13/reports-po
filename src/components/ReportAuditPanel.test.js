import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportAuditPanel from './ReportAuditPanel';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { getAudit: jest.fn() },
}));

test('counts only section sign-offs that match the latest observed snapshot', async () => {
  api.getAudit.mockResolvedValue({
    reportDate: '2026-08-30',
    locations: [{ id: 'tustin', name: 'Tustin' }],
    requiredSigners: [{ actor_id: 'ross-id', display_name: 'Ross' }],
    sectionDefinitions: [
      { key: 'calendar', label: 'Calendar List View' },
      { key: 'notes', label: 'Client & Appointment Notes' },
    ],
    sectionSignoffs: [
      {
        id: 2,
        actor_id: 'ross-id',
        username: 'Ross',
        location_id: 'tustin',
        section_key: 'calendar',
        snapshot_hash: 'calendar-current',
        signed_at_utc: '2026-08-30T18:00:02.000Z',
      },
      {
        id: 1,
        actor_id: 'ross-id',
        username: 'Ross',
        location_id: 'tustin',
        section_key: 'notes',
        snapshot_hash: 'notes-old',
        signed_at_utc: '2026-08-30T18:00:01.000Z',
      },
    ],
    observedSectionSnapshots: [
      {
        actor_id: 'ross-id',
        location_id: 'tustin',
        section_key: 'calendar',
        snapshot_hash: 'calendar-current',
      },
      {
        actor_id: 'ross-id',
        location_id: 'tustin',
        section_key: 'notes',
        snapshot_hash: 'notes-new',
      },
    ],
    signoffs: [],
    logins: [],
    views: [],
  });

  render(
    <ReportAuditPanel
      initialDate="2026-08-30"
      onClose={jest.fn()}
      formatDateTime={(value) => value}
    />
  );

  const summary = await screen.findByLabelText('Required sign-off summary');
  expect(within(summary).getByText('1/2')).toBeInTheDocument();
  expect(screen.getByText('Updated · review again')).toBeInTheDocument();
  expect(screen.getByText(/Current · 2026-08-30T18:00:02/)).toBeInTheDocument();
  expect(screen.getByText(/Superseded · 2026-08-30T18:00:01/)).toBeInTheDocument();
});
