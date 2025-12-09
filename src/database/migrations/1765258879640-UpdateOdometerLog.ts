import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateOdometerLog1765258879640 implements MigrationInterface {
    name = 'UpdateOdometerLog1765258879640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_ba5a370fa26f8eaf5015c228b79"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP COLUMN "recordedById"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD "startRecordedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD "endRecordedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD "startRecordedById" integer`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD "endRecordedById" integer`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_7e4b3c2e28a19258708994eeb1a" FOREIGN KEY ("startRecordedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_af74db281b76fc0ba7f146df9a2" FOREIGN KEY ("endRecordedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_af74db281b76fc0ba7f146df9a2"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_7e4b3c2e28a19258708994eeb1a"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP COLUMN "endRecordedById"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP COLUMN "startRecordedById"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP COLUMN "endRecordedAt"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP COLUMN "startRecordedAt"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD "recordedById" integer`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_ba5a370fa26f8eaf5015c228b79" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
