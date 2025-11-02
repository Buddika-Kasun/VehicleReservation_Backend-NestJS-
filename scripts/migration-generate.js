
const { execSync } = require('child_process');
const path = require('path');

// Get migration name from command line arguments
const args = process.argv.slice(2);
let migrationName = 'NewMigration';

if (args.length > 0) {
  // Support --name=MigrationName or just MigrationName
  migrationName = args[0].replace('--name=', '');
}

if (!migrationName) {
  console.error('Please provide a migration name');
  console.log('Usage: npm run migration:generate -- --name=MigrationName');
  process.exit(1);
}

console.log(`Generating migration: ${migrationName}`);

try {
  const command = `npx typeorm-ts-node-commonjs -d src/config/typeorm.config.ts migration:generate ./src/database/migrations/${migrationName}`;
  execSync(command, { stdio: 'inherit' });
  console.log(`✅ Migration "${migrationName}" generated successfully!`);
} catch (error) {
  console.error('❌ Migration generation failed:', error.message);
  process.exit(1);
}