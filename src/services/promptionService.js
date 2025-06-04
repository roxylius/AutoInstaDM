const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/promotion.log' })
  ]
});

class FanvuePromotion {
  constructor() {
    this.promoCodes = process.env.FANVUE_PROMO_CODES?.split(',') || ['WELCOME20'];
    this.profileUrl = process.env.FANVUE_PROFILE_URL || 'https://fanvue.com/your-profile';
    this.promotionHistory = new Map();
  }

  shouldPromoteToUser(userId, conversationType, messageHistory) {
    const history = this.promotionHistory.get(userId) || {
      attempts: 0,
      lastPromotion: 0,
      converted: false
    };

    if (history.converted) return false;
    const daysSinceLastPromo = (Date.now() - history.lastPromotion) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPromo < 1) return false;
    if (history.attempts >= 3) return false;

    const promotionChances = {
      salesintent: 0.8,
      compliment: 0.4,
      question: 0.3,
      general: 0.2,
      greeting: 0.1
    };

    const chance = promotionChances[conversationType] || 0.1;
    return Math.random() < chance;
  }

  generatePromotionMessage(conversationType, userName = 'gorgeous') {
    const promoCode = this.promoCodes[Math.floor(Math.random() * this.promoCodes.length)];
    const templates = {
      salesintent: [
        `I love that you're interested! I have some amazing exclusive content on my Fanvue at ${this.profileUrl}. Use code ${promoCode} for a special discount!`,
        `You have great taste! My Fanvue has all my most intimate content at ${this.profileUrl}. Get started with code ${promoCode}!`
      ],
      compliment: [
        `Aww thank you ${userName}! You're so sweet! If you want to see more of me, I post exclusive stuff on ${this.profileUrl}.`,
        `You made my day! I have so much more content that I think you'd love on my Fanvue at ${this.profileUrl}.`
      ],
      general: [
        `Hey ${userName}, I post all my exclusive content on Fanvue at ${this.profileUrl}. Check it out if you're interested!`
      ]
    };

    const options = templates[conversationType] || templates.general;
    return options[Math.floor(Math.random() * options.length)];
  }

  logPromotion(userId) {
    const history = this.promotionHistory.get(userId) || {
      attempts: 0,
      lastPromotion: 0,
      converted: false
    };
    history.attempts += 1;
    history.lastPromotion = Date.now();
    this.promotionHistory.set(userId, history);
    logger.info(`Promotion sent to user ${userId}, attempt ${history.attempts}`);
  }
}

module.exports = new FanvuePromotion();
