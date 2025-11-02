import { MigrationInterface, QueryRunner } from "typeorm";

export class UserProfilePicAdd1762028170957 implements MigrationInterface {
    name = 'UserProfilePicAdd1762028170957'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "profilePicture" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "profilePicture"`);
    }

}
