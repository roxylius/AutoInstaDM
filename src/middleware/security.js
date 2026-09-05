const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { igAppSecret, nodeEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');

const logger = getLogger('security');

/**
 * Verify X-Hub-Signature-256 on incoming webhook POSTs using the app secret.
 * Requires express.json({ verify }) to have stored the raw body on req.rawBody.
 */
exports.verifyWebhookSignature = (req, res, next) => {
  if (req.method === 'GET') return next();

  if (!igAppSecret) {
    logger.error('IG_APP_SECRET not set — rejecting webhook POST');
    return res.status(500).send('Server misconfigured');
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) {
    logger.warn('Missing signature or raw body on webhook POST');
    return res.status(403).send('Missing signature');
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', igAppSecret)
    .update(req.rawBody)
    .digest('hex');

  const ok = signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!ok) {
    logger.warn('Invalid webhook signature');
    return res.status(403).send('Forbidden');
  }
  next();
};

exports.rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' && req.path === '/',
});
