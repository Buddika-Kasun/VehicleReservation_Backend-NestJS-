// api/index.js - This is the entry point for Vercel
const { bootstrap } = require('../dist/main');

module.exports = async (req, res) => {
  const app = await bootstrap();
  return app(req, res);
};