import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCostConfiguration1762185502390 implements MigrationInterface {
    name = 'UpdateCostConfiguration1762185502390'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_configuration" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_configuration" DROP COLUMN "updatedAt"`);
    }

}
