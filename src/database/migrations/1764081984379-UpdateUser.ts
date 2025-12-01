import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1764081984379 implements MigrationInterface {
    name = 'UpdateUser1764081984379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`);
    }

}
