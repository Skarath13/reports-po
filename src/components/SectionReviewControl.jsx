import React from 'react';
import { Check, ClipboardCheck } from 'lucide-react';

function SectionReviewControl({
  label,
  state,
  isToday,
  statusLoading,
  statusError,
  onSignOff,
  formatDateTime,
}) {
  if (statusLoading && !state?.review) {
    return <span className="section-review-state muted">Loading review…</span>;
  }
  if (statusError) {
    return <span className="section-review-state error" title={statusError}>Review unavailable</span>;
  }
  if (!state?.ready) {
    return <span className="section-review-state muted">Preparing review…</span>;
  }

  if (state.signedOff && state.changedCount === 0) {
    return (
      <span
        className="section-review-state complete"
        title={formatDateTime(state.review.signedAtUtc)}
      >
        <Check size={14} /> Reviewed
      </span>
    );
  }

  const isUpdate = state.signedOff && state.changedCount > 0;
  const updateLabel = state.unseenCount > 0
    ? `${state.unseenCount} new`
    : 'Updated';
  const disabled = !isToday || state.loading;

  return (
    <div className="section-review-control">
      {isUpdate && (
        <span
          className={`section-update-count ${state.unseenCount === 0 ? 'seen' : ''}`}
          title={state.removedCount > 0 ? `${state.removedCount} removed since review` : undefined}
        >
          {updateLabel}
        </span>
      )}
      <button
        type="button"
        className="section-signoff-btn"
        onClick={onSignOff}
        disabled={disabled}
        aria-label={isUpdate ? `Sign off updates to ${label}` : `Sign off ${label}`}
        title={!isToday ? 'Section sign-off opens on today’s Pacific report only.' : undefined}
      >
        <ClipboardCheck size={14} />
        {state.loading ? 'Saving…' : isUpdate ? 'Sign off updates' : 'Sign off section'}
      </button>
      {state.error && <span className="section-review-error" role="alert">{state.error}</span>}
    </div>
  );
}

export default SectionReviewControl;
