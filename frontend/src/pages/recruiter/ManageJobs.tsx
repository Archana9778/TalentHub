import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Plus,
  Eye,
  Users,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  UserCheck,
  ArrowRightLeft,
  Building2,
  Filter,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Job, User } from '../../types';
import { Loading } from '../../components/Loading';

export const ManageJobs: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyRecruiters, setCompanyRecruiters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<'assigned' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecruiterFilter, setSelectedRecruiterFilter] = useState('all');

  // Edit job modal
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSalaryMin, setEditSalaryMin] = useState(100000);
  const [editSalaryMax, setEditSalaryMax] = useState(150000);
  const [editStatus, setEditStatus] = useState<'active' | 'closed'>('active');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reassign job modal
  const [reassigningJob, setReassigningJob] = useState<Job | null>(null);
  const [targetRecruiterId, setTargetRecruiterId] = useState('');
  const [savingReassign, setSavingReassign] = useState(false);

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole;

  const fetchData = async () => {
    try {
      const [jobsRes, recruitersRes] = await Promise.all([
        api.getRecruiterJobs({ scope: 'company' }),
        api.getRecruiters(),
      ]);
      setJobs(jobsRes.jobs);
      setCompanyRecruiters(recruitersRes.recruiters.filter((r) => r.status === 'active'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting? This action cannot be undone.')) {
      return;
    }

    try {
      await api.deleteJob(id);
      setJobs(jobs.filter((j) => j.id !== id));
      setFeedback('Job posting deleted.');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to delete job.');
    }
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setEditTitle(job.title);
    setEditLocation(job.location);
    setEditSalaryMin(job.salaryMin);
    setEditSalaryMax(job.salaryMax);
    setEditStatus(job.status as any);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    setSavingEdit(true);
    try {
      const res = await api.updateJob(editingJob.id, {
        title: editTitle,
        location: editLocation,
        salaryMin: editSalaryMin,
        salaryMax: editSalaryMax,
        status: editStatus,
      });

      setJobs(jobs.map((j) => (j.id === editingJob.id ? res.job : j)));
      setEditingJob(null);
      setFeedback('Job updated successfully!');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to update job');
    } finally {
      setSavingEdit(false);
    }
  };

  const openReassignModal = (job: Job) => {
    setReassigningJob(job);
    setTargetRecruiterId(job.recruiterId);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningJob || !targetRecruiterId) return;

    setSavingReassign(true);
    try {
      const res = await api.assignJob(reassigningJob.id, targetRecruiterId);
      setJobs(jobs.map((j) => (j.id === reassigningJob.id ? res.job : j)));
      setReassigningJob(null);
      setFeedback(res.message || 'Job reassigned successfully!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign job.');
    } finally {
      setSavingReassign(false);
    }
  };

  if (loading) return <Loading message="Loading recruiter postings..." />;

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (scopeFilter === 'assigned' && job.recruiterId !== user?.id) {
      return false;
    }
    if (selectedRecruiterFilter !== 'all' && job.recruiterId !== selectedRecruiterFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.recruiterName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const myAssignedCount = jobs.filter((j) => j.recruiterId === user?.id).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold mb-1 border border-indigo-200">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{user?.companyName || 'CloudScale Technologies'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Job Ownership & Requisitions
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Manage your company's open job requisitions, recruiter assignments, and ownership transfers.
          </p>
        </div>

        <Link
          to="/recruiter/jobs/create"
          className="saas-btn-primary px-4 py-2 text-xs flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Job</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Company Jobs</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{jobs.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Assigned to You</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{myAssignedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Active Requisitions</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {jobs.filter((j) => j.status === 'active').length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Scope Toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              scopeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Company Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setScopeFilter('assigned')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              scopeFilter === 'assigned'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assigned to Me ({myAssignedCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
          {/* Recruiter Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Recruiter:</span>
            <select
              value={selectedRecruiterFilter}
              onChange={(e) => setSelectedRecruiterFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Recruiters</option>
              {companyRecruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.id === user?.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, location..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Jobs Grid / List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No job requisitions found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search filters or post a new job.</p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isAssignedToMe = job.recruiterId === user?.id;

            return (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                        job.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          job.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      ></span>
                      {job.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {job.categoryName}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {job.jobType} • {job.workplaceType}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{job.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {job.location}
                    </span>
                    <span>
                      ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} / year
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-indigo-600">
                      <Users className="w-3.5 h-3.5" />
                      {job.applicantsCount} Applicants
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Eye className="w-3.5 h-3.5" />
                      {job.viewsCount} Views
                    </span>
                  </div>

                  {/* Recruiter Ownership Indicator */}
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Assigned Recruiter:</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-semibold text-slate-800">{job.recruiterName}</span>
                      {isAssignedToMe && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5">
                  <Link
                    to={`/recruiter/applicants?jobId=${job.id}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>View Applicants ({job.applicantsCount})</span>
                  </Link>

                  {/* Reassign Button (Admin or Assigned Recruiter) */}
                  {(isCompanyAdmin || isAssignedToMe) && (
                    <button
                      onClick={() => openReassignModal(job)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors"
                      title="Reassign Job to Another Recruiter"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reassign Recruiter</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(job)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                      title="Quick Edit Job"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {(isCompanyAdmin || isAssignedToMe) && (
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                        title="Delete Job Posting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reassign Job Modal */}
      {reassigningJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Reassign Job Ownership</h3>
              </div>
              <button
                onClick={() => setReassigningJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                <div className="p-2.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-800 border border-slate-200">
                  {reassigningJob.title}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currently Assigned</label>
                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>{reassigningJob.recruiterName}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign to Recruiter <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetRecruiterId}
                  onChange={(e) => setTargetRecruiterId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {companyRecruiters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.designation || r.title || 'Recruiter'} {r.id === user?.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Only active recruiters belonging to {user?.companyName} can be assigned.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassigningJob(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReassign || targetRecruiterId === reassigningJob.recruiterId}
                  className="saas-btn-primary px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs"
                >
                  {savingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Edit Requisition Details</h3>
              <button
                onClick={() => setEditingJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Salary ($)</label>
                  <input
                    type="number"
                    value={editSalaryMin}
                    onChange={(e) => setEditSalaryMin(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Salary ($)</label>
                  <input
                    type="number"
                    value={editSalaryMax}
                    onChange={(e) => setEditSalaryMax(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active (Open to Applicants)</option>
                  <option value="closed">Closed (Archived)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="saas-btn-primary px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {savingEdit ? 'Saving...' : 'Save Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
