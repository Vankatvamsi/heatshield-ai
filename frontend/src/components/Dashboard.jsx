import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Droplets, 
  Wind, 
  Flame, 
  AlertTriangle, 
  CheckCircle, 
  Cpu,
  Radio,
  Clock,
  Compass,
  ThermometerSun,
  ShieldAlert,
  Gauge
} from 'lucide-react';
import api from '../services/api';
import PersonalRiskCard from './PersonalRiskCard';

export default function Dashboard({ location, onAlertAck, user = null, liveProtectionActive = false, onNavigateToLiveProtection, onOpenProfile, onRequireLogin }) {
  const [weather, setWeather] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (location) {
      loadDashboardData();
    }
  }, [location]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch live weather from Open-Meteo via backend
      const wRes = await api.getCurrentWeather(
        location.city || location.name, 
        location.latitude, 
        location.longitude
      );
      
      if (!wRes || !wRes.data) {
        throw new Error("Live weather data is currently unavailable.");
      }
      const wData = wRes.data;
      setWeather(wData);

      // 2. Fetch heatwave predictions using live weather
      const pData = await api.getHeatwavePrediction({
        city: location.city || location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        temperature: wData.temperature,
        humidity: wData.humidity,
        wind_speed: wData.wind_speed,
        solar_radiation: wData.solar_radiation,
        pressure: wData.pressure,
        precipitation: wData.precipitation,
        dew_point: wData.dew_point
      });
      setPrediction(pData);

      // 3. Fetch future forecasts (+6h, +12h, +24h, +48h)
      const fRes = await api.getForecastPredictions(
        location.city || location.name, 
        location.latitude, 
        location.longitude
      );
      setForecast(fRes.data || []);

      // 4. Fetch alerts (filter to active unacknowledged alerts)
      const aData = await api.getAlerts(location.id);
      const unackAlerts = (aData.data || []).filter(a => !a.acknowledged);
      setAlerts(unackAlerts);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
      setError(err.message || 'Live weather data is currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleAckAlert = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      const aData = await api.getAlerts(location.id);
      const unackAlerts = (aData.data || []).filter(a => !a.acknowledged);
      setAlerts(unackAlerts);
      if (onAlertAck) onAlertAck();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div className="relative">
          <Sun className="h-12 w-12 animate-spin" style={{color:'var(--accent)'}} />
          <Radio className="h-6 w-6 absolute inset-0 m-auto animate-ping" style={{color:'var(--danger)'}} />
        </div>
        <p className="text-sm font-semibold tracking-wide" style={{color:'var(--text-secondary)'}}>
          Streaming Live Open-Meteo Data for {location?.name || 'Selected Location'}...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center max-w-2xl mx-auto shadow-xl" style={{background:'var(--danger-subtle)',border:'1px solid rgba(239,68,68,0.3)',color:'var(--danger)'}}>
        <AlertTriangle className="h-10 w-10" />
        <h3 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>Live Data Unavailable</h3>
        <p className="text-sm font-medium">{error}</p>
        <p className="text-xs opacity-80" style={{color:'var(--text-secondary)'}}>
          HeatShield AI operates strictly with real live environmental inputs. Synthetic fallback is disabled.
        </p>
        <button
          onClick={loadDashboardData}
          className="hs-btn hs-btn-danger mt-2"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!weather || !prediction) {
    return null;
  }

  const getStressBadge = (category) => {
    switch (category?.toUpperCase()) {
      case 'EXTREME': return 'hs-badge hs-badge-danger';
      case 'HIGH': return 'hs-badge hs-badge-accent';
      case 'ELEVATED': return 'hs-badge hs-badge-warning';
      case 'MODERATE': return 'hs-badge hs-badge-warning';
      default: return 'hs-badge hs-badge-success';
    }
  };

  const getRiskBadge = (level) => {
    switch (level?.toUpperCase()) {
      case 'EXTREME': return 'hs-badge hs-risk-extreme animate-pulse';
      case 'HIGH': return 'hs-badge hs-risk-high';
      case 'MODERATE': return 'hs-badge hs-risk-moderate';
      default: return 'hs-badge hs-risk-low';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Personalized Heat-Health Risk Card (Feature 8) ── */}
      <PersonalRiskCard
        user={user}
        location={location}
        liveProtectionActive={liveProtectionActive}
        onNavigateToLiveProtection={onNavigateToLiveProtection}
        onOpenProfile={onOpenProfile}
        onRequireLogin={onRequireLogin}
      />
      
      {/* ── Location & Live Stream Banner ────────────────────────────────────── */}
      <div className="hs-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs uppercase font-extrabold tracking-wider" style={{color:'var(--success)'}}>
              Live Meteorological Stream
            </span>
            <span style={{color:'var(--text-muted)'}}>•</span>
            <span className="text-xs font-semibold" style={{color:'var(--text-secondary)'}}>
              Source: <strong style={{color:'var(--text-primary)'}}>{weather.data_source || 'Open-Meteo'}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-black mt-1" style={{color:'var(--text-primary)'}}>
            {location.name} {location.city && location.city !== location.name ? `(${location.city})` : ''}
          </h2>
          <p className="text-xs font-mono mt-0.5" style={{color:'var(--text-secondary)'}}>
            Coordinates: {location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° E | Region: {location.state || 'National'}, {location.country || 'India'}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto px-4 py-2.5 rounded-xl hs-elevated">
          <Clock className="h-4 w-4" style={{color:'var(--accent)'}} />
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold block tracking-wider" style={{color:'var(--text-muted)'}}>Backend Sync Timestamp</span>
            <span className="text-xs font-mono font-bold" style={{color:'var(--text-primary)'}}>
              {weather.timestamp ? new Date(weather.timestamp).toLocaleString() : 'Just now'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Top Metric Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Current Weather Card */}
        <div className="hs-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider flex items-center gap-1.5" style={{color:'var(--text-secondary)'}}>
                <ThermometerSun className="h-4 w-4" style={{color:'var(--accent)'}} /> Live Observation
              </span>
              <span className="hs-badge hs-badge-success">
                LIVE METEO
              </span>
            </div>

            <div className="flex items-baseline space-x-2 my-3">
              <span className="text-5xl font-black tracking-tight" style={{color:'var(--text-primary)'}}>
                {typeof weather.temperature === 'number' ? weather.temperature.toFixed(1) : '--'}
              </span>
              <span className="text-2xl font-bold" style={{color:'var(--text-muted)'}}>°C</span>
              {weather.apparent_temperature && (
                <span className="text-xs font-medium ml-2" style={{color:'var(--text-secondary)'}}>
                  (Feels like {weather.apparent_temperature.toFixed(1)}°C)
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 pt-4 hs-divider">
            <div className="text-center p-2 rounded-xl hs-elevated">
              <span className="text-[11px] flex items-center justify-center gap-1" style={{color:'var(--text-secondary)'}}>
                <Droplets className="h-3 w-3 text-cyan-400" /> Humidity
              </span>
              <p className="text-sm font-bold mt-0.5" style={{color:'var(--text-primary)'}}>{weather.humidity}%</p>
            </div>
            <div className="text-center p-2 rounded-xl hs-elevated">
              <span className="text-[11px] flex items-center justify-center gap-1" style={{color:'var(--text-secondary)'}}>
                <Wind className="h-3 w-3 text-teal-400" /> Wind
              </span>
              <p className="text-sm font-bold mt-0.5" style={{color:'var(--text-primary)'}}>{weather.wind_speed} km/h</p>
            </div>
            <div className="text-center p-2 rounded-xl hs-elevated">
              <span className="text-[11px] flex items-center justify-center gap-1" style={{color:'var(--text-secondary)'}}>
                <Sun className="h-3 w-3 text-amber-400" /> Solar
              </span>
              <p className="text-sm font-bold mt-0.5" style={{color:'var(--text-primary)'}}>{weather.solar_radiation || 0} W/m²</p>
            </div>
          </div>

          <div className="mt-3 text-[11px] flex justify-between px-1" style={{color:'var(--text-secondary)'}}>
            <span>Pressure: <strong style={{color:'var(--text-primary)'}}>{weather.pressure || 1013} hPa</strong></span>
            <span>Dew Point: <strong style={{color:'var(--text-primary)'}}>{weather.dew_point || 0}°C</strong></span>
          </div>
        </div>

        {/* Heatwave Early Warning Model */}
        <div className="hs-card p-6 flex flex-col justify-between" style={{borderLeftWidth:'4px',borderLeftColor:'var(--accent)'}}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider flex items-center gap-1.5" style={{color:'var(--text-secondary)'}}>
                <ShieldAlert className="h-4 w-4" style={{color:'var(--accent)'}} /> Heatwave AI Warning
              </span>
              <span className={getRiskBadge(prediction.risk_level)}>
                {prediction.risk_level} Risk
              </span>
            </div>

            <div className="flex items-baseline space-x-2 my-3">
              <span className="text-5xl font-black tracking-tight" style={{color:'var(--text-primary)'}}>
                {typeof prediction.heatwave_probability === 'number' ? prediction.heatwave_probability.toFixed(0) : '--'}%
              </span>
              <span className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Probability</span>
            </div>

            <div className="hs-progress-track">
              <div 
                className={`hs-progress-bar ${
                  prediction.heatwave_probability > 70 
                    ? 'bg-gradient-to-r from-orange-500 to-red-600' 
                    : prediction.heatwave_probability > 40 
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500' 
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, prediction.heatwave_probability))}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 text-xs" style={{borderTop:'1px solid var(--border)',color:'var(--text-secondary)'}}>
            <span className="font-semibold block mb-1" style={{color:'var(--accent)'}}>
              Status: {prediction.classification}
            </span>
            <p className="text-[11px] leading-relaxed" style={{color:'var(--text-muted)'}}>
              {Array.isArray(prediction.explanation) 
                ? prediction.explanation.join(' ') 
                : prediction.explanation}
            </p>
          </div>
        </div>

        {/* Human Thermal Stress Index */}
        <div className="hs-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider flex items-center gap-1.5" style={{color:'var(--text-secondary)'}}>
                <Gauge className="h-4 w-4" style={{color:'var(--warning)'}} /> Human Thermal Stress
              </span>
              <span className={getStressBadge(prediction.thermal_stress_category)}>
                {prediction.thermal_stress_category || 'NORMAL'}
              </span>
            </div>

            <div className="flex items-baseline space-x-2 my-3">
              <span className="text-5xl font-black tracking-tight" style={{color:'var(--text-primary)'}}>
                {typeof prediction.thermal_stress_score === 'number' ? prediction.thermal_stress_score.toFixed(0) : '--'}
              </span>
              <span className="text-sm font-bold" style={{color:'var(--text-muted)'}}>/ 100 Stress Index</span>
            </div>

            <div className="hs-progress-track">
              <div 
                className="hs-progress-bar bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600" 
                style={{ width: `${Math.min(100, Math.max(5, prediction.thermal_stress_score || 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{borderTop:'1px solid var(--border)',color:'var(--text-secondary)'}}>
            <div>
              <span className="block text-[10px]" style={{color:'var(--text-muted)'}}>Calculated Heat Index</span>
              <strong className="text-base font-extrabold" style={{color:'var(--text-primary)'}}>
                {prediction.heat_index ? prediction.heat_index.toFixed(1) : weather.temperature.toFixed(1)}°C
              </strong>
            </div>
            <div className="text-right">
              <span className="block text-[10px]" style={{color:'var(--text-muted)'}}>Methodology</span>
              <span className="text-[11px] font-semibold" style={{color:'var(--warning)'}}>Steadman HI Equation</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Future Heatwave Prediction (+6h, +12h, +24h, +48h) & Alerts Queue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Future Forecast Timeline */}
        {/* Future Forecast Timeline */}
        <div className="hs-card p-6 lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold flex items-center gap-2" style={{color:'var(--text-primary)'}}>
              <Cpu className="h-5 w-5" style={{color:'var(--accent)'}} />
              Live Future Heatwave Prediction (+48 Hours)
            </h3>
            <span className="text-[10px] font-mono px-2 py-1 rounded" style={{color:'var(--text-secondary)',background:'var(--surface-elevated)',border:'1px solid var(--border)'}}>
              Open-Meteo Hourly Forecast
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {forecast.map((item, index) => (
              <div 
                key={index} 
                className="hs-elevated p-4 rounded-xl text-center transition-all flex flex-col justify-between hover:border-[var(--border-muted)]"
              >
                <div>
                  <span className="text-xs font-black uppercase block tracking-wider mb-1" style={{color:'var(--accent)'}}>
                    +{item.horizon_hours} Hours
                  </span>
                  <span className="text-[10px] block font-mono" style={{color:'var(--text-muted)'}}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <p className="text-2xl font-black my-2" style={{color:'var(--text-primary)'}}>
                    {typeof item.temperature === 'number' ? item.temperature.toFixed(1) : '--'}°C
                  </p>
                </div>
                
                <div className="space-y-1.5 mt-2">
                  <div className="py-1 px-2 rounded-lg text-xs flex justify-between items-center" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <span className="text-[10px]" style={{color:'var(--text-muted)'}}>Stress:</span>
                    <span className="font-bold" style={{color:'var(--warning)'}}>
                      {typeof item.thermal_stress_score === 'number' ? item.thermal_stress_score.toFixed(0) : '--'}
                    </span>
                  </div>

                  <div className="py-1 px-2 rounded-lg text-xs flex justify-between items-center" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <span className="text-[10px]" style={{color:'var(--text-muted)'}}>Prob:</span>
                    <span className={`font-bold ${item.heatwave_probability > 50 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                      {typeof item.heatwave_probability === 'number' ? item.heatwave_probability.toFixed(0) : '--'}%
                    </span>
                  </div>

                  <span className={`block text-[10px] font-bold py-0.5 rounded ${getRiskBadge(item.risk_level)}`}>
                    {item.risk_level || 'LOW'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3.5 rounded-xl flex items-center justify-between text-xs hs-elevated" style={{color:'var(--text-secondary)'}}>
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 animate-pulse" style={{color:'var(--success)'}} />
              Dynamic continuous evaluation from live thermodynamic barometric conditions
            </span>
            <span className="text-[11px] font-mono" style={{color:'var(--text-muted)'}}>Auto-Refreshes</span>
          </div>
        </div>

        {/* Active Alerts Queue */}
        <div className="hs-card p-6 lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 mb-4" style={{color:'var(--text-primary)'}}>
              <AlertTriangle className="h-5 w-5" style={{color:'var(--danger)'}} />
              Automatic Heatwave Alerts
            </h3>
            
            {alerts.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed" style={{background:'var(--surface-elevated)',borderColor:'var(--border-muted)'}}>
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-80" style={{color:'var(--success)'}} />
                <span className="text-xs font-bold block" style={{color:'var(--text-primary)'}}>No Active Alerts</span>
                <span className="text-[11px]" style={{color:'var(--text-muted)'}}>Environmental parameters within safe thresholds</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-xl flex items-start justify-between gap-3 text-xs transition-all ${
                      alert.acknowledged 
                        ? 'hs-surface opacity-60' 
                        : 'shadow-md'
                    }`}
                    style={!alert.acknowledged ? {background:'var(--danger-subtle)',border:'1px solid rgba(239,68,68,0.3)'} : {}}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded text-white ${
                          alert.alert_level === 'EXTREME' || alert.alert_level === 'HIGH'
                            ? 'bg-[var(--danger)]' 
                            : 'bg-[var(--accent)]'
                        }`}>
                          {alert.alert_level}
                        </span>
                        <span className="text-[10px] font-mono" style={{color:'var(--text-muted)'}}>
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-medium mt-1 leading-snug" style={{color:'var(--text-primary)'}}>{alert.message}</p>
                    </div>

                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAckAlert(alert.id)}
                        className="hs-btn hs-btn-danger text-[10px] px-2 py-1 shrink-0"
                      >
                        Ack
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-3 text-center" style={{borderTop:'1px solid var(--border)'}}>
            <span className="text-[10px] font-semibold flex items-center justify-center gap-1.5" style={{color:'var(--text-secondary)'}}>
              <CheckCircle className="h-3.5 w-3.5" style={{color:'var(--success)'}} />
              Persisted in PostgreSQL | Evaluated continuously
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
