import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutreachPlatformSchema1725000000000 implements MigrationInterface {
  name = 'CreateOutreachPlatformSchema1725000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend campaigns table
    await queryRunner.query(`
      ALTER TABLE "campaigns"
        ADD COLUMN IF NOT EXISTS "manual_review_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "gmail_draft_count" integer NOT NULL DEFAULT 0;
    `);

    // 2. Extend prospects table
    await queryRunner.query(`
      ALTER TABLE "prospects"
        ADD COLUMN IF NOT EXISTS "contact_type" character varying(50) NOT NULL DEFAULT 'GENERAL';
    `);

    // 3. Extend company_profiles table
    await queryRunner.query(`
      ALTER TABLE "company_profiles"
        ADD COLUMN IF NOT EXISTS "company_stage" character varying(100),
        ADD COLUMN IF NOT EXISTS "business_model" character varying(100),
        ADD COLUMN IF NOT EXISTS "employee_range" character varying(100),
        ADD COLUMN IF NOT EXISTS "tech_signals" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "recent_initiatives" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "research_score" smallint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_researched_at" TIMESTAMP WITH TIME ZONE;
    `);

    // 4. Create or recreate email_drafts table for Phase 2
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_drafts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "prospect_id" uuid NOT NULL,
        "subject" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'GENERATED',
        "gmail_draft_id" character varying(255),
        "gmail_thread_id" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_drafts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_drafts_prospect_id" UNIQUE ("prospect_id"),
        CONSTRAINT "FK_email_drafts_prospect" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_drafts_prospect_id" ON "email_drafts" ("prospect_id");
      CREATE INDEX IF NOT EXISTS "IDX_email_drafts_status" ON "email_drafts" ("status");
    `);

    // 5. Create draft_reasoning table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_reasoning" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email_draft_id" uuid NOT NULL,
        "chosen_project" character varying(255) NOT NULL,
        "match_score" smallint NOT NULL DEFAULT 0,
        "why_company" text NOT NULL,
        "why_me" text NOT NULL,
        "why_now" text,
        "why_relevant" text NOT NULL,
        "matched_technologies" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "ranked_matches" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "confidence_level" character varying(50) NOT NULL DEFAULT 'HIGH',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_draft_reasoning_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_draft_reasoning_email_draft_id" UNIQUE ("email_draft_id"),
        CONSTRAINT "FK_draft_reasoning_email_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_draft_reasoning_email_draft_id" ON "draft_reasoning" ("email_draft_id");
    `);

    // 6. Create draft_quality table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_quality" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email_draft_id" uuid NOT NULL,
        "personalization_score" smallint NOT NULL DEFAULT 0,
        "relevance_score" smallint NOT NULL DEFAULT 0,
        "spam_risk_score" smallint NOT NULL DEFAULT 0,
        "technical_alignment_score" smallint NOT NULL DEFAULT 0,
        "confidence_score" smallint NOT NULL DEFAULT 0,
        "requires_manual_review" boolean NOT NULL DEFAULT false,
        "flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_draft_quality_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_draft_quality_email_draft_id" UNIQUE ("email_draft_id"),
        CONSTRAINT "FK_draft_quality_email_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_draft_quality_email_draft_id" ON "draft_quality" ("email_draft_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "draft_quality";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "draft_reasoning";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_drafts";`);
  }
}
