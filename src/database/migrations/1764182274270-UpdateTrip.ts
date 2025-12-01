import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1764182274270 implements MigrationInterface {
    name = 'UpdateTrip1764182274270'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trip_location" ("id" SERIAL NOT NULL, "startLatitude" numeric(10,8) NOT NULL, "startLongitude" numeric(11,8) NOT NULL, "startAddress" character varying(255) NOT NULL, "endLatitude" numeric(10,8) NOT NULL, "endLongitude" numeric(11,8) NOT NULL, "endAddress" character varying(255) NOT NULL, "intermediateStops" jsonb NOT NULL DEFAULT '[]', "totalStops" integer NOT NULL DEFAULT '0', "distance" numeric(10,2), "estimatedDuration" numeric(10,2), "tripId" integer, CONSTRAINT "REL_d291ead906c3e7e252d38b0825" UNIQUE ("tripId"), CONSTRAINT "PK_22c7f3f5ed21309301d82ea44f7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trip_selected_group_users_user" ("tripId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_fce32ad4a44283c1dfd95e2cfde" PRIMARY KEY ("tripId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_50aa28dfff418e37fc6ed35a3f" ON "trip_selected_group_users_user" ("tripId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2a5e921de912b9be3a782ccb0" ON "trip_selected_group_users_user" ("userId") `);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "destination"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "endTime"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "passengers"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "validTillDate" date`);
        await queryRunner.query(`CREATE TYPE "public"."trip_repetition_enum" AS ENUM('once', 'daily', 'weekly', 'monthly', 'custom')`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "repetition" "public"."trip_repetition_enum" NOT NULL DEFAULT 'once'`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "includeWeekends" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "repeatAfterDays" integer`);
        await queryRunner.query(`CREATE TYPE "public"."trip_passengertype_enum" AS ENUM('own', 'other_individual', 'group')`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "passengerType" "public"."trip_passengertype_enum" NOT NULL DEFAULT 'own'`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "passengerCount" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "selectedOthers" jsonb`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "includeMeInGroup" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "locationId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "UQ_5329644e9d8945a930019d6e82d" UNIQUE ("locationId")`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "selectedIndividualId" integer`);
        await queryRunner.query(`ALTER TABLE "trip_location" ADD CONSTRAINT "FK_d291ead906c3e7e252d38b0825d" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_5329644e9d8945a930019d6e82d" FOREIGN KEY ("locationId") REFERENCES "trip_location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_979aa07c62b928eefb7509aa905" FOREIGN KEY ("selectedIndividualId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users_user" ADD CONSTRAINT "FK_50aa28dfff418e37fc6ed35a3f2" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users_user" ADD CONSTRAINT "FK_e2a5e921de912b9be3a782ccb0d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users_user" DROP CONSTRAINT "FK_e2a5e921de912b9be3a782ccb0d"`);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users_user" DROP CONSTRAINT "FK_50aa28dfff418e37fc6ed35a3f2"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_979aa07c62b928eefb7509aa905"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_5329644e9d8945a930019d6e82d"`);
        await queryRunner.query(`ALTER TABLE "trip_location" DROP CONSTRAINT "FK_d291ead906c3e7e252d38b0825d"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "selectedIndividualId"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "UQ_5329644e9d8945a930019d6e82d"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "locationId"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "includeMeInGroup"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "selectedOthers"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "passengerCount"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "passengerType"`);
        await queryRunner.query(`DROP TYPE "public"."trip_passengertype_enum"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "repeatAfterDays"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "includeWeekends"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "repetition"`);
        await queryRunner.query(`DROP TYPE "public"."trip_repetition_enum"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "validTillDate"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "passengers" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "endTime" TIME`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "endDate" date`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "destination" character varying(150) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "origin" character varying(150) NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2a5e921de912b9be3a782ccb0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50aa28dfff418e37fc6ed35a3f"`);
        await queryRunner.query(`DROP TABLE "trip_selected_group_users_user"`);
        await queryRunner.query(`DROP TABLE "trip_location"`);
    }

}
