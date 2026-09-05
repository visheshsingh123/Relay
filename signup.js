/* ==========================================================================
   Relay — Signup Page Logic
   Client-side validation + a simulated account-creation call. Swap
   handleSignup() for a real Supabase Auth signUp() call later.
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { setDoc, doc, getDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Only redirect on initial page load if already signed in
const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "app.html";
  unsubscribe();
});
(() => {
  "use strict";

  const form = document.getElementById("signupForm");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const termsInput = document.getElementById("terms");

  const nameField = nameInput.closest(".field");
  const emailField = emailInput.closest(".field");
  const passwordField = passwordInput.closest(".field");
  const confirmField = confirmInput.closest(".field");

  const nameError = document.getElementById("nameError");
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
  const googleSignupBtn = document.getElementById("googleSignupBtn");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  nameInput.addEventListener("input", () => {
    clearFieldError(nameField, nameError);
  });

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

  async function firebaseSignup(name, email, password) {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    // Save display name on Auth profile
    await updateProfile(userCredential.user, { displayName: name });
    // Save everything to Firestore (without username for now)
    await setDoc(doc(db, "users", uid), {
      uid,
      name,
      email,
      createdAt: new Date().toISOString(),
    });
    return userCredential;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError();

    if (!validate()) return;

    setLoading(true);
    try {
        await firebaseSignup(
            nameInput.value.trim(),
            emailInput.value.trim(),
            passwordInput.value
        );
        submitLabel.textContent = "Account created — redirecting…";
        window.setTimeout(() => {
            window.location.href = "app.html";
        }, 500);
    } catch (err) {
        setLoading(false);
        // Map Firebase errors to user‑friendly messages
        let message = err.message;
        if (err.code) {
            switch (err.code) {
                case "auth/email-already-in-use":
                    message = "An account with this email already exists.";
                    break;
                case "auth/invalid-email":
                    message = "The email address is not valid.";
                    break;
                case "auth/weak-password":
                    message = "Password is too weak. Use at least 8 characters.";
                    break;
                default:
                    message = "Something went wrong creating your account. Please try again.";
            }
        }
        showFormError(message);
        emailInput.focus();
    }
  });

  /* ---------------------------------------------------------------------
     Continue with Google — demo-only popup simulation. Replace with a
     real Firebase call, e.g.:
       const provider = new GoogleAuthProvider();
     Continue with Google — real Firebase flow
     --------------------------------------------------------------------- */
  // ---------------------------------------------------------------
  // Real Google Sign‑In flow using Firebase Auth
  // ---------------------------------------------------------------
  async function googleAuthAndCreateProfile() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Popup opens, user picks account
    await signInWithPopup(auth, provider);
    window.location.href = "app.html";
  }

  function setGoogleLoading(isLoading) {
    googleSignupBtn.disabled = isLoading;
    googleSignupBtn.classList.toggle("is-loading", isLoading);
    const label = googleSignupBtn.querySelector(".auth-social__label");
    if (isLoading) {
      label.textContent = "Connecting…";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      googleSignupBtn.prepend(spinner);
    } else {
      label.textContent = "Continue with Google";
      const spinner = googleSignupBtn.querySelector(".spinner");
      if (spinner) spinner.remove();
    }
  }

  googleSignupBtn.addEventListener("click", async () => {
    hideFormError();
    setGoogleLoading(true);
    try {
      await googleAuthAndCreateProfile();
    } catch (err) {
      console.error("Google sign‑in error:", err);
      setGoogleLoading(false);
      showFormError("Couldn't sign up with Google. Please try again.");
    }
  });
})();
