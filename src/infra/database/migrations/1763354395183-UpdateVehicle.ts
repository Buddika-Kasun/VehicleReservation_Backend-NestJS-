import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateVehicle1763354395183 implements MigrationInterface {
    name = 'UpdateVehicle1763354395183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "qrCode" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "qrCode"`);
    }

}
