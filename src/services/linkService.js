const { getLogger } = require('../utils/logger');
const { subscriptionUrl, allowLinkOnRequest, creatorDisplayName } = require('../config/env');

const logger = getLogger('link');

/**
 * Shares the creator's subscription/landing URL ONLY when a user explicitly asks
 * for it. There is no probabilistic / proactive promotion — proactively pushing
 * promotional links into DMs violates the Instagram Platform Policy.
 *
 * IMPORTANT (see COMPLIANCE.md): even reactive sharing of a link that solicits
 * adult content or services can breach the Instagram Platform Terms. Operators
 * who point SUBSCRIPTION_URL at such a destination do so at their own risk. Set
 * ALLOW_LINK_ON_REQUEST=false to disable link sending entirely.
 */

const EXPLICIT_REQUEST = [
  /\b(where|how) (can|do) i (subscribe|sign up|join|find|buy|get)\b/i,
  /\b(send|drop|share|give)( me)? (the|your|a) (link|url|page)\b/i,
  /\bwhat'?s (the|your) link\b/i,
  /\b(subscription|sign[\s-]?up) link\b/i,
  /\bhow much (is|does|to)\b.*\b(subscri|join|member)/i,
  /\blink\??$/i,
];

/** @returns {boolean} true if the message is a clear, direct request for the link */
function isExplicitLinkRequest(text) {
  if (!text) return false;
  return EXPLICIT_REQUEST.some((re) => re.test(text.trim()));
}

/**
 * @returns {string|null} a message containing the link, or null if we should not
 *   send one (feature disabled, or no URL configured).
 */
function buildLinkMessage() {
  if (!allowLinkOnRequest) {
    return `You can find everything on ${creatorDisplayName}'s Instagram profile — check the link in the bio.`;
  }
  if (!subscriptionUrl) {
    logger.info('Link requested but SUBSCRIPTION_URL not configured');
    return `Thanks for asking! The link is in ${creatorDisplayName}'s Instagram bio.`;
  }
  return `Here you go: ${subscriptionUrl}`;
}

module.exports = { isExplicitLinkRequest, buildLinkMessage };
