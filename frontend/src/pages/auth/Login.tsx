import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase, Lock, Mail, ArrowRight, Sparkles, AlertCircle,
  Eye, EyeOff, Users, BarChart3, Shield, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FEATURES = [
  { icon: Users, label: 'Applicant Tracking', desc: 'End-to-end candidate pipeline management' },
  { icon: BarChart3, label: 'AI Match Scoring', desc: 'Instant skill match & ranking for every applicant' },
  { icon: Shield, label: 'Role-Based Access', desc: 'Separate portals for Candidates, Recruiters & Admins' },
  { icon: CheckCircle2, label: 'Real-Time Updates', desc: 'Live stage transitions across the entire ATS board' },
];

const DEMO_ROLES = [
  { role: 'candidate' as const, label: '👤 Candidate', color: 'blue' },
  { role: 'recruiter' as const, label: '🏢 Recruiter', color: 'purple' },
  { role: 'admin' as const, label: '🛡️ Admin', color: 'rose' },
];

export const Login: React.FC = () => {
  const { login, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'admin') navigate('/admin/dashboard');
      else if (loggedUser.role === 'recruiter') navigate('/recruiter/dashboard');
      else navigate('/candidate/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = async (role: 'candidate' | 'recruiter' | 'admin') => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoRole(role);
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'recruiter') navigate('/recruiter/dashboard');
      else navigate('/candidate/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL – Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-600/30 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur text-white shadow-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">TalentHub</span>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Hire smarter.<br />
              <span className="text-blue-300">Track faster.</span>
            </h1>
            <p className="mt-4 text-blue-200/80 text-base leading-relaxed max-w-sm">
              The enterprise ATS built on Azure architecture — connecting top talent with the right opportunities at scale.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-200" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{label}</p>
                  <p className="text-blue-300/70 text-xs">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-400/60 text-xs">
          © 2026 TalentHub · Enterprise ATS · Azure IaaS Architecture
        </div>
      </div>

      {/* ── RIGHT PANEL – Login Form ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 px-6 py-12 sm:px-10 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white shadow-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">TalentHub</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-400">Sign in to your TalentHub account to continue.</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-700/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Logins */}
          <div className="mt-8">
            <div className="relative flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
                <Sparkles className="w-3 h-3 text-amber-400" />
                One-click demo
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map(({ role, label, color }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoFill(role)}
                  disabled={loading}
                  className={`py-2.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-40 ${
                    color === 'blue'
                      ? 'bg-blue-600/10 border-blue-500/30 text-blue-300 hover:bg-blue-600/25 hover:border-blue-400/60'
                      : color === 'purple'
                      ? 'bg-purple-600/10 border-purple-500/30 text-purple-300 hover:bg-purple-600/25 hover:border-purple-400/60'
                      : 'bg-rose-600/10 border-rose-500/30 text-rose-300 hover:bg-rose-600/25 hover:border-rose-400/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Register link */}
          <p className="mt-8 text-center text-xs text-slate-500">
            No account yet?{' '}
            <Link to="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Register as Candidate or Recruiter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
