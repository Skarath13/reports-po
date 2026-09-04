export const REPORT_SECTIONS = Object.freeze([
  { key: 'calendar', label: 'Calendar List View' },
  { key: 'notes', label: 'Client & Appointment Notes' },
  { key: 'potential-fixes', label: 'Potential Fixes' },
  { key: 'duplicates', label: 'Duplicate Clients Today' },
  { key: 'anyone-available', label: 'Clients Booked for Anyone Available' },
  { key: 'staff-first-hour', label: 'Staff Without a First-Hour Appointment' },
]);

export const REPORT_SECTION_KEYS = Object.freeze(
  REPORT_SECTIONS.map((section) => section.key)
);

export const REPORT_SECTION_LABELS = Object.freeze(
  Object.fromEntries(REPORT_SECTIONS.map((section) => [section.key, section.label]))
);
