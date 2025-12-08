import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTrip1764774806835 implements MigrationInterface {
    name = 'UpdateTrip1764774806835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6"`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6" FOREIGN KEY ("approvalId") REFERENCES "approval"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce"`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6" FOREIGN KEY ("approvalId") REFERENCES "approval"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_757dad7d560ac39e5d6a8e670ce" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
