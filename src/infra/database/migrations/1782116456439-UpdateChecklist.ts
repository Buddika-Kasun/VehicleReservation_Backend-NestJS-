import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChecklist1782116456439 implements MigrationInterface {
    name = 'UpdateChecklist1782116456439'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" ADD "version" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "version"`);
    }

}
