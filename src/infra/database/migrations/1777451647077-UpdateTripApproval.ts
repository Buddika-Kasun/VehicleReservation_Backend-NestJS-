import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTripApproval1777451647077 implements MigrationInterface {
    name = 'UpdateTripApproval1777451647077'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "isActive"`);
    }

}
