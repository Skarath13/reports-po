import { useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Bell,
  Moon,
  StickyNote,
  Sun,
  Users,
  Wrench,
  Copy,
} from 'lucide-react';
import { Button } from './ui/button';
import BrandLogo from './BrandLogo';
import PacificClock from './PacificClock';
import InterfaceSwitcher from './InterfaceSwitcher';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';

const navigation = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'calendar', label: 'Schedule', icon: CalendarDays },
  { key: 'notes', label: 'Client notes', icon: StickyNote },
  { key: 'potential-fixes', label: 'Potential fixes', icon: Wrench },
  { key: 'duplicates', label: 'Duplicate bookings', icon: Copy },
  { key: 'anyone-available', label: 'Anyone available', icon: Users },
  { key: 'staff-first-hour', label: 'First-hour gaps', icon: Sun },
];

export default function DashboardShell({
  user,
  onLogout,
  locations,
  location,
  onLocationChange,
  dateLabel,
  isToday,
  onToday,
  onTomorrow,
  syncLabel,
  refreshing,
  onRefresh,
  activeSection,
  onSectionChange,
  theme,
  onThemeChange,
  interfaceMode,
  onInterfaceChange,
  unreadSections = [],
  counts,
  sectionStates,
  reviewCount,
  reviewStatus,
  canViewAudit,
  onAudit,
  children,
}) {
  const isOld = interfaceMode === 'old';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const headingRef = useRef(null);
  const navigationPendingRef = useRef(false);
  const navigate = (key) => {
    onSectionChange(key);
    navigationPendingRef.current = menuOpen;
    setMenuOpen(false);
    if (!menuOpen) headingRef.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: 'instant' });
  };

  const sidebar = (
    <>
      <a
        className="workspace-brand"
        href="#report-main"
        onClick={(event) => {
          event.preventDefault();
          navigate('overview');
        }}
      >
        <BrandLogo className="workspace-logo" />
      </a>
      <div className="sidebar-body">
        <div className="sidebar-label">Workspace</div>
        <nav className="workspace-navigation" aria-label="Report sections">
          {navigation.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${activeSection === key ? 'active' : ''}`}
              aria-current={activeSection === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {unreadSections.includes(key) && (
                <span
                  className="nav-update-dot"
                  role="img"
                  aria-label={`Updates in ${label}`}
                  title="Items you have not yet reviewed"
                />
              )}
              {sectionStates[key]?.ready &&
              sectionStates[key]?.signedOff &&
              sectionStates[key]?.changedCount === 0 &&
              reviewStatus === 'ready' ? (
                <Check
                  size={13}
                  className="nav-reviewed"
                  aria-label="Review current"
                />
              ) : (
                counts[key] != null && (
                  <span className="nav-count">{counts[key]}</span>
                )
              )}
            </button>
          ))}
        </nav>
        <div
          className="sidebar-updates"
          aria-live="polite"
          aria-atomic="true"
        >
          {unreadSections.length > 0 && (
            <button onClick={() => navigate(unreadSections[0])}>
              <Bell size={16} />
              <span>
                <strong>
                  {unreadSections.length}{' '}
                  {unreadSections.length === 1
                    ? 'section updated'
                    : 'sections updated'}
                </strong>
                <small>View updates</small>
              </span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
        <div className="sidebar-review">
          <ClipboardCheck size={17} />
          <span>
            Section reviews
            <strong>
              {reviewStatus === 'ready'
                ? `${reviewCount} of 6 complete`
                : reviewStatus === 'error'
                  ? 'Status unavailable'
                  : 'Preparing status…'}
            </strong>
          </span>
          <div className="review-meter" aria-hidden="true">
            <span
              style={{
                width: `${reviewStatus === 'ready' ? (reviewCount / 6) * 100 : 0}%`,
              }}
            />
          </div>
          <small>
            {isToday
              ? 'For this location · today'
              : 'Tomorrow opens for sign-off on the day'}
          </small>
        </div>
      </div>
      <div className="sidebar-footer">
        <button
          className="sidebar-theme-toggle"
          role="switch"
          aria-checked={theme === 'light'}
          aria-label="Light mode"
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
          <span>Light mode</span>
          <span className="theme-switch-track" aria-hidden="true">
            <span />
          </span>
        </button>
        <a href="/monitoring" target="_blank" rel="noopener noreferrer">
          <Activity size={16} />
          System status
          <ArrowUpRight size={13} />
        </a>
        <div className="sidebar-user">
          <span className="user-avatar">
            {user?.username?.slice(0, 1).toUpperCase() || 'E'}
          </span>
          <span>
            {user?.username}
            <small>Reports access</small>
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Logout"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`report-dashboard ${isOld ? 'classic-interface' : ''}`}
      data-interface={interfaceMode}
    >
      <a className="skip-link" href="#report-main">
        Skip to report
      </a>
      <aside className="workspace-sidebar" hidden={isOld}>
        {sidebar}
      </aside>
      <Sheet open={!isOld && menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="mobile-sidebar"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (navigationPendingRef.current
              ? headingRef
              : menuRef
            ).current?.focus({ preventScroll: true });
            navigationPendingRef.current = false;
          }}
        >
          <SheetTitle className="sr-only">Report navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a report section.
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="workspace-main">
        <header className="report-header">
          {isOld && (
            <div className="classic-heading">
              <h1>{location?.name || 'Daily'} Reports</h1>
              <span>{dateLabel}</span>
              <PacificClock />
            </div>
          )}
          <div className="header-breadcrumb" hidden={isOld}>
            <Button
              ref={menuRef}
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label={
                unreadSections.length
                  ? `Open navigation, ${unreadSections.length} sections updated`
                  : 'Open navigation'
              }
            >
              <Menu />
              {unreadSections.length > 0 && (
                <span
                  className="mobile-update-dot nav-update-dot"
                  aria-hidden="true"
                />
              )}
              {unreadSections.length > 0 && (
                <span className="sr-only">
                  {unreadSections.length} sections updated
                </span>
              )}
            </Button>
            <span>Reports</span>
            <ChevronRight size={13} />
            <strong>{location?.name}</strong>
          </div>
          <div className="header-right">
            <InterfaceSwitcher
              value={interfaceMode}
              onChange={onInterfaceChange}
            />
            <span className="header-sync">
              {syncLabel ? `Synced ${syncLabel} PT` : 'Awaiting report'}
            </span>
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
              <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </Button>
            {canViewAudit && (
              <Button variant="ghost" onClick={onAudit}>
                <ShieldCheck size={15} />
                Audit
              </Button>
            )}
            {isOld && (
              <>
                <span className="classic-user">{user?.username}</span>
                <Button variant="outline" onClick={onLogout}>
                  <LogOut size={15} /> Logout
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="workspace-heading">
          <div hidden={isOld}>
            <span className="eyebrow">Daily operations</span>
            <h1 ref={headingRef} tabIndex={-1}>
              {activeSection === 'overview'
                ? 'Daily overview'
                : navigation.find((item) => item.key === activeSection)
                    ?.label}
            </h1>
            <p className="workspace-date-line">
              <span>{dateLabel}</span>
              {!isOld && <PacificClock />}
            </p>
          </div>
          {isOld && (
            <div className="classic-review-summary" role="status">
              <ClipboardCheck size={17} />
              <span>
                {reviewStatus === 'ready'
                  ? `${reviewCount} of 6 sections reviewed`
                  : reviewStatus === 'error'
                    ? 'Review status unavailable'
                    : 'Preparing review status…'}
              </span>
              {unreadSections.length > 0 && (
                <a href={`#report-section-${unreadSections[0]}`}>
                  {unreadSections.length}{' '}
                  {unreadSections.length === 1 ? 'section has' : 'sections have'} updates
                </a>
              )}
            </div>
          )}
          <div className="date-toggle" aria-label="Report date">
            <button
              className={isToday ? 'active' : ''}
              aria-pressed={isToday}
              onClick={onToday}
            >
              Today
            </button>
            <button
              className={!isToday ? 'active' : ''}
              aria-pressed={!isToday}
              onClick={onTomorrow}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <nav className="location-tabs" aria-label="Report location">
          {locations.map((item) => (
            <button
              key={item.id}
              className={`location-tab ${location?.id === item.id ? 'active' : ''}`}
              style={isOld ? { '--tab-color': item.color } : undefined}
              aria-pressed={location?.id === item.id}
              onClick={() => onLocationChange(item.id)}
            >
              <span className="location-selected-icon" aria-hidden="true">
                {location?.id === item.id ? <Check size={14} /> : <span />}
              </span>
              {item.name}
            </button>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
