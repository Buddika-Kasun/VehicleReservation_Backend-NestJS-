import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNotification1770801579501 implements MigrationInterface {
    name = 'UpdateNotification1770801579501'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_CREATED_AS_DRAFT', 'TRIP_CONFIRMED', 'TRIP_CONFIRMED_FOR_APPROVAL', 'TRIP_UPDATED', 'TRIP_COMPLETED', 'TRIP_COMPLETED_FOR_REQUESTER', 'TRIP_COMPLETED_FOR_DRIVER', 'TRIP_COMPLETED_FOR_SUPERVISOR', 'TRIP_APPROVED', 'TRIP_APPROVED_BY_APPROVER', 'TRIP_APPROVED_FOR_DRIVER', 'TRIP_APPROVED_FOR_SECURITY', 'TRIP_REJECTED', 'TRIP_REJECTED_BY_APPROVER', 'TRIP_CANCELLED', 'TRIP_CANCELLED_REQUESTER', 'TRIP_CANCELLED_SUPERVISOR', 'TRIP_STARTED', 'TRIP_STARTED_FOR_PASSENGER', 'TRIP_STARTED_FOR_SUPERVISOR', 'TRIP_FINISHED', 'TRIP_FINISHED_FOR_REQUESTER', 'TRIP_FINISHED_FOR_SUPERVISOR', 'TRIP_FINISHED_FOR_SECURITY', 'TRIP_READING_START', 'TRIP_READING_START_FOR_DRIVER', 'TRIP_READING_START_FOR_PASSENGER', 'TRIP_READING_END', 'TRIP_APPROVAL_NEEDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'VEHICLE_ASSIGNED', 'VEHICLE_UNASSIGNED', 'VEHICLE_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_CONFIRMED', 'TRIP_UPDATED', 'TRIP_COMPLETED', 'TRIP_APPROVED', 'TRIP_REJECTED', 'TRIP_CANCELLED', 'TRIP_STARTED', 'TRIP_FINISHED', 'TRIP_READING_START', 'TRIP_READING_END', 'TRIP_APPROVAL_NEEDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'VEHICLE_ASSIGNED', 'VEHICLE_UNASSIGNED', 'VEHICLE_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
    }

}
