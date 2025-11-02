import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDepartment1762059896629 implements MigrationInterface {
    name = 'UpdateDepartment1762059896629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "department" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "department" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "department" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "department" ADD CONSTRAINT "FK_82a9054b496d07494b9a0941978" FOREIGN KEY ("costCenterId") REFERENCES "cost_center"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "department" DROP CONSTRAINT "FK_82a9054b496d07494b9a0941978"`);
        await queryRunner.query(`ALTER TABLE "department" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "department" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "department" DROP COLUMN "isActive"`);
    }

}
