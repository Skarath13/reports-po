// Local visual QA only. This HTML entry is not part of the production build.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '../src/components/Dashboard';
import Login from '../src/components/Login';
import { WorkspaceLoading } from '../src/components/LoadingState';
import api from '../src/api/client';
import { LOCATIONS } from '../src/hooks/useReports';
import { REPORT_SECTION_KEYS } from '../src/constants/reportSections';
import '../src/index.css';
import '../src/App.css';

if (!import.meta.env.DEV)
  throw new Error('Synthetic preview is only available in development.');
// Fail closed if a new component calls an API method not explicitly stubbed below.
api.request = async () => {
  throw new Error('Network requests are disabled in the synthetic preview.');
};
const scenario =
  new URLSearchParams(window.location.search).get('scenario') || 'healthy';
const qaViewer =
  new URLSearchParams(window.location.search).get('viewer') === 'qa';
const pause = () =>
  new Promise((resolve) =>
    setTimeout(resolve, ['loading', 'login-slow'].includes(scenario) ? 15000 : 200),
  );
const entries = (appointments) =>
  appointments.map((appointment) => ({
    sourceKey: appointment.id,
    entryKey: `entry-${appointment.id}`,
    contentVersion: 'fixture-v1',
  }));
const snapshot = (key, appointments = []) => ({
  sectionKey: key,
  snapshotHash: `fixture-${key}`,
  entries: entries(appointments),
});
const reports = new Map();
const reviews = new Map();
let previewChanged = false;

function makeReport(date, locationId) {
  const location =
    LOCATIONS.find((item) => item.squareId === locationId) || LOCATIONS[0];
  const names = [
    'Avery Chen',
    'Sofia Martinez',
    'Emma Wilson',
    'Isabella Nguyen',
    'Olivia Brown',
    'Mia Thompson',
    'Charlotte Lee',
    'Amelia Davis',
    'Harper Garcia',
    'Evelyn Robinson',
    'Ella Kim',
    'Elizabeth Alexandra Montgomery-Sutherland',
  ];
  const services = [
    'Lash Fill (Natural) 🌿',
    'Elegant Volume Set ✨(Most Popular)✨',
    'Lash Fill (Mega Volume) 💎',
    'Lash Lift + Tint',
    'Natural Set 🌿',
    'One Week Touch-Up/Fill 💕',
  ];
  const technicians =
    scenario === 'empty' ? [] : ['Alice', 'Chloe', 'Sophie', 'Katie'];
  const appointments = technicians.flatMap((technician, techIndex) =>
    Array.from({ length: 3 }, (_, index) => {
      const i = techIndex * 3 + index;
      const time = `${String(9 + index * 2 + (techIndex === 3 ? 1 : 0)).padStart(2, '0')}:${techIndex % 2 ? '30' : '00'}`;
      return {
        id: `fixture-${location.id}-${i}`,
        appointmentTime: new Date(`${date}T${time}:00-07:00`).toISOString(),
        customerName: names[i],
        customerPhone: `714555${String(1000 + i).slice(-4)}`,
        serviceName:
          i === 11
            ? 'Full Set of Lash Extensions (Consultation Recommended) — a very long booking description with removal, consultation and a custom style request'
            : services[i % services.length],
        technicianName: technician,
        daysSinceLastAppointment: [
          14,
          null,
          3,
          21,
          12,
          28,
          4,
          38,
          16,
          14,
          null,
          60,
        ][i],
        priceBadge: {
          label:
            [80, 125, 95, 85, 110, 55][i % 6] === 55
              ? '$55–$75'
              : `$${[80, 125, 95, 85, 110, 55][i % 6]}`,
          title: 'Synthetic booking price label',
        },
        customerProfileNote:
          i === 0
            ? 'Prefers a soft cat-eye shape. Keep the inner corners light.'
            : '',
        customerNote:
          i === 0
            ? 'Please keep the same length as last time. I loved the natural finish.'
            : i === 4
              ? 'This is a synthetic long-note wrapping test. '.repeat(14) +
                'Preferred appointment style: very-light-natural-finish-with-an-unbroken-reference-that-must-wrap-within-the-panel.'
              : '',
        sellerNote:
          i === 0
            ? 'Check retention on the outer corners before starting.'
            : i === 7
              ? 'Discuss the new shape during the consultation.'
              : '',
        appointmentNoteHistory:
          i === 0 || i === 9
            ? [
                {
                  id: `past-${i}`,
                  appointmentTime: '2026-08-20T18:00:00Z',
                  serviceName: 'Natural Fill',
                  technicianName: technician,
                  locationName: location.name,
                  status: 'CONFIRMED',
                  sellerNote:
                    'Synthetic history: adjusted the outer corner and confirmed the preferred length.',
                },
              ]
            : [],
        appointmentNoteHistoryTotal: i === 0 || i === 9 ? 1 : 0,
        appointmentNoteHistoryNoteCount: i === 0 || i === 9 ? 1 : 0,
        appointmentNoteHistoryHasMore: false,
        appointmentNoteHistoryAvailable: true,
        futureIssueLikelihood: i === 0 ? 25 : 0,
        riskScoreComponents: i === 0 ? {
          historicalRate: 20,
          recencyBoost: 15,
          frequencyBonus: -10,
        } : null,
        locationId: location.squareId,
        locationName: location.name,
      };
    }),
  );
  const notes = appointments.filter(
    (appointment) =>
      appointment.customerProfileNote ||
      appointment.customerNote ||
      appointment.sellerNote ||
      appointment.appointmentNoteHistoryNoteCount,
  );
  const fixes = appointments.filter(
    (appointment) =>
      appointment.daysSinceLastAppointment != null &&
      appointment.daysSinceLastAppointment <= 5,
  );
  const anyone = appointments.slice(6, 8);
  return {
    date,
    generatedAt: new Date().toISOString(),
    totalAppointments: appointments.length,
    technicians,
    byTechnician: Object.fromEntries(
      technicians.map((technician) => [
        technician,
        appointments.filter(
          (appointment) => appointment.technicianName === technician,
        ),
      ]),
    ),
    rankedByLikelihood: appointments,
    anyoneAvailable: anyone,
    _governance: {
      sectionSnapshots: {
        calendar: snapshot('calendar', appointments),
        notes: snapshot('notes', notes),
        'potential-fixes': snapshot('potential-fixes', fixes),
        'anyone-available': snapshot('anyone-available', anyone),
        'staff-first-hour': {
          ...snapshot('staff-first-hour'),
          entries: technicians.length
            ? [
                {
                  technicianName: 'Katie',
                  entryKey: 'staff-Katie',
                  contentVersion: 'fixture-v1',
                },
              ]
            : [],
        },
      },
    },
  };
}

api.getFullReport = async (date, locationId) => {
  await pause();
  if (scenario === 'error')
    throw new Error('Synthetic report request failed.');
  const report = makeReport(date, locationId);
  if (scenario === 'updates' && previewChanged) {
    for (const index of [0, 7, 11]) {
      const appointment = report.rankedByLikelihood[index];
      if (!appointment) continue;
      appointment.serviceName = 'Natural Set with a style consultation';
      if (index !== 11) appointment.customerNote =
        'Updated request after refresh: please allow time for a style consultation.';
      for (const section of ['calendar', 'notes']) {
        const snapshot = report._governance.sectionSnapshots[section];
        snapshot.snapshotHash = `fixture-${section}-updated`;
        const entry = snapshot.entries.find((item) => item.sourceKey === appointment.id);
        if (entry) entry.contentVersion = 'fixture-v2';
      }
    }
  }
  reports.set(`${date}:${locationId}`, report);
  return report;
};
api.getAllLocationAppointments = async (date) => {
  await pause();
  if (scenario === 'duplicates-error')
    throw new Error('Synthetic all-location request failed.');
  const a = makeReport(date, LOCATIONS[0].squareId).rankedByLikelihood[0];
  const b = a && {
    ...a,
    id: 'fixture-cross-location',
    locationId: LOCATIONS[1].squareId,
    locationName: LOCATIONS[1].name,
  };
  const duplicates = {
    ...snapshot('duplicates'),
    entries: a
      ? [
          {
            entryKey: 'duplicate-group',
            sourceAppointmentIds: [a.id, b.id].sort(),
            contentVersion: 'fixture-v1',
          },
        ]
      : [],
  };
  return {
    date,
    appointments: a ? [a, b] : [],
    _governance: {
      duplicateSnapshotsByLocation: Object.fromEntries(
        LOCATIONS.map((location) => [location.id, duplicates]),
      ),
    },
  };
};
api.getSectionReviews = async (date, locationId) => {
  await pause();
  if (scenario === 'review-error')
    throw new Error('Synthetic review status failed.');
  return {
    reviews: reviews.get(`${date}:${locationId}`) || [],
    acknowledgements: [],
  };
};
api.submitSectionSignoff = async ({
  date,
  locationId,
  sectionKey,
  snapshotHash,
}) => {
  const squareId = LOCATIONS.find(
    (location) => location.id === locationId,
  )?.squareId;
  const report = reports.get(`${date}:${squareId}`);
  const review = {
    sectionKey,
    snapshotHash,
    signedAtUtc: new Date().toISOString(),
    entries: report?._governance.sectionSnapshots[sectionKey]?.entries || [],
  };
  const key = `${date}:${locationId}`;
  reviews.set(key, [
    ...(reviews.get(key) || []).filter(
      (item) => item.sectionKey !== sectionKey,
    ),
    review,
  ]);
  return { review };
};
api.acknowledgeSectionEntry = async (entry) => ({
  acknowledgement: { ...entry, acknowledgedAtUtc: new Date().toISOString() },
});
api.getAppointmentNoteHistory = async () => ({
  appointments: [],
  total: 1,
  hasMore: false,
});
api.getAudit = async (date) => ({
  reportDate: date,
  locations: LOCATIONS,
  requiredSigners: [
    { actor_id: 'preview-user', display_name: 'Preview manager' },
  ],
  sectionDefinitions: REPORT_SECTION_KEYS.map((key) => ({ key, label: key })),
  sectionSignoffs: [],
  signoffs: [],
  logins: [],
  views: [],
  observedSectionSnapshots: [],
});

function Preview() {
  const [loggedIn, setLoggedIn] = useState(!['login', 'login-error', 'login-slow'].includes(scenario));
  const [updateQueued, setUpdateQueued] = useState(false);
  return (
    <>
      {scenario === 'startup' ? <WorkspaceLoading /> : loggedIn ? (
        <Dashboard
          user={{
            id:
              scenario === 'audit'
                ? '9dee6da3-789a-46de-88f2-128385b2a4c0'
                : qaViewer
                  ? 'preview-qa'
                  : 'preview-user',
            username: qaViewer ? 'Preview QA' : 'Preview',
          }}
          onLogout={() => setLoggedIn(false)}
        />
      ) : (
        <Login onLogin={async () => {
          await new Promise(resolve => setTimeout(resolve, scenario === 'login-slow' ? 10000 : 1200));
          if (scenario === 'login-error') throw new Error('That PIN wasn’t recognized. Please try again.');
          setLoggedIn(true);
        }} />
      )}
      <div
        style={{
          position: 'fixed',
          bottom: 5,
          right: 8,
          zIndex: 70,
          border: '1px solid #53475f',
          background: '#241d2b',
          color: '#d2b8f3',
          padding: '3px 7px',
          borderRadius: 4,
          fontSize: 9,
          pointerEvents: 'none',
        }}
      >
        LOCAL PREVIEW · SYNTHETIC DATA
        {scenario === 'updates' && (
          <button
            style={{
              pointerEvents: 'auto',
              marginLeft: 10,
              textDecoration: 'underline',
            }}
            onClick={() => {
              previewChanged = true;
              setUpdateQueued(true);
            }}
            disabled={updateQueued}
          >
            {updateQueued
              ? 'Sample update queued · press Refresh'
              : 'Queue sample update'}
          </button>
        )}
      </div>
    </>
  );
}

let root;
if (import.meta.hot) {
  // Reuse the root across overlapping dependency updates in the preview entry.
  root = import.meta.hot.data.root || createRoot(document.getElementById('root'));
  import.meta.hot.data.root = root;
  import.meta.hot.prune(() => root.unmount());
} else {
  root = createRoot(document.getElementById('root'));
}

root.render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
);
