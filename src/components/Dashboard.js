import React, { useState, useEffect, useRef } from 'react';
import { useFullReport, useAllLocationAppointments, LOCATIONS } from '../hooks/useReports';
import { Copy, Check, Eye, EyeOff, StickyNote, Wrench, AlertTriangle, Sun, Users, Activity, DollarSign } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { appendPriceToScheduleLine, getReportAppointmentPriceBadge } from '../utils/reportPricing';
import './Dashboard.css';

// Skeleton loader component
function SkeletonLoader() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-section">
        <div className="skeleton-title"></div>
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-header"></div>
              <div className="skeleton-card-body">
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="skeleton-row"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-section">
        <div className="skeleton-title"></div>
        <div className="skeleton-table">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-table-row"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Get today's date in YYYY-MM-DD format (Pacific time)
function getTodayPST() {
  const now = new Date();
  // Use Intl.DateTimeFormat to get the correct PST date
  // 'en-CA' locale gives YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

// Get tomorrow's date in YYYY-MM-DD format (Pacific time)
function getTomorrowPST() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(tomorrow);
}

// Days-since color mapping
function getDaysSinceStyle(days) {
  if (days === null || days === undefined) return { bg: '#3b82f6', text: '#ffffff', label: 'New' };
  if (days <= 6) return { bg: '#a855f7', text: '#ffffff', label: `${days}d` };   // Purple (1-6)
  if (days <= 14) return { bg: '#22c55e', text: '#ffffff', label: `${days}d` };  // Green (7-14)
  if (days <= 28) return { bg: '#fde047', text: '#854d0e', label: `${days}d` };  // Yellow (15-28)
  if (days <= 60) return { bg: '#fb923c', text: '#ffffff', label: `${days}d` };  // Orange (29-60)
  return { bg: '#ef4444', text: '#ffffff', label: `${days}d` };                   // Red (60+)
}

// Title case for customer names
function titleCase(name) {
  if (!name) return '';
  return name.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// Format time from ISO string (Pacific timezone)
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles'
  });
}

// Get hour in Pacific time (for first-hour check)
function getHourPST(isoString) {
  if (!isoString) return -1;
  const date = new Date(isoString);
  const pstTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstTime.getHours();
}

// Clean up technician name (remove location suffix)
function cleanTechName(name) {
  if (!name) return 'Unassigned';
  const preservedLabels = new Set(['any available', 'anyone available', 'lash technician', 'unassigned']);
  const metadataSuffixes = new Set(['bloom', 'square', 'checkin', 'check', 'in', 'source', 'internal', 'test']);
  let cleanName = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(Tustin|Costa Mesa|Santa Ana|Irvine|Newport Beach).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleanName.split(/\s+/).filter(Boolean);
  const lowerName = tokens.join(' ').toLowerCase();
  if (tokens.length > 1 && !preservedLabels.has(lowerName)) {
    const suffixTokens = tokens.slice(1);
    const suffixIsMetadata = suffixTokens.every((token) => (
      /^[a-z]$/i.test(token) ||
      /^\d+$/.test(token) ||
      metadataSuffixes.has(token.toLowerCase())
    ));
    if (suffixIsMetadata) {
      cleanName = tokens[0];
    }
  }

  if (cleanName.toLowerCase().includes('dale')) {
    cleanName = 'Katie';
  }

  return cleanName || 'Unassigned';
}

// Abbreviate service name for display
function abbreviateService(name) {
  if (!name) return '';
  // Common abbreviations
  return name
    .replace('🎀  HOLIDAY PROMO 🎄🌟 $75 Natural Set For New and Returning Customers', '🎀 HOLIDAY PROMO $75')
    .replace('(NEW CLIENT PROMO) Natural Wet Set $75 ⚡️', '⚡️ NEW CLIENT $75')
    .replace('(NEW CLIENT PROMO) Natural Set $75 🌿', '🌿 NEW CLIENT $75')
    .replace('Full Set of Lash Extensions (Consultation Recommended)', 'Full Set (Consult)')
    .replace('Elegant Volume Set ✨(Most Popular)✨', 'Elegant Volume Set ✨')
    .replace('Lash Fill (Elegant Volume) ✨', 'Fill - Elegant Vol ✨')
    .replace('Lash Fill (Mega Volume) 💎', 'Fill - Mega Vol 💎')
    .replace('Lash Fill (Natural) 🌿', 'Fill - Natural 🌿')
    .replace('One Week Touch-Up/Fill 💕', 'Touch-Up 💕')
    .replace('New Set (and Lash Removal) 💖', 'New Set 💖')
    .replace('Removal for Eyelash Extensions', 'Removal')
    .replace('Natural Set 🌿', 'Natural Set 🌿')
    .replace('Fix - 3 Days or Under', 'Fix (3 Days)')
    .replace('One Week Touch-Up/Fill', 'Touch-Up');
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format time for generated timestamp
function formatGeneratedTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles'
  });
}

// Get likelihood color - vibrant colors for dots
function getLikelihoodStyle(likelihood) {
  if (likelihood >= 50) return { bg: '#fecaca', text: '#991b1b', dot: '#ef4444' }; // Bright red
  if (likelihood >= 30) return { bg: '#fed7aa', text: '#9a3412', dot: '#f97316' }; // Bright orange
  if (likelihood >= 15) return { bg: '#fef08a', text: '#854d0e', dot: '#eab308' }; // Bright yellow
  if (likelihood > 0) return { bg: '#d9f99d', text: '#3f6212', dot: '#22c55e' };   // Bright green
  return { bg: 'transparent', text: '#6b7280', dot: '#9ca3af' };
}

// Find duplicate clients (same phone appearing multiple times - across all locations)
// allLocationAppointments: all appointments across all locations for the date
function findDuplicateClients(allLocationAppointments) {
  if (!allLocationAppointments || allLocationAppointments.length === 0) return [];

  const phoneMap = {};

  allLocationAppointments.forEach(apt => {
    const phone = apt.customerPhone?.replace(/\D/g, '') || '';

    if (phone && phone.length >= 10) {
      if (!phoneMap[phone]) phoneMap[phone] = [];
      phoneMap[phone].push(apt);
    }
  });

  // Find entries with 2+ appointments
  const duplicates = [];

  Object.entries(phoneMap).forEach(([phone, apts]) => {
    if (apts.length > 1) {
      // Get unique locations
      const locations = [...new Set(apts.map(a => a.locationName || a.locationId))];
      const isCrossLocation = locations.length > 1;

      duplicates.push({
        customer: apts[0].customerName,
        phone: apts[0].customerPhone,
        appointments: apts,
        locations: locations,
        isCrossLocation: isCrossLocation
      });
    }
  });

  // Sort cross-location duplicates first (more important)
  duplicates.sort((a, b) => {
    if (a.isCrossLocation && !b.isCrossLocation) return -1;
    if (!a.isCrossLocation && b.isCrossLocation) return 1;
    return 0;
  });

  return duplicates;
}

// Find potential unauthorized fixes - customers who booked within 5 days
// UNLESS service name contains "fix" (those are seller-booked)
function findPotentialFixes(appointments) {
  if (!appointments || appointments.length === 0) return [];

  return appointments.filter(apt => {
    const days = apt.daysSinceLastAppointment;
    const serviceName = (apt.serviceName || '').toLowerCase();

    // Only flag if within 5 days AND service doesn't contain "fix"
    return days !== null &&
           days <= 5 &&
           !serviceName.includes('fix');
  });
}

function Dashboard({ user, onLogout }) {
  // Get saved location from localStorage (per user)
  const getStoredLocation = () => {
    try {
      const key = `reports_location_${user?.username || 'default'}`;
      const stored = localStorage.getItem(key);
      if (stored && LOCATIONS.some(l => l.id === stored)) {
        return stored;
      }
    } catch (e) {
      // localStorage not available
    }
    return 'tustin';
  };

  // Get saved hideNames preference from localStorage (default: true for privacy)
  const getStoredHideNames = () => {
    try {
      const key = `reports_hideNames_${user?.username || 'default'}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (e) {
      // localStorage not available
    }
    return true; // Default to hidden for privacy
  };

  // Get saved price preference from localStorage (default: true for manager utility)
  const getStoredShowPrices = () => {
    try {
      const key = `reports_showPrices_${user?.username || 'default'}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (e) {
      // localStorage not available
    }
    return true;
  };

  const [selectedLocation, setSelectedLocation] = useState(getStoredLocation);
  const [selectedDate, setSelectedDate] = useState(getTodayPST());
  const [hideNames, setHideNames] = useState(getStoredHideNames);
  const [showPrices, setShowPrices] = useState(getStoredShowPrices);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevLocationRef = useRef(selectedLocation);

  // Save location to localStorage when it changes
  useEffect(() => {
    try {
      const key = `reports_location_${user?.username || 'default'}`;
      localStorage.setItem(key, selectedLocation);
    } catch (e) {
      // localStorage not available
    }
  }, [selectedLocation, user?.username]);

  // Save hideNames preference to localStorage when it changes
  useEffect(() => {
    try {
      const key = `reports_hideNames_${user?.username || 'default'}`;
      localStorage.setItem(key, String(hideNames));
    } catch (e) {
      // localStorage not available
    }
  }, [hideNames, user?.username]);

  // Save showPrices preference to localStorage when it changes
  useEffect(() => {
    try {
      const key = `reports_showPrices_${user?.username || 'default'}`;
      localStorage.setItem(key, String(showPrices));
    } catch (e) {
      // localStorage not available
    }
  }, [showPrices, user?.username]);

  const isToday = selectedDate === getTodayPST();

  const location = LOCATIONS.find(l => l.id === selectedLocation);
  const { data: report, loading, error, lastUpdated, refresh } = useFullReport(
    location?.squareId,
    selectedDate
  );

  // Fetch all-location appointments for cross-location duplicate detection
  const { data: allLocationData } = useAllLocationAppointments(selectedDate);

  // Track location changes for transition effect
  useEffect(() => {
    if (prevLocationRef.current !== selectedLocation) {
      setIsTransitioning(true);
      prevLocationRef.current = selectedLocation;
    }
  }, [selectedLocation]);

  // Clear transition when data loads
  useEffect(() => {
    if (report && isTransitioning) {
      setIsTransitioning(false);
    }
  }, [report, isTransitioning]);

  // Show skeleton whenever loading (better UX than overlay)
  const showSkeleton = loading;

  return (
    <div className="report-dashboard">
      {/* Header */}
      <header className="report-header">
        <div className="header-left">
          <h1 className="header-title">{location?.name || 'Reports'}</h1>
          <span className="header-date">{formatDate(selectedDate)}</span>
          {report?.generatedAt && (
            <span className="header-sync">Synced {formatGeneratedTime(report.generatedAt)}</span>
          )}
        </div>
        <div className="header-center">
          <div className="date-toggle">
            <button
              className={`date-toggle-btn ${isToday ? 'active' : ''}`}
              onClick={() => setSelectedDate(getTodayPST())}
            >
              Today
            </button>
            <button
              className={`date-toggle-btn ${!isToday ? 'active' : ''}`}
              onClick={() => setSelectedDate(getTomorrowPST())}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <div className="header-right">
          <button className="refresh-btn" onClick={refresh} disabled={loading}>
            <svg
              className={`refresh-icon ${loading ? 'spinning' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <span className="user-name">{user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : ''}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      {/* Location Tabs */}
      <nav className="location-tabs">
        {LOCATIONS.map(loc => (
          <button
            key={loc.id}
            className={`location-tab ${selectedLocation === loc.id ? 'active' : ''}`}
            style={{ '--tab-color': loc.color }}
            onClick={() => setSelectedLocation(loc.id)}
          >
            {loc.name}
          </button>
        ))}
      </nav>

      {/* Loading / Error States */}
      {showSkeleton && (
        <SkeletonLoader />
      )}
      {error && !loading && (
        <div className="error-state">Error: {error}</div>
      )}

      {/* Main Report Content */}
      {report && !showSkeleton && (
        <main className="report-content">
          {/* Section 1: Calendar List View - 2 columns max */}
          {(() => {
            // Create lookup map for likelihood data from rankedByLikelihood
            // Includes score components for enhanced tooltip
            const likelihoodMap = {};
            (report.rankedByLikelihood || []).forEach(apt => {
              if (apt.id) {
                likelihoodMap[apt.id] = {
                  score: apt.futureIssueLikelihood || 0,
                  components: apt.riskScoreComponents || null,
                  reason: apt.riskScoreReason || null
                };
              }
            });

            return (
              <section className="report-section">
                <div className="section-header">
                  <h2 className="section-title">Calendar List View</h2>
                  <div className="section-actions">
                    <button
                      className={`privacy-btn price-toggle ${showPrices ? 'active' : ''}`}
                      onClick={() => setShowPrices(!showPrices)}
                    >
                      <DollarSign size={18} />
                      {showPrices ? 'Hide Prices' : 'Show Prices'}
                    </button>
                    <button
                      className={`privacy-btn ${hideNames ? 'active' : ''}`}
                      onClick={() => setHideNames(!hideNames)}
                    >
                      {hideNames ? <><EyeOff size={18} /> Show Names</> : <><Eye size={18} /> Hide Names</>}
                    </button>
                  </div>
                </div>
                <div className="calendar-grid-2col">
                  {report.technicians?.map(tech => (
                    <TechnicianColumn
                      key={tech}
                      name={cleanTechName(tech)}
                      appointments={report.byTechnician[tech] || []}
                      hideNames={hideNames}
                      showPrices={showPrices}
                      likelihoodMap={likelihoodMap}
                    />
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Section 2: Appointment Notes - Sticky Note Grid */}
          {(() => {
            const appointmentsWithNotes = (report.rankedByLikelihood?.filter(
              apt => apt.customerNote || apt.sellerNote
            ) || []).sort((a, b) =>
              new Date(a.appointmentTime) - new Date(b.appointmentTime)
            );
            return appointmentsWithNotes.length > 0 && (
              <section className="report-section notes-section">
                <h2 className="section-title"><StickyNote size={20} className="section-icon" /> Appointment Notes</h2>
                <div className="card-grid">
                  {appointmentsWithNotes.map((apt, i) => (
                    <ReportCard
                      key={i}
                      variant="note"
                      time={formatTime(apt.appointmentTime)}
                      customer={titleCase(apt.customerName)}
                      service={abbreviateService(apt.serviceName)}
                      days={apt.daysSinceLastAppointment}
                      technician={cleanTechName(apt.technicianName)}
                    >
                      {/* Extra: Notes content */}
                      {apt.customerNote && <p><strong>Customer:</strong> {apt.customerNote}</p>}
                      {apt.sellerNote && <p><strong>Business:</strong> {apt.sellerNote}</p>}
                    </ReportCard>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Section 3: Potential Fixes - Customers who booked within 5 days */}
          {(() => {
            const potentialFixes = findPotentialFixes(report.rankedByLikelihood || []);
            return potentialFixes.length > 0 && (
              <section className="report-section fixes-section">
                <h2 className="section-title">
                  <Wrench size={20} className="section-icon" /> Potential Fixes
                </h2>
                <div className="card-grid">
                  {potentialFixes.map((apt, i) => (
                    <ReportCard
                      key={i}
                      variant="fixes"
                      time={formatTime(apt.appointmentTime)}
                      customer={titleCase(apt.customerName)}
                      service={abbreviateService(apt.serviceName)}
                      days={apt.daysSinceLastAppointment}
                      technician={cleanTechName(apt.technicianName)}
                    />
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Section 4: Duplicate Clients (Cross-Location Aware) */}
          {(() => {
            // Use all-location data for cross-location duplicate detection
            const allDuplicates = findDuplicateClients(allLocationData?.appointments || []);
            // Filter to only show duplicates that include the current location
            const duplicateClients = allDuplicates.filter(dup =>
              dup.appointments.some(apt =>
                apt.locationName === location?.name ||
                apt.locationId === location?.squareId
              )
            );
            return duplicateClients.length > 0 && (
              <section className="report-section duplicates-section">
                <h2 className="section-title"><AlertTriangle size={20} className="section-icon" /> Duplicate Clients Today</h2>
                <div className="card-grid">
                  {duplicateClients.map((dup, i) => (
                    <ReportCard
                      key={i}
                      variant="duplicates"
                      isCrossLocation={dup.isCrossLocation}
                      time={formatTime(dup.appointments[0]?.appointmentTime)}
                      customer={titleCase(dup.customer)}
                      service={abbreviateService(dup.appointments[0]?.serviceName)}
                      days={dup.appointments[0]?.daysSinceLastAppointment}
                      technician={cleanTechName(dup.appointments[0]?.technicianName)}
                    >
                      {/* Extra: All appointments listed */}
                      <div className="dup-summary">
                        {dup.appointments.length} appts @ {dup.locations.length > 1 ? `${dup.locations.length} locations` : dup.locations[0]}
                      </div>
                      <div className="dup-appointments">
                        {dup.appointments.map((apt, j) => (
                          <div key={j} className="dup-appt-row">
                            <span className="dup-appt-time">{formatTime(apt.appointmentTime)}</span>
                            <span className="dup-appt-service">{abbreviateService(apt.serviceName)}</span>
                            <span className="dup-appt-tech">{cleanTechName(apt.technicianName)}</span>
                            {dup.isCrossLocation && <span className="dup-appt-loc">{apt.locationName || ''}</span>}
                          </div>
                        ))}
                      </div>
                    </ReportCard>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Section 4: Anyone Available */}
          {report.anyoneAvailable?.length > 0 && (
            <section className="report-section anyone-section">
              <h2 className="section-title"><Users size={20} className="section-icon" /> Clients Booked for Anyone Available</h2>
              <div className="card-grid">
                {report.anyoneAvailable.map((apt, i) => (
                  <ReportCard
                    key={i}
                    variant="anyone"
                    time={formatTime(apt.appointmentTime)}
                    customer={titleCase(apt.customerName)}
                    service={abbreviateService(apt.serviceName)}
                    days={apt.daysSinceLastAppointment}
                    technician={cleanTechName(apt.technicianName)}
                    technicianLabel="Assigned"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Staff Without First-Hour (calculated client-side for accurate PST) */}
          {(() => {
            // Recalculate staff without 9-10 AM in PST
            const staffMissingFirstHour = report.technicians?.filter(tech => {
              const techAppts = report.byTechnician[tech] || [];
              const hasFirstHour = techAppts.some(apt => {
                const hour = getHourPST(apt.appointmentTime);
                return hour === 9; // 9 AM PST
              });
              return !hasFirstHour && techAppts.length > 0;
            }).map(tech => {
              const techAppts = report.byTechnician[tech] || [];
              const firstAppt = techAppts[0];
              return {
                technician: cleanTechName(tech),
                firstAppointmentTime: firstAppt?.appointmentTime
              };
            }) || [];

            return staffMissingFirstHour.length > 0 && (
              <section className="report-section info-section">
                <h2 className="section-title"><Sun size={20} className="section-icon" /> Staff Without a First-Hour (9-10 AM) Appointment</h2>
                <div className="staff-chips">
                  {staffMissingFirstHour.map((staff, i) => (
                    <div key={i} className="staff-chip">
                      <span className="staff-name">{staff.technician}</span>
                      <span className="first-apt">
                        First: {formatTime(staff.firstAppointmentTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Footer Stats */}
          <footer className="report-footer">
            <div className="footer-stats">
              <div className="stat">Total Appointments: <strong>{report.totalAppointments}</strong></div>
              <div className="stat">Technicians: <strong>{report.technicians?.length || 0}</strong></div>
              {lastUpdated && (
                <div className="stat">
                  Last Updated: <strong>{lastUpdated.toLocaleTimeString()}</strong>
                </div>
              )}
            </div>
            <div className="footer-btns">
              <a href="https://thankyou.elegantlashesbykatie.com/status" className="monitoring-btn" target="_blank" rel="noopener noreferrer">
                <Activity size={16} />
                Express Stats
              </a>
              <a href="/monitoring" className="monitoring-btn" target="_blank" rel="noopener noreferrer">
                <Activity size={16} />
                System Status
              </a>
            </div>
          </footer>
        </main>
      )}
    </div>
  );
}

// Technician Column Component with Copy functionality
function TechnicianColumn({ name, appointments, hideNames, showPrices, likelihoodMap }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    // Clean plain text format for easy iMessage sharing
    const lines = appointments.map(apt => {
      const time = formatTime(apt.appointmentTime);
      const days = apt.daysSinceLastAppointment === null ? 'New' : `${apt.daysSinceLastAppointment}d`;
      const service = abbreviateService(apt.serviceName);
      const baseLine = hideNames
        ? `${time} - ${service} (${days})`
        : `${time} - ${titleCase(apt.customerName)} - ${service} (${days})`;

      return appendPriceToScheduleLine(baseLine, apt, showPrices);
    }).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="tech-column">
      <div className="tech-column-header">
        <span className="tech-name">{name}</span>
        <div className="tech-header-right">
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={copyToClipboard}
            title="Copy schedule"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <span className="tech-count">{appointments.length}</span>
        </div>
      </div>
      <div className="tech-appointments">
        {appointments.map((apt, i) => (
          <AppointmentRow
            key={i}
            appointment={apt}
            hideNames={hideNames}
            showPrices={showPrices}
            likelihoodMap={likelihoodMap}
          />
        ))}
      </div>
    </div>
  );
}

// Build enhanced tooltip for risk score breakdown (additive algorithm)
function buildRiskTooltip(score, components, reason) {
  if (!components) {
    return `${score}% chance of no-show/cancel`;
  }

  const lines = [`═══ ${score}% Risk Score ═══`];

  if (reason === 'New customer (no history)') {
    lines.push('');
    lines.push('New customer - no history');
    lines.push('Using baseline: 25%');
  } else if (reason?.startsWith('Limited history')) {
    lines.push('');
    lines.push(reason);
    lines.push('Need 3+ appts for full analysis');
  } else {
    // Full analysis - show step-by-step calculation
    lines.push('───────────────────');

    // Base rate
    if (components.historicalRate > 0) {
      lines.push(`Base: ${components.historicalRate}% from history`);
    } else {
      lines.push('Base: 0% (no prior issues)');
    }

    // Additions (risk factors)
    if (components.recencyBoost > 0) {
      const recencyDesc = components.recencyBoost >= 15 ? '(<14 days ago)' :
                          components.recencyBoost >= 10 ? '(<30 days ago)' : '(<60 days ago)';
      lines.push(`  + ${components.recencyBoost}  Recent issue ${recencyDesc}`);
    }
    if (components.streakPenalty > 0) {
      const streakDesc = components.streakPenalty >= 20 ? '(3+ in a row)' : '(2 in a row)';
      lines.push(`  + ${components.streakPenalty}  Streak ${streakDesc}`);
    }
    if (components.dayOfWeekRisk > 0) {
      const dayDesc = components.dayOfWeekRisk >= 10 ? 'Friday' : 'Sunday';
      lines.push(`  + ${components.dayOfWeekRisk}  ${dayDesc} appt`);
    }
    if (components.timeSlotRisk > 0) {
      lines.push(`  + ${components.timeSlotRisk}  Evening slot (5-7pm)`);
    }

    // Subtractions (bonuses)
    if (components.frequencyBonus < 0) {
      const freqDesc = components.frequencyBonus <= -10 ? '(every 3 wks)' : '(monthly)';
      lines.push(`  ${components.frequencyBonus}  Frequent booker ${freqDesc}`);
    }
    if (components.perfectRecordBonus < 0) {
      lines.push(`  ${components.perfectRecordBonus}  Perfect record (5+ appts)`);
    }

    // Calculate raw total for display
    const rawTotal = (components.historicalRate || 0) +
                     (components.recencyBoost || 0) +
                     (components.streakPenalty || 0) +
                     (components.dayOfWeekRisk || 0) +
                     (components.timeSlotRisk || 0) +
                     (components.frequencyBonus || 0) +
                     (components.perfectRecordBonus || 0);

    lines.push('───────────────────');
    if (rawTotal !== score) {
      lines.push(`  = ${rawTotal}% → ${score}% (min 10, max 85)`);
    } else {
      lines.push(`  = ${score}%`);
    }
  }

  return lines.join('\n');
}

// Single Appointment Row - Clean Excel-like styling
function AppointmentRow({ appointment, hideNames, showPrices, likelihoodMap }) {
  const daysStyle = getDaysSinceStyle(appointment.daysSinceLastAppointment);
  const shortService = abbreviateService(appointment.serviceName);
  const priceBadge = showPrices ? getReportAppointmentPriceBadge(appointment) : null;

  // Get likelihood data from map (using appointment.id) or from appointment directly
  const likelihoodData = likelihoodMap?.[appointment.id];
  const likelihood = likelihoodData?.score ?? likelihoodData ?? appointment.futureIssueLikelihood ?? 0;
  const components = likelihoodData?.components || null;
  const reason = likelihoodData?.reason || null;
  const likelihoodStyle = getLikelihoodStyle(likelihood);

  // Build enhanced tooltip with score breakdown
  const tooltip = buildRiskTooltip(likelihood, components, reason);

  return (
    <div
      className={`appointment-row ${hideNames ? 'hide-names' : ''}`}
      title={hideNames ? appointment.serviceName : `${titleCase(appointment.customerName)} - ${appointment.serviceName}`}
    >
      <span className="apt-time">{formatTime(appointment.appointmentTime)}</span>
      {!hideNames && (
        <span className="apt-customer">
          <span className="apt-customer-name">{titleCase(appointment.customerName)}</span>
          {likelihood > 0 && (
            <sup
              className="likelihood-pct"
              style={{ color: likelihoodStyle.dot }}
              data-tooltip={tooltip}
            >
              {likelihood}%
            </sup>
          )}
        </span>
      )}
      <span className="apt-service" title={appointment.serviceName}>{shortService}</span>
      <span className="apt-badges">
        <span
          className="apt-days"
          style={{
            backgroundColor: daysStyle.bg,
            color: daysStyle.text
          }}
        >
          {daysStyle.label}
        </span>
        {priceBadge && (
          <span className="apt-price" title={priceBadge.title}>
            {priceBadge.label}
          </span>
        )}
      </span>
    </div>
  );
}

export default Dashboard;
