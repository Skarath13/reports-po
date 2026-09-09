import React, { useState } from 'react';
import SectionReviewControl from './SectionReviewControl';

function ReviewableSectionHeader({
  title,
  count,
  description,
  icon,
  state,
  isToday,
  statusLoading,
  statusError,
  onSignOff,
  onRemovedSeen,
  onRevealContent,
  formatDateTime,
  children,
}) {
  const [filteredUpdate, setFilteredUpdate] = useState(false);
  const showNextUpdate = (event) => {
    const section = event.currentTarget.closest('.report-section');
    const reveal = () => {
      if (!section.isConnected) return;
      const next = [
        ...section.querySelectorAll('[data-review-updated="true"]'),
      ].find((item) => item.getBoundingClientRect().height > 0);
      setFilteredUpdate(!next);
      next?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'center',
      });
    };
    if (onRevealContent) {
      onRevealContent();
      // Wait for the collapsed schedule to open before finding a visible row.
      requestAnimationFrame(reveal);
    } else {
      reveal();
    }
  };

  return (
    <div className="section-header section-review-header">
      <div className="section-heading">
        <h2 className="section-title" aria-label={title}>
          {icon}
          {title}
          {count != null && <span className="section-item-count" aria-label={`${count} items`}>{count}</span>}
        </h2>
        {description && <p>{description}</p>}
      </div>
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
      {(state?.unseenCount > 0 || state?.unseenRemovedCount > 0) && (
        <div className="section-update-notice">
          {state.unseenCount > 0 && (
            <>
              <span className="update-notice-copy">
                <strong>
                  {state.unseenCount}{' '}
                  {state.unseenCount === 1 ? 'update' : 'updates'} to review
                </strong>
                <span className="update-notice-hint">
                  Blue items clear when you hover or tap them.
                </span>
                {filteredUpdate && (
                  <span className="update-notice-hint" role="status">
                    Clear your filters to show the remaining updates.
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={showNextUpdate}
                aria-label={`Show next update in ${title}`}
              >
                Show next update
              </button>
            </>
          )}
          {state.unseenRemovedCount > 0 && (
            <span className="removed-update-notice">
              <span>
                {state.unseenRemovedCount}{' '}
                {state.unseenRemovedCount === 1 ? 'item was' : 'items were'}{' '}
                removed.
              </span>
              <button
                type="button"
                onClick={onRemovedSeen}
                aria-label={`Dismiss removed items notice for ${title}`}
              >
                Got it
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SectionEmptyState({ children }) {
  return <div className="section-empty-state">{children}</div>;
}

export default ReviewableSectionHeader;
