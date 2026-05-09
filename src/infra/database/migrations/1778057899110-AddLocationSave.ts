import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocationSave1778057899110 implements MigrationInterface {
    name = 'AddLocationSave1778057899110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "saved_locations" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "name" character varying(100) NOT NULL, "address" text NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "label" character varying(50), "isFavorite" boolean NOT NULL DEFAULT false, "useCount" integer NOT NULL DEFAULT '0', "lastUsedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bc4bde22511c9a2963727c194cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_76f8811b7f18845b7e70c5f4fd" ON "saved_locations" ("userId", "isFavorite") `);
        await queryRunner.query(`ALTER TABLE "saved_locations" ADD CONSTRAINT "FK_4ceca06c8cb5a0c5ca8ba1c213e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "saved_locations" DROP CONSTRAINT "FK_4ceca06c8cb5a0c5ca8ba1c213e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76f8811b7f18845b7e70c5f4fd"`);
        await queryRunner.query(`DROP TABLE "saved_locations"`);
    }

}
