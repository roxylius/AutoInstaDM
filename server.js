require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cors = require('cors');
const webhookRouter = require('./src/routes/webhook');
const { rateLimiter } = require('./src/middleware/security');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy configuration for ngrok/development
if (process.env.NODE_ENV === 'development') {
  app.set('trust proxy', true);
} else {
  // For production, be more specific about trusted proxies
  app.set('trust proxy', 1);
}

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'instagram-automation' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use('/webhook', rateLimiter);
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Routes
app.use('/webhook', webhookRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Analytics endpoint (placeholder, detailed in analyticsService.js)
app.get('/analytics', (req, res) => {
  const analyticsService = require('./services/analyticsService');
  res.json(analyticsService.getStats());
});

app.listen(PORT, () => {
  logger.info(`Instagram DM Automation server running on port ${PORT}`);
  logger.info(`Webhook URL: http://localhost:${PORT}/webhook`);
});

module.exports = app;
