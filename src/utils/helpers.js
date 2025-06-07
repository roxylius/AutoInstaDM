const axios = require('axios');
const promotionService = require('../services/promotionService');
const analyticsService = require('../services/analyticsService');
const winston = require('winston');
const { HtmlToText } = require('html-to-text-conv');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/helpers.log' })
  ]
});

function analyzeConversationType(messageText) {
  const lowerText = messageText.toLowerCase();
  if (/hi|hello|hey|sup|what's up/i.test(lowerText)) return 'greeting';
  if (lowerText.includes('?') || /what|how|why|when|where|can|do you/i.test(lowerText)) return 'question';
  if (/subscribe|buy|purchase|interested|price|cost|how much/i.test(lowerText)) return 'salesintent';
  if (/love|amazing|beautiful|gorgeous|stunning|incredible/i.test(lowerText)) return 'compliment';
  return 'general';
}

function buildSystemPrompt(conversationType, userId) {
  const basePersonality = "You are a friendly, engaging content creator who creates premium content.";
  const fanvuePromotion = `Your Fanvue page ${process.env.FANVUE_PROFILE_URL} has exclusive content for subscribers.`;
  
  const conversationStrategies = {
    salesintent: `${basePersonality} They seem interested in your content! This is a perfect opportunity to mention your Fanvue page.`,
    compliment: `${basePersonality} They complimented you! Respond graciously and make them feel special.`,
    general: `${basePersonality} Keep the conversation flowing naturally. Be engaging and approachable.`
  };
  
  return conversationStrategies[conversationType] || conversationStrategies.general;
}

async function sendInstagramMessage(userId, message) {
  try {
    // Placeholder for actual Instagram API call
    logger.info(`Sending message to user ${userId}: ${message}`);
    // In a real implementation, use Meta's Graph API with axios
    /*
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: userId },
        message: { text: message }
      }
    );
    */
    analyticsService.logMessageSent(userId);
    return true;
  } catch (error) {
    logger.error(`Failed to send message to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Returns a Promise that resolves after a specified timeout.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} Resolves after the timeout completes.
 */
const waitForTimeout = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Convert HTML (including tables, headings, links) to plain text.
 * - Skips <button> elements entirely
 * - Renders headings on their own lines
 * - Preserves paragraphs with blank lines
 * - Inlines links as "text (url)"
 * - Formats tables with tabs between cells and newlines between rows
 *
 * @param {string} html - Raw HTML string to convert
 * @returns {string}    - Plain-text representation
 */
function htmlResponseToText(html) {
  //create converter object
  const converter = new HtmlToText();

  const text = converter.convert(html);

  return text;
}

module.exports = {
  analyzeConversationType,
  buildSystemPrompt,
  sendInstagramMessage
};
