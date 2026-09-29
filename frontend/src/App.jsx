import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Map as MapIcon,
  TrendingUp,
  Settings as SettingsIcon,
  Flame,
  Users,
  Bell,
  LogOut,
  Activity,
  RefreshCw,
  Sun,
  Moon,
  MapPin,
  Search,
  Globe,
  Radio,
  Heart,
  User,
  Compass,
  Menu,
  X as XIcon
} from 'lucide-react';
import { useTheme } from './ThemeContext.jsx';

import api from './services/api';
import Dashboard from './components/Dashboard';
import RiskMap from './components/RiskMap';
import UhiHotspots from './components/UhiHotspots';
import VulnerableAdvisor from './components/VulnerableAdvisor';
import HistoricalAnalytics from './components/HistoricalAnalytics';
import ThresholdSettings from './components/ThresholdSettings';
import AuthModal from './components/AuthModal';
import LiveProtection from './components/LiveProtection';
import HeatHealthProfile from './components/HeatHealthProfile';
import PersonalRiskCard from './components/PersonalRiskCard';
import HeatSafeRoutePlanner from './components/HeatSafeRoutePlanner';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export default function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Global Live Protection state — persists across tab switches
  const [liveProtectionActive, setLiveProtectionActive] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null); // {latitude, longitude, temperature, personal_risk_level}

  // Mobile sidebar drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Geocoding search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    // Check if auth token exists
    const token = localStorage.getItem('token');
    if (token) {
      api.getProfile()
        .then(res => setUser(res.user || res))
        .catch(() => api.logout());
    }

    initData();

    // Auto-refresh every 2 minutes for real-time monitoring
    const interval = setInterval(() => {
      refreshData();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initData = async () => {
    try {
      setLoading(true);
      const locList = await api.getLocations();
      setLocations(locList);
      if (locList.length > 0) {
        setSelectedLocation(locList[0]);
      }

      await updateAlertCount();
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      const locList = await api.getLocations();
      setLocations(locList);
      await updateAlertCount();
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    window.location.reload();
  };

  const updateAlertCount = async () => {
    try {
      const alertsData = await api.getAlerts();
      const unread = (alertsData.data || []).filter(a => !a.acknowledged).length;
      setUnreadAlertCount(unread);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    setShowDropdown(false);
    setSearchQuery('');
  };

  // Search geocoding handler
  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      setIsSearching(true);
      setShowDropdown(true);
      try {
        const res = await api.searchLocations(query);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error("Search geocoding error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelectSearchResult = async (result) => {
    try {
      // Save location to PostgreSQL
      const saveRes = await api.addLocation({
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.name,
        state: result.admin1 || '',
        country: result.country || 'India',
        timezone: result.timezone || ''
      });

      const newLoc = saveRes.location || {
        id: Date.now(),
        name: result.name,
        city: result.name,
        state: result.admin1 || '',
        country: result.country || 'India',
        latitude: result.latitude,
        longitude: result.longitude
      };

      // Update location list if not already in list
      setLocations(prev => {
        if (prev.some(l => l.id === newLoc.id || (Math.abs(l.latitude - newLoc.latitude) < 0.01 && Math.abs(l.longitude - newLoc.longitude) < 0.01))) {
          return prev;
        }
        return [...prev, newLoc];
      });

      setSelectedLocation(newLoc);
      setShowDropdown(false);
      setSearchQuery('');
    } catch (err) {
      console.error("Error adding searched location:", err);
      // Fallback: set as temporary selected location
      const tempLoc = {
        id: Date.now(),
        name: result.name,
        city: result.name,
        state: result.admin1 || '',
        country: result.country || '',
        latitude: result.latitude,
        longitude: result.longitude
      };
      setSelectedLocation(tempLoc);
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  // Helper: navigate and close mobile drawer
  const navigate = useCallback((tab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden font-sans theme-transition" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── Mobile Drawer Overlay ──────────────────────────────────────────────── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ─────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full w-72 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Drawer Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 p-2 rounded-xl shadow-lg">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              HeatShield <span style={{ color: 'var(--accent)' }}>AI</span>
            </h1>
          </div>
          <button onClick={() => setMobileDrawerOpen(false)} className="hs-btn hs-btn-ghost p-1.5 rounded-lg" aria-label="Close menu">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {/* same nav items using navigate() helper */}
          <button onClick={() => navigate('dashboard')} className={`hs-nav-item w-full ${activeTab === 'dashboard' ? 'active' : ''}`}><Activity className="h-4 w-4 shrink-0" /><span>Real-Time Dashboard</span></button>
          <button onClick={() => navigate('map')} className={`hs-nav-item w-full ${activeTab === 'map' ? 'active' : ''}`}><MapIcon className="h-4 w-4 shrink-0" /><span>Heat Risk Map</span></button>
          <button onClick={() => navigate('uhi')} className={`hs-nav-item w-full ${activeTab === 'uhi' ? 'active' : ''}`}><Flame className="h-4 w-4 shrink-0" /><span>Urban Heat Island</span></button>
          <button onClick={() => navigate('vulnerable')} className={`hs-nav-item w-full ${activeTab === 'vulnerable' ? 'active' : ''}`}><Users className="h-4 w-4 shrink-0" /><span>Vulnerable Population</span></button>
          <button onClick={() => navigate('history')} className={`hs-nav-item w-full ${activeTab === 'history' ? 'active' : ''}`}><TrendingUp className="h-4 w-4 shrink-0" /><span>Historical Analytics</span></button>
          <div className="px-2 pt-4 pb-1"><span className="hs-section-label">Personal Safety</span></div>
          <button onClick={() => navigate('my-risk')} className={`hs-nav-item w-full ${activeTab === 'my-risk' ? 'active' : ''}`}><Heart className="h-4 w-4 shrink-0" /><span>My Heat Safety</span>{!user && <span className="ml-auto hs-badge hs-badge-muted text-[9px]">LOGIN</span>}</button>
          <button onClick={() => navigate('route-planner')} className={`hs-nav-item w-full ${activeTab === 'route-planner' ? 'active' : ''}`}><Compass className="h-4 w-4 shrink-0" /><span>HeatSafe Route Planner</span></button>
          <button onClick={() => navigate('live-protection')} className={`hs-nav-item w-full ${activeTab === 'live-protection' ? 'active' : ''}`}><Radio className={`h-4 w-4 shrink-0 ${liveProtectionActive ? 'text-emerald-400 animate-pulse' : ''}`} /><span>Live Protection</span>{liveProtectionActive && (<span className="ml-auto hs-badge hs-badge-success text-[9px] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />LIVE</span>)}</button>
          <button onClick={() => navigate('profile')} className={`hs-nav-item w-full ${activeTab === 'profile' ? 'active' : ''}`}><User className="h-4 w-4 shrink-0" /><span>My Profile</span></button>
          {user && (user.role === 'admin' || user.role === 'super_admin') && (
            <>
              <div className="px-2 pt-4 pb-1"><span className="hs-section-label" style={{ color: 'var(--warning)' }}>Administration</span></div>
              {user.role === 'admin' && (<button onClick={() => navigate('admin-panel')} className={`hs-nav-item w-full ${activeTab === 'admin-panel' ? 'active' : ''}`}><SettingsIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} /><span>Admin Dashboard</span></button>)}
              {user.role === 'super_admin' && (<button onClick={() => navigate('super-admin-panel')} className={`hs-nav-item w-full ${activeTab === 'super-admin-panel' ? 'active' : ''}`}><ShieldAlert className="h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} /><span>Super Admin Portal</span></button>)}
            </>
          )}
          <div className="px-2 pt-4 pb-1"><span className="hs-section-label">System</span></div>
          <button onClick={() => navigate('settings')} className={`hs-nav-item w-full ${activeTab === 'settings' ? 'active' : ''}`}><SettingsIcon className="h-4 w-4 shrink-0" /><span>System &amp; Thresholds</span></button>
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-gradient-to-tr from-orange-600 to-amber-700 h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs ring-1 ring-orange-500/40 shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                  <p className="text-[10px] font-bold truncate" style={{ color: 'var(--accent)' }}>{user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrator' : 'User'}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="hs-btn hs-btn-ghost p-1.5 rounded-lg" title="Log Out"><LogOut className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => { setShowAuthModal(true); setMobileDrawerOpen(false); }} className="hs-btn hs-btn-secondary w-full text-xs"><span>Admin Login</span></button>
          )}
        </div>
      </div>

      {/* ── Desktop Sidebar Navigation ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col shrink-0 z-20 h-screen" style={{ width: 'var(--sidebar-width)', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        {/* Logo / Header */}
        <div className="p-4 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
          <div className="bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 p-2 rounded-xl shadow-lg">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>
              HeatShield <span style={{ color: 'var(--accent)' }}>AI</span>
            </h1>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Heat Safety Platform</span>
          </div>
        </div>

        {/* Nav Items — scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Activity className="h-4.5 w-4.5" />
            <span>Real-Time Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'map'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <MapIcon className="h-4.5 w-4.5" />
            <span>Heat Risk Map</span>
          </button>

          <button
            onClick={() => setActiveTab('uhi')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'uhi'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Flame className="h-4.5 w-4.5" />
            <span>Urban Heat Island</span>
          </button>

          <button
            onClick={() => setActiveTab('vulnerable')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'vulnerable'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Users className="h-4.5 w-4.5" />
            <span>Vulnerable Population</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'history'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <TrendingUp className="h-4.5 w-4.5" />
            <span>Historical Analytics</span>
          </button>

          {/* Nav: Divider - Personal Features */}
          <div className="px-4 pt-3 pb-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-600">Personal Safety</span>
          </div>

          <button
            onClick={() => setActiveTab('my-risk')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'my-risk'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Heart className="h-4.5 w-4.5" />
            <span>My Heat Safety</span>
            {!user && <span className="ml-auto text-[9px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-bold text-slate-500">LOGIN</span>}
          </button>

          <button
            onClick={() => setActiveTab('route-planner')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'route-planner'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Compass className="h-4.5 w-4.5" />
            <span>HeatSafe Route Planner</span>
          </button>

          <button
            onClick={() => setActiveTab('live-protection')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'live-protection'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <Radio className={`h-4.5 w-4.5 ${liveProtectionActive ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>Live Protection</span>
            {liveProtectionActive && (
              <span className="ml-auto flex items-center gap-1 text-[9px] bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'profile'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <User className="h-4.5 w-4.5" />
            <span>My Profile</span>
          </button>

          {/* Nav: Admin Controls (if logged in as admin or super_admin) */}
          {user && (user.role === 'admin' || user.role === 'super_admin') && (
            <>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] uppercase font-black tracking-widest text-amber-500">Administration</span>
              </div>

              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin-panel')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'admin-panel'
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30 shadow-md font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                >
                  <SettingsIcon className="h-4.5 w-4.5 text-amber-400" />
                  <span>Admin Dashboard</span>
                </button>
              )}

              {user.role === 'super_admin' && (
                <button
                  onClick={() => setActiveTab('super-admin-panel')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'super-admin-panel'
                      ? 'bg-gradient-to-r from-amber-500/25 to-red-500/15 text-amber-400 border border-amber-500/40 shadow-md font-extrabold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                >
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
                  <span>Super Admin Portal</span>
                </button>
              )}
            </>
          )}

          {/* Nav: Divider - System */}
          <div className="px-4 pt-3 pb-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-600">System</span>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${activeTab === 'settings'
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 border border-orange-500/30 shadow-md shadow-orange-950/30 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
          >
            <SettingsIcon className="h-4.5 w-4.5" />
            <span>System &amp; Thresholds</span>
          </button>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#0d1527]/80 shrink-0">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="bg-gradient-to-tr from-orange-600 to-amber-700 h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs ring-1 ring-orange-500/40 shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-slate-200">{user.name}</p>
                  <p className="text-[10px] text-amber-400 font-bold truncate">
                    {user.role === 'super_admin' ? 'Super Administrator' : user.role === 'admin' ? 'Administrator' : 'Registered User'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 hover:border-orange-500/40"
            >
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden theme-transition" style={{ background: 'var(--bg-primary)' }}>
        {/* Top Header */}
        <header className="h-16 px-4 md:px-6 flex items-center justify-between shrink-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
          {/* Mobile hamburger button */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-primary transition-colors mr-2 shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Dynamic Location Selection & Geocoding Search */}
          <div className="flex items-center space-x-4 flex-1 max-w-2xl">
            {/* Location Selector Dropdown */}
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <select
                value={selectedLocation?.id || ''}
                onChange={(e) => {
                  const loc = locations.find(l => String(l.id) === String(e.target.value));
                  if (loc) setSelectedLocation(loc);
                }}
                className="hs-input max-w-[200px] cursor-pointer"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city || loc.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Geocoding Dynamic City Search */}
            <div className="relative flex-1" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search any global city (e.g. Hyderabad, Delhi, Tokyo)..."
                  className="hs-input pl-9"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <Sun className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
                  </div>
                )}
              </div>

              {/* Geocoding Search Results Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div className="p-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    Open-Meteo Geocoding Results
                  </div>
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors"
                      style={{ borderBottom: '1px solid var(--border-muted)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="flex items-center space-x-2">
                        <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                        <div>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{result.name}</span>
                          <span className="text-[11px] ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                            ({[result.admin1, result.country].filter(Boolean).join(', ')})
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {result.latitude.toFixed(2)}°, {result.longitude.toFixed(2)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Status / Refresh / Alerts */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Last Updated Timestamp */}
            <div className="hidden lg:flex flex-col text-right pr-2">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Last Synced (UTC):</span>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                {lastRefreshed.toLocaleTimeString()}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="hs-btn hs-btn-ghost p-2 rounded-lg"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Refresh Button */}
            <button
              onClick={refreshData}
              disabled={refreshing}
              className={`hs-btn hs-btn-ghost p-2 rounded-lg ${refreshing ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              title="Fetch fresh live data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? { color: 'var(--accent)' } : {}} />
            </button>

            {/* Alerts Notification Bell */}
            <div
              className="relative cursor-pointer hs-btn hs-btn-ghost p-2 rounded-lg"
              onClick={() => setActiveTab('dashboard')}
              title="Active Early Warning Alerts"
            >
              <Bell className="h-4 w-4" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse" style={{ background: 'var(--danger)', boxShadow: '0 0 0 2px var(--bg-primary)' }}>
                  {unreadAlertCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* View Router Panel */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="relative">
                <Sun className="h-12 w-12 text-orange-500 animate-spin" />
                <Radio className="h-6 w-6 text-red-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-slate-300 text-sm font-semibold tracking-wide">
                Connecting to Open-Meteo Live API & Initializing PostgreSQL Engine...
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  location={selectedLocation}
                  onAlertAck={updateAlertCount}
                  user={user}
                  liveProtectionActive={liveProtectionActive}
                  onNavigateToLiveProtection={() => setActiveTab('live-protection')}
                  onOpenProfile={() => setActiveTab('profile')}
                  onRequireLogin={() => setShowAuthModal(true)}
                  key={selectedLocation ? `${selectedLocation.latitude}-${selectedLocation.longitude}` : 'dash'}
                />
              )}
              {activeTab === 'map' && (
                <RiskMap liveLocation={liveProtectionActive ? liveLocation : null} />
              )}
              {activeTab === 'route-planner' && (
                <HeatSafeRoutePlanner
                  user={user}
                  onRequireLogin={() => setShowAuthModal(true)}
                />
              )}
              {activeTab === 'my-risk' && (
                <PersonalRiskCard
                  user={user}
                  location={selectedLocation}
                  liveProtectionActive={liveProtectionActive}
                  onNavigateToLiveProtection={() => setActiveTab('live-protection')}
                  onRequireLogin={() => setShowAuthModal(true)}
                />
              )}
              {activeTab === 'live-protection' && (
                <LiveProtection
                  user={user}
                  onRequireLogin={() => setShowAuthModal(true)}
                  onLocationUpdate={(coords) => {
                    setLiveProtectionActive(true);
                    setLiveLocation(prev => ({ ...prev, ...coords }));
                  }}
                  onStopProtection={() => {
                    setLiveProtectionActive(false);
                    setLiveLocation(null);
                  }}
                />
              )}
              {activeTab === 'profile' && (
                <HeatHealthProfile
                  user={user}
                  onRequireLogin={() => setShowAuthModal(true)}
                  onProfileUpdated={() => { }}
                />
              )}
              {activeTab === 'uhi' && (
                <UhiHotspots
                  location={selectedLocation}
                  key={selectedLocation ? `uhi-${selectedLocation.latitude}-${selectedLocation.longitude}` : 'uhi'}
                />
              )}
              {activeTab === 'vulnerable' && (
                <VulnerableAdvisor
                  location={selectedLocation}
                  key={selectedLocation ? `vuln-${selectedLocation.latitude}-${selectedLocation.longitude}` : 'vuln'}
                />
              )}
              {activeTab === 'history' && (
                <HistoricalAnalytics
                  location={selectedLocation}
                  key={selectedLocation ? `hist-${selectedLocation.city}` : 'hist'}
                />
              )}
              {activeTab === 'admin-panel' && (
                <AdminDashboard user={user} />
              )}
              {activeTab === 'super-admin-panel' && (
                <SuperAdminDashboard user={user} />
              )}
              {activeTab === 'settings' && (
                <ThresholdSettings
                  isAdmin={!!user && (user.role === 'admin' || user.role === 'super_admin')}
                  onRequireLogin={() => setShowAuthModal(true)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Auth Modal ──────────────────────────────────────────────────────── */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(userData) => {
            setUser(userData);
            setShowAuthModal(false);
            if (userData.role === 'super_admin') {
              setActiveTab('super-admin-panel');
            } else if (userData.role === 'admin') {
              setActiveTab('admin-panel');
            } else {
              setActiveTab('dashboard');
            }
          }}
        />
      )}
    </div>
  );
}
