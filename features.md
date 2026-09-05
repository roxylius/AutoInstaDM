# Status

## Done
- [x] Replace browser-scraping AI with a configurable OpenAI-compatible client
- [x] Real Instagram Platform send-message integration (`graph.instagram.com`)
- [x] Mandatory AI disclosure on the first automated reply of every conversation
- [x] `STOP` / `UNSUBSCRIBE` opt-out, `START` opt-in, `HUMAN` handoff
- [x] 24-hour standard messaging window enforcement
- [x] No proactive/unsolicited promotion — link shared only on explicit request
- [x] Webhook signature verification (re-enabled, constant-time)
- [x] Real data deletion: Meta signed_request callback + self-service + purge across services

## Todo
- [ ] Persist conversation transcripts in Redis with automatic TTL = LOG_RETENTION_DAYS
- [ ] Operator dashboard for handed-off conversations
- [ ] Automated log rotation/expiry job
- [ ] Unit tests for consent classification and signature verification
