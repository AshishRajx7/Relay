import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeCategoryAndDossierColumns1726500000000 implements MigrationInterface {
  name = 'AddResumeCategoryAndDossierColumns1726500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resume_file" 
        ADD COLUMN IF NOT EXISTS "category" character varying(50) NOT NULL DEFAULT 'BACKEND';
    `);

    await queryRunner.query(`
      ALTER TABLE "draft_reasoning"
        ADD COLUMN IF NOT EXISTS "selected_resume_id" uuid,
        ADD COLUMN IF NOT EXISTS "selected_resume_name" character varying(255),
        ADD COLUMN IF NOT EXISTS "selected_resume_category" character varying(50),
        ADD COLUMN IF NOT EXISTS "selection_reason" text,
        ADD COLUMN IF NOT EXISTS "evidence_used" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "projects_referenced" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "key_matches" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "reason_contact_chosen" text,
        ADD COLUMN IF NOT EXISTS "why_me_points" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "missing_skills" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "all_resume_scores" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "recommended_talking_points" jsonb DEFAULT '[]';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_reasoning"
        DROP COLUMN IF EXISTS "recommended_talking_points",
        DROP COLUMN IF EXISTS "all_resume_scores",
        DROP COLUMN IF EXISTS "missing_skills",
        DROP COLUMN IF EXISTS "why_me_points",
        DROP COLUMN IF EXISTS "reason_contact_chosen",
        DROP COLUMN IF EXISTS "key_matches",
        DROP COLUMN IF EXISTS "projects_referenced",
        DROP COLUMN IF EXISTS "evidence_used",
        DROP COLUMN IF EXISTS "selection_reason",
        DROP COLUMN IF EXISTS "selected_resume_category",
        DROP COLUMN IF EXISTS "selected_resume_name",
        DROP COLUMN IF EXISTS "selected_resume_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "resume_file"
        DROP COLUMN IF EXISTS "category";
    `);
  }
}
