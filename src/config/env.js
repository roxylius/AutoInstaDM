require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Instagram Platform
  igAppId: process.env.IG_APP_ID,
  igAppSecret: process.env.IG_APP_SECRET,
  igAccessToken: process.env.IG_ACCESS_TOKEN,
  graphApiVersion: process.env.GRAPH_API_VERSION || 'v25.0',
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN,

  // AI provider (OpenAI-compatible)
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',

  // Creator / business
  creatorDisplayName: process.env.CREATOR_DISPLAY_NAME || 'the creator',
  creatorBio: process.env.CREATOR_BIO || '',
  subscriptionUrl: process.env.SUBSCRIPTION_URL || '',
  allowLinkOnRequest: bool(process.env.ALLOW_LINK_ON_REQUEST, true),

  // Runtime
  redisUrl: process.env.REDIS_URL,
  pollingInterval: parseInt(process.env.POLLING_INTERVAL, 10) || 5000,
  maxPollingDuration: parseInt(process.env.MAX_POLLING_DURATION, 10) || 20000,
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30,

  // 24-hour standard messaging window (Instagram Platform policy).
  messagingWindowMs: 24 * 60 * 60 * 1000,
};
