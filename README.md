# Serendevity

Static website for **Serendevity** — custom software & consulting,
Mississauga, ON (Greater Toronto Area).

Pure hand-written HTML5 + CSS + ~1KB of JS. No framework, no build step,
no dependencies. Served by **Cloudflare Pages**; a small **Cloudflare Worker**
handles the contact form with Turnstile + native Email Service.

## Structure

```
├── index.html            Home (about, services, mantra, process, truths)
├── contact.html          Contact form → /api/contact Worker + map
├── 404.html              Friendly not-found
├── css/styles.css        Design-system source (self-hosted Geist type)
├── css/styles.min.css    Minified, generated — what the pages actually load
│                         (regenerate after edits: python3 scripts/minify-css.py)
├── js/site.js            Year, form submit, lazy Turnstile
├── fonts/geist/          Geist woff2 subsets (OFL) — 100% self-hosted
├── img/                  logo, mantra, CC Toronto photo (+ webp variants)
├── img/CREDITS.md        Image licenses & attributions (Creative Commons)
├── robots.txt            All crawlers (incl. AI) explicitly allowed
├── llms.txt / llms-full.txt   LLM-discoverable summaries
├── humans.txt / .well-known/security.txt
├── sitemap.xml
├── favicon.svg / apple-touch-icon.png / icon-192.png
├── _headers              Security headers, CSP, cache policy
├── _redirects            Old Netlify-era URLs → new home
├── scripts/              serve-live.py (local), minify-css.py
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
python3 scripts/minify-css.py     # after editing css/styles.css
```

## Deploy checklist (Cloudflare Pages)

1. This repo is connected to Cloudflare Pages.
   Build command: **none** · Output directory: **`/`** (there is no build).
2. Attach the custom domain **`serendevity.com`** in Pages → Custom domains.
   Cloudflare auto-creates the DNS records (CNAME flattening for the apex).
   If anything already points at Netlify (an A record with Netlify IPs, or a
   CNAME to `*.netlify.app`), delete it first — don't point two hosts at once.
3. Add a redirect rule so `www.serendevity.com` → `https://serendevity.com`
   (301, "www to apex", preserve path). Do it in Rules → Redirect Rules, not
   in `_redirects` (that file only covers same-host paths).
4. Deploy the Worker and configure Turnstile + Email Service —
   see `workers/contact-form/README.md`.
5. Optional, privacy-friendly analytics: Cloudflare Web Analytics
   (dashboard → Analytics → Web Analytics → measurement site). It is
   cookieless and JS-beacon-based; the CSP already allows its domain.

### Disconnecting Netlify (do this so the old site stops auto-deploying)

- Netlify dashboard → your site → **Site configuration → Build & deploy** →
  pause or delete the site, and remove the GitHub integration.
- Cloudflare dashboard → DNS → remove any Netlify records (A records pointing
  to Netlify IPs, or a CNAME to `*.netlify.app`).
- GitHub → repo → Settings → Integrations → Netlify: remove.
- After migration: `curl -I https://serendevity.com` should show
  `server: cloudflare` and the old Netlify headers should be gone.

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