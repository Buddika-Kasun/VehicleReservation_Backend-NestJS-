import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCostCenter1762186442488 implements MigrationInterface {
    name = 'UpdateCostCenter1762186442488'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_center" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "cost_center" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "cost_center" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_center" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "cost_center" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "cost_center" DROP COLUMN "isActive"`);
    }

}
