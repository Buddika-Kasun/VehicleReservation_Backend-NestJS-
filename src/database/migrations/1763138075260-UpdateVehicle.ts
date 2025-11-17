import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateVehicle1763138075260 implements MigrationInterface {
    name = 'UpdateVehicle1763138075260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "vehicleType"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "vehicleType" character varying(50)`);
    }

}
