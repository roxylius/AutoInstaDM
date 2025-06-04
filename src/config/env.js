require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  metaAppId: process.env.META_APP_ID,
  metaAppSecret: process.env.META_APP_SECRET,
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  redisUrl: process.env.REDIS_URL,
  fanvueProfileUrl: process.env.FANVUE_PROFILE_URL,
  fanvuePromoCodes: process.env.FANVUE_PROMO_CODES,
  pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 5000,
  maxPollingDuration: parseInt(process.env.MAX_POLLING_DURATION) || 20000
};
