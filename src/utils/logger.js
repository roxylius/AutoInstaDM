const winston = require('winston');

/**
 * Build a namespaced Winston logger. All logs go to logs/combined.log plus a
 * per-namespace file, and errors additionally to logs/error.log.
 *
 * Conversation content is intentionally NOT logged at info level. Only metadata
 * (sender id, message id, timestamps, decisions) is recorded, per the retention
 * policy documented in COMPLIANCE.md.
 *
 * @param {string} namespace
 * @returns {import('winston').Logger}
 */
function getLogger(namespace) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'instagram-assistant', module: namespace },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
      new winston.transports.File({ filename: `logs/${namespace}.log` }),
    ],
  });
}

module.exports = { getLogger };
