export interface AtsJobPosting {
  externalId: string;
  title: string;
  department?: string | null;
  location?: string | null;
  isRemote?: boolean;
  jobUrl: string;
  postedAt?: Date | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  metadata?: Record<string, any>;
}

export interface IAtsJobProvider {
  readonly providerName: string; // 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKABLE' | 'SMARTRECRUITERS' | 'RIPPLING'
  canHandle(careersUrl: string, atsProvider?: string): boolean;
  fetchOpenPositions(careersUrl: string, companySlug?: string): Promise<AtsJobPosting[]>;
}
