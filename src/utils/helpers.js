const axios = require('axios');
const analyticsService = require('../services/analyticsService');
const { getLogger } = require('./logger');
const {
  igAccessToken,
  graphApiVersion,
  creatorDisplayName,
  creatorBio,
} = require('../config/env');

const logger = getLogger('helpers');

const GRAPH_HOST = 'https://graph.instagram.com';
const MAX_MESSAGE_BYTES = 1000; // Instagram Platform hard limit for message text

/**
 * One-time disclosure prepended to the first automated reply in every
 * conversation. Required so users are never misled into thinking they are
 * talking to a human. Keep it short — it counts against the 1000-byte limit.
 */
function disclosureLine() {
  return `🤖 Heads up: you're chatting with ${creatorDisplayName}'s automated assistant (AI). Reply "human" to reach a person or "stop" to opt out.`;
}

/** Lightweight intent bucket used to steer the system prompt. */
function analyzeConversationType(messageText) {
  const t = (messageText || '').toLowerCase();
  if (/\b(subscribe|sign up|join|link|where can i|how much|price|cost|pay)\b/.test(t)) return 'sales_question';
  if (/\b(love|amazing|beautiful|gorgeous|stunning|incredible|cute|hot)\b/.test(t)) return 'compliment';
  if (t.includes('?') || /\b(what|how|why|when|where|can you|do you)\b/.test(t)) return 'question';
  if (/\b(hi|hello|hey|sup|yo|good morning|good evening)\b/.test(t)) return 'greeting';
  return 'general';
}

/**
 * Build the system prompt. The assistant is explicitly an AI acting on behalf of
 * a named human creator. It must not: pretend to be human, produce sexual or
 * explicit content, or push links that were not asked for.
 */
function buildSystemPrompt(conversationType) {
  const guardrails = [
    `You are an AI assistant replying to Instagram direct messages on behalf of ${creatorDisplayName}, an independent content creator.`,
    creatorBio ? `About ${creatorDisplayName}: ${creatorBio}` : '',
    'Rules you must always follow:',
    '- Never claim to be a human or to be the creator personally. If asked, say you are an AI assistant.',
    '- Never send sexually explicit content, nudity, sexual role-play, or descriptions of sexual acts. Instagram prohibits this in DMs regardless of the user\'s age or consent. Keep replies friendly and PG-13.',
    '- Do not paste subscription or payment links unless the user clearly asks where to subscribe or for a link. The app handles link sharing separately.',
    '- Keep replies concise (1-3 short sentences), warm, and in first person as the assistant.',
    '- If the user seems distressed, a minor, or asks for anything unsafe, disengage politely and suggest they contact the creator directly.',
  ].filter(Boolean);

  const perType = {
    greeting: 'The user is saying hello. Greet them back briefly and ask how you can help.',
    compliment: 'The user paid a compliment. Thank them warmly and briefly, no more.',
    question: 'Answer the user\'s question directly and briefly.',
    sales_question: 'The user is asking about subscribing/pricing/links. Answer helpfully; the app will attach the official link if configured, so you do not need to invent one.',
    general: 'Keep the conversation natural, friendly, and brief.',
  };

  return `${guardrails.join('\n')}\n\nContext: ${perType[conversationType] || perType.general}`;
}

/** Truncate a string to a UTF-8 byte budget without splitting a codepoint. */
function truncateToBytes(str, maxBytes = MAX_MESSAGE_BYTES) {
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  let end = maxBytes - 3; // reserve room for the "…" (3 bytes UTF-8)
  while (end > 0 && (buf[end] & 0b11000000) === 0b10000000) end--; // don't split a codepoint
  return buf.slice(0, end).toString('utf8').trimEnd() + '…';
}

/**
 * Send a text message via the Instagram Platform messaging API.
 * Docs: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 *
 * POST https://graph.instagram.com/<version>/me/messages
 * body: { recipient: { id: <IGSID> }, message: { text } }
 *
 * Caller is responsible for ensuring the 24h messaging window and opt-out status
 * have already been checked (see consentService).
 *
 * @param {string} recipientId Instagram-scoped user id (IGSID) from the webhook
 * @param {string} text
 * @returns {Promise<object>} API response data
 */
async function sendInstagramMessage(recipientId, text) {
  if (!igAccessToken) {
    logger.error('IG_ACCESS_TOKEN not configured; cannot send message', { recipientId });
    throw new Error('IG_ACCESS_TOKEN not configured');
  }

  const payload = {
    recipient: { id: recipientId },
    message: { text: truncateToBytes(text) },
  };

  try {
    const { data } = await axios.post(
      `${GRAPH_HOST}/${graphApiVersion}/me/messages`,
      payload,
      {
        params: { access_token: igAccessToken },
        timeout: 15000,
      }
    );
    analyticsService.logMessageSent(recipientId);
    logger.info('Message sent', { recipientId, messageId: data.message_id });
    return data;
  } catch (error) {
    const apiErr = error.response?.data?.error;
    logger.error('Failed to send Instagram message', {
      recipientId,
      status: error.response?.status,
      code: apiErr?.code,
      subcode: apiErr?.error_subcode,
      message: apiErr?.message || error.message,
    });
    throw error;
  }
}

module.exports = {
  disclosureLine,
  analyzeConversationType,
  buildSystemPrompt,
  truncateToBytes,
  sendInstagramMessage,
  MAX_MESSAGE_BYTES,
};
