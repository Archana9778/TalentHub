import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  Briefcase,
  Building2,
  AlertTriangle,
  FolderTree,
  TrendingUp,
  Activity,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { SystemStats } from '../../types';
import { Loading } from '../../components/Loading';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getSystemStats();
        setStats(res.stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <Loading message="Loading platform governance metrics..." />;
  if (!stats) return null;

  return (
    <div className="dashboard-container space-y-8 w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-rose-200 mb-3">
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>Platform Governance & Administration Tier</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            TalentHub Control Center
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Monitor platform health, audit user compliance, manage registered companies and categories, and moderate reported postings.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-100 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4 text-rose-600" />
              <span>Manage User Directory</span>
            </Link>
            <Link
              to="/admin/reported-jobs"
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600/40 hover:bg-rose-600 text-white font-semibold rounded-xl text-xs sm:text-sm border border-rose-500/30 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>Reported Jobs ({stats.pendingReports})</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
          <p className="mt-1 text-xs text-slate-400">
            {stats.totalCandidates} Candidates • {stats.totalRecruiters} Recruiters
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Companies
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{stats.totalCompanies}</div>
          <p className="mt-1 text-xs text-slate-400">Verified hiring orgs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Jobs
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{stats.activeJobs}</div>
          <p className="mt-1 text-xs text-slate-400">Out of {stats.totalJobs} total postings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Reported Jobs
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{stats.pendingReports}</div>
          <p className="mt-1 text-xs text-slate-400">Pending moderation</p>
        </div>
      </div>

      {/* Two Columns: Top In-Demand Skills & Stage Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Demanded Skills */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Top In-Demand Technical Skills</span>
            </h2>
            <span className="text-xs text-slate-400">From live job postings</span>
          </div>

          <div className="space-y-3 pt-2">
            {stats.topSkillsInDemand.map(({ skill, count }) => {
              const maxCount = stats.topSkillsInDemand[0]?.count || 1;
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={skill} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{skill}</span>
                    <span className="text-slate-500">{count} Postings</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Applications Stage Funnel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>System-Wide Hiring Pipeline Distribution</span>
            </h2>
            <span className="text-xs text-slate-400">
              Avg Time-to-Hire: {stats.timeToHireDaysAverage} days
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {Object.entries(stats.stageCounts).map(([stage, count]) => (
              <div key={stage} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs font-semibold text-slate-500 uppercase">{stage}</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{count}</div>
                <div className="text-[10px] text-slate-400 mt-1">Applications</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link
          to="/admin/users"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <Users className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="font-bold text-slate-900 text-sm">User Management</div>
          <p className="text-xs text-slate-400 mt-1">Manage accounts, suspend users, edit roles</p>
        </Link>

        <Link
          to="/admin/companies"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-400 hover:shadow-md transition-all group"
        >
          <Building2 className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="font-bold text-slate-900 text-sm">Companies Directory</div>
          <p className="text-xs text-slate-400 mt-1">Verify organizations and manage listings</p>
        </Link>

        <Link
          to="/admin/categories"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all group"
        >
          <FolderTree className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="font-bold text-slate-900 text-sm">Job Categories</div>
          <p className="text-xs text-slate-400 mt-1">Create and configure classification taxonomy</p>
        </Link>

        <Link
          to="/admin/reported-jobs"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-400 hover:shadow-md transition-all group"
        >
          <AlertTriangle className="w-6 h-6 text-rose-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="font-bold text-slate-900 text-sm">Reported Jobs</div>
          <p className="text-xs text-slate-400 mt-1">Review flagged job postings & scams</p>
        </Link>
      </div>
    </div>
  );
};


