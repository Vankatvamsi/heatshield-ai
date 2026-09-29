import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Polyline, 
  Marker, 
  Popup, 
  CircleMarker, 
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, 
  MapPin, 
  Search, 
  Clock, 
  Sun, 
  ShieldAlert, 
  ShieldCheck, 
  Droplets, 
  Wind, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Play, 
  Square, 
  RefreshCw, 
  Sparkles, 
  ArrowRight, 
  ChevronRight, 
  X, 
  Smile, 
  Meh, 
  Flame, 
  AlertCircle,
  Radio,
  Compass
} from 'lucide-react';
import api from '../services/api';

// Map auto-fit bounds helper
function RouteBoundsAutoFitter({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (e) {
        console.error(e);
      }
    }
  }, [bounds, map]);
  return null;
}

// Map click handler for selecting start/dest by clicking map
function MapClickHandler({ mode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mode === 'none') return;
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Custom Marker Icons
const createStartIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="width:30px;height:30px;background:#10b981;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.5);">
      <span style="width:8px;height:8px;background:white;border-radius:50%;"></span>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

const createDestIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="width:30px;height:30px;background:#ef4444;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.5);">
      <span style="width:8px;height:8px;background:white;border-radius:50%;"></span>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

const createLiveUserIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.3);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite"></span>
      <span style="position:relative;width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #2563eb"></span>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

export default function HeatSafeRoutePlanner({ user, onRequireLogin }) {
  // Inputs (dynamic, no hardcoded defaults)
  const [startName, setStartName] = useState('');
  const [startCoords, setStartCoords] = useState(null); // { lat, lon }
  const [destName, setDestName] = useState('');
  const [destCoords, setDestCoords] = useState(null); // { lat, lon }
  const [departureTime, setDepartureTime] = useState('now');

  // Search geocoding state
  const [startSearch, setStartSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [showStartDrop, setShowStartDrop] = useState(false);
  const [showDestDrop, setShowDestDrop] = useState(false);
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  // Map Selection Mode ('none' | 'start' | 'dest')
  const [mapSelectMode, setMapSelectMode] = useState('none');

  // Route Plan Results
  const [planning, setPlanning] = useState(false);
  const [planStage, setPlanStage] = useState('');
  const [planResult, setPlanResult] = useState(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [error, setError] = useState(null);
  const [lastCalculatedTime, setLastCalculatedTime] = useState(null);

  // Active Journey Monitoring (Live Tracking)
  const [activeJourney, setActiveJourney] = useState(null);
  const [liveGps, setLiveGps] = useState(null);
  const [journeyTelemetry, setJourneyTelemetry] = useState(null);
  const [watchId, setWatchId] = useState(null);

  // Destination Arrival & Health Check Modal
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation?.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Geocoding search handlers
  const handleStartSearchChange = async (e) => {
    const q = e.target.value;
    setStartSearch(q);
    setStartName(q);
    setPlanResult(null); // Clear old route analysis immediately
    if (q.trim().length >= 2) {
      setIsSearchingStart(true);
      setShowStartDrop(true);
      try {
        const res = await api.searchLocations(q);
        setStartResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingStart(false);
      }
    } else {
      setShowStartDrop(false);
    }
  };

  const handleDestSearchChange = async (e) => {
    const q = e.target.value;
    setDestSearch(q);
    setDestName(q);
    setPlanResult(null); // Clear old route analysis immediately
    if (q.trim().length >= 2) {
      setIsSearchingDest(true);
      setShowDestDrop(true);
      try {
        const res = await api.searchLocations(q);
        setDestResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingDest(false);
      }
    } else {
      setShowDestDrop(false);
    }
  };

  const handleUseCurrentLocationForStart = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setError(null);
    setPlanResult(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setStartCoords({ lat, lon });
        const name = `Current GPS Position (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
        setStartName(name);
        setStartSearch(name);
        setShowStartDrop(false);
      },
      (err) => {
        setError(`Unable to retrieve GPS coordinates: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Map Click Selection Handler
  const handleMapClick = (lat, lon) => {
    if (mapSelectMode === 'start') {
      const name = `Map Point (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
      setStartCoords({ lat, lon });
      setStartName(name);
      setStartSearch(name);
      setMapSelectMode('none');
      setPlanResult(null);
    } else if (mapSelectMode === 'dest') {
      const name = `Map Point (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
      setDestCoords({ lat, lon });
      setDestName(name);
      setDestSearch(name);
      setMapSelectMode('none');
      setPlanResult(null);
    }
  };

  // Plan Route Handler
  const handleFindRoutes = async () => {
    if (!startCoords || !destCoords) {
      setError("Please select both a valid Starting point and Destination using search or map selection.");
      return;
    }

    try {
      setPlanning(true);
      setError(null);
      setPlanResult(null);

      // Loading steps
      setPlanStage("Connecting to OpenStreetMap / OSRM routing engine...");
      await new Promise(r => setTimeout(r, 200));

      setPlanStage("Analyzing roadway geometry & segmenting path...");
      await new Promise(r => setTimeout(r, 200));

      setPlanStage("Querying live Open-Meteo weather along coordinates...");
      await new Promise(r => setTimeout(r, 200));

      setPlanStage("Calculating Steadman Thermal Stress & ML Heatwave predictions...");

      const payload = {
        start_name: startName || "Start Location",
        start_latitude: startCoords.lat,
        start_longitude: startCoords.lon,
        destination_name: destName || "Destination",
        destination_latitude: destCoords.lat,
        destination_longitude: destCoords.lon,
        departure_time: departureTime,
      };

      const res = await api.planRoute(payload);
      if (res && res.data) {
        setPlanResult(res.data);
        setSelectedRouteIdx(res.data.recommended_route_index ?? 0);
        setLastCalculatedTime(new Date().toLocaleTimeString());
      } else {
        throw new Error("No road routes found between the selected coordinates.");
      }
    } catch (err) {
      console.error("Route planning error:", err);
      setError(err.message || "Failed to plan road routes. Please verify internet connection.");
    } finally {
      setPlanning(false);
      setPlanStage('');
    }
  };

  // Start Live Journey Monitoring
  const handleStartJourney = async () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (!planResult || !planResult.routes[selectedRouteIdx]) return;

    try {
      setError(null);
      const chosenRoute = planResult.routes[selectedRouteIdx];
      const res = await api.startJourney({
        start_location: planResult.start.name,
        start_latitude: planResult.start.latitude,
        start_longitude: planResult.start.longitude,
        destination: planResult.destination.name,
        destination_latitude: planResult.destination.latitude,
        destination_longitude: planResult.destination.longitude,
        selected_route: chosenRoute,
      });

      setActiveJourney({
        id: res.journey_id,
        route: chosenRoute,
        destination: planResult.destination,
      });

      // Start continuous GPS tracking
      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setLiveGps({ lat, lon });

            try {
              const tel = await api.sendJourneyLocation(res.journey_id, lat, lon);
              setJourneyTelemetry(tel);

              // Check arrival
              if (tel.arrived) {
                navigator.geolocation.clearWatch(id);
                setWatchId(null);
                setShowArrivalModal(true);
              }
            } catch (telErr) {
              console.error("Journey telemetry error:", telErr);
            }
          },
          (err) => console.error("GPS Watch error:", err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
        setWatchId(id);
      }
    } catch (err) {
      console.error("Start journey error:", err);
      setError(err.message || "Failed to initiate journey monitoring.");
    }
  };

  // Stop Active Journey Monitoring
  const handleStopJourney = async () => {
    if (watchId !== null) {
      navigator.geolocation?.clearWatch(watchId);
      setWatchId(null);
    }
    if (activeJourney?.id) {
      try {
        await api.completeJourney(activeJourney.id);
      } catch (err) {
        console.error(err);
      }
    }
    setActiveJourney(null);
    setJourneyTelemetry(null);
  };

  // Submit Destination Health Check Feedback
  const handleSubmitFeedback = async (level) => {
    if (!activeJourney?.id) return;
    try {
      setSubmittingFeedback(true);
      const res = await api.submitJourneyFeedback(activeJourney.id, level);
      setFeedbackSuccess(res);
      setTimeout(() => {
        setShowArrivalModal(false);
        setFeedbackSuccess(null);
        setActiveJourney(null);
        setJourneyTelemetry(null);
      }, 4000);
    } catch (err) {
      console.error("Feedback error:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const currentRoute = planResult?.routes?.[selectedRouteIdx] || null;

  // Default map center — India centroid
  const DEFAULT_CENTER = [20.5937, 78.9629];
  const mapCenter = startCoords
    ? [startCoords.lat, startCoords.lon]
    : DEFAULT_CENTER;

  // Compute map bounds from route coordinates (null-safe)
  const mapBounds = currentRoute?.full_path_coordinates?.length > 1
    ? currentRoute.full_path_coordinates
    : (startCoords && destCoords
        ? [[startCoords.lat, startCoords.lon], [destCoords.lat, destCoords.lon]]
        : null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-orange-500 to-red-600 rounded-2xl shadow-xl shadow-orange-950/40 text-white ring-1 ring-orange-400/40">
            <Compass className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Heat-Safe Route Planner</h2>
              <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Feature 10
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluates road routes with live Open-Meteo weather and Steadman thermal stress to recommend the lower heat-exposure path.
            </p>
          </div>
        </div>

        {activeJourney && (
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-2xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-emerald-400">Live Journey Monitoring Active</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Route Planning Controls Bar ─────────────────────────────────────── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* FROM Input */}
          <div className="md:col-span-4 relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              FROM (Starting Point)
              {startCoords && (
                <span className="ml-auto text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                  ✓ {startCoords.lat.toFixed(4)}°, {startCoords.lon.toFixed(4)}°
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={startSearch}
                onChange={handleStartSearchChange}
                onFocus={() => startSearch.length >= 2 && setShowStartDrop(true)}
                placeholder="Type a city, landmark or address..."
                className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 pr-9 ${
                  mapSelectMode === 'start' ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-700/80'
                }`}
              />
              <button
                type="button"
                onClick={handleUseCurrentLocationForStart}
                title="Use Current GPS Location"
                className="absolute right-2 top-2 p-1 text-slate-400 hover:text-orange-400 rounded transition-colors"
              >
                <Radio className="h-4 w-4" />
              </button>
            </div>

            {/* Map select button */}
            <button
              type="button"
              onClick={() => setMapSelectMode(mapSelectMode === 'start' ? 'none' : 'start')}
              className={`mt-1.5 w-full text-[10px] font-bold flex items-center justify-center gap-1 py-1 rounded-lg border transition-colors ${
                mapSelectMode === 'start'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <MapPin className="h-3 w-3" />
              {mapSelectMode === 'start' ? '🗺 Click map to select start...' : 'SELECT ON MAP'}
            </button>

            {/* Start geocoding dropdown */}
            {showStartDrop && startResults.length > 0 && (
              <div className="absolute top-[calc(100%-10px)] left-0 right-0 mt-1 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {startResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setStartCoords({ lat: r.latitude, lon: r.longitude });
                      const display = r.display_name || `${r.name}, ${r.admin1 || r.country}`;
                      setStartName(display);
                      setStartSearch(display);
                      setShowStartDrop(false);
                      setPlanResult(null);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-800 text-slate-200 flex items-start justify-between gap-2"
                  >
                    <span className="font-semibold leading-snug">{r.display_name || `${r.name}, ${r.admin1 || ''} (${r.country})`}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">{r.latitude.toFixed(3)}°N</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap arrow */}
          <div className="md:col-span-1 flex items-end justify-center pb-2">
            <button
              type="button"
              title="Swap start and destination"
              onClick={() => {
                const tempName = startName; const tempCoords = startCoords;
                const tempSearch = startSearch;
                setStartName(destName); setStartCoords(destCoords); setStartSearch(destSearch);
                setDestName(tempName); setDestCoords(tempCoords); setDestSearch(tempSearch);
                setPlanResult(null);
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all hover:scale-110"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* TO Input */}
          <div className="md:col-span-4 relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              TO (Destination)
              {destCoords && (
                <span className="ml-auto text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                  ✓ {destCoords.lat.toFixed(4)}°, {destCoords.lon.toFixed(4)}°
                </span>
              )}
            </label>
            <input
              type="text"
              value={destSearch}
              onChange={handleDestSearchChange}
              onFocus={() => destSearch.length >= 2 && setShowDestDrop(true)}
              placeholder="Type a city, landmark or address..."
              className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                mapSelectMode === 'dest' ? 'border-red-500 ring-1 ring-red-500/50' : 'border-slate-700/80'
              }`}
            />

            {/* Map select button */}
            <button
              type="button"
              onClick={() => setMapSelectMode(mapSelectMode === 'dest' ? 'none' : 'dest')}
              className={`mt-1.5 w-full text-[10px] font-bold flex items-center justify-center gap-1 py-1 rounded-lg border transition-colors ${
                mapSelectMode === 'dest'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <MapPin className="h-3 w-3" />
              {mapSelectMode === 'dest' ? '🗺 Click map to select destination...' : 'SELECT ON MAP'}
            </button>

            {/* Dest geocoding dropdown */}
            {showDestDrop && destResults.length > 0 && (
              <div className="absolute top-[calc(100%-10px)] left-0 right-0 mt-1 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {destResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setDestCoords({ lat: r.latitude, lon: r.longitude });
                      const display = r.display_name || `${r.name}, ${r.admin1 || r.country}`;
                      setDestName(display);
                      setDestSearch(display);
                      setShowDestDrop(false);
                      setPlanResult(null);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-800 text-slate-200 flex items-start justify-between gap-2"
                  >
                    <span className="font-semibold leading-snug">{r.display_name || `${r.name}, ${r.admin1 || ''} (${r.country})`}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">{r.latitude.toFixed(3)}°N</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Departure Time */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Departure
            </label>
            <select
              value={departureTime}
              onChange={(e) => { setDepartureTime(e.target.value); setPlanResult(null); }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="now">Leave Now (Live)</option>
              <option value="plus_1h">+1 Hour Forecast</option>
              <option value="plus_2h">+2 Hours Forecast</option>
              <option value="plus_4h">+4 Hours Forecast</option>
            </select>
          </div>

          {/* Find Routes Action Button */}
          <div className="md:col-span-1">
            <button
              onClick={handleFindRoutes}
              disabled={planning || !startCoords || !destCoords}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-950/40 transition-all flex items-center justify-center space-x-1.5 hover:scale-[1.02]"
            >
              {planning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Compass className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Full-width Find Button row */}
        <button
          onClick={handleFindRoutes}
          disabled={planning || !startCoords || !destCoords}
          className="w-full py-3 bg-gradient-to-r from-orange-500 via-red-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-950/40 transition-all flex items-center justify-center space-x-2 hover:scale-[1.01]"
        >
          {planning ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Calculating Heat-Safe Route...</span>
            </>
          ) : (
            <>
              <Compass className="h-5 w-5" />
              <span>FIND HEAT-SAFE ROUTE</span>
            </>
          )}
        </button>

        {/* Loading Progress Stage Label */}
        {planning && planStage && (
          <div className="flex items-center gap-2 text-[11px] text-orange-300 font-semibold bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{planStage}</span>
          </div>
        )}

        {/* Data source labels (after result) */}
        {planResult && lastCalculatedTime && (
          <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-800/60">
            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Route: OpenStreetMap + OSRM
            </span>
            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Weather: Open-Meteo API (Live)
            </span>
            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Geocoding: Open-Meteo Geocoding API
            </span>
            <span className="ml-auto text-[10px] font-semibold text-slate-600">
              Calculated at {lastCalculatedTime}
            </span>
          </div>
        )}

        {/* Empty state guidance */}
        {!startCoords || !destCoords ? (
          <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
            <Info className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />
            <div>
              <p className="font-bold text-slate-300 mb-1">How to use the Route Planner</p>
              <p>1. Type any location in the <strong>FROM</strong> field and select a result (e.g. "Charminar" → Charminar, Telangana, India).</p>
              <p>2. Type any destination in the <strong>TO</strong> field and select a result.</p>
              <p>3. Or click <strong>SELECT ON MAP</strong> to pin locations on the map directly.</p>
              <p>4. Click <strong>FIND HEAT-SAFE ROUTE</strong> — the system will fetch real road routes, live weather, and calculate heat risk per segment.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Active Journey Live Telemetry Strip ─────────────────────────────── */}
      {activeJourney && (
        <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 border border-blue-500/40 rounded-3xl p-5 shadow-2xl space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Navigation className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  LIVE JOURNEY MONITORING
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">
                    GPS ACTIVE
                  </span>
                </h4>
                <p className="text-xs text-slate-400">
                  En route to <strong className="text-slate-200">{activeJourney.destination.name}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={handleStopJourney}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 self-start sm:self-auto"
            >
              <Square className="h-3.5 w-3.5" />
              <span>STOP JOURNEY</span>
            </button>
          </div>

          {/* Telemetry metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Ambient</span>
              <strong className="text-sm font-black text-slate-100 mt-0.5 block">
                {journeyTelemetry?.current_weather?.temperature?.toFixed(1) ?? '--'}°C
              </strong>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Thermal Stress</span>
              <strong className="text-sm font-black text-orange-400 mt-0.5 block">
                {journeyTelemetry?.personal_risk?.thermal_stress?.toFixed(0) ?? '--'}/100
              </strong>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Personal Heat Risk</span>
              <strong className={`text-sm font-black mt-0.5 block ${
                journeyTelemetry?.personal_risk?.level === 'HIGH' || journeyTelemetry?.personal_risk?.level === 'EXTREME'
                  ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {journeyTelemetry?.personal_risk?.level ?? 'MONITORING'}
              </strong>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Distance to Dest</span>
              <strong className="text-sm font-black text-blue-400 mt-0.5 block">
                {journeyTelemetry?.distance_to_destination_m ? `${(journeyTelemetry.distance_to_destination_m / 1000).toFixed(2)} km` : '--'}
              </strong>
            </div>
          </div>

          {journeyTelemetry?.route_deviated && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{journeyTelemetry.deviation_message || "Your route has changed. Heat risk is being recalculated."}</span>
            </div>
          )}

          {journeyTelemetry?.escalation_alert && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{journeyTelemetry.escalation_alert}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Main Map & Route Comparison Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Map: Leaflet with color-coded risk segments */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden">
            
            {/* Heat Risk Map Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 mb-3 text-[11px] font-semibold text-slate-300">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Heat Risk Legend:</span>
              <div className="flex items-center space-x-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Moderate</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> High</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Extreme</span>
              </div>
            </div>

            {/* Map Container */}
            <div className="h-[460px] rounded-2xl overflow-hidden relative border border-slate-800 z-10">
              {/* Map-select mode overlay banner */}
              {mapSelectMode !== 'none' && (
                <div className={`absolute inset-x-0 top-0 z-[500] flex items-center justify-center gap-2 py-2 text-xs font-bold pointer-events-none ${
                  mapSelectMode === 'start'
                    ? 'bg-emerald-600/90 text-white'
                    : 'bg-red-600/90 text-white'
                }`}>
                  <MapPin className="h-4 w-4" />
                  {mapSelectMode === 'start'
                    ? '🗺 Click anywhere on the map to set START location'
                    : '🗺 Click anywhere on the map to set DESTINATION'}
                </div>
              )}

              <MapContainer
                center={mapCenter}
                zoom={startCoords ? 13 : 5}
                style={{
                  height: '100%',
                  width: '100%',
                  background: '#0b1329',
                  cursor: mapSelectMode !== 'none' ? 'crosshair' : 'grab'
                }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Map click handler for select mode */}
                <MapClickHandler mode={mapSelectMode} onMapClick={handleMapClick} />

                {/* Auto-fit route bounds */}
                {mapBounds && <RouteBoundsAutoFitter bounds={mapBounds} />}

                {/* Start Marker */}
                {startCoords && (
                  <Marker position={[startCoords.lat, startCoords.lon]} icon={createStartIcon()}>
                    <Popup className="heatshield-popup">
                      <div className="text-xs p-1">
                        <strong className="text-emerald-400 block font-bold">Start Location</strong>
                        <span>{startName}</span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Destination Marker */}
                {destCoords && (
                  <Marker position={[destCoords.lat, destCoords.lon]} icon={createDestIcon()}>
                    <Popup className="heatshield-popup">
                      <div className="text-xs p-1">
                        <strong className="text-red-400 block font-bold">Destination</strong>
                        <span>{destName}</span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Live GPS user location if tracking */}
                {liveGps && (
                  <Marker position={[liveGps.lat, liveGps.lon]} icon={createLiveUserIcon()}>
                    <Popup className="heatshield-popup">
                      <div className="text-xs p-1">
                        <strong className="text-blue-400 block font-bold">Your Live Position</strong>
                        <span>Lat: {liveGps.lat.toFixed(4)}, Lon: {liveGps.lon.toFixed(4)}</span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Color-Coded Route Segments for Selected Route */}
                {currentRoute?.segments?.map((seg) => (
                  <React.Fragment key={seg.segment_index}>
                    <Polyline
                      positions={seg.coordinates}
                      pathOptions={{
                        color: seg.risk_color,
                        weight: 6,
                        opacity: 0.9,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup className="heatshield-popup">
                        <div className="p-2 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
                            <strong className="text-slate-100 font-bold">Segment #{seg.segment_index + 1}</strong>
                            <span className="font-extrabold text-[10px] px-2 py-0.5 rounded text-white" style={{ background: seg.risk_color }}>
                              {seg.personal_risk_level} RISK
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                            <div>Temp: <strong>{seg.temperature}°C</strong></div>
                            <div>Humidity: <strong>{seg.humidity}%</strong></div>
                            <div>Thermal Stress: <strong className="text-orange-400">{seg.thermal_stress_score}/100</strong></div>
                            <div>Heatwave Prob: <strong className="text-red-400">{seg.heatwave_probability}%</strong></div>
                          </div>
                          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800">
                            Distance: {seg.distance_m}m • Live Open-Meteo Input
                          </div>
                        </div>
                      </Popup>
                    </Polyline>

                    {/* Segment midpoint indicator dot */}
                    <CircleMarker
                      center={seg.midpoint}
                      radius={4}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: seg.risk_color,
                        fillOpacity: 1,
                        weight: 1.5,
                      }}
                    />
                  </React.Fragment>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Right: Route Comparison & Health Recommendations */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Recommendation Banner */}
          {planResult && (
            <div className="bg-gradient-to-br from-slate-900 to-[#0f172a] border border-orange-500/30 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-xl text-white shadow-lg shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Recommended Heat-Safe Route</h4>
                  <p className="text-xs text-orange-300 font-semibold mt-0.5 leading-snug">
                    {planResult.recommendation_summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Route Options Selector */}
          {planResult?.routes?.map((r, idx) => {
            const isSelected = selectedRouteIdx === idx;
            const isRecommended = planResult.recommended_route_index === idx;

            return (
              <div
                key={idx}
                onClick={() => setSelectedRouteIdx(idx)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900/95 border-orange-500/60 shadow-xl shadow-orange-950/20 ring-1 ring-orange-500/40'
                    : 'bg-[#0f172a]/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-white">{r.route_name}</span>
                    {isRecommended && (
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Recommended
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full" style={{ background: `${r.overall_color}25`, color: r.overall_color, border: `1px solid ${r.overall_color}50` }}>
                    {r.overall_risk_level} HEAT RISK
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 my-3.5 text-center">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Distance</span>
                    <strong className="text-xs font-bold text-slate-200 mt-0.5 block">{r.distance_km} km</strong>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Est. Time</span>
                    <strong className="text-xs font-bold text-slate-200 mt-0.5 block">{r.duration_minutes} min</strong>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Avg Risk</span>
                    <strong className="text-xs font-black mt-0.5 block" style={{ color: r.overall_color }}>
                      {r.avg_personal_risk_score}/100
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                  <span>Peak Segment Risk: <strong className="text-slate-200">{r.max_personal_risk_score}/100</strong></span>
                  <span>High-Risk Zones: <strong className={r.high_risk_segment_percentage > 0 ? 'text-red-400' : 'text-emerald-400'}>{r.high_risk_segment_percentage}%</strong></span>
                </div>
              </div>
            );
          })}

          {/* Start Journey Monitoring Button */}
          {currentRoute && !activeJourney && (
            <button
              onClick={handleStartJourney}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-950/40 transition-all flex items-center justify-center space-x-2 hover:scale-[1.02]"
            >
              <Play className="h-4 w-4" />
              <span>START JOURNEY MONITORING ({currentRoute.route_name})</span>
            </button>
          )}

          {/* Medical Disclaimer */}
          <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-2xl text-[10px] text-slate-500 italic leading-relaxed">
            {planResult?.disclaimer || "HeatShield AI provides general heat-risk and safety guidance based on environmental conditions and the information you provide. It is not a medical diagnostic system and does not replace professional medical advice."}
          </div>
        </div>
      </div>

      {/* ── Destination Arrival & Health Check Dialog Modal ─────────────────── */}
      {showArrivalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl text-white shadow-lg">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">YOU HAVE ARRIVED</h3>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Journey Health Check • Destination reached
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowArrivalModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {feedbackSuccess ? (
              <div className="py-4 space-y-3 text-center">
                <div className="inline-block p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 mx-auto" />
                </div>
                <h4 className="text-sm font-bold text-white">{feedbackSuccess.badge}</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                  {feedbackSuccess.guidance}
                </p>
                <p className="text-[10px] text-slate-500 italic pt-2">
                  Feedback recorded securely in PostgreSQL.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300 text-center">
                  How are you feeling after your journey under current heat conditions?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSubmitFeedback('FINE')}
                    disabled={submittingFeedback}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-2 text-emerald-400 mb-1">
                      <Smile className="h-4 w-4" />
                      <span className="text-xs font-bold">😊 I'M FEELING FINE</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Normal energy, well hydrated.</span>
                  </button>

                  <button
                    onClick={() => handleSubmitFeedback('UNCOMFORTABLE')}
                    disabled={submittingFeedback}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-2 text-amber-400 mb-1">
                      <Meh className="h-4 w-4" />
                      <span className="text-xs font-bold">😐 I'M FEELING UNCOMFORTABLE</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Mild fatigue or thirst.</span>
                  </button>

                  <button
                    onClick={() => handleSubmitFeedback('VERY_HOT')}
                    disabled={submittingFeedback}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/10 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-2 text-orange-400 mb-1">
                      <Flame className="h-4 w-4" />
                      <span className="text-xs font-bold">🥵 I'M FEELING VERY HOT</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Excessive sweat, need cooldown.</span>
                  </button>

                  <button
                    onClick={() => handleSubmitFeedback('UNWELL')}
                    disabled={submittingFeedback}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-2 text-red-400 mb-1">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-bold">⚠️ I'M FEELING UNWELL</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Dizziness or severe discomfort.</span>
                  </button>
                </div>

                <div className="pt-2 text-center text-[10px] text-slate-500 italic">
                  HeatShield AI does not diagnose or treat medical conditions.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}