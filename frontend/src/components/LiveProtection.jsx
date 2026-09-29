import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  RefreshCw,
  Sun,
  Flame,
  Droplets,
  Compass,
  History,
  Lock,
  CheckCircle2,
  Info,
  Play,
  Square,
  Volume2,
  BellRing
} from 'lucide-react';
import HeatSafeSOS from './HeatSafeSOS';
import api from '../services/api';

export default function LiveProtection({ user, onRequireLogin, onLocationUpdate, onStopProtection }) {
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt'); // prompt, granted, denied
  const [activeAlert, setActiveAlert] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const watchIdRef = useRef(null);
  const lastSentTimeRef = useRef(0);
  const lastSentCoordsRef = useRef(null);

  useEffect(() => {
    if (user) {
      checkInitialStatus();
      loadHistory();
    }

    return () => {
      stopBrowserTracking();
    };
  }, [user]);

  const checkInitialStatus = async () => {
    try {
      const statusRes = await api.getLiveProtectionStatus();
      if (statusRes.active) {
        setIsActive(true);
        setSessionId(statusRes.session_id);
        if (statusRes.last_location) {
          setCurrentCoords({
            latitude: statusRes.last_location.latitude,
            longitude: statusRes.last_location.longitude,
          });
        }
        startBrowserTracking();
      }
    } catch (err) {
      console.log("No active session:", err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getLiveProtectionHistory(5);
      setHistory(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const startBrowserTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    stopBrowserTracking();

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      options
    );
  };

  const stopBrowserTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleLocationSuccess = async (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    setCurrentCoords({ latitude, longitude, accuracy });
    setPermissionState('granted');

    if (onLocationUpdate) {
      onLocationUpdate({ latitude, longitude, accuracy });
    }

    // Rate-limit coordinates sent to backend (at least 15s between sends or > 200m movement)
    const now = Date.now();
    const lastTime = lastSentTimeRef.current;
    const lastCoords = lastSentCoordsRef.current;

    let shouldSend = false;
    if (now - lastTime > 15000) {
      shouldSend = true;
    } else if (lastCoords) {
      const dist = Math.hypot(latitude - lastCoords.latitude, longitude - lastCoords.longitude) * 111000;
      if (dist > 200) shouldSend = true;
    } else {
      shouldSend = true;
    }

    if (shouldSend) {
      lastSentTimeRef.current = now;
      lastSentCoordsRef.current = { latitude, longitude };
      await sendCoordinatesToBackend(latitude, longitude);
    }
  };

  const handleLocationError = (err) => {
    console.error("Geolocation error:", err);
    setPermissionState('denied');
    if (err.code === 1) {
      setError("Location permission was denied. Please allow location access in your browser settings to enable live protection.");
    } else if (err.code === 2) {
      setError("Position unavailable. Ensure your device GPS / location services are active.");
    } else {
      setError(`Location error: ${err.message}`);
    }
  };

  const sendCoordinatesToBackend = async (lat, lon) => {
    try {
      setLoading(true);
      const res = await api.sendLiveLocation(lat, lon);
      if (res.status === 'ok') {
        setLiveData(res.data);

        // Check if risk escalation occurred
        if (res.data.escalation_detected && res.data.alert) {
          setActiveAlert(res.data.alert);
        }
      }
    } catch (err) {
      console.error("Error sending coordinates:", err);
      setError(err.message || "Failed to process live location with Open-Meteo weather service.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartProtection = async () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setError(null);
    setShowPrivacyModal(true);
  };

  const confirmStartProtection = async () => {
    setShowPrivacyModal(false);
    try {
      setLoading(true);
      setError(null);
      const res = await api.startLiveProtection();
      setSessionId(res.session_id);
      setIsActive(true);
      startBrowserTracking();
    } catch (err) {
      console.error("Start protection error:", err);
      setError(err.message || "Failed to initiate live heat protection session.");
    } finally {
      setLoading(false);
    }
  };

  const handleStopProtection = async () => {
    try {
      setLoading(true);
      stopBrowserTracking();
      await api.stopLiveProtection();
      setIsActive(false);
      setSessionId(null);
      setLiveData(null);
      setActiveAlert(null);
      loadHistory();
      if (onStopProtection) onStopProtection();
    } catch (err) {
      console.error("Stop protection error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'EXTREME': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', badge: 'bg-red-500' };
      case 'HIGH': return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', badge: 'bg-orange-500' };
      case 'MODERATE': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', badge: 'bg-amber-500' };
      default: return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', badge: 'bg-emerald-500' };
    }
  };

  const currentLevel = liveData?.assessment?.personal_risk_level || 'LOW';
  const riskColors = getRiskColor(currentLevel);

  return (
    <div className="space-y-6">

      {/* ── Active Escalation Alert Banner ─────────────────────────────────── */}
      {activeAlert && (
        <div className="bg-gradient-to-r from-red-600/90 via-orange-600/90 to-red-700/90 border border-red-400 text-white p-5 rounded-3xl shadow-2xl shadow-red-950/60 animate-bounce">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-2xl">
                <BellRing className="h-6 w-6 text-white animate-spin" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest bg-white/20 px-2 py-0.5 rounded">
                  Live Heat Escalation Detected
                </span>
                <h4 className="text-base font-black mt-1">
                  {activeAlert.alert_level} HEAT RISK WARNING AT YOUR CURRENT LOCATION
                </h4>
                <p className="text-xs text-white/90 mt-1 leading-relaxed max-w-2xl">
                  {activeAlert.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveAlert(null)}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Live Protection Master Control Card ────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#111e38] to-[#0d172e] border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">

        {/* Radar Background Glow */}
        {isActive && (
          <div className="absolute right-0 top-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800/80 pb-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3.5 rounded-2xl relative ${isActive
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-900/40 text-white ring-2 ring-emerald-400/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
              <Radio className={`h-7 w-7 ${isActive ? 'animate-pulse' : ''}`} />
              {isActive && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-black text-white tracking-tight">
                  Live Location Heat Protection
                </h3>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                  {isActive ? 'ACTIVE TRACKING' : 'INACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Monitors real-time coordinates, requests live Open-Meteo weather, and triggers instant alerts upon risk escalation.
              </p>
            </div>
          </div>

          {/* Toggle Control Button & SOS */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {isActive ? (
              <button
                onClick={handleStopProtection}
                disabled={loading}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl shadow-xl shadow-red-950/50 transition-all flex items-center space-x-2 hover:scale-[1.02]"
              >
                <Square className="h-4 w-4 fill-white" />
                <span>STOP LIVE PROTECTION</span>
              </button>
            ) : (
              <button
                onClick={handleStartProtection}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-xs rounded-2xl shadow-xl shadow-orange-950/50 transition-all flex items-center space-x-2 hover:scale-[1.02]"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>START LIVE HEAT PROTECTION</span>
              </button>
            )}
            {/* HeatSafe SOS Button */}
            <HeatSafeSOS
              user={user}
              currentTemp={liveData?.weather?.temperature}
              currentHumidity={liveData?.weather?.humidity}
              currentRiskLevel={liveData?.assessment?.personal_risk_level}
              currentThermalStress={liveData?.assessment?.thermal_stress_score}
            />
          </div>
        </div>

        {/* Live Telemetry Display */}
        {isActive ? (
          <div className="mt-6 space-y-6">

            {/* GPS & Sensor Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Current GPS Coordinates</span>
                  <span className="text-xs font-mono font-bold text-slate-200 block mt-0.5">
                    {currentCoords
                      ? `${currentCoords.latitude.toFixed(4)}°, ${currentCoords.longitude.toFixed(4)}°`
                      : 'Acquiring GPS fix...'}
                  </span>
                  {currentCoords?.accuracy && (
                    <span className="text-[10px] text-slate-500 font-mono">Accuracy: ±{currentCoords.accuracy.toFixed(0)}m</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Live Local Temperature</span>
                  <span className="text-xs font-bold text-slate-200 block mt-0.5">
                    {liveData?.weather?.temperature ? `${liveData.weather.temperature.toFixed(1)}°C` : 'Querying Open-Meteo...'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Humidity: {liveData?.weather?.humidity || '--'}%</span>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${riskColors.bg} ${riskColors.text}`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Personal Risk Level</span>
                  <span className={`text-xs font-black uppercase block mt-0.5 ${riskColors.text}`}>
                    {currentLevel} RISK ({liveData?.assessment?.personal_risk_score?.toFixed(0) || '--'}/100)
                  </span>
                  <span className="text-[10px] text-slate-500">Thermal Stress: {liveData?.assessment?.thermal_stress_score?.toFixed(0) || '--'}</span>
                </div>
              </div>
            </div>

            {/* Live Recommendation & Escalation Watch */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Continuous Location Safety Monitoring
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {liveData?.assessment?.recommendation || 'HeatShield AI is continuously tracking your location and will alert you if heat risk escalates.'}
                </p>
              </div>

              <div className="text-[11px] text-slate-500 font-mono shrink-0">
                Last Evaluated: {liveData?.timestamp ? new Date(liveData.timestamp).toLocaleTimeString() : 'Now'}
              </div>
            </div>
          </div>
        ) : (
          /* Inactive State Banner */
          <div className="mt-6 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 text-center space-y-3">
            <div className="inline-flex p-3 bg-slate-800/80 rounded-full text-slate-400">
              <Compass className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-200">
              Live Location Protection is Currently Inactive
            </h4>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              When traveling, exercising, or working outdoors, start live protection to receive real-time heat alerts tailored to your exact coordinates.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Privacy & Limitations Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span>Private Location: GPS coordinates are never made public or shared.</span>
          </div>
          <span className="italic">
            Note: Live tracking functions while the browser application is active.
          </span>
        </div>
      </div>

      {/* ── Tracking History ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
            <History className="h-4 w-4 text-orange-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Recent Live Protection Sessions
            </h4>
          </div>

          <div className="divide-y divide-slate-800/60">
            {history.map((s, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-200">Session #{s.session_id}</span>
                  <span className="text-[11px] text-slate-500 block">
                    Started: {s.started_at ? new Date(s.started_at).toLocaleString() : '--'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] text-slate-400">{s.points_count} Checkpoints</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                    }`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Privacy Confirmation Modal ──────────────────────────────────────── */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-emerald-400 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Location Privacy Notice</h4>
                <p className="text-xs text-slate-400">Live Heat Protection</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              HeatShield AI will use your current location to provide live heat-risk alerts and query Open-Meteo weather while Live Heat Protection is active.
            </p>

            <ul className="space-y-2 text-xs text-slate-400 mb-6 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Tracking stops immediately when you click STOP.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Coordinates are encrypted and never shared publicly.</span>
              </li>
            </ul>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartProtection}
                className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-lg"
              >
                Grant & Start Protection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
