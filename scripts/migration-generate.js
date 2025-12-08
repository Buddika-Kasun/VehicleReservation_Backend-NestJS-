// scripts/migration-generate.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  // Generate the migration
  const command = `npx typeorm-ts-node-commonjs -d src/config/typeorm.config.ts migration:generate ./src/database/migrations/${migrationName}`;
  execSync(command, { stdio: 'inherit' });
  
  // Immediately compile it for production
  console.log('\n🔨 Compiling migration for production...');
  const srcFile = `src/database/migrations/*${migrationName}.ts`;
  const compileCommand = `npx tsc ${srcFile} --outDir dist/database/migrations --module commonjs --target es2017 --esModuleInterop`;
  execSync(compileCommand, { stdio: 'pipe' });
  
  // Fix the compiled file
  const distDir = 'dist/database/migrations';
  const compiledFiles = fs.readdirSync(distDir).filter(f => f.includes(migrationName) && f.endsWith('.js'));
  
  compiledFiles.forEach(file => {
    const filePath = path.join(distDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix for CommonJS
    content = content
      .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);/g, '')
      .replace(/exports\.default = (\w+);/g, 'module.exports = $1;');
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed CommonJS exports in ${file}`);
  });
  
  console.log(`✅ Migration "${migrationName}" generated and compiled successfully!`);
  
} catch (error) {
  console.error('❌ Migration generation failed:', error.message);
  process.exit(1);
}