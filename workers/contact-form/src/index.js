/**
 * Serendevity contact form worker.
 *
 * Pipeline:  Cloudflare Pages (form) → this Worker → Turnstile siteverify
 *            → native Cloudflare Email Service (send_email binding).
 *
 * Zero third-party services. The only external call is Turnstile siteverify,
 * which is Cloudflare itself.
 *
 * Endpoint: POST /api/contact   (accepts JSON or application/x-www-form-urlencoded)
 *
 * Environment:
 *   TURNSTILE_SECRET  (Secret)  – Turnstile widget secret, `wrangler secret put`
 *   TO_EMAIL          (var)     – where messages are delivered
 *   FROM_EMAIL        (var)     – verified sender on serendevity.com
 *   EXPECTED_ACTION   (var)     – Turnstile action, must match the widget
 *   ALLOWED_ORIGINS   (var)     – comma-separated origin allowlist ("*." = subdomains)
 */

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function originAllowed(origin, allowlist) {
  if (!origin) return false;
  const base = origin.replace(/\/+$/, "");
  return allowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern.startsWith("*.")) return base.endsWith(pattern.slice(1));
      return base === pattern;
    });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = { name: 120, company: 120, email: 254, message: 4000 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight for cross-origin previews (same-origin prod calls don't need it,
    // but Pages preview deployments on *.pages.dev are a different origin).
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname !== "/api/contact" || request.method !== "POST") {
      return json({ success: false, error: "Not found." }, 404);
    }

    // CSRF defence: the request must come from a page we serve.
    if (!originAllowed(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) {
      return json({ success: false, error: "Origin not allowed." }, 403);
    }

    // Parse body: JSON (JS-enabled form) or urlencoded (no-JS form).
    const contentType = request.headers.get("Content-Type") || "";
    let data;
    try {
      if (contentType.includes("application/json")) {
        data = await request.json();
      } else {
        data = Object.fromEntries(new URLSearchParams(await request.text()));
      }
    } catch {
      return json({ success: false, error: "Couldn't read the form. Please email us directly." }, 400);
    }

    // Honeypot: bots fill this invisible field. Silently "succeed".
    if (typeof data.company_url === "string" && data.company_url.length > 0) {
      return json({ success: true });
    }

    // Validation
    const name = String(data.name || "").trim();
    const company = String(data.company || "").trim();
    const email = String(data.email || "").trim();
    const message = String(data.message || "").trim();

    const problems = [];
    if (name.length < 1 || name.length > MAX.name) problems.push("A name is required (max 120 chars).");
    if (email.length > MAX.email || !EMAIL_RE.test(email)) problems.push("A valid email address is required.");
    if (message.length < 10 || message.length > MAX.message) problems.push("A message of 10–4000 characters is required.");
    if (problems.length > 0) {
      return json({ success: false, error: problems.join(" ") }, 400);
    }

    // Turnstile server-side verification — fail closed.
    const token = String(data.cf_turnstile_response || "");
    if (token.length === 0 || token.length > 2048) {
      return json({ success: false, error: "Please complete the friendly robot check and try again." }, 403);
    }
    let verdict;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      });
      if (!res.ok) throw new Error(`siteverify ${res.status}`);
      verdict = await res.json();
    } catch {
      return json({ success: false, error: "Verification hiccup — please try again." }, 503);
    }
    if (
      !verdict.success ||
      (env.EXPECTED_ACTION && verdict.action !== env.EXPECTED_ACTION) ||
      verdict.hostname !== "serendevity.com" && !(env.ALLOWED_ORIGINS.includes("*.pages.dev") && verdict.hostname.endsWith(".pages.dev"))
    ) {
      return json({ success: false, error: "Robot check failed. Please try the checkbox again." }, 403);
    }

    // Send the email via Cloudflare Email Service — no SMTP, no third party.
    const subject = company ? `[Serendevity] ${name} — ${company}` : `[Serendevity] ${name}`;
    const text =
      `New contact form message\n\n` +
      `Name:    ${name}\n` +
      `Company: ${company || "—"}\n` +
      `Email:   ${email}\n\n` +
      `Message:\n${message}\n`;
    const html =
      `<p><strong>New contact form message</strong></p>` +
      `<table cellpadding="4">` +
      `<tr><td><b>Name</b></td><td>${escapeHtml(name)}</td></tr>` +
      `<tr><td><b>Company</b></td><td>${escapeHtml(company || "—")}</td></tr>` +
      `<tr><td><b>Email</b></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>` +
      `</table>` +
      `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;

    let sent;
    try {
      sent = await env.EMAIL.send({
        to: env.TO_EMAIL,
        from: { email: env.FROM_EMAIL, name: "Serendevity website" },
        replyTo: email,
        subject,
        text,
        html,
      });
    } catch (err) {
      console.error("email error code=", err && err.code, err && err.message);
      const friendly = {
        E_SENDER_NOT_VERIFIED: "Sender domain not verified in Cloudflare Email Service. See workers/contact-form/README.md.",
        E_RATE_LIMIT_EXCEEDED: "Rate limit reached — please email us directly.",
        E_DAILY_LIMIT_EXCEEDED: "Daily limit reached — please email us directly.",
      };
      return json(
        { success: false, error: friendly[err && err.code] || "Delivery hiccup — please email us directly." },
        err && err.code === "E_RATE_LIMIT_EXCEEDED" ? 429 : 502
      );
    }

    console.log("message delivered", sent && sent.messageId);
    return json({ success: true });
  },
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}