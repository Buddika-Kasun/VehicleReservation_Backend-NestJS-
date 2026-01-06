import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTripLocation1766220494659 implements MigrationInterface {
    name = 'UpdateTripLocation1766220494659'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_location" ADD "estimatedRestingHours" numeric(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_location" DROP COLUMN "estimatedRestingHours"`);
    }

}
