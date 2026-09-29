import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Mail, 
  Crown, 
  RefreshCw, 
  AlertTriangle, 
  Building2, 
  UserCheck, 
  UserX,
  Radio,
  Lock,
  Sparkles,
  Shield,
  CalendarCheck,
  Hash
} from 'lucide-react';
import api from '../services/api';

export default function SuperAdminDashboard({ user }) {
  const [requests, setRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [adminList, setAdminList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // id being approved/rejected
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSuperAdminData();
  }, []);

  const loadSuperAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [reqRes, usersRes, adminsRes] = await Promise.all([
        api.getAdminRequests().catch(() => ({ data: [] })),
        api.getAdminUsers().catch(() => ({ data: [] })),
        api.getAdminList().catch(() => ({ data: [] })),
      ]);

      setRequests(reqRes.data || []);
      setUsersList(usersRes.data || []);
      setAdminList(adminsRes.data || []);
    } catch (err) {
      console.error("Super Admin data load error:", err);
      setError(err.message || "Failed to load administrative requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reqId) => {
    try {
      setActionLoading(reqId);
      setError(null);
      const res = await api.approveAdminRequest(reqId);
      setSuccessMsg(res.message || "Admin request approved successfully!");
      await loadSuperAdminData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Approve error:", err);
      setError(err.message || "Failed to approve admin request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reqId) => {
    try {
      setActionLoading(reqId);
      setError(null);
      const res = await api.rejectAdminRequest(reqId);
      setSuccessMsg(res.message || "Admin request rejected.");
      await loadSuperAdminData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Reject error:", err);
      setError(err.message || "Failed to reject admin request.");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <Crown className="h-8 w-8 text-amber-400 animate-bounce" />
        <p className="text-xs text-slate-400 font-semibold">Loading Primary Super-Admin Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* ── Super Admin Master Header ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-red-950/80 border border-amber-500/30 rounded-3xl p-6 lg:p-7 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 rounded-2xl shadow-xl shadow-amber-950/50 text-white ring-2 ring-amber-400/40">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Primary Administrator Portal</h2>
              <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Primary Account: <span className="font-mono text-amber-300 font-bold">venkatvamsi07@gmail.com</span>. Review administrator registration requests and manage permissions.
            </p>
          </div>
        </div>

        <button
          onClick={loadSuperAdminData}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700 transition-all flex items-center space-x-2 shrink-0"
        >
          <RefreshCw className="h-4 w-4 text-amber-400" />
          <span>Refresh Requests</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-2xl flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Pending Admin Approval Requests Card ───────────────────────────── */}
      <div className="bg-[#0f172a] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                Pending Administrator Account Requests ({pendingRequests.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Each applicant requires explicit approval from venkatvamsi07@gmail.com before gaining admin capabilities.
              </p>
            </div>
          </div>

          <span className="text-[10px] uppercase font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            Secure Token Enabled
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800/80 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No Pending Administrator Requests</p>
            <p className="text-[11px] text-slate-500">All admin account applications have been processed.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {pendingRequests.map((req) => (
              <div key={req.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-white">{req.applicant_name}</span>
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      Request #{req.id}
                    </span>
                  </div>
                  <div className="text-xs text-amber-400 font-mono flex items-center space-x-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{req.applicant_email}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Requested: {req.created_at ? new Date(req.created_at).toLocaleString() : 'Recently'}
                  </div>
                </div>

                {/* Approve & Reject Action Buttons */}
                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionLoading === req.id}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <UserX className="h-4 w-4" />
                    <span>REJECT ADMIN</span>
                  </button>

                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionLoading === req.id}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/40 transition-all flex items-center space-x-1.5"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{actionLoading === req.id ? 'Approving...' : 'APPROVE ADMIN'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* ── Registered Accounts Registry Table ──────────────────────────────── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-400" />
            User &amp; Administrator Account Registry ({usersList.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">PostgreSQL Database</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email Address</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Account Status</th>
                <th className="pb-3">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-200">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/50">
                  <td className="py-3 text-slate-100 font-bold">{u.name}</td>
                  <td className="py-3 text-slate-300 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      u.role === 'super_admin'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : u.role === 'admin'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      u.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : u.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 text-[11px] font-mono">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Administrator Account Registry Table ─────────────────────────────── */}
      <div className="bg-[#0f172a] border border-amber-500/20 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                Administrator Registry
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-black">
                  {adminList.length} ADMINS
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">All admin and super-admin accounts with approval details — stored in PostgreSQL</p>
            </div>
          </div>
          <span className="text-[11px] text-amber-400/70 font-mono bg-amber-500/5 border border-amber-500/20 px-2.5 py-1 rounded-lg">Super Admin View</span>
        </div>

        {adminList.length === 0 ? (
          <div className="py-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800/80 space-y-2">
            <Shield className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">No Administrator Accounts Found</p>
            <p className="text-[11px] text-slate-500">Approved admin accounts will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email Address</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Account Status</th>
                  <th className="pb-3 pr-4">Request Status</th>
                  <th className="pb-3 pr-4">Approved At</th>
                  <th className="pb-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-200">
                {adminList.map((a) => (
                  <tr key={a.id} className="hover:bg-amber-500/5 transition-colors">
                    {/* ID */}
                    <td className="py-3 pr-4">
                      <span className="text-[11px] font-mono text-slate-500">#{a.request_id ?? '—'}</span>
                    </td>

                    {/* Name */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          a.role === 'super_admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {a.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-slate-100 font-bold whitespace-nowrap">{a.name}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 pr-4">
                      <span className="text-slate-300 font-mono text-[11px]">{a.email}</span>
                    </td>

                    {/* Role */}
                    <td className="py-3 pr-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        a.role === 'super_admin'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                      }`}>
                        {a.role === 'super_admin' ? '👑 Super Admin' : '🛡 Admin'}
                      </span>
                    </td>

                    {/* Account Status */}
                    <td className="py-3 pr-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : a.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {a.status}
                      </span>
                    </td>

                    {/* Request Status */}
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                        a.request_status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : a.request_status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          : a.request_status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {a.request_status}
                      </span>
                    </td>

                    {/* Approved At */}
                    <td className="py-3 pr-4 text-slate-500 text-[11px] font-mono">
                      {a.approved_at
                        ? new Date(a.approved_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                        : <span className="text-slate-600">—</span>}
                    </td>

                    {/* Joined */}
                    <td className="py-3 text-slate-500 text-[11px] font-mono">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800/60 text-[10px] text-slate-600 flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          Admin accounts require explicit approval from the Super Administrator. All changes are persisted in PostgreSQL.
        </div>
      </div>
    </div>
  );
}
