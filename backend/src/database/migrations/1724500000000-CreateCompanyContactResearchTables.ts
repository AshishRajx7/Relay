import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyContactResearchTables1724500000000 implements MigrationInterface {
  name = 'CreateCompanyContactResearchTables1724500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum types
    await queryRunner.query(`
      CREATE TYPE "company_persona" AS ENUM (
        'STARTUP',
        'SCALEUP',
        'ENTERPRISE',
        'AGENCY',
        'CONSULTING',
        'SAAS',
        'ECOMMERCE',
        'FINTECH',
        'HEALTHCARE',
        'OTHER'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "research_status" AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'INSUFFICIENT',
        'FAILED'
      );
    `);

    // 2. Create company table
    await queryRunner.query(`
      CREATE TABLE "company" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "website" character varying(512) NOT NULL,
        "normalized_domain" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_normalized_domain" UNIQUE ("normalized_domain")
      );
    `);

    // 3. Create contact table
    await queryRunner.query(`
      CREATE TABLE "contact" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "title" character varying(255),
        "company_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contact_email" UNIQUE ("email"),
        CONSTRAINT "FK_contact_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_contact_company_id" ON "contact" ("company_id");
    `);

    // 4. Create company_research table
    await queryRunner.query(`
      CREATE TABLE "company_research" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "status" "research_status" NOT NULL DEFAULT 'PENDING',
        "persona" "company_persona",
        "industry" character varying(255),
        "company_size" character varying(100),
        "summary" text,
        "keywords" jsonb NOT NULL DEFAULT '[]',
        "tech_stack" jsonb NOT NULL DEFAULT '[]',
        "products" jsonb NOT NULL DEFAULT '[]',
        "raw_markdown" text,
        "research_quality_score" smallint,
        "quality_reason" text,
        "crawl_metadata" jsonb,
        "last_error" text,
        "researched_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_research_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_research_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_research_company_id" ON "company_research" ("company_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_research_status" ON "company_research" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_research_expires_at" ON "company_research" ("expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_research";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "research_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_persona";`);
  }
}
