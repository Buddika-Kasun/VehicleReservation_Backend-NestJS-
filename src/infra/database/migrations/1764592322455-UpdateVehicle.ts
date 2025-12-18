import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateVehicle1764592322455 implements MigrationInterface {
    name = 'UpdateVehicle1764592322455'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "seatingAvailability" integer NOT NULL DEFAULT '4'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "seatingAvailability"`);
    }

}
