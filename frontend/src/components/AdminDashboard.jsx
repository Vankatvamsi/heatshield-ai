import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Bell,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Activity,
  Sun,
  Database,
  Radio,
  SlidersHorizontal,
  Flame,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';

export default function AdminDashboard({ user }) {
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [locRes, alertsRes] = await Promise.all([
        api.getLocations(),
        api.getAlerts(),
      ]);

      setLocations(locRes || []);
      setAlerts(alertsRes.data || []);

      // Try fetching user list count if admin permission allows
      try {
        const uRes = await api.getAdminUsers();
        setUsersCount(uRes.total || uRes.data?.length || 0);
      } catch (e) {
        setUsersCount(1);
      }
    } catch (err) {
      console.error("Admin data load error:", err);
      setError(err.message || "Failed to load administrative telemetry data.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualWeatherSync = async () => {
    try {
      setRefreshing(true);
      if (locations.length > 0) {
        const first = locations[0];
        await api.getCurrentWeather(first.city || first.name, first.latitude, first.longitude);
      }
      await loadAdminData();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <Sun className="h-8 w-8 text-orange-500 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Loading Admin Dashboard Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Admin Banner ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-[#111e38] to-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-950/40 text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Administrator Control Panel</h2>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-[10px] font-black uppercase">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Welcome back, {user?.name || 'Administrator'}. Monitor real-time environmental pipelines and regional alert thresholds.
            </p>
          </div>
        </div>

        <button
          onClick={handleManualWeatherSync}
          disabled={refreshing}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700 transition-all flex items-center space-x-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Trigger Live Open-Meteo Sync</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex items-center space-x-4 shadow-xl">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Weather Source</span>
            <span className="text-sm font-black text-slate-100 block mt-0.5">Open-Meteo Live</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Free API (No key required)</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex items-center space-x-4 shadow-xl">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Database Engine</span>
            <span className="text-sm font-black text-slate-100 block mt-0.5">PostgreSQL</span>
            <span className="text-[10px] text-cyan-400 font-semibold">15-min background job</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex items-center space-x-4 shadow-xl">
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Monitored Locations</span>
            <span className="text-sm font-black text-slate-100 block mt-0.5">{locations.length} Cities</span>
            <span className="text-[10px] text-slate-400 font-semibold">Dynamic Geocoding enabled</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex items-center space-x-4 shadow-xl">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Heat Alerts</span>
            <span className="text-sm font-black text-slate-100 block mt-0.5">{alerts.length} Warnings</span>
            <span className="text-[10px] text-slate-400 font-semibold">Deduplicated PostgreSQL storage</span>
          </div>
        </div>
      </div>

      {/* ── Monitored Locations Table ────────────────────────────────────────── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-400" />
            Monitored Regional Locations ({locations.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Open-Meteo Live Pipeline</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                <th className="pb-3">Location Name</th>
                <th className="pb-3">State / Country</th>
                <th className="pb-3">Coordinates</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-200">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-900/50">
                  <td className="py-3 text-slate-100 font-extrabold">{loc.name}</td>
                  <td className="py-3 text-slate-400">{loc.state || loc.city}, {loc.country || 'India'}</td>
                  <td className="py-3 font-mono text-[11px] text-slate-400">
                    {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE MONITORED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
