import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1764683796027 implements MigrationInterface {
    name = 'UpdateTrip1764683796027'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trip_selected_group_users" ("trip_id" integer NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "PK_1393ea9f43d797241c6a65d31a3" PRIMARY KEY ("trip_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8c6421028a55073e4649143599" ON "trip_selected_group_users" ("trip_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c9e1dfe1c8d485b98e0c5b9ee1" ON "trip_selected_group_users" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users" ADD CONSTRAINT "FK_8c6421028a55073e4649143599a" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users" ADD CONSTRAINT "FK_c9e1dfe1c8d485b98e0c5b9ee1e" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users" DROP CONSTRAINT "FK_c9e1dfe1c8d485b98e0c5b9ee1e"`);
        await queryRunner.query(`ALTER TABLE "trip_selected_group_users" DROP CONSTRAINT "FK_8c6421028a55073e4649143599a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e1dfe1c8d485b98e0c5b9ee1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c6421028a55073e4649143599"`);
        await queryRunner.query(`DROP TABLE "trip_selected_group_users"`);
    }

}
