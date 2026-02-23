import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateFCMToken1771856018368 implements MigrationInterface {
    name = 'UpdateFCMToken1771856018368'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_fcm_tokens" ALTER COLUMN "fcmToken" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_fcm_tokens" ALTER COLUMN "fcmToken" SET NOT NULL`);
    }

}
