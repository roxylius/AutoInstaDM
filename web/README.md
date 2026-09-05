# AutoInstaDM landing site

Static site: landing page + Privacy Policy + Terms of Service. Plain HTML/CSS, no
build step.

## Before you deploy — replace the placeholders

Search all three HTML files for these and replace every occurrence:

| Placeholder | Replace with |
| --- | --- |
| `REPLACE_WITH_YOUR_CONTACT_EMAIL` | your real support/legal email |
| `[Company Legal Name]` | your registered business or personal name |
| `[Registered Address]` | your legal address |
| `[Contact Email]` | same as the email above (display form) |
| `[Jurisdiction]` / `[Venue]` | the governing-law location for your Terms |
| `[30]` / `[45]` day retention numbers | your actual retention periods (must match `LOG_RETENTION_DAYS`) |

```bash
cd web
grep -rn "REPLACE_WITH_YOUR_CONTACT_EMAIL\|\[Company Legal Name\]\|\[Jurisdiction\]" .
```

> The Privacy Policy and Terms are drafts to start from, **not legal advice**.
> Have a lawyer review them before launch — especially given an adult-adjacent
> audience, where platform and payment-processor rules are stricter.

## Deploy to Vercel (you do this — it needs your account)

1. Create a Vercel account and install the CLI: `npm i -g vercel`
2. From this `web/` directory: `vercel` (first run links/creates the project), then `vercel --prod`
3. Or: push the repo to GitHub and "Import Project" in the Vercel dashboard, setting the **Root Directory** to `Instagram DM Automation/web`.

No environment variables or framework preset are needed — it's a static site.

Pages: `/` · `/privacy` · `/terms` · `/data-deletion`

## After deploying — Meta app dashboard

- **Privacy Policy URL** → `https://<your-domain>/privacy`
- **Data Deletion Instructions URL** → `https://<your-domain>/data-deletion`
- **Data Deletion Request (callback) URL** → `https://<app-host>/webhook/deletion-callback`
  — this one lives on the *app server*, not this static site.
