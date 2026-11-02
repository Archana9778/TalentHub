import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  LogOut,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface NavbarProps {
  onMobileMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const { user, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleSwitch = async (role: UserRole) => {
    await switchDemoRole(role);
    if (role === 'candidate') navigate('/candidate/dashboard');
    if (role === 'recruiter') navigate('/recruiter/dashboard');
    if (role === 'admin') navigate('/admin/dashboard');
  };

  const roleColors: Record<UserRole, { badge: string; text: string; icon: any }> = {
    candidate: { badge: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Job Seeker', icon: UserCheck },
    recruiter: { badge: 'bg-purple-100 text-purple-800 border-purple-200', text: 'Recruiter', icon: Layers },
    admin: { badge: 'bg-rose-100 text-rose-800 border-rose-200', text: 'Admin', icon: Shield },
  };

  const currentRoleInfo = user ? roleColors[user.role] : null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Talent<span className="text-blue-600">Hub</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                  Azure ATS
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Quick Demo Role Switcher */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs">
          <span className="px-2 font-medium text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Switch Role:</span>
          </span>
          <button
            onClick={() => handleRoleSwitch('candidate')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              user?.role === 'candidate'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Candidate
          </button>
          <button
            onClick={() => handleRoleSwitch('recruiter')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              user?.role === 'recruiter'
                ? 'bg-white text-purple-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recruiter
          </button>
          <button
            onClick={() => handleRoleSwitch('admin')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              user?.role === 'admin'
                ? 'bg-white text-rose-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-slate-900">{user.name}</span>
                <span className="text-[11px] text-slate-500">{user.email}</span>
              </div>

              {currentRoleInfo && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${currentRoleInfo.badge}`}
                >
                  <currentRoleInfo.icon className="w-3 h-3" />
                  <span>{currentRoleInfo.text}</span>
                </span>
              )}

              <img
                src={
                  user.avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`
                }
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
              />

              <button
                onClick={logout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-700 hover:text-blue-600 px-3 py-2 rounded-lg"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg shadow-xs transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

