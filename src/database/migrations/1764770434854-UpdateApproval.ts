import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApproval1764770434854 implements MigrationInterface {
    name = 'UpdateApproval1764770434854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_1c3e530225e540898d410b9f76b"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_ebac44d329d175e5ebfab8a65e3"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_4a69e1d8575d06799ec920f8f66"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver1Id"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver2Id"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "safetyApproverId"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "statusApproval"`);
        await queryRunner.query(`DROP TYPE "public"."approval_statusapproval_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver1status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver1Status" "public"."approval_approver1status_enum" DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver1ApprovedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver1Comments" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."approval_approver2status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver2Status" "public"."approval_approver2status_enum" DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver2ApprovedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver2Comments" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."approval_safetyapproverstatus_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "safetyApproverStatus" "public"."approval_safetyapproverstatus_enum" DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "safetyApproverApprovedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "safetyApproverComments" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."approval_overallstatus_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "overallStatus" "public"."approval_overallstatus_enum" NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`CREATE TYPE "public"."approval_currentstep_enum" AS ENUM('hod', 'secondary', 'safety')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "currentStep" "public"."approval_currentstep_enum" NOT NULL DEFAULT 'hod'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "requireApprover1" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "requireApprover2" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "requireSafetyApprover" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "rejectionReason" text`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "tripId" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "UQ_757dad7d560ac39e5d6a8e670ce" UNIQUE ("tripId")`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver1_id" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver2_id" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "safety_approver_id" integer`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "comments"`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "comments" text`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_d25d496b46f8c5fc09d4d62e016" FOREIGN KEY ("approver1_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_9ffb82ac8c6dfc1df307cd9752d" FOREIGN KEY ("approver2_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_e89c26012a3a8cc6aa65bc7fca7" FOREIGN KEY ("safety_approver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_e89c26012a3a8cc6aa65bc7fca7"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_9ffb82ac8c6dfc1df307cd9752d"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_d25d496b46f8c5fc09d4d62e016"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "comments"`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "comments" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "safety_approver_id"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver2_id"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver1_id"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "UQ_757dad7d560ac39e5d6a8e670ce"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "tripId"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "rejectionReason"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "requireSafetyApprover"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "requireApprover2"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "requireApprover1"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "currentStep"`);
        await queryRunner.query(`DROP TYPE "public"."approval_currentstep_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "overallStatus"`);
        await queryRunner.query(`DROP TYPE "public"."approval_overallstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "safetyApproverComments"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "safetyApproverApprovedAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "safetyApproverStatus"`);
        await queryRunner.query(`DROP TYPE "public"."approval_safetyapproverstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver2Comments"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver2ApprovedAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver2Status"`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver2status_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver1Comments"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver1ApprovedAt"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN "approver1Status"`);
        await queryRunner.query(`DROP TYPE "public"."approval_approver1status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_statusapproval_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "statusApproval" "public"."approval_statusapproval_enum" NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "safetyApproverId" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver2Id" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD "approver1Id" integer`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_4a69e1d8575d06799ec920f8f66" FOREIGN KEY ("safetyApproverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_ebac44d329d175e5ebfab8a65e3" FOREIGN KEY ("approver2Id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_1c3e530225e540898d410b9f76b" FOREIGN KEY ("approver1Id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
