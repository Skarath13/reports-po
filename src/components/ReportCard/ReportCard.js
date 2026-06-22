import React from 'react';
import './ReportCard.css';

// Days-since color mapping
function getDaysSinceStyle(days) {
  if (days === null || days === undefined) return { bg: '#e5e7eb', text: '#374151', label: 'New' };
  if (days <= 6) return { bg: '#a855f7', text: '#ffffff', label: `${days}d` };   // Purple (1-6)
  if (days <= 14) return { bg: '#22c55e', text: '#ffffff', label: `${days}d` };  // Green (7-14)
  if (days <= 28) return { bg: '#fde047', text: '#854d0e', label: `${days}d` };  // Yellow (15-28)
  if (days <= 60) return { bg: '#fb923c', text: '#ffffff', label: `${days}d` };  // Orange (29-60)
  return { bg: '#ef4444', text: '#ffffff', label: `${days}d` };                   // Red (60+)
}

// Days Since Badge component
export function DaysBadge({ days, inline }) {
  const style = getDaysSinceStyle(days);
  return (
    <span
      className={`days-badge ${inline ? 'inline' : ''}`}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

/**
 * Unified ReportCard component with CONSISTENT visual structure
 *
 * Layout (same for ALL variants):
 * ┌─────────────────────────────┐
 * │ TIME              TECH      │  <- Header row
 * ├─────────────────────────────┤
 * │ CUSTOMER NAME               │
 * │ SERVICE                     │
 * │ [Days Badge]                │
 * ├─────────────────────────────┤
 * │ [Extra content - optional]  │  <- Section-specific extras
 * └─────────────────────────────┘
 *
 * @param {string} variant - Card color theme: 'fixes' | 'duplicates' | 'anyone' | 'note'
 * @param {string} time - Appointment time (formatted) - REQUIRED
 * @param {string} customer - Customer name - REQUIRED
 * @param {string} service - Service name (abbreviated) - REQUIRED
 * @param {number} days - Days since last appointment - REQUIRED
 * @param {string} technician - Technician name - REQUIRED
 * @param {boolean} isCrossLocation - For duplicates variant styling
 * @param {React.ReactNode} children - Extra content below core elements (notes, locations, etc.)
 */
function ReportCard({
  variant,
  time,
  customer,
  service,
  days,
  technician,
  isCrossLocation,
  className,
  children
}) {
  const cardClassName = [
    'report-card',
    variant,
    isCrossLocation ? 'cross-location' : '',
    className || ''
  ].filter(Boolean).join(' ');

  // For duplicates variant, skip header and show simplified body
  const isDuplicates = variant === 'duplicates';

  return (
    <div className={cardClassName}>
      {/* Cross-location indicator */}
      {isCrossLocation && <span className="cross-icon">🌐</span>}

      {/* HEADER: Time + Technician (hidden for duplicates) */}
      {!isDuplicates && (
        <div className="report-card-header">
          <span className="report-card-time">{time}</span>
          <span className="report-card-tech">{technician}</span>
        </div>
      )}

      {/* BODY: Customer + Days (same row), Service */}
      <div className="report-card-body">
        <div className="report-card-customer-row">
          <span className="report-card-customer">{customer}</span>
          <DaysBadge days={days} />
        </div>
        {!isDuplicates && <div className="report-card-service">{service}</div>}
      </div>

      {/* EXTRA: Section-specific content (optional) */}
      {children && (
        <div className="report-card-extra">
          {children}
        </div>
      )}
    </div>
  );
}

export default ReportCard;
