import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class CreateSysadminUser1712345678901 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if sysadmin already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM "user" WHERE username = 'sysadmin'`
    );

    if (existingUser && existingUser.length === 0) {
      // Hash the password (use bcrypt)
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash('12345678', saltRounds);
      
      // Insert sysadmin user
      await queryRunner.query(`
        INSERT INTO "user" (
          username, displayname, email, phone, role, 
          "passwordHash", "authenticationLevel", "isActive", "isApproved",
          "createdAt", "updatedAt"
        ) VALUES (
          'sysadmin', 'Sysadmin', 'sysadmin@demo.com', '1234567890', 'sysadmin',
          $1, 10, true, 'approved',
          NOW(), NOW()
        )
      `, [passwordHash]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user" WHERE username = 'sysadmin'`);
  }
}