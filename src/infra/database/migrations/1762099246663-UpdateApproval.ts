import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApproval1762099246663 implements MigrationInterface {
    name = 'UpdateApproval1762099246663'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "decidedAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_statusapproval_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "statusApproval" "public"."approval_statusapproval_enum" NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "statusApproval"`);
        await queryRunner.query(`DROP TYPE "public"."approval_statusapproval_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "status" character varying(50) NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "decidedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
