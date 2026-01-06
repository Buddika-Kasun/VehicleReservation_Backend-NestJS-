const { execSync } = require('child_process');

const args = process.argv.slice(2);
let migrationName = 'NewMigration';

if (args.length > 0) {
  migrationName = args[0].replace('--name=', '');
}

if (!migrationName) {
  console.error('Please provide migration name');
  process.exit(1);
}

console.log(`Generating migration: ${migrationName}`);

try {
  const cmd = `npx typeorm-ts-node-commonjs -d src/config/typeorm.config.ts migration:generate src/infra/database/migrations/${migrationName}`;
  execSync(cmd, { stdio: 'inherit' });

  console.log(`✔ Migration ${migrationName} generated`);
} catch (error) {
  console.error('❌ Migration generation failed:', error.message);
  process.exit(1);
}
