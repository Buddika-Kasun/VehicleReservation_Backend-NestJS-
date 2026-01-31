import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1769771388281 implements MigrationInterface {
    name = 'UpdateTrip1769771388281'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "departmentId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_1b4846765ca904b0b053116aeb3" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_1b4846765ca904b0b053116aeb3"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "departmentId"`);
    }

}
