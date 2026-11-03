import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  LogOut,
  UserCheck,
  Shield,
  Layers,
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
    candidate: { badge: 'bg-blue-50 text-blue-700 border-blue-200', text: 'Candidate', icon: UserCheck },
    recruiter: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'Recruiter', icon: Layers },
    admin: { badge: 'bg-slate-100 text-slate-800 border-slate-300', text: 'Administrator', icon: Shield },
  };

  const currentRoleInfo = user ? roleColors[user.role] : null;

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Talent<span className="text-blue-600">Hub</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Enterprise ATS
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Demo Role Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <span className="px-2 font-medium text-slate-500 text-[11px]">Role Switcher:</span>
          <button
            onClick={() => handleRoleSwitch('candidate')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all text-xs ${
              user?.role === 'candidate'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Candidate
          </button>
          <button
            onClick={() => handleRoleSwitch('recruiter')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all text-xs ${
              user?.role === 'recruiter'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recruiter
          </button>
          <button
            onClick={() => handleRoleSwitch('admin')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all text-xs ${
              user?.role === 'admin'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
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
                  className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${currentRoleInfo.badge}`}
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
                className="text-xs font-semibold text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-md"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="saas-btn-primary text-xs py-1.5 px-3"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
