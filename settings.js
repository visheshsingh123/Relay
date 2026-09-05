/* ==========================================================================
   Relay — Settings Page Logic
   Client-side validation + a simulated save call. Swap saveSettings() for
   real Supabase Auth / profiles calls later.
   ========================================================================== */

(() => {
  "use strict";

  // Demo-only signed-in user. In a real build this comes from the auth
  // session, the same as currentUser in app.js.
  const currentUser = {
    name: "Vivian Serrano",
    username: "vivian",
    initials: "VS",
    email: "vivian@example.com",
  };

  const form = document.getElementById("settingsForm");
  const avatarEl = document.getElementById("settingsAvatar");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  const fullNameInput = document.getElementById("fullName");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  const fullNameField = fullNameInput.closest(".field");
  const usernameField = usernameInput.closest(".field");
  const emailField = emailInput.closest(".field");

  const fullNameError = document.getElementById("fullNameError");
  const usernameError = document.getElementById("usernameError");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");

  const saveBtn = document.getElementById("saveBtn");
  const saveLabel = saveBtn.querySelector(".auth-submit__label");
  const logoutBtn = document.getElementById("logoutBtn");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

  /* ---------------------------------------------------------------------
     Hydrate the form with the current profile
     --------------------------------------------------------------------- */
  avatarEl.textContent = currentUser.initials;
  fullNameInput.value = currentUser.name;
  usernameInput.value = currentUser.username;
  emailInput.value = currentUser.email;

  // Demo-only: photo upload isn't wired to storage yet.
  changePhotoBtn.addEventListener("click", () => {
    window.alert("Photo uploads aren't part of this demo yet.");
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

  fullNameInput.addEventListener("input", () => clearFieldError(fullNameField, fullNameError));
  usernameInput.addEventListener("input", () => {
    const cleaned = usernameInput.value.replace(/[^a-zA-Z0-9_]/g, "");
    if (cleaned !== usernameInput.value) usernameInput.value = cleaned;
    clearFieldError(usernameField, usernameError);
  });
  emailInput.addEventListener("input", () => clearFieldError(emailField, emailError));
  [newPasswordInput, confirmPasswordInput].forEach((input) =>
    input.addEventListener("input", () => {
      passwordError.hidden = true;
    })
  );

  /* ---------------------------------------------------------------------
     Full-form validation
     --------------------------------------------------------------------- */
  function validate() {
    let isValid = true;

    if (fullNameInput.value.trim().length < 2) {
      setFieldError(fullNameField, fullNameError, "Enter your full name.");
      isValid = false;
    } else {
      clearFieldError(fullNameField, fullNameError);
    }

    if (!USERNAME_RE.test(usernameInput.value)) {
      setFieldError(usernameField, usernameError, "3–20 characters: letters, numbers, and underscores.");
      isValid = false;
    } else {
      clearFieldError(usernameField, usernameError);
    }

    if (!EMAIL_RE.test(emailInput.value.trim())) {
      setFieldError(emailField, emailError, "Enter a valid email address.");
      isValid = false;
    } else {
      clearFieldError(emailField, emailError);
    }

    const wantsPasswordChange = newPasswordInput.value || confirmPasswordInput.value;
    if (wantsPasswordChange) {
      const matches = newPasswordInput.value === confirmPasswordInput.value;
      const longEnough = newPasswordInput.value.length >= 8;
      if (!matches || !longEnough) {
        passwordError.hidden = false;
        isValid = false;
      } else {
        passwordError.hidden = true;
      }
    }

    return isValid;
  }

  /* ---------------------------------------------------------------------
     Submit: simulated save
     --------------------------------------------------------------------- */
  function setLoading(isLoading) {
    saveBtn.disabled = isLoading;
    saveBtn.classList.toggle("is-loading", isLoading);

    if (isLoading) {
      saveLabel.textContent = "Saving…";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      saveBtn.prepend(spinner);
    } else {
      saveLabel.textContent = "Save changes";
      const spinner = saveBtn.querySelector(".spinner");
      if (spinner) spinner.remove();
    }
  }

  function hideMessages() {
    formError.hidden = true;
    formSuccess.hidden = true;
  }

  // Demo-only save call. Replace with a real request, e.g. a Supabase
  // update against the profiles table and, if changed, auth.updateUser().
  function fakeSaveRequest() {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (emailInput.value.toLowerCase().endsWith("@taken.com")) {
          reject(new Error("That email is already in use."));
        } else {
          resolve();
        }
      }, 700);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    if (!validate()) return;

    setLoading(true);
    try {
      await fakeSaveRequest();
      setLoading(false);
      formSuccess.hidden = false;
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
    } catch (err) {
      setLoading(false);
      formError.textContent = err.message;
      formError.hidden = false;
    }
  });

  /* ---------------------------------------------------------------------
     Log out / delete account
     --------------------------------------------------------------------- */
  logoutBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  deleteAccountBtn.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Delete your account? This permanently removes your profile and every conversation. This can't be undone."
    );
    if (confirmed) window.location.href = "login.html";
  });
})();
