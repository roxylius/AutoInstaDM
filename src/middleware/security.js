const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

exports.verifyWebhookSignature = (req, res, next) => {
  const signature = req.get('x-hub-signature-256');
  if (!signature) {
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
  message: 'Too many requests from this IP, please try again later.'
});
