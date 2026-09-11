import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductionOutreachLayerSchema1726000000000 implements MigrationInterface {
  name = 'CreateProductionOutreachLayerSchema1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create gmail_accounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gmail_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "candidate_profile_id" uuid,
        "email" character varying(255) NOT NULL,
        "google_user_id" character varying(255),
        "refresh_token" text NOT NULL,
        "connected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_sync_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gmail_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gmail_accounts_email" UNIQUE ("email")
      );
    `);

    // 2. Create email_draft_variants table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_draft_variants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email_draft_id" uuid NOT NULL,
        "variant_type" character varying(50) NOT NULL,
        "subject" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "word_count" integer NOT NULL DEFAULT 0,
        "personalization_score" smallint NOT NULL DEFAULT 0,
        "relevance_score" smallint NOT NULL DEFAULT 0,
        "spam_risk_score" smallint NOT NULL DEFAULT 0,
        "technical_alignment_score" smallint NOT NULL DEFAULT 0,
        "confidence_score" smallint NOT NULL DEFAULT 0,
        "is_selected" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_draft_variants_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_draft_variants_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_draft_variants_email_draft_id" ON "email_draft_variants" ("email_draft_id");
    `);

    // 3. Extend campaigns with cost and duplicate tracking columns
    await queryRunner.query(`
      ALTER TABLE "campaigns"
        ADD COLUMN IF NOT EXISTS "crawl_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "llm_calls" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "estimated_cost_usd" numeric(10,4) NOT NULL DEFAULT 0.0000;
    `);

    // 4. Extend prospects with failure_type
    await queryRunner.query(`
      ALTER TABLE "prospects"
        ADD COLUMN IF NOT EXISTS "failure_type" character varying(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_draft_variants";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gmail_accounts";`);
  }
}
