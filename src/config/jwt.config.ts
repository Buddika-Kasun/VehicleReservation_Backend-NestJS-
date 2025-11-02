
export default () => ({
  jwt: {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    secret: process.env.JWT_SECRET || 'supersecretjwtkey',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
});
