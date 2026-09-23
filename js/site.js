/* Serendevity — site.js
 * Small, dependency-free. Everything here is progressive enhancement:
 * without JS the site is fully readable and navigable.
 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ----- Scroll reveal (CSS transitions; respects reduced motion) ----- */
  var prefersReduced = false;
  try {
    prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* old browsers */ }

  if (!prefersReduced && "IntersectionObserver" in window) {
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      reveals.forEach(function (el) { io.observe(el); });
      /* Safety net: if anything is still hidden shortly after load (e.g. an
         observer edge case), reveal it rather than leaving the page blank. */
      window.setTimeout(function () {
        reveals.forEach(function (el) { el.classList.add("in-view"); });
      }, 4000);
    }
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  /* ----- Current year in footers ----- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----- Turnstile: load the widget only when the visitor engages with the form ----- */
  var widget = document.querySelector(".cf-turnstile");
  if (widget) {
    var form = document.getElementById("contact-form");
    var loaded = false;
    function loadTurnstile() {
      if (loaded) return;
      loaded = true;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    if (form) {
      ["pointerdown", "focusin", "keydown"].forEach(function (ev) {
        form.addEventListener(ev, loadTurnstile, { passive: true });
      });
    } else {
      loadTurnstile();
    }
  }

  /* ----- Contact form ----- */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    var errorBox = document.getElementById("form-error");
    var successBox = document.getElementById("form-success");
    var submitBtn = contactForm.querySelector('button[type="submit"]');

    function showError(msg) {
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.style.display = "block";
      }
      if (successBox) successBox.style.display = "none";
    }
    function showSuccess() {
      if (errorBox) errorBox.style.display = "none";
      if (successBox) successBox.style.display = "block";
    }

    contactForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (errorBox) errorBox.style.display = "none";

      var tokenInput = document.querySelector('input[name="cf-turnstile-response"]');
      var cfToken = tokenInput ? tokenInput.value : "";

      var data = {
        name: document.getElementById("f-name").value.trim(),
        company: document.getElementById("f-company").value.trim(),
        email: document.getElementById("f-email").value.trim(),
        message: document.getElementById("f-message").value.trim(),
        company_url: document.getElementById("f-company-url").value.trim(),
        cf_turnstile_response: cfToken
      };

      if (submitBtn) submitBtn.disabled = true;

      fetch(contactForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "same-origin"
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (res.ok && body.success) {
              showSuccess();
              contactForm.reset();
            } else {
              showError((body && body.error) || "Something went sideways. Please email us directly — contact@serendevity.com.");
            }
          });
        })
        .catch(function () {
          showError("Couldn't reach the server. Please email us directly — contact@serendevity.com.");
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();