import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1767604088803 implements MigrationInterface {
    name = 'UpdateTrip1767604088803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" ADD "primaryDriverId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD "secondaryDriverId" integer`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_393f16b25f150c72281fb095732" FOREIGN KEY ("primaryDriverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_8ae56e9dd792dc0e9ef716fbd78" FOREIGN KEY ("secondaryDriverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_8ae56e9dd792dc0e9ef716fbd78"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_393f16b25f150c72281fb095732"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "secondaryDriverId"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP COLUMN "primaryDriverId"`);
    }

}
