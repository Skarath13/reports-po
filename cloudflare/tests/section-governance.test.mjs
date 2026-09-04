import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDuplicateSectionSnapshots,
  buildFullReportSectionSnapshots,
} from '../reports/section-governance.mjs';

const CONTEXT = {
  secret: 'test-governance-fingerprint-secret-1234567890',
  actorId: 'actor-1',
  reportDate: '2026-08-30',
  locationId: 'tustin',
};

function appointment(id, overrides = {}) {
  return {
    id,
    appointmentTime: '2026-08-30T17:00:00.000Z',
    customerName: 'Client',
    customerPhone: '714-555-1212',
    serviceName: 'Lash Fill',
    technicianName: 'Alice',
    daysSinceLastAppointment: 14,
    status: 'ACCEPTED',
    ...overrides,
  };
}

function reportWith(appointments, overrides = {}) {
  return {
    generatedAt: '2026-08-30T17:01:00.000Z',
    technicians: ['Alice'],
    byTechnician: { Alice: appointments },
    rankedByLikelihood: appointments,
    anyoneAvailable: [],
    ...overrides,
  };
}

test('section snapshots ignore report generation time and harmless appointment ordering', async () => {
  const first = appointment('appointment-1');
  const second = appointment('appointment-2', { appointmentTime: '2026-08-30T18:00:00.000Z' });
  const initial = await buildFullReportSectionSnapshots(
    reportWith([first, second]),
    CONTEXT
  );
  const reordered = await buildFullReportSectionSnapshots(
    reportWith([second, first], { generatedAt: '2026-08-30T17:59:00.000Z' }),
    CONTEXT
  );

  assert.equal(initial.calendar.snapshotHash, reordered.calendar.snapshotHash);
  assert.deepEqual(
    initial.calendar.storedEntries,
    reordered.calendar.storedEntries
  );
});

test('visible appointment and note changes produce a new item content version', async () => {
  const initialAppointment = appointment('appointment-1', {
    customerProfileNote: 'Prefers a natural style',
  });
  const changedAppointment = appointment('appointment-1', {
    customerProfileNote: 'Prefers a fuller natural style',
  });
  const initial = await buildFullReportSectionSnapshots(
    reportWith([initialAppointment]),
    CONTEXT
  );
  const changed = await buildFullReportSectionSnapshots(
    reportWith([changedAppointment]),
    CONTEXT
  );

  assert.equal(initial.notes.entries[0].entryKey, changed.notes.entries[0].entryKey);
  assert.notEqual(initial.notes.entries[0].contentVersion, changed.notes.entries[0].contentVersion);
  assert.notEqual(initial.notes.snapshotHash, changed.notes.snapshotHash);
});

test('backend-only appointment metadata does not create a visible update cue', async () => {
  const initialAppointment = appointment('appointment-1', {
    bloomAppointmentId: null,
    serviceVariationId: 'variation-old',
    source: 'square',
    appointmentSource: 'square',
    status: 'ACCEPTED',
  });
  const metadataOnlyChange = appointment('appointment-1', {
    bloomAppointmentId: 'bloom-appointment-1',
    serviceVariationId: 'variation-new',
    source: 'bloom',
    appointmentSource: 'bloom',
    status: 'CONFIRMED',
  });
  const initial = await buildFullReportSectionSnapshots(
    reportWith([initialAppointment]),
    CONTEXT
  );
  const changed = await buildFullReportSectionSnapshots(
    reportWith([metadataOnlyChange]),
    CONTEXT
  );

  assert.equal(initial.calendar.snapshotHash, changed.calendar.snapshotHash);
  assert.deepEqual(initial.calendar.storedEntries, changed.calendar.storedEntries);
});

test('duplicate snapshots use appointment membership and expose no phone-based governance key', async () => {
  const locations = [
    { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW' },
    { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS' },
  ];
  const snapshots = await buildDuplicateSectionSnapshots({
    appointments: [
      appointment('appointment-1', {
        locationId: 'G0X353MBKGTCW',
        locationName: 'Tustin',
      }),
      appointment('appointment-2', {
        locationId: 'LC0CZ4AZ7TKXS',
        locationName: 'Irvine',
      }),
    ],
  }, {
    secret: CONTEXT.secret,
    actorId: CONTEXT.actorId,
    reportDate: CONTEXT.reportDate,
    locations,
  });

  assert.equal(snapshots.tustin.entries.length, 1);
  assert.equal(snapshots.irvine.entries.length, 1);
  assert.deepEqual(snapshots.tustin.entries[0].sourceAppointmentIds, [
    'appointment-1',
    'appointment-2',
  ]);
  assert.doesNotMatch(JSON.stringify(snapshots.tustin.storedEntries), /714|555|1212/);
});
