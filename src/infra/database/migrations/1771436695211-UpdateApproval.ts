import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApproval1771436695211 implements MigrationInterface {
    name = 'UpdateApproval1771436695211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."approval_approver1status_enum" RENAME TO "approval_approver1status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver1status_enum" AS ENUM('pending', 'approved', 'rejected', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" TYPE "public"."approval_approver1status_enum" USING "approver1Status"::"text"::"public"."approval_approver1status_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver1status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_approver2status_enum" RENAME TO "approval_approver2status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver2status_enum" AS ENUM('pending', 'approved', 'rejected', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" TYPE "public"."approval_approver2status_enum" USING "approver2Status"::"text"::"public"."approval_approver2status_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver2status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_safetyapproverstatus_enum" RENAME TO "approval_safetyapproverstatus_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_safetyapproverstatus_enum" AS ENUM('pending', 'approved', 'rejected', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" TYPE "public"."approval_safetyapproverstatus_enum" USING "safetyApproverStatus"::"text"::"public"."approval_safetyapproverstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_safetyapproverstatus_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_overallstatus_enum" RENAME TO "approval_overallstatus_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_overallstatus_enum" AS ENUM('pending', 'approved', 'rejected', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" TYPE "public"."approval_overallstatus_enum" USING "overallStatus"::"text"::"public"."approval_overallstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_overallstatus_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."approval_overallstatus_enum_old" AS ENUM('approved', 'pending', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" TYPE "public"."approval_overallstatus_enum_old" USING "overallStatus"::"text"::"public"."approval_overallstatus_enum_old"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "overallStatus" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_overallstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_overallstatus_enum_old" RENAME TO "approval_overallstatus_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_safetyapproverstatus_enum_old" AS ENUM('approved', 'pending', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" TYPE "public"."approval_safetyapproverstatus_enum_old" USING "safetyApproverStatus"::"text"::"public"."approval_safetyapproverstatus_enum_old"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "safetyApproverStatus" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_safetyapproverstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_safetyapproverstatus_enum_old" RENAME TO "approval_safetyapproverstatus_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver2status_enum_old" AS ENUM('approved', 'pending', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" TYPE "public"."approval_approver2status_enum_old" USING "approver2Status"::"text"::"public"."approval_approver2status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver2Status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver2status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_approver2status_enum_old" RENAME TO "approval_approver2status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver1status_enum_old" AS ENUM('approved', 'pending', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" TYPE "public"."approval_approver1status_enum_old" USING "approver1Status"::"text"::"public"."approval_approver1status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "approver1Status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver1status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_approver1status_enum_old" RENAME TO "approval_approver1status_enum"`);
    }

}
