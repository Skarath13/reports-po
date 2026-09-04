import api from '../api/client';
import ReportNoteContent from './ReportNoteContent';
import AppointmentNoteHistory from './AppointmentNoteHistory';

export default function AppointmentNotes({
  appointment,
  date,
  locationId,
  isToday,
}) {
  return (
    <>
      {appointment.customerProfileNote && (
        <ReportNoteContent profileNote={appointment.customerProfileNote} />
      )}
      <AppointmentNoteHistory
        key={`${date}:${locationId}:${appointment.id}`}
        currentCustomerNote={appointment.customerNote}
        currentSellerNote={appointment.sellerNote}
        isToday={isToday}
        initialAppointments={appointment.appointmentNoteHistory || []}
        total={appointment.appointmentNoteHistoryTotal || 0}
        noteCount={appointment.appointmentNoteHistoryNoteCount || 0}
        hasMore={appointment.appointmentNoteHistoryHasMore}
        coveragePending={appointment.appointmentNoteHistoryCoveragePending}
        coverageUnavailable={
          appointment.appointmentNoteHistoryCoverageUnavailable
        }
        available={appointment.appointmentNoteHistoryAvailable}
        onLoadMore={(offset, limit) =>
          api.getAppointmentNoteHistory(date, locationId, appointment.id, {
            offset,
            limit,
          })
        }
      />
    </>
  );
}
