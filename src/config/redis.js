const Redis = require('ioredis');
const { redisUrl } = require('./env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/redis.log' })
  ]
});

let client = null;
if (process.env.NODE_ENV === 'production' && redisUrl) {
  client = new Redis(redisUrl, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 1,
    lazyConnect: true
  });
  logger.info('Redis client initialized for production');
} else {
  logger.info('Redis client not initialized, using in-memory storage');
}

module.exports = client;
