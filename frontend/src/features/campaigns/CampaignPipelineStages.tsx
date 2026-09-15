import React from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { CampaignOverviewDto } from '../../types/campaign';

interface CampaignPipelineStagesProps {
  overview?: CampaignOverviewDto;
}

export const CampaignPipelineStages: React.FC<CampaignPipelineStagesProps> = ({ overview }) => {
  const total = overview?.totalProspects ?? 0;
  const researched = overview?.researchedProspects ?? 0;
  const drafted = overview?.draftsGenerated ?? 0;
  const gmailCreated = overview?.gmailDraftCount ?? 0;
  const approved = Math.max(0, drafted - (overview?.manualReviewCount ?? 0));

  const stages = [
    { label: 'Prospects Imported', count: total, complete: total > 0 },
    { label: 'Research Complete', count: researched, complete: researched > 0 && researched >= total },
    { label: 'Drafts Generated', count: drafted, complete: drafted > 0 && drafted >= researched },
    { label: 'Approved', count: approved, complete: approved > 0 && approved >= drafted },
    { label: 'Gmail Drafts Created', count: gmailCreated, complete: gmailCreated > 0 && gmailCreated >= approved },
  ];

  return (
    <div className="bg-relay-card border border-relay-border rounded-lg p-5 shadow-operator">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-relay-muted font-medium">
          Campaign Pipeline Progress
        </span>
        <span className="font-mono text-xs font-semibold text-relay-accent">
          {overview?.progressPercentage ?? 0}% Complete
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 relative">
        {stages.map((stage, idx) => (
          <div
            key={stage.label}
            className={`flex flex-col justify-between p-3 rounded border transition-colors ${
              stage.count > 0
                ? 'bg-relay-bg/80 border-relay-border-light'
                : 'bg-relay-bg/30 border-relay-border/50 text-relay-subtle'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono text-[11px] text-relay-subtle">
                Stage 0{idx + 1}
              </span>
              {stage.complete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-relay-success" />
              ) : (
                <span className="w-2 h-2 rounded-full border border-relay-border" />
              )}
            </div>

            <div className="my-1">
              <div className="text-xl font-mono font-bold text-relay-text">
                {stage.count}
              </div>
              <div className="text-xs font-medium text-relay-muted mt-0.5 truncate">
                {stage.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
