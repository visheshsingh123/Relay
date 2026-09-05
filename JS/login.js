/* ==========================================================================
   Relay — Login Page Logic
   Client-side validation + a simulated auth call. Swap handleLogin()
   for a real Supabase Auth signInWithPassword() call later.
   ========================================================================== */

(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailField = emailInput.closest(".field");
  const passwordField = passwordInput.closest(".field");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("loginSubmit");
  const submitLabel = submitBtn.querySelector(".auth-submit__label");
  const togglePasswordBtn = document.getElementById("togglePassword");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

  /* ---------------------------------------------------------------------
     Password visibility toggle
     --------------------------------------------------------------------- */
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.setAttribute("aria-pressed", String(isPassword));
    togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

    const eyeOpen = togglePasswordBtn.querySelectorAll(".eye-open");
    const eyeClosed = togglePasswordBtn.querySelector(".eye-closed");
    eyeOpen.forEach((el) => (el.style.display = isPassword ? "none" : ""));
    eyeClosed.style.display = isPassword ? "" : "none";
  });

  /* ---------------------------------------------------------------------
     Field-level validation, cleared as the person corrects input
     --------------------------------------------------------------------- */
  function setFieldError(field, errorEl, message) {
    field.classList.add("has-error");
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearFieldError(field, errorEl) {
    field.classList.remove("has-error");
    errorEl.hidden = true;
  }

  emailInput.addEventListener("input", () => clearFieldError(emailField, emailError));
  passwordInput.addEventListener("input", () => clearFieldError(passwordField, passwordError));

  function validate() {
    let isValid = true;

    if (!EMAIL_RE.test(emailInput.value.trim()) && !USERNAME_RE.test(emailInput.value.trim())) {
      setFieldError(emailField, emailError, "Enter a valid email or username.");
      isValid = false;
    } else {
      clearFieldError(emailField, emailError);
    }

    if (passwordInput.value.length < 8) {
      setFieldError(passwordField, passwordError, "Password must be at least 8 characters.");
      isValid = false;
    } else {
      clearFieldError(passwordField, passwordError);
    }

    return isValid;
  }

  /* ---------------------------------------------------------------------
     Submit: simulated auth call
     --------------------------------------------------------------------- */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);

    if (isLoading) {
      submitLabel.textContent = "Logging in…";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      submitBtn.prepend(spinner);
    } else {
      submitLabel.textContent = "Log in";
      const spinner = submitBtn.querySelector(".spinner");
      if (spinner) spinner.remove();
    }
  }

  function hideFormError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  // Demo-only credential check. Replace with a real request, e.g.:
  //   await supabase.auth.signInWithPassword({ email, password })
  function fakeAuthRequest(email, password) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (password.toLowerCase().includes("wrong")) {
          reject(new Error("That email and password don't match."));
        } else {
          resolve({ email });
        }
      }, 900);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError();

    if (!validate()) return;

    setLoading(true);
    try {
      await fakeAuthRequest(emailInput.value.trim(), passwordInput.value);
      submitLabel.textContent = "Success — redirecting…";
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (err) {
      setLoading(false);
      showFormError(err.message);
      passwordInput.focus();
    }
  });

  /* ---------------------------------------------------------------------
     Placeholder link — wire this up once the reset-password flow exists.
     "Create an account" now links directly to signup.html.
     --------------------------------------------------------------------- */
  document.getElementById("forgotLink").addEventListener("click", (e) => e.preventDefault());
})();
