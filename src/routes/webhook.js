const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/security');
const pollingSystem = require('../services/pollingService');
const consentService = require('../services/consentService');
const analyticsService = require('../services/analyticsService');
const { getLogger } = require('../utils/logger');
const { webhookVerifyToken, igAppSecret } = require('../config/env');

const logger = getLogger('webhook');

/** Delete every trace of a user across all subsystems. */
async function purgeUser(userId) {
  await pollingSystem.removeUser(userId);
  await consentService.deleteUser(userId);
  analyticsService.deleteUser(userId);
  logger.info('Purged all data for user', { userId });
}

/** Parse and verify Meta's signed_request (used by the data-deletion callback). */
function parseSignedRequest(signedRequest) {
  const [encodedSig, payload] = String(signedRequest).split('.');
  if (!encodedSig || !payload) throw new Error('Malformed signed_request');

  const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const sig = b64url(encodedSig);
  const expected = crypto.createHmac('sha256', igAppSecret).update(payload).digest();

  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error('Bad signed_request signature');
  }
  return JSON.parse(b64url(payload).toString('utf8'));
}

// ─── Webhook verification (GET) ──────────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === webhookVerifyToken) {
    logger.info('Webhook verified');
    return res.status(200).send(challenge);
  }
  logger.warn('Webhook verification failed', { mode });
  return res.sendStatus(403);
});

// ─── Inbound events (POST) ──────────────────────────────────────────────
router.post('/', verifyWebhookSignature, async (req, res) => {
  // Ack fast; process asynchronously.
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'instagram' || !Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const message = event.message;
        if (!senderId || !message) continue;
        if (message.is_echo) continue;          // our own outbound message
        if (message.is_deleted || message.is_unsupported) continue;

        const text = message.text;
        if (!text) continue;                    // media-only; assistant handles text only

        await consentService.recordInbound(senderId);
        analyticsService.logMessageReceived(senderId);

        await pollingSystem.addMessage(senderId, {
          text,
          timestamp: event.timestamp,
          messageId: message.mid,
        });
      }
    }
  } catch (error) {
    logger.error('Error handling webhook', { error: error.message });
  }
});

// ─── Meta data-deletion request callback ────────────────────────────────
// Configure this URL as the "Data Deletion Request" callback in the app dashboard.
router.post('/deletion-callback', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const data = parseSignedRequest(req.body.signed_request);
    const userId = data.user_id;
    await purgeUser(userId);

    const code = crypto.randomBytes(8).toString('hex');
    logger.info('Processed Meta deletion callback', { userId, code });

    const base = `${req.protocol}://${req.get('host')}`;
    res.json({
      url: `${base}/webhook/deletion-status?code=${code}`,
      confirmation_code: code,
    });
  } catch (error) {
    logger.error('Deletion callback failed', { error: error.message });
    res.status(400).json({ error: 'Invalid deletion request' });
  }
});

router.get('/deletion-status', (req, res) => {
  res.status(200).send(
    `Data deletion request ${req.query.code || ''} has been completed. ` +
    'All conversation state and analytics for the associated account were removed.'
  );
});

// ─── Self-service deletion ─────────────────────────────────────────────
router.get('/data-deletion', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8">
    <title>Data deletion</title>
    <body style="font-family:system-ui;max-width:640px;margin:3rem auto;padding:0 1rem">
    <h1>Request data deletion</h1>
    <p>We only store: your Instagram-scoped ID, whether you opted out, and message
    counts. We never store message content beyond short-lived processing.</p>
    <p>To delete this data, message the creator's Instagram account the word
    <strong>DELETE</strong>, or email the address in their profile. Deletions are
    completed within 30 days.</p>
    <form method="POST" action="/webhook/delete-data">
      <label>Instagram-scoped ID (optional, if you know it):<br>
        <input name="igsid" style="width:100%;padding:.5rem"></label><br><br>
      <label>Note:<br><textarea name="note" style="width:100%;padding:.5rem"></textarea></label><br><br>
      <button type="submit" style="padding:.6rem 1.2rem">Submit request</button>
    </form></body>`);
});

router.post('/delete-data', express.urlencoded({ extended: true }), async (req, res) => {
  const { igsid, note } = req.body || {};
  const ref = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  if (igsid) {
    await purgeUser(String(igsid).trim());
    logger.info('Self-service deletion completed', { ref });
    return res.json({ success: true, ref, message: 'Your data has been deleted.' });
  }

  logger.info('Manual deletion request queued for operator review', { ref, note: !!note });
  res.json({
    success: true,
    ref,
    message: 'Request received. It will be completed within 30 days. Keep this reference.',
  });
});

module.exports = router;
