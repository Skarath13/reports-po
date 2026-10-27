/**
 * API Client for Reports Dashboard
 * Uses same-origin API routing so Cloudflare Workers can proxy /api to the current backend.
 */

const API_BASE = process.env.REACT_APP_API_URL || '/api/reports';

class ReportsAPIClient {
  constructor() {
    this.token = localStorage.getItem('reportToken');
    this.viewSessionId = null;
    this.authEpoch = 0;
  }

  setToken(token) {
    this.authEpoch += 1;
    this.token = token;
    window.dispatchEvent(new CustomEvent('report-auth-changed'));
    if (token) {
      localStorage.setItem('reportToken', token);
    } else {
      localStorage.removeItem('reportToken');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('reportToken');
  }

  getViewSessionId() {
    if (this.viewSessionId) return this.viewSessionId;

    try {
      const stored = sessionStorage.getItem('reportsViewSession');
      if (stored) {
        this.viewSessionId = stored;
        return stored;
      }
    } catch (_error) {
      // Fall through to an in-memory session when sessionStorage is unavailable.
    }

    const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
    const generated = cryptoApi?.randomUUID
      ? cryptoApi.randomUUID()
      : `reports-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.viewSessionId = generated;
    try {
      sessionStorage.setItem('reportsViewSession', generated);
    } catch (_error) {
      // An in-memory session still deduplicates requests for this page lifetime.
    }

    return generated;
  }

  async request(endpoint, options = {}) {
    const authEpoch = this.authEpoch;
    const requestToken = this.getToken();
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (requestToken) {
      headers['x-report-token'] = requestToken;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (authEpoch !== this.authEpoch || requestToken !== this.getToken()) {
      const error = new Error('Reports session changed. Please try again.');
      error.code = 'AUTH_CONTEXT_CHANGED';
      throw error;
    }

    const accessRevoked = response.status === 403 && data?.code === 'REPORT_ACCESS_REVOKED';
    if (response.status === 401 || accessRevoked) {
      this.setToken(null);

      if (endpoint !== '/auth/login') {
        window.dispatchEvent(new CustomEvent('auth-expired', {
          detail: accessRevoked ? { message: data.error || 'Reports access is no longer available' } : null,
        }));
      }

      throw new Error(data?.error || data?.msg || 'Authentication failed');
    }

    if (!response.ok) {
      const error = new Error(data?.error || data?.msg || 'API request failed');
      error.code = data?.code || null;
      error.status = response.status;
      error.currentSnapshotHash = data?.currentSnapshotHash || null;
      throw error;
    }

    return data;
  }

  // Auth
  async login(pin) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    this.setToken(data.token);
    return data;
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  logout() {
    this.setToken(null);
  }

  // Reports
  async getFullReport(date, locationId, { signal } = {}) {
    return this.request(`/full/${date}/${locationId}`, {
      signal,
      headers: {
        'x-report-view-session': this.getViewSessionId(),
      },
    });
  }

  // Cheap fingerprint of the report's source rows (no audited view).
  async getReportVersion(date, locationId, { signal } = {}) {
    const result = await this.request(`/version/${date}/${locationId}`, { signal });
    return typeof result?.version === 'string' ? result.version : null;
  }

  async getAppointmentNoteHistory(date, locationId, appointmentId, { offset = 0, limit = 5 } = {}) {
    const query = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    return this.request(
      `/full/${date}/${locationId}/${encodeURIComponent(appointmentId)}/note-history?${query.toString()}`
    );
  }

  async getSectionReviews(date, locationId) {
    const query = new URLSearchParams({ date, locationId });
    return this.request(`/governance/sections?${query.toString()}`);
  }

  async submitSectionSignoff({ date, locationId, sectionKey, snapshotHash, requestId }) {
    return this.request('/governance/sections/signoffs', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: date,
        locationId,
        sectionKey,
        snapshotHash,
        requestId,
      }),
    });
  }

  async acknowledgeSectionEntry({
    date,
    locationId,
    sectionKey,
    snapshotHash,
    entryKey,
    contentVersion,
  }) {
    return this.request('/governance/sections/acknowledgements', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: date,
        locationId,
        sectionKey,
        snapshotHash,
        entryKey,
        contentVersion,
      }),
    });
  }

  async getAudit(date) {
    const query = new URLSearchParams({ date });
    return this.request(`/governance/audit?${query.toString()}`);
  }

  // Get all appointments across all locations for a date (for cross-location duplicate detection)
  async getAllLocationAppointments(date) {
    return this.request(`/all-locations/${date}`);
  }

  async getWeeklyDuplicateBookings(date, { signal } = {}) {
    return this.request(`/all-locations-week/${date}`, { signal });
  }
}

export const api = new ReportsAPIClient();
export default api;
