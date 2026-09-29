import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  ShieldAlert, 
  MapPin, 
  Droplets, 
  Activity, 
  Bell, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Search, 
  Sun, 
  Globe, 
  HeartHandshake,
  Sparkles
} from 'lucide-react';
import api from '../services/api';

export default function HeatHealthProfile({ user, onProfileUpdated, onRequireLogin }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [ageGroup, setAgeGroup] = useState('18-44');
  const [vulnerabilityCategory, setVulnerabilityCategory] = useState('General Population');
  const [activityLevel, setActivityLevel] = useState('Mostly Indoor');
  const [waterAccess, setWaterAccess] = useState('Always available');
  const [heatSensitivity, setHeatSensitivity] = useState('No');
  const [alertThreshold, setAlertThreshold] = useState('High and Extreme');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  // Feature 11 state
  const [selectedSensitivities, setSelectedSensitivities] = useState([]);

  // Location search
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchSensitivities();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getHeatHealthProfile();
      setProfile(res);
      setAgeGroup(res.age_group || '18-44');
      setVulnerabilityCategory(res.vulnerability_category || 'General Population');
      setActivityLevel(res.activity_level || 'Mostly Indoor');
      setWaterAccess(res.water_access || 'Always available');
      setHeatSensitivity(res.heat_sensitivity || 'No');
      setAlertThreshold(res.alert_threshold || 'High and Extreme');
      setAlertsEnabled(res.alerts_enabled ?? true);
      setSelectedLocationId(res.default_location_id);
      if (res.default_location) {
        setSelectedLocationName(`${res.default_location.name} (${res.default_location.city || res.default_location.name})`);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSensitivities = async () => {
    try {
      const res = await api.getHealthSensitivities();
      if (res && Array.isArray(res.sensitivities)) {
        setSelectedSensitivities(res.sensitivities);
      }
    } catch (err) {
      console.error("Error loading health sensitivities:", err);
    }
  };

  const handleToggleSensitivity = (option) => {
    if (option === "None" || option === "Prefer not to say") {
      setSelectedSensitivities([option]);
      return;
    }

    setSelectedSensitivities((prev) => {
      const filtered = prev.filter((o) => o !== "None" && o !== "Prefer not to say");
      if (filtered.includes(option)) {
        return filtered.filter((o) => o !== option);
      } else {
        return [...filtered, option];
      }
    });
  };

  const handleClearSensitivities = async () => {
    try {
      await api.deleteHealthSensitivities();
      setSelectedSensitivities([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchLocation = async (e) => {
    const query = e.target.value;
    setLocationSearch(query);
    if (query.trim().length >= 2) {
      setIsSearching(true);
      setShowLocationDropdown(true);
      try {
        const res = await api.searchLocations(query);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowLocationDropdown(false);
    }
  };

  const handleSelectLocation = async (locResult) => {
    try {
      const added = await api.addLocation({
        name: locResult.name,
        latitude: locResult.latitude,
        longitude: locResult.longitude,
        city: locResult.name,
        state: locResult.admin1 || '',
        country: locResult.country || 'India',
        timezone: locResult.timezone || '',
      });
      const locId = added.location?.id || added.id;
      setSelectedLocationId(locId);
      setSelectedLocationName(`${locResult.name}, ${locResult.country || ''}`);
      setShowLocationDropdown(false);
      setLocationSearch('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const hasSens = selectedSensitivities.length > 0 && !selectedSensitivities.includes("None") && !selectedSensitivities.includes("Prefer not to say");

      const payload = {
        age_group: ageGroup,
        vulnerability_category: vulnerabilityCategory,
        activity_level: activityLevel,
        water_access: waterAccess,
        heat_sensitivity: hasSens ? "Yes" : heatSensitivity,
        default_location_id: selectedLocationId,
        alert_threshold: alertThreshold,
        alerts_enabled: alertsEnabled,
      };

      const [updated] = await Promise.all([
        api.updateHeatHealthProfile(payload),
        api.updateHealthSensitivities(selectedSensitivities),
      ]);

      setProfile(updated);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated(updated);

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Save profile error:", err);
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto bg-[#0f172a] border border-slate-800 rounded-3xl p-8 text-center space-y-4">
        <div className="p-4 bg-orange-500/10 text-orange-400 rounded-full inline-block">
          <User className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold text-white">Heat-Health Profile</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Please log in or create an account to configure your personalized Heat-Health risk profile and safety preferences.
        </p>
        <button
          onClick={onRequireLogin}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
        >
          Sign In to Access Profile
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <Sun className="h-8 w-8 text-orange-500 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Loading your Heat-Health Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <User className="h-7 w-7 text-orange-500" />
            My Heat-Health Profile
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personalize your vulnerability parameters to receive tailored early heat warnings and precautions.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>Profile Saved & Risk Engine Updated!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Profile Form ────────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Card 1: Age & Vulnerability Group */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Activity className="h-4 w-4 text-orange-400" />
            1. Population & Vulnerability Factors
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Age Group */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Age Group
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="Under 5">Under 5</option>
                <option value="5–17">5–17</option>
                <option value="18-44">18–44</option>
                <option value="45-64">45–64</option>
                <option value="65+">65+</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Why we ask: Used to estimate thermoregulatory sensitivity without storing exact date of birth.
              </span>
            </div>

            {/* Vulnerability Category */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Vulnerability Category
              </label>
              <select
                value={vulnerabilityCategory}
                onChange={(e) => setVulnerabilityCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="General Population">General Population</option>
                <option value="Child">Child</option>
                <option value="Elderly">Elderly</option>
                <option value="Outdoor Worker">Outdoor Worker</option>
                <option value="Athlete">Athlete / Outdoor Exerciser</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Why we ask: Outdoor workers and athletes have significantly higher direct heat exposure.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Activity & Hydration Environment */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Droplets className="h-4 w-4 text-orange-400" />
            2. Daily Activity & Hydration Access
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Activity Level */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Physical Activity Level
              </label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="Mostly Indoor">Mostly Indoor</option>
                <option value="Light Outdoor Activity">Light Outdoor Activity</option>
                <option value="Moderate Physical Activity">Moderate Physical Activity</option>
                <option value="Heavy Physical Activity">Heavy Physical Activity</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Why we ask: Heavy physical activity increases internal metabolic heat production.
              </span>
            </div>

            {/* Drinking Water Access */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Drinking Water Access
              </label>
              <select
                value={waterAccess}
                onChange={(e) => setWaterAccess(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="Always available">Always available</option>
                <option value="Sometimes available">Sometimes available</option>
                <option value="Usually unavailable">Usually unavailable</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Why we ask: Informs personalized hydration and rest-break precautions.
              </span>
            </div>
          </div>

          {/* Optional Heat-Sensitivity Broad Question */}
          <div className="border-t border-slate-800/80 pt-4">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Do you have any personal health factors that may make you more sensitive to heat? (Optional)
            </label>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
              {['Yes', 'No', 'Prefer not to say'].map((opt) => (
                <label key={opt} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="heatSensitivity"
                    value={opt}
                    checked={heatSensitivity === opt}
                    onChange={(e) => setHeatSensitivity(e.target.value)}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 mt-1.5 block">
              Note: Your health information is optional. HeatShield AI provides safety guidance and does not diagnose medical conditions.
            </span>
          </div>
        </div>

        {/* Card 3: Default Location & Alert Preferences */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <MapPin className="h-4 w-4 text-orange-400" />
            3. Default Location & Alert Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Default Location Search */}
            <div className="relative" ref={locationDropdownRef}>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Default Home / Work Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={locationSearch || selectedLocationName}
                  onChange={handleSearchLocation}
                  placeholder="Search city (e.g. Hyderabad, Delhi)..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {isSearching && (
                  <Sun className="h-4 w-4 text-orange-500 animate-spin absolute right-3 top-2.5" />
                )}
              </div>

              {/* Geocoding Results Dropdown */}
              {showLocationDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-200 border-b border-slate-800/50 flex items-center justify-between"
                    >
                      <span className="font-semibold">{r.name}, {r.admin1 || ''} ({r.country})</span>
                      <span className="text-[10px] text-slate-500 font-mono">{r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Alert Threshold */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Heat Alert Severity Threshold
              </label>
              <select
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="High and Extreme">High and Extreme (Recommended)</option>
                <option value="Extreme only">Extreme only</option>
              </select>
            </div>
          </div>

          {/* Toggle Heat Alerts */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
            <div>
              <span className="text-xs font-bold text-slate-200 block">Enable Automated Heat Alerts</span>
              <span className="text-[11px] text-slate-500 block">
                Receive proactive warnings when temperatures and thermal stress surpass your configured threshold.
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>

        {/* Card 3: Feature 11 - Health & Heat Sensitivity (Optional) */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-orange-400" />
              3. Health &amp; Heat Sensitivity (Optional)
            </h3>
            <span className="text-[10px] uppercase font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
              Optional Safety Context
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-300">
              <Info className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Why this is asked:</strong> This information is optional and is used only to personalize heat-safety guidance and provide conservative precautions during high thermal stress. HeatShield AI does not diagnose or treat medical conditions.
              </p>
            </div>
            <p className="text-[11px] text-slate-500 italic pl-6">
              Do you have any health conditions or heat sensitivities that may require extra caution during extreme heat?
            </p>
          </div>

          {/* Checkboxes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Migraine / heat-triggered headaches",
              "Previous heat-related illness",
              "Heat sensitivity / heat intolerance",
              "Respiratory condition",
              "Cardiovascular/heart condition",
              "Diabetes",
              "Kidney-related condition",
              "Other",
              "None",
              "Prefer not to say",
            ].map((option) => {
              const isChecked = selectedSensitivities.includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-start space-x-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-orange-500/10 border-orange-500/40 text-orange-300'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleSensitivity(option)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-800"
                  />
                  <span className="text-xs font-semibold leading-snug">{option}</span>
                </label>
              );
            })}
          </div>

          {selectedSensitivities.length > 0 && !selectedSensitivities.includes("None") && !selectedSensitivities.includes("Prefer not to say") && (
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-slate-400">
                {selectedSensitivities.length} condition{selectedSensitivities.length > 1 ? 's' : ''} selected for safety adjustments.
              </span>
              <button
                type="button"
                onClick={handleClearSensitivities}
                className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
              >
                Clear all sensitivities
              </button>
            </div>
          )}
        </div>

        {/* ── Save Action Button ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-slate-500 italic max-w-xl">
            HeatShield AI provides general heat-risk and safety guidance based on environmental conditions and the information you provide. It is not a medical diagnostic system and does not replace professional medical advice.
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-orange-950/40 transition-all flex items-center space-x-2 shrink-0 hover:scale-[1.02]"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
