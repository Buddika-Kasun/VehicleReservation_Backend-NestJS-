import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChecklist1767697112593 implements MigrationInterface {
    name = 'AddChecklist1767697112593'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "checklist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "item_name" character varying(200) NOT NULL, "status" character varying(10), "remarks" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "checklist_id" uuid NOT NULL, CONSTRAINT "PK_bae00945a1d4789bd648e583e29" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f4c5649312ab9ce64ad7935e6c" ON "checklist_items" ("checklist_id", "item_name") `);
        await queryRunner.query(`CREATE TABLE "checklists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vehicle_reg_no" character varying(50) NOT NULL, "checklistDate" date NOT NULL, "isSubmitted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "vehicle_id" integer NOT NULL, "checked_by_id" integer NOT NULL, CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e73614f6815ee7e47f70f1bfe" ON "checklists" ("vehicle_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5cf465a69f1d9c932656dc31ba" ON "checklists" ("checklistDate") `);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD CONSTRAINT "FK_1e73614f6815ee7e47f70f1bfe8" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD CONSTRAINT "FK_26f30576366ec452eba57033ffd" FOREIGN KEY ("checked_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklists" DROP CONSTRAINT "FK_26f30576366ec452eba57033ffd"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP CONSTRAINT "FK_1e73614f6815ee7e47f70f1bfe8"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5cf465a69f1d9c932656dc31ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e73614f6815ee7e47f70f1bfe"`);
        await queryRunner.query(`DROP TABLE "checklists"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4c5649312ab9ce64ad7935e6c"`);
        await queryRunner.query(`DROP TABLE "checklist_items"`);
    }

}
