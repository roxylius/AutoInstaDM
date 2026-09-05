const redisClient = require('../config/redis');
const { getLogger } = require('../utils/logger');
const { messagingWindowMs } = require('../config/env');

const logger = getLogger('consent');

const STOP_PATTERNS = [
  /\bstop\b/i,
  /\bunsubscribe\b/i,
  /\bopt[\s-]?out\b/i,
  /stop (messaging|texting|dming|contacting)/i,
  /don'?t (message|text|dm|contact) me/i,
  /leave me alone/i,
];

const HUMAN_PATTERNS = [
  /\bhuman\b/i,
  /real person/i,
  /speak (to|with) (a|someone)/i,
  /talk to (a|someone)/i,
  /\bagent\b/i,
  /is this a bot/i,
  /are you (a )?(bot|ai|real)/i,
];

const RESUME_PATTERNS = [/\b(start|resume|continue|unstop)\b/i, /message me again/i];

const TTL_SECONDS = 60 * 60 * 24 * 45; // keep consent state 45 days

/**
 * Tracks per-user conversation state required for Instagram Platform compliance:
 * AI disclosure delivery, opt-out ("STOP"), human-handoff requests ("HUMAN"),
 * and the 24-hour standard messaging window.
 *
 * Backed by Redis when REDIS_URL is set, otherwise an in-memory Map (single
 * instance / development only).
 */
class ConsentService {
  constructor() {
    this.mem = new Map();
  }

  _key(userId) {
    return `consent:${userId}`;
  }

  _defaults() {
    return {
      disclosed: false,
      optedOut: false,
      humanHandoff: false,
      lastInboundAt: 0,
      firstSeenAt: Date.now(),
    };
  }

  async get(userId) {
    if (redisClient) {
      const raw = await redisClient.get(this._key(userId));
      return raw ? { ...this._defaults(), ...JSON.parse(raw) } : this._defaults();
    }
    return this.mem.get(userId) || this._defaults();
  }

  async _save(userId, state) {
    if (redisClient) {
      await redisClient.set(this._key(userId), JSON.stringify(state), 'EX', TTL_SECONDS);
    } else {
      this.mem.set(userId, state);
    }
    return state;
  }

  async update(userId, patch) {
    const state = await this.get(userId);
    return this._save(userId, { ...state, ...patch });
  }

  /**
   * Classify an inbound message for consent-relevant intent.
   * @returns {'stop'|'human'|'resume'|null}
   */
  classify(text) {
    if (!text) return null;
    if (STOP_PATTERNS.some((re) => re.test(text))) return 'stop';
    if (RESUME_PATTERNS.some((re) => re.test(text))) return 'resume';
    if (HUMAN_PATTERNS.some((re) => re.test(text))) return 'human';
    return null;
  }

  /** Record that a user just sent us a message (opens/refreshes the 24h window). */
  async recordInbound(userId) {
    return this.update(userId, { lastInboundAt: Date.now() });
  }

  /** True if we are still inside the 24h standard messaging window. */
  async withinMessagingWindow(userId) {
    const { lastInboundAt } = await this.get(userId);
    return lastInboundAt > 0 && Date.now() - lastInboundAt <= messagingWindowMs;
  }

  async markDisclosed(userId) {
    return this.update(userId, { disclosed: true });
  }

  async optOut(userId) {
    logger.info('User opted out of automation', { userId });
    return this.update(userId, { optedOut: true, humanHandoff: false });
  }

  async resume(userId) {
    logger.info('User resumed automation', { userId });
    return this.update(userId, { optedOut: false });
  }

  async requestHuman(userId) {
    logger.info('User requested a human agent', { userId });
    return this.update(userId, { humanHandoff: true });
  }

  /** Should the bot generate an automated reply for this user right now? */
  async isAutomationAllowed(userId) {
    const state = await this.get(userId);
    return !state.optedOut && !state.humanHandoff;
  }

  /** GDPR / Meta data-deletion: remove everything we hold for this user. */
  async deleteUser(userId) {
    if (redisClient) {
      await redisClient.del(this._key(userId));
    } else {
      this.mem.delete(userId);
    }
    logger.info('Deleted consent state for user', { userId });
  }
}

module.exports = new ConsentService();
