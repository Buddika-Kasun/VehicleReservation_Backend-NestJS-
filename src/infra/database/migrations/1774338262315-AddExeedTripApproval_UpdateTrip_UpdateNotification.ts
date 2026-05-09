import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExeedTripApprovalUpdateTripUpdateNotification1774338262315 implements MigrationInterface {
    name = 'AddExeedTripApprovalUpdateTripUpdateNotification1774338262315'

    public async up(queryRunner: QueryRunner): Promise<void> {
      // Drop the backup table that depends on the old enum
      await queryRunner.query(`DROP TABLE IF EXISTS "trip_backup_20260313" CASCADE`);
      
      await queryRunner.query(
        `CREATE TYPE "public"."exceed_approval_status_enum" AS ENUM('pending', 'approved', 'rejected', 'canceled')`,
      );
      await queryRunner.query(
        `CREATE TABLE "exceed_approval" ("id" SERIAL NOT NULL, "approverApprovedAt" TIMESTAMP, "approverComments" character varying(255), "Status" "public"."exceed_approval_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tripId" integer, "approver_id" integer, CONSTRAINT "REL_cbc3da6e22a930ec38daab057c" UNIQUE ("tripId"), CONSTRAINT "PK_629731be717884762dc5b4fab3b" PRIMARY KEY ("id"))`,
      );
      await queryRunner.query(
        `ALTER TYPE "public"."trip_status_enum" RENAME TO "trip_status_enum_old"`,
      );
      await queryRunner.query(
        `CREATE TYPE "public"."trip_status_enum" AS ENUM('draft', 'pending', 'canceled', 'approved', 'rejected', 'read', 'ongoing', 'finished', 'exceed', 'completed')`,
      );
      await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" DROP DEFAULT`);
      await queryRunner.query(
        `ALTER TABLE "trip" ALTER COLUMN "status" TYPE "public"."trip_status_enum" USING "status"::"text"::"public"."trip_status_enum"`,
      );
      await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" SET DEFAULT 'draft'`);
      await queryRunner.query(`DROP TYPE "public"."trip_status_enum_old"`);
      await queryRunner.query(
        `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
      );
      await queryRunner.query(
        `CREATE TYPE "public"."notifications_type_enum" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_CREATED_AS_DRAFT', 'TRIP_PASSENGER_JOINED', 'TRIP_PASSENGERS_ADDED', 'TRIP_CONFIRMED', 'TRIP_CONFIRMED_FOR_APPROVAL', 'TRIP_UPDATED', 'TRIP_EXCEED', 'TRIP_COMPLETED', 'TRIP_COMPLETED_FOR_REQUESTER', 'TRIP_COMPLETED_FOR_DRIVER', 'TRIP_COMPLETED_FOR_SUPERVISOR', 'TRIP_APPROVED', 'TRIP_APPROVED_BY_APPROVER', 'TRIP_APPROVED_FOR_DRIVER', 'TRIP_APPROVED_FOR_SECURITY', 'TRIP_REJECTED', 'TRIP_REJECTED_BY_APPROVER', 'TRIP_CANCELLED', 'TRIP_CANCELLED_REQUESTER', 'TRIP_CANCELLED_SUPERVISOR', 'TRIP_STARTED', 'TRIP_STARTED_FOR_PASSENGER', 'TRIP_STARTED_FOR_SUPERVISOR', 'TRIP_FINISHED', 'TRIP_FINISHED_FOR_REQUESTER', 'TRIP_FINISHED_FOR_SUPERVISOR', 'TRIP_FINISHED_FOR_SECURITY', 'TRIP_READING_START', 'TRIP_READING_START_FOR_DRIVER', 'TRIP_READING_START_FOR_PASSENGER', 'TRIP_READING_END', 'TRIP_APPROVAL_NEEDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'VEHICLE_ASSIGNED', 'VEHICLE_UNASSIGNED', 'VEHICLE_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`,
      );
      await queryRunner.query(
        `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
      );
      await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
      await queryRunner.query(
        `ALTER TABLE "exceed_approval" ADD CONSTRAINT "FK_cbc3da6e22a930ec38daab057c7" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "exceed_approval" ADD CONSTRAINT "FK_5ee8478ff1433b8c2f13da7a932" FOREIGN KEY ("approver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exceed_approval" DROP CONSTRAINT "FK_5ee8478ff1433b8c2f13da7a932"`);
        await queryRunner.query(`ALTER TABLE "exceed_approval" DROP CONSTRAINT "FK_cbc3da6e22a930ec38daab057c7"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_CREATED_AS_DRAFT', 'TRIP_PASSENGER_JOINED', 'TRIP_PASSENGERS_ADDED', 'TRIP_CONFIRMED', 'TRIP_CONFIRMED_FOR_APPROVAL', 'TRIP_UPDATED', 'TRIP_COMPLETED', 'TRIP_COMPLETED_FOR_REQUESTER', 'TRIP_COMPLETED_FOR_DRIVER', 'TRIP_COMPLETED_FOR_SUPERVISOR', 'TRIP_APPROVED', 'TRIP_APPROVED_BY_APPROVER', 'TRIP_APPROVED_FOR_DRIVER', 'TRIP_APPROVED_FOR_SECURITY', 'TRIP_REJECTED', 'TRIP_REJECTED_BY_APPROVER', 'TRIP_CANCELLED', 'TRIP_CANCELLED_REQUESTER', 'TRIP_CANCELLED_SUPERVISOR', 'TRIP_STARTED', 'TRIP_STARTED_FOR_PASSENGER', 'TRIP_STARTED_FOR_SUPERVISOR', 'TRIP_FINISHED', 'TRIP_FINISHED_FOR_REQUESTER', 'TRIP_FINISHED_FOR_SUPERVISOR', 'TRIP_FINISHED_FOR_SECURITY', 'TRIP_READING_START', 'TRIP_READING_START_FOR_DRIVER', 'TRIP_READING_START_FOR_PASSENGER', 'TRIP_READING_END', 'TRIP_APPROVAL_NEEDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'VEHICLE_ASSIGNED', 'VEHICLE_UNASSIGNED', 'VEHICLE_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."trip_status_enum_old" AS ENUM('draft', 'pending', 'approved', 'read', 'finished', 'rejected', 'ongoing', 'completed', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" TYPE "public"."trip_status_enum_old" USING "status"::"text"::"public"."trip_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."trip_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."trip_status_enum_old" RENAME TO "trip_status_enum"`);
        await queryRunner.query(`DROP TABLE "exceed_approval"`);
        await queryRunner.query(`DROP TYPE "public"."exceed_approval_status_enum"`);
    }

}
