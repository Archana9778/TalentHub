import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Briefcase,
  FileCheck2,
  User,
  BellRing,
  PlusCircle,
  Users,
  Building2,
  FolderTree,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();
  if (!user) return null;

  const candidateLinks = [
    { to: '/candidate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/candidate/jobs', label: 'Explore Jobs', icon: Search },
    { to: '/candidate/applications', label: 'My Applications', icon: FileCheck2 },
    { to: '/candidate/profile', label: 'Profile & Resume', icon: User },
    { to: '/candidate/alerts', label: 'Job Alerts', icon: BellRing },
  ];

  const recruiterLinks = [
    { to: '/recruiter/dashboard', label: 'Recruiter Dashboard', icon: LayoutDashboard },
    { to: '/recruiter/jobs', label: 'Manage Jobs', icon: Briefcase },
    { to: '/recruiter/jobs/create', label: 'Post a New Job', icon: PlusCircle },
    { to: '/recruiter/applicants', label: 'Applicant Board (ATS)', icon: Users },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/companies', label: 'Companies', icon: Building2 },
    { to: '/admin/categories', label: 'Job Categories', icon: FolderTree },
    { to: '/admin/reported-jobs', label: 'Reported Jobs Queue', icon: AlertTriangle },
  ];

  const links =
    user.role === 'admin'
      ? adminLinks
      : user.role === 'recruiter'
      ? recruiterLinks
      : candidateLinks;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 p-4 select-none">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2.5">
        {user.role === 'candidate' ? 'Job Seeker Portal' : user.role === 'recruiter' ? 'Recruiting ATS' : 'System Administration'}
      </div>

      <nav className="space-y-1 flex-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Azure Architecture Infrastructure Pill */}
      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-semibold mb-1 text-[11px]">
            <span>System Health</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>ONLINE</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <div>Tier 1: React 18 SPA (Vite)</div>
            <div>Tier 2: Java 21 / Spring Boot 3</div>
            <div>Tier 3: MySQL 8 / H2 Persistent</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative w-72 max-w-xs bg-white shadow-xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
