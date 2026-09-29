import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  User, 
  Droplets, 
  Sun, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  Clock, 
  HeartHandshake, 
  X,
  Compass,
  ArrowUpRight,
  Sparkles,
  Shirt,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import HeatSafeSOS from './HeatSafeSOS';

export default function PersonalRiskCard({ location, user, onOpenProfile, onRequireLogin }) {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPrecautionsModal, setShowPrecautionsModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simActivity, setSimActivity] = useState('Heavy Physical Activity');
  const [simCategory, setSimCategory] = useState('Outdoor Worker');

  useEffect(() => {
    if (user) {
      fetchPersonalRisk();
    }
  }, [location, user]);

  // --- Login Gate ---
  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-[#0f172a] via-[#111c35] to-[#0d1527] p-8 flex flex-col items-center justify-center min-h-[260px] text-center shadow-2xl">
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full blur-3xl opacity-10 bg-orange-500 pointer-events-none" />
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl mb-5">
          <ShieldAlert className="h-10 w-10 text-orange-400" />
        </div>
        <h3 className="text-xl font-black text-white tracking-tight mb-2">
          Personalized Heat-Health Assessment
        </h3>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
          Sign in to get your personalised heat risk score calculated from your age, vulnerability, activity level and water access — using live Open-Meteo weather.
        </p>
        <button
          onClick={onRequireLogin}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-950/40 transition-all flex items-center gap-2 hover:scale-[1.02]"
        >
          <User className="h-4 w-4" />
          Login to View Your Personal Risk
        </button>
        <p className="text-[11px] text-slate-500 mt-4">
          Your data is stored securely. No demo or synthetic values are used.
        </p>
      </div>
    );
  }

  const fetchPersonalRisk = async (overrides = null) => {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        city: location?.city || location?.name || 'Hyderabad',
        latitude: location?.latitude || 17.385,
        longitude: location?.longitude || 78.486,
        ...(overrides || {})
      };

      const res = await api.assessPersonalRisk(payload);
      setRiskData(res);
    } catch (err) {
      console.error("Personal risk assessment error:", err);
      setError(err.message || "Unable to compute personalized heat risk with live Open-Meteo weather.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = (cat, act) => {
    setSimCategory(cat);
    setSimActivity(act);
    setIsSimulating(true);
    fetchPersonalRisk({
      vulnerability_category: cat,
      activity_level: act
    });
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    fetchPersonalRisk();
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'EXTREME': return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        badge: 'bg-red-500 text-white',
        glow: 'shadow-red-500/20'
      };
      case 'HIGH': return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        badge: 'bg-orange-500 text-white',
        glow: 'shadow-orange-500/20'
      };
      case 'MODERATE': return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        badge: 'bg-amber-500 text-slate-900',
        glow: 'shadow-amber-500/20'
      };
      default: return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        badge: 'bg-emerald-500 text-slate-900',
        glow: 'shadow-emerald-500/20'
      };
    }
  };

  if (loading && !riskData) {
    return (
      <div className="bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative">
          <Sun className="h-10 w-10 text-orange-500 animate-spin" />
          <Activity className="h-5 w-5 text-amber-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-300">
          Calculating Personalized Heat Risk with Live Open-Meteo Weather...
        </p>
      </div>
    );
  }

  if (error && !riskData) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-3xl">
        <div className="flex items-center space-x-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          <span>Live Personal Risk Calculation Notice</span>
        </div>
        <p className="mt-2 text-xs text-slate-300">{error}</p>
        <button 
          onClick={() => fetchPersonalRisk()}
          className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl text-white font-medium flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const colors = getRiskColor(riskData?.personal_risk_level);
  const score = riskData?.personal_risk_score || 0;
  const canGoOut = riskData?.can_go_outside;

  return (
    <div className="space-y-5">
      {/* ── Main Personal Risk Card ────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-3xl border ${colors.border} bg-gradient-to-br from-[#0f172a] via-[#111c35] to-[#0d1527] p-6 lg:p-7 shadow-2xl ${colors.glow}`}>
        
        {/* Glow Ambient Effect */}
        <div className={`absolute -right-16 -top-16 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none ${colors.bg}`} />

        {/* Header with Title and Profile summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-2xl ${colors.bg} border ${colors.border} shadow-inner`}>
              <ShieldAlert className={`h-6 w-6 ${colors.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  Personalized Heat-Health Assessment
                </h3>
                {isSimulating && (
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Simulation Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic risk synthesis from Open-Meteo live weather + your vulnerability profile
              </p>
            </div>
          </div>

          {/* Profile Quick Pill / Action */}
          <div className="flex items-center gap-2">
            <HeatSafeSOS 
              user={user}
              currentTemp={riskData?.weather_summary?.temperature}
              currentHumidity={riskData?.weather_summary?.humidity}
              currentRiskLevel={riskData?.personal_risk_level}
              currentThermalStress={riskData?.thermal_stress_score}
            />
            <button
              onClick={onOpenProfile}
              className="px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              title="Edit your Heat-Health Profile"
            >
              <User className="h-3.5 w-3.5 text-orange-400" />
              <span>Edit Profile</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            </button>

            {isSimulating && (
              <button
                onClick={handleResetSimulation}
                className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 border border-purple-700/60 rounded-xl text-xs font-semibold transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Profile Attributes Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Vulnerability</span>
            <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5">
              {riskData?.profile_summary?.vulnerability_category || 'General Population'}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Age Group</span>
            <span className="text-xs font-semibold text-slate-200 block mt-0.5">
              {riskData?.profile_summary?.age_group || '18–44'}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Activity Level</span>
            <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5">
              {riskData?.profile_summary?.activity_level || 'Mostly Indoor'}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Water Access</span>
            <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5">
              {riskData?.profile_summary?.water_access || 'Always available'}
            </span>
          </div>
        </div>

        {/* Score & Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Left: Score Gauge & Risk Badge */}
          <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  HeatShield Personal Risk
                </span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${colors.badge}`}>
                  {riskData?.personal_risk_level} RISK
                </span>
              </div>

              {/* Huge Number */}
              <div className="flex items-baseline space-x-2 mt-4">
                <span className={`text-5xl font-black tracking-tight ${colors.text}`}>
                  {score.toFixed(0)}
                </span>
                <span className="text-slate-500 font-bold text-lg">/ 100</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-3 mt-3 overflow-hidden p-0.5 border border-slate-700/60">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    riskData?.personal_risk_level === 'EXTREME' ? 'bg-gradient-to-r from-orange-500 to-red-600' :
                    riskData?.personal_risk_level === 'HIGH' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                    riskData?.personal_risk_level === 'MODERATE' ? 'bg-gradient-to-r from-emerald-500 to-amber-500' :
                    'bg-gradient-to-r from-teal-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
                />
              </div>
            </div>

            {/* Environmental Signals Sub-row */}
            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800/80 text-center">
              <div>
                <span className="text-[10px] text-slate-500 block font-medium">Live Temp</span>
                <strong className="text-xs font-bold text-slate-200">
                  {riskData?.weather_summary?.temperature?.toFixed(1) || '--'}°C
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-medium">Thermal Stress</span>
                <strong className="text-xs font-bold text-orange-400">
                  {riskData?.thermal_stress_score?.toFixed(0) || '--'}/100
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-medium">Heatwave Prob</span>
                <strong className="text-xs font-bold text-red-400">
                  {riskData?.heatwave_probability?.toFixed(0) || '0'}%
                </strong>
              </div>
            </div>
          </div>

          {/* Right: "CAN I GO OUT NOW?" Decision Card */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900/90 rounded-2xl border border-slate-800 p-5">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <Compass className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Can I Go Outside Now?
                  </span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${colors.border} ${colors.bg} ${colors.text}`}>
                  {canGoOut?.badge}
                </span>
              </div>

              <div className="mt-4">
                <h4 className="text-base font-extrabold text-white">
                  {canGoOut?.title}
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {canGoOut?.message}
                </p>
              </div>

              {/* Dynamic Context Recommendation */}
              <div className="mt-3.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                <strong className="text-slate-300 font-semibold block mb-0.5">Recommendation:</strong>
                {riskData?.recommendation}
              </div>
            </div>

            {/* "I MUST GO OUT" Button */}
            <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400">
                Need to travel or work outdoors?
              </span>

              <button
                onClick={() => setShowPrecautionsModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-950/40 transition-all flex items-center space-x-1.5 hover:scale-[1.02]"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>I MUST GO OUT — View Precautions</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── "Why is my risk high?" Contributing Factors ─────────────────────── */}
        <div className="mt-5 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-3">
            <Info className="h-4 w-4 text-orange-400" />
            Why is my risk assessed at this level? (Actual Contributing Factors)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {riskData?.main_risk_factors?.map((factor, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300 bg-slate-900/60 border border-slate-800 px-3 py-2 rounded-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── What-If Scenario Simulator Quick Bar ────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-semibold text-slate-300">Quick Profile Simulation:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSimulate('Outdoor Worker', 'Heavy Physical Activity')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                isSimulating && simCategory === 'Outdoor Worker'
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              Outdoor Worker (Heavy Activity)
            </button>

            <button
              onClick={() => handleSimulate('Elderly', 'Light Outdoor Activity')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                isSimulating && simCategory === 'Elderly'
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              Elderly (Light Outdoor)
            </button>

            <button
              onClick={() => handleSimulate('General Population', 'Mostly Indoor')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                isSimulating && simCategory === 'General Population'
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              General (Indoor)
            </button>
          </div>
        </div>

        {/* Medical Disclaimer */}
        <div className="mt-4 text-[10px] text-slate-500 italic flex items-center gap-1.5 border-t border-slate-800/40 pt-3">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>{riskData?.disclaimer}</span>
        </div>
      </div>

      {/* ── "I MUST GO OUT" Precautions Modal ───────────────────────────────── */}
      {showPrecautionsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-[#0d1527] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-tr from-orange-500 to-red-600 p-2.5 rounded-2xl text-white shadow-lg">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Personalized Heat-Safety Precautions
                  </h3>
                  <p className="text-xs text-orange-400 font-semibold">
                    Tailored for: {riskData?.profile_summary?.vulnerability_category} • {riskData?.personal_risk_level} Risk Level
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPrecautionsModal(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body with Precautions list */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300 leading-relaxed">
                <strong>Important Notice:</strong> Environmental conditions are currently elevated ({riskData?.weather_summary?.temperature?.toFixed(1)}°C with {riskData?.weather_summary?.humidity?.toFixed(0)}% humidity). If you must venture outdoors, observe the following safety instructions strictly.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {riskData?.precautions?.map((item, idx) => (
                  <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-slate-100">{item.title}</h5>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>

              {/* Medical Disclaimer inside modal */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-[11px] text-slate-500 italic">
                {riskData?.disclaimer}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#0d1527] flex justify-end">
              <button
                onClick={() => setShowPrecautionsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Close Precautions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
