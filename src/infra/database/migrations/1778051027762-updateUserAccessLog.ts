import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserAccessLog1778051027762 implements MigrationInterface {
    name = 'UpdateUserAccessLog1778051027762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "UQ_348e9272a0e84920c9d3d52ffd8" UNIQUE ("userId")`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" DROP CONSTRAINT "UQ_348e9272a0e84920c9d3d52ffd8"`);
        await queryRunner.query(`ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_348e9272a0e84920c9d3d52ffd8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
