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
} from 'lucide-react';
import { api } from '../../services/api';
import { Job } from '../../types';
import { Loading } from '../../components/Loading';

export const ManageJobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit job modal
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSalaryMin, setEditSalaryMin] = useState(100000);
  const [editSalaryMax, setEditSalaryMax] = useState(150000);
  const [editStatus, setEditStatus] = useState<'active' | 'closed'>('active');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await api.getRecruiterJobs();
      setJobs(res.jobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
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

  if (loading) return <Loading message="Loading recruiter postings..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Manage Job Requisitions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, close, or review candidates for each of your company's open roles.
          </p>
        </div>

        <Link
          to="/recruiter/jobs/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Job</span>
        </Link>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <Briefcase className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No active job postings</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You haven't posted any jobs under this recruiter account yet.
          </p>
          <Link
            to="/recruiter/jobs/create"
            className="mt-4 inline-block px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700"
          >
            Post Your First Job
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Job Title & Category</th>
                  <th className="px-6 py-4">Location & Type</th>
                  <th className="px-6 py-4">Salary Range</th>
                  <th className="px-6 py-4">Applicants</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{job.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{job.categoryName}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.location}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {job.workplaceType} • {job.jobType}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-800">
                      ${(job.salaryMin / 1000).toFixed(0)}k - ${(job.salaryMax / 1000).toFixed(0)}k
                    </td>

                    <td className="px-6 py-4">
                      <Link
                        to={`/recruiter/applicants?jobId=${job.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded-lg transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{job.applicantsCount} Candidates</span>
                      </Link>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          job.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(job)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Edit Job"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Edit Job: {editingJob.title}
              </h2>
              <button
                onClick={() => setEditingJob(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Min Salary ($)
                  </label>
                  <input
                    type="number"
                    value={editSalaryMin}
                    onChange={(e) => setEditSalaryMin(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Max Salary ($)
                  </label>
                  <input
                    type="number"
                    value={editSalaryMax}
                    onChange={(e) => setEditSalaryMax(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Posting Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="active">Active (Accepting applications)</option>
                  <option value="closed">Closed / Archived</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

