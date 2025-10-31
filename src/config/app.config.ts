/*
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecretjwtkey',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
});
*/

export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Application info
  appName: process.env.APP_NAME || 'NestJS Boilerplate',

  // Flags
  debug: process.env.DEBUG === 'true',

  // Optional: logging & MFA configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  mfa: {
    enabled: process.env.MFA_ENABLED === 'true',
    provider: process.env.MFA_PROVIDER || 'email', // email | sms | authenticator
  },

  // Optional: mail service configuration (for approvals/notifications)
  mail: {
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || 'no-reply@example.com',
  },
});
