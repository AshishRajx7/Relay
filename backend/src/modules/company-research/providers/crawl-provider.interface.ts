export interface CrawlResult {
  url: string;
  success: boolean;
  markdown: string;
  htmlLinks: string[];
  subpagesCrawled: string[];
  pageCount: number;
  wordCount: number;
  metadata: Record<string, any>;
  errorMessage?: string | null;
}

export interface ICrawlProvider {
  crawl(url: string, maxSubpages?: number): Promise<CrawlResult>;
}
