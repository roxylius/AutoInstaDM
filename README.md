# Instagram DM Assistant (compliant)

An AI assistant that replies to **user-initiated** Instagram direct messages on
behalf of an independent creator. It always discloses that it is an AI, honours
opt-out and human-handoff requests, and only replies inside Instagram's 24-hour
messaging window.

Read [`COMPLIANCE.md`](./COMPLIANCE.md) before deploying — it lists what this
software does for policy compliance and what it cannot make compliant.

## Architecture

```
Instagram DM ──▶ Meta webhook ──▶ POST /webhook (signature verified)
                                     │
                                     ├─ consentService   opt-out / handoff / 24h window
                                     ├─ pollingService   debounce a burst → one reply
                                     │     ├─ linkService     link only on explicit request
                                     │     └─ aiService       OpenAI-compatible /v1/chat/completions
                                     └─ helpers.sendInstagramMessage
                                           └─ POST graph.instagram.com/<v>/me/messages
```

## Setup

```bash
npm install
cp .env.example .env      # then fill in values
npm run dev
```

### Required configuration

| Var | What |
| --- | --- |
| `IG_APP_ID` / `IG_APP_SECRET` | From your Meta app (Instagram product) |
| `IG_ACCESS_TOKEN` | Long-lived Instagram User token for the connected professional account |
| `WEBHOOK_VERIFY_TOKEN` | Any random string; matches the dashboard webhook config |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | Any OpenAI-compatible provider (OpenAI, Anthropic, OpenRouter, Groq, self-hosted…) |
| `CREATOR_DISPLAY_NAME` | Name shown in the AI disclosure |

See `.env.example` for the full list.

### Meta app dashboard

1. Add the **Instagram** product, connect an Instagram professional account.
2. Webhooks → Instagram → callback `https://<host>/webhook`, verify token = `WEBHOOK_VERIFY_TOKEN`, subscribe to `messages`.
3. Data Deletion Request callback → `https://<host>/webhook/deletion-callback`.
4. Privacy Policy URL → your hosted `/privacy` page (see `../web`).
5. Request only `instagram_business_basic` and `instagram_business_manage_messages`.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /webhook` | Meta webhook verification |
| `POST /webhook` | Inbound messaging events (signature-verified) |
| `POST /webhook/deletion-callback` | Meta `signed_request` data deletion |
| `GET /webhook/data-deletion` | Human-readable deletion info + form |
| `POST /webhook/delete-data` | Self-service deletion (by IGSID) / manual request |
| `GET /health` | Health check |
| `GET /analytics` | Aggregate counters |
| `GET /test-connection` | Verify the Instagram token |

## Conversation rules

| User says | Effect |
| --- | --- |
| first message | reply is prefixed with the AI disclosure |
| `stop`, `unsubscribe` | opted out, bot goes silent, one confirmation |
| `start`, `resume` | opted back in |
| `human`, "are you a bot?" | automation stops, thread flagged for a person |
| "what's your link?", "where do I subscribe?" | sends `SUBSCRIPTION_URL` (or points to bio) |
| anything else, within 24h | AI-generated reply |
| anything, after 24h | no reply |
