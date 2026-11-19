import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Building,
  User,
  ExternalLink,
  Search,
  Filter,
  Check,
  Ban,
  RotateCcw,
  X,
  Clock,
  UserCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { ReportedJob } from '../../types';
import { Loading } from '../../components/Loading';

export const ReportedJobs: React.FC = () => {
  const [reports, setReports] = useState<ReportedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search and Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

  // Action Modal State
  const [actionTarget, setActionTarget] = useState<ReportedJob | null>(null);
  const [actionType, setActionType] = useState<'deactivate_job' | 'restore_job' | 'dismiss' | 'resolve'>('deactivate_job');
  const [adminReason, setAdminReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReportedJobs({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() ? search.trim() : undefined,
      });
      setReports(res.reports);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to retrieve moderation queue.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };

  const openActionModal = (report: ReportedJob, action: 'deactivate_job' | 'restore_job' | 'dismiss' | 'resolve') => {
    setActionTarget(report);
    setActionType(action);
    setAdminReason('');
    setModalError(null);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;

    if (!adminReason.trim()) {
      setModalError('Administrative justification is required for auditing purposes.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const targetStatus = actionType === 'dismiss' ? 'dismissed' : 'resolved';

    try {
      const res = await api.updateReportStatus(actionTarget.id, {
        status: targetStatus,
        adminAction: actionType,
        adminReason: adminReason.trim(),
      });

      // Update state locally
      setReports(reports.map((r) => (r.id === actionTarget.id ? res.report : r)));
      setActionTarget(null);

      let actionDesc = 'Report marked resolved.';
      if (actionType === 'deactivate_job') {
        actionDesc = 'Job posting deactivated (closed) and report resolved.';
      } else if (actionType === 'restore_job') {
        actionDesc = 'Job posting reactivated and report processed.';
      } else if (actionType === 'dismiss') {
        actionDesc = 'Report dismissed with reason recorded in audit log.';
      }

      setFeedback({ type: 'success', message: actionDesc });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to apply administrative action.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && reports.length === 0) return <Loading message="Loading reported postings moderation queue..." />;

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <span>Reported Jobs Moderation Queue</span>
            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-full">
              {pendingCount} Pending
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review candidate flags regarding misleading compensation, fraud, or policy violations. Audit every administrative decision.
          </p>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title, company, or reporter..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
            {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg font-semibold capitalize transition ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">Moderation Queue is Clear</h3>
          <p className="text-xs text-slate-400 mt-1">
            No reports currently require moderator action matching the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isPending = report.status === 'pending';
            const isResolved = report.status === 'resolved';
            const isDismissed = report.status === 'dismissed';

            return (
              <div
                key={report.id}
                className={`bg-white p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                  isPending
                    ? 'border-rose-200/90 hover:border-rose-300'
                    : 'border-slate-200/70 bg-slate-50/40'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-rose-600 font-bold text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{report.jobTitle}</span>
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-semibold text-slate-700">{report.companyName}</span>

                      {/* Status Badges */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPending
                            ? 'bg-rose-100 text-rose-800'
                            : isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {report.status}
                      </span>

                      {report.adminAction && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          Action: {report.adminAction.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700">
                      <strong className="text-slate-900">Reason:</strong>{' '}
                      <span className="text-rose-900 font-medium">{report.reason}</span>
                    </div>

                    <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-200 max-w-3xl leading-relaxed">
                      "{report.details}"
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 text-[11px] text-slate-400 pt-1">
                      <span>Reported by <strong className="text-slate-600">{report.reportedByName}</strong></span>
                      <span>•</span>
                      <span>Date: {new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Audit Trail Details (if resolved or dismissed) */}
                    {(report.reviewedByName || report.reviewedAt) && (
                      <div className="mt-2 p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-purple-800">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Reviewed by {report.reviewedByName || 'Administrator'} on {report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        {report.adminReason && (
                          <div className="text-[11px] text-purple-700 pl-5 italic">
                            Reason: "{report.adminReason}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center md:items-end gap-2 shrink-0 self-end md:self-start">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => openActionModal(report, 'deactivate_job')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Deactivate Job</span>
                        </button>
                        <button
                          onClick={() => openActionModal(report, 'resolve')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Resolve (Keep Job)</span>
                        </button>
                        <button
                          onClick={() => openActionModal(report, 'dismiss')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                        >
                          Dismiss Report
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        Report completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Administrative Action Modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>
                  {actionType === 'deactivate_job' && 'Deactivate Job Posting'}
                  {actionType === 'restore_job' && 'Restore Job Posting'}
                  {actionType === 'resolve' && 'Resolve Report'}
                  {actionType === 'dismiss' && 'Dismiss Report'}
                </span>
              </h3>
              <button
                onClick={() => setActionTarget(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="mt-4 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><strong className="text-slate-700">Target Posting:</strong> {actionTarget.jobTitle}</div>
                <div><strong className="text-slate-700">Company:</strong> {actionTarget.companyName}</div>
                <div><strong className="text-slate-700">Reason Flagged:</strong> {actionTarget.reason}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Action Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder="Describe the reason for this administrative moderation action (recorded in the permanent audit trail)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 ${
                    actionType === 'deactivate_job'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting ? 'Applying...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
