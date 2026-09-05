# Compliance notes

This document explains what this software does to stay within the **Instagram
Platform Terms**, the **Meta Platform Terms**, the **Instagram Community
Guidelines**, and consumer-protection rules on AI disclosure. It also states,
plainly, the things this software **cannot make compliant** — those are business
decisions the operator owns.

> This is engineering documentation, not legal advice. Have a lawyer review the
> Privacy Policy, Terms, and your specific use case before launch — especially if
> your audience or linked destinations involve adult or adult-adjacent content.

## What the app does

- Replies **only to direct messages that an Instagram user sends first**
  (user-initiated conversations). There is no cold outreach, no follower
  scraping, no bulk sending.
- Sends every conversation's **first automated reply with a clear AI disclosure**
  (`src/utils/helpers.js` → `disclosureLine()`), and identifies as an AI whenever
  asked (`buildSystemPrompt`).
- Honours **opt-out immediately**: `stop`, `unsubscribe`, "don't message me", etc.
  set a persistent flag and the bot goes silent (`src/services/consentService.js`).
- Honours **human handoff**: `human`, "are you a bot", "real person" stop
  automation and flag the thread for a person.
- Only sends within the **24-hour standard messaging window** measured from the
  user's last message. Outside it, the bot stays silent (no message tags are used
  to circumvent this).
- Shares the operator's link **only when a user explicitly asks** for it
  (`src/services/linkService.js`). Nothing is injected probabilistically.
- Stores the **minimum data**: Instagram-scoped user id, opt-out/handoff flags,
  timestamps, and aggregate counts. Message content is used transiently to
  generate a reply and is not persisted by default.
- Implements **real deletion**: Meta's `signed_request` data-deletion callback
  (`POST /webhook/deletion-callback`), a self-service route, and a `purgeUser()`
  that clears every subsystem.
- **Does not** drive or scrape any third-party AI web UI. The AI backend is a
  normal, authenticated, OpenAI-compatible API you pay for.

## What this software CANNOT make compliant

1. **Promoting adult content or "adult services" through the Instagram API.**
   The Instagram Community Guidelines prohibit sexually explicit content and
   restrict links soliciting adult services, in DMs included. If `SUBSCRIPTION_URL`
   points to a destination that Meta would classify as adult-services
   solicitation, sending it in a DM — even on request, even to a consenting adult
   — can still violate the Platform Terms and get the app and the connected
   account restricted or banned. That risk sits with the operator. Set
   `ALLOW_LINK_ON_REQUEST=false` to have the assistant point users to the profile
   bio instead of sending any link.

2. **Sexually explicit conversation.** The system prompt forbids it and there is
   a content guardrail, but no automated filter is perfect. The operator is
   responsible for what their configured model produces.

3. **Misrepresenting the app during Meta App Review.** App Review submissions
   must accurately describe what the app does and who uses it. Describe it as an
   AI assistant that answers a creator's inbound fan DMs, with disclosure and
   opt-out. Do not describe it as generic "customer support" if that is not the
   real use.

4. **Automation volume / spam.** Keep sends under ~2 messages/second per account
   and never re-engage a user who opted out.

## App Review checklist

- Permissions requested: `instagram_business_basic`,
  `instagram_business_manage_messages`. Request nothing you do not use.
- Provide test credentials + a screencast showing: user DMs first → disclosure
  reply → normal reply → `stop` → silence → `start` → resumes.
- Privacy Policy URL and Data Deletion callback URL configured in the dashboard.
- Explain the AI disclosure and opt-out flow in the notes.

## Relevant sources

- Instagram Platform — Send Messages:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- Messaging window / policy overview:
  https://developers.facebook.com/docs/messenger-platform/instagram/features/messaging
- Instagram Community Guidelines:
  https://help.instagram.com/477434105621119
- Meta Platform Terms: https://developers.facebook.com/terms/
- FTC guidance on AI chatbots and disclosures (US): https://www.ftc.gov/business-guidance
