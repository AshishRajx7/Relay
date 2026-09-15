export type ResearchStatus = 'PENDING' | 'CRAWLING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
export type CompanyPersona = 'SAAS' | 'AGENCY' | 'ENTERPRISE' | 'EARLY_STAGE' | 'DEVELOPER_TOOLS' | 'OTHER';

export interface CompanyResearchSummaryDto {
  status: ResearchStatus;
  researchQualityScore: number | null;
  persona: CompanyPersona | null;
  industry: string | null;
  companySize: string | null;
  summary: string | null;
  researchedAt: string | null;
  expiresAt: string | null;
}

export interface CompanyListResponseDto {
  id: string;
  name: string;
  website: string;
  normalizedDomain: string;
  contactCount: number;
  research: CompanyResearchSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachHooksDto {
  whyThisCompany?: string;
  whyNow?: string;
  keyProblemsSolving?: string[];
  engineeringCultureSignals?: string[];
  recentMilestones?: string[];
}

export interface CompanyResearchResponseDto {
  id: string;
  companyId: string;
  status: ResearchStatus;
  persona: CompanyPersona | null;
  industry: string | null;
  companySize: string | null;
  summary: string | null;
  keywords: string[];
  techStack: string[];
  products: string[];
  careersPageUrl: string | null;
  atsProvider: string | null;
  isHiring: boolean;
  hiringSignals: string[];
  genericContactEmails: string[];
  targetDepartments: string[];
  locations: string[];
  outreachHooks: OutreachHooksDto;
  rawMarkdown: string | null;
  researchQualityScore: number | null;
  qualityReason: string | null;
  crawlMetadata: Record<string, any> | null;
  lastError: string | null;
}
