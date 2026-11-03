import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  CheckCircle,
  Building2,
  FileText,
  BarChart3,
  Layers,
  ChevronRight,
  Lock,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const handleQuickDemo = async (role: 'candidate' | 'recruiter') => {
    await switchDemoRole(role);
    navigate(role === 'candidate' ? '/candidate/dashboard' : '/recruiter/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Global Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm">
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Talent<span className="text-blue-600">Hub</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                ATS MVP
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">Workflow</a>
            <a href="#ai-intelligence" className="hover:text-slate-900 transition-colors">AI Intelligence</a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">Solutions</a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link
                to={user.role === 'recruiter' ? '/recruiter/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/candidate/dashboard'}
                className="saas-btn-primary text-xs"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="saas-btn-primary text-xs"
                >
                  <span>Get Started</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>Enterprise ATS with Intelligent Document Parsing</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-950 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-[1.12]">
            Modern Talent Acquisition &amp; Applicant Tracking Platform
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            TalentHub streamlines technical hiring with structured candidate evaluation, automated match scoring, candidate pipelines, and comprehensive stage auditing.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/candidate/jobs"
              className="w-full sm:w-auto saas-btn-primary text-sm px-6 py-2.5 justify-center shadow-sm"
            >
              <Search className="w-4 h-4 text-blue-400" />
              <span>Explore Open Positions</span>
            </Link>
            <button
              onClick={() => handleQuickDemo('recruiter')}
              className="w-full sm:w-auto saas-btn-secondary text-sm px-6 py-2.5 justify-center"
            >
              <Briefcase className="w-4 h-4 text-slate-600" />
              <span>Launch Recruiter Workspace</span>
            </button>
          </div>

          {/* Quick Demo Selector */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Instant Access:</span>
            <button
              onClick={() => handleQuickDemo('candidate')}
              className="text-blue-600 font-semibold hover:underline"
            >
              Candidate Portal
            </button>
            <span>•</span>
            <button
              onClick={() => handleQuickDemo('recruiter')}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Recruiter ATS
            </button>
          </div>

          {/* Platform Preview Mockup */}
          <div className="mt-14 max-w-5xl mx-auto rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 shadow-lg">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="h-9 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 bg-white px-3 py-0.5 rounded border border-slate-200">
                  talenthub.enterprise.internal/recruiter/applicants
                </div>
                <div className="w-12"></div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Applied</span>
                  <div className="mt-2 space-y-2">
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900">Alex Morgan</div>
                      <div className="text-[11px] text-slate-500">Senior Full-Stack Engineer</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">94% Match</span>
                        <span className="text-[10px] text-slate-400">Today</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Screening</span>
                  <div className="mt-2 space-y-2">
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900">David Kim</div>
                      <div className="text-[11px] text-slate-500">Cloud Infrastructure Lead</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">88% Match</span>
                        <span className="text-[10px] text-slate-400">Yesterday</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Interview</span>
                  <div className="mt-2 space-y-2">
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900">Sarah Jenkins</div>
                      <div className="text-[11px] text-slate-500">Frontend Specialist</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">Tech Round</span>
                        <span className="text-[10px] text-slate-400">Nov 5</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Offer / Hired</span>
                  <div className="mt-2 space-y-2">
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900">Elena Rostova</div>
                      <div className="text-[11px] text-slate-500">DevOps Engineer</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Accepted</span>
                        <span className="text-[10px] text-slate-400">$165k</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Feature Highlights */}
      <section id="features" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Platform Capabilities</h2>
            <h3 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">
              Enterprise ATS Engineered for Precision
            </h3>
            <p className="mt-3 text-slate-600 text-sm leading-relaxed">
              Eliminate recruitment friction with structured candidate pipelines, automated screening scorecards, and verifiable audit histories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="saas-card p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">AI Match Engine</h4>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Evaluates incoming resumes against mandatory requisition skills and experience requirements to compute precise 0–100% suitability ratings.
              </p>
            </div>

            <div className="saas-card p-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Multi-Stage ATS Board</h4>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Seamless Kanban and tabular applicant management with single-click stage progression: Applied → Screening → Interview → Offer → Hired.
              </p>
            </div>

            <div className="saas-card p-6">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Verifiable Stage Audit Trail</h4>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Immutable chronological logging of every status update, interviewer notes, stage transitions, and recruitment decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How TalentHub Works */}
      <section id="how-it-works" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Process Flow</h2>
            <h3 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">
              From Requisition to Onboarding in 4 Stages
            </h3>
            <p className="mt-3 text-slate-600 text-sm leading-relaxed">
              A transparent, high-velocity workflow designed for talent teams and candidates alike.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-slate-300">01</span>
              <h5 className="mt-2 font-bold text-slate-900 text-sm">Post Requisition</h5>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Recruiters specify mandatory competencies, workplace mode (Remote/Hybrid/On-site), salary bands, and deadlines.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-blue-300">02</span>
              <h5 className="mt-2 font-bold text-slate-900 text-sm">Candidate Application</h5>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Engineers submit resumes with auto-extracted skill chips, cover notes, and instant duplicate prevention.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-indigo-300">03</span>
              <h5 className="mt-2 font-bold text-slate-900 text-sm">Screening &amp; Interview</h5>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Talent teams rank candidates by AI match rating, conduct technical interviews, and store private evaluation notes.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-emerald-300">04</span>
              <h5 className="mt-2 font-bold text-slate-900 text-sm">Offer &amp; Placement</h5>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Advance successful candidates to Offer and Hired status with audit records and real-time dashboard analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Candidate & Recruiter Benefits (Solutions) */}
      <section id="roles" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Purpose-Built Portals</h2>
            <h3 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">
              Tailored Experiences for Every Stakeholder
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Candidate Box */}
            <div className="saas-card p-8 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold mb-4">
                  <Compass className="w-3.5 h-3.5" />
                  <span>For Job Seekers &amp; Candidates</span>
                </div>
                <h4 className="text-xl font-bold text-slate-900">Total Transparency Over Your Applications</h4>
                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Never wonder where your resume went. Follow your job applications through each stage with live status steppers and skill match insights.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Real-time stepper: Applied → Screening → Interview → Offer → Hired</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Automated skill extraction from PDF/DOCX resumes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Personalized job recommendations matched to your technical profile</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Custom email alerts based on category, workplace mode, and salary</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  to="/register?role=candidate"
                  className="saas-btn-primary text-xs w-full justify-center"
                >
                  <span>Create Candidate Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Recruiter Box */}
            <div className="saas-card p-8 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold mb-4">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>For Recruiters &amp; Talent Teams</span>
                </div>
                <h4 className="text-xl font-bold text-slate-900">High-Precision Candidate Pipeline Management</h4>
                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Consolidate hiring across all requisitions with ranked AI match scoring, interactive Kanban workflow, and structured recruiter assessments.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Kanban &amp; tabular applicant review with 0–100% AI match rating</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Single-click stage progression and automated interview coordination</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Private recruiter notes and audit trails per requisition</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Requisition analytics, pipeline funnel, and time-to-hire metrics</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  to="/register?role=recruiter"
                  className="saas-btn-primary text-xs w-full justify-center"
                >
                  <span>Open Recruiter Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. AI Intelligence Highlight */}
      <section id="ai-intelligence" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-2xl bg-slate-900 text-white relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-4 border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Simulated Azure AI Document Intelligence</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Semantic Match Scoring Without Black-Box Mystery
              </h3>
              <p className="mt-3 text-slate-300 text-xs sm:text-sm leading-relaxed">
                TalentHub breaks down candidate evaluations into transparent, explainable data: matched skills, missing requisites, and experience alignment.
              </p>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-blue-400">94%</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Top Match Calibration</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-teal-400">100%</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Audit Trail Traceability</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-indigo-400">&lt; 1s</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Instant Skill Extraction</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="font-bold text-slate-900 text-sm">TalentHub ATS</span>
              <span className="text-slate-400">• Enterprise Recruitment Platform</span>
            </div>

            <div className="flex items-center gap-6">
              <Link to="/candidate/jobs" className="hover:text-slate-900 transition-colors">Browse Jobs</Link>
              <Link to="/login" className="hover:text-slate-900 transition-colors">Sign In</Link>
              <Link to="/register" className="hover:text-slate-900 transition-colors">Register</Link>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">Azure AKS Architecture</span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <p>© {new Date().getFullYear()} TalentHub Inc. Production ATS MVP. All rights reserved.</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Java 21 • Spring Boot 3 • React 18 • MySQL Flexible</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

