import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFCMToken1771841214528 implements MigrationInterface {
    name = 'AddFCMToken1771841214528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_fcm_tokens" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "deviceId" character varying NOT NULL, "fcmToken" character varying NOT NULL, "deviceName" character varying, "deviceType" character varying, "isActive" boolean NOT NULL DEFAULT true, "lastUsedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ece151655885b737da4ac06ca61" UNIQUE ("deviceId"), CONSTRAINT "PK_f8088ed7e1116e01a4033b6ca76" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "user_fcm_tokens"`);
    }

}
