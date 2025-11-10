import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCostCenter1762242193738 implements MigrationInterface {
    name = 'UpdateCostCenter1762242193738'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_center" ADD "budget" numeric(10,2) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_center" DROP COLUMN "budget"`);
    }

}
