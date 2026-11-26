export const DEFAULT_COMPANY_LOGO = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120';

/**
 * Returns a displayable URL for a company logo.
 * - Handles external URLs (http/https)
 * - Handles legacy local uploads (/uploads/...)
 * - Handles Azure blob references (logos/... or blob://...) by directing to /api/companies/:id/logo
 * - Falls back to default placeholder image if no logo is provided
 */
export function getCompanyLogoUrl(logo?: string | null, companyId?: string | null): string {
  if (!logo || typeof logo !== 'string' || logo.trim() === '') {
    if (companyId) {
      return `/api/companies/${companyId}/logo`;
    }
    return DEFAULT_COMPANY_LOGO;
  }

  const trimmed = logo.trim();

  // If already an HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Legacy local file uploads
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // If already pointing to the company logo endpoint
  if (trimmed.startsWith('/api/companies/')) {
    return trimmed;
  }

  // Azure blob reference (e.g. logos/{companyId}/... or blob://...)
  if (companyId) {
    return `/api/companies/${companyId}/logo`;
  }

  return trimmed;
}
