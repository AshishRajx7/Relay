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
  researchedProspects: number;
  draftsGenerated: number;
  manualReviewCount: number;
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
  campaignId: string;
  totalParsed: number;
  validProspects: number;
  duplicatesSkipped: number;
  message: string;
}
