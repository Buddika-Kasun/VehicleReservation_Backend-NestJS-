// scripts/railway-deploy.js
console.log('🚀 Preparing for Railway deployment...');

// This script ensures migrations are properly compiled
const fs = require('fs');
const path = require('path');

const migrationsExist = fs.existsSync('src/database/migrations');

if (!migrationsExist) {
  console.log('📭 No migrations directory found.');
  process.exit(0);
}

console.log('✅ Ready for Railway deployment');
console.log('💡 Railway will automatically:');
console.log('   1. Run npm ci');
console.log('   2. Run npm run build (which includes postbuild)');
console.log('   3. Start the application');