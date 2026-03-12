import { MigrationInterface, QueryRunner } from "typeorm";

export class Updatetrip1773305564074 implements MigrationInterface {
    name = 'Updatetrip1773305564074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "createdAt" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "updatedAt" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "trip" ALTER COLUMN "createdAt" SET DEFAULT now()`);
    }

}
