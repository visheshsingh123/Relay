/* ==========================================================================
   Relay — Signup Page Logic
   Client-side validation + a simulated account-creation call. Swap
   handleSignup() for a real Supabase Auth signUp() call later.
   ========================================================================== */

(() => {
  "use strict";

  const form = document.getElementById("signupForm");
  const nameInput = document.getElementById("name");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const termsInput = document.getElementById("terms");

  const nameField = nameInput.closest(".field");
  const usernameField = usernameInput.closest(".field");
  const emailField = emailInput.closest(".field");
  const passwordField = passwordInput.closest(".field");
  const confirmField = confirmInput.closest(".field");

  const nameError = document.getElementById("nameError");
  const usernameError = document.getElementById("usernameError");
  const usernameHint = document.getElementById("usernameHint");
  const usernameStatus = document.getElementById("usernameStatus");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const confirmError = document.getElementById("confirmError");
  const termsError = document.getElementById("termsError");
  const formError = document.getElementById("formError");

  const strengthMeter = document.getElementById("strengthMeter");
  const strengthLabel = document.getElementById("strengthLabel");

  const submitBtn = document.getElementById("signupSubmit");
  const submitLabel = submitBtn.querySelector(".auth-submit__label");
  const togglePasswordBtn = document.getElementById("togglePassword");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

  // Demo-only "existing users" list, used to simulate an availability check.
  const TAKEN_USERNAMES = ["admin", "support", "relay", "john", "test", "johndoe"];

  /* ---------------------------------------------------------------------
     Username: auto-suggest from full name until the person edits it
     directly, then format validation + a debounced availability check.
     --------------------------------------------------------------------- */
  let usernameTouched = false;
  let usernameCheckTimer = null;
  let usernameCheckToken = 0;
  let usernameIsAvailable = false;
  let usernameChecking = false;

  function slugifyName(value) {
    return value
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9\s_]/g, "")
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 20);
  }

  nameInput.addEventListener("input", () => {
    clearFieldError(nameField, nameError);
    if (!usernameTouched) {
      usernameInput.value = slugifyName(nameInput.value);
      handleUsernameChange({ auto: true });
    }
  });

  usernameInput.addEventListener("input", () => {
    usernameTouched = true;
    // Usernames are conventionally lowercase; normalize as they type.
    const cleaned = usernameInput.value.replace(/[^a-zA-Z0-9_]/g, "");
    if (cleaned !== usernameInput.value) usernameInput.value = cleaned;
    handleUsernameChange({ auto: false });
  });

  function setUsernameStatusIcon(state) {
    if (state === "checking") {
      usernameStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    } else if (state === "available") {
      usernameStatus.innerHTML =
        '<svg class="icon-available" viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">' +
        '<path d="M2 8.5l3.2 3.2L14 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (state === "taken") {
      usernameStatus.innerHTML =
        '<svg class="icon-taken" viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">' +
        '<path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    } else {
      usernameStatus.innerHTML = "";
    }
  }

  // Demo-only lookup. Replace with a real request, e.g. a Supabase query
  // against the profiles table: .select('id').eq('username', value).
  function fakeUsernameLookup(value) {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        resolve(!TAKEN_USERNAMES.includes(value.toLowerCase()));
      }, 500);
    });
  }

  function handleUsernameChange() {
    window.clearTimeout(usernameCheckTimer);
    usernameError.hidden = true;
    usernameField.classList.remove("has-error");
    usernameIsAvailable = false;
    usernameChecking = false;

    const value = usernameInput.value;

    if (!value) {
      usernameHint.textContent = "3–20 characters: letters, numbers, and underscores.";
      usernameHint.className = "field__hint";
      setUsernameStatusIcon(null);
      return;
    }

    if (!USERNAME_RE.test(value)) {
      usernameHint.textContent =
        value.length < 3
          ? "At least 3 characters, starting with a letter."
          : "Letters, numbers, and underscores only.";
      usernameHint.className = "field__hint is-invalid";
      setUsernameStatusIcon(null);
      return;
    }

    usernameHint.textContent = "Checking availability…";
    usernameHint.className = "field__hint is-checking";
    setUsernameStatusIcon("checking");
    usernameChecking = true;

    const token = ++usernameCheckToken;
    usernameCheckTimer = window.setTimeout(async () => {
      const available = await fakeUsernameLookup(value);
      if (token !== usernameCheckToken) return; // a newer keystroke superseded this check

      usernameChecking = false;
      usernameIsAvailable = available;
      if (available) {
        usernameHint.textContent = `@${value} is available.`;
        usernameHint.className = "field__hint is-available";
        setUsernameStatusIcon("available");
      } else {
        usernameHint.textContent = "That username is already taken.";
        usernameHint.className = "field__hint is-taken";
        setUsernameStatusIcon("taken");
      }
    }, 400);
  }

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
     Field-level error helpers
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

  /* ---------------------------------------------------------------------
     Password strength meter — a lightweight heuristic, not a policy.
     --------------------------------------------------------------------- */
  function scorePassword(value) {
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[0-9]/.test(value) && /[a-zA-Z]/.test(value)) score++;
    if (/[^a-zA-Z0-9]/.test(value)) score++;
    return Math.min(score, 3);
  }

  function updateStrengthMeter() {
    const value = passwordInput.value;
    strengthMeter.classList.remove("is-weak", "is-fair", "is-strong");

    if (!value) {
      strengthLabel.textContent = "Use 8+ characters with a mix of letters and numbers.";
      return;
    }

    const score = scorePassword(value);
    if (score <= 1) {
      strengthMeter.classList.add("is-weak");
      strengthLabel.textContent = "Weak — try adding numbers or a symbol.";
    } else if (score === 2) {
      strengthMeter.classList.add("is-fair");
      strengthLabel.textContent = "Fair — a bit longer would help.";
    } else {
      strengthMeter.classList.add("is-strong");
      strengthLabel.textContent = "Strong password.";
    }
  }

  emailInput.addEventListener("input", () => clearFieldError(emailField, emailError));
  passwordInput.addEventListener("input", () => {
    clearFieldError(passwordField, passwordError);
    updateStrengthMeter();
  });
  confirmInput.addEventListener("input", () => clearFieldError(confirmField, confirmError));
  termsInput.addEventListener("change", () => {
    termsError.hidden = true;
  });

  /* ---------------------------------------------------------------------
     Full-form validation
     --------------------------------------------------------------------- */
  function validate() {
    let isValid = true;

    if (nameInput.value.trim().length < 2) {
      setFieldError(nameField, nameError, "Enter your full name.");
      isValid = false;
    } else {
      clearFieldError(nameField, nameError);
    }

    if (!USERNAME_RE.test(usernameInput.value)) {
      setFieldError(usernameField, usernameError, "Choose a valid username first.");
      isValid = false;
    } else if (usernameChecking) {
      setFieldError(usernameField, usernameError, "Still checking that username — one moment.");
      isValid = false;
    } else if (!usernameIsAvailable) {
      setFieldError(usernameField, usernameError, "That username isn't available.");
      isValid = false;
    } else {
      usernameField.classList.remove("has-error");
      usernameError.hidden = true;
    }

    if (!EMAIL_RE.test(emailInput.value.trim())) {
      setFieldError(emailField, emailError, "Enter a valid email address.");
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

    if (confirmInput.value !== passwordInput.value || confirmInput.value === "") {
      setFieldError(confirmField, confirmError, "Passwords don't match.");
      isValid = false;
    } else {
      clearFieldError(confirmField, confirmError);
    }

    if (!termsInput.checked) {
      termsError.hidden = false;
      isValid = false;
    } else {
      termsError.hidden = true;
    }

    return isValid;
  }

  /* ---------------------------------------------------------------------
     Submit: simulated account creation
     --------------------------------------------------------------------- */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);

    if (isLoading) {
      submitLabel.textContent = "Creating account…";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      submitBtn.prepend(spinner);
    } else {
      submitLabel.textContent = "Create account";
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

  // Demo-only signup call. Replace with a real request, e.g.:
  //   await supabase.auth.signUp({ email, password, options: { data: { full_name, username } } })
  function fakeSignupRequest(name, username, email, password) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (email.toLowerCase().endsWith("@taken.com")) {
          reject(new Error("An account with this email already exists."));
        } else {
          resolve({ name, username, email });
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
      await fakeSignupRequest(
        nameInput.value.trim(),
        usernameInput.value,
        emailInput.value.trim(),
        passwordInput.value
      );
      submitLabel.textContent = "Account created — redirecting…";
      window.setTimeout(() => {
        window.location.href = "app.html";
      }, 500);
    } catch (err) {
      setLoading(false);
      showFormError(err.message);
      emailInput.focus();
    }
  });
})();
