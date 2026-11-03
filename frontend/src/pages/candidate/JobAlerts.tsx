import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Plus,
  Trash2,
  CheckCircle2,
  Mail,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import { JobAlert, JobCategory } from '../../types';
import { Loading } from '../../components/Loading';

export const JobAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // New alert form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('all');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const [alertsRes, catsRes] = await Promise.all([
        api.getMyAlerts(),
        api.getCategories(),
      ]);
      setAlerts(alertsRes.alerts);
      setCategories(catsRes.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleToggle = async (alert: JobAlert) => {
    try {
      const res = await api.toggleAlert(alert.id, !alert.isActive);
      setAlerts(alerts.map((a) => (a.id === alert.id ? res.alert : a)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAlert(id);
      setAlerts(alerts.filter((a) => a.id !== id));
      setFeedback('Job alert removed.');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createAlert({
        title: title || `${keywords || 'Tech'} Alerts`,
        keywords,
        category,
        location,
        jobType,
        frequency,
      });
      setAlerts([res.alert, ...alerts]);
      setShowCreateModal(false);
      setTitle('');
      setKeywords('');
      setFeedback('New automated job alert configured!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading message="Loading your configured job alerts..." />;

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Automated Job Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Simulates Azure Communication Services notifications whenever new matching roles are posted.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Alert</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <BellRing className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No active job alerts configured</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Set up alerts for specific keywords or categories to be instantly notified of new opportunities.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Configure First Alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">{alert.title}</h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      alert.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {alert.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {alert.keywords && (
                    <span><span className="font-medium text-slate-700">Keywords:</span> {alert.keywords}</span>
                  )}
                  {alert.location && (
                    <span><span className="font-medium text-slate-700">Location:</span> {alert.location}</span>
                  )}
                  <span><span className="font-medium text-slate-700">Frequency:</span> {alert.frequency} email</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={() => handleToggle(alert)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  title="Toggle alert status"
                >
                  {alert.isActive ? (
                    <>
                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                      <span className="text-xs">Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                      <span className="text-xs">Disabled</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Delete alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <BellRing className="w-5 h-5 text-blue-600" />
              <span>Configure Job Alert</span>
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Receive automatic notifications when new matching jobs are published.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Alert Label
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior React & Azure Roles"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Target Keywords / Skills
                </label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. React, Spring Boot, DevOps, Docker"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Remote or City"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Summary</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


