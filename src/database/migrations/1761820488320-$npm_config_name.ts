import { MigrationInterface, QueryRunner } from "typeorm";

export class  $npmConfigName1761820488320 implements MigrationInterface {
    name = ' $npmConfigName1761820488320'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "department" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "costCenterId" integer, "companyId" integer, "headId" integer, CONSTRAINT "PK_9a2213262c1593bffb581e382f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cost_configuration" ("id" SERIAL NOT NULL, "vehicleType" character varying(50) NOT NULL, "costPerKm" numeric(10,2) NOT NULL, "validFrom" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "companyId" integer, CONSTRAINT "PK_fd978ecf952d4bb1bb67b2a83b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "odometer_log" ("id" SERIAL NOT NULL, "startReading" numeric(12,2), "endReading" numeric(12,2), "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "vehicleId" integer, "tripId" integer, "recordedById" integer, CONSTRAINT "PK_abb7dbdc93bc4a5d5044796ac37" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vehicle" ("id" SERIAL NOT NULL, "regNo" character varying(50) NOT NULL, "model" character varying(100), "fuelType" character varying(50), "seatingCapacity" integer NOT NULL DEFAULT '4', "odometerLastReading" numeric(12,2) NOT NULL DEFAULT '0', "vehicleType" character varying(50), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "companyId" integer, "assignedDriverId" integer, CONSTRAINT "UQ_73dfff9935dac1a7fcbd75b5cfb" UNIQUE ("regNo"), CONSTRAINT "PK_187fa17ba39d367e5604b3d1ec9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_73dfff9935dac1a7fcbd75b5cf" ON "vehicle" ("regNo") `);
        await queryRunner.query(`CREATE TABLE "cost_center" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "companyId" integer, CONSTRAINT "PK_814d737123e3a42d0a37e97b393" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "company" ("id" SERIAL NOT NULL, "name" character varying(200) NOT NULL, "address" character varying(300), "emailDomain" character varying(100), "contactNumber" character varying(20), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "feedback" ("id" SERIAL NOT NULL, "rating" integer NOT NULL, "comments" character varying(255), "submittedAt" TIMESTAMP NOT NULL DEFAULT now(), "tripId" integer, "submittedById" integer, CONSTRAINT "PK_8389f9e087a57689cd5be8b2b13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('employee', 'driver', 'admin', 'hr', 'security')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "username" character varying(100) NOT NULL, "displayname" character varying(100) NOT NULL, "email" character varying(100) NOT NULL, "phone" character varying(20), "role" "public"."user_role_enum" NOT NULL DEFAULT 'employee', "passwordHash" character varying, "authenticationLevel" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT false, "isApproved" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "companyId" integer, "departmentId" integer, CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_8e1f623798118e629b46a9e6299" UNIQUE ("phone"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE TABLE "approval" ("id" SERIAL NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "comments" character varying(255), "decidedAt" TIMESTAMP NOT NULL DEFAULT now(), "approver1Id" integer, "approver2Id" integer, "safetyApproverId" integer, CONSTRAINT "PK_97bfd1cd9dff3c1302229da6b5c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trip_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected', 'ongoing', 'completed', 'canceled')`);
        await queryRunner.query(`CREATE TABLE "trip" ("id" SERIAL NOT NULL, "origin" character varying(150) NOT NULL, "destination" character varying(150) NOT NULL, "startDate" date NOT NULL, "endDate" date, "startTime" TIME NOT NULL, "endTime" TIME, "purpose" character varying(255), "passengers" integer NOT NULL DEFAULT '1', "specialRemarks" character varying(255), "status" "public"."trip_status_enum" NOT NULL DEFAULT 'draft', "cost" numeric(12,2), "mileage" numeric(12,2), "startOdometer" numeric(12,2), "endOdometer" numeric(12,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "requesterId" integer, "vehicleId" integer, "approvalId" integer, "odometerLogId" integer, "feedbackId" integer, CONSTRAINT "REL_fd1551f3034710e86a0b9895bd" UNIQUE ("approvalId"), CONSTRAINT "REL_319da66ce38c4eff96236977f9" UNIQUE ("odometerLogId"), CONSTRAINT "REL_9c1d4f35c0cc54ed406bf2375b" UNIQUE ("feedbackId"), CONSTRAINT "PK_714c23d558208081dbccb9d9268" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "action" character varying(100) NOT NULL, "payload" json, "actorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "department" ADD CONSTRAINT "FK_1c9f0159b4ae69008bd356bb1ce" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department" ADD CONSTRAINT "FK_704562fff92144d2bc2ade1016a" FOREIGN KEY ("headId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cost_configuration" ADD CONSTRAINT "FK_8ce816ef9e17f3f51b60d216281" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_e96f1dd42b134a05b2efddb2fab" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_4a027030ff55834a7c0c03a7310" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "odometer_log" ADD CONSTRAINT "FK_ba5a370fa26f8eaf5015c228b79" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_59aa1b1cf3e6d083ee48165883a" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle" ADD CONSTRAINT "FK_1b89ba6f547d25046dff8d693c8" FOREIGN KEY ("assignedDriverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cost_center" ADD CONSTRAINT "FK_873f5f14b6ebaf263a308fadc6b" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feedback" ADD CONSTRAINT "FK_aff29cc88eaa2c683f1de082e0e" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feedback" ADD CONSTRAINT "FK_90b3ff2f58b5d9894df65dd8d63" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_86586021a26d1180b0968f98502" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_3d6915a33798152a079997cad28" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_1c3e530225e540898d410b9f76b" FOREIGN KEY ("approver1Id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_ebac44d329d175e5ebfab8a65e3" FOREIGN KEY ("approver2Id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval" ADD CONSTRAINT "FK_4a69e1d8575d06799ec920f8f66" FOREIGN KEY ("safetyApproverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_923a59c7a303da163370c3b70df" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_b0febc31445a349db8313fca453" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6" FOREIGN KEY ("approvalId") REFERENCES "approval"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_319da66ce38c4eff96236977f91" FOREIGN KEY ("odometerLogId") REFERENCES "odometer_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip" ADD CONSTRAINT "FK_9c1d4f35c0cc54ed406bf2375be" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_9c1d4f35c0cc54ed406bf2375be"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_319da66ce38c4eff96236977f91"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_fd1551f3034710e86a0b9895bd6"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_b0febc31445a349db8313fca453"`);
        await queryRunner.query(`ALTER TABLE "trip" DROP CONSTRAINT "FK_923a59c7a303da163370c3b70df"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_4a69e1d8575d06799ec920f8f66"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_ebac44d329d175e5ebfab8a65e3"`);
        await queryRunner.query(`ALTER TABLE "approval" DROP CONSTRAINT "FK_1c3e530225e540898d410b9f76b"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_3d6915a33798152a079997cad28"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_86586021a26d1180b0968f98502"`);
        await queryRunner.query(`ALTER TABLE "feedback" DROP CONSTRAINT "FK_90b3ff2f58b5d9894df65dd8d63"`);
        await queryRunner.query(`ALTER TABLE "feedback" DROP CONSTRAINT "FK_aff29cc88eaa2c683f1de082e0e"`);
        await queryRunner.query(`ALTER TABLE "cost_center" DROP CONSTRAINT "FK_873f5f14b6ebaf263a308fadc6b"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_1b89ba6f547d25046dff8d693c8"`);
        await queryRunner.query(`ALTER TABLE "vehicle" DROP CONSTRAINT "FK_59aa1b1cf3e6d083ee48165883a"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_ba5a370fa26f8eaf5015c228b79"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_4a027030ff55834a7c0c03a7310"`);
        await queryRunner.query(`ALTER TABLE "odometer_log" DROP CONSTRAINT "FK_e96f1dd42b134a05b2efddb2fab"`);
        await queryRunner.query(`ALTER TABLE "cost_configuration" DROP CONSTRAINT "FK_8ce816ef9e17f3f51b60d216281"`);
        await queryRunner.query(`ALTER TABLE "department" DROP CONSTRAINT "FK_704562fff92144d2bc2ade1016a"`);
        await queryRunner.query(`ALTER TABLE "department" DROP CONSTRAINT "FK_1c9f0159b4ae69008bd356bb1ce"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP TABLE "trip"`);
        await queryRunner.query(`DROP TYPE "public"."trip_status_enum"`);
        await queryRunner.query(`DROP TABLE "approval"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`DROP TABLE "feedback"`);
        await queryRunner.query(`DROP TABLE "company"`);
        await queryRunner.query(`DROP TABLE "cost_center"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73dfff9935dac1a7fcbd75b5cf"`);
        await queryRunner.query(`DROP TABLE "vehicle"`);
        await queryRunner.query(`DROP TABLE "odometer_log"`);
        await queryRunner.query(`DROP TABLE "cost_configuration"`);
        await queryRunner.query(`DROP TABLE "department"`);
    }

}
