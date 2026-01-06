import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApproval1764949868437 implements MigrationInterface {
    name = 'UpdateApproval1764949868437'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."approval_currentstep_enum" RENAME TO "approval_currentstep_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approval_currentstep_enum" AS ENUM('hod', 'secondary', 'safety', 'completed')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" TYPE "public"."approval_currentstep_enum" USING "currentStep"::"text"::"public"."approval_currentstep_enum"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" SET DEFAULT 'hod'`);
        await queryRunner.query(`DROP TYPE "public"."approval_currentstep_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."approval_currentstep_enum_old" AS ENUM('hod', 'secondary', 'safety')`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" TYPE "public"."approval_currentstep_enum_old" USING "currentStep"::"text"::"public"."approval_currentstep_enum_old"`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN "currentStep" SET DEFAULT 'hod'`);
        await queryRunner.query(`DROP TYPE "public"."approval_currentstep_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approval_currentstep_enum_old" RENAME TO "approval_currentstep_enum"`);
    }

}
