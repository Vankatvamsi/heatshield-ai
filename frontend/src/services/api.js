/**
 * HeatShield AI – Frontend API Service Client
 * Bridges React pages to the FastAPI backend API.
 * Uses Open-Meteo as the live weather data source and PostgreSQL backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || data.message || 'An error occurred on the server.');
      }
      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      throw error;
    }
  }

  // ── Auth ──
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async register(params) {
    // Accepts object or (name, email, password) for backwards compatibility
    const bodyData = typeof params === 'object' ? params : { name: arguments[0], email: arguments[1], password: arguments[2] };
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(bodyData),
    });
  }

  async getProfile() {
    return this.request('/profile');
  }

  logout() {
    this.setToken(null);
  }

  // ── Admin Management ──
  async getAdminRequests() {
    return this.request('/admin/requests');
  }

  async approveAdminRequest(requestId, token = null) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return this.request(`/admin/requests/${requestId}/approve${query}`, {
      method: 'POST',
    });
  }

  async rejectAdminRequest(requestId, token = null) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return this.request(`/admin/requests/${requestId}/reject${query}`, {
      method: 'POST',
    });
  }

  async getAdminUsers() {
    return this.request('/admin/users');
  }

  async getAdminList() {
    return this.request('/admin/admins');
  }

  // ── Heat-Health Profile & Personal Risk (Feature 8 & 11) ──
  async getHeatHealthProfile() {
    return this.request('/profile');
  }

  async updateHeatHealthProfile(profileData) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async getHealthSensitivities() {
    return this.request('/profile/health-sensitivity');
  }

  async updateHealthSensitivities(sensitivities) {
    return this.request('/profile/health-sensitivity', {
      method: 'PUT',
      body: JSON.stringify({ sensitivities }),
    });
  }

  async deleteHealthSensitivities() {
    return this.request('/profile/health-sensitivity', {
      method: 'DELETE',
    });
  }

  async assessPersonalRisk(params = {}) {
    return this.request('/personal-risk/assess', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async canGoOutside(params = {}) {
    return this.request('/personal-risk/can-go-out', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getPersonalPrecautions(params = {}) {
    return this.request('/personal-risk/precautions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ── Heat-Safe Route Planner & Journey Health Check (Feature 10) ──
  async planRoute(params) {
    return this.request('/routes/plan', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getJourneyDetails(journeyId) {
    return this.request(`/routes/${journeyId}`);
  }

  async startJourney(params) {
    return this.request('/journeys/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sendJourneyLocation(journeyId, latitude, longitude) {
    return this.request('/journeys/location', {
      method: 'POST',
      body: JSON.stringify({ journey_id: journeyId, latitude, longitude }),
    });
  }

  async completeJourney(journeyId) {
    return this.request(`/journeys/complete?journey_id=${journeyId}`, {
      method: 'POST',
    });
  }

  async submitJourneyFeedback(journeyId, feedbackLevel) {
    return this.request('/journeys/feedback', {
      method: 'POST',
      body: JSON.stringify({ journey_id: journeyId, feedback_level: feedbackLevel }),
    });
  }

  async getJourneyHistory(limit = 10) {
    return this.request(`/journeys/history?limit=${limit}`);
  }

  // ── Live Location Heat Protection (Feature 9) ──
  async startLiveProtection() {
    return this.request('/live-protection/start', {
      method: 'POST',
    });
  }

  async sendLiveLocation(latitude, longitude) {
    return this.request('/live-protection/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  async stopLiveProtection() {
    return this.request('/live-protection/stop', {
      method: 'POST',
    });
  }

  async getLiveProtectionStatus() {
    return this.request('/live-protection/status');
  }

  async getLiveProtectionHistory(limit = 10) {
    return this.request(`/live-protection/history?limit=${limit}`);
  }

  // ── Locations & Geocoding ──
  async getLocations() {
    return this.request('/locations');
  }

  async searchLocations(query) {
    return this.request(`/locations/search?q=${encodeURIComponent(query)}`);
  }

  async addLocation(locData) {
    return this.request('/locations', {
      method: 'POST',
      body: JSON.stringify(locData),
    });
  }

  // ── Weather ──
  async getCurrentWeather(city, lat, lon) {
    return this.request(`/weather/current?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`);
  }

  async getForecast(city, lat, lon) {
    return this.request(`/weather/forecast?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`);
  }

  // ── Risk & Warnings ──
  async getRiskMap() {
    return this.request('/risk/map');
  }

  async getHeatwavePrediction(params) {
    return this.request('/predict/heatwave', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getForecastPredictions(city, lat, lon) {
    return this.request(`/predict/forecast?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`);
  }

  async getThermalStress(params) {
    return this.request('/predict/thermal-stress', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ── Alerts ──
  async getAlerts(locationId = null) {
    const query = locationId ? `?location_id=${locationId}` : '';
    return this.request(`/alerts${query}`);
  }

  async acknowledgeAlert(alertId) {
    return this.request(`/alerts/${alertId}/acknowledge`, {
      method: 'PUT',
    });
  }

  async triggerAlertEvaluation(city, lat, lon) {
    return this.request(`/alerts/evaluate?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`, {
      method: 'POST',
    });
  }

  // ── UHI (Urban Heat Island) ──
  async getUhiHotspots(city, lat = 17.385, lon = 78.486) {
    return this.request(`/uhi/hotspots?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`);
  }

  async computeUhi(params) {
    const query = `urban_temp=${params.urbanTemp}&land_cover=${encodeURIComponent(params.landCover || 'CBD')}&vegetation_index=${params.vegetationIndex || 0.2}`;
    return this.request(`/uhi/compute?${query}`);
  }

  // ── Vulnerable Populations ──
  async getVulnerableRisk(city, lat, lon, category) {
    return this.request('/vulnerable/risk', {
      method: 'POST',
      body: JSON.stringify({ city, latitude: lat, longitude: lon, category }),
    });
  }

  async getVulnerableCategories() {
    return this.request('/vulnerable/categories');
  }

  // ── History ──
  async getHistory(city, start = null, end = null) {
    let query = `city=${encodeURIComponent(city)}`;
    if (start) query += `&start=${start}`;
    if (end) query += `&end=${end}`;
    return this.request(`/history?${query}`);
  }

  async getHistorySummary(city) {
    return this.request(`/history/summary?city=${encodeURIComponent(city)}`);
  }

  // ── Settings ──
  async getSettings() {
    return this.request('/settings/thresholds');
  }

  async updateSettings(thresholds) {
    return this.request('/settings/thresholds', {
      method: 'PUT',
      body: JSON.stringify({ thresholds }),
    });
  }

  async getAppMode() {
    return this.request('/settings/mode');
  }
}

export default new ApiClient();
