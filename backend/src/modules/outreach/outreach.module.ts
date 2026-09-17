import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EmailDraft } from './entities/email-draft.entity';
import { DraftReasoning } from './entities/draft-reasoning.entity';
import { DraftQuality } from './entities/draft-quality.entity';
import { EmailDraftVariant } from './entities/email-draft-variant.entity';
import { RelationshipMatchEntity } from './entities/relationship-match.entity';
import { OutreachStrategyEntity } from './entities/outreach-strategy.entity';
import { DraftClaimEntity } from './entities/draft-claim.entity';
import { DraftVerificationEntity } from './entities/draft-verification.entity';
import { Prospect } from '../prospects/entities/prospect.entity';
import { CompanyProfile } from '../company-research/entities/company-profile.entity';
import { CompanySource } from '../company-research/entities/company-source.entity';
import { CompanyEvidenceEntity } from '../company-research/entities/company-evidence.entity';
import { CandidateProfile } from '../resume/entities/candidate-profile.entity';
import { CandidateExperienceEntity } from '../resume/entities/candidate-experience.entity';
import { CandidateEvidenceEntity } from '../resume/entities/candidate-evidence.entity';
import { ResumeFile } from '../resume/entities/resume-file.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ContactIntelligenceService } from './services/contact-intelligence.service';
import { CandidateMatchingService } from './services/candidate-matching.service';
import { DraftQualityService } from './services/draft-quality.service';
import { EmailGenerationService } from './services/email-generation.service';
import { DraftVerificationService } from './services/draft-verification.service';
import { GmailDraftService } from './services/gmail-draft.service';
import { OutreachService } from './outreach.service';
import { OutreachController } from './outreach.controller';
import { DraftGenerationProcessor } from '../queue/processors/draft-generation.processor';
import { GmailDraftProcessor } from '../queue/processors/gmail-draft.processor';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { CompanyResearchModule } from '../company-research/company-research.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { GmailModule } from '../gmail/gmail.module';
import { StorageModule } from '../storage/storage.module';
import { QUEUE_DRAFT_GENERATION, QUEUE_GMAIL_DRAFT } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailDraft,
      DraftReasoning,
      DraftQuality,
      EmailDraftVariant,
      RelationshipMatchEntity,
      OutreachStrategyEntity,
      DraftClaimEntity,
      DraftVerificationEntity,
      Prospect,
      CompanyProfile,
      CompanySource,
      CompanyEvidenceEntity,
      CandidateProfile,
      CandidateExperienceEntity,
      CandidateEvidenceEntity,
      ResumeFile,
      Campaign,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_DRAFT_GENERATION },
      { name: QUEUE_GMAIL_DRAFT },
    ),
    AIProviderModule,
    CompanyResearchModule,
    GmailModule,
    StorageModule,
    forwardRef(() => CampaignsModule),
  ],
  controllers: [OutreachController],
  providers: [
    ContactIntelligenceService,
    CandidateMatchingService,
    DraftQualityService,
    EmailGenerationService,
    DraftVerificationService,
    GmailDraftService,
    DraftGenerationProcessor,
    GmailDraftProcessor,
    OutreachService,
  ],
  exports: [
    ContactIntelligenceService,
    CandidateMatchingService,
    DraftQualityService,
    EmailGenerationService,
    DraftVerificationService,
    GmailDraftService,
    OutreachService,
  ],
})
export class OutreachModule {}
