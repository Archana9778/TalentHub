import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
    if (!email || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'admin') navigate('/admin/dashboard');
      else if (loggedUser.role === 'recruiter') navigate('/recruiter/dashboard');
      else navigate('/candidate/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (role: 'candidate' | 'recruiter' | 'admin') => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoRole(role);
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'recruiter') navigate('/recruiter/dashboard');
      else navigate('/candidate/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* Left Branding Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 border-r border-slate-800 relative overflow-hidden">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Talent<span className="text-blue-400">Hub</span>
            </span>
          </Link>
        </div>

        <div className="max-w-md my-auto">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Azure IaaS Architecture &amp; AKS Compatible</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            High-velocity applicant tracking for modern teams.
          </h2>

          <p className="mt-4 text-slate-400 text-sm leading-relaxed">
            Consolidate engineering candidates, track screening and interview pipelines, and surface high-match technical talent with explainable scoring.
          </p>

          <div className="mt-8 pt-8 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Node.js + Express + TypeScript REST API</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Local Heuristic Resume Matching</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Immutable Relational Stage Audit Trails</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} TalentHub Inc. Enterprise Recruitment System.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div>
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="font-extrabold text-lg text-slate-900">TalentHub</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Sign in to your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Welcome back. Enter your credentials or use a pre-seeded demo role below.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="saas-input pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="saas-input pl-9 pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full saas-btn-primary justify-center text-xs py-2.5 mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="pt-4 border-t border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2.5">
              Instant Demo Access
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDemoSignIn('candidate')}
                disabled={loading}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex flex-col items-center gap-1 transition-colors"
              >
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Candidate</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSignIn('recruiter')}
                disabled={loading}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex flex-col items-center gap-1 transition-colors"
              >
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Recruiter</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSignIn('admin')}
                disabled={loading}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex flex-col items-center gap-1 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
