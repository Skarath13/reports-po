import React from 'react';
import SectionReviewControl from './SectionReviewControl';

function ReviewableSectionHeader({
  title,
  description,
  icon,
  state,
  isToday,
  statusLoading,
  statusError,
  onSignOff,
  formatDateTime,
  children,
}) {
  return (
    <div className="section-header section-review-header">
      <div className="section-heading"><h2 className="section-title">{icon}{title}</h2>{description && <p>{description}</p>}</div>
      <div className="section-header-controls">
        {children}
        <SectionReviewControl
          label={title}
          state={state}
          isToday={isToday}
          statusLoading={statusLoading}
          statusError={statusError}
          onSignOff={onSignOff}
          formatDateTime={formatDateTime}
        />
      </div>
    </div>
  );
}

export function SectionEmptyState({ children }) {
  return <div className="section-empty-state">{children}</div>;
}

export default ReviewableSectionHeader;
