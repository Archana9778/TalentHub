import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
  Briefcase,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Company } from '../../types';
import { Loading } from '../../components/Loading';

const INDUSTRY_OPTIONS = [
  'Technology & Software',
  'Cloud Infrastructure & Enterprise Software',
  'Artificial Intelligence & Machine Learning',
  'Financial Technology',
  'Cybersecurity',
  'Healthcare & Life Sciences',
  'E-Commerce & Retail',
  'Telecommunications',
  'Media & Entertainment',
  'Other',
];

const COMPANY_SIZE_OPTIONS = [
  '1-10 employees',
  '11-50 employees',
  '50-200 employees',
  '200-500 employees',
  '500-1,000 employees',
  '1,000-5,000 employees',
  '5,000+ employees',
];

export const CompanyProfile: React.FC = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<{ totalJobs: number; totalRecruiters: number; activeRecruiters: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    website: '',
    email: '',
    contactNumber: '',
    address: '',
    location: '',
    size: '',
    logo: '',
  });

  const fetchCompany = async () => {
    try {
      if (!user?.companyId) {
        // Recruiter without company: load companies list or allow creation
        const companiesRes = await api.getCompanies();
        if (companiesRes.companies.length > 0) {
          const first = companiesRes.companies[0];
          const details = await api.getCompanyById(first.id);
          populateCompany(details.company, details.stats);
        }
      } else {
        const details = await api.getCompanyById(user.companyId);
        populateCompany(details.company, details.stats);
      }
    } catch (err: any) {
      console.error('Failed to load company profile', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load company profile.' });
    } finally {
      setLoading(false);
    }
  };

  const populateCompany = (comp: Company, compStats?: any) => {
    setCompany(comp);
    if (compStats) setStats(compStats);
    setFormData({
      name: comp.name || '',
      description: comp.description || '',
      industry: comp.industry || 'Technology & Software',
      website: comp.website || '',
      email: comp.email || '',
      contactNumber: comp.contactNumber || comp.phone || '',
      address: comp.address || '',
      location: comp.location || '',
      size: comp.size || '50-200 employees',
      logo: comp.logo || '',
    });
  };

  useEffect(() => {
    fetchCompany();
  }, [user]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) {
      errs.name = 'Company name is required.';
    }
    if (!formData.description.trim()) {
      errs.description = 'Company description is required.';
    } else if (formData.description.trim().length < 20) {
      errs.description = 'Description should be at least 20 characters for candidate visibility.';
    }
    if (!formData.industry.trim()) {
      errs.industry = 'Please select or specify an industry.';
    }
    if (!formData.location.trim()) {
      errs.location = 'Primary location is required.';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid company email address.';
    }
    if (formData.website.trim() && !formData.website.startsWith('http://') && !formData.website.startsWith('https://')) {
      errs.website = 'Website URL must begin with http:// or https://';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select a valid image file (PNG, JPG, SVG, WebP).' });
      return;
    }

    setUploadingLogo(true);
    setFeedback(null);

    try {
      const res = await api.uploadCompanyLogo(company.id, file);
      setFormData((prev) => ({ ...prev, logo: res.logoUrl }));
      setCompany(res.company);
      setFeedback({ type: 'success', message: 'Company logo uploaded and updated successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to upload logo.' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setFeedback(null);

    try {
      if (company?.id) {
        // Update existing company
        const res = await api.updateCompany(company.id, {
          name: formData.name,
          description: formData.description,
          industry: formData.industry,
          website: formData.website,
          email: formData.email,
          contactNumber: formData.contactNumber,
          phone: formData.contactNumber,
          address: formData.address,
          location: formData.location,
          size: formData.size,
          logo: formData.logo,
        });
        setCompany(res.company);
        setFeedback({ type: 'success', message: 'Company profile updated successfully!' });
      } else {
        // Create new company
        const res = await api.createCompany({
          name: formData.name,
          description: formData.description,
          industry: formData.industry,
          website: formData.website,
          email: formData.email,
          contactNumber: formData.contactNumber,
          phone: formData.contactNumber,
          address: formData.address,
          location: formData.location,
          size: formData.size,
          logo: formData.logo,
        });
        setCompany(res.company);
        setFeedback({ type: 'success', message: 'Company profile created successfully!' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save company profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading company profile details..." />;

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole; // default to true if sole recruiter

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-indigo-500/30 overflow-hidden flex items-center justify-center shrink-0">
              {formData.logo ? (
                <img
                  src={formData.logo}
                  alt={formData.name || 'Company Logo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {formData.name || 'Company Profile'}
                </h1>
                {company?.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Partner
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                {formData.industry} • {formData.location || 'Location Not Specified'}
              </p>
              {formData.website && (
                <a
                  href={formData.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{formData.website}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          {stats && (
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700/60 pt-4 md:pt-0 md:pl-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{stats.totalJobs}</div>
                <div className="text-[11px] text-slate-400">Job Postings</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-400">{stats.activeRecruiters}</div>
                <div className="text-[11px] text-slate-400">Active Recruiters</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification feedback */}
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
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Profile Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Company Information</h2>
            <p className="text-xs text-slate-500">
              Manage your company brand presence, contact info, and hiring specifications.
            </p>
          </div>
          {!isCompanyAdmin && (
            <span className="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
              View Only (Admin Permission Required to Edit)
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
              {formData.logo ? (
                <img
                  src={formData.logo}
                  alt="Company Logo Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-semibold text-slate-800">Company Logo</label>
              <p className="text-[11px] text-slate-500">
                Recommended dimensions: 200x200px or square SVG, PNG, JPG under 5MB.
              </p>
              {isCompanyAdmin && (
                <div className="mt-2 flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">or enter image URL below</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isCompanyAdmin}
                placeholder="e.g. Acme Corp"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  errors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>}
            </div>

            {/* Industry */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Industry <span className="text-rose-500">*</span>
              </label>
              <select
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                disabled={!isCompanyAdmin}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
              {errors.industry && <p className="mt-1 text-[11px] text-rose-500">{errors.industry}</p>}
            </div>

            {/* Website URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website URL
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  disabled={!isCompanyAdmin}
                  placeholder="https://company.example.com"
                  className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    errors.website ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
              </div>
              {errors.website && <p className="mt-1 text-[11px] text-rose-500">{errors.website}</p>}
            </div>

            {/* Company Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Email (Careers / Contact)
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isCompanyAdmin}
                  placeholder="careers@company.example.com"
                  className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    errors.email ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
              </div>
              {errors.email && <p className="mt-1 text-[11px] text-rose-500">{errors.email}</p>}
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  disabled={!isCompanyAdmin}
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Company Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Size
              </label>
              <div className="relative">
                <Users className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <select
                  name="size"
                  value={formData.size}
                  onChange={handleInputChange}
                  disabled={!isCompanyAdmin}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {COMPANY_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Primary Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Location (City, State / Remote) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  disabled={!isCompanyAdmin}
                  placeholder="e.g. San Francisco, CA & Remote"
                  className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    errors.location ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
              </div>
              {errors.location && <p className="mt-1 text-[11px] text-rose-500">{errors.location}</p>}
            </div>

            {/* Company Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Physical Office Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                disabled={!isCompanyAdmin}
                placeholder="Suite / Street Address"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Company Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Company Overview & Culture Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleInputChange}
              disabled={!isCompanyAdmin}
              placeholder="Tell prospective engineering candidates about your company mission, technical stack, culture, and products..."
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                errors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.description && <p className="mt-1 text-[11px] text-rose-500">{errors.description}</p>}
          </div>

          {/* Logo URL Input (optional manual override) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Direct Logo URL
            </label>
            <input
              type="text"
              name="logo"
              value={formData.logo}
              onChange={handleInputChange}
              disabled={!isCompanyAdmin}
              placeholder="https://.../logo.png"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Button */}
          {isCompanyAdmin && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="saas-btn-primary px-5 py-2 text-xs flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving Changes...' : 'Save Company Details'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
