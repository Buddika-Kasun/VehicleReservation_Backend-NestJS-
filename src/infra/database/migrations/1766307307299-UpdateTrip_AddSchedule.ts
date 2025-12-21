import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTripAddSchedule1766307307299 implements MigrationInterface {
    name = 'UpdateTripAddSchedule1766307307299'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."schedules_repetition_enum" AS ENUM('once', 'daily', 'weekly', 'monthly', 'custom')`);
        await queryRunner.query(`CREATE TABLE "schedules" ("id" SERIAL NOT NULL, "startDate" date NOT NULL, "validTillDate" date, "startTime" TIME NOT NULL, "repetition" "public"."schedules_repetition_enum" NOT NULL DEFAULT 'once', "includeWeekends" boolean NOT NULL DEFAULT false, "repeatAfterDays" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "trip_id" integer, CONSTRAINT "REL_62051c561b5595c910c22e2901" UNIQUE ("trip_id"), CONSTRAINT "PK_7e33fc2ea755a5765e3564e66dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "scheduleId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "UQ_46c01e9f3d04e34f7dc8504b4d7" UNIQUE ("scheduleId")`);
        await queryRunner.query(`ALTER TABLE "schedules" ADD CONSTRAINT "FK_62051c561b5595c910c22e2901e" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_46c01e9f3d04e34f7dc8504b4d7" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_46c01e9f3d04e34f7dc8504b4d7"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_62051c561b5595c910c22e2901e"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "UQ_46c01e9f3d04e34f7dc8504b4d7"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "scheduleId"`);
        await queryRunner.query(`DROP TABLE "schedules"`);
        await queryRunner.query(`DROP TYPE "public"."schedules_repetition_enum"`);
    }

}
