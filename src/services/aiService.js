const { OpenAI } = require('openai');
const { analyzeConversationType, buildSystemPrompt } = require('../utils/helpers');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ai.log' })
  ]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const conversationHistory = new Map();

async function generateAIResponse(userId, messageText, messageHistory) {
  try {
    let history = conversationHistory.get(userId) || [];
    messageHistory.forEach(msg => {
      history.push({
        role: "user",
        content: msg.text,
        timestamp: msg.timestamp
      });
    });

    const conversationType = analyzeConversationType(messageText);
    const systemPrompt = buildSystemPrompt(conversationType, userId);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10)
    ];

    logger.info(`Generating AI response with ${messages.length} context messages`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.5
    });

    const aiResponse = completion.choices[0].message.content;
    history.push({
      role: "assistant",
      content: aiResponse,
      timestamp: Date.now()
    });

    conversationHistory.set(userId, history.slice(-40));
    return aiResponse;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error('Failed to generate AI response');
  }
}

module.exports = { generateAIResponse };
