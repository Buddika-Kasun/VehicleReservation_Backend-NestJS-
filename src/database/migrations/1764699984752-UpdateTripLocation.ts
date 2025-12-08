import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTripLocation1764699984752 implements MigrationInterface {
    name = 'UpdateTripLocation1764699984752'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_location" ADD "locationData" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_location" DROP COLUMN "locationData"`);
    }

}
