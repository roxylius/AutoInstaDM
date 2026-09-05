const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');

const { port, nodeEnv, igAccessToken, graphApiVersion } = require('./src/config/env');
const { getLogger } = require('./src/utils/logger');
const webhookRouter = require('./src/routes/webhook');
const analyticsService = require('./src/services/analyticsService');
const { rateLimiter } = require('./src/middleware/security');

const logger = getLogger('server');
const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

// Capture the raw body so webhook signatures can be verified.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

app.use('/webhook', rateLimiter, webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/analytics', (_req, res) => {
  res.json(analyticsService.getStats());
});

// Sanity check for the Instagram access token / connection.
app.get('/test-connection', async (_req, res) => {
  try {
    const { data } = await axios.get(
      `https://graph.instagram.com/${graphApiVersion}/me`,
      { params: { fields: 'user_id,username', access_token: igAccessToken }, timeout: 10000 }
    );
    res.json({ status: 'connected', account: data });
  } catch (error) {
    res.status(500).json({
      status: 'failed',
      details: error.response?.data || error.message,
    });
  }
});

app.listen(port, () => {
  logger.info(`Instagram assistant running on port ${port} (${nodeEnv})`);
});

module.exports = app;
