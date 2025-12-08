import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1764681561697 implements MigrationInterface {
    name = 'UpdateTrip1764681561697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trip_conflicts" ("trip_id" integer NOT NULL, "conflict_trip_id" integer NOT NULL, CONSTRAINT "PK_0a4a8e784aeafa5a7f13a475102" PRIMARY KEY ("trip_id", "conflict_trip_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8707bcf3bcbe82e14e57487146" ON "trip_conflicts" ("trip_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cab63f5274daf4cd97875b5d66" ON "trip_conflicts" ("conflict_trip_id") `);
        await queryRunner.query(`ALTER TABLE "trip_conflicts" ADD CONSTRAINT "FK_8707bcf3bcbe82e14e57487146b" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "trip_conflicts" ADD CONSTRAINT "FK_cab63f5274daf4cd97875b5d66a" FOREIGN KEY ("conflict_trip_id") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_conflicts" DROP CONSTRAINT "FK_cab63f5274daf4cd97875b5d66a"`);
        await queryRunner.query(`ALTER TABLE "trip_conflicts" DROP CONSTRAINT "FK_8707bcf3bcbe82e14e57487146b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cab63f5274daf4cd97875b5d66"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8707bcf3bcbe82e14e57487146"`);
        await queryRunner.query(`DROP TABLE "trip_conflicts"`);
    }

}
