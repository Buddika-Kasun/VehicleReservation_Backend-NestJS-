export default () => ({
  notifications: {
    websocket: {
      port: parseInt(process.env.WS_PORT || '8080', 10),
      path: process.env.WS_PATH || '/socket.io',
      corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000',
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),
      pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    },
    retention: {
      days: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '30', 10),
      cleanupInterval: process.env.NOTIFICATION_CLEANUP_INTERVAL || '0 0 * * *', // Daily at midnight
    },
    batch: {
      size: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '100', 10),
      delay: parseInt(process.env.NOTIFICATION_BATCH_DELAY || '1000', 10),
    },
    fcm: {
      enabled: process.env.FCM_ENABLED === 'true',
      credentialsPath: process.env.FCM_CREDENTIALS_PATH,
    },
  },
});