// scripts/compile-migrations.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Compiling migrations for production...');

const srcMigrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
const distMigrationsDir = path.join(__dirname, '..', 'dist', 'database', 'migrations');

// Ensure dist directory exists
if (!fs.existsSync(distMigrationsDir)) {
  fs.mkdirSync(distMigrationsDir, { recursive: true });
}

// Get all TypeScript migration files
const migrationFiles = fs.readdirSync(srcMigrationsDir).filter(file => file.endsWith('.ts'));

if (migrationFiles.length === 0) {
  console.log('📭 No migration files found.');
  process.exit(0);
}

console.log(`📋 Found ${migrationFiles.length} migration(s):`);
migrationFiles.forEach(file => console.log(`  - ${file}`));

// Compile each migration
migrationFiles.forEach(file => {
  const srcFile = path.join(srcMigrationsDir, file);
  const jsFile = file.replace('.ts', '.js');
  const distFile = path.join(distMigrationsDir, jsFile);
  
  try {
    console.log(`⚙️  Compiling ${file}...`);
    
    // Compile the TypeScript file
    execSync(`npx tsc ${srcFile} --outDir ${distMigrationsDir} --module commonjs --target es2017 --esModuleInterop`, {
      stdio: 'pipe'
    });
    
    // Read the compiled JS file
    let jsContent = fs.readFileSync(distFile, 'utf8');
    
    // Fix import statements for CommonJS
    jsContent = jsContent.replace(
      /Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);/g,
      ''
    );
    
    // Fix export to use module.exports
    if (jsContent.includes('exports.default =')) {
      const className = jsContent.match(/class (\w+)/)?.[1];
      if (className) {
        jsContent = jsContent.replace(
          /exports\.default = \w+;/,
          `module.exports = ${className};`
        );
      }
    }
    
    // Write the fixed content back
    fs.writeFileSync(distFile, jsContent);
    console.log(`✅ Compiled: ${file} → ${jsFile}`);
    
  } catch (error) {
    console.error(`❌ Failed to compile ${file}:`, error.message);
  }
});

console.log('🎉 All migrations compiled successfully!');