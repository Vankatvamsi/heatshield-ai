import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Thermometer, Droplets, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';

// ── Simple module-level cache (5 min TTL) ─────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cacheData = null;
let _cacheTime = 0;

function getCachedMapData() {
  if (_cacheData && Date.now() - _cacheTime < CACHE_TTL_MS) return _cacheData;
  return null;
}

function setCachedMapData(data) {
  _cacheData = data;
  _cacheTime = Date.now();
}

// Center map view helper — only moves when center/zoom actually change
function ChangeView({ center, zoom }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    const key = `${center[0]}_${center[1]}_${zoom}`;
    if (prevRef.current !== key) {
      map.setView(center, zoom);
      prevRef.current = key;
    }
  }, [center, zoom, map]);
  return null;
}

// Custom pulsing DivIcon for the live user location marker
const liveMarkerIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(249,115,22,0.25);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite"></span>
      <span style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(249,115,22,0.4);animation:ping 1.4s cubic-bezier(0,0,0.2,1) 0.3s infinite"></span>
      <span style="position:relative;width:16px;height:16px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 0 0 2px #f97316"></span>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

const getRiskColor = (level) => {
  switch (level?.toUpperCase()) {
    case 'EXTREME': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MODERATE': return '#eab308';
    default: return '#10b981';
  }
};

export default function RiskMap({ liveLocation = null }) {
  const [data, setData] = useState([]);
  const [dataLoading, setDataLoading] = useState(true); // data fetch loading (separate from map render)
  const [error, setError] = useState(null);
  const [mapCenter] = useState([20.5937, 78.9629]); // Central India — fixed initial center
  const [zoomLevel] = useState(5);
  const [dynamicCenter, setDynamicCenter] = useState(null);
  const [dynamicZoom, setDynamicZoom] = useState(null);
  const loadingRef = useRef(false);

  const loadMapData = useCallback(async (force = false) => {
    if (loadingRef.current) return; // prevent concurrent fetches
    const cached = force ? null : getCachedMapData();
    if (cached) {
      setData(cached);
      setDataLoading(false);
      return;
    }
    loadingRef.current = true;
    setDataLoading(true);
    setError(null);
    try {
      const res = await api.getRiskMap();
      if (res.status === 'ok') {
        const validData = res.data.filter(item => !item.error);
        setCachedMapData(validData);
        setData(validData);
        if (validData.length > 0) {
          const lats = validData.map(d => d.latitude);
          const lons = validData.map(d => d.longitude);
          const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
          const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
          setDynamicCenter([avgLat, avgLon]);
          setDynamicZoom(6);
        }
      } else {
        throw new Error('Invalid response from risk map API');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load heat-risk data. Please try again.');
    } finally {
      setDataLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Memoize circle markers so they don't recreate on every render
  const markers = useMemo(() => data.map((loc) => (
    <CircleMarker
      key={loc.id}
      center={[loc.latitude, loc.longitude]}
      pathOptions={{
        color: getRiskColor(loc.risk_level),
        fillColor: getRiskColor(loc.risk_level),
        fillOpacity: 0.6,
        weight: 2
      }}
      radius={18}
    >
      <Popup>
        <div className="p-3 text-slate-800 font-sans max-w-[200px]">
          <h4 className="font-extrabold text-sm border-b pb-1 text-slate-900">{loc.name}</h4>
          <p className="text-[10px] text-slate-500 font-semibold mb-2">{loc.city}, {loc.state}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-600"><Thermometer className="h-3.5 w-3.5" /> Temp:</span>
              <strong className="text-slate-800">{loc.temperature.toFixed(1)}°C</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-600"><Droplets className="h-3.5 w-3.5" /> Humidity:</span>
              <strong className="text-slate-800">{loc.humidity}%</strong>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5 mt-1.5">
              <span className="text-slate-600">Stress Score:</span>
              <strong className="text-orange-600">{loc.thermal_stress_score.toFixed(0)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Heatwave Prob:</span>
              <strong className={loc.heatwave_probability > 50 ? 'text-red-600' : 'text-slate-800'}>
                {loc.heatwave_probability.toFixed(0)}%
              </strong>
            </div>
            <div className="mt-2.5 pt-1.5 text-center border-t text-[10px] uppercase font-bold tracking-wider rounded">
              <span style={{ color: getRiskColor(loc.risk_level) }}>{loc.risk_level} Risk</span>
            </div>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )), [data]);

  const center = dynamicCenter || mapCenter;
  const zoom = dynamicZoom || zoomLevel;

  return (
    <div className="space-y-4 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-orange-500" />
            Interactive Spatial Risk Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Real-time heatwave classification and human thermal index mappings per location
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
            <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-emerald-500/80 inline-block"></span>Low</div>
            <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-yellow-500/80 inline-block"></span>Moderate</div>
            <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-orange-500/80 inline-block"></span>High</div>
            <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-red-500/80 inline-block animate-pulse"></span>Extreme</div>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadMapData(true)}
            disabled={dataLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all ${dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh heat-risk data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${dataLoading ? 'animate-spin text-orange-400' : ''}`} />
            {dataLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Data loading / error status bar — shown above the map, not blocking it */}
      {dataLoading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/70 border border-slate-700/60 rounded-xl text-xs text-slate-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-400 shrink-0" />
          Loading real heat-risk data from the backend...
        </div>
      )}

      {error && !dataLoading && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </span>
          <button
            onClick={() => loadMapData(true)}
            className="ml-4 px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-lg text-red-300 font-semibold transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Map — always renders immediately */}
      <div className="flex-1 min-h-[420px] md:min-h-[480px] rounded-2xl overflow-hidden border border-slate-800 relative z-10">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          {dynamicCenter && <ChangeView center={dynamicCenter} zoom={dynamicZoom} />}

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Live User Location Marker */}
          {liveLocation && (
            <Marker
              position={[liveLocation.latitude, liveLocation.longitude]}
              icon={liveMarkerIcon}
              zIndexOffset={1000}
            >
              <Popup>
                <div className="p-3 font-sans max-w-[200px]">
                  <h4 className="font-extrabold text-sm border-b pb-1 text-orange-600 flex items-center gap-1">
                    📍 You Are Here
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1 mb-2">Live Protected Location</p>
                  <div className="space-y-1 text-xs">
                    {liveLocation.temperature != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Live Temp:</span>
                        <strong className="text-orange-700">{liveLocation.temperature.toFixed(1)}°C</strong>
                      </div>
                    )}
                    {liveLocation.personal_risk_level && (
                      <div className="flex items-center justify-between border-t pt-1.5 mt-1">
                        <span className="text-slate-600">Personal Risk:</span>
                        <strong className="text-orange-700">{liveLocation.personal_risk_level}</strong>
                      </div>
                    )}
                    <div className="mt-2 text-[10px] text-center text-emerald-600 font-bold">🟢 Live Tracking Active</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Risk location markers — rendered from cache/live data */}
          {markers}
        </MapContainer>
      </div>
    </div>
  );
}
