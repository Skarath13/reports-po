/**
 * API Client for Reports Dashboard
 * Uses same-origin API routing so Cloudflare Workers can proxy /api to the current backend.
 */

const API_BASE = process.env.REACT_APP_API_URL || '/api/reports';

class ReportsAPIClient {
  constructor() {
    this.token = localStorage.getItem('reportToken');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('reportToken', token);
    } else {
      localStorage.removeItem('reportToken');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('reportToken');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.getToken()) {
      headers['x-report-token'] = this.getToken();
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Session expired');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
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

  // Locations
  async getLocations() {
    return this.request('/locations');
  }

  // Reports
  async getDailyReport(date, locationId) {
    return this.request(`/daily/${date}/${locationId}`);
  }

  async getManagerReport(date, locationId) {
    return this.request(`/manager/${date}/${locationId}`);
  }

  async getFullReport(date, locationId) {
    return this.request(`/full/${date}/${locationId}`);
  }

  // Get all appointments across all locations for a date (for cross-location duplicate detection)
  async getAllLocationAppointments(date) {
    return this.request(`/all-locations/${date}`);
  }
}

export const api = new ReportsAPIClient();
export default api;
