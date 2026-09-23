# Serendevity contact form — Cloudflare Worker

The contact form on `/contact` posts to `POST /api/contact`, handled by this
Worker. It verifies a Turnstile token and delivers email **natively via
Cloudflare Email Service** — no third-party form handler, no SMTP provider.

## One-time setup (Cloudflare dashboard)

1. **Turnstile widget** — https://dash.cloudflare.com → Turnstile → "Add widget".
   - Name: `serendevity-contact`
   - Hostnames: `serendevity.com` and `www.serendevity.com` (optionally add `*.serendevity.pages.dev` for previews)
   - Mode: Managed
   - Keep the **Site Key** and **Secret**.
2. **Put the sitekey in the page** — edit `/contact.html` (repo root), replace the
   test sitekey in the `.cf-turnstile` element:
   ```html
   <div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY" data-action="serendevity_contact" ...>
   ```
   (The placeholder `1x00000000000000000000AA` is Turnstile's public *test*
   key — always passes, fine for local dev.)
3. **Enable Email Service** — https://dash.cloudflare.com → Email → "Send email"
   (public beta). Add `serendevity.com`, verify it, and add the records
   Cloudflare asks for (SPF/DKIM/DMARC). Set a *verified sender* equal to
   `FROM_EMAIL` in `wrangler.toml` (e.g. `hello@serendevity.com`).

## Deploy

```sh
cd workers/contact-form
npm i -g wrangler || true          # or: npx wrangler ...
wrangler login

# Secrets (the secret is never stored in the repo):
wrangler secret put TURNSTILE_SECRET          # paste the widget SECRET

wrangler deploy
```

Then attach the route to the apex domain (Cloudflare Pages serves everything
else on the same host; the Worker route wins for `/api/*`):

```sh
wrangler deploy --route "serendevity.com/api/*"
```

## Test

```sh
# simulate the page origin
curl -i -X POST https://serendevity.com/api/contact \
  -H "Origin: https://serendevity.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"you@example.com","message":"Hello from the curl test!","cf_turnstile_response":"<token from a live widget>"}'
```

A valid Turnstile token requires completing the widget in a real browser, so
the honest end-to-end test is: open `/contact`, click the form, tick the
checkbox, send. You should receive the email at `TO_EMAIL`.

If you get `E_SENDER_NOT_VERIFIED`, your sender domain/address isn't verified
in Email Service yet (step 3 above).