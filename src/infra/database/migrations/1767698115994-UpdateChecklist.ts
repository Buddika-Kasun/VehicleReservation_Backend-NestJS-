import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChecklist1767698115994 implements MigrationInterface {
    name = 'UpdateChecklist1767698115994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4c5649312ab9ce64ad7935e6c"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP CONSTRAINT "PK_bae00945a1d4789bd648e583e29"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD CONSTRAINT "PK_bae00945a1d4789bd648e583e29" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP COLUMN "checklist_id"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD "checklist_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6" PRIMARY KEY ("id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f4c5649312ab9ce64ad7935e6c" ON "checklist_items" ("checklist_id", "item_name") `);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4c5649312ab9ce64ad7935e6c"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6"`);
        await queryRunner.query(`ALTER TABLE "checklists" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "checklists" ADD CONSTRAINT "PK_336ade2047f3d713e1afa20d2c6" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP COLUMN "checklist_id"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD "checklist_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP CONSTRAINT "PK_bae00945a1d4789bd648e583e29"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD CONSTRAINT "PK_bae00945a1d4789bd648e583e29" PRIMARY KEY ("id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f4c5649312ab9ce64ad7935e6c" ON "checklist_items" ("checklist_id", "item_name") `);
        await queryRunner.query(`ALTER TABLE "checklist_items" ADD CONSTRAINT "FK_d98db409c26c6ed1a6d20c1bb0c" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
