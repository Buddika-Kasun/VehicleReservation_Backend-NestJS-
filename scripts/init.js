// scripts/init.js
const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing application for Railway...');

// Create necessary directories
const directories = [
  './uploads',
  './uploads/apps',
  './tmp/uploads',
  './logs'
];

directories.forEach(dir => {
  const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  
  if (!fs.existsSync(fullPath)) {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      // Try to set permissions (might fail on Railway, that's OK)
      try {
        fs.chmodSync(fullPath, 0o777);
      } catch (e) {
        // Ignore permission errors in Railway
      }
      console.log(`✅ Created directory: ${fullPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not create ${fullPath}: ${error.message}`);
    }
  }
});

console.log('✅ Initialization complete!');