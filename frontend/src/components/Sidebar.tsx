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
    { to: '/candidate/dashboard', label: 'Candidate Dashboard', icon: LayoutDashboard },
    { to: '/candidate/jobs', label: 'Search & Explore Jobs', icon: Search },
    { to: '/candidate/applications', label: 'Track Applications', icon: FileCheck2 },
    { to: '/candidate/profile', label: 'Profile Management', icon: User },
    { to: '/candidate/alerts', label: 'Job Alerts', icon: BellRing },
  ];

  const recruiterLinks = [
    { to: '/recruiter/dashboard', label: 'Recruiter Dashboard', icon: LayoutDashboard },
    { to: '/recruiter/jobs', label: 'Manage Jobs', icon: Briefcase },
    { to: '/recruiter/jobs/create', label: 'Post New Job', icon: PlusCircle },
    { to: '/recruiter/applicants', label: 'Applicant Tracking (ATS)', icon: Users },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Manage Users', icon: Users },
    { to: '/admin/companies', label: 'Manage Companies', icon: Building2 },
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
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80 p-4 select-none">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
        {user.role} Navigation
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
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
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
            <span>Azure Tier Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
            <div>Tier 1: React + NGINX</div>
            <div>Tier 2: Spring / REST API</div>
            <div>Tier 3: Azure MySQL</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

