export type OutreachDraftStatus =
  | 'GENERATED'
  | 'EDITED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'GMAIL_DRAFT_CREATED'
  | 'REJECTED';

export type EmailVariantType = 'TECHNICAL' | 'STARTUP' | 'DIRECT';

export interface DraftReasoning {
  id: string;
  whyCompany?: string;
  whyNow?: string;
  whyMe?: string;
  whyRelevant?: string;
  matchedTechnologies?: string[];
  chosenProject?: string;
}

export interface DraftQuality {
  id: string;
  personalizationScore: number;
  relevanceScore: number;
  spamRiskScore: number;
  technicalAlignmentScore: number;
  confidenceScore: number;
  conversionScore: number;
  requiresManualReview: boolean;
  flags: string[];
}

export interface EmailDraftVariant {
  id: string;
  variantType: EmailVariantType;
  subject: string;
  body: string;
  wordCount: number;
  personalizationScore?: number;
  relevanceScore?: number;
  spamRiskScore?: number;
  technicalAlignmentScore?: number;
  confidenceScore?: number;
  isSelected: boolean;
}

export interface Prospect {
  id: string;
  campaignId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  domain?: string;
  companyName?: string;
  researchStatus: string;
  draftStatus: string;
  companyProfile?: {
    id: string;
    companyName: string;
    domain: string;
    researchScore?: number;
    industry?: string;
    techSignals?: string[];
    products?: string[];
    summary?: string;
  };
}

export interface EmailDraft {
  id: string;
  prospectId: string;
  prospect: Prospect;
  subject: string;
  body: string;
  status: OutreachDraftStatus;
  gmailDraftId: string | null;
  gmailThreadId?: string | null;
  reasoning?: DraftReasoning | null;
  quality?: DraftQuality | null;
  variants?: EmailDraftVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDraftDto {
  subject?: string;
  body?: string;
}

export interface GmailDraftResult {
  draftId: string;
  email: string;
  gmailDraftId: string;
  status: string;
}
