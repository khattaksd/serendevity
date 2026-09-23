# Serendevity

Static website for **Serendevity** — custom software & consulting,
Canada (Mississauga, ON).

Pure hand-written HTML5 + CSS + ~1KB of JS. No framework, no build step,
no dependencies. Served by **Cloudflare Pages**; a small **Cloudflare Worker**
handles the contact form with Turnstile + native Email Service.

## Structure

```
├── index.html            Home (about, services, mantra, process, truths)
├── contact.html          Contact form → /api/contact Worker + map
├── 404.html              Friendly not-found
├── css/styles.css        The whole design system (self-hosted Geist type)
├── js/site.js            Year, form submit, lazy Turnstile
├── fonts/geist/          Geist woff2 subsets (OFL) — 100% self-hosted
├── img/                  logo, mantra, CC skyline photo (+ webp variants)
├── img/CREDITS.md        Image licenses & attributions (Creative Commons)
├── robots.txt            All crawlers (incl. AI) explicitly allowed
├── llms.txt / llms-full.txt   LLM-discoverable summaries
├── humans.txt / .well-known/security.txt
├── sitemap.xml
├── favicon.svg / apple-touch-icon.png / icon-192.png
├── _headers              Security headers, CSP, cache policy
├── _redirects            Old Netlify-era URLs → new home
├── scripts/              serve-live.py (local dev server)
└── workers/contact-form/ The form Worker (see its README)
```

## Local development

```sh
python3 -m http.server 8000      # no build step — it just works
```

Install the CLI validators used during development:

```sh
npm i -g html-validate            # npx html-validate index.html contact.html 404.html
npm i -g lighthouse               # lighthouse http://localhost:8123/index.html --view=render
python3 scripts/serve-live.py     # local server with gzip + cache (mimics Cloudflare)

> CSS is served as-is (no minifier): Cloudflare Pages' Brotli compression already
> handles transfer size, and Lighthouse's unminified-css check passes under
> compressed serving (verified 4×100 with the pretty file).
```

## Deployment

Follow **`DEPLOY.md`** — the full, ordered runbook. Summary:

1. **Phase 0 — decouple Netlify first** (disconnect GitHub auto-deploy on
   Netlify + GitHub, pause the site — it keeps serving as a static snapshot,
   so the domain stays up until you flip it).
2. **Phase 1 — branch** — this repo's default is `master` (not `main`);
   merge `rebuild` → `master` and deploy Pages from `master`.
3. **Phases 2–3 — Cloudflare Pages** — import repo (no build command, output
   dir `/`), attach `serendevity.com`, add a 301 `www → apex` redirect rule.
4. **Phase 4 — form** — Turnstile widget + real sitekey in `contact.html`,
   Email Service verification, then `wrangler deploy --route "serendevity.com/api/*"`
   (details in `workers/contact-form/README.md`).
5. **Phase 5 — delete Netlify** only after Cloudflare is verified live.

Verification commands and rollback notes are all in `DEPLOY.md`.

## Validation targets

- HTML5: `npx html-validate index.html contact.html 404.html` + manual W3C Nu check.
- Lighthouse: 4×100 on the deployed site (verified locally: Home, Contact, and 404 each
  score 100 in accessibility / best-practices / SEO, performance 100 on Home & Contact
  with compression+cache headers — see `scripts/serve-live.py`; final numbers after
  deploy on real CDN).
- Contrast: all body text pairs ≥ 4.5:1 (see tokens in `css/styles.css`).

## License

Code © Serendevity (MIT). Photographs CC0 / CC BY-SA as credited in
`img/CREDITS.md`. Typeface Geist © Vercel under OFL-1.1.