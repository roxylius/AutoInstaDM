const Redis = require('ioredis');
const { generateAIResponse } = require('./aiService');
const { sendInstagramMessage } = require('../utils/helpers');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/polling.log' })
  ]
});

class MessagePollingSystem {
  constructor() {
    this.redisClient = process.env.NODE_ENV === 'production' && process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { enableAutoPipelining: true })
      : null;
    this.userQueues = new Map();
    this.pollingTimers = new Map();
    this.processingLocks = new Set();
    this.POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL) || 5000;
    this.MAX_POLLING_DURATION = parseInt(process.env.MAX_POLLING_DURATION) || 20000;
    logger.info('Polling system initialized', {
      pollingInterval: this.POLLING_INTERVAL,
      maxPollingDuration: this.MAX_POLLING_DURATION
    });
  }

  async addMessage(userId, message) {
    logger.info(`Adding message to queue for user ${userId}`);
    if (this.redisClient) {
      await this.redisClient.lpush(`queue:${userId}`, JSON.stringify(message));
      await this.redisClient.expire(`queue:${userId}`, 3600); // 1 hour TTL
    } else {
      if (!this.userQueues.has(userId)) {
        this.userQueues.set(userId, []);
      }
      this.userQueues.get(userId).push({ ...message, receivedAt: Date.now() });
    }
    this.startPolling(userId);
  }

  startPolling(userId) {
    logger.info(`Starting polling for user ${userId}`);
    this.clearPolling(userId);
    const timer = setTimeout(() => this.checkAndProcess(userId), this.POLLING_INTERVAL);
    this.pollingTimers.set(userId, {
      timer,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
  }

  async checkAndProcess(userId) {
    const pollingData = this.pollingTimers.get(userId);
    if (!pollingData) return;

    let userQueue;
    if (this.redisClient) {
      const messages = await this.redisClient.lrange(`queue:${userId}`, 0, -1);
      userQueue = messages.map(msg => JSON.parse(msg));
    } else {
      userQueue = this.userQueues.get(userId) || [];
    }

    if (!userQueue.length) {
      this.clearPolling(userId);
      return;
    }

    const now = Date.now();
    const elapsedTime = now - pollingData.startTime;
    const timeSinceLastMessage = now - Math.max(...userQueue.map(msg => msg.receivedAt || msg.timestamp));

    const shouldProcess =
      timeSinceLastMessage > this.POLLING_INTERVAL ||
      elapsedTime > this.MAX_POLLING_DURATION ||
      userQueue.length >= 10;

    if (shouldProcess) {
      logger.info(`Processing ${userQueue.length} messages for user ${userId}`);
      await this.processMessages(userId, userQueue);
      if (this.redisClient) {
        await this.redisClient.del(`queue:${userId}`);
      } else {
        this.userQueues.set(userId, []);
      }
      this.clearPolling(userId);
    } else {
      logger.info(`Continuing to poll for user ${userId}, ${userQueue.length} messages queued`);
      this.startPolling(userId);
    }
  }

  async processMessages(userId, messages) {
    if (this.processingLocks.has(userId)) {
      logger.info(`Already processing messages for user ${userId}`);
      return;
    }
    this.processingLocks.add(userId);

    try {
      const combinedText = messages.map(msg => msg.text).join('\n');
      logger.info(`Generating AI response for: ${combinedText}`);

      // const aiResponse = await generateAIResponse(userId, combinedText, messages);

      //test reponse(dev)
      const aiResponse = "hello";
      await sendInstagramMessage(userId, aiResponse);
    } catch (error) {
      logger.error(`Error processing messages for user ${userId}:`, error);
      await sendInstagramMessage(userId, "Thanks for your message! I'm having some technical difficulties, but I'll respond properly soon!");
    } finally {
      this.processingLocks.delete(userId);
    }
  }

  clearPolling(userId) {
    const timerData = this.pollingTimers.get(userId);
    if (timerData) {
      clearTimeout(timerData.timer);
      this.pollingTimers.delete(userId);
    }
  }
}

module.exports = new MessagePollingSystem();
