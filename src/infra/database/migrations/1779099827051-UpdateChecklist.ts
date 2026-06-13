import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChecklist1779099827051 implements MigrationInterface {
    name = 'UpdateChecklist1779099827051'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."checklists_status_enum" AS ENUM('submitted', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD "status" "public"."checklists_status_enum" NOT NULL DEFAULT 'submitted'`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD "approved_by_id" integer`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD CONSTRAINT "FK_025108c552d45e049cdcd228786" FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" DROP CONSTRAINT "FK_025108c552d45e049cdcd228786"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "approved_by_id"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."checklists_status_enum"`);
    }

}
