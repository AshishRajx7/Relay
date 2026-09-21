export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  candidateProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOverviewDto {
  campaignId: string;
  name: string;
  status: CampaignStatus;
  progressPercentage: number;
  totalProspects: number;
  processedProspects: number;
  terminalProspects?: number;
  researchedProspects: number;
  synthesizedProspects?: number;
  draftsGenerated: number;
  readyForApprovalCount?: number;
  approvedCount: number;
  manualReviewCount: number;
  refusedCount?: number;
  failedCount: number;
  gmailDraftCount: number;
  cost: {
    crawlCount: number;
    llmCalls: number;
    estimatedCostUsd: number;
  };
  duplicateAnalysis: {
    uniqueCompaniesCount: number;
    duplicateCompanyCount: number;
    duplicateDraftCount: number;
    warnings: string[];
  };
}

export interface IngestionResult {
  total: number;
  queued: number;
  duplicateInFile: number;
  duplicateInQueue: number;
  duplicateInDatabase: number;
  campaignId?: string;
  totalParsed?: number;
  totalCreated?: number;
  totalDuplicates?: number;
  validProspects?: number;
  duplicatesSkipped?: number;
  message?: string;
}
