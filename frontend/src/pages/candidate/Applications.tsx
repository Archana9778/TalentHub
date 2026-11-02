import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  Calendar,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
  Video,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { Application, ApplicationStage } from '../../types';
import { Loading } from '../../components/Loading';

export const Applications: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const data = await api.getMyApplications();
        setApplications(data.applications);
        if (data.applications.length > 0) {
          setExpandedId(data.applications[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  if (loading) return <Loading message="Loading candidate application pipeline..." />;

  const pipelineStages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

  const getStageIndex = (stage: ApplicationStage) => {
    if (stage === 'Rejected') return -1;
    return pipelineStages.indexOf(stage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Application Tracking System
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your job applications in real-time as recruiters advance your profile through stages.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <FileCheck2 className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">You haven't applied for any jobs yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Browse open engineering and technical positions on TalentHub and submit your profile.
          </p>
          <Link
            to="/candidate/jobs"
            className="mt-4 inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Explore Jobs Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isExpanded = expandedId === app.id;
            const currentStageIdx = getStageIndex(app.stage);
            const isRejected = app.stage === 'Rejected';

            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Header summary row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 select-none"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base border border-blue-100 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{app.jobTitle}</h2>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-medium text-slate-600">{app.companyName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>Applied on {new Date(app.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>AI Match {app.matchScore}%</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        isRejected
                          ? 'bg-rose-100 text-rose-800'
                          : app.stage === 'Hired' || app.stage === 'Offer'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.stage === 'Interview'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {app.stage}
                    </span>

                    <button className="text-slate-400 p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Pipeline Stepper & History */}
                {isExpanded && (
                  <div className="px-5 pb-6 sm:px-6 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-6">
                    {/* Visual Progress Stepper */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        Recruitment Pipeline Progress
                      </div>

                      {isRejected ? (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
                          <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
                          <div>
                            <span className="font-bold">Application Status: Closed / Rejected.</span>
                            <p className="mt-0.5 text-rose-700">
                              The hiring team has decided to move forward with other candidates at this time.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2 text-center">
                          {pipelineStages.map((stage, idx) => {
                            const isDone = currentStageIdx >= idx;
                            const isCurrent = currentStageIdx === idx;

                            return (
                              <div key={stage} className="flex flex-col items-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    isCurrent
                                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm'
                                      : isDone
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  {isDone && !isCurrent ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    idx + 1
                                  )}
                                </div>
                                <span
                                  className={`text-[11px] font-semibold mt-1.5 ${
                                    isCurrent
                                      ? 'text-blue-700 font-bold'
                                      : isDone
                                      ? 'text-slate-800'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {stage}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Interview Alert Box if in Interview stage */}
                    {app.interviewDate && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-purple-900">
                            Upcoming Interview Scheduled: {app.interviewType || 'Technical Round'}
                          </div>
                          <div className="text-xs text-purple-700 mt-0.5">
                            Scheduled on: <span className="font-semibold">{new Date(app.interviewDate).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recruiter Assessment Notes */}
                    {app.recruiterNotes && (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-700">Recruiter Notes:</span>
                        <p className="text-slate-600 mt-1 italic">{app.recruiterNotes}</p>
                      </div>
                    )}

                    {/* Audit Timeline */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Activity & Stage Change Audit Log
                      </div>
                      <div className="space-y-2">
                        {app.timeline.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="font-semibold text-slate-800">
                                {item.stage} Stage
                              </div>
                              <p className="text-slate-600 text-[11px] mt-0.5">
                                {item.comment || `Moved to ${item.stage}`}
                              </p>
                              <div className="text-[10px] text-slate-400 mt-1">
                                Actioned by: {item.changedByName}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(item.changedAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

