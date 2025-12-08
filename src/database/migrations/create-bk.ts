import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class CreateBkSysadminUser1764949868439 implements MigrationInterface {
  name = 'CreateSysadminUser1764949868439'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if sysadmin already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM "user" WHERE username = 'buddikakasun'`
    );

    if (existingUser && existingUser.length === 0) {
      // Hash the password (use bcrypt)
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash('BuDdIkAkasun123', saltRounds);
      
      // Insert sysadmin user
      await queryRunner.query(`
        INSERT INTO "user" (
          username, displayname, email, phone, role, 
          "passwordHash", "authenticationLevel", "isActive", "isApproved",
          "createdAt", "updatedAt"
        ) VALUES (
          'buddikaksun', 'Buddika Kasun', 'buddikakasun80@gmail.com', '0715315915', 'sysadmin',
          $1, 10, true, 'approved',
          NOW(), NOW()
        )
      `, [passwordHash]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user" WHERE username = 'buddikakasun'`);
  }
}