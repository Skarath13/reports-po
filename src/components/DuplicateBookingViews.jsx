import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useWeeklyDuplicateBookings } from '../hooks/useWeeklyDuplicateBookings';
import { Button } from './ui/button';
import { ReportCard } from './ReportCard';
import { SectionEmptyState } from './ReviewableSectionHeader';

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit',
});
const rangeDay = (date) => dayFormatter.format(new Date(`${date}T12:00:00Z`));

export default function DuplicateBookingViews({ date, location, dayLabel, visible, weekly, onRangeChange, children }) {
  const { data, loading, error, refresh } = useWeeklyDuplicateBookings(date, weekly && visible);
  const groups = (data?.groups || []).filter((group) => group.appointments.some((appointment) =>
    appointment.locationId === location?.squareId));
  return (
    <>
      <div className="duplicate-range-controls" role="group" aria-label="Duplicate booking date range">
        <Button variant={!weekly ? 'secondary' : 'outline'} type="button" aria-label={`Show duplicate bookings for ${dayLabel}`} aria-pressed={!weekly} onClick={() => onRangeChange(false)}>
          {dayLabel}
        </Button>
        <Button variant={weekly ? 'secondary' : 'outline'} type="button" aria-pressed={weekly} onClick={() => onRangeChange(true)}>
          Next 7 days
        </Button>
      </div>
      <div hidden={weekly}>{children}</div>
      {weekly && (
        <div className="weekly-duplicate-check" aria-busy={loading}>
          <div className="section-header">
            <div className="section-heading">
              <h2 className="section-title">
                <AlertTriangle size={20} className="section-icon" /> Duplicate Bookings · Next 7 Days
                {data && <span className="section-item-count" aria-label={`${groups.length} clients`}>{groups.length}</span>}
              </h2>
              <p>{rangeDay(date)} through {rangeDay(data?.endDate || addSixDays(date))}. Includes matches across all locations involving {location?.name}.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh weekly duplicate bookings">
              <RefreshCw size={14} /> {loading ? 'Checking…' : 'Refresh'}
            </Button>
          </div>
          <p className="weekly-check-context">Daily sign-off applies to the {dayLabel} view. Repeated bookings may be intentional.</p>
          {data && <p className="weekly-check-freshness">
            Checked {timeFormatter.format(new Date(data.refreshedAt))} Pacific. Refresh reuses results for up to {data.cacheSeconds ? data.cacheSeconds / 60 : 5} minutes.
          </p>}
          {error && <div className="error-state" role="alert">Weekly check unavailable. {data ? 'Showing the previous result; it may be out of date.' : 'Refresh to retry.'}</div>}
          {data?.missingPhoneCount > 0 && <p className="weekly-check-context">
            {data.missingPhoneCount} bookings have no phone number. Matches between different customer records may be missed.
          </p>}
          {!data ? <SectionEmptyState>{loading ? 'Checking the next 7 days across all locations…' : 'Weekly results are unavailable.'}</SectionEmptyState> :
            groups.length === 0 ? <SectionEmptyState>{error ? 'No matches in the previous result.' : 'No duplicate bookings found in this 7-day range.'}</SectionEmptyState> : (
              <div className="card-grid">
                {groups.map((group) => <ReportCard key={group.appointments.map((appointment) => appointment.id).sort().join(':')}
                  variant="duplicates" customer={group.customer} isCrossLocation={group.isCrossLocation} showDays={false}>
                  <div className="dup-summary">{group.appointments.length} appointments · {group.locations.join(', ')}</div>
                  <div className="dup-appointments">
                    {group.appointments.map((appointment) => <div key={appointment.id} className="dup-appt-row weekly-dup-appt-row">
                      <span className="dup-appt-time"><span>{dayFormatter.format(new Date(appointment.appointmentTime))}</span><span>{timeFormatter.format(new Date(appointment.appointmentTime))}</span></span>
                      <span className="dup-appt-service">{appointment.serviceName}</span>
                      <span className="dup-appt-tech">{appointment.technicianName}</span>
                      <span className="dup-appt-loc">{appointment.locationName}</span>
                    </div>)}
                  </div>
                </ReportCard>)}
              </div>
            )}
        </div>
      )}
    </>
  );
}

function addSixDays(date) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + 6);
  return result.toISOString().slice(0, 10);
}
