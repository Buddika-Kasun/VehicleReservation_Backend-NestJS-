import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1777453971181 implements MigrationInterface {
    name = 'UpdateTrip1777453971181'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."trip_triptype_enum" RENAME TO "trip_triptype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."trip_triptype_enum" AS ENUM('normal', 'emergency', 'fixed_rate', 'safety_approval')`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" TYPE "public"."trip_triptype_enum" USING "tripType"::"text"::"public"."trip_triptype_enum"`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" SET DEFAULT 'normal'`);
        await queryRunner.query(`DROP TYPE "public"."trip_triptype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."trip_triptype_enum_old" AS ENUM('fixed_rate', 'normal', 'safety_approval')`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" TYPE "public"."trip_triptype_enum_old" USING "tripType"::"text"::"public"."trip_triptype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "tripType" SET DEFAULT 'normal'`);
        await queryRunner.query(`DROP TYPE "public"."trip_triptype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."trip_triptype_enum_old" RENAME TO "trip_triptype_enum"`);
    }

}
