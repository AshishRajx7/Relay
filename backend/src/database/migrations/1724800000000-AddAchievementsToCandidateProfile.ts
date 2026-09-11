import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAchievementsToCandidateProfile1724800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAchievements = await queryRunner.hasColumn('candidate_profile', 'achievements');
    if (!hasAchievements) {
      await queryRunner.addColumn(
        'candidate_profile',
        new TableColumn({
          name: 'achievements',
          type: 'jsonb',
          isNullable: true,
          default: "'[]'::jsonb",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAchievements = await queryRunner.hasColumn('candidate_profile', 'achievements');
    if (hasAchievements) {
      await queryRunner.dropColumn('candidate_profile', 'achievements');
    }
  }
}
