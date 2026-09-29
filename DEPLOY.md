# Serendevity — deployment runbook

Everything the site needs to stay live at https://serendevity.com.
The site is a **Workers static-assets project** (the current unified model —
Cloudflare Pages is now part of Cloudflare Workers), deployed purely from the
CLI. **No Worker/API code ships for the form** — the contact form posts to
Formspree, which emails the owner directly; all @serendevity.com mail is
forwarded to Gmail by Cloudflare Email Routing.

## Deploy the site

Prereqs: `npx wrangler whoami` shows your account (else `npx wrangler login`).

```sh
# one-time: create the project (production branch bound to 'main')
npx wrangler pages project create serendevity --production-branch main

# every publish
cd /home/sdk/code/serendevity
npx wrangler deploy
```

- `wrangler.jsonc` (root): `name: serendevity`, `assets.directory: "."`,
  `assets.not_found_handling: "404-page"`.
- `.assetsignore`: `.git`, docs, `scripts/` stay off the public tree.
- `_headers` (CSP, cache, security) + `_redirects` apply natively.
- Staging URL: `https://serendevity.khtk.workers.dev` (shown in deploy output).

Sanity suite after every deploy:

```sh
B=https://serendevity.com
curl -sI $B/ | grep -i content-security-policy      # CSP from _headers
curl -s -o /dev/null -w "%{http_code}\n" $B/blog/   # 301 (from _redirects)
curl -s $B/not-a-page | grep "wandered off"          # custom 404
curl -s -o /dev/null -w "%{http_code}\n" $B/.git/config   # MUST be 404
curl -s -o /dev/null -w "%{http_code}\n" $B/contact/      # 200, form live
```

## Contact form → Formspree

The form at `/contact/` submits to a Formspree endpoint (AJAX via `js/site.js`
for inline success/error; native POST works too, with no JS).

1. `[you]` https://formspree.io → new form → destination `khattaksd@gmail.com`.
2. `[you]` Paste the endpoint (form id) to the project owner, or edit yourself:
   - `js/site.js` → `FORMSPREE_ENDPOINT`
   - `contact/index.html` → `form action`
3. Redeploy (`npx wrangler deploy`), then submit the form once; the email
   should land in Gmail seconds later.
4. Free tier: 50 submissions/month — fine for a consulting site. Spam is
   handled Formspree-side (our honeypot `_gotcha` field included).

## Email Routing (@serendevity.com → Gmail) `[you]`

1. Cloudflare dashboard → **Email → Email Routing → Enable** (Cloudflare
   auto-adds the MX + SPF TXT records for the zone).
2. **Destination addresses** → add `khattaksd@gmail.com` → verify the code
   emailed to you.
3. **Routing rules** → rule `*` (catch-all) → forward to that address.
4. Test: send a mail to `anything@serendevity.com` → lands in Gmail.
   `contact@serendevity.com` then works forever with zero maintenance.
   (Inbound-only — nothing ever sends as @serendevity.com.)

## Domain

Already done: apex custom domain on the Worker, `www → apex` 301 Redirect
Rule, TLS automatic. Verify:

```sh
curl -sI https://serendevity.com | grep -i server        # cloudflare
curl -sI https://www.serendevity.com | grep -i location  # 301 → apex
```

## Gotchas

- Never set `npx wrangler deploy` as a Git-connected Pages build command.
- Always keep `**/.git` in `.assetsignore` — without it, wrangler uploads
  your entire `.git/` folder as public assets.
- The former `/api/*` Worker + Turnstile + Email-Service plan is gone; don't
  re-add it — Formspree + Email Routing covers everything with less moving
  parts.