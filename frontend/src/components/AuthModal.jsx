import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  User, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Activity,
  Droplets,
  Building2
} from 'lucide-react';
import api from '../services/api';

export default function AuthModal({ onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Registration flow state
  const [regAccountType, setRegAccountType] = useState('user'); // 'user' | 'admin'
  const [regStep, setRegStep] = useState(1); // 1: Choose Account Type, 2: Basic Info + Profile
  
  // Common registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // User profile fields (Feature 8)
  const [ageGroup, setAgeGroup] = useState('18-44');
  const [vulnerabilityCategory, setVulnerabilityCategory] = useState('General Population');
  const [activityLevel, setActivityLevel] = useState('Mostly Indoor');
  const [waterAccess, setWaterAccess] = useState('Always available');
  const [heatSensitivity, setHeatSensitivity] = useState('No');
  const [alertThreshold, setAlertThreshold] = useState('High and Extreme');
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Status & Feedback state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAdminMsg, setPendingAdminMsg] = useState(null);

  // Handle LOGIN submit (Email + Password only - backend auto detects role)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPendingAdminMsg(null);
    setLoading(true);

    try {
      const res = await api.login(loginEmail, loginPassword);
      if (res.access_token) {
        onSuccess({
          id: res.user_id,
          name: res.name,
          email: res.email,
          role: res.role,
          status: res.status,
        });
      }
    } catch (err) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      if (msg.includes('awaiting approval')) {
        setPendingAdminMsg(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle REGISTER submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPendingAdminMsg(null);
    setLoading(true);

    try {
      if (regAccountType === 'user') {
        const payload = {
          account_type: 'user',
          name,
          email,
          password,
          age_group: ageGroup,
          vulnerability_category: vulnerabilityCategory,
          activity_level: activityLevel,
          water_access: waterAccess,
          heat_sensitivity: heatSensitivity,
          alert_threshold: alertThreshold,
          alerts_enabled: alertsEnabled,
        };
        const res = await api.register(payload);
        // Automatic login after user registration
        if (res.access_token) {
          onSuccess({
            id: res.user_id,
            name: res.name,
            email: res.email,
            role: res.role || 'user',
            status: res.status || 'active',
          });
        }
      } else {
        // Admin registration request
        const payload = {
          account_type: 'admin',
          name,
          email,
          password,
        };
        const res = await api.register(payload);
        setPendingAdminMsg(
          "Your administrator account request has been submitted for approval. You will receive access once approved by the primary administrator (venkatvamsi07@gmail.com)."
        );
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please check the provided information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden relative shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Gradient Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 h-2 w-full" />
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-2 rounded-xl transition-colors duration-150"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-7">
          
          {/* Header */}
          <div className="flex items-center space-x-3.5 mb-6">
            <div className="bg-orange-500/10 p-3 rounded-2xl border border-orange-500/20 text-orange-500">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {isLogin ? 'HeatShield AI Login' : 'Create HeatShield Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isLogin ? 'Enter your registered credentials to access your dashboard' : 'Join HeatShield AI for personalized live thermal protection'}
              </p>
            </div>
          </div>

          {/* Pending Admin Block Banner */}
          {pendingAdminMsg && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Approval Pending</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-200/90">
                {pendingAdminMsg}
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-4 rounded-2xl flex items-start space-x-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              LOGIN FORM — Email & Password ONLY (No account type radio!)
             ───────────────────────────────────────────────────────────────── */}
          {isLogin ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                    placeholder="e.g. user@example.com or venkatvamsi07@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all duration-150 mt-4 shadow-lg shadow-orange-950/40 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* ─────────────────────────────────────────────────────────────────
               REGISTRATION FLOW — Step 1: Account Type Selection, Step 2: Form
               ───────────────────────────────────────────────────────────────── */
            <div>
              {regStep === 1 ? (
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-extrabold text-white">What type of account are you creating?</h3>
                    <p className="text-xs text-slate-400">Select your account role to proceed with registration</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* USER Option */}
                    <button
                      type="button"
                      onClick={() => setRegAccountType('user')}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                        regAccountType === 'user'
                          ? 'bg-orange-500/10 border-orange-500 text-white ring-2 ring-orange-500/30'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl">
                          <User className="h-5 w-5" />
                        </div>
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          regAccountType === 'user' ? 'border-orange-500 bg-orange-500' : 'border-slate-600'
                        }`}>
                          {regAccountType === 'user' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-white block">USER Account</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Personal heat-health risk profile, live GPS protection, and precautions. Immediate access.
                        </span>
                      </div>
                    </button>

                    {/* ADMIN Option */}
                    <button
                      type="button"
                      onClick={() => setRegAccountType('admin')}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                        regAccountType === 'admin'
                          ? 'bg-orange-500/10 border-orange-500 text-white ring-2 ring-orange-500/30'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          regAccountType === 'admin' ? 'border-orange-500 bg-orange-500' : 'border-slate-600'
                        }`}>
                          {regAccountType === 'admin' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-white block">ADMIN Account</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          System management seat. Requires approval from Primary Administrator.
                        </span>
                      </div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRegStep(2)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Continue Registration</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Step 2: Fill Account Details */
                <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                      {regAccountType === 'user' ? 'User Profile Information' : 'Administrator Credentials'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Back to Role Selection</span>
                    </button>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>

                  {/* Email & Password */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* Additional Heat-Health Profile Questions for USER Registration (Feature 8) */}
                  {regAccountType === 'user' && (
                    <div className="space-y-3 pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Heat-Health Vulnerability Parameters
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Age Group</label>
                          <select
                            value={ageGroup}
                            onChange={(e) => setAgeGroup(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="Under 5">Under 5</option>
                            <option value="5–17">5–17</option>
                            <option value="18-44">18–44</option>
                            <option value="45-64">45–64</option>
                            <option value="65+">65+</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vulnerability Category</label>
                          <select
                            value={vulnerabilityCategory}
                            onChange={(e) => setVulnerabilityCategory(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="General Population">General Population</option>
                            <option value="Child">Child</option>
                            <option value="Elderly">Elderly</option>
                            <option value="Outdoor Worker">Outdoor Worker</option>
                            <option value="Athlete">Athlete</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Activity Level</label>
                          <select
                            value={activityLevel}
                            onChange={(e) => setActivityLevel(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="Mostly Indoor">Mostly Indoor</option>
                            <option value="Light Outdoor Activity">Light Outdoor Activity</option>
                            <option value="Moderate Physical Activity">Moderate Physical Activity</option>
                            <option value="Heavy Physical Activity">Heavy Physical Activity</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Water Access</label>
                          <select
                            value={waterAccess}
                            onChange={(e) => setWaterAccess(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="Always available">Always available</option>
                            <option value="Sometimes available">Sometimes available</option>
                            <option value="Usually unavailable">Usually unavailable</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {regAccountType === 'admin' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-[11px] text-amber-300">
                      ℹ️ Admin requests require approval from Primary Admin (venkatvamsi07@gmail.com). You will be notified upon approval.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all duration-150 mt-4 shadow-lg shadow-orange-950/40 disabled:opacity-50"
                  >
                    {loading 
                      ? 'Registering...' 
                      : regAccountType === 'user' ? 'Complete & Start Protection' : 'Submit Admin Application'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Toggle between Login and Register */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setPendingAdminMsg(null);
                setRegStep(1);
              }}
              className="text-xs text-orange-400 hover:text-orange-300 hover:underline font-semibold"
            >
              {isLogin ? "Don't have an account? Register as User or Admin" : 'Already registered? Sign in here'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
