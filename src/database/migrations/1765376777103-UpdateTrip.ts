import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1765376777103 implements MigrationInterface {
    name = 'UpdateTrip1765376777103'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "endPassengerCount" integer`);
        await queryRunner.query(`ALTER TYPE "public"."trip_status_enum" RENAME TO "trip_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."trip_status_enum" AS ENUM('draft', 'pending', 'approved', 'read', 'finished', 'rejected', 'ongoing', 'completed', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" TYPE "public"."trip_status_enum" USING "status"::"text"::"public"."trip_status_enum"`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."trip_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."trip_status_enum_old" AS ENUM('draft', 'pending', 'approved', 'read', 'started', 'finished', 'rejected', 'ongoing', 'completed', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" TYPE "public"."trip_status_enum_old" USING "status"::"text"::"public"."trip_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."trip_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."trip_status_enum_old" RENAME TO "trip_status_enum"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "endPassengerCount"`);
    }

}
