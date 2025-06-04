const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics.log' })
  ]
});

class AnalyticsService {
  constructor() {
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.promotionsSent = 0;
    this.conversions = 0;
    this.activeUsers = new Set();
    this.dailyStats = new Map();
  }

  logMessageReceived(userId) {
    this.messagesReceived++;
    this.activeUsers.add(userId);
    this.updateDailyStats('received');
    logger.info(`Message received from user ${userId}, total: ${this.messagesReceived}`);
  }

  logMessageSent(userId) {
    this.messagesSent++;
    this.updateDailyStats('sent');
    logger.info(`Message sent to user ${userId}, total: ${this.messagesSent}`);
  }

  logPromotionSent(userId) {
    this.promotionsSent++;
    this.updateDailyStats('promotions');
    logger.info(`Promotion sent to user ${userId}, total: ${this.promotionsSent}`);
  }

  logConversion(userId) {
    this.conversions++;
    this.updateDailyStats('conversions');
    logger.info(`Conversion recorded for user ${userId}, total: ${this.conversions}`);
  }

  updateDailyStats(type) {
    const today = new Date().toISOString().split('T')[0];
    const dailyStat = this.dailyStats.get(today) || {
      sent: 0,
      received: 0,
      promotions: 0,
      conversions: 0
    };

    dailyStat[type]++;
    this.dailyStats.set(today, dailyStat);
  }

  getStats() {
    return {
      total: {
        messagesSent: this.messagesSent,
        messagesReceived: this.messagesReceived,
        promotionsSent: this.promotionsSent,
        conversions: this.conversions,
        activeUsers: this.activeUsers.size,
        conversionRate: this.promotionsSent > 0 
          ? (this.conversions / this.promotionsSent * 100).toFixed(2) 
          : 0
      },
      daily: Object.fromEntries(this.dailyStats),
      uptime: process.uptime()
    };
  }
}

module.exports = new AnalyticsService();
