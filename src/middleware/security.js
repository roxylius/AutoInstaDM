const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

exports.verifyWebhookSignature = (req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature) {
    console.warn('Missing signature for POST request');
    return res.status(403).send('Missing signature');
  }

  const expected = crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== `sha256=${expected}`) {
    console.warn('Invalid webhook signature');
    return res.status(403).send('Forbidden');
  }
  next();
};

exports.rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to handle proxy issues properly
  keyGenerator: (req) => {
    // For development with ngrok, use a more specific approach
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Get the first IP and remove any port numbers
      const ip = forwarded.split(',')[0].trim().replace(/:\d+[^:]*$/, '');
      return ip;
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skip: (req) => req.method === 'GET' && req.path === '/webhook'
});
