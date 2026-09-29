/* Serendevity — site.js
 * Small, dependency-free. Everything here is progressive enhancement:
 * without JS the site is fully readable and navigable, and the contact
 * form still submits (Formspree's confirmation screen).
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
      /* Safety net: never leave anything stuck hidden. */
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

  /* ----- Contact form: AJAX to Formspree, inline feedback ----- */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    var FORMSPREE_ENDPOINT = "https://formspree.io/f/mdekblnk"; // set at deploy
    var errorBox = document.getElementById("form-error");
    var successBox = document.getElementById("form-success");
    var submitBtn = contactForm.querySelector('button[type="submit"]');

    function showError(msg) {
      if (errorBox) { errorBox.textContent = msg; errorBox.style.display = "block"; }
      if (successBox) successBox.style.display = "none";
    }
    function showSuccess() {
      if (errorBox) errorBox.style.display = "none";
      if (successBox) successBox.style.display = "block";
    }

    contactForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (errorBox) errorBox.style.display = "none";

      var data = {
        name: document.getElementById("f-name").value.trim(),
        company: document.getElementById("f-company").value.trim(),
        email: document.getElementById("f-email").value.trim(),
        message: document.getElementById("f-message").value.trim(),
        _gotcha: document.getElementById("f-gotcha").value.trim()
      };

      /* Honeypot trip: pretend success, do nothing. */
      if (data._gotcha) { showSuccess(); contactForm.reset(); return; }

      if (submitBtn) submitBtn.disabled = true;

      fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (res.ok) {
              showSuccess();
              contactForm.reset();
            } else {
              showError((body && body.errors && body.errors[0] && body.errors[0].message) ||
                "Hmm, that didn't go through. Please email us directly — contact@serendevity.com.");
            }
          });
        })
        .catch(function () {
          showError("Couldn't reach the form service. Please email us directly — contact@serendevity.com.");
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();