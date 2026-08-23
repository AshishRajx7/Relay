import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutreachAndAtsFieldsToResearch1724600000000 implements MigrationInterface {
  name = 'AddOutreachAndAtsFieldsToResearch1724600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_research"
        ADD COLUMN "careers_page_url" character varying(512),
        ADD COLUMN "ats_provider" character varying(50),
        ADD COLUMN "is_hiring" boolean NOT NULL DEFAULT false,
        ADD COLUMN "hiring_signals" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN "generic_contact_emails" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN "target_departments" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN "locations" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN "outreach_hooks" jsonb NOT NULL DEFAULT '[]';
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_research_is_hiring" ON "company_research" ("is_hiring");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_research_ats_provider" ON "company_research" ("ats_provider");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_company_research_ats_provider";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_company_research_is_hiring";
    `);
    await queryRunner.query(`
      ALTER TABLE "company_research"
        DROP COLUMN IF EXISTS "outreach_hooks",
        DROP COLUMN IF EXISTS "locations",
        DROP COLUMN IF EXISTS "target_departments",
        DROP COLUMN IF EXISTS "generic_contact_emails",
        DROP COLUMN IF EXISTS "hiring_signals",
        DROP COLUMN IF EXISTS "is_hiring",
        DROP COLUMN IF EXISTS "ats_provider",
        DROP COLUMN IF EXISTS "careers_page_url";
    `);
  }
}
