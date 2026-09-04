import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { Skeleton } from './ui/skeleton';
import './LoadingState.css';

export function LoadingStatus({ title, detail, compact = false }) {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`loading-status ${compact ? 'compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="loading-status-icon" aria-hidden="true">
        <LoaderCircle />
      </span>
      <span>
        <strong>{title}</strong>
        <span className="loading-status-detail">
          {takingLonger
            ? 'Taking a little longer. We’re still working on it.'
            : detail}
        </span>
      </span>
    </div>
  );
}

function SkeletonRows({ count = 3 }) {
  return Array.from({ length: count }, (_, index) => (
    <div className="loading-appointment-row" key={index}>
      <Skeleton className="loading-time" />
      <div className="loading-row-content">
        <Skeleton
          className={index % 2 ? 'loading-line medium' : 'loading-line'}
        />
        <Skeleton className="loading-line short" />
      </div>
      <Skeleton className="loading-badge" />
    </div>
  ));
}

export function ReportSkeleton({
  section = 'overview',
  layout = 'grouped',
  preview = false,
}) {
  const schedule = section === 'overview' || section === 'calendar';
  return (
    <div
      className={`loading-surface ${preview ? 'loading-preview' : ''}`}
      aria-hidden="true"
    >
      {section === 'overview' && (
        <div className="loading-metrics">
          {[0, 1, 2].map((index) => (
            <div className="loading-metric" key={index}>
              <Skeleton className="loading-line medium" />
              <Skeleton className="loading-number" />
              <Skeleton className="loading-line short" />
            </div>
          ))}
        </div>
      )}
      <div className="loading-report">
        <div className="loading-report-heading">
          <div>
            <Skeleton className="loading-title" />
            <Skeleton className="loading-line" />
          </div>
          <Skeleton className="loading-control" />
        </div>
        {schedule && (
          <div className="loading-toolbar">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        )}
        {schedule && layout === 'list' ? (
          <div className="loading-list">
            <SkeletonRows count={preview ? 3 : 6} />
          </div>
        ) : (
          <div className={`loading-card-grid ${preview ? 'preview-grid' : ''}`}>
            {Array.from({ length: preview ? 2 : 4 }, (_, index) => (
              <div className="loading-tech-card" key={index}>
                <div className="loading-tech-heading">
                  <Skeleton className="loading-line short" />
                  <Skeleton className="loading-badge" />
                </div>
                <SkeletonRows count={schedule ? 3 : 2} />
                {!schedule && (
                  <div className="loading-note">
                    <Skeleton className="loading-line" />
                    <Skeleton className="loading-line" />
                    <Skeleton className="loading-line medium" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceLoading() {
  return (
    <main className="workspace-loading" aria-busy="true">
      <div className="workspace-loading-intro">
        <BrandLogo className="workspace-loading-logo" />
        <span className="loading-eyebrow">Your daily workspace</span>
        <h1>Bringing everything into view</h1>
        <LoadingStatus
          title="Checking your session"
          detail="Your dashboard will appear as soon as it’s ready."
        />
      </div>
      <div className="workspace-loading-preview">
        <ReportSkeleton preview />
      </div>
    </main>
  );
}

export function ReportLoading({ locationName, section, layout, dateLabel }) {
  return (
    <main
      className="report-content report-loading"
      id="report-main"
      tabIndex={-1}
      aria-busy="true"
      aria-label="Loading report"
    >
      <div className="report-loading-banner">
        <LoadingStatus
          title={`Loading ${locationName || 'your report'}`}
          detail={`${dateLabel} · Gathering appointments and notes`}
        />
        <BrandLogo className="report-loading-logo" />
      </div>
      <ReportSkeleton section={section} layout={layout} />
    </main>
  );
}
