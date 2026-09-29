import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, ShieldAlert, Lock, Save, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function ThresholdSettings({ isAdmin, onRequireLogin }) {
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setThresholds(res.thresholds);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch threshold configs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setSaved(false);
    setError('');

    try {
      await api.updateSettings(thresholds);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    }
  };

  const handleNestedChange = (category, key, value) => {
    setThresholds(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: parseFloat(value) || 0
      }
    }));
  };

  if (loading) {
    return (
      <div className="text-slate-400 text-xs py-8 text-center">
        Retrieving threshold matrices...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-orange-500" />
          Neural Classification Thresholds Config
        </h2>
        <p className="text-xs text-slate-400">
          Modify mathematical cutoffs for early warnings, combined risk assessments, and UHI intensity scores
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Alerts and feedback */}
        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            <span className="font-semibold">Threshold configurations updated and re-hydrated on the API server.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {!isAdmin && (
          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-start space-x-3">
            <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Operator View Mode Only</span>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                You can inspect current classification bounds, but you must authenticate as an administrator to change parameters.
              </p>
              <button
                type="button"
                onClick={onRequireLogin}
                className="text-xs text-orange-400 font-semibold underline mt-2.5 hover:text-orange-300"
              >
                Sign In Now
              </button>
            </div>
          </div>
        )}

        {/* Configurations grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Heatwave Prob thresholds */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Heatwave Probability bounds (%)
            </h3>

            {Object.entries(thresholds.heatwave_probability || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize font-semibold text-slate-350">{key} Risk Trigger:</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={val}
                    onChange={(e) => handleNestedChange('heatwave_probability', key, e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs w-16 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Thermal stress thresholds */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Human Thermal Stress Bounds (HI Score)
            </h3>

            {Object.entries(thresholds.thermal_stress_score || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize font-semibold text-slate-350">{key} Category bound:</span>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={val}
                  onChange={(e) => handleNestedChange('thermal_stress_score', key, e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs w-16 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          {/* Raw Temperature thresholds */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Sensible Temperature Thresholds (°C)
            </h3>

            {Object.entries(thresholds.temperature_celsius || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize font-semibold text-slate-350">{key} Trigger boundary:</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={val}
                    onChange={(e) => handleNestedChange('temperature_celsius', key, e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs w-16 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <span className="text-slate-500">°C</span>
                </div>
              </div>
            ))}
          </div>

          {/* UHI Intensity Index */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Urban Heat Island Intensity Delta (°C)
            </h3>

            {Object.entries(thresholds.uhi_intensity || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize font-semibold text-slate-350">{key} UHI Delta:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">+</span>
                  <input
                    type="number"
                    step="0.1"
                    disabled={!isAdmin}
                    value={val}
                    onChange={(e) => handleNestedChange('uhi_intensity', key, e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs w-16 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <span className="text-slate-500">°C</span>
                </div>
              </div>
            ))}
          </div>

        </div>



      </form>

    </div>
  );
}
