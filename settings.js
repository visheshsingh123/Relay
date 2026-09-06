/* ==========================================================================
   Relay — Settings Page Logic
   Client-side validation + a simulated save call. Swap saveSettings() for
   real Supabase Auth / profiles calls later.
   ========================================================================== */

import { auth, db, storage } from "./firebase-config.js";
import { signOut, onAuthStateChanged, updateEmail, updatePassword, updateProfile, deleteUser } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

(() => {
  "use strict";

  // We'll populate this when auth resolves
  let currentUser = null;

  const form = document.getElementById("settingsForm");
  const avatarEl = document.getElementById("settingsAvatar");
  const changePhotoBtn = document.getElementById("changePhotoBtn");
  const photoInput = document.getElementById("photoInput");

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

  function getInitials(name) {
    if (!name) return "??";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function setAvatarImage(url, name) {
    if (url) {
      avatarEl.textContent = "";
      avatarEl.style.backgroundImage = `url('${url}')`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.style.color = "transparent";
    } else {
      avatarEl.textContent = getInitials(name);
      avatarEl.style.backgroundImage = "none";
      avatarEl.style.color = "";
    }
  }

  /* ---------------------------------------------------------------------
     Hydrate the form with the current profile
     --------------------------------------------------------------------- */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    emailInput.value = user.email || "";
    fullNameInput.value = user.displayName || "";
    setAvatarImage(user.photoURL, user.displayName);

    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const displayName = data.name || user.displayName || "";
        fullNameInput.value = displayName;
        usernameInput.value = data.username || "";
        emailInput.value = data.email || user.email || "";
        
        setAvatarImage(data.photoURL || user.photoURL, displayName);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }

    // Hydrate push notification setting
    const pushNotificationsInput = document.getElementById("pushNotifications");
    const pushNotificationsLabel = document.getElementById("pushNotificationsLabel");
    if (pushNotificationsInput) {
      if ("Notification" in window) {
        pushNotificationsInput.checked = Notification.permission === "granted";
        if (Notification.permission === "granted") {
          pushNotificationsLabel.textContent = "Push Notifications Enabled";
        } else if (Notification.permission === "denied") {
          pushNotificationsLabel.textContent = "Push Notifications Blocked in Device Settings";
          pushNotificationsInput.disabled = true;
        }
      } else {
        pushNotificationsInput.disabled = true;
        pushNotificationsLabel.textContent = "Push Notifications Not Supported";
      }

      pushNotificationsInput.addEventListener("change", async () => {
        if (pushNotificationsInput.checked) {
          const permission = await Notification.requestPermission();
          pushNotificationsInput.checked = permission === "granted";
          if (permission === "granted") {
            pushNotificationsLabel.textContent = "Push Notifications Enabled";
          } else if (permission === "denied") {
            pushNotificationsLabel.textContent = "Push Notifications Blocked in Device Settings";
            pushNotificationsInput.disabled = true;
          }
        }
      });
    }
  });

  function compressImage(file, maxWidth = 250, maxHeight = 250, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;

          if (w > h) {
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }
          } else {
            if (h > maxHeight) {
              w = Math.round((w * maxHeight) / h);
              h = maxHeight;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Photo upload
  changePhotoBtn.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    changePhotoBtn.textContent = "Processing...";
    changePhotoBtn.disabled = true;

    try {
      // 1. Compress image locally in browser (crisp 250x250 JPEG)
      const dataUrl = await compressImage(file, 250, 250, 0.82);
      let finalUrl = dataUrl;

      // 2. Attempt Storage upload with 3s timeout fallback
      try {
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        const uploadTask = uploadBytes(storageRef, file);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Storage timeout")), 3500)
        );
        await Promise.race([uploadTask, timeoutPromise]);
        finalUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Storage upload skipped or timed out, using compressed inline photo URL:", storageErr);
      }

      // 3. Save URL to Auth profile & Firestore user doc
      try {
        await updateProfile(user, { photoURL: finalUrl.startsWith("data:") ? null : finalUrl });
      } catch (e) { /* ignore */ }

      await setDoc(doc(db, "users", user.uid), { photoURL: finalUrl }, { merge: true });

      // 4. Update avatar on current page instantly
      setAvatarImage(finalUrl, fullNameInput.value);

    } catch (err) {
      console.error("Error processing photo:", err);
      alert("Failed to process photo. Please try another image.");
    } finally {
      changePhotoBtn.textContent = "Change photo";
      changePhotoBtn.disabled = false;
      photoInput.value = "";
    }
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

  // Check if a username is taken by someone else
  async function checkUsernameAvailable(value, currentUid) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", value.toLowerCase()), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return true;
      return snapshot.docs[0].data().uid === currentUid;
    } catch (err) {
      console.error("Error checking username:", err);
      return true; // fallback if rules block it
    }
  }

  async function saveProfileToFirebase() {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user.");

    const newName = fullNameInput.value.trim();
    const newUsername = usernameInput.value;
    const newEmail = emailInput.value.trim();
    const newPassword = newPasswordInput.value;

    // Check username availability
    const isAvailable = await checkUsernameAvailable(newUsername, user.uid);
    if (!isAvailable) {
      throw new Error("That username is already taken.");
    }

    // Update Auth Email if changed
    if (newEmail !== user.email) {
      await updateEmail(user, newEmail);
    }

    // Update Auth Password if provided
    if (newPassword) {
      await updatePassword(user, newPassword);
    }

    // Update Auth Profile (Display Name)
    if (newName !== user.displayName) {
      await updateProfile(user, { displayName: newName });
    }

    // Save all details to Firestore
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      name: newName,
      username: newUsername.toLowerCase(),
      email: newEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true }); // merge true so we don't overwrite createdAt
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    if (!validate()) return;

    setLoading(true);
    try {
      await saveProfileToFirebase();
      setLoading(false);
      formSuccess.hidden = false;
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
    } catch (err) {
      setLoading(false);
      let msg = err.message;
      if (err.code === 'auth/requires-recent-login') {
        msg = "Please log out and log back in to change your email or password.";
      }
      formError.textContent = msg;
      formError.hidden = false;
    }
  });

  /* ---------------------------------------------------------------------
     Log out / delete account
     --------------------------------------------------------------------- */
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  });

  deleteAccountBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Delete your account? This permanently removes your profile and every conversation. This can't be undone."
    );
    if (!confirmed) return;

    try {
      const user = auth.currentUser;
      if (!user) return;

      // Delete Firestore profile
      await deleteDoc(doc(db, "users", user.uid));
      // Delete Firebase Auth account
      await deleteUser(user);

      // Redirect to login
      window.location.href = "login.html";
    } catch (err) {
      console.error("Error deleting account:", err);
      if (err.code === "auth/requires-recent-login") {
        alert("For security, please log out and log back in before deleting your account.");
      } else {
        alert("Something went wrong deleting your account. Please try again.");
      }
    }
  });
})();
