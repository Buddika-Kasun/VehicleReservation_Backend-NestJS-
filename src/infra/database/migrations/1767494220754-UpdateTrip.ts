import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1767494220754 implements MigrationInterface {
    name = 'UpdateTrip1767494220754'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."trip_triptype_enum" AS ENUM('normal', 'fixed_rate', 'safety_approval')`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "tripType" "public"."trip_triptype_enum" NOT NULL DEFAULT 'normal'`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "fixedRate" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "reason"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "fixedRate"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "tripType"`);
        await queryRunner.query(`DROP TYPE "public"."trip_triptype_enum"`);
    }

}
