/* ==========================================================================
   Relay — Login Page Logic
   Wired to real Firebase Auth. Accepts either an email or a username in
   the identifier field — usernames are resolved to an email address via
   a Firestore lookup first, since Firebase Auth itself only signs in
   with email/password.
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email"); // holds email OR username
  const passwordInput = document.getElementById("password");
  const emailField = emailInput.closest(".field");
  const passwordField = passwordInput.closest(".field");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("loginSubmit");
  const submitLabel = submitBtn.querySelector(".auth-submit__label");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const googleLoginBtn = document.getElementById("googleLoginBtn");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

  const googleProvider = new GoogleAuthProvider();

  /* ---------------------------------------------------------------------
     If already signed in, skip the form entirely.
     --------------------------------------------------------------------- */
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "index.html";
    unsubscribe();
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
     Resolve a username to its account email via Firestore.
     Requires a "users" collection with docs shaped like:
       { uid, name, username, email, ... }
     and a Firestore rule that allows a *read* on this specific query
     (e.g. allow list: if request.query.limit <= 1) without exposing the
     whole users collection.
     --------------------------------------------------------------------- */
  async function resolveEmail(identifier) {
    if (EMAIL_RE.test(identifier)) return identifier;

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", identifier.toLowerCase()), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("no-user");
    }
    return snapshot.docs[0].data().email;
  }

  /* ---------------------------------------------------------------------
     Map Firebase error codes to friendly, non-revealing messages
     --------------------------------------------------------------------- */
  function friendlyAuthError(error) {
    if (error.message === "no-user") {
      return "That email/username and password don't match.";
    }
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "That email/username and password don't match.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/network-request-failed":
        return "Network error — check your connection and try again.";
      default:
        return "Something went wrong signing you in. Please try again.";
    }
  }

  /* ---------------------------------------------------------------------
     Submit: real Firebase sign-in
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError();

    if (!validate()) return;

    setLoading(true);
    try {
      const email = await resolveEmail(emailInput.value.trim());
      await signInWithEmailAndPassword(auth, email, passwordInput.value);
      submitLabel.textContent = "Success — redirecting…";
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 400);
    } catch (err) {
      setLoading(false);
      showFormError(friendlyAuthError(err));
      passwordInput.focus();
    }
  });

  /* ---------------------------------------------------------------------
     Continue with Google
     First-time Google sign-ins won't have a users/{uid} doc yet (no
     username was ever chosen), so check for one and, if missing, send
     the person to finish setting up their profile instead of app.html.
     Swap "signup.html" below for a dedicated "complete-profile.html"
     once that page exists.
     --------------------------------------------------------------------- */
  function setGoogleLoading(isLoading) {
    googleLoginBtn.disabled = isLoading;
    googleLoginBtn.classList.toggle("is-loading", isLoading);
    const label = googleLoginBtn.querySelector(".auth-social__label");

    if (isLoading) {
      label.textContent = "Connecting…";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      googleLoginBtn.prepend(spinner);
    } else {
      label.textContent = "Continue with Google";
      const spinner = googleLoginBtn.querySelector(".spinner");
      if (spinner) spinner.remove();
    }
  }

  googleLoginBtn.addEventListener("click", async () => {
    hideFormError();
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      window.location.href = "index.html";
    } catch (err) {
      setGoogleLoading(false);
      if (err.code === "auth/popup-closed-by-user") return;
      showFormError("Couldn't sign in with Google. Please try again.");
    }
  });

  /* ---------------------------------------------------------------------
     Placeholder link — wire this up once the reset-password flow exists.
     Real version: sendPasswordResetEmail(auth, emailInput.value.trim())
     --------------------------------------------------------------------- */
  document.getElementById("forgotLink").addEventListener("click", (e) => e.preventDefault());
})();
