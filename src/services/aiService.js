const { OpenAI } = require('openai');
const { analyzeConversationType, buildSystemPrompt } = require('../utils/helpers');
const { getLogger } = require('../utils/logger');
const { aiBaseUrl, aiApiKey, aiModel } = require('../config/env');

const logger = getLogger('ai');

/**
 * The AI client talks to ANY OpenAI-compatible /v1/chat/completions endpoint.
 * Configure AI_BASE_URL / AI_API_KEY / AI_MODEL in .env to use OpenAI, Anthropic,
 * OpenRouter, Groq, Together, or a self-hosted model.
 *
 * We deliberately do NOT drive a browser or scrape a chat web UI — that violates
 * those providers' terms of use.
 */
const client = aiApiKey
  ? new OpenAI({ apiKey: aiApiKey, baseURL: aiBaseUrl })
  : null;

// In-memory rolling transcript per user (metadata-light, capped).
const conversationHistory = new Map();
const MAX_TURNS = 20;

function pushHistory(userId, role, content) {
  const hist = conversationHistory.get(userId) || [];
  hist.push({ role, content });
  conversationHistory.set(userId, hist.slice(-MAX_TURNS));
}

function clearHistory(userId) {
  conversationHistory.delete(userId);
}

/**
 * Generate an assistant reply for a batch of the user's recent messages.
 * @param {string} userId
 * @param {string} combinedText  user messages joined by newlines
 * @returns {Promise<string>}
 */
async function generateAIResponse(userId, combinedText) {
  if (!client) {
    logger.warn('AI provider not configured (AI_API_KEY missing) — using safe fallback reply');
    return "Thanks for the message! I'll get back to you shortly.";
  }

  const conversationType = analyzeConversationType(combinedText);
  const systemPrompt = buildSystemPrompt(conversationType);

  pushHistory(userId, 'user', combinedText);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory.get(userId) || []),
  ];

  try {
    const completion = await client.chat.completions.create({
      model: aiModel,
      messages,
      max_tokens: 300,
      temperature: 0.7,
      presence_penalty: 0.4,
      frequency_penalty: 0.4,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim()
      || "Thanks for reaching out! How can I help?";
    pushHistory(userId, 'assistant', reply);
    logger.info('Generated AI reply', { userId, conversationType, chars: reply.length });
    return reply;
  } catch (error) {
    logger.error('AI provider error', { userId, message: error.message });
    throw new Error('Failed to generate AI response');
  }
}

module.exports = { generateAIResponse, clearHistory };
