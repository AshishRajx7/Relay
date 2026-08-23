import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1724400000000 implements MigrationInterface {
  name = 'CreateInitialTables1724400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum types
    await queryRunner.query(`
      CREATE TYPE "resume_file_status" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'FAILED');
    `);

    await queryRunner.query(`
      CREATE TYPE "ai_request_status" AS ENUM ('SUCCESS', 'FAILED');
    `);

    // 2. Create resume_file table
    await queryRunner.query(`
      CREATE TABLE "resume_file" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "file_name" character varying(255) NOT NULL,
        "original_file_name" character varying(255) NOT NULL,
        "storage_path" character varying(512) NOT NULL,
        "file_hash" character varying(64) NOT NULL,
        "status" "resume_file_status" NOT NULL DEFAULT 'UPLOADED',
        "raw_text" text,
        "label" character varying(100),
        "parse_error" text,
        "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resume_file_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resume_file_hash" ON "resume_file" ("file_hash");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resume_file_status" ON "resume_file" ("status");
    `);

    // 3. Create candidate_profile table
    await queryRunner.query(`
      CREATE TABLE "candidate_profile" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "resume_file_id" uuid NOT NULL,
        "name" character varying(255),
        "email" character varying(255),
        "phone" character varying(50),
        "location" character varying(255),
        "title" character varying(255),
        "summary" text,
        "total_years_experience" real,
        "skills" jsonb NOT NULL DEFAULT '{"languages":[],"frameworks":[],"databases":[],"tools":[],"other":[]}',
        "experience" jsonb NOT NULL DEFAULT '[]',
        "education" jsonb NOT NULL DEFAULT '[]',
        "projects" jsonb NOT NULL DEFAULT '[]',
        "certifications" jsonb NOT NULL DEFAULT '[]',
        "links" jsonb NOT NULL DEFAULT '{"linkedin":null,"github":null,"portfolio":null}',
        "parsed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_candidate_profile_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_candidate_profile_resume_file_id" UNIQUE ("resume_file_id"),
        CONSTRAINT "FK_candidate_profile_resume_file" FOREIGN KEY ("resume_file_id") REFERENCES "resume_file"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // 4. Create ai_request_log table
    await queryRunner.query(`
      CREATE TABLE "ai_request_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "provider" character varying(50) NOT NULL,
        "model" character varying(50) NOT NULL,
        "feature" character varying(50) NOT NULL,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "latency_ms" integer NOT NULL DEFAULT 0,
        "status" "ai_request_status" NOT NULL DEFAULT 'SUCCESS',
        "error_message" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_request_log_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_request_log_provider" ON "ai_request_log" ("provider");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_request_log_feature" ON "ai_request_log" ("feature");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_request_log_created_at" ON "ai_request_log" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_request_log";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "candidate_profile";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_file";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_request_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resume_file_status";`);
  }
}
