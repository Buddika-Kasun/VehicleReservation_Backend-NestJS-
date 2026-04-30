import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAccessLog1777537651632 implements MigrationInterface {
    name = 'AddUserAccessLog1777537651632'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_activity_logs" ("id" SERIAL NOT NULL, "deviceName" character varying(255), "platform" character varying(50) NOT NULL, "appVersion" character varying(50) NOT NULL, "isLogin" boolean NOT NULL DEFAULT false, "lastAccess" TIMESTAMP, "lastLogin" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_8cba6ba151a9dda40181f99386a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`DROP TABLE "user_activity_logs"`);
    }

}
