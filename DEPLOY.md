# Serendevity — deployment runbook (Cloudflare Pages)

Everything the site needs to go from this repo to https://serendevity.com.
Do the phases in order. Commands tagged `[you]` need your Cloudflare/GitHub
sessions; the rest are notes/verification.

**Branch note:** the repo's single branch is **`main`** — deploy Pages from `main`.

## Phase 0 · Decouple Netlify (do FIRST — before any Cloudflare move)

Goal: Netlify can no longer auto-deploy or auto-pull from GitHub, and has no
claim on the domain. **Recommended order keeps the old site up with zero
downtime** — unlink first, delete only after Cloudflare is live.

1. `[you]` **Stop Git deploys — Netlify side:**
   - Netlify → your site → **Site configuration → Build & deploy →
     Continuous deployment → GitHub** → *Disconnect from GitHub*.
   - Also delete any **Deploy hooks** and **Build triggers** on the same page.
2. `[you]` **Stop Git integration — GitHub side:**
   - GitHub → repo → **Settings → Integrations → Applications** → remove **Netlify**.
   - (Optional belt-and-braces) GitHub → repo → **Settings → Webhooks** →
     delete any `netlify` webhook.
3. `[you]` **Pause the Netlify site** (keeps the current build up as a static
   snapshot): Netlify → **Site configuration → Build & deploy** → *Pause deploys*.
   - The site keeps serving; it just can't change. DNS still points at it
     until Phase 3 flips to Cloudflare — **no downtime**.
4. **Verify from a terminal (no auth needed):**
   ```sh
   git ls-remote https://github.com/khattaksd/serendevity.git   # repo is just a repo again
   curl -sI https://serendevity.com | grep -i server            # expect: server: Netlify (old site, but paused)
   ```
   Push a trivial commit later and confirm nothing deploys to Netlify (no
   deploy notifications, `netlify` webhook gone).
5. `[you]` **Only after Phase 4 passes** (Pages serving the apex): Netlify →
   **Delete site** (Settings → Danger zone). Deletion stops the paused site.

> Downtime-only alternative (if you'd rather delete Netlify before touching
> Cloudflare): do steps 3+5 together now and accept the site being down until
> Phase 3. Not recommended, but that's the ordering you explicitly asked for
> is one you can take — just schedule Phases 1–3 in the same hour.

## Phase 1 · Branch

1. Ensure local `main` is at the tip you intend to deploy:
   `git checkout main && git pull origin main`.
2. `git ls-remote origin main` — confirm the tip matches local.

## Phase 2 · Create the Cloudflare Pages project `[you]`

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Import repository**
2. Connect the GitHub repo. Build settings:
   - **Production branch:** `main`
   - **Build command:** *(leave empty — there is no build)*
   - **Build output directory:** `/`
   - Deploy. Project URL: `https://<project>.pages.dev` — sanity-check
     Home + Contact + 404 there before touching the domain.

   ⚠️ **Common pitfall — the “Deploy with wrangler” box in the dashboard.**
   Leave the build command **empty**. If you set it to `npx wrangler deploy`,
   wrangler runs *inside* the Pages build and deploys the repo as a
   **Static-Assets Worker** instead (the log shows a `*.workers.dev` URL and
   `.git/` files in the asset list). If that happened:
   1. Delete the stray worker: Workers & Pages → the `*.workers.dev`
      deployment → **Manage → Delete** (it currently serves the whole repo).
   2. Pages project → **Settings → Builds & deployments → Build command** →
      clear it → Save.
   3. **Redeploy** → the correct deploy shows only site files (no `.git`
      entries), and Pages' `_headers`/`_redirects` features apply.
   `wrangler` is only ever used from `workers/contact-form/` to deploy the
   `/api/*` Worker — never as a Pages build command.

## Phase 3 · Custom domain (this is the DNS flip)

1. Cloudflare Pages → project → **Custom domains → Set up a custom domain** →
   `serendevity.com`. Cloudflare auto-creates the records.
   If it reports conflicting records, remove the Netlify records first
   (step 4 below — should already be gone after Phase 0).
2. **Redirect www → apex** (301, preserve path):
   Cloudflare dashboard → **Rules → Redirect Rules → Create**:
   - When: *Hostname equals* `www.serendevity.com`
   - Then: *Dynamic redirect* → `https://serendevity.com${path}`
   - Status: 301
3. DNS records to confirm in Cloudflare → **DNS → Records**:
   - `serendevity.com` → CNAME flattened to the Pages project (auto)
   - `www.serendevity.com` → Points where the redirect rule can catch it
     (set to the same Pages project or a proxy'd record)
   - No A records with Netlify IPs (`75.2.60.x`, `185.199.108.x`,
     `199.36.162.x`) and no CNAME to `*.netlify.app`.
4. Verify:
   ```sh
   curl -sI https://serendevity.com | grep -i server     # server: cloudflare
   curl -sI https://www.serendevity.com | head -5        # 301 → serendevity.com
   curl -sI https://serendevity.com/img/logo.png | grep -i cache-control  # immutable
   curl -sI https://serendevity.com | grep -i content-security-policy    # CSP applied
   ```

## Phase 4 · Contact form: Worker + Turnstile + Email Service `[you]`

Follow **`workers/contact-form/README.md`**:

1. Create the **Turnstile widget** (name `serendevity-contact`, hosts
   `serendevity.com` + `www.serendevity.com`). Copy the **Site Key** and **Secret**.
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

## Phase 5 · Delete Netlify (final cleanup)

Only once Phase 3 is verified green: Netlify → **Site configuration →
Danger zone → Delete site**. This is the last Netlify step; the paused
snapshot disappears.

## Phase 6 · Finish line

- Hard-refresh the site: hero, mantra, process, contact form, 404.
- Run Lighthouse against the live URL:
  `npx lighthouse https://serendevity.com/ --view=render`
  — targets: 100s (locally verified 100/100/100/100 on Home & Contact;
  404 is a real 404 by design).
- Optional, privacy-friendly analytics:
  Cloudflare dashboard → **Analytics → Web Analytics** → add measurement
  site. Its JS beacon is already allowed by the CSP
  (`static.cloudflareinsights.com`); nothing to change in code.

## Rollback

- Pages has instant production rollbacks (**Deployments → … → Rollback**).
- Until Phase 5, you still have the Netlify paused snapshot; re-pointing DNS
  at Netlify (re-adding its records) restores the old site.