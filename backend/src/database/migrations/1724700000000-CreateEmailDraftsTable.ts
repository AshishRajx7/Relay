import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailDraftsTable1724700000000 implements MigrationInterface {
  name = 'CreateEmailDraftsTable1724700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create draft_status enum
    await queryRunner.query(`
      CREATE TYPE "draft_status" AS ENUM (
        'PENDING',
        'GENERATING',
        'GENERATED',
        'APPROVED',
        'REJECTED',
        'SENT'
      );
    `);

    // 2. Create email_draft table
    await queryRunner.query(`
      CREATE TABLE "email_draft" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "contact_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "resume_file_id" uuid NOT NULL,
        "candidate_profile_id" uuid,
        "status" "draft_status" NOT NULL DEFAULT 'PENDING',
        "subject" character varying(255),
        "subject_variations" jsonb NOT NULL DEFAULT '[]',
        "body_text" text,
        "personalization_score" smallint,
        "reasoning" jsonb NOT NULL DEFAULT '{}',
        "error_message" text,
        "generated_at" TIMESTAMP WITH TIME ZONE,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_draft_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_draft_contact" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_email_draft_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_email_draft_resume" FOREIGN KEY ("resume_file_id") REFERENCES "resume_file"("id") ON DELETE CASCADE
      );
    `);

    // 3. Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_email_draft_status" ON "email_draft" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_email_draft_contact_id" ON "email_draft" ("contact_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_email_draft_company_id" ON "email_draft" ("company_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_email_draft_resume_file_id" ON "email_draft" ("resume_file_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_draft_resume_file_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_draft_company_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_draft_contact_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_draft_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_draft";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "draft_status";`);
  }
}
