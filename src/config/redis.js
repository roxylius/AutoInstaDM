const Redis = require('ioredis');
const { redisUrl } = require('./env');
const { getLogger } = require('../utils/logger');

const logger = getLogger('redis');

let client = null;

if (redisUrl) {
  client = new Redis(redisUrl, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 2,
  });
  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
} else {
  logger.info('REDIS_URL not set — using in-memory state (single instance only)');
}

module.exports = client;
