import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1771431833044 implements MigrationInterface {
    name = 'UpdateTrip1771431833044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "returnDateTime" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "returnDateTime"`);
    }

}
