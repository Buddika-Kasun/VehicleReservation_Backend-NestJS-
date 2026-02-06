import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppUpdate1770310442169 implements MigrationInterface {
    name = 'AddAppUpdate1770310442169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_updates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "version" character varying NOT NULL, "buildNumber" character varying NOT NULL, "platform" character varying NOT NULL, "updateTitle" text NOT NULL, "updateDescription" text NOT NULL, "downloadUrl" character varying, "fileName" character varying, "filePath" character varying, "originalFileName" character varying, "fileSize" double precision NOT NULL DEFAULT '0', "isMandatory" boolean NOT NULL DEFAULT false, "isSilent" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "redirectToStore" boolean NOT NULL DEFAULT false, "minSupportedVersion" character varying, "releaseNotes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9a1a7ece49a23415b325158134" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "app_updates"`);
    }

}
