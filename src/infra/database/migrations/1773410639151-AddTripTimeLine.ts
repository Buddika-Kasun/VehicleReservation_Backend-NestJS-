import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripTimeLine1773410639151 implements MigrationInterface {
    name = 'AddTripTimeLine1773410639151'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trip_timelines" ("id" SERIAL NOT NULL, "trip_id" integer NOT NULL, "created_at" character varying(30), "created_by_id" integer, "cancelled_at" character varying(30), "cancelled_by_id" integer, "vehicle_assigned_at" character varying(30), "vehicle_assigned_by_id" integer, "vehicle_changed_at" character varying(30), "vehicle_changed_by_id" integer, "confirmed_at" character varying(30), "confirmed_by_id" integer, "approval1_at" character varying(30), "approval1_by_id" integer, "approval2_at" character varying(30), "approval2_by_id" integer, "safety_approval_at" character varying(30), "safety_approval_by_id" integer, "rejected_at" character varying(30), "rejected_by_id" integer, "start_meter_reading_at" character varying(30), "start_meter_reading_by_id" integer, "end_meter_reading_at" character varying(30), "end_meter_reading_by_id" integer, "driver_started_at" character varying(30), "driver_started_by_id" integer, "driver_ended_at" character varying(30), "driver_ended_by_id" integer, "current_status" character varying(20) NOT NULL, "trip_date_time" character varying(30) NOT NULL, "created_at_db" TIMESTAMP NOT NULL DEFAULT now(), "updated_at_db" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_6e26827f7714be30e029dcfdd6" UNIQUE ("trip_id"), CONSTRAINT "PK_537f9c955baf27f482a48594f14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_6e26827f7714be30e029dcfdd6b" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_f62eb522635c218e7f6d6fc1f26" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_d07a080572fa005ad2773bb63ca" FOREIGN KEY ("cancelled_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_d5c5c5ed386bd04d0e4b57be329" FOREIGN KEY ("vehicle_assigned_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_33cee70937fb77d45c508f981ed" FOREIGN KEY ("vehicle_changed_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_d21e969806a173e6a1121e17cff" FOREIGN KEY ("confirmed_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_3e78023382847ff36f16d2a8e68" FOREIGN KEY ("approval1_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_824bbfe41145713cbebcf0e9975" FOREIGN KEY ("approval2_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_9ab6f72c0a250157a723e16f0dd" FOREIGN KEY ("safety_approval_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_c9adcf73d0b5f09906db357ec6a" FOREIGN KEY ("rejected_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_b0b49da98c8cf8cf90d829d11c1" FOREIGN KEY ("start_meter_reading_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_06c61e61bc7041b817adb5b003f" FOREIGN KEY ("end_meter_reading_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_b93ac108188c52178c12509e48a" FOREIGN KEY ("driver_started_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" ADD CONSTRAINT "FK_5799ac24d3dc0f3d2b6861189a6" FOREIGN KEY ("driver_ended_by_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_5799ac24d3dc0f3d2b6861189a6"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_b93ac108188c52178c12509e48a"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_06c61e61bc7041b817adb5b003f"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_b0b49da98c8cf8cf90d829d11c1"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_c9adcf73d0b5f09906db357ec6a"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_9ab6f72c0a250157a723e16f0dd"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_824bbfe41145713cbebcf0e9975"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_3e78023382847ff36f16d2a8e68"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_d21e969806a173e6a1121e17cff"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_33cee70937fb77d45c508f981ed"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_d5c5c5ed386bd04d0e4b57be329"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_d07a080572fa005ad2773bb63ca"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_f62eb522635c218e7f6d6fc1f26"`);
        await queryRunner.query(`ALTER TABLE "trip_timelines" DROP CONSTRAINT "FK_6e26827f7714be30e029dcfdd6b"`);
        await queryRunner.query(`DROP TABLE "trip_timelines"`);
    }

}
