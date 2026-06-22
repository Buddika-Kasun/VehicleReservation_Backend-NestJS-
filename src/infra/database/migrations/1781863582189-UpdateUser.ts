import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1781863582189 implements MigrationInterface {
    name = 'UpdateUser1781863582189'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "isSafetyApprover" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSafetyApprover"`);
    }

}
