import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceRelayV3RelationshipQualitativeCriteria1726700000000 implements MigrationInterface {
  name = 'EnhanceRelayV3RelationshipQualitativeCriteria1726700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relationship_match"
      ADD COLUMN IF NOT EXISTS "ranking_score" integer,
      ADD COLUMN IF NOT EXISTS "directness" character varying(50),
      ADD COLUMN IF NOT EXISTS "evidence_specificity" character varying(50),
      ADD COLUMN IF NOT EXISTS "candidate_ownership" character varying(50),
      ADD COLUMN IF NOT EXISTS "generic_overlap_detected" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relationship_match"
      DROP COLUMN IF EXISTS "generic_overlap_detected",
      DROP COLUMN IF EXISTS "candidate_ownership",
      DROP COLUMN IF EXISTS "evidence_specificity",
      DROP COLUMN IF EXISTS "directness",
      DROP COLUMN IF EXISTS "ranking_score";
    `);
  }
}
