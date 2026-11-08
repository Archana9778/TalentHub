import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit,
  Power,
  Shield,
  Briefcase,
  Mail,
  Phone,
  AlertCircle,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, CompanyRole, UserStatus } from '../../types';
import { Loading } from '../../components/Loading';

export const RecruiterManagement: React.FC = () => {
  const { user } = useAuth();
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Recruiter Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    contactNumber: '',
    designation: '',
    companyRole: 'recruiter' as CompanyRole,
    status: 'active' as UserStatus,
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Recruiter Modal
  const [editingRecruiter, setEditingRecruiter] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    contactNumber: '',
    designation: '',
    companyRole: 'recruiter' as CompanyRole,
    status: 'active' as UserStatus,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Status Toggle Action Dialog
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole;

  const fetchRecruiters = async () => {
    try {
      const res = await api.getRecruiters({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });
      setRecruiters(res.recruiters);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load recruiters.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecruiters();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecruiters();
  };

  const validateAddForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!addForm.name.trim()) errs.name = 'Full name is required.';
    if (!addForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim())) {
      errs.email = 'A valid email address is required.';
    }
    if (!addForm.password || addForm.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (!addForm.designation.trim()) errs.designation = 'Designation/Job Title is required.';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setSubmittingAdd(true);
    setFeedback(null);

    try {
      const res = await api.addRecruiter({
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        contactNumber: addForm.contactNumber,
        designation: addForm.designation,
        companyRole: addForm.companyRole,
        status: addForm.status,
      });

      setRecruiters((prev) => [res.recruiter, ...prev]);
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        password: '',
        contactNumber: '',
        designation: '',
        companyRole: 'recruiter',
        status: 'active',
      });
      setFeedback({
        type: 'success',
        message: `Recruiter "${res.recruiter.name}" successfully added to company!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add recruiter.' });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const openEditModal = (rec: User) => {
    setEditingRecruiter(rec);
    setEditForm({
      name: rec.name || '',
      email: rec.email || '',
      password: '',
      contactNumber: rec.contactNumber || rec.phone || '',
      designation: rec.designation || rec.title || '',
      companyRole: rec.companyRole || 'recruiter',
      status: rec.status || 'active',
    });
    setEditErrors({});
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecruiter) return;

    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = 'Full name is required.';
    if (!editForm.email.trim()) errs.email = 'Email address is required.';
    if (editForm.password && editForm.password.length < 6) {
      errs.password = 'Password must be at least 6 characters if updating.';
    }
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setSubmittingEdit(true);
    setFeedback(null);

    try {
      const payload: any = {
        name: editForm.name,
        email: editForm.email,
        contactNumber: editForm.contactNumber,
        phone: editForm.contactNumber,
        designation: editForm.designation,
        title: editForm.designation,
        companyRole: editForm.companyRole,
        status: editForm.status,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }

      const res = await api.updateRecruiter(editingRecruiter.id, payload);
      setRecruiters((prev) => prev.map((r) => (r.id === editingRecruiter.id ? res.recruiter : r)));
      setEditingRecruiter(null);
      setFeedback({ type: 'success', message: 'Recruiter details updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update recruiter.' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleTarget) return;

    setTogglingStatus(true);
    setFeedback(null);

    const nextStatus = toggleTarget.status === 'active' ? 'inactive' : 'active';

    try {
      const res = await api.updateRecruiterStatus(toggleTarget.id, nextStatus as any);
      setRecruiters((prev) => prev.map((r) => (r.id === toggleTarget.id ? res.recruiter : r)));
      setToggleTarget(null);
      setFeedback({
        type: 'success',
        message: `Account status for "${res.recruiter.name}" updated to ${nextStatus}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status.' });
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) return <Loading message="Loading company recruiters..." />;

  const activeCount = recruiters.filter((r) => r.status === 'active').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold mb-1 border border-indigo-200">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>{user?.companyName || 'CloudScale Technologies'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Recruiter Account Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Manage recruiter accounts, company administrators, and role permissions within your hiring organization.
          </p>
        </div>

        {isCompanyAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="saas-btn-primary px-4 py-2 text-xs flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Recruiter</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Recruiters</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{recruiters.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Active Recruiters</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card p-4 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Inactive / Suspended</div>
            <div className="text-2xl font-bold text-slate-500 mt-1">{recruiters.length - activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or designation..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Accounts</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Recruiters List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Recruiter</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Company Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {recruiters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium">No recruiter accounts found.</p>
                  </td>
                </tr>
              ) : (
                recruiters.map((rec) => {
                  const isActive = rec.status === 'active';
                  const isCurrentAdmin = rec.companyRole === 'admin';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              rec.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                rec.name
                              )}`
                            }
                            alt={rec.name}
                            className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{rec.name}</span>
                              {rec.id === user?.id && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">ID: {rec.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.email}</span>
                        </div>
                        {(rec.contactNumber || rec.phone) && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{rec.contactNumber || rec.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">
                          {rec.designation || rec.title || 'Technical Recruiter'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isCurrentAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Shield className="w-3 h-3 text-purple-600" />
                            Company Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Briefcase className="w-3 h-3 text-blue-600" />
                            Recruiter
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isCompanyAdmin && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(rec)}
                              title="Edit Recruiter Details"
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setToggleTarget(rec)}
                              title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              className={`p-1.5 rounded-md hover:bg-slate-100 ${
                                isActive
                                  ? 'text-slate-400 hover:text-rose-600'
                                  : 'text-slate-400 hover:text-emerald-600'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Recruiter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Add New Recruiter</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Marcus Vance"
                  className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    addErrors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {addErrors.name && <p className="mt-1 text-[11px] text-rose-500">{addErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="recruiter@company.example.com"
                  className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    addErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {addErrors.email && <p className="mt-1 text-[11px] text-rose-500">{addErrors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    addErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {addErrors.password && <p className="mt-1 text-[11px] text-rose-500">{addErrors.password}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.designation}
                    onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                    placeholder="e.g. Technical Recruiter"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  {addErrors.designation && <p className="mt-1 text-[11px] text-rose-500">{addErrors.designation}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={addForm.contactNumber}
                    onChange={(e) => setAddForm({ ...addForm, contactNumber: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Role
                  </label>
                  <select
                    value={addForm.companyRole}
                    onChange={(e) => setAddForm({ ...addForm, companyRole: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="recruiter">Recruiter (Standard)</option>
                    <option value="admin">Company Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="saas-btn-primary px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {submittingAdd ? 'Adding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recruiter Modal */}
      {editingRecruiter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Edit Recruiter Account</h3>
              </div>
              <button
                onClick={() => setEditingRecruiter(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {editErrors.name && <p className="mt-1 text-[11px] text-rose-500">{editErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {editErrors.email && <p className="mt-1 text-[11px] text-rose-500">{editErrors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Change Password (optional)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Leave empty to retain existing password"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {editErrors.password && <p className="mt-1 text-[11px] text-rose-500">{editErrors.password}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editForm.contactNumber}
                    onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Role</label>
                  <select
                    value={editForm.companyRole}
                    onChange={(e) => setEditForm({ ...editForm, companyRole: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Company Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecruiter(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="saas-btn-primary px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {submittingEdit ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Status Toggle */}
      {toggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  toggleTarget.status === 'active'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {toggleTarget.status === 'active' ? 'Deactivate Recruiter Account?' : 'Activate Recruiter Account?'}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Are you sure you want to mark <strong>{toggleTarget.name}</strong> as{' '}
                  <span className="font-semibold">
                    {toggleTarget.status === 'active' ? 'inactive' : 'active'}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setToggleTarget(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold text-white shadow-2xs ${
                  toggleTarget.status === 'active'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingStatus ? 'Updating...' : toggleTarget.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
