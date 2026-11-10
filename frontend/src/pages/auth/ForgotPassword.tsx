import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    setEmailError(null);
    if (!email.trim()) {
      setEmailError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setServerError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err.message || 'Unable to process your request. Please try again.');
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
            <span>Secure Password Recovery</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Account Security &amp; Access Recovery
          </h2>

          <p className="mt-4 text-slate-400 text-sm leading-relaxed">
            TalentHub enforces cryptographic single-use recovery tokens with strict expiration and automatic session invalidation upon credential change.
          </p>

          <div className="mt-8 pt-8 border-t border-slate-800 space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>SHA-256 Hashed Recovery Tokens</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>15-Minute Short-Lived Expiration</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Protection Against Account Enumeration</span>
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

            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <KeyRound className="w-5 h-5" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Reset your password
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Enter the email address registered with your TalentHub account. We will send you a secure link to reset your password.
            </p>
          </div>

          {serverError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {submitted ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Password Reset Request Received</span>
                </div>
                <p className="leading-relaxed">
                  If an account with <strong>{email}</strong> exists in our system, an email with instructions to reset your password has been dispatched.
                </p>
                <p className="text-[11px] text-emerald-700">
                  Please check your inbox and spam folder. The reset link expires in 15 minutes.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full saas-btn-primary justify-center text-xs py-2.5 flex items-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
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
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="name@company.com"
                    required
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'email-error' : undefined}
                    className={`saas-input pl-9 text-xs ${emailError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                  />
                </div>
                {emailError && (
                  <p id="email-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full saas-btn-primary justify-center text-xs py-2.5 mt-2"
              >
                <span>{loading ? 'Sending Instructions...' : 'Send Reset Link'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

