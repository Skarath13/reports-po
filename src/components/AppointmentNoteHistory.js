import React, { useId, useMemo, useState } from 'react';
import ReportNoteContent from './ReportNoteContent';

const PAGE_SIZE = 5;

function hasAppointmentNote(appointment) {
  return Boolean(
    appointment?.customerNote?.trim() || appointment?.sellerNote?.trim()
  );
}

function formatAppointmentDate(appointmentTime) {
  const date = new Date(appointmentTime);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  });
  return `${datePart} · ${timePart}`;
}

function formatStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  const labels = {
    ACCEPTED: 'Accepted',
    CONFIRMED: 'Confirmed',
    PENDING: 'Pending',
    CANCELLED: 'Cancelled',
    CANCELED: 'Cancelled',
    CANCELLED_BY_CUSTOMER: 'Cancelled by client',
    CANCELED_BY_CUSTOMER: 'Cancelled by client',
    CANCELLED_BY_SELLER: 'Cancelled by salon',
    CANCELED_BY_SELLER: 'Cancelled by salon',
    NO_SHOW: 'No-show',
    NOSHOW: 'No-show',
  };
  return labels[normalized] || (normalized ? normalized.replaceAll('_', ' ') : 'Status unavailable');
}

function getStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('no_show') || normalized.includes('noshow')) return 'no-show';
  return 'active';
}

function mergeHistory(existing, incoming) {
  const byId = new Map();
  [...existing, ...incoming].forEach((appointment) => {
    if (appointment?.id) byId.set(appointment.id, appointment);
  });
  return [...byId.values()].sort(
    (left, right) => new Date(right.appointmentTime) - new Date(left.appointmentTime)
  );
}

function HistoryRow({ appointment, selected, onSelect }) {
  const hasNote = hasAppointmentNote(appointment);
  const RowElement = hasNote ? 'button' : 'div';
  const noteTypes = [
    appointment.customerNote?.trim() ? 'Customer' : null,
    appointment.sellerNote?.trim() ? 'Business' : null,
  ].filter(Boolean);

  return (
    <div className={`note-trail-item ${hasNote ? 'has-note' : 'no-note'} ${selected ? 'selected' : ''}`}>
      <span className="note-trail-dot" aria-hidden="true" />
      <RowElement
        className="note-trail-row"
        type={hasNote ? 'button' : undefined}
        onClick={hasNote ? onSelect : undefined}
        aria-expanded={hasNote ? selected : undefined}
      >
        <div className="note-trail-row-top">
          <time dateTime={appointment.appointmentTime}>
            {formatAppointmentDate(appointment.appointmentTime)}
          </time>
          <span className={`note-trail-status ${getStatusClass(appointment.status)}`}>
            {formatStatus(appointment.status)}
          </span>
        </div>
        <div className="note-trail-service">{appointment.serviceName || 'Service unavailable'}</div>
        <div className="note-trail-meta">
          <span>{appointment.technicianName || 'Technician unavailable'}</span>
          {appointment.locationName && <span>{appointment.locationName}</span>}
        </div>
        <div className="note-trail-indicators">
          {noteTypes.length > 0 ? noteTypes.map((noteType) => (
            <span key={noteType} className={`note-type-indicator ${noteType.toLowerCase()}`}>
              {noteType} note
            </span>
          )) : <span className="note-trail-empty">No appointment note</span>}
        </div>
      </RowElement>

      {selected && hasNote && (
        <div className="note-trail-detail">
          <ReportNoteContent
            customerNote={appointment.customerNote}
            sellerNote={appointment.sellerNote}
          />
        </div>
      )}
    </div>
  );
}

export default function AppointmentNoteHistory({
  currentCustomerNote,
  currentSellerNote,
  initialAppointments = [],
  total = 0,
  noteCount = 0,
  hasMore = false,
  coveragePending = false,
  coverageUnavailable = false,
  available = true,
  onLoadMore,
}) {
  const initialSelection = useMemo(
    () => initialAppointments.find(hasAppointmentNote)?.id || null,
    [initialAppointments]
  );
  const [appointments, setAppointments] = useState(initialAppointments);
  const [historyTotal, setHistoryTotal] = useState(total);
  const [historyNoteCount, setHistoryNoteCount] = useState(noteCount);
  const [moreAvailable, setMoreAvailable] = useState(hasMore);
  const [pendingCoverage, setPendingCoverage] = useState(coveragePending);
  const [unavailableCoverage, setUnavailableCoverage] = useState(coverageUnavailable);
  const [selectedId, setSelectedId] = useState(initialSelection);
  const [nextOffset, setNextOffset] = useState(initialAppointments.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const currentTitleId = useId();
  const trailTitleId = useId();
  const hasCurrentNote = Boolean(currentCustomerNote?.trim() || currentSellerNote?.trim());
  const remaining = Math.max(historyTotal - nextOffset, 0);

  const loadMore = async () => {
    if (!onLoadMore || loadingMore || !moreAvailable) return;
    setLoadingMore(true);
    setLoadError('');

    try {
      const page = await onLoadMore(nextOffset, PAGE_SIZE);
      const newAppointments = page.appointments || [];
      setAppointments((current) => mergeHistory(current, newAppointments));
      setHistoryTotal(Number(page.total || 0));
      setHistoryNoteCount(Number(page.noteCount || 0));
      setMoreAvailable(Boolean(page.hasMore));
      setPendingCoverage(Boolean(page.coveragePending));
      setUnavailableCoverage(Boolean(page.coverageUnavailable));
      setNextOffset((current) => current + newAppointments.length);
      if (!selectedId) {
        setSelectedId(newAppointments.find(hasAppointmentNote)?.id || null);
      }
    } catch (error) {
      setLoadError(error.message || 'Could not load older appointment notes.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="appointment-note-history">
      <section className="current-appointment-note" aria-labelledby={currentTitleId}>
        <h3 id={currentTitleId}>Today&apos;s appointment</h3>
        {hasCurrentNote ? (
          <ReportNoteContent
            customerNote={currentCustomerNote}
            sellerNote={currentSellerNote}
          />
        ) : (
          <p className="current-note-empty">No appointment note today</p>
        )}
      </section>

      <section className="note-trail" aria-labelledby={trailTitleId}>
        <div className="note-trail-heading">
          <div>
            <h3 id={trailTitleId}>Appointment note trail</h3>
            <p>
              {historyTotal} past {historyTotal === 1 ? 'appointment' : 'appointments'}
              {historyNoteCount > 0 && ` · ${historyNoteCount} with notes`}
            </p>
          </div>
        </div>

        {!available ? (
          <p className="note-history-message">Past appointment notes are temporarily unavailable.</p>
        ) : appointments.length === 0 ? (
          <p className="note-history-message">No earlier appointments are available.</p>
        ) : (
          <div className="note-trail-list">
            {appointments.map((appointment) => (
              <HistoryRow
                key={appointment.id}
                appointment={appointment}
                selected={selectedId === appointment.id}
                onSelect={() => setSelectedId(
                  selectedId === appointment.id ? null : appointment.id
                )}
              />
            ))}
          </div>
        )}

        {moreAvailable && available && (
          <button
            type="button"
            className="note-history-more"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? 'Loading older appointments…'
              : `Show ${Math.min(PAGE_SIZE, remaining || PAGE_SIZE)} older`}
          </button>
        )}
        {loadError && <p className="note-history-error" role="alert">{loadError}</p>}
        {pendingCoverage && (
          <p className="note-history-coverage">Older archived appointment notes are still being indexed.</p>
        )}
        {unavailableCoverage && (
          <p className="note-history-coverage">Some older appointments could not be checked for notes.</p>
        )}
      </section>
    </div>
  );
}

export {
  formatAppointmentDate,
  formatStatus,
  hasAppointmentNote,
};
