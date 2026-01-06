import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCostConfiguration1763121638899 implements MigrationInterface {
    name = 'UpdateCostConfiguration1763121638899'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_configuration" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_configuration" DROP COLUMN "isActive"`);
    }

}
