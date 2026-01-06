import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1763208847646 implements MigrationInterface {
    name = 'UpdateUser1763208847646'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "isApproved" SET DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "isApproved" SET DEFAULT 'approved'`);
    }

}
