import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1766075404056 implements MigrationInterface {
    name = 'UpdateUser1766075404056'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_21d4a889ec9e64e43ff9fd6fa1"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "fcmToken" character varying`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "title" character varying`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "message" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_UPDATED', 'TRIP_COMPLETED', 'TRIP_APPROVED', 'TRIP_REJECTED', 'TRIP_CANCELLED', 'TRIP_STARTED', 'TRIP_FINISHED', 'TRIP_READING_START', 'TRIP_READING_END', 'TRIP_APPROVAL_NEEDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'VEHICLE_ASSIGNED', 'VEHICLE_UNASSIGNED', 'VEHICLE_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_isActive" ON "notifications" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_isActive"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_createdAt"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('USER_REGISTERED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'USER_DELETED', 'USER_AUTH_LEVEL_CHANGED', 'USER_ROLE_CHANGED', 'TRIP_CREATED', 'TRIP_UPDATED', 'TRIP_COMPLETED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'MESSAGE_RECEIVED', 'SYSTEM_ALERT')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "message"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "fcmToken"`);
        await queryRunner.query(`CREATE INDEX "IDX_21d4a889ec9e64e43ff9fd6fa1" ON "notifications" ("isActive") `);
    }

}
