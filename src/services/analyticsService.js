const { getLogger } = require('../utils/logger');

const logger = getLogger('analytics');

/**
 * Aggregate, non-identifying operational metrics only (counts + which user ids
 * are active, so we can honour deletion requests). No message content is stored.
 */
class AnalyticsService {
  constructor() {
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.optOuts = 0;
    this.humanHandoffs = 0;
    this.activeUsers = new Set();
    this.dailyStats = new Map();
  }

  _bump(type) {
    const today = new Date().toISOString().slice(0, 10);
    const day = this.dailyStats.get(today) || { sent: 0, received: 0, optOuts: 0, handoffs: 0 };
    day[type] = (day[type] || 0) + 1;
    this.dailyStats.set(today, day);
  }

  logMessageReceived(userId) {
    this.messagesReceived++;
    this.activeUsers.add(userId);
    this._bump('received');
  }

  logMessageSent(userId) {
    this.messagesSent++;
    this.activeUsers.add(userId);
    this._bump('sent');
  }

  logOptOut(userId) {
    this.optOuts++;
    this._bump('optOuts');
    logger.info('Opt-out recorded', { userId });
  }

  logHumanHandoff(userId) {
    this.humanHandoffs++;
    this._bump('handoffs');
    logger.info('Human handoff recorded', { userId });
  }

  deleteUser(userId) {
    this.activeUsers.delete(userId);
    logger.info('Removed user from analytics active set', { userId });
  }

  getStats() {
    return {
      total: {
        messagesSent: this.messagesSent,
        messagesReceived: this.messagesReceived,
        optOuts: this.optOuts,
        humanHandoffs: this.humanHandoffs,
        activeUsers: this.activeUsers.size,
      },
      daily: Object.fromEntries(this.dailyStats),
      uptime: process.uptime(),
    };
  }
}

module.exports = new AnalyticsService();
