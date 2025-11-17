import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUser1763208287787 implements MigrationInterface {
    name = 'UpdateUser1763208287787'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isApproved"`);
        await queryRunner.query(`CREATE TYPE "public"."user_isapproved_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "user" ADD "isApproved" "public"."user_isapproved_enum" NOT NULL DEFAULT 'approved'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isApproved"`);
        await queryRunner.query(`DROP TYPE "public"."user_isapproved_enum"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "isApproved" boolean NOT NULL DEFAULT false`);
    }

}
