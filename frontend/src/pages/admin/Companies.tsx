import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit,
  Trash2,
  MapPin,
  X,
  BadgeCheck,
  Search,
  Power,
  Users,
  Briefcase,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';
import { Company, User } from '../../types';
import { Loading } from '../../components/Loading';

export const Companies: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'companies' | 'recruiters'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State for Company (Create / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('San Francisco, CA');
  const [industry, setIndustry] = useState('Enterprise Cloud Infrastructure');
  const [website, setWebsite] = useState('');
  const [size, setSize] = useState('250-500 employees');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [compRes, recRes] = await Promise.all([
        api.getCompanies(),
        api.getAdminRecruiters(),
      ]);
      setCompanies(compRes.companies);
      setRecruiters(recRes.recruiters);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to fetch directory data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setDescription('');
    setLocation('San Francisco, CA');
    setIndustry('Enterprise Cloud Infrastructure');
    setWebsite('');
    setSize('250-500 employees');
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setName(comp.name);
    setDescription(comp.description || '');
    setLocation(comp.location || '');
    setIndustry(comp.industry || '');
    setWebsite(comp.website || '');
    setSize(comp.size || '50-200 employees');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Organization name is required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      if (editingCompany) {
        const res = await api.updateCompany(editingCompany.id, {
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          industry: industry.trim(),
          website: website.trim(),
          size,
        });
        setCompanies(companies.map((c) => (c.id === editingCompany.id ? res.company : c)));
        setFeedback({ type: 'success', message: `Organization "${res.company.name}" updated successfully.` });
      } else {
        const res = await api.createCompany({
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          industry: industry.trim(),
          website: website.trim(),
          size,
        });
        setCompanies([...companies, res.company]);
        setFeedback({ type: 'success', message: `Organization "${res.company.name}" registered successfully.` });
      }
      setShowModal(false);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerified = async (c: Company) => {
    try {
      const res = await api.updateCompany(c.id, { verified: !c.verified });
      setCompanies(companies.map((comp) => (comp.id === c.id ? res.company : comp)));
      setFeedback({
        type: 'success',
        message: `Company "${c.name}" verification badge ${res.company.verified ? 'granted' : 'revoked'}.`,
      });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update verification status.' });
    }
  };

  const handleToggleStatus = async (c: Company) => {
    const nextStatus = (c.status || 'active') === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.updateCompanyStatus(c.id, nextStatus);
      setCompanies(companies.map((comp) => (comp.id === c.id ? res.company : comp)));
      setFeedback({
        type: 'success',
        message: `Company "${c.name}" is now ${nextStatus === 'suspended' ? 'Suspended' : 'Active'}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update company status.' });
    }
  };

  const handleToggleRecruiterStatus = async (rec: User) => {
    const nextStatus = rec.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.updateUserStatus(rec.id, { status: nextStatus });
      setRecruiters(recruiters.map((r) => (r.id === rec.id ? res.user : r)));
      setFeedback({
        type: 'success',
        message: `Recruiter "${rec.name}" has been ${nextStatus === 'suspended' ? 'suspended' : 'activated'}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update recruiter status.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company? Existing job postings and recruiter links may be affected.')) return;
    try {
      await api.deleteCompany(id);
      setCompanies(companies.filter((c) => c.id !== id));
      setFeedback({ type: 'success', message: 'Company record deleted successfully.' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to delete company.' });
    }
  };

  if (loading) return <Loading message="Loading partner companies and recruiter records..." />;

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || (c.status || 'active') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredRecruiters = recruiters.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.companyName && r.companyName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            <span>Recruiters & Companies Directory</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review partner employers, validate recruiter-company affiliations, and enforce operational statuses.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Company</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 border rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'companies'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Partner Companies ({companies.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('recruiters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'recruiters'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Recruiters Directory ({recruiters.length})</span>
        </button>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'companies' ? 'Search companies by name, location...' : 'Search recruiters by name, email, company...'}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Tab 1: Companies Grid */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.length === 0 ? (
            <div className="col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-xs">
              No organizations found matching the active filters.
            </div>
          ) : (
            filteredCompanies.map((comp) => {
              const compRecruiters = recruiters.filter(
                (r) => r.companyId === comp.id || (r.companyName && r.companyName.toLowerCase() === comp.name.toLowerCase())
              );
              const isSuspended = comp.status === 'suspended';

              return (
                <div
                  key={comp.id}
                  className={`bg-white p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                    isSuspended ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={comp.logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120'}
                          alt={comp.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 p-0.5 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                            <span>{comp.name}</span>
                            {comp.verified && (
                              <span title="Verified Enterprise Partner">
                                <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{comp.industry}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isSuspended
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {comp.description || 'No corporate description provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-[11px] text-slate-500 pt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{comp.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{comp.size}</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-700 font-semibold">
                        <span>{compRecruiters.length} linked recruiter{compRecruiters.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleVerified(comp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          comp.verified
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {comp.verified ? 'Verified' : 'Verify'}
                      </button>
                      <button
                        onClick={() => handleToggleStatus(comp)}
                        title={isSuspended ? 'Activate Organization' : 'Suspend Organization'}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          isSuspended
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(comp)}
                        title="Edit Details"
                        className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(comp.id)}
                        title="Delete Company"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Recruiters Table */}
      {activeTab === 'recruiters' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Recruiter</th>
                  <th className="py-3 px-4">Affiliated Company</th>
                  <th className="py-3 px-4">Job Title & Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecruiters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No recruiters found matching the active criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecruiters.map((rec) => {
                    const isSuspended = rec.status === 'suspended';
                    const hasCompany = Boolean(rec.companyName || rec.companyId);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-bold text-slate-900 block">{rec.name}</span>
                            <span className="text-[11px] text-slate-400">{rec.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {hasCompany ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200/60">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>{rec.companyName || 'Associated'}</span>
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-200">
                              No Company Affiliated
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{rec.title || 'Technical Recruiter'}</div>
                          <div className="text-[11px] text-slate-400">{rec.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isSuspended
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleToggleRecruiterStatus(rec)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                              isSuspended
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {isSuspended ? 'Activate Account' : 'Suspend Account'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Company Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCompany ? 'Edit Organization Record' : 'Register New Organization'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CloudScale Systems Inc."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Corporate mission, engineering focus, and talent culture..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Headquarters Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Austin, TX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry Sector</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. FinTech / Distributed Cloud"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.example"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="1-10 employees">1-10 employees (Startup)</option>
                    <option value="11-50 employees">11-50 employees (Early Growth)</option>
                    <option value="51-200 employees">51-200 employees (Mid-Market)</option>
                    <option value="250-500 employees">250-500 employees (Scale-up)</option>
                    <option value="500+ employees">500+ employees (Enterprise)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                >
                  {submitting ? 'Saving...' : editingCompany ? 'Update Organization' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
