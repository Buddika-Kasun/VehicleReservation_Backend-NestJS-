import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserAccessLog1777539057991 implements MigrationInterface {
    name = 'UpdateUserAccessLog1777539057991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
