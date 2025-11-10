import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCostCenterVehicle1762244205248 implements MigrationInterface {
    name = 'UpdateCostCenterVehicle1762244205248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_1b89ba6f547d25046dff8d693c8"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "assignedDriverId"`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "assignedDriverPrimaryId" integer`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "assignedDriverSecondaryId" integer`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "vehicleTypeId" integer`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_3f65250fdecb26e4549040f0363" FOREIGN KEY ("assignedDriverPrimaryId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_bd9d4e3f6493694952178032826" FOREIGN KEY ("assignedDriverSecondaryId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_f2787f31f717e0a77fdb16e5ea0" FOREIGN KEY ("vehicleTypeId") REFERENCES "cost_configuration"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_f2787f31f717e0a77fdb16e5ea0"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_bd9d4e3f6493694952178032826"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_3f65250fdecb26e4549040f0363"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "vehicleTypeId"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "assignedDriverSecondaryId"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP COLUMN "assignedDriverPrimaryId"`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD "assignedDriverId" integer`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_1b89ba6f547d25046dff8d693c8" FOREIGN KEY ("assignedDriverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
