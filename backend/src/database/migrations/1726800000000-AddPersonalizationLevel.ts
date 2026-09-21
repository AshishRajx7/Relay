import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonalizationLevel1726800000000 implements MigrationInterface {
  name = 'AddPersonalizationLevel1726800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prospects"
      ADD COLUMN IF NOT EXISTS "personalization_level" character varying(50);

      ALTER TABLE "outreach_strategy"
      ADD COLUMN IF NOT EXISTS "personalization_level" character varying(50);

      ALTER TABLE "email_drafts"
      ADD COLUMN IF NOT EXISTS "personalization_level" character varying(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_drafts"
      DROP COLUMN IF EXISTS "personalization_level";

      ALTER TABLE "outreach_strategy"
      DROP COLUMN IF EXISTS "personalization_level";

      ALTER TABLE "prospects"
      DROP COLUMN IF EXISTS "personalization_level";
    `);
  }
}
