# Serendevity — deployment runbook (Cloudflare Pages)

Everything the site needs to go from this repo to https://serendevity.com.
Do the steps in order. Commands tagged `[you]` need your Cloudflare/GitHub
sessions; the rest are notes/verification.

## 0 · Prerequisites (one-time)

- This repo pushed to GitHub (current working branch: `rebuild`; deploy from
  `main` or `rebuild` — your call, just be consistent).
- Domain `serendevity.com` DNS is on Cloudflare (already done).
- Netlify still serving the old site (to be removed in step 4 — until then
  the domain points at Netlify, so do step 4 in one sitting).

## 1 · Create the Cloudflare Pages project `[you]`

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Import repository**
2. Connect the GitHub repo. Build settings:
   - **Build command:** *(leave empty — there is no build)*
   - **Build output directory:** `/`
   - Deploy.
3. Project URL will be `https://<project>.pages.dev` — that's stage one.
   Open it and sanity-check Home + Contact + 404, then:

## 2 · Custom domain

1. Cloudflare Pages → project → **Custom domains → Set up a custom domain** →
   `serendevity.com`
2. Cloudflare auto-creates the DNS records (CNAME flattening for the apex).
   If the dashboard reports conflicting records (see step 4), fix DNS there.
3. **Redirect www → apex** (301, preserve path):
   Cloudflare dashboard → **Rules → Redirect Rules → Create**:
   - When: *Hostname equals* `www.serendevity.com`
   - Then: *Dynamic redirect* → `https://serendevity.com${path}`
   - Status: 301
4. Verify: `curl -I https://serendevity.com` → expect `HTTP/2 200`,
   and `curl -I https://www.serendevity.com` → `301` to the apex.

## 3 · Contact form: Worker + Turnstile + Email Service `[you]`

Follow **`workers/contact-form/README.md`**:

1. Create the **Turnstile widget** (name `serendevity-contact`, hosts
   `serendevity.com` + `www.serendevity.com`). Copy the **Site Key** and
   **Secret**.
2. Put the real Site Key into `contact.html` (the `.cf-turnstile` div,
   `data-sitekey="…"` — currently Turnstile's public *test* key).
3. Enable **Email → Send email** (public beta), add `serendevity.com`,
   verify it, add SPF/DKIM records Cloudflare provides. Set a verified
   sender matching `FROM_EMAIL` in `wrangler.toml`.
4. `cd workers/contact-form && wrangler login`
5. `wrangler secret put TURNSTILE_SECRET` (paste the Secret)
6. `wrangler deploy --route "serendevity.com/api/*"` — the Worker takes
   `/api/*`; Pages serves everything else on the same host.
7. End-to-end test: open `/contact`, click the form (widget lazy-loads),
   tick the checkbox, send → email arrives at `TO_EMAIL`.

## 4 · Netlify teardown (do the same hour as step 2)

1. Netlify dashboard → site → **Site configuration → Build & deploy** →
   *Pause deploys* (then delete the site once confirmed).
2. GitHub → repo → **Settings → Integrations** → remove Netlify (stops
   auto-deploys).
3. Cloudflare dashboard → **DNS → Records**: remove any record pointing at
   Netlify:
   - A records with Netlify IPs (`75.2.60.x`, `185.199.108.x`, `199.36.162.x`…)
   - a CNAME to `*.netlify.app`
   The Pages custom-domain records (step 2) must be the only ones for
   `serendevity.com` / `www.serendevity.com`.
4. Verify `curl -I https://serendevity.com` → `server: cloudflare` and no
   `x-nf-request-id`-style headers.

## 5 · Finish line

- Hard-refresh the site: hero, mantra, process, contact form, 404.
- Run Lighthouse (desktop + mobile) against the live URL:
  `npx lighthouse https://serendevity.com/ --view=render`
  — targets: 100s. The local suite already scored 100/100/100/100 on
  Home/Contact and 100s except perf on 404 (which is a real 404 by design).
- Optional, privacy-friendly analytics:
  Cloudflare dashboard → **Analytics → Web Analytics** → add measurement
  site. Its JS beacon is already allowed by the CSP
  (`static.cloudflareinsights.com`); nothing to change in code.

## Rollback

- Pages has instant preview per commit and instant production rollbacks in
  the dashboard (**Deployments → … → Rollback**).
- The old Netlify site remains available until you delete it — DNS flip back
  is just re-adding Netlify's records if anything goes sideways.