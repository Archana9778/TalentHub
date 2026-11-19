import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  Building,
  User,
  PlusCircle,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ArrowRight,
  CheckCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ActivityLog, ActivityAction, Company } from '../../types';
import { Loading } from '../../components/Loading';

export const ActivityLogPage: React.FC = () => {
  const { user } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<'all' | ActivityAction>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actorSearch, setActorSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [companies, setCompanies] = useState<Company[]>([]);

  // Modal inspection state
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Load companies for Platform Admin
  useEffect(() => {
    if (user?.role === 'admin') {
      api.getCompanies()
        .then((res: any) => {
          if (Array.isArray(res)) {
            setCompanies(res);
          } else if (Array.isArray(res?.companies)) {
            setCompanies(res.companies);
          } else {
            setCompanies([]);
          }
        })
        .catch((err) => console.error('Failed to load companies for filter:', err));
    }
  }, [user]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        limit,
      };

      if (actionFilter !== 'all') params.action = actionFilter;
      if (moduleFilter !== 'all') params.module = moduleFilter;
      if (actorSearch.trim()) params.actor = actorSearch.trim();
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) {
        // Set to end of the day for date string input
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }
      if (user?.role === 'admin' && companyFilter !== 'all') {
        params.companyId = companyFilter;
      }

      const res = await api.getActivityLogs(params);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching activity logs:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, actionFilter, moduleFilter, companyFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setActionFilter('all');
    setModuleFilter('all');
    setActorSearch('');
    setStartDate('');
    setEndDate('');
    setCompanyFilter('all');
    setPage(1);
  };

  const renderActionBadge = (action: ActivityAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Edit className="w-3.5 h-3.5 text-amber-600" />
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            DELETE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const formatFieldValue = (val: any): string => {
    if (val === null || val === undefined) return '<empty>';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Activity Log & Audit Trail</h1>
            <p className="text-sm text-slate-600">
              Read-only system audit trail tracking all job posting creations, modifications, and deletions.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Actor Search */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Actor (User Name or ID)</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={actorSearch}
                  onChange={(e) => setActorSearch(e.target.value)}
                  placeholder="Search by actor..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Action Type</label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="all">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            {/* Module Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Module</label>
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="all">All Modules</option>
                <option value="jobs">Jobs</option>
                <option value="COMPANY">Company Profile</option>
                <option value="RECRUITERS">Recruiter Management</option>
              </select>
            </div>

            {/* Company Filter (Admin Only) */}
            {user?.role === 'admin' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                <select
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="all">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date Range & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Date Range:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                Apply
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16">
            <Loading />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">No activities found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are no recorded activities matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Module</th>
                  <th className="px-6 py-3.5">Record</th>
                  <th className="px-6 py-3.5">Actor</th>
                  {user?.role === 'admin' && <th className="px-6 py-3.5">Company ID</th>}
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-sm">
                {logs.map((log) => {
                  const dt = formatDateTime(log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <div className="font-medium text-slate-800">{dt.date}</div>
                        <div className="text-slate-400">{dt.time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{log.recordName}</div>
                        <div className="text-xs text-slate-400 font-mono">ID: {log.recordId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                            {log.actorName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{log.actorName}</div>
                            <div className="text-xs text-slate-400 font-mono">{log.actorUserId}</div>
                          </div>
                        </div>
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
                          {log.companyId}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Diff
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && total > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-600">
              Showing <span className="font-medium text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-medium text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-medium text-slate-900">{total}</span> activity records
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 text-xs font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diff Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {renderActionBadge(selectedLog.action)}
                <h3 className="text-base font-bold text-slate-900">
                  {selectedLog.action === 'UPDATE' ? 'Audit Diff Comparison' : `${selectedLog.action} Snapshot`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Meta Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Record</span>
                  <span className="font-semibold text-slate-800">{selectedLog.recordName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Actor</span>
                  <span className="font-semibold text-slate-800">{selectedLog.actorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Module</span>
                  <span className="font-semibold text-slate-800 capitalize">{selectedLog.module}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Timestamp</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateTime(selectedLog.createdAt).date} {formatDateTime(selectedLog.createdAt).time}
                  </span>
                </div>
              </div>

              {/* Diff view for UPDATE */}
              {selectedLog.action === 'UPDATE' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Modified Attributes ({Object.keys(selectedLog.newValues || {}).length} changes)
                  </h4>
                  {Object.keys(selectedLog.newValues || {}).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No field-level diff recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.keys(selectedLog.newValues || {}).map((field) => {
                        const oldVal = (selectedLog.oldValues || {})[field];
                        const newVal = (selectedLog.newValues || {})[field];
                        return (
                          <div key={field} className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                            <div className="bg-slate-100 px-3 py-1.5 font-mono font-semibold text-slate-700 border-b border-slate-200">
                              {field}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                              <div className="p-3 bg-rose-50/40">
                                <span className="text-[11px] font-semibold text-rose-600 block mb-1">Previous Value:</span>
                                <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap break-words">
                                  {formatFieldValue(oldVal)}
                                </pre>
                              </div>
                              <div className="p-3 bg-emerald-50/40">
                                <span className="text-[11px] font-semibold text-emerald-600 block mb-1">New Value:</span>
                                <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap break-words">
                                  {formatFieldValue(newVal)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* View for CREATE */}
              {selectedLog.action === 'CREATE' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Created Record Values
                  </h4>
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96">
                    <pre>{JSON.stringify(selectedLog.newValues, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* View for DELETE */}
              {selectedLog.action === 'DELETE' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Preserved Record Snapshot Prior to Deletion
                  </h4>
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96">
                    <pre>{JSON.stringify(selectedLog.oldValues, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
