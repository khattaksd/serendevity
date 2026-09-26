# Serendevity — deployment runbook (Cloudflare Workers static assets)

Everything the site needs to go from this repo to https://serendevity.com.
The site is a **Workers static-assets project** (the current unified model —
Cloudflare Pages is now part of Cloudflare Workers) deployed purely from the
CLI with Wrangler. No GitHub↔Cloudflare integration, no build step.

## Deploy the site

Prereqs: `wrangler` auth (`npx wrangler whoami` → your account; otherwise
`npx wrangler login`).

```sh
# one-time: create the project (production branch bound to 'main')
npx wrangler pages project create serendevity --production-branch main

# every publish — point, shoot, verify:
cd /home/sdk/code/serendevity
npx wrangler deploy                 # uploads static assets per wrangler.jsonc
```

- `wrangler.jsonc` (repo root): `name: serendevity`, `assets.directory: "."`,
  `assets.not_found_handling: "404-page"`.
- `.assetsignore` keeps `.git`, docs, `workers/`, `scripts/` off the public
  tree (Workers assets do **not** auto-exclude `.git` — the patterns there
  are required).
- `_headers` (CSP, cache, security) and `_redirects` are applied natively.
- Staging URL while developing: `https://serendevity.<subdomain>.workers.dev`
  (shown in the deploy output; yours is `khtk`).

Quick sanity suite after every deploy:

```sh
B=https://serendevity.khtk.workers.dev   # or the apex once attached
curl -sI $B/ | grep -i content-security-policy     # CSP from _headers
curl -s -o /dev/null -w "%{http_code}\n" $B/blog/  # 301 (from _redirects)
curl -s $B/not-a-page | grep "wandered off"        # custom 404
curl -s -o /dev/null -w "%{http_code}\n" $B/.git/config   # MUST be 404
```

## Attach the domain

1. DNS for `serendevity.com` must be on Cloudflare (it is) and any Netlify
   records removed: Cloudflare → **DNS → Records** — delete A records with
   Netlify IPs (`75.2.60.x`, `185.199.108.x`, `199.36.162.x`) or a CNAME to
   `*.netlify.app`.
2. Workers & Pages (or Workers) → **serendevity → Settings → Domains &
   Routes → Add custom domain**: `serendevity.com`. Cloudflare creates the
   DNS record + TLS cert automatically.
3. Redirect `www` → apex (301, preserve path): Cloudflare dashboard →
   **Rules → Redirect Rules → Create** — *Hostname equals*
   `www.serendevity.com` → *Dynamic redirect* to
   `https://serendevity.com${path}`.
4. Verify: `curl -sI https://serendevity.com | grep -i server` → cloudflare;
   `curl -sI https://www.serendevity.com` → 301.

## Contact form: the /api/* Worker

Separate Worker in `workers/contact-form/` — follow its README:
1. Create the Turnstile widget (hosts `serendevity.com` + `www.serendevity.com`);
   put the Site Key in `contact.html` (`data-sitekey`).
2. Enable **Email → Send email** (beta), verify `serendevity.com`, add the
   SPF/DKIM records Cloudflare provides; set a verified sender matching
   `FROM_EMAIL` in `workers/contact-form/wrangler.toml`.
3. `cd workers/contact-form && wrangler login`
4. `wrangler secret put TURNSTILE_SECRET`
5. `wrangler deploy --route "serendevity.com/api/*"` — route precedence
   sends `/api/*` to this Worker; the site Worker handles everything else.
6. Test end-to-end from `/contact` (widget lazy-loads; checkbox; email lands
   in `TO_EMAIL`).

## Netlify

Already decoupled: GitHub auto-deploy webhook deleted, site paused. Final
step only: Netlify dashboard → **Delete site** (after apex is verified on
Cloudflare).

## Rollback

`wrangler versions list` / the dashboard: Workers has version history —
**Workers → serendevity → Deployments → … → Rollback**.

## Gotcha log

- Never set `npx wrangler deploy` as a Pages/Git build command — it deploys
  the repo as a Worker *during* the build.
- Always keep the `.assetsignore` `**/.git` entries — without them wrangler
  uploads your entire `.git/` directory as public assets.