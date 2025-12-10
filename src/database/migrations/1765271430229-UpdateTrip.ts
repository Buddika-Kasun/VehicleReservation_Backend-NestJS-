import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1765271430229 implements MigrationInterface {
    name = 'UpdateTrip1765271430229'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "startOdometer"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "endOdometer"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "endOdometer" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "startOdometer" numeric(12,2)`);
    }

}
