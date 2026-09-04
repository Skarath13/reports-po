const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const MAX_SECTION_ENTRIES = 500;
const MAX_SECTION_EVENTS = 500;

export const SECTION_DEFINITIONS = Object.freeze([
  { key: 'calendar', label: 'Calendar List View' },
  { key: 'notes', label: 'Client & Appointment Notes' },
  { key: 'potential-fixes', label: 'Potential Fixes' },
  { key: 'duplicates', label: 'Duplicate Clients Today' },
  { key: 'anyone-available', label: 'Clients Booked for Anyone Available' },
  { key: 'staff-first-hour', label: 'Staff Without a First-Hour Appointment' },
]);

export const SECTION_KEYS = new Set(SECTION_DEFINITIONS.map((section) => section.key));

export class SectionGovernanceError extends Error {
  constructor(message, code, status = 400, details = null) {
    super(message);
    this.name = 'SectionGovernanceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function assertDigest(value, label) {
  const digest = String(value || '').trim();
  if (!DIGEST_PATTERN.test(digest)) {
    throw new SectionGovernanceError(`A valid ${label} is required.`, 'INVALID_SECTION_SNAPSHOT');
  }
  return digest;
}

function assertSectionKey(value) {
  const sectionKey = String(value || '').trim();
  if (!SECTION_KEYS.has(sectionKey)) {
    throw new SectionGovernanceError('A valid report section is required.', 'INVALID_SECTION');
  }
  return sectionKey;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`;
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createFingerprinter(secret) {
  const normalizedSecret = String(secret || '').trim();
  if (normalizedSecret.length < 32) {
    throw new SectionGovernanceError(
      'Section review fingerprinting is unavailable.',
      'SECTION_GOVERNANCE_UNAVAILABLE',
      503
    );
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return async (value) => bytesToHex(await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(String(value))
  ));
}

function normalizeSourceKey(value, label = 'entry identity') {
  const sourceKey = String(value || '').trim();
  if (!sourceKey || sourceKey.length > 500) {
    throw new SectionGovernanceError(
      `The report contains an invalid ${label}.`,
      'SECTION_SNAPSHOT_INVALID',
      503
    );
  }
  return sourceKey;
}

function appointmentContent(appointment, {
  includeCalendarDetails = false,
  includeNotes = false,
  includeLocation = false,
} = {}) {
  const content = {
    appointmentTime: appointment?.appointmentTime || null,
    customerName: appointment?.customerName || '',
    daysSinceLastAppointment: appointment?.daysSinceLastAppointment ?? null,
    serviceName: appointment?.serviceName || '',
    technicianName: appointment?.technicianName || '',
  };

  if (includeCalendarDetails) {
    content.futureIssueLikelihood = appointment?.futureIssueLikelihood ?? null;
    content.priceBadge = appointment?.priceBadge || null;
    content.riskScoreComponents = appointment?.riskScoreComponents || null;
    content.riskScoreReason = appointment?.riskScoreReason || null;
  }

  if (includeLocation) {
    content.locationId = appointment?.locationId || null;
    content.locationName = appointment?.locationName || null;
  }

  if (includeNotes) {
    content.customerNote = appointment?.customerNote || '';
    content.customerProfileNote = appointment?.customerProfileNote || '';
    content.sellerNote = appointment?.sellerNote || '';
    content.appointmentNoteHistory = appointment?.appointmentNoteHistory || [];
    content.appointmentNoteHistoryTotal = appointment?.appointmentNoteHistoryTotal || 0;
    content.appointmentNoteHistoryNoteCount = appointment?.appointmentNoteHistoryNoteCount || 0;
    content.appointmentNoteHistoryHasMore = Boolean(appointment?.appointmentNoteHistoryHasMore);
    content.appointmentNoteHistoryCoveragePending = Boolean(
      appointment?.appointmentNoteHistoryCoveragePending
    );
    content.appointmentNoteHistoryCoverageUnavailable = Boolean(
      appointment?.appointmentNoteHistoryCoverageUnavailable
    );
    content.appointmentNoteHistoryAvailable = Boolean(appointment?.appointmentNoteHistoryAvailable);
  }

  return content;
}

function hasAppointmentNotes(appointment) {
  return Boolean(
    appointment?.customerProfileNote ||
    appointment?.customerNote ||
    appointment?.sellerNote ||
    appointment?.appointmentNoteHistoryNoteCount > 0
  );
}

function isPotentialFix(appointment) {
  const days = appointment?.daysSinceLastAppointment;
  const serviceName = String(appointment?.serviceName || '').toLowerCase();
  return days !== null && days !== undefined && days <= 5 && !serviceName.includes('fix');
}

function getPacificHour(value) {
  if (!value) return -1;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return Number(hour);
}

function getCalendarAppointments(report) {
  const appointments = [];
  for (const technician of Array.isArray(report?.technicians) ? report.technicians : []) {
    const technicianAppointments = report?.byTechnician?.[technician];
    if (!Array.isArray(technicianAppointments)) {
      throw new SectionGovernanceError(
        'The calendar report shape is incomplete.',
        'SECTION_SNAPSHOT_INVALID',
        503
      );
    }
    appointments.push(...technicianAppointments);
  }
  return appointments;
}

function getStaffFirstHourEntries(report) {
  const entries = [];
  for (const technician of Array.isArray(report?.technicians) ? report.technicians : []) {
    const appointments = report?.byTechnician?.[technician];
    if (!Array.isArray(appointments) || appointments.length === 0) continue;
    if (appointments.some((appointment) => getPacificHour(appointment?.appointmentTime) === 9)) continue;

    const sortedAppointments = [...appointments].sort((left, right) => (
      new Date(left?.appointmentTime || 0) - new Date(right?.appointmentTime || 0)
    ));
    const firstAppointment = sortedAppointments[0];
    entries.push({
      sourceKey: normalizeSourceKey(technician, 'technician identity'),
      clientReference: { technicianName: String(technician) },
      content: {
        firstAppointmentId: firstAppointment?.id || null,
        firstAppointmentTime: firstAppointment?.appointmentTime || null,
        technicianName: String(technician),
      },
    });
  }
  return entries;
}

function appointmentSourceEntry(appointment, options) {
  const sourceKey = normalizeSourceKey(appointment?.id, 'appointment identity');
  return {
    sourceKey,
    clientReference: { sourceKey },
    content: appointmentContent(appointment, options),
  };
}

async function buildSnapshot(fingerprint, scope, sectionKey, sourceEntries) {
  if (!Array.isArray(sourceEntries) || sourceEntries.length > MAX_SECTION_ENTRIES) {
    throw new SectionGovernanceError(
      'The report section is too large to review safely.',
      'SECTION_SNAPSHOT_TOO_LARGE',
      503
    );
  }

  const entries = await Promise.all(sourceEntries.map(async (sourceEntry) => {
    const sourceKey = normalizeSourceKey(sourceEntry.sourceKey);
    const entryKey = await fingerprint(`entry\0${scope}\0${sectionKey}\0${sourceKey}`);
    const contentVersion = await fingerprint(
      `content\0${scope}\0${sectionKey}\0${sourceKey}\0${stableStringify(sourceEntry.content)}`
    );
    return {
      ...sourceEntry.clientReference,
      entryKey,
      contentVersion,
    };
  }));

  entries.sort((left, right) => left.entryKey.localeCompare(right.entryKey));
  if (new Set(entries.map((entry) => entry.entryKey)).size !== entries.length) {
    throw new SectionGovernanceError(
      'The report contains duplicate section identities.',
      'SECTION_SNAPSHOT_INVALID',
      503
    );
  }

  const storedEntries = entries.map(({ entryKey, contentVersion }) => ({ entryKey, contentVersion }));
  const snapshotHash = await fingerprint(
    `snapshot\0${scope}\0${sectionKey}\0${stableStringify(storedEntries)}`
  );

  return { sectionKey, snapshotHash, entries, storedEntries };
}

export async function buildFullReportSectionSnapshots(report, {
  secret,
  actorId,
  reportDate,
  locationId,
}) {
  const fingerprint = await createFingerprinter(secret);
  const scope = `${actorId}\0${reportDate}\0${locationId}`;
  const calendarAppointments = getCalendarAppointments(report);
  const rankedAppointments = Array.isArray(report?.rankedByLikelihood)
    ? report.rankedByLikelihood
    : [];
  const anyoneAvailable = Array.isArray(report?.anyoneAvailable) ? report.anyoneAvailable : [];

  const definitions = [
    ['calendar', calendarAppointments.map((appointment) => appointmentSourceEntry(
      appointment,
      { includeCalendarDetails: true }
    ))],
    ['notes', rankedAppointments
      .filter(hasAppointmentNotes)
      .map((appointment) => appointmentSourceEntry(appointment, { includeNotes: true }))],
    ['potential-fixes', rankedAppointments
      .filter(isPotentialFix)
      .map((appointment) => appointmentSourceEntry(appointment))],
    ['anyone-available', anyoneAvailable
      .map((appointment) => appointmentSourceEntry(appointment))],
    ['staff-first-hour', getStaffFirstHourEntries(report)],
  ];

  const snapshots = await Promise.all(definitions.map(([sectionKey, entries]) => (
    buildSnapshot(fingerprint, scope, sectionKey, entries)
  )));
  return Object.fromEntries(snapshots.map((snapshot) => [snapshot.sectionKey, snapshot]));
}

function getDuplicateGroups(appointments) {
  const phoneGroups = new Map();
  for (const appointment of appointments) {
    const phone = String(appointment?.customerPhone || '').replace(/\D/g, '');
    if (phone.length < 10) continue;
    const group = phoneGroups.get(phone) || [];
    group.push(appointment);
    phoneGroups.set(phone, group);
  }
  return [...phoneGroups.values()].filter((group) => group.length > 1);
}

export async function buildDuplicateSectionSnapshots(payload, {
  secret,
  actorId,
  reportDate,
  locations,
}) {
  const appointments = Array.isArray(payload?.appointments) ? payload.appointments : null;
  if (!appointments) {
    throw new SectionGovernanceError(
      'The cross-location report shape is incomplete.',
      'SECTION_SNAPSHOT_INVALID',
      503
    );
  }

  const fingerprint = await createFingerprinter(secret);
  const duplicateGroups = getDuplicateGroups(appointments).map((group) => {
    const sortedGroup = [...group].sort((left, right) => (
      String(left?.id || '').localeCompare(String(right?.id || ''))
    ));
    const appointmentIds = sortedGroup.map((appointment) => (
      normalizeSourceKey(appointment?.id, 'appointment identity')
    ));
    return {
      appointments: sortedGroup,
      sourceKey: appointmentIds.join('\u001f'),
      clientReference: { sourceAppointmentIds: appointmentIds },
      content: sortedGroup.map((appointment) => appointmentContent(appointment, { includeLocation: true })),
    };
  });

  const snapshots = await Promise.all(locations.map(async (location) => {
    const locationGroups = duplicateGroups.filter((group) => group.appointments.some((appointment) => (
      appointment?.locationId === location.squareId || appointment?.locationName === location.name
    )));
    const scope = `${actorId}\0${reportDate}\0${location.id}`;
    const snapshot = await buildSnapshot(
      fingerprint,
      scope,
      'duplicates',
      locationGroups
    );
    return [location.id, snapshot];
  }));

  return Object.fromEntries(snapshots);
}

function storedEntriesJson(snapshot) {
  return JSON.stringify(snapshot.storedEntries);
}

export async function persistObservedSnapshots(db, principal, reportDate, snapshotsByLocation, now = new Date()) {
  if (typeof db?.batch !== 'function') {
    throw new Error('D1 batch API unavailable');
  }
  const observedAtUtc = now.toISOString();
  const statements = [];

  for (const [locationId, snapshots] of Object.entries(snapshotsByLocation)) {
    for (const snapshot of Object.values(snapshots)) {
      statements.push(db.prepare(`
        INSERT INTO governance_observed_section_snapshots
          (report_date, location_id, section_key, actor_id, snapshot_hash, entries_json, observed_at_utc)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (report_date, location_id, section_key, actor_id)
        DO UPDATE SET
          snapshot_hash = excluded.snapshot_hash,
          entries_json = excluded.entries_json,
          observed_at_utc = excluded.observed_at_utc
      `).bind(
        reportDate,
        locationId,
        snapshot.sectionKey,
        principal.id,
        snapshot.snapshotHash,
        storedEntriesJson(snapshot),
        observedAtUtc
      ));
    }
  }

  await db.batch(statements);
  return observedAtUtc;
}

export function snapshotsForClient(snapshots, observedAtUtc) {
  return Object.fromEntries(Object.entries(snapshots).map(([sectionKey, snapshot]) => [
    sectionKey,
    {
      sectionKey,
      snapshotHash: snapshot.snapshotHash,
      observedAtUtc,
      entries: snapshot.entries,
    },
  ]));
}

function parseStoredEntries(value) {
  let entries;
  try {
    entries = JSON.parse(value);
  } catch (_error) {
    throw new Error('Stored section snapshot is invalid');
  }
  if (!Array.isArray(entries) || entries.length > MAX_SECTION_ENTRIES) {
    throw new Error('Stored section snapshot is invalid');
  }
  return entries.map((entry) => {
    const entryKey = String(entry?.entryKey || '').trim();
    const contentVersion = String(entry?.contentVersion || '').trim();
    if (!DIGEST_PATTERN.test(entryKey) || !DIGEST_PATTERN.test(contentVersion)) {
      throw new Error('Stored section snapshot is invalid');
    }
    return { entryKey, contentVersion };
  });
}

function serializeReview(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    reportDate: row.report_date,
    locationId: row.location_id,
    sectionKey: row.section_key,
    snapshotHash: row.snapshot_hash,
    itemCount: row.item_count,
    signedAtUtc: row.signed_at_utc,
    entries: parseStoredEntries(row.entries_json),
  };
}

export async function getMySectionState(db, principal, { reportDate, locationId }) {
  const [reviewRows, acknowledgementRows] = await Promise.all([
    db.prepare(`
      SELECT id, request_id, report_date, location_id, section_key, actor_id,
             snapshot_hash, entries_json, item_count, signed_at_utc
      FROM governance_section_signoff_events
      WHERE report_date = ? AND location_id = ? AND actor_id = ?
      ORDER BY signed_at_utc DESC, id DESC
      LIMIT ${MAX_SECTION_EVENTS}
    `).bind(reportDate, locationId, principal.id).all(),
    db.prepare(`
      SELECT section_key, entry_key, content_version, observed_snapshot_hash,
             acknowledged_at_utc
      FROM governance_entry_acknowledgements
      WHERE report_date = ? AND location_id = ? AND actor_id = ?
    `).bind(reportDate, locationId, principal.id).all(),
  ]);

  const latestReviews = new Map();
  for (const row of reviewRows.results || []) {
    if (!latestReviews.has(row.section_key)) {
      latestReviews.set(row.section_key, serializeReview(row));
    }
  }

  return {
    reportDate,
    locationId,
    sectionDefinitions: SECTION_DEFINITIONS,
    reviews: [...latestReviews.values()],
    acknowledgements: (acknowledgementRows.results || []).map((row) => ({
      sectionKey: row.section_key,
      entryKey: row.entry_key,
      contentVersion: row.content_version,
      observedSnapshotHash: row.observed_snapshot_hash,
      acknowledgedAtUtc: row.acknowledged_at_utc,
    })),
  };
}

async function getObservedSnapshot(db, principal, { reportDate, locationId, sectionKey }) {
  const row = await db.prepare(`
    SELECT snapshot_hash, entries_json, observed_at_utc
    FROM governance_observed_section_snapshots
    WHERE report_date = ? AND location_id = ? AND section_key = ? AND actor_id = ?
  `).bind(reportDate, locationId, sectionKey, principal.id).first();
  if (!row) {
    throw new SectionGovernanceError(
      'Refresh this report before reviewing the section.',
      'SECTION_SNAPSHOT_NOT_OBSERVED',
      409
    );
  }
  const storedSnapshotHash = String(row.snapshot_hash || '').trim();
  if (!DIGEST_PATTERN.test(storedSnapshotHash)) {
    throw new Error('Stored section snapshot is invalid');
  }
  return {
    snapshotHash: storedSnapshotHash,
    entriesJson: row.entries_json,
    entries: parseStoredEntries(row.entries_json),
    observedAtUtc: row.observed_at_utc,
  };
}

function assertRequestedSnapshot(observed, requestedSnapshotHash) {
  const requested = assertDigest(requestedSnapshotHash, 'snapshot hash');
  if (observed.snapshotHash !== requested) {
    throw new SectionGovernanceError(
      'This section changed. Refresh it before signing off.',
      'REPORT_CHANGED',
      409,
      { currentSnapshotHash: observed.snapshotHash }
    );
  }
  return requested;
}

async function getSectionSignoffByRequest(db, actorId, requestId) {
  return db.prepare(`
    SELECT id, request_id, report_date, location_id, section_key, actor_id,
           snapshot_hash, entries_json, item_count, signed_at_utc
    FROM governance_section_signoff_events
    WHERE actor_id = ? AND request_id = ?
  `).bind(actorId, requestId).first();
}

function assertMatchingReviewRequest(existing, {
  reportDate,
  locationId,
  sectionKey,
  snapshotHash,
}) {
  if (
    existing.report_date !== reportDate ||
    existing.location_id !== locationId ||
    existing.section_key !== sectionKey ||
    existing.snapshot_hash !== snapshotHash
  ) {
    throw new SectionGovernanceError(
      'This review request ID was already used for another section state.',
      'REVIEW_REQUEST_CONFLICT',
      409
    );
  }
}

export async function recordSectionSignoff(db, principal, {
  reportDate,
  locationId,
  sectionKey: rawSectionKey,
  snapshotHash,
  requestId,
}, now = new Date()) {
  const sectionKey = assertSectionKey(rawSectionKey);
  const observed = await getObservedSnapshot(db, principal, { reportDate, locationId, sectionKey });
  const requestedSnapshotHash = assertRequestedSnapshot(observed, snapshotHash);

  const existing = await getSectionSignoffByRequest(db, principal.id, requestId);
  if (existing) {
    assertMatchingReviewRequest(existing, {
      reportDate,
      locationId,
      sectionKey,
      snapshotHash: requestedSnapshotHash,
    });
    return { review: serializeReview(existing), replayed: true };
  }

  const signedAtUtc = now.toISOString();
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO governance_section_signoff_events
          (request_id, report_date, location_id, section_key, actor_id, username,
           snapshot_hash, entries_json, item_count, signed_at_utc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        requestId,
        reportDate,
        locationId,
        sectionKey,
        principal.id,
        principal.username,
        requestedSnapshotHash,
        observed.entriesJson,
        observed.entries.length,
        signedAtUtc
      ),
      db.prepare(`
        DELETE FROM governance_entry_acknowledgements
        WHERE report_date = ? AND location_id = ? AND section_key = ? AND actor_id = ?
      `).bind(reportDate, locationId, sectionKey, principal.id),
    ]);
  } catch (error) {
    // A retry can race between the initial lookup and the unique insert. D1
    // batches are transactional, so only an independently committed matching
    // event is a safe replay; every other failure remains fail-closed.
    const raced = await getSectionSignoffByRequest(db, principal.id, requestId);
    if (!raced) throw error;
    assertMatchingReviewRequest(raced, {
      reportDate,
      locationId,
      sectionKey,
      snapshotHash: requestedSnapshotHash,
    });
    return { review: serializeReview(raced), replayed: true };
  }

  const recorded = await getSectionSignoffByRequest(db, principal.id, requestId);
  if (!recorded) throw new Error('Section sign-off was not persisted');
  return { review: serializeReview(recorded), replayed: false };
}

export async function acknowledgeSectionEntry(db, principal, {
  reportDate,
  locationId,
  sectionKey: rawSectionKey,
  snapshotHash,
  entryKey: rawEntryKey,
  contentVersion: rawContentVersion,
}, now = new Date()) {
  const sectionKey = assertSectionKey(rawSectionKey);
  const entryKey = assertDigest(rawEntryKey, 'entry key');
  const contentVersion = assertDigest(rawContentVersion, 'content version');
  const observed = await getObservedSnapshot(db, principal, { reportDate, locationId, sectionKey });
  const requestedSnapshotHash = assertRequestedSnapshot(observed, snapshotHash);
  const currentEntry = observed.entries.find((entry) => entry.entryKey === entryKey);
  if (!currentEntry || currentEntry.contentVersion !== contentVersion) {
    throw new SectionGovernanceError(
      'This entry changed. Refresh before marking it seen.',
      'ENTRY_CHANGED',
      409
    );
  }

  const latestReview = await db.prepare(`
    SELECT entries_json
    FROM governance_section_signoff_events
    WHERE report_date = ? AND location_id = ? AND section_key = ? AND actor_id = ?
    ORDER BY signed_at_utc DESC, id DESC
    LIMIT 1
  `).bind(reportDate, locationId, sectionKey, principal.id).first();
  if (!latestReview) {
    throw new SectionGovernanceError(
      'Sign off this section before acknowledging later updates.',
      'SECTION_NOT_REVIEWED',
      409
    );
  }

  const baselineEntry = parseStoredEntries(latestReview.entries_json)
    .find((entry) => entry.entryKey === entryKey);
  if (baselineEntry?.contentVersion === contentVersion) {
    return { acknowledged: false, alreadyInBaseline: true };
  }

  const acknowledgedAtUtc = now.toISOString();
  await db.prepare(`
    INSERT INTO governance_entry_acknowledgements
      (report_date, location_id, section_key, actor_id, entry_key,
       content_version, observed_snapshot_hash, acknowledged_at_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (report_date, location_id, section_key, actor_id, entry_key)
    DO UPDATE SET
      content_version = excluded.content_version,
      observed_snapshot_hash = excluded.observed_snapshot_hash,
      acknowledged_at_utc = excluded.acknowledged_at_utc
  `).bind(
    reportDate,
    locationId,
    sectionKey,
    principal.id,
    entryKey,
    contentVersion,
    requestedSnapshotHash,
    acknowledgedAtUtc
  ).run();

  return {
    acknowledged: true,
    acknowledgement: {
      sectionKey,
      entryKey,
      contentVersion,
      observedSnapshotHash: requestedSnapshotHash,
      acknowledgedAtUtc,
    },
  };
}

export async function getSectionAuditEvents(db, reportDate) {
  const result = await db.prepare(`
    SELECT id, request_id, report_date, location_id, section_key, actor_id,
           username, snapshot_hash, item_count, signed_at_utc
    FROM governance_section_signoff_events
    WHERE report_date = ?
    ORDER BY signed_at_utc DESC, id DESC
    LIMIT ${MAX_SECTION_EVENTS}
  `).bind(reportDate).all();
  return result.results || [];
}

export async function getObservedSectionSnapshotsForAudit(db, reportDate) {
  const result = await db.prepare(`
    SELECT report_date, location_id, section_key, actor_id,
           snapshot_hash, observed_at_utc
    FROM governance_observed_section_snapshots
    WHERE report_date = ?
    ORDER BY observed_at_utc DESC
    LIMIT ${MAX_SECTION_EVENTS}
  `).bind(reportDate).all();
  return result.results || [];
}

export const _private = {
  DIGEST_PATTERN,
  MAX_SECTION_ENTRIES,
  appointmentContent,
  buildSnapshot,
  createFingerprinter,
  getDuplicateGroups,
  hasAppointmentNotes,
  isPotentialFix,
  parseStoredEntries,
  stableStringify,
};
