import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1772863701043 implements MigrationInterface {
    name = 'UpdateTrip1772863701043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
