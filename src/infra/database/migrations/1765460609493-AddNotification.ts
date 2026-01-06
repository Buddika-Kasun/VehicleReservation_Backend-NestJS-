import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotification1765460609493 implements MigrationInterface {
    name = 'AddNotification1765460609493'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum types
        await queryRunner.query(`
            CREATE TYPE "public"."notifications_type_enum" AS ENUM(
                'USER_REGISTERED', 
                'USER_APPROVED', 
                'USER_REJECTED', 
                'USER_UPDATED', 
                'USER_DELETED', 
                'ASSIGNMENT_CREATED', 
                'ASSIGNMENT_UPDATED', 
                'TASK_CREATED', 
                'TASK_COMPLETED', 
                'MESSAGE_RECEIVED', 
                'SYSTEM_ALERT'
            )
        `);
        
        await queryRunner.query(`
            CREATE TYPE "public"."notifications_priority_enum" AS ENUM(
                'LOW', 
                'MEDIUM', 
                'HIGH', 
                'URGENT'
            )
        `);
        
        // Create table with SERIAL id (matching @PrimaryGeneratedColumn())
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" SERIAL NOT NULL,
                "type" "public"."notifications_type_enum" NOT NULL,
                "priority" "public"."notifications_priority_enum" NOT NULL DEFAULT 'MEDIUM',
                "data" jsonb NOT NULL,
                "metadata" jsonb,
                "userId" varchar,
                "createdById" varchar,
                "organizationId" varchar,
                "read" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "expiresAt" TIMESTAMP,
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
            )
        `);
        
        // Create index
        await queryRunner.query(`
            CREATE INDEX "IDX_21d4a889ec9e64e43ff9fd6fa1" 
            ON "notifications" ("isActive")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_21d4a889ec9e64e43ff9fd6fa1"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    }
}