/* ==========================================================================
   Relay — Profile View Logic
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { showCustomAlert, showCustomConfirm } from "./ui-popup.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit, getDocs, 
  onSnapshot, arrayUnion, arrayRemove, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(() => {
  "use strict";

  const DEFAULT_AVATAR = "Assets/pfp.jpg";

  let currentUser = null;
  let currentProfile = null;
  let targetUser = null;
  let targetChatId = null;

  // Element refs
  const pvAvatar = document.getElementById("pvAvatar");
  const pvAvatarWrap = document.getElementById("pvAvatarWrap");
  const pvOnlineBadge = document.getElementById("pvOnlineBadge");
  const pvName = document.getElementById("pvName");
  const pvUsername = document.getElementById("pvUsername");
  const pvStatus = document.getElementById("pvStatus");
  const pvBio = document.getElementById("pvBio");
  const pvMessageBtn = document.getElementById("pvMessageBtn");
  const pvPinBtn = document.getElementById("pvPinBtn");
  const pvPinLabel = document.getElementById("pvPinLabel");
  const pvMuteBtn = document.getElementById("pvMuteBtn");
  const pvMuteIcon = document.getElementById("pvMuteIcon");
  const pvMuteLabel = document.getElementById("pvMuteLabel");
  const pvSearchBtn = document.getElementById("pvSearchBtn");
  const pvSummarizeBtn = document.getElementById("pvSummarizeBtn");
  const pvBlockBtn = document.getElementById("pvBlockBtn");
  const pvBlockLabel = document.getElementById("pvBlockLabel");
  const pvDeleteBtn = document.getElementById("pvDeleteBtn");
  const pvDetailUsername = document.getElementById("pvDetailUsername");
  const pvDetailEmail = document.getElementById("pvDetailEmail");
  const pvEmailRow = document.getElementById("pvEmailRow");
  const pvDetailJoined = document.getElementById("pvDetailJoined");

  // Lightbox
  const pvLightbox = document.getElementById("pvLightbox");
  const pvLightboxClose = document.getElementById("pvLightboxClose");
  const pvLightboxImg = document.getElementById("pvLightboxImg");

  // Mute modal
  const muteModal = document.getElementById("muteModal");
  const muteModalCancel = document.getElementById("muteModalCancel");

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function createChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  function formatLastSeen(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Last seen just now";
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    
    return `Last seen ${date.toLocaleDateString()}`;
  }

  function isUserBlocked(uid) {
    if (!currentProfile || !currentProfile.blockedUsers) return false;
    return Array.isArray(currentProfile.blockedUsers) && currentProfile.blockedUsers.includes(uid);
  }

  function isChatMuted(chatId) {
    if (!chatId || !currentProfile?.mutedChats) return false;
    const val = currentProfile.mutedChats[chatId];
    if (!val) return false;
    if (val === -1 || val === true) return true;
    if (typeof val === "number") {
      return Date.now() < val;
    }
    return false;
  }

  function updateActionStates() {
    if (!targetUser || !currentUser) return;

    const isPinned = Array.isArray(currentProfile?.pinnedChats) && currentProfile.pinnedChats.includes(targetChatId);
    const isMuted = isChatMuted(targetChatId);
    const isBlocked = isUserBlocked(targetUser.uid);

    if (pvPinLabel) pvPinLabel.textContent = isPinned ? "Unpin Chat" : "Pin Chat";
    if (pvMuteLabel) pvMuteLabel.textContent = isMuted ? "Unmute Chat" : "Mute Chat";
    if (pvMuteIcon) {
      pvMuteIcon.innerHTML = isMuted
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    }
    if (pvBlockLabel) pvBlockLabel.textContent = isBlocked ? "Unblock User" : "Block User";
  }

  function renderProfileData(user) {
    targetUser = user;
    if (currentUser) {
      targetChatId = createChatId(currentUser.uid, user.uid);
    }

    const photo = user.photoURL || DEFAULT_AVATAR;
    pvAvatar.style.backgroundImage = `url('${photo}')`;
    pvAvatar.style.backgroundSize = "cover";
    pvAvatar.style.backgroundPosition = "center";
    pvAvatar.style.color = "transparent";

    pvLightboxImg.src = photo;

    pvName.textContent = user.name || "User";
    pvUsername.textContent = `@${user.username || "user"}`;
    pvDetailUsername.textContent = `@${user.username || "user"}`;

    if (user.bio && user.bio.trim()) {
      pvBio.textContent = user.bio;
      pvBio.classList.remove("is-empty");
    } else {
      pvBio.textContent = "No bio added yet.";
      pvBio.classList.add("is-empty");
    }

    if (user.isAI) {
      pvStatus.innerHTML = `<span class="pv-status-pill is-online">Relay AI Bot</span>`;
      pvOnlineBadge.hidden = false;
      pvOnlineBadge.className = "profileview-avatar-badge is-ai";
    } else if (user.preferences?.onlineStatus === false) {
      pvStatus.innerHTML = `<span class="pv-status-pill">Offline</span>`;
      pvOnlineBadge.hidden = true;
    } else if (user.online) {
      pvStatus.innerHTML = `<span class="pv-status-pill is-online">Online</span>`;
      pvOnlineBadge.hidden = false;
      pvOnlineBadge.className = "profileview-avatar-badge is-online";
    } else {
      pvStatus.innerHTML = `<span class="pv-status-pill">${escapeHtml(formatLastSeen(user.lastSeen) || "Offline")}</span>`;
      pvOnlineBadge.hidden = true;
    }

    if (user.email) {
      pvDetailEmail.textContent = user.email;
      pvEmailRow.hidden = false;
    } else {
      pvEmailRow.hidden = true;
    }

    if (user.createdAt) {
      const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      pvDetailJoined.textContent = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } else {
      pvDetailJoined.textContent = "Member";
    }

    updateActionStates();
  }

  // Auth Listener
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;

    // Load current user profile from cache/firestore
    try {
      const cached = localStorage.getItem("relay_user_profile");
      if (cached) currentProfile = JSON.parse(cached);
    } catch (_) {}

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        currentProfile = snap.data();
      }
    } catch (_) {}

    const params = new URLSearchParams(window.location.search);
    const targetUid = params.get("uid");
    const targetUsername = params.get("username");

    if (!targetUid && !targetUsername) {
      showCustomAlert("No user specified to view.", "Error");
      setTimeout(() => window.location.href = "index.html", 1200);
      return;
    }

    // Handle Relay AI
    if (targetUid === "relay_ai_bot" || targetUsername === "relay_ai") {
      renderProfileData({
        uid: "relay_ai_bot",
        name: "Relay AI",
        username: "relay_ai",
        photoURL: "Assets/logo.png",
        bio: "Hi! I am Relay AI, your smart communication assistant built right into Relay. I can help rewrite messages, draft replies, translate conversations, and summarize chats.",
        isAI: true,
        online: true
      });
      return;
    }

    try {
      if (targetUid) {
        onSnapshot(doc(db, "users", targetUid), (docSnap) => {
          if (docSnap.exists()) {
            renderProfileData({ uid: docSnap.id, ...docSnap.data() });
          } else {
            showCustomAlert("User profile not found.", "User Not Found");
          }
        });
      } else if (targetUsername) {
        const q = query(collection(db, "users"), where("username", "==", targetUsername.toLowerCase()), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const docSnap = qSnap.docs[0];
          onSnapshot(doc(db, "users", docSnap.id), (liveSnap) => {
            if (liveSnap.exists()) {
              renderProfileData({ uid: liveSnap.id, ...liveSnap.data() });
            }
          });
        } else {
          showCustomAlert("User @"+targetUsername+" was not found.", "Not Found");
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      showCustomAlert("Failed to load user profile.", "Error");
    }
  });

  // Lightbox Zoom
  if (pvAvatarWrap) {
    pvAvatarWrap.addEventListener("click", () => {
      pvLightbox.removeAttribute("hidden");
    });
  }

  if (pvLightboxClose) {
    pvLightboxClose.addEventListener("click", () => {
      pvLightbox.setAttribute("hidden", "true");
    });
  }

  pvLightbox.addEventListener("click", (e) => {
    if (e.target === pvLightbox) {
      pvLightbox.setAttribute("hidden", "true");
    }
  });

  // Message Button
  pvMessageBtn.addEventListener("click", () => {
    if (!targetUser) return;
    window.location.href = `index.html?to=${encodeURIComponent(targetUser.username)}`;
  });

  // Pin Chat
  pvPinBtn.addEventListener("click", async () => {
    if (!targetChatId || !currentUser) return;
    const isPinned = Array.isArray(currentProfile?.pinnedChats) && currentProfile.pinnedChats.includes(targetChatId);

    try {
      if (isPinned) {
        await setDoc(doc(db, "users", currentUser.uid), {
          pinnedChats: arrayRemove(targetChatId)
        }, { merge: true });
        if (currentProfile?.pinnedChats) {
          currentProfile.pinnedChats = currentProfile.pinnedChats.filter(id => id !== targetChatId);
        }
        showCustomAlert("Conversation unpinned.", "Unpinned");
      } else {
        await setDoc(doc(db, "users", currentUser.uid), {
          pinnedChats: arrayUnion(targetChatId)
        }, { merge: true });
        if (!currentProfile.pinnedChats) currentProfile.pinnedChats = [];
        if (!currentProfile.pinnedChats.includes(targetChatId)) {
          currentProfile.pinnedChats.push(targetChatId);
        }
        showCustomAlert("Conversation pinned to top.", "Pinned");
      }

      try {
        localStorage.setItem("relay_user_profile", JSON.stringify(currentProfile));
      } catch (_) {}

      updateActionStates();
    } catch (err) {
      showCustomAlert("Failed to toggle pin: " + err.message, "Error");
    }
  });

  // Mute Modal
  function openMuteModal() {
    if (muteModal) {
      const body = document.getElementById("muteModalBody");
      if (body) body.textContent = `Choose how long you want to mute notifications for @${targetUser?.username || "this chat"}:`;
      muteModal.removeAttribute("hidden");
    }
  }

  function closeMuteModal() {
    if (muteModal) muteModal.setAttribute("hidden", "true");
  }

  if (muteModalCancel) muteModalCancel.addEventListener("click", closeMuteModal);

  document.querySelectorAll(".mute-opt-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const duration = parseInt(btn.dataset.duration, 10);
      closeMuteModal();
      if (!targetChatId || !currentUser) return;

      const expiry = duration === -1 ? -1 : (Date.now() + duration);
      if (!currentProfile.mutedChats) currentProfile.mutedChats = {};
      currentProfile.mutedChats[targetChatId] = expiry;

      try {
        localStorage.setItem("relay_user_profile", JSON.stringify(currentProfile));
      } catch (_) {}

      try {
        await setDoc(doc(db, "users", currentUser.uid), {
          [`mutedChats.${targetChatId}`]: expiry
        }, { merge: true });
        updateActionStates();
        showCustomAlert("Notifications muted for this conversation.", "Muted");
      } catch (err) {
        showCustomAlert("Failed to mute notifications: " + err.message, "Error");
      }
    });
  });

  pvMuteBtn.addEventListener("click", async () => {
    if (!targetChatId || !currentUser) return;
    if (isChatMuted(targetChatId)) {
      if (currentProfile?.mutedChats) delete currentProfile.mutedChats[targetChatId];
      try {
        localStorage.setItem("relay_user_profile", JSON.stringify(currentProfile));
      } catch (_) {}
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          [`mutedChats.${targetChatId}`]: deleteField()
        });
        updateActionStates();
        showCustomAlert("Notifications unmuted.", "Unmuted");
      } catch (err) {
        showCustomAlert("Failed to unmute: " + err.message, "Error");
      }
    } else {
      openMuteModal();
    }
  });

  // Search in Chat
  pvSearchBtn.addEventListener("click", () => {
    if (!targetUser) return;
    window.location.href = `index.html?to=${encodeURIComponent(targetUser.username)}&action=search`;
  });

  // Summarize with AI
  pvSummarizeBtn.addEventListener("click", () => {
    if (!targetUser) return;
    window.location.href = `index.html?to=${encodeURIComponent(targetUser.username)}&action=summarize`;
  });

  // Block / Unblock
  pvBlockBtn.addEventListener("click", async () => {
    if (!targetUser || !currentUser) return;
    const isBlocked = isUserBlocked(targetUser.uid);

    if (isBlocked) {
      try {
        await setDoc(doc(db, "users", currentUser.uid), {
          blockedUsers: arrayRemove(targetUser.uid)
        }, { merge: true });
        if (currentProfile?.blockedUsers) {
          currentProfile.blockedUsers = currentProfile.blockedUsers.filter(id => id !== targetUser.uid);
        }
        try { localStorage.setItem("relay_user_profile", JSON.stringify(currentProfile)); } catch (_) {}
        updateActionStates();
        showCustomAlert(`Unblocked @${targetUser.username}`, "Success");
      } catch (err) {
        showCustomAlert("Failed to unblock: " + err.message, "Error");
      }
    } else {
      const confirmed = await showCustomConfirm(`Block @${targetUser.username}? You won't be able to send or receive messages in this chat.`, "Block User");
      if (!confirmed) return;

      try {
        await setDoc(doc(db, "users", currentUser.uid), {
          blockedUsers: arrayUnion(targetUser.uid)
        }, { merge: true });
        if (!currentProfile.blockedUsers) currentProfile.blockedUsers = [];
        if (!currentProfile.blockedUsers.includes(targetUser.uid)) {
          currentProfile.blockedUsers.push(targetUser.uid);
        }
        try { localStorage.setItem("relay_user_profile", JSON.stringify(currentProfile)); } catch (_) {}
        updateActionStates();
        showCustomAlert(`Blocked @${targetUser.username}`, "User Blocked");
      } catch (err) {
        showCustomAlert("Failed to block: " + err.message, "Error");
      }
    }
  });

  // Delete Messages
  pvDeleteBtn.addEventListener("click", async () => {
    if (!targetChatId || !currentUser) return;
    const confirmed = await showCustomConfirm("Are you sure you want to delete all messages in this conversation? Message history will be cleared.", "Delete Messages");
    if (!confirmed) return;

    try {
      const messagesRef = collection(db, "chats", targetChatId, "messages");
      const msgsSnap = await getDocs(messagesRef);
      const deletePromises = msgsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      await updateDoc(doc(db, "chats", targetChatId), {
        lastMessage: "",
        updatedAt: serverTimestamp(),
        [`unreadCounts.${currentUser.uid}`]: 0
      });

      showCustomAlert("All messages have been deleted.", "Messages Deleted");
    } catch (err) {
      showCustomAlert("Failed to delete messages: " + err.message, "Error");
    }
  });

})();
