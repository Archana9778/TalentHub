import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Lock,
  Mail,
  User,
  Building,
  MapPin,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PasswordStrengthIndicator } from '../../components/PasswordStrengthIndicator';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole = searchParams.get('role') === 'recruiter' ? 'recruiter' : 'candidate';
  const [role, setRole] = useState<'candidate' | 'recruiter'>(initialRole);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strengthResult = evaluatePasswordStrength(password);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Please provide your full name.';
    } else if (name.trim().length < 2) {
      errors.name = 'Full name must contain at least 2 characters.';
    }

    if (!email.trim()) {
      errors.email = 'Please provide your email address.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please provide a valid work email address.';
      }
    }

    if (role === 'recruiter' && !companyName.trim()) {
      errors.companyName = 'Company / organization name is required for recruiter accounts.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (!strengthResult.isValid) {
      errors.password = 'Password must meet all 5 requirements listed below.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
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
      const newUser = await register({
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        name: name.trim(),
        role,
        companyName: role === 'recruiter' ? companyName.trim() : undefined,
        title: title.trim() || (role === 'recruiter' ? 'Talent Acquisition' : 'Software Engineer'),
        location: location.trim() || 'Remote, US',
      });

      if (newUser.role === 'recruiter') {
        navigate('/recruiter/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please review your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* Left Branding Panel */}
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
            <span>Join 1,000+ Engineering Teams &amp; Candidates</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            The candidate-first, recruiter-optimized ATS platform.
          </h2>

          <p className="mt-4 text-slate-400 text-sm leading-relaxed">
            Create an enterprise profile to explore verified technical roles or manage your organization's entire candidate recruitment pipeline.
          </p>

          <div className="mt-8 pt-8 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Candidate Profile &amp; Resume Skill Parsing</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-Time Status Progress from Applied to Hired</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Strict Password Complexity &amp; Session Invalidation</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} TalentHub Inc. Enterprise Recruitment System.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div>
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="font-extrabold text-lg text-slate-900">TalentHub</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Select your role and enter your details to get started.
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setRole('candidate');
                if (fieldErrors.companyName) {
                  const copy = { ...fieldErrors };
                  delete copy.companyName;
                  setFieldErrors(copy);
                }
              }}
              className={`py-2 rounded-md font-semibold transition-all ${
                role === 'candidate'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Job Seeker (Candidate)
            </button>
            <button
              type="button"
              onClick={() => setRole('recruiter')}
              className={`py-2 rounded-md font-semibold transition-all ${
                role === 'recruiter'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Hiring Team (Recruiter)
            </button>
          </div>

          {serverError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      const copy = { ...fieldErrors };
                      delete copy.name;
                      setFieldErrors(copy);
                    }
                  }}
                  placeholder="e.g. Alex Morgan"
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  className={`saas-input pl-9 text-xs ${fieldErrors.name ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
              </div>
              {fieldErrors.name && (
                <p id="name-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.name}</span>
                </p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      const copy = { ...fieldErrors };
                      delete copy.email;
                      setFieldErrors(copy);
                    }
                  }}
                  placeholder="name@example.com"
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                  className={`saas-input pl-9 text-xs ${fieldErrors.email ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
              </div>
              {fieldErrors.email && (
                <p id="reg-email-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            {/* Recruiter-specific Company field */}
            {role === 'recruiter' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (fieldErrors.companyName) {
                        const copy = { ...fieldErrors };
                        delete copy.companyName;
                        setFieldErrors(copy);
                      }
                    }}
                    placeholder="e.g. CloudScale Technologies"
                    required
                    aria-invalid={!!fieldErrors.companyName}
                    aria-describedby={fieldErrors.companyName ? 'comp-error' : undefined}
                    className={`saas-input pl-9 text-xs ${fieldErrors.companyName ? 'border-rose-400 focus:border-rose-500' : ''}`}
                  />
                </div>
                {fieldErrors.companyName && (
                  <p id="comp-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.companyName}</span>
                  </p>
                )}
              </div>
            )}

            {/* Title & Location fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {role === 'recruiter' ? 'Recruiting Title' : 'Professional Title'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={role === 'recruiter' ? 'Talent Acquisition' : 'Full Stack Engineer'}
                  className="saas-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Seattle, WA / Remote"
                    className="saas-input pl-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      const copy = { ...fieldErrors };
                      delete copy.password;
                      setFieldErrors(copy);
                    }
                  }}
                  placeholder="Min 12 characters"
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'reg-pass-error' : undefined}
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
                <p id="reg-pass-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}

              {/* Real-time Password Strength and Requirements Checklist */}
              <PasswordStrengthIndicator password={password} showRequirements={true} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      const copy = { ...fieldErrors };
                      delete copy.confirmPassword;
                      setFieldErrors(copy);
                    }
                  }}
                  placeholder="Re-type password"
                  required
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? 'reg-confirm-error' : undefined}
                  className={`saas-input pl-9 pr-9 text-xs ${fieldErrors.confirmPassword ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="reg-confirm-error" className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.confirmPassword}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !strengthResult.isValid}
              className="w-full saas-btn-primary justify-center text-xs py-2.5 mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-200">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
