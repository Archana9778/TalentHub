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
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Please provide your email address.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (!password) {
      errors.password = 'Please provide your password.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setServerError(null);
    setLoading(true);
    try {
      const loggedUser = await login(email.trim().toLowerCase(), password);
      if (loggedUser.role === 'admin') navigate('/admin/dashboard');
      else if (loggedUser.role === 'recruiter') navigate('/recruiter/dashboard');
      else navigate('/candidate/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Authentication failed. Please verify your email and password.');
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
            <span>Enterprise Role-Based Access Control</span>
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
              <span>Role-Based Access Control: Candidate, Recruiter &amp; Admin</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cryptographic Session Security &amp; HttpOnly Cookie Auth</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} TalentHub Inc. Enterprise Recruitment System.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
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
              Welcome back. Enter your credentials to access your dashboard.
            </p>
          </div>

          {serverError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="name@company.com"
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  className={`saas-input pl-9 text-xs ${fieldErrors.email ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password <span className="text-rose-500">*</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="••••••••••••"
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'login-pass-error' : undefined}
                  className={`saas-input pl-9 pr-9 text-xs ${fieldErrors.password ? 'border-rose-400 focus:border-rose-500' : ''}`}
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
              {fieldErrors.password && (
                <p id="login-pass-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full saas-btn-primary justify-center text-xs py-2.5 mt-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Seeded Accounts Reference (Guidance without hardcoded password bypasses) */}
          <div className="pt-3 border-t border-slate-200">
            <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Default Seed Accounts for Evaluation:</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-slate-500 text-[11px]">
                <div>
                  • Candidate: <button type="button" onClick={() => setEmail('candidate@talenthub.com')} className="text-blue-600 underline font-mono">candidate@talenthub.com</button>
                </div>
                <div>
                  • Recruiter: <button type="button" onClick={() => setEmail('recruiter@techcorp.com')} className="text-blue-600 underline font-mono">recruiter@techcorp.com</button>
                </div>
                <div>
                  • Admin: <button type="button" onClick={() => setEmail('admin@talenthub.com')} className="text-blue-600 underline font-mono">admin@talenthub.com</button>
                </div>
              </div>
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
