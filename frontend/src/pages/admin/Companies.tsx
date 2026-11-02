import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  ExternalLink,
  Edit,
  Trash2,
  MapPin,
  X,
  BadgeCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { Company } from '../../types';
import { Loading } from '../../components/Loading';

export const Companies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('San Francisco, CA');
  const [industry, setIndustry] = useState('Enterprise Cloud Infrastructure');
  const [website, setWebsite] = useState('');
  const [size, setSize] = useState('250-500 employees');
  const [submitting, setSubmitting] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await api.getCompanies();
      setCompanies(res.companies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createCompany({
        name,
        description,
        location,
        industry,
        website,
        size,
      });
      setCompanies([...companies, res.company]);
      setShowModal(false);
      setName('');
      setDescription('');
      setFeedback('New organization registered!');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerified = async (c: Company) => {
    try {
      const res = await api.updateCompany(c.id, { verified: !c.verified });
      setCompanies(companies.map((comp) => (comp.id === c.id ? res.company : comp)));
      setFeedback(`Company ${c.name} verification status updated.`);
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this company?')) return;
    try {
      await api.deleteCompany(id);
      setCompanies(companies.filter((c) => c.id !== id));
      setFeedback('Company deleted.');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loading message="Loading company catalog..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Manage Companies
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review employer profiles, grant verification badges, and register new partner organizations.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Company</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((comp) => (
          <div
            key={comp.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={comp.logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120'}
                    alt={comp.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100 p-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      <span>{comp.name}</span>
                      {comp.verified && (
                        <span title="Verified Employer">
                          <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{comp.industry}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleVerified(comp)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    comp.verified
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {comp.verified ? 'Verified ✓' : 'Unverified'}
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                {comp.description}
              </p>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{comp.location}</span>
                </div>
                <span>•</span>
                <span>{comp.size}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              {comp.website ? (
                <a
                  href={comp.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-slate-400">No URL</span>
              )}

              <button
                onClick={() => handleDelete(comp.id)}
                className="text-slate-400 hover:text-rose-600 p-1 rounded"
                title="Delete company"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Add New Employer</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Cloud Corp"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold"
                >
                  {submitting ? 'Saving...' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
