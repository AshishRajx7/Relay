import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OutreachService, UpdateDraftDto } from './outreach.service';
import { EmailDraft } from './entities/email-draft.entity';
import { EmailVariantType } from './entities/email-draft-variant.entity';
import { GmailDraftResult } from './services/gmail-draft.service';

@ApiTags('Outreach & Drafts')
@Controller()
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('campaigns/:campaignId/generate-drafts')
  @ApiOperation({ summary: 'Trigger AI draft generation for all researched prospects in a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({ status: 201, description: 'Draft generation jobs queued' })
  async generateDrafts(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<{ queuedCount: number; campaignId: string }> {
    return this.outreachService.generateDraftsForCampaign(campaignId);
  }

  @Get('campaigns/:campaignId/drafts')
  @ApiOperation({ summary: 'List all generated drafts for a campaign with explainability reasoning, quality metrics, and all 3 variants' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'List of drafts' })
  async getDraftsByCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<EmailDraft[]> {
    return this.outreachService.findDraftsByCampaign(campaignId);
  }

  @Post('campaigns/:id/create-gmail-drafts')
  @ApiOperation({ summary: 'Batch create Gmail drafts for all generated/approved drafts in a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Batch Gmail draft creation queued' })
  async createGmailDrafts(
    @Param('id', ParseUUIDPipe) campaignId: string,
  ): Promise<{ campaignId: string; draftsQueued: number; alreadyCreated: number; failed: number }> {
    return this.outreachService.createGmailDraftsForCampaign(campaignId);
  }

  @Get('drafts/:id')
  @ApiOperation({ summary: 'Get a single draft with full reasoning breakdown, quality scorecard, and all variants' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiResponse({ status: 200, description: 'Draft details' })
  async getDraftById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmailDraft> {
    return this.outreachService.findDraftById(id);
  }

  @Patch('drafts/:id')
  @ApiOperation({ summary: 'Edit draft subject or body (marks status as EDITED)' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', example: 'Refined Subject Line' },
        body: { type: 'string', example: 'Updated personalized body...' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Draft updated' })
  async updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDraftDto,
  ): Promise<EmailDraft> {
    return this.outreachService.updateDraft(id, dto);
  }

  @Post('drafts/:id/select-variant')
  @ApiOperation({ summary: 'Switch active draft content to one of the 3 generated variants (TECHNICAL, STARTUP, DIRECT)' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        variantType: { type: 'string', enum: ['TECHNICAL', 'STARTUP', 'DIRECT'], example: 'TECHNICAL' },
      },
      required: ['variantType'],
    },
  })
  @ApiResponse({ status: 200, description: 'Active variant switched' })
  async selectVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('variantType') variantType: EmailVariantType,
  ): Promise<EmailDraft> {
    return this.outreachService.selectVariant(id, variantType);
  }

  @Post('drafts/:id/approve')
  @ApiOperation({ summary: 'Approve a draft for Gmail creation' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiResponse({ status: 200, description: 'Draft approved' })
  async approveDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmailDraft> {
    return this.outreachService.approveDraft(id);
  }

  @Post('drafts/:id/reject')
  @ApiOperation({ summary: 'Reject a draft' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiResponse({ status: 200, description: 'Draft rejected' })
  async rejectDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmailDraft> {
    return this.outreachService.rejectDraft(id);
  }

  @Post('drafts/:id/regenerate')
  @ApiOperation({ summary: 'Regenerate AI drafts and all 3 variants for a prospect' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiResponse({ status: 200, description: 'Draft regenerated' })
  async regenerateDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmailDraft> {
    return this.outreachService.regenerateDraft(id);
  }

  @Post('drafts/:id/create-gmail-draft')
  @ApiOperation({ summary: 'Create a draft in user\'s Gmail account (MANDATORY APPROVAL CHECK)' })
  @ApiParam({ name: 'id', description: 'Draft UUID' })
  @ApiResponse({ status: 201, description: 'Gmail draft created successfully' })
  async createGmailDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GmailDraftResult> {
    return this.outreachService.createGmailDraft(id);
  }
}
