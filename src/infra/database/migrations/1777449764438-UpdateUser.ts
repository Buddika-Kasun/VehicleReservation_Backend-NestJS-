import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1777449764438 implements MigrationInterface {
    name = 'UpdateUser1777449764438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "isTripApprover" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isTripApprover"`);
    }

}
