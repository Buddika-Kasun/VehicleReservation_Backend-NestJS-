// src/common/utils/graceful-shutdown.ts
import { INestApplication, Logger } from '@nestjs/common';

export function setupGracefulShutdown(app: INestApplication, logger: Logger): void {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`, 'GracefulShutdown');
      
      try {
        // Close HTTP server first
        await app.close();
        
        // Additional cleanup
        await cleanupResources();
        
        logger.log('Graceful shutdown completed', 'GracefulShutdown');
        process.exit(0);
      } catch (error) {
        logger.error(`Graceful shutdown failed: ${error.message}`, 'GracefulShutdown');
        process.exit(1);
      }
    });
  });
}

async function cleanupResources(): Promise<void> {
  // Close database connections, Redis connections, etc.
  // This function can be extended based on your resources
  
  // Wait a bit for pending requests
  await new Promise(resolve => setTimeout(resolve, 1000));
}