import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApprovalConfiguration1763399374835 implements MigrationInterface {
    name = 'AddApprovalConfiguration1763399374835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "approval_config" ("id" SERIAL NOT NULL, "distanceLimit" integer, "restrictedFrom" TIME, "restrictedTo" TIME, "isActive" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "secondaryUserId" integer, "safetyUserId" integer, CONSTRAINT "REL_0c584c0441cfda87650791e048" UNIQUE ("secondaryUserId"), CONSTRAINT "REL_2aaf2d7a213d86aaf744738100" UNIQUE ("safetyUserId"), CONSTRAINT "PK_d8fe8f2a5d90734133281876be7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "approval_config" ADD CONSTRAINT "FK_0c584c0441cfda87650791e0481" FOREIGN KEY ("secondaryUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_config" ADD CONSTRAINT "FK_2aaf2d7a213d86aaf7447381000" FOREIGN KEY ("safetyUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval_config" DROP CONSTRAINT "FK_2aaf2d7a213d86aaf7447381000"`);
        await queryRunner.query(`ALTER TABLE "approval_config" DROP CONSTRAINT "FK_0c584c0441cfda87650791e0481"`);
        await queryRunner.query(`DROP TABLE "approval_config"`);
    }

}
