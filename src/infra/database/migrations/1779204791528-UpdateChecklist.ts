import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChecklist1779204791528 implements MigrationInterface {
    name = 'UpdateChecklist1779204791528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" ADD "comment" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "comment"`);
    }

}
