import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, Eye, LogIn, RefreshCw, ShieldCheck, X } from 'lucide-react';
import api from '../api/client';
import { LOCATIONS } from '../hooks/useReports';
import { REPORT_SECTIONS } from '../constants/reportSections';

function getLocationName(locationId, locations) {
  return locations.find((location) => location.id === locationId)?.name || locationId;
}

function ReportAuditPanel({ initialDate, onClose, formatDateTime }) {
  const [auditDate, setAuditDate] = useState(initialDate);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getAudit(auditDate));
    } catch (err) {
      setError(err.message || 'Unable to load the audit for this date.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
    // The selected date is the only input that should trigger an audit fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditDate]);

  const locations = data?.locations?.length ? data.locations : LOCATIONS;
  const sectionDefinitions = data?.sectionDefinitions?.length
    ? data.sectionDefinitions
    : REPORT_SECTIONS;
  const sectionSignoffMap = useMemo(() => {
    const map = new Map();
    for (const signoff of data?.sectionSignoffs || []) {
      const key = `${signoff.actor_id}:${signoff.location_id}:${signoff.section_key}`;
      if (!map.has(key)) map.set(key, signoff);
    }
    return map;
  }, [data?.sectionSignoffs]);
  const observedSectionMap = useMemo(() => new Map(
    (data?.observedSectionSnapshots || []).map((snapshot) => [
      `${snapshot.actor_id}:${snapshot.location_id}:${snapshot.section_key}`,
      snapshot,
    ])
  ), [data?.observedSectionSnapshots]);

  const requiredSigners = data?.requiredSigners || [];
  const requiredTotal = requiredSigners.length * locations.length * sectionDefinitions.length;
  const requiredComplete = requiredSigners.reduce((total, signer) => (
    total + locations.reduce((locationTotal, location) => (
      locationTotal + sectionDefinitions.filter((section) => {
        const key = `${signer.actor_id}:${location.id}:${section.key}`;
        const signoff = sectionSignoffMap.get(key);
        const observed = observedSectionMap.get(key);
        return Boolean(signoff && observed && signoff.snapshot_hash === observed.snapshot_hash);
      }).length
    ), 0)
  ), 0);

  return (
    <section className="audit-panel" aria-labelledby="audit-panel-title">
      <div className="audit-panel-header">
        <div>
          <h2 id="audit-panel-title"><ShieldCheck size={20} /> Governance audit</h2>
          <p>Private to Katelyn. Times are shown in Pacific business time.</p>
        </div>
        <button type="button" className="audit-close-btn" onClick={onClose} aria-label="Close audit">
          <X size={20} />
        </button>
      </div>

      <div className="audit-toolbar">
        <label>
          Audit date
          <input
            type="date"
            value={auditDate}
            onChange={(event) => setAuditDate(event.target.value)}
          />
        </label>
        <button type="button" className="audit-refresh-btn" onClick={loadAudit} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="audit-error" role="alert">{error}</p>}
      {loading && !data && <p className="audit-empty">Loading audit data…</p>}

      {data && (
        <>
          <div className="audit-summary" aria-label="Required sign-off summary">
            <div>
              <strong>{requiredComplete}/{requiredTotal}</strong>
              <span>required section sign-offs</span>
            </div>
            <div>
              <strong>{data.logins.length}</strong>
              <span>successful logins</span>
            </div>
            <div>
              <strong>{data.views.length}</strong>
              <span>first report views</span>
            </div>
          </div>

          <div className="audit-section">
            <div className="audit-section-title">
              <ClipboardCheck size={17} />
              <h3>Required section sign-offs</h3>
            </div>
            <div className="audit-matrix-wrap">
              <table className="audit-table audit-matrix">
                <thead>
                  <tr>
                    <th scope="col">Signer</th>
                    {locations.map((location) => <th scope="col" key={location.id}>{location.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {requiredSigners.map((signer) => (
                    <tr key={signer.actor_id}>
                      <th scope="row">{signer.display_name}</th>
                      {locations.map((location) => {
                        const reviews = sectionDefinitions.map((section) => {
                          const key = `${signer.actor_id}:${location.id}:${section.key}`;
                          const signoff = sectionSignoffMap.get(key) || null;
                          const observed = observedSectionMap.get(key) || null;
                          return {
                            ...section,
                            signoff,
                            observed,
                            current: Boolean(
                              signoff && observed && signoff.snapshot_hash === observed.snapshot_hash
                            ),
                          };
                        });
                        const completed = reviews.filter((review) => review.current).length;
                        return (
                          <td key={location.id}>
                            <details className="audit-section-progress">
                              <summary className={completed === sectionDefinitions.length ? 'audit-complete' : 'audit-pending'}>
                                {completed === sectionDefinitions.length && <Check size={15} />}
                                {completed}/{sectionDefinitions.length}
                              </summary>
                              <div className="audit-section-progress-list">
                                {reviews.map((review) => (
                                  <div key={review.key}>
                                    <strong>{review.label}</strong>
                                    <span title={review.signoff ? `Last signed ${formatDateTime(review.signoff.signed_at_utc)}` : undefined}>
                                      {review.current
                                        ? formatDateTime(review.signoff.signed_at_utc)
                                        : review.signoff
                                          ? 'Updated · review again'
                                          : 'Pending'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="audit-detail-grid">
            <div className="audit-section">
              <div className="audit-section-title">
                <LogIn size={17} />
                <h3>Successful logins</h3>
              </div>
              {data.logins.length === 0 ? (
                <p className="audit-empty">No successful logins recorded for this Pacific date.</p>
              ) : (
                <div className="audit-list">
                  {data.logins.map((event) => (
                    <div className="audit-list-row" key={`${event.actor_id}:${event.logged_in_at_utc}`}>
                      <strong>{event.username}</strong>
                      <span>{formatDateTime(event.logged_in_at_utc)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="audit-section">
              <div className="audit-section-title">
                <Eye size={17} />
                <h3>First report views</h3>
              </div>
              {data.views.length === 0 ? (
                <p className="audit-empty">No first report views recorded for this Pacific date.</p>
              ) : (
                <div className="audit-list">
                  {data.views.map((event) => (
                    <div className="audit-list-row" key={`${event.actor_id}:${event.location_id}:${event.session_id}`}>
                      <strong>{event.username} · {getLocationName(event.location_id, locations)}</strong>
                      <span>{formatDateTime(event.viewed_at_utc)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="audit-section">
            <div className="audit-section-title">
              <ClipboardCheck size={17} />
              <h3>Section sign-off history</h3>
            </div>
            {(data.sectionSignoffs || []).length === 0 ? (
              <p className="audit-empty">No section sign-offs recorded for this report date.</p>
            ) : (
              <div className="audit-list">
                {data.sectionSignoffs.map((event) => (
                  <div className="audit-list-row" key={event.id || `${event.actor_id}:${event.location_id}:${event.section_key}:${event.signed_at_utc}`}>
                    <strong>
                      {event.username} · {getLocationName(event.location_id, locations)} · {' '}
                      {sectionDefinitions.find((section) => section.key === event.section_key)?.label || event.section_key}
                    </strong>
                    <span>
                      {sectionSignoffMap.get(
                        `${event.actor_id}:${event.location_id}:${event.section_key}`
                      )?.id === event.id && observedSectionMap.get(
                        `${event.actor_id}:${event.location_id}:${event.section_key}`
                      )?.snapshot_hash === event.snapshot_hash
                        ? 'Current · '
                        : 'Superseded · '}
                      {formatDateTime(event.signed_at_utc)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="audit-section">
            <div className="audit-section-title">
              <ClipboardCheck size={17} />
              <h3>Legacy whole-report sign-offs</h3>
            </div>
            {data.signoffs.length === 0 ? (
              <p className="audit-empty">No earlier whole-report sign-offs recorded for this date.</p>
            ) : (
              <div className="audit-list">
                {data.signoffs.map((event) => (
                  <div className="audit-list-row" key={`${event.actor_id}:${event.location_id}`}>
                    <strong>{event.username} · {getLocationName(event.location_id, locations)}</strong>
                    <span>{formatDateTime(event.signed_at_utc)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default ReportAuditPanel;
