import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockLocations = [
  { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW', color: '#3498db' },
  { id: 'costa-mesa', name: 'Costa Mesa', squareId: 'LVMKS7ERWS3KP', color: '#9b59b6' },
  { id: 'santa-ana', name: 'Santa Ana', squareId: 'LZMX8CTA69S7E', color: '#e74c3c' },
  { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS', color: '#2ecc71' },
  { id: 'newport-beach', name: 'Newport Beach', squareId: 'LR7WA061BB4KA', color: '#f39c12' },
];

const KATELYN_AUDIT_VIEWER_ID = '9dee6da3-789a-46de-88f2-128385b2a4c0';

const mockApi = {
  getSectionReviews: vi.fn(),
  submitSectionSignoff: vi.fn(),
  acknowledgeSectionEntry: vi.fn(),
  getAudit: vi.fn(),
};

const mockUseFullReport = vi.fn();

vi.mock('../api/client', () => ({
  __esModule: true,
  default: {
    getSectionReviews: (...args) => globalThis.__reportsGovernanceApi.getSectionReviews(...args),
    submitSectionSignoff: (...args) => globalThis.__reportsGovernanceApi.submitSectionSignoff(...args),
    acknowledgeSectionEntry: (...args) => globalThis.__reportsGovernanceApi.acknowledgeSectionEntry(...args),
    getAudit: (...args) => globalThis.__reportsGovernanceApi.getAudit(...args),
  },
}));

vi.mock('../hooks/useReports', () => {
  const locations = [
    { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW', color: '#3498db' },
    { id: 'costa-mesa', name: 'Costa Mesa', squareId: 'LVMKS7ERWS3KP', color: '#9b59b6' },
    { id: 'santa-ana', name: 'Santa Ana', squareId: 'LZMX8CTA69S7E', color: '#e74c3c' },
    { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS', color: '#2ecc71' },
    { id: 'newport-beach', name: 'Newport Beach', squareId: 'LR7WA061BB4KA', color: '#f39c12' },
  ];
  return {
    __esModule: true,
    LOCATIONS: locations,
    useFullReport: (...args) => globalThis.__reportsGovernanceUseFullReport(...args),
    useAllLocationAppointments: () => ({
      data: globalThis.__reportsAllLocationsData,
      loading: false,
      error: null,
      refresh: vi.fn(),
    }),
  };
});

function getPacificDate(offsetDays = 0) {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const SECTION_KEYS = [
  'calendar',
  'notes',
  'potential-fixes',
  'anyone-available',
  'staff-first-hour',
];

function makeSnapshot(sectionKey, entries = [], suffix = 'current') {
  return { sectionKey, snapshotHash: `${sectionKey}-${suffix}`, entries };
}

function makeReport(overrides = {}) {
  return {
    generatedAt: '2026-08-18T18:00:00.000Z',
    technicians: [],
    byTechnician: {},
    rankedByLikelihood: [],
    anyoneAvailable: [],
    totalAppointments: 0,
    _governance: {
      sectionSnapshots: Object.fromEntries(
        SECTION_KEYS.map((sectionKey) => [sectionKey, makeSnapshot(sectionKey)])
      ),
    },
    ...overrides,
  };
}

const auditData = {
  reportDate: getPacificDate(),
  locations: mockLocations.map(({ id, name, squareId }) => ({ id, name, squareId })),
  requiredSigners: [{ actor_id: 'ross-id', display_name: 'Ross', sort_order: 1 }],
  sectionDefinitions: [
    { key: 'calendar', label: 'Calendar List View' },
    { key: 'notes', label: 'Client & Appointment Notes' },
    { key: 'potential-fixes', label: 'Potential Fixes' },
    { key: 'duplicates', label: 'Duplicate Clients Today' },
    { key: 'anyone-available', label: 'Clients Booked for Anyone Available' },
    { key: 'staff-first-hour', label: 'Staff Without a First-Hour Appointment' },
  ],
  sectionSignoffs: [],
  signoffs: [],
  logins: [],
  views: [],
};

function renderDashboard(username = 'Ross', initialInterfaceMode) {
  return render(
    <Dashboard
      user={{ id: `${username.toLowerCase()}-id`, username }}
      onLogout={vi.fn()}
      initialInterfaceMode={initialInterfaceMode}
    />
  );
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 50, bottom: 150, right: 250, width: 200, height: 50 });
  globalThis.__reportsGovernanceApi = mockApi;
  globalThis.__reportsGovernanceUseFullReport = mockUseFullReport;
  localStorage.clear();
  const report = makeReport();
  mockUseFullReport.mockReturnValue({
    data: report,
    loading: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
  });
  globalThis.__reportsAllLocationsData = {
    date: getPacificDate(),
    appointments: [],
    _governance: {
      duplicateSnapshotsByLocation: {
        tustin: makeSnapshot('duplicates'),
      },
    },
  };
  mockApi.getSectionReviews.mockResolvedValue({ reviews: [], acknowledgements: [] });
  mockApi.submitSectionSignoff.mockImplementation(async (request) => ({
    replayed: false,
    review: {
      sectionKey: request.sectionKey,
      snapshotHash: request.snapshotHash,
      signedAtUtc: '2026-08-18T18:30:00.000Z',
      entries: [],
    },
  }));
  mockApi.acknowledgeSectionEntry.mockImplementation(async (request) => ({
    acknowledged: true,
    acknowledgement: {
      sectionKey: request.sectionKey,
      entryKey: request.entryKey,
      contentVersion: request.contentVersion,
      acknowledgedAtUtc: '2026-08-18T18:31:00.000Z',
    },
  }));
  mockApi.getAudit.mockResolvedValue(auditData);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test.each(['old', 'new'])('shows all five locations and six review controls in %s', async (mode) => {
  renderDashboard('Ross', mode);

  for (const location of mockLocations) {
    expect(screen.getByRole('button', { name: location.name })).toBeInTheDocument();
  }

  expect(await screen.findByRole('button', { name: 'Sign off Calendar List View' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^sign off /i })).toHaveLength(6);
  expect(screen.getByText('No client or appointment notes.')).toBeInTheDocument();
  expect(screen.getByText('No duplicate clients found.')).toBeInTheDocument();
});

test.each(['old', 'new'])('signs off one section without changing the others in %s', async (mode) => {
  renderDashboard('Ross', mode);

  const calendarButton = await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.click(calendarButton);

  await waitFor(() => expect(mockApi.submitSectionSignoff).toHaveBeenCalledWith(expect.objectContaining({
    date: getPacificDate(),
    locationId: 'tustin',
    sectionKey: 'calendar',
    snapshotHash: 'calendar-current',
    requestId: expect.any(String),
  })));
  expect(await screen.findByText('Reviewed')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign off Calendar List View' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign off Client & Appointment Notes' })).toBeInTheDocument();
});

test.each(['old', 'new'])('tomorrow remains read-only for every section in %s', async (mode) => {
  renderDashboard('Ross', mode);

  fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
  const calendarButton = await screen.findByRole('button', { name: 'Sign off Calendar List View' });

  await waitFor(() => expect(mockApi.getSectionReviews).toHaveBeenCalledWith(getPacificDate(1), 'tustin'));
  expect(calendarButton).toBeDisabled();
  fireEvent.click(calendarButton);
  expect(mockApi.submitSectionSignoff).not.toHaveBeenCalled();
});

test('shows a changed appointment only after a baseline and persists its dismissal', async () => {
  const appointment = {
    id: 'appointment-1',
    appointmentTime: '2026-08-30T17:00:00.000Z',
    customerName: 'Client',
    serviceName: 'Lash Fill',
    technicianName: 'Alice',
    daysSinceLastAppointment: 14,
  };
  const currentEntry = {
    sourceKey: appointment.id,
    entryKey: 'entry-1',
    contentVersion: 'version-new',
  };
  const changedReport = makeReport({
    technicians: ['Alice'],
    byTechnician: { Alice: [appointment] },
    rankedByLikelihood: [appointment],
    totalAppointments: 1,
  });
  changedReport._governance.sectionSnapshots.calendar = makeSnapshot(
    'calendar',
    [currentEntry],
    'changed'
  );
  mockUseFullReport.mockReturnValue({
    data: changedReport,
    loading: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
  });
  mockApi.getSectionReviews.mockResolvedValue({
    reviews: [{
      sectionKey: 'calendar',
      signedAtUtc: '2026-08-30T17:00:00.000Z',
      entries: [{ entryKey: 'entry-1', contentVersion: 'version-old' }],
    }],
    acknowledgements: [],
  });

  renderDashboard();
  fireEvent.click(screen.getByRole('button', { name: 'Show schedule' }));
  const cue = await screen.findByLabelText('New since your review');
  fireEvent.click(cue.closest('.appointment-row'));

  await waitFor(() => expect(mockApi.acknowledgeSectionEntry).toHaveBeenCalledWith({
    date: getPacificDate(),
    locationId: 'tustin',
    sectionKey: 'calendar',
    snapshotHash: 'calendar-changed',
    entryKey: 'entry-1',
    contentVersion: 'version-new',
  }));
  await waitFor(() => expect(screen.queryByLabelText('New since your review')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Sign off updates to Calendar List View' })).toBeInTheDocument();
});

test('only the configured Katelyn account can open the audit panel', async () => {
  const { rerender } = renderDashboard('Ross');
  expect(screen.queryByRole('button', { name: /audit/i })).not.toBeInTheDocument();

  rerender(
    <Dashboard
      user={{ id: 'not-katelyn-id', username: 'Katelyn' }}
      onLogout={vi.fn()}
    />
  );
  expect(screen.queryByRole('button', { name: /audit/i })).not.toBeInTheDocument();

  rerender(
    <Dashboard
      user={{ id: KATELYN_AUDIT_VIEWER_ID, username: 'Katelyn' }}
      onLogout={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /audit/i }));
  expect(await screen.findByRole('heading', { name: /governance audit/i })).toBeInTheDocument();
  expect(screen.getByText(/private to katelyn/i)).toBeInTheDocument();
  expect(mockApi.getAudit).toHaveBeenCalledWith(getPacificDate());
});
