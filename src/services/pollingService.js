const redisClient = require('../config/redis');
const { generateAIResponse, clearHistory } = require('./aiService');
const consentService = require('./consentService');
const linkService = require('./linkService');
const analyticsService = require('./analyticsService');
const { sendInstagramMessage, disclosureLine, truncateToBytes } = require('../utils/helpers');
const { getLogger } = require('../utils/logger');
const { pollingInterval, maxPollingDuration } = require('../config/env');

const logger = getLogger('polling');

/**
 * Debounces bursts of inbound DMs from a single user, then produces ONE reply.
 *
 * Compliance gates applied before any reply is sent:
 *   1. "stop" / "unsubscribe"  -> opt the user out, send one confirmation, done.
 *   2. "human" / "are you a bot" -> hand off to a person, send one ack, done.
 *   3. opted out or handed off  -> stay silent.
 *   4. outside the 24h window   -> stay silent (standard messaging only).
 *   5. first reply in a convo   -> prepend the AI disclosure.
 *   6. explicit link request    -> send the configured link instead of an AI reply.
 */
class MessagePollingSystem {
  constructor() {
    this.userQueues = new Map();
    this.pollingTimers = new Map();
    this.processingLocks = new Set();
    this.POLLING_INTERVAL = pollingInterval;
    this.MAX_POLLING_DURATION = maxPollingDuration;
    logger.info('Polling system initialized', {
      pollingInterval: this.POLLING_INTERVAL,
      maxPollingDuration: this.MAX_POLLING_DURATION,
      store: redisClient ? 'redis' : 'memory',
    });
  }

  async addMessage(userId, message) {
    const entry = { ...message, receivedAt: Date.now() };
    if (redisClient) {
      await redisClient.rpush(`queue:${userId}`, JSON.stringify(entry));
      await redisClient.expire(`queue:${userId}`, 3600);
    } else {
      if (!this.userQueues.has(userId)) this.userQueues.set(userId, []);
      this.userQueues.get(userId).push(entry);
    }
    this.startPolling(userId);
  }

  startPolling(userId) {
    this.clearPolling(userId);
    const timer = setTimeout(() => this.checkAndProcess(userId).catch((e) =>
      logger.error('checkAndProcess failed', { userId, error: e.message })), this.POLLING_INTERVAL);
    this.pollingTimers.set(userId, { timer, startTime: Date.now() });
  }

  async _readQueue(userId) {
    if (redisClient) {
      const raw = await redisClient.lrange(`queue:${userId}`, 0, -1);
      return raw.map((m) => JSON.parse(m));
    }
    return this.userQueues.get(userId) || [];
  }

  async _clearQueue(userId) {
    if (redisClient) await redisClient.del(`queue:${userId}`);
    else this.userQueues.set(userId, []);
  }

  async checkAndProcess(userId) {
    const pollingData = this.pollingTimers.get(userId);
    if (!pollingData) return;

    const queue = await this._readQueue(userId);
    if (!queue.length) return this.clearPolling(userId);

    const now = Date.now();
    const idleFor = now - Math.max(...queue.map((m) => m.receivedAt));
    const elapsed = now - pollingData.startTime;

    const ready = idleFor > this.POLLING_INTERVAL
      || elapsed > this.MAX_POLLING_DURATION
      || queue.length >= 10;

    if (!ready) return this.startPolling(userId);

    await this.processMessages(userId, queue);
    await this._clearQueue(userId);
    this.clearPolling(userId);
  }

  async processMessages(userId, messages) {
    if (this.processingLocks.has(userId)) return;
    this.processingLocks.add(userId);

    try {
      const combinedText = messages.map((m) => m.text).filter(Boolean).join('\n');
      const intent = consentService.classify(combinedText);

      // 1 & 2: consent / handoff keywords take priority over everything.
      if (intent === 'stop') {
        await consentService.optOut(userId);
        analyticsService.logOptOut(userId);
        return this._safeSend(userId, "You're opted out — I won't send you automated messages anymore. Reply \"start\" any time to turn them back on.");
      }
      if (intent === 'resume') {
        await consentService.resume(userId);
        return this._safeSend(userId, "You're opted back in. How can I help?");
      }
      if (intent === 'human') {
        await consentService.requestHuman(userId);
        analyticsService.logHumanHandoff(userId);
        return this._safeSend(userId, "Got it — I've flagged this conversation for a person to follow up. A human will take it from here.");
      }

      // 3: respect opt-out / active handoff.
      if (!(await consentService.isAutomationAllowed(userId))) {
        logger.info('Automation suppressed (opted out or handed off)', { userId });
        return;
      }

      // 4: only reply inside the 24h standard messaging window.
      if (!(await consentService.withinMessagingWindow(userId))) {
        logger.warn('Outside 24h messaging window — not replying', { userId });
        return;
      }

      // 5: disclosure on the first automated reply.
      const state = await consentService.get(userId);
      const prefix = state.disclosed ? '' : disclosureLine() + '\n\n';

      // 6: explicit link request -> deterministic link reply.
      let body;
      if (linkService.isExplicitLinkRequest(combinedText)) {
        body = linkService.buildLinkMessage();
      } else {
        body = await generateAIResponse(userId, combinedText);
      }

      await this._safeSend(userId, truncateToBytes(prefix + body));
      if (!state.disclosed) await consentService.markDisclosed(userId);
    } catch (error) {
      logger.error('Error processing messages', { userId, error: error.message });
    } finally {
      this.processingLocks.delete(userId);
    }
  }

  async _safeSend(userId, text) {
    try {
      await sendInstagramMessage(userId, text);
    } catch (e) {
      logger.error('Send failed in polling', { userId, error: e.message });
    }
  }

  clearPolling(userId) {
    const data = this.pollingTimers.get(userId);
    if (data) {
      clearTimeout(data.timer);
      this.pollingTimers.delete(userId);
    }
  }

  /** Data-deletion hook: drop all in-flight state for a user. */
  async removeUser(userId) {
    this.clearPolling(userId);
    await this._clearQueue(userId);
    this.userQueues.delete(userId);
    clearHistory(userId);
  }
}

module.exports = new MessagePollingSystem();
