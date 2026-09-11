import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignProspectCompanyProfileTables1724900000000 implements MigrationInterface {
  name = 'CreateCampaignProspectCompanyProfileTables1724900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create company_profiles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "domain" character varying(255) NOT NULL,
        "company_name" character varying(255) NOT NULL,
        "website" character varying(512),
        "industry" character varying(100),
        "company_size" character varying(100),
        "summary" text,
        "products" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "tech_stack" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "hiring_signals" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "recent_news" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "careers_url" character varying(512),
        "research_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_profiles_domain" UNIQUE ("domain")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_profiles_domain" ON "company_profiles" ("domain");
    `);

    // 2. Create campaigns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campaigns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "candidate_profile_id" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "total_prospects" integer NOT NULL DEFAULT 0,
        "completed_prospects" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaigns_candidate_profile" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_campaigns_candidate_profile_id" ON "campaigns" ("candidate_profile_id");
    `);

    // 3. Create prospects table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prospects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campaign_id" uuid NOT NULL,
        "company_profile_id" uuid,
        "email" character varying(255) NOT NULL,
        "domain" character varying(255) NOT NULL,
        "company_name" character varying(255),
        "source_type" character varying(50) NOT NULL DEFAULT 'CSV',
        "research_status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "draft_status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prospects_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_prospects_campaign_email" UNIQUE ("campaign_id", "email"),
        CONSTRAINT "FK_prospects_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_prospects_company_profile" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prospects_campaign_id" ON "prospects" ("campaign_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prospects_company_profile_id" ON "prospects" ("company_profile_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prospects_research_status" ON "prospects" ("research_status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prospects_domain" ON "prospects" ("domain");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prospects";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_profiles";`);
  }
}
