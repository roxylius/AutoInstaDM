const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/security');
const pollingSystem = require('../services/pollingService');
const analyticsService = require('../services/analyticsService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/webhook.log' })
  ]
});

// Webhook verification endpoint
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('Webhook verification request received', { mode, token });
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Message reception endpoint
router.post('/', verifyWebhookSignature, async (req, res) => {
  try {
    const body = req.body;
    logger.info('Webhook received', { body });

    if (body.object === 'instagram') {
      body.entry.forEach(entry => {
        if (entry.messaging) {
          entry.messaging.forEach(event => {
            const senderId = event.sender.id;
            const messageText = event.message?.text;
            const timestamp = event.timestamp;

            if (messageText) {
              logger.info(`Message from ${senderId}: ${messageText}`);
              pollingSystem.addMessage(senderId, {
                text: messageText,
                timestamp: timestamp,
                messageId: event.message.mid
              });
              analyticsService.logMessageReceived(senderId);
            }
          });
        }
      });
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.error('Error handling webhook:', error);
    res.status(500).send('INTERNAL_SERVER_ERROR');
  }
});

module.exports = router;
