import React from 'react';
import { useUpdateAcknowledgement } from '../../hooks/useUpdateAcknowledgement';
import './ReportCard.css';

import { getDaysSinceStyle } from '../../utils/reportAppearance';

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
  isUpdated = false,
  reviewEntry,
  onUpdateSeen,
  children
}) {
  const updateHandlers = useUpdateAcknowledgement(isUpdated, onUpdateSeen, reviewEntry);
  const cardClassName = [
    'report-card',
    variant,
    isCrossLocation ? 'cross-location' : '',
    isUpdated ? 'review-update-cue' : '',
    className || ''
  ].filter(Boolean).join(' ');

  // For duplicates variant, skip header and show simplified body
  const isDuplicates = variant === 'duplicates';

  return (
    <div
      className={cardClassName}
      tabIndex={isUpdated ? 0 : undefined}
      {...updateHandlers}
    >
      {isUpdated && (
        <span className="review-update-label" aria-label="New since your review">New</span>
      )}
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
