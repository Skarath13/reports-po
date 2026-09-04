import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import Dashboard from './Dashboard';

const fixture = vi.hoisted(() => ({
  api: {
    getSectionReviews: vi.fn(),
    submitSectionSignoff: vi.fn(),
    acknowledgeSectionEntry: vi.fn(),
    getAppointmentNoteHistory: vi.fn(),
  },
  report: null,
  loading: false,
}));
vi.mock('../api/client', () => ({ default: fixture.api }));
vi.mock('../hooks/useReports', () => ({
  LOCATIONS: [
    { id: 'tustin', name: 'Tustin', squareId: 'tustin-square' },
    { id: 'irvine', name: 'Irvine', squareId: 'irvine-square' },
  ],
  useFullReport: () => ({
    data: fixture.report,
    loading: fixture.loading,
    error: null,
    refresh: vi.fn(),
  }),
  useAllLocationAppointments: (date) => ({
    data: {
      date,
      appointments: [],
      _governance: {
        duplicateSnapshotsByLocation: {
          tustin: { snapshotHash: 'duplicates-v1', entries: [] },
          irvine: { snapshotHash: 'duplicates-v1', entries: [] },
        },
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fixture.loading = false;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const appointments = [
    {
      id: 'b',
      appointmentTime: '2026-09-04T17:00:00Z',
      customerName: 'Zoe Green',
      serviceName: 'Volume Set',
      technicianName: 'Chloe',
      daysSinceLastAppointment: 3,
      priceBadge: { label: '$120', title: 'Booking label' },
    },
    {
      id: 'a',
      appointmentTime: '2026-09-04T16:00:00Z',
      customerName: 'Avery Chen',
      serviceName: 'Natural Fill',
      technicianName: 'Alice',
      daysSinceLastAppointment: 14,
      customerNote: 'Current request',
      customerProfileNote: 'Client preference',
      appointmentNoteHistory: [
        {
          id: 'past',
          appointmentTime: '2026-08-20T16:00:00Z',
          sellerNote: 'Past request',
          status: 'CONFIRMED',
        },
      ],
      appointmentNoteHistoryTotal: 1,
      appointmentNoteHistoryNoteCount: 1,
      appointmentNoteHistoryAvailable: true,
    },
  ];
  fixture.report = {
    totalAppointments: 2,
    technicians: ['Chloe', 'Alice'],
    byTechnician: { Chloe: [appointments[0]], Alice: [appointments[1]] },
    rankedByLikelihood: appointments,
    anyoneAvailable: [],
    _governance: {
      sectionSnapshots: Object.fromEntries(
        [
          'calendar',
          'notes',
          'potential-fixes',
          'anyone-available',
          'staff-first-hour',
        ].map((key) => [
          key,
          {
            snapshotHash: `${key}-v1`,
            entries: appointments.map((appointment) => ({
              sourceKey: appointment.id,
              entryKey: `entry-${appointment.id}`,
              contentVersion: 'new',
            })),
          },
        ]),
      ),
    },
  };
  fixture.api.getSectionReviews.mockResolvedValue({
    reviews: [],
    acknowledgements: [],
  });
  fixture.api.acknowledgeSectionEntry.mockImplementation(async (entry) => ({
    acknowledgement: entry,
  }));
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue() },
  });
});
afterEach(() => vi.restoreAllMocks());

const mount = () =>
  render(
    <Dashboard
      user={{ id: 'viewer', username: 'Viewer' }}
      onLogout={vi.fn()}
    />,
  );
const schedule = () => screen.getByRole('table', { name: 'Appointments' });

test('sorts and filters the schedule without changing the report totals or searching hidden names', async () => {
  mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  expect(
    screen.getByRole('button', { name: 'By technician' }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'List', exact: true }));
  expect(within(schedule()).getByText('Avery Chen')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Hide Names' }));
  expect(within(schedule()).getAllByRole('row')[1]).toHaveTextContent(
    '9:00 AM',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Time', exact: true }));
  expect(within(schedule()).getAllByRole('row')[1]).toHaveTextContent(
    '10:00 AM',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search schedule' }), {
    target: { value: 'Avery' },
  });
  expect(screen.getByText('No matching appointments')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show Names' }));
  expect(
    screen.getByRole('textbox', { name: 'Search schedule' }),
  ).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search schedule' }), {
    target: { value: 'Avery' },
  });
  expect(within(schedule()).getAllByRole('row')).toHaveLength(2);
  expect(within(schedule()).getByText('Avery Chen')).toBeVisible();
  expect(
    screen.getByText('1 of 2 appointments · filtered view'),
  ).toBeVisible();
  expect(screen.getByLabelText('Report summary')).toHaveTextContent(
    'Appointments2',
  );
  expect(window.location.search).toBe('');
});

test('keeps current notes visible in the detail sheet, collapses history, and restores focus', async () => {
  mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  const trigger = screen.getByRole('button', {
    name: 'View 9:00 AM appointment details',
  });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Avery Chen' });
  expect(within(dialog).getByText('Current request')).toBeVisible();
  expect(within(dialog).getByText('Client preference')).toBeVisible();
  expect(within(dialog).getByText('Past request')).not.toBeVisible();
  fireEvent.click(
    within(dialog).getByRole('button', { name: /Past appointments/ }),
  );
  expect(within(dialog).getByText('Past request')).toBeVisible();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
  expect(fixture.api.submitSectionSignoff).not.toHaveBeenCalled();
});

test('acknowledges an updated row when opening details without signing off the section', async () => {
  fixture.api.getSectionReviews.mockResolvedValue({
    reviews: [
      {
        sectionKey: 'calendar',
        signedAtUtc: '2026-09-04T15:00:00Z',
        entries: [
          { entryKey: 'entry-a', contentVersion: 'old' },
          { entryKey: 'entry-b', contentVersion: 'new' },
        ],
      },
    ],
    acknowledgements: [],
  });
  mount();
  await screen.findByLabelText('New since your review');
  fireEvent.click(
    screen.getByRole('button', { name: 'View 9:00 AM appointment details' }),
  );
  await waitFor(() =>
    expect(fixture.api.acknowledgeSectionEntry).toHaveBeenCalledTimes(1),
  );
  expect(fixture.api.acknowledgeSectionEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      sectionKey: 'calendar',
      entryKey: 'entry-a',
      contentVersion: 'new',
    }),
  );
  expect(fixture.api.submitSectionSignoff).not.toHaveBeenCalled();
});

test('navigation keeps each review section separate and location/date changes clear filters', async () => {
  mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.click(screen.getByRole('button', { name: /Client notes\s*1/ }));
  expect(
    screen.getByRole('heading', { name: 'Client & Appointment Notes' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Calendar List View' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Schedule\s*2/ }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Filter by technician' }),
    { target: { value: 'Alice' } },
  );
  expect(
    screen.getByText('1 of 2 appointments · filtered view'),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Irvine', exact: true }),
  );
  expect(
    screen.getByRole('combobox', { name: 'Filter by technician' }),
  ).toHaveValue('all');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search schedule' }), {
    target: { value: 'Natural' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Tomorrow', exact: true }),
  );
  expect(
    screen.getByRole('textbox', { name: 'Search schedule' }),
  ).toHaveValue('');
  expect(
    await screen.findByRole('button', {
      name: 'Sign off Calendar List View',
    }),
  ).toBeDisabled();
});

test('does not show an unavailable review summary as zero completed', async () => {
  fixture.api.getSectionReviews.mockRejectedValue(
    new Error('Review service unavailable'),
  );
  mount();
  await screen.findByText('Review status unavailable');
  const summary = screen
    .getByText('Current section reviews')
    .closest('.metric-card');
  expect(summary).toHaveTextContent('—');
  expect(summary).not.toHaveTextContent('0 / 6');
});

test('mobile navigation moves focus to the selected section heading', async () => {
  mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  const menu = screen.getByRole('dialog', { name: 'Report navigation' });
  fireEvent.click(
    within(menu).getByRole('button', { name: /Client notes\s*1/ }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('heading', { level: 1, name: 'Client notes' }),
  ).toHaveFocus();
});

test('an open detail sheet cannot survive a change of viewer context', async () => {
  const { rerender } = mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.click(
    screen.getByRole('button', { name: 'View 9:00 AM appointment details' }),
  );
  expect(screen.getByRole('dialog')).toBeVisible();
  rerender(
    <Dashboard
      user={{ id: 'another-viewer', username: 'Another' }}
      onLogout={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('copies only the shown technician appointments and reports clipboard failure', async () => {
  mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Filter by technician' }),
    { target: { value: 'Chloe' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'By technician' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Copy shown schedule for Chloe' }),
  );
  await screen.findByRole('button', { name: 'Copied Chloe schedule' });
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    '10:00 AM - Zoe Green - Volume Set (3d) ~ $120',
  );
  navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Copied Chloe schedule' }),
  );
  expect(
    await screen.findByRole('button', {
      name: 'Copy failed for Chloe schedule',
    }),
  ).toBeVisible();
});

test('restores layout, sorting, filters, visibility, section, date and theme only for the same user', async () => {
  const first = mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.click(screen.getByRole('button', { name: 'List', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Hide Names' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hide Prices' }));
  fireEvent.click(screen.getByRole('button', { name: 'Time', exact: true }));
  fireEvent.click(screen.getByRole('switch', { name: 'Light mode' }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Filter by technician' }),
    { target: { value: 'Alice' } },
  );
  fireEvent.click(screen.getByRole('button', { name: /Schedule\s*2/ }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Tomorrow', exact: true }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search schedule' }), {
    target: { value: 'Avery' },
  });
  first.unmount();
  const second = mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  expect(
    screen.getByRole('heading', { level: 1, name: 'Schedule' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Tomorrow', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    screen.getByRole('button', { name: 'List', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Show Names' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Show Prices' })).toBeVisible();
  expect(
    screen.getByRole('combobox', { name: 'Filter by technician' }),
  ).toHaveValue('Alice');
  expect(screen.getByRole('columnheader', { name: 'Time' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(
    screen.getByRole('textbox', { name: 'Search schedule' }),
  ).toHaveValue('');
  expect(document.documentElement.dataset.theme).toBe('light');
  second.rerender(
    <Dashboard
      user={{ id: 'other-id', username: 'Viewer' }}
      onLogout={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  expect(
    screen.getByRole('button', { name: 'By technician' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Hide Names' })).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Today', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement.dataset.theme).toBe('dark');
  second.rerender(
    <Dashboard
      user={{ id: 'viewer', username: 'Renamed' }}
      onLogout={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  expect(screen.getByRole('button', { name: 'Show Names' })).toBeVisible();
  expect(document.documentElement.dataset.theme).toBe('light');
});

test('sidebar update dots persist across a reload and opening a section does not submit a review', async () => {
  const first = mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  expect(
    screen.queryByRole('img', { name: 'Updates in Schedule' }),
  ).not.toBeInTheDocument();
  fixture.report = {
    ...fixture.report,
    _governance: {
      sectionSnapshots: {
        ...fixture.report._governance.sectionSnapshots,
        calendar: { snapshotHash: 'calendar-changed', entries: [] },
      },
    },
  };
  first.rerender(
    <Dashboard
      user={{ id: 'viewer', username: 'Viewer' }}
      onLogout={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole('img', { name: 'Updates in Schedule' }),
  ).toBeVisible();
  first.unmount();
  mount();
  expect(
    await screen.findByRole('img', { name: 'Updates in Schedule' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /1 section updated/ }));
  expect(
    screen.getByRole('heading', { level: 1, name: 'Schedule' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('img', { name: 'Updates in Schedule' }),
  ).not.toBeInTheDocument();
  expect(fixture.api.submitSectionSignoff).not.toHaveBeenCalled();
  expect(fixture.api.acknowledgeSectionEntry).not.toHaveBeenCalled();
});

test('keeps the schedule and draft search in place during refresh while disabling sign-off', async () => {
  const { rerender } = mount();
  await screen.findByRole('button', { name: 'Sign off Calendar List View' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search schedule' }), {
    target: { value: 'Natural' },
  });
  fixture.loading = true;
  rerender(
    <Dashboard
      user={{ id: 'viewer', username: 'Viewer' }}
      onLogout={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('textbox', { name: 'Search schedule' }),
  ).toHaveValue('Natural');
  expect(
    screen.queryByRole('button', { name: 'Sign off Calendar List View' }),
  ).not.toBeInTheDocument();
  fixture.loading = false;
  rerender(
    <Dashboard
      user={{ id: 'viewer', username: 'Viewer' }}
      onLogout={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole('button', {
      name: 'Sign off Calendar List View',
    }),
  ).toBeEnabled();
  expect(
    screen.getByRole('textbox', { name: 'Search schedule' }),
  ).toHaveValue('Natural');
});
