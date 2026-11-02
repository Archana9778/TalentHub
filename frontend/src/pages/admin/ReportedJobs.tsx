import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Building,
  User,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { ReportedJob } from '../../types';
import { Loading } from '../../components/Loading';

export const ReportedJobs: React.FC = () => {
  const [reports, setReports] = useState<ReportedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const res = await api.getReportedJobs();
      setReports(res.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleAction = async (id: string, status: 'resolved' | 'dismissed', removeJob = false) => {
    try {
      const res = await api.updateReportStatus(id, { status, removeJob });
      setReports(reports.map((r) => (r.id === id ? res.report : r)));
      setFeedback(
        removeJob
          ? 'Flagged job posting permanently removed from platform.'
          : `Report status marked as ${status}.`
      );
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loading message="Loading reported postings moderation queue..." />;

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const pastReports = reports.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Reported Jobs Moderation</span>
          <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-full">
            {pendingReports.length} Pending
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review candidate reports regarding inaccurate compensation, fraudulent postings, or expired roles.
        </p>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <ShieldAlert className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">All clear! No reported jobs</h3>
          <p className="text-xs text-slate-400 mt-1">
            There are currently no active user-reported postings requiring moderator intervention.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Reports */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Pending Moderation Queue ({pendingReports.length})
            </h2>

            {pendingReports.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-xs text-slate-500 text-center">
                No reports awaiting action.
              </div>
            ) : (
              pendingReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-rose-600 font-bold text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{report.jobTitle}</span>
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-700">{report.companyName}</span>
                    </div>

                    <div className="text-xs text-slate-700">
                      <strong className="text-rose-900">Reason:</strong> {report.reason}
                    </div>

                    <p className="text-xs text-slate-500 italic bg-rose-50/60 p-2.5 rounded-lg border border-rose-100 max-w-2xl">
                      "{report.details}"
                    </p>

                    <div className="text-[11px] text-slate-400">
                      Reported by {report.reportedByName} on {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(report.id, 'dismissed')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                    >
                      Dismiss Report
                    </button>
                    <button
                      onClick={() => handleAction(report.id, 'resolved')}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl"
                    >
                      Mark Resolved
                    </button>
                    <button
                      onClick={() => handleAction(report.id, 'resolved', true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                    >
                      Remove Job
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past Reports */}
          {pastReports.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Resolved / Dismissed Archive ({pastReports.length})
              </h2>
              <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 overflow-hidden text-xs">
                {pastReports.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{r.jobTitle}</span>
                      <span className="text-slate-400 mx-2">•</span>
                      <span className="text-slate-500">{r.reason}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

