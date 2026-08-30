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
  getMySignoff: jest.fn(),
  submitSignoff: jest.fn(),
  getAudit: jest.fn(),
};

const mockUseFullReport = jest.fn();

jest.mock('../api/client', () => ({
  __esModule: true,
  default: {
    getMySignoff: (...args) => globalThis.__reportsGovernanceApi.getMySignoff(...args),
    submitSignoff: (...args) => globalThis.__reportsGovernanceApi.submitSignoff(...args),
    getAudit: (...args) => globalThis.__reportsGovernanceApi.getAudit(...args),
  },
}));

jest.mock('../hooks/useReports', () => {
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
    useAllLocationAppointments: () => ({ data: { appointments: [] } }),
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

const report = {
  generatedAt: '2026-08-18T18:00:00.000Z',
  technicians: [],
  byTechnician: {},
  rankedByLikelihood: [],
  anyoneAvailable: [],
  totalAppointments: 0,
};

const auditData = {
  reportDate: getPacificDate(),
  locations: mockLocations.map(({ id, name, squareId }) => ({ id, name, squareId })),
  requiredSigners: [{ actor_id: 'ross-id', display_name: 'Ross', sort_order: 1 }],
  signoffs: [],
  logins: [],
  views: [],
};

function renderDashboard(username = 'Ross') {
  return render(
    <Dashboard
      user={{ id: `${username.toLowerCase()}-id`, username }}
      onLogout={jest.fn()}
    />
  );
}

beforeEach(() => {
  globalThis.__reportsGovernanceApi = mockApi;
  globalThis.__reportsGovernanceUseFullReport = mockUseFullReport;
  localStorage.clear();
  mockUseFullReport.mockReturnValue({
    data: report,
    loading: false,
    error: null,
    lastUpdated: null,
    refresh: jest.fn(),
  });
  mockApi.getMySignoff.mockResolvedValue({ signedOff: false, signedAtUtc: null });
  mockApi.submitSignoff.mockResolvedValue({
    signedOff: true,
    signedAtUtc: '2026-08-18T18:30:00.000Z',
  });
  mockApi.getAudit.mockResolvedValue(auditData);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('shows all five locations and the current user checklist', async () => {
  renderDashboard();

  for (const location of mockLocations) {
    expect(screen.getByRole('button', { name: location.name })).toBeInTheDocument();
  }

  expect(await screen.findByText('Not yet reviewed')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /mark tustin report reviewed/i })).toBeInTheDocument();
});

test('persists an immutable sign-off for the selected location', async () => {
  renderDashboard();

  const checkbox = await screen.findByRole('checkbox', { name: /mark tustin report reviewed/i });
  fireEvent.click(checkbox);

  await waitFor(() => expect(mockApi.submitSignoff).toHaveBeenCalledWith(getPacificDate(), 'tustin'));
  expect(await screen.findByText('You marked this report reviewed.')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /mark tustin report reviewed/i })).toBeDisabled();
});

test('tomorrow remains read-only and cannot be signed off', async () => {
  renderDashboard();

  fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
  const checkbox = await screen.findByRole('checkbox', { name: /mark tustin report reviewed/i });

  await waitFor(() => expect(mockApi.getMySignoff).toHaveBeenCalledWith(getPacificDate(1), 'tustin'));
  expect(checkbox).toBeDisabled();
  fireEvent.click(checkbox);
  expect(mockApi.submitSignoff).not.toHaveBeenCalled();
});

test('only the configured Katelyn account can open the audit panel', async () => {
  const { rerender } = renderDashboard('Ross');
  expect(screen.queryByRole('button', { name: /audit/i })).not.toBeInTheDocument();

  rerender(
    <Dashboard
      user={{ id: 'not-katelyn-id', username: 'Katelyn' }}
      onLogout={jest.fn()}
    />
  );
  expect(screen.queryByRole('button', { name: /audit/i })).not.toBeInTheDocument();

  rerender(
    <Dashboard
      user={{ id: KATELYN_AUDIT_VIEWER_ID, username: 'Katelyn' }}
      onLogout={jest.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /audit/i }));
  expect(await screen.findByRole('heading', { name: /governance audit/i })).toBeInTheDocument();
  expect(screen.getByText(/private to katelyn/i)).toBeInTheDocument();
  expect(mockApi.getAudit).toHaveBeenCalledWith(getPacificDate());
});
