import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRelayV3IntelligenceSchema1726600000000 implements MigrationInterface {
  name = 'CreateRelayV3IntelligenceSchema1726600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create candidate_experience table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "candidate_experience" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "resume_id" uuid NOT NULL,
        "candidate_profile_id" uuid NOT NULL,
        "employer" character varying(255) NOT NULL,
        "role_title" character varying(255) NOT NULL,
        "tenure_type" character varying(50) NOT NULL DEFAULT 'FULL_TIME',
        "start_date" character varying(50) NOT NULL,
        "end_date" character varying(50) NOT NULL,
        "location" character varying(255),
        "order_index" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_candidate_experience_resume_id" FOREIGN KEY ("resume_id") REFERENCES "resume_file"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_candidate_experience_candidate_profile_id" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profile"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_candidate_experience_resume_id" ON "candidate_experience" ("resume_id");
      CREATE INDEX IF NOT EXISTS "IDX_candidate_experience_profile_id" ON "candidate_experience" ("candidate_profile_id");
    `);

    // 2. Create candidate_evidence table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "candidate_evidence" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "resume_id" uuid NOT NULL,
        "candidate_profile_id" uuid NOT NULL,
        "experience_id" uuid,
        "source_type" character varying(50) NOT NULL DEFAULT 'RESUME_BULLET',
        "category" character varying(50) NOT NULL DEFAULT 'DELIVERABLE',
        "bullet_index" integer,
        "raw_bullet_text" text,
        "deliverable_name" character varying(255) NOT NULL,
        "atomic_claim" text NOT NULL,
        "technologies" text,
        "is_source_fact" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_candidate_evidence_resume_id" FOREIGN KEY ("resume_id") REFERENCES "resume_file"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_candidate_evidence_candidate_profile_id" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profile"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_candidate_evidence_experience_id" FOREIGN KEY ("experience_id") REFERENCES "candidate_experience"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_candidate_evidence_resume_id" ON "candidate_evidence" ("resume_id");
      CREATE INDEX IF NOT EXISTS "IDX_candidate_evidence_profile_id" ON "candidate_evidence" ("candidate_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_candidate_evidence_experience_id" ON "candidate_evidence" ("experience_id");
    `);

    // 3. Create company_source table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_source" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_profile_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "title" character varying(255),
        "section" character varying(50) NOT NULL DEFAULT 'HOMEPAGE',
        "http_status" integer NOT NULL DEFAULT 200,
        "raw_markdown" text NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "word_count" integer NOT NULL DEFAULT 0,
        "retrieved_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_company_source_profile_id" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_company_source_profile_id" ON "company_source" ("company_profile_id");
    `);

    // 4. Create company_evidence table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_evidence" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_profile_id" uuid NOT NULL,
        "source_id" uuid NOT NULL,
        "source_url" character varying(500) NOT NULL,
        "verbatim_quote" text NOT NULL,
        "atomic_claim" text NOT NULL,
        "category" character varying(50) NOT NULL DEFAULT 'PRODUCT',
        "confidence" real NOT NULL DEFAULT 1.0,
        "is_source_fact" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_company_evidence_profile_id" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_evidence_source_id" FOREIGN KEY ("source_id") REFERENCES "company_source"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_company_evidence_profile_id" ON "company_evidence" ("company_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_company_evidence_source_id" ON "company_evidence" ("source_id");
    `);

    // 5. Create relationship_match table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relationship_match" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_evidence_id" uuid NOT NULL,
        "candidate_evidence_id" uuid NOT NULL,
        "relationship_type" character varying(50) NOT NULL,
        "is_inferred_relationship" boolean NOT NULL DEFAULT true,
        "analytical_rationale" text NOT NULL,
        "relationship_quality" character varying(50) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_relationship_match_company_evidence" FOREIGN KEY ("company_evidence_id") REFERENCES "company_evidence"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_relationship_match_candidate_evidence" FOREIGN KEY ("candidate_evidence_id") REFERENCES "candidate_evidence"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_relationship_match_comp_ev" ON "relationship_match" ("company_evidence_id");
      CREATE INDEX IF NOT EXISTS "IDX_relationship_match_cand_ev" ON "relationship_match" ("candidate_evidence_id");
    `);

    // 6. Create outreach_strategy table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outreach_strategy" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email_draft_id" uuid NOT NULL,
        "recipient_classification" character varying(50) NOT NULL,
        "primary_match_id" uuid,
        "objective" character varying(50) NOT NULL DEFAULT 'START_CONVERSATION',
        "tone" character varying(50) NOT NULL DEFAULT 'PEER',
        "avoid_topics" text,
        "closing_strategy" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_outreach_strategy_email_draft_id" UNIQUE ("email_draft_id"),
        CONSTRAINT "FK_outreach_strategy_email_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_outreach_strategy_primary_match" FOREIGN KEY ("primary_match_id") REFERENCES "relationship_match"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_outreach_strategy_draft_id" ON "outreach_strategy" ("email_draft_id");
    `);

    // 7. Create draft_claim table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_claim" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email_draft_id" uuid NOT NULL,
        "sentence_index" integer NOT NULL,
        "sentence" text NOT NULL,
        "claim_type" character varying(50) NOT NULL DEFAULT 'GENERATED_OUTREACH_CLAIM',
        "is_verified" boolean NOT NULL DEFAULT false,
        "verification_issue" text,
        "grounded_candidate_evidence_id" uuid,
        "grounded_company_evidence_id" uuid,
        CONSTRAINT "FK_draft_claim_email_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_draft_claim_cand_ev" FOREIGN KEY ("grounded_candidate_evidence_id") REFERENCES "candidate_evidence"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_draft_claim_comp_ev" FOREIGN KEY ("grounded_company_evidence_id") REFERENCES "company_evidence"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_draft_claim_draft_id" ON "draft_claim" ("email_draft_id");
    `);

    // 8. Create draft_verification table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_verification" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email_draft_id" uuid NOT NULL,
        "passed" boolean NOT NULL DEFAULT false,
        "severity" character varying(50) NOT NULL DEFAULT 'PASS',
        "total_claims_count" integer NOT NULL DEFAULT 0,
        "verified_claims_count" integer NOT NULL DEFAULT 0,
        "unsupported_claims" jsonb NOT NULL DEFAULT '[]',
        "cross_role_bleed_detected" boolean NOT NULL DEFAULT false,
        "verifier_notes" text,
        "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_draft_verification_email_draft_id" UNIQUE ("email_draft_id"),
        CONSTRAINT "FK_draft_verification_email_draft" FOREIGN KEY ("email_draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_draft_verification_draft_id" ON "draft_verification" ("email_draft_id");
    `);

    // 9. Alter campaign, prospects, company_profiles, draft_reasoning
    await queryRunner.query(`
      ALTER TABLE "campaigns"
        ADD COLUMN IF NOT EXISTS "autonomous_gmail_staging" boolean NOT NULL DEFAULT false;

      ALTER TABLE "prospects"
        ADD COLUMN IF NOT EXISTS "no_angle_reason" character varying(50);

      ALTER TABLE "company_profiles"
        ADD COLUMN IF NOT EXISTS "coverage_metadata" jsonb DEFAULT '{}';

      ALTER TABLE "draft_reasoning"
        ADD COLUMN IF NOT EXISTS "no_angle_reason" character varying(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_reasoning" DROP COLUMN IF EXISTS "no_angle_reason";
      ALTER TABLE "company_profiles" DROP COLUMN IF EXISTS "coverage_metadata";
      ALTER TABLE "prospects" DROP COLUMN IF EXISTS "no_angle_reason";
      ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "autonomous_gmail_staging";

      DROP TABLE IF EXISTS "draft_verification";
      DROP TABLE IF EXISTS "draft_claim";
      DROP TABLE IF EXISTS "outreach_strategy";
      DROP TABLE IF EXISTS "relationship_match";
      DROP TABLE IF EXISTS "company_evidence";
      DROP TABLE IF EXISTS "company_source";
      DROP TABLE IF EXISTS "candidate_evidence";
      DROP TABLE IF EXISTS "candidate_experience";
    `);
  }
}
