import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1765882079977 implements MigrationInterface {
    name = 'UpdateTrip1765882079977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "isScheduled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "isInstance" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "masterTripId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "instanceDate" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "instanceDate"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "masterTripId"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "isInstance"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "isScheduled"`);
    }

}
