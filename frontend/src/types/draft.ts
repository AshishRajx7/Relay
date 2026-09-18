export type OutreachDraftStatus =
  | 'GENERATED'
  | 'EDITED'
  | 'REVIEW_REQUIRED'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'GMAIL_DRAFT_CREATED'
  | 'NO_SUFFICIENT_OUTREACH_ANGLE'
  | 'VERIFICATION_FAILED'
  | 'REJECTED';

export type EmailVariantType = 'TECHNICAL' | 'STARTUP' | 'DIRECT';

export interface DraftClaim {
  id: string;
  sentenceIndex: number;
  sentence: string;
  claimType: string;
  isVerified: boolean;
  verificationIssue?: string | null;
  groundedCandidateEvidenceId?: string | null;
  groundedCompanyEvidenceId?: string | null;
}

export interface DraftVerification {
  id: string;
  emailDraftId: string;
  passed: boolean;
  severity: 'PASS' | 'REVIEW' | 'REJECT' | 'TERMINATED_NO_ANGLE';
  totalClaimsCount: number;
  verifiedClaimsCount: number;
  unsupportedClaims: Array<{ sentence: string; reason: string }>;
  crossRoleBleedDetected: boolean;
  verifierNotes?: string | null;
  verifiedAt: string;
}

export interface OutreachStrategy {
  id: string;
  primaryMatchId?: string | null;
  recipientClassification: string;
  objective: string;
  angle: string;
  tone: string;
  selectedAngle: string;
}

export interface ResumeScoreOption {
  resumeId: string;
  resumeName: string;
  category: string;
  score: number;
  reason: string;
  isSelected: boolean;
}

export interface DraftReasoning {
  id: string;
  whyCompany?: string;
  whyNow?: string;
  whyMe?: string;
  whyRelevant?: string;
  matchedTechnologies?: string[];
  chosenProject?: string;
  matchScore?: number;
  confidenceLevel?: string;
  selectedResumeId?: string | null;
  selectedResumeName?: string | null;
  selectedResumeCategory?: string | null;
  selectionReason?: string | null;
  evidenceUsed?: string[];
  projectsReferenced?: string[];
  keyMatches?: string[];
  reasonContactChosen?: string | null;
  whyMePoints?: string[];
  missingSkills?: string[];
  recommendedTalkingPoints?: string[];
  allResumeScores?: ResumeScoreOption[];
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
  noAngleReason?: string | null;
  companyProfile?: {
    id: string;
    companyName: string;
    domain: string;
    researchScore?: number;
    industry?: string;
    techSignals?: string[];
    products?: string[];
    summary?: string;
    companyStage?: string;
    hiringSignals?: string[];
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
  strategy?: OutreachStrategy | null;
  claims?: DraftClaim[];
  verification?: DraftVerification | null;
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
