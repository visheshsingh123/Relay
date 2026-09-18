/* ==========================================================================
   Relay — App Logic
   Real-time chat powered by Firebase Firestore
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { showCustomAlert, showCustomConfirm } from "./ui-popup.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit, getDocs, 
  onSnapshot, addDoc, serverTimestamp, orderBy, arrayUnion, arrayRemove, increment, limitToLast, deleteField
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(() => {
  "use strict";

  let firebaseUser = null;
  let firebaseProfile = null;
  
  let chats = [];
  let currentMessages = [];
  
  let activeChatId = null;
  let activeChatUser = null;
  let messagesUnsubscribe = null;
  let otherUserUnsubscribe = null; // listener for other user's online status
  let chatDocUnsubscribe = null;   // listener for typing indicator
  let typingTimeout = null;        // debounce timer for typing

  /* ---------------------------------------------------------------------
     Element refs
     --------------------------------------------------------------------- */
  const appEl = document.getElementById("app");
  const convListEl = document.getElementById("convList");
  const threadEl = document.getElementById("thread");
  const chatNameEl = document.getElementById("chatName");
  const chatAvatarEl = document.getElementById("chatAvatar");
  const chatStatusEl = document.getElementById("chatStatus");
  const backBtn = document.getElementById("backBtn");
  const chatEl = document.getElementById("chat");
  const chatHeaderEl = document.getElementById("chatHeader");
  const chatIdentity = document.getElementById("chatIdentity");
  const chatMenu = document.getElementById("chatMenu");
  const chatMenuBtn = document.getElementById("chatMenuBtn");
  const chatMenuDropdown = document.getElementById("chatMenuDropdown");
  const viewProfileChatMenuBtn = document.getElementById("viewProfileChatMenuBtn");
  const viewProfileChatMenuBtnIcon = document.getElementById("viewProfileChatMenuBtnIcon");
  const viewProfileChatMenuBtnLabel = document.getElementById("viewProfileChatMenuBtnLabel");
  const pinChatMenuBtn = document.getElementById("pinChatMenuBtn");
  const pinChatMenuBtnLabel = document.getElementById("pinChatMenuBtnLabel");
  const muteChatMenuBtn = document.getElementById("muteChatMenuBtn");
  const muteChatMenuBtnIcon = document.getElementById("muteChatMenuBtnIcon");
  const muteChatMenuBtnLabel = document.getElementById("muteChatMenuBtnLabel");
  const searchChatMenuBtn = document.getElementById("searchChatMenuBtn");
  const summarizeChatMenuBtn = document.getElementById("summarizeChatMenuBtn");
  const blockUserBtn = document.getElementById("blockUserBtn");
  const blockUserBtnLabel = document.getElementById("blockUserBtnLabel");
  const deleteChatBtn = document.getElementById("deleteChatBtn");
  const composer = document.getElementById("composer");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const editingBar = document.getElementById("editingBar");
  const editingBarPreview = document.getElementById("editingBarPreview");
  const editingBarCancel = document.getElementById("editingBarCancel");
  const replyBar = document.getElementById("replyBar");
  const replyBarSender = document.getElementById("replyBarSender");
  const replyBarPreview = document.getElementById("replyBarPreview");
  const replyBarCancel = document.getElementById("replyBarCancel");
  const smartRepliesBar = document.getElementById("smartRepliesBar");
  const smartRepliesList = document.getElementById("smartRepliesList");
  const smartRepliesClose = document.getElementById("smartRepliesClose");
  const searchToggle = document.getElementById("searchToggle");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");

  const threadSearchBtn = document.getElementById("threadSearchBtn");
  const threadSearchBar = document.getElementById("threadSearchBar");
  const threadSearchInput = document.getElementById("threadSearchInput");
  const threadSearchCount = document.getElementById("threadSearchCount");
  const threadSearchPrev = document.getElementById("threadSearchPrev");
  const threadSearchNext = document.getElementById("threadSearchNext");
  const threadSearchClose = document.getElementById("threadSearchClose");

  const muteModal = document.getElementById("muteModal");
  const muteModalCancel = document.getElementById("muteModalCancel");
  const aiAssistantModal = document.getElementById("aiAssistantModal");
  const aiModalClose = document.getElementById("aiModalClose");
  const forwardModal = document.getElementById("forwardModal");
  const forwardModalClose = document.getElementById("forwardModalClose");
  const forwardPreview = document.getElementById("forwardPreview");
  const forwardSearchInput = document.getElementById("forwardSearchInput");
  const forwardList = document.getElementById("forwardList");

  const newGroupBtn = document.getElementById("newGroupBtn");
  const createGroupModal = document.getElementById("createGroupModal");
  const createGroupClose = document.getElementById("createGroupClose");
  const createGroupForm = document.getElementById("createGroupForm");
  const groupNameInput = document.getElementById("groupNameInput");
  const groupMemberSearch = document.getElementById("groupMemberSearch");
  const groupSelectedBadges = document.getElementById("groupSelectedBadges");
  const groupMemberChecklist = document.getElementById("groupMemberChecklist");
  const createGroupSubmit = document.getElementById("createGroupSubmit");

  const groupInfoModal = document.getElementById("groupInfoModal");
  const groupInfoClose = document.getElementById("groupInfoClose");
  const groupInfoAvatar = document.getElementById("groupInfoAvatar");
  const groupInfoName = document.getElementById("groupInfoName");
  const groupInfoSub = document.getElementById("groupInfoSub");
  const groupAddMemberBtn = document.getElementById("groupAddMemberBtn");
  const groupLeaveBtn = document.getElementById("groupLeaveBtn");
  const groupMembersList = document.getElementById("groupMembersList");

  const groupAddMemberModal = document.getElementById("groupAddMemberModal");
  const groupAddMemberClose = document.getElementById("groupAddMemberClose");
  const addMemberSearch = document.getElementById("addMemberSearch");
  const addMemberChecklist = document.getElementById("addMemberChecklist");
  const groupAddMemberSubmit = document.getElementById("groupAddMemberSubmit");

  let activeChatGroup = null;
  let selectedGroupMemberUids = new Set();
  let selectedAddMemberUids = new Set();
  let availableContactsCache = [];

  let editingMessageId = null;
  let replyingTo = null;       // { id, text, senderName }
  let forwardingMessage = null;
  let threadSearchQuery = "";
  let matchedMessageIndices = [];
  let activeMatchIndex = -1;

  const usernameModal = document.getElementById("usernameModal");
  const usernameForm = document.getElementById("usernameForm");
  const onboardingUsername = document.getElementById("onboardingUsername");
  const onboardingUsernameError = document.getElementById("onboardingUsernameError");
  const onboardingUsernameSubmit = document.getElementById("onboardingUsernameSubmit");
  const myProfileBtn = document.getElementById("myProfileBtn");
  const myAvatarInitials = document.getElementById("myAvatarInitials");
  const sidebarEmpty = document.getElementById("sidebarEmpty");
  const chatEmpty = document.getElementById("chatEmpty");
  const sidebarSkeleton = document.getElementById("sidebarSkeleton");
  const chatSkeleton = document.getElementById("chatSkeleton");
  const sidebarEmptyTitle = document.getElementById("sidebarEmptyTitle");
  const chatEmptyTitle = document.getElementById("chatEmptyTitle");
  const requestBanner = document.getElementById("requestBanner");
  const requestBannerText = document.getElementById("requestBannerText");
  const requestBannerSub = document.getElementById("requestBannerSub");
  const requestBannerActions = document.getElementById("requestBannerActions");
  const acceptRequestBtn = document.getElementById("acceptRequestBtn");
  const rejectRequestBtn = document.getElementById("rejectRequestBtn");
  const aiFabBtn = document.getElementById("aiFabBtn");
  const aiComposerBtn = document.getElementById("aiComposerBtn");

  const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  
  function getInitials(name) {
    if (!name) return "??";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const DEFAULT_AVATAR = "Assets/pfp.jpg";

  function renderAvatarHtml(user, sizeClass = "avatar--sm") {
    const photo = (user && user.photoURL) || DEFAULT_AVATAR;
    return `<span class="avatar ${sizeClass}" style="background-image: url('${escapeHtml(photo)}'); background-size: cover; background-position: center; color: transparent;"></span>`;
  }

  function createChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  /* ---------------------------------------------------------------------
     Message Sound Effects Engine (Web Audio API)
     --------------------------------------------------------------------- */
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx && typeof window.AudioContext !== "undefined") {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSendSound() {
    if (firebaseProfile?.preferences?.soundEffects === false) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) { /* ignore */ }
  }

  function playReceiveSound() {
    if (firebaseProfile?.preferences?.soundEffects === false) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + (idx * 0.06);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.12);
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------------
     In-Chat Message Search Engine
     --------------------------------------------------------------------- */
  function closeThreadSearch() {
    threadSearchQuery = "";
    matchedMessageIndices = [];
    activeMatchIndex = -1;
    if (threadSearchBar) threadSearchBar.hidden = true;
    if (threadSearchInput) threadSearchInput.value = "";
    if (threadSearchCount) threadSearchCount.hidden = true;
    if (threadSearchBtn) threadSearchBtn.setAttribute("aria-expanded", "false");
    renderThread();
  }

  function updateThreadSearchResults() {
    const q = (threadSearchInput ? threadSearchInput.value : "").trim().toLowerCase();
    threadSearchQuery = q;
    matchedMessageIndices = [];

    if (!q) {
      activeMatchIndex = -1;
      if (threadSearchCount) threadSearchCount.hidden = true;
      if (threadSearchPrev) threadSearchPrev.disabled = true;
      if (threadSearchNext) threadSearchNext.disabled = true;
      renderThread();
      return;
    }

    currentMessages.forEach((msg, idx) => {
      if (msg.text && msg.text.toLowerCase().includes(q)) {
        matchedMessageIndices.push(idx);
      }
    });

    if (matchedMessageIndices.length > 0) {
      if (activeMatchIndex < 0 || activeMatchIndex >= matchedMessageIndices.length) {
        activeMatchIndex = matchedMessageIndices.length - 1;
      }
      if (threadSearchCount) {
        threadSearchCount.textContent = `${activeMatchIndex + 1} of ${matchedMessageIndices.length}`;
        threadSearchCount.hidden = false;
      }
      if (threadSearchPrev) threadSearchPrev.disabled = matchedMessageIndices.length <= 1;
      if (threadSearchNext) threadSearchNext.disabled = matchedMessageIndices.length <= 1;
    } else {
      activeMatchIndex = -1;
      if (threadSearchCount) {
        threadSearchCount.textContent = "0 matches";
        threadSearchCount.hidden = false;
      }
      if (threadSearchPrev) threadSearchPrev.disabled = true;
      if (threadSearchNext) threadSearchNext.disabled = true;
    }

    renderThread();
    scrollToActiveSearchMatch();
  }

  function scrollToActiveSearchMatch() {
    if (activeMatchIndex < 0 || activeMatchIndex >= matchedMessageIndices.length) return;
    const targetMsgIndex = matchedMessageIndices[activeMatchIndex];
    const rows = threadEl.querySelectorAll(".msg-row");
    if (rows[targetMsgIndex]) {
      const bubble = rows[targetMsgIndex].querySelector(".bubble");
      if (bubble) {
        bubble.classList.add("search-active-match");
        rows[targetMsgIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  if (threadSearchBtn) {
    threadSearchBtn.addEventListener("click", () => {
      const isHidden = threadSearchBar.hidden;
      threadSearchBar.hidden = !isHidden;
      threadSearchBtn.setAttribute("aria-expanded", String(isHidden));
      if (isHidden) {
        threadSearchInput.focus();
        updateThreadSearchResults();
      } else {
        closeThreadSearch();
      }
    });
  }

  if (threadSearchInput) {
    threadSearchInput.addEventListener("input", updateThreadSearchResults);
  }

  if (threadSearchClose) {
    threadSearchClose.addEventListener("click", closeThreadSearch);
  }

  if (threadSearchPrev) {
    threadSearchPrev.addEventListener("click", () => {
      if (matchedMessageIndices.length <= 1) return;
      activeMatchIndex = (activeMatchIndex - 1 + matchedMessageIndices.length) % matchedMessageIndices.length;
      updateThreadSearchResults();
    });
  }

  if (threadSearchNext) {
    threadSearchNext.addEventListener("click", () => {
      if (matchedMessageIndices.length <= 1) return;
      activeMatchIndex = (activeMatchIndex + 1) % matchedMessageIndices.length;
      updateThreadSearchResults();
    });
  }

  /* ---------------------------------------------------------------------
     Custom Conversation Context Menu & Message Context Menu (Right-Click / Long-Press)
     --------------------------------------------------------------------- */
  let activeContextMenu = null;

  function closeContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  document.addEventListener("click", closeContextMenu);
  document.addEventListener("scroll", closeContextMenu, true);

  function sortChats() {
    const pinnedSet = new Set(firebaseProfile?.pinnedChats || []);
    chats.sort((a, b) => {
      const isPinnedA = pinnedSet.has(a.id);
      const isPinnedB = pinnedSet.has(b.id);
      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;
      const timeA = a.updatedAt ? (a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0) : 0;
      const timeB = b.updatedAt ? (b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0) : 0;
      return timeB - timeA;
    });
  }

  /* ── Per-Chat Mute Helpers ───────────────────────────────────────── */
  function isChatMuted(chatId) {
    if (!chatId || !firebaseProfile?.mutedChats) return false;
    const val = firebaseProfile.mutedChats[chatId];
    if (!val) return false;
    if (val === -1 || val === true) return true;
    if (typeof val === "number") {
      return Date.now() < val;
    }
    return false;
  }

  let pendingMuteChatId = null;
  function openMuteModal(chatId, otherUserName) {
    pendingMuteChatId = chatId;
    if (muteModal) {
      const body = document.getElementById("muteModalBody");
      if (body) body.textContent = `Choose how long you want to mute notifications for @${otherUserName || "this chat"}:`;
      muteModal.removeAttribute("hidden");
    }
  }

  function closeMuteModal() {
    pendingMuteChatId = null;
    if (muteModal) muteModal.setAttribute("hidden", "true");
  }

  if (muteModalCancel) {
    muteModalCancel.addEventListener("click", closeMuteModal);
  }

  document.querySelectorAll(".mute-opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const duration = parseInt(btn.dataset.duration, 10);
      applyMuteDuration(duration);
    });
  });

  async function applyMuteDuration(durationMs) {
    const chatId = pendingMuteChatId;
    closeMuteModal();
    if (!chatId || !firebaseUser) return;

    const expiry = durationMs === -1 ? -1 : (Date.now() + durationMs);
    if (!firebaseProfile.mutedChats) firebaseProfile.mutedChats = {};
    firebaseProfile.mutedChats[chatId] = expiry;

    try {
      localStorage.setItem("relay_user_profile", JSON.stringify(firebaseProfile));
    } catch (e) { /* ignore */ }

    try {
      await setDoc(doc(db, "users", firebaseUser.uid), {
        [`mutedChats.${chatId}`]: expiry
      }, { merge: true });
      renderConvList(searchInput.value);
      showCustomAlert("Notifications muted for this conversation.", "Muted 🔕");
    } catch (err) {
      console.error("Error muting chat:", err);
      showCustomAlert("Failed to mute chat: " + err.message, "Error");
    }
  }

  async function unmuteChat(chatId) {
    if (!chatId || !firebaseUser) return;
    if (firebaseProfile?.mutedChats) {
      delete firebaseProfile.mutedChats[chatId];
    }
    try {
      localStorage.setItem("relay_user_profile", JSON.stringify(firebaseProfile));
    } catch (e) { /* ignore */ }

    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        [`mutedChats.${chatId}`]: deleteField()
      });
      renderConvList(searchInput.value);
      showCustomAlert("Notifications unmuted for this conversation.", "Unmuted 🔔");
    } catch (err) {
      console.error("Error unmuting chat:", err);
      showCustomAlert("Failed to unmute chat: " + err.message, "Error");
    }
  }

  async function toggleChatPin(chatId) {
    if (!firebaseUser || !chatId) return;

    const currentlyPinned = Array.isArray(firebaseProfile?.pinnedChats) && firebaseProfile.pinnedChats.includes(chatId);

    try {
      if (currentlyPinned) {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          pinnedChats: arrayRemove(chatId)
        }, { merge: true });
        if (firebaseProfile.pinnedChats) {
          firebaseProfile.pinnedChats = firebaseProfile.pinnedChats.filter(id => id !== chatId);
        }
        showCustomAlert("Conversation unpinned.", "Unpinned 📌");
      } else {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          pinnedChats: arrayUnion(chatId)
        }, { merge: true });
        if (!firebaseProfile.pinnedChats) firebaseProfile.pinnedChats = [];
        if (!firebaseProfile.pinnedChats.includes(chatId)) {
          firebaseProfile.pinnedChats.push(chatId);
        }
        showCustomAlert("Conversation pinned to top.", "Pinned 📌");
      }

      try {
        localStorage.setItem("relay_user_profile", JSON.stringify(firebaseProfile));
      } catch (err) { /* ignore */ }

      sortChats();
      renderConvList(searchInput.value);
    } catch (err) {
      console.error("Error toggling pin:", err);
      showCustomAlert("Failed to update pin status: " + err.message, "Error");
    }
  }

  async function toggleBlockUser(targetUser) {
    if (!targetUser || !firebaseUser) return;
    const targetUid = targetUser.uid || targetUser.id;
    if (!targetUid) {
      showCustomAlert("Failed to identify user ID to block.", "Error");
      return;
    }

    const isBlocked = isUserBlocked(targetUid);

    if (isBlocked) {
      try {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          blockedUsers: arrayRemove(targetUid)
        }, { merge: true });
        if (!firebaseProfile.blockedUsers) firebaseProfile.blockedUsers = [];
        firebaseProfile.blockedUsers = firebaseProfile.blockedUsers.filter(id => id !== targetUid);
        updateBlockedUI(targetUser);
        showCustomAlert(`Unblocked @${targetUser.username}`, "Success");
      } catch (err) {
        showCustomAlert("Failed to unblock user: " + err.message, "Error");
      }
    } else {
      const confirmed = await showCustomConfirm(`Block @${targetUser.username}? You won't be able to send or receive messages in this chat.`, "Block User");
      if (!confirmed) return;
      try {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          blockedUsers: arrayUnion(targetUid)
        }, { merge: true });
        if (!firebaseProfile.blockedUsers) firebaseProfile.blockedUsers = [];
        if (!firebaseProfile.blockedUsers.includes(targetUid)) {
          firebaseProfile.blockedUsers.push(targetUid);
        }
        updateBlockedUI(targetUser);
        showCustomAlert(`Blocked @${targetUser.username}`, "User Blocked");
      } catch (err) {
        showCustomAlert("Failed to block user: " + err.message, "Error");
      }
    }
  }

  function openUserProfile(user) {
    if (!user) return;
    try {
      if (user.uid) localStorage.setItem("relay_user_cache_" + user.uid, JSON.stringify(user));
      if (user.username) localStorage.setItem("relay_user_cache_" + user.username.toLowerCase(), JSON.stringify(user));
      localStorage.setItem("relay_last_viewed_user", JSON.stringify(user));
    } catch (_) {}
    const identifier = user.uid ? `uid=${encodeURIComponent(user.uid)}` : `username=${encodeURIComponent(user.username)}`;
    window.location.href = `profileview.html?${identifier}`;
  }

  function openChatContextMenu(e, conv, target) {
    e.preventDefault();
    closeContextMenu();

    const isGroup = !!conv.isGroup;
    const isPinned = Array.isArray(firebaseProfile?.pinnedChats) && firebaseProfile.pinnedChats.includes(conv.id);
    const isMuted = isChatMuted(conv.id);

    const menu = document.createElement("div");
    menu.className = "context-menu";

    if (isGroup) {
      menu.innerHTML = `
        <button type="button" class="context-menu__item" id="ctxGroupInfo">
          <span>👥</span> Group Info
        </button>
        <button type="button" class="context-menu__item" id="ctxPin">
          <span>📌</span> ${isPinned ? 'Unpin Group' : 'Pin Group'}
        </button>
        <button type="button" class="context-menu__item" id="ctxMute">
          <span>${isMuted ? '🔔' : '🔕'}</span> ${isMuted ? 'Unmute Group' : 'Mute Group'}
        </button>
        <button type="button" class="context-menu__item" id="ctxSearch">
          <span>🔍</span> Search in Chat
        </button>
        <button type="button" class="context-menu__item" id="ctxSummarize">
          <span>📝</span> Summarize
        </button>
        <button type="button" class="context-menu__item context-menu__item--danger" id="ctxLeaveGroup">
          <span>🚪</span> Leave Group
        </button>
        <button type="button" class="context-menu__item context-menu__item--danger" id="ctxDelete">
          <span>🗑️</span> Delete Messages
        </button>
      `;

      document.body.appendChild(menu);
      activeContextMenu = menu;

      const menuWidth = 190;
      const menuHeight = 260;
      let posX = e.clientX;
      let posY = e.clientY;

      if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
      if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

      menu.style.left = `${Math.max(10, posX)}px`;
      menu.style.top = `${Math.max(10, posY)}px`;

      menu.querySelector("#ctxGroupInfo").addEventListener("click", () => {
        closeContextMenu();
        selectConversation(conv.id, conv);
        setTimeout(() => openGroupInfoModal(), 100);
      });

      menu.querySelector("#ctxPin").addEventListener("click", () => {
        closeContextMenu();
        toggleChatPin(conv.id);
      });

      menu.querySelector("#ctxMute").addEventListener("click", () => {
        closeContextMenu();
        if (isMuted) {
          unmuteChat(conv.id);
        } else {
          openMuteModal(conv.id, conv.groupName || "Group");
        }
      });

      menu.querySelector("#ctxSearch").addEventListener("click", () => {
        closeContextMenu();
        selectConversation(conv.id, conv);
        setTimeout(() => {
          if (threadSearchBar) {
            threadSearchBar.hidden = false;
            if (threadSearchBtn) threadSearchBtn.setAttribute("aria-expanded", "true");
            if (threadSearchInput) threadSearchInput.focus();
            updateThreadSearchResults();
          }
        }, 100);
      });

      menu.querySelector("#ctxSummarize").addEventListener("click", () => {
        closeContextMenu();
        selectConversation(conv.id, conv);
        setTimeout(() => summarizeAndOpenAI(), 150);
      });

      menu.querySelector("#ctxLeaveGroup").addEventListener("click", async () => {
        closeContextMenu();
        const confirmed = await showCustomConfirm(`Are you sure you want to leave "${conv.groupName || 'this group'}"?`, "Leave Group");
        if (!confirmed) return;
        try {
          await updateDoc(doc(db, "chats", conv.id), {
            participants: arrayRemove(firebaseUser.uid),
            [`users.${firebaseUser.uid}`]: deleteField(),
            [`unreadCounts.${firebaseUser.uid}`]: deleteField()
          });
          if (activeChatId === conv.id) closeChatPane();
          showCustomAlert("You have left the group.", "Left Group");
        } catch (err) {
          showCustomAlert("Failed to leave group: " + err.message, "Error");
        }
      });

      menu.querySelector("#ctxDelete").addEventListener("click", () => {
        closeContextMenu();
        deleteChat(conv.id);
      });
      return;
    }

    const otherUser = target;
    const isBlocked = (otherUser && otherUser.uid) ? isUserBlocked(otherUser.uid) : false;

    menu.innerHTML = `
        <button type="button" class="context-menu__item" id="ctxViewProfile">
          <span>👤</span> View Profile
        </button>
        <button type="button" class="context-menu__item" id="ctxPin">
          <span>📌</span> ${isPinned ? 'Unpin Chat' : 'Pin Chat'}
        </button>
        <button type="button" class="context-menu__item" id="ctxMute">
          <span>${isMuted ? '🔔' : '🔕'}</span> ${isMuted ? 'Unmute Chat' : 'Mute Chat'}
        </button>
        <button type="button" class="context-menu__item" id="ctxSearch">
          <span>🔍</span> Search in Chat
        </button>
        <button type="button" class="context-menu__item" id="ctxSummarize">
          <span>📝</span> Summarize
        </button>
        <button type="button" class="context-menu__item" id="ctxBlock">
          <span>🚫</span> ${isBlocked ? "Unblock User" : "Block User"}
        </button>
        <button type="button" class="context-menu__item context-menu__item--danger" id="ctxDelete">
          <span>🗑️</span> Delete Messages
        </button>
      `;

    document.body.appendChild(menu);
    activeContextMenu = menu;

    const menuWidth = 190;
    const menuHeight = 260;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    menu.querySelector("#ctxViewProfile").addEventListener("click", () => {
      closeContextMenu();
      openUserProfile(otherUser);
    });

    menu.querySelector("#ctxPin").addEventListener("click", () => {
      closeContextMenu();
      toggleChatPin(conv.id);
    });

    menu.querySelector("#ctxMute").addEventListener("click", () => {
      closeContextMenu();
      if (isMuted) {
        unmuteChat(conv.id);
      } else {
        openMuteModal(conv.id, otherUser.username || otherUser.name);
      }
    });

    menu.querySelector("#ctxSearch").addEventListener("click", () => {
      closeContextMenu();
      selectConversation(conv.id, otherUser);
      setTimeout(() => {
        if (threadSearchBar) {
          threadSearchBar.hidden = false;
          if (threadSearchBtn) threadSearchBtn.setAttribute("aria-expanded", "true");
          if (threadSearchInput) threadSearchInput.focus();
          updateThreadSearchResults();
        }
      }, 100);
    });

    menu.querySelector("#ctxSummarize").addEventListener("click", () => {
      closeContextMenu();
      selectConversation(conv.id, otherUser);
      setTimeout(() => summarizeAndOpenAI(), 150);
    });

    menu.querySelector("#ctxBlock").addEventListener("click", () => {
      closeContextMenu();
      toggleBlockUser(otherUser);
    });

    menu.querySelector("#ctxDelete").addEventListener("click", () => {
      closeContextMenu();
      deleteChat(conv.id);
    });
  }

  async function translateMessage(msg) {
    if (!msg || !msg.text) return;
    const bubbleEl = threadEl.querySelector(`[data-id="${msg.id}"]`);
    if (!bubbleEl) return;

    let existing = bubbleEl.querySelector(".bubble__translation");
    if (existing) {
      existing.remove();
      return;
    }

    const loadCard = document.createElement("div");
    loadCard.className = "bubble__translation";
    loadCard.innerHTML = `
      <div class="bubble__translation-header">
        <span>🌐 Translating with AI...</span>
      </div>
    `;
    bubbleEl.appendChild(loadCard);

    try {
      const translated = await fetchGroqResponse([
        {
          role: "system",
          content: "You are an AI translator in Relay chat. Translate the given text into clear English (or into Hindi if it is already in English). Return ONLY the translated string with no explanations or punctuation around it."
        },
        { role: "user", content: msg.text }
      ]);

      const textToShow = translated || "Could not translate message.";
      loadCard.innerHTML = `
        <div class="bubble__translation-header">
          <span>🌐 Translated (AI)</span>
          <button type="button" class="bubble__translation-close" aria-label="Close translation">✕</button>
        </div>
        <p class="bubble__translation-text">${escapeHtml(textToShow)}</p>
      `;

      loadCard.querySelector(".bubble__translation-close").addEventListener("click", (e) => {
        e.stopPropagation();
        loadCard.remove();
      });
    } catch (err) {
      loadCard.remove();
      showCustomAlert("Translation error: " + err.message, "Error");
    }
  }

  async function toggleReaction(msgId, emoji) {
    if (!activeChatId || !msgId || !firebaseUser || !emoji) return;
    const targetMsg = currentMessages.find(m => m.id === msgId);
    const hasMyReaction = targetMsg && targetMsg.reactions && targetMsg.reactions[firebaseUser.uid] === emoji;

    try {
      if (hasMyReaction) {
        await updateDoc(doc(db, "chats", activeChatId, "messages", msgId), {
          [`reactions.${firebaseUser.uid}`]: deleteField()
        });
      } else {
        await updateDoc(doc(db, "chats", activeChatId, "messages", msgId), {
          [`reactions.${firebaseUser.uid}`]: emoji
        });
      }
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  }

  function openForwardModal(msg) {
    if (!msg || !forwardModal) return;
    forwardingMessage = msg;
    if (forwardPreview) forwardPreview.textContent = msg.text || "(Message)";
    if (forwardSearchInput) forwardSearchInput.value = "";
    renderForwardList("");
    forwardModal.removeAttribute("hidden");
    if (forwardSearchInput) forwardSearchInput.focus();
  }

  function closeForwardModal() {
    forwardingMessage = null;
    if (forwardModal) forwardModal.setAttribute("hidden", "true");
  }

  if (forwardModalClose) forwardModalClose.addEventListener("click", closeForwardModal);
  if (forwardSearchInput) {
    forwardSearchInput.addEventListener("input", () => {
      renderForwardList(forwardSearchInput.value);
    });
  }

  function renderForwardList(filter = "") {
    if (!forwardList) return;
    const q = filter.trim().toLowerCase();
    const availableChats = chats.filter(c => {
      if (c.isGroup) {
        if (!q) return true;
        return (c.groupName || "").toLowerCase().includes(q);
      }
      if (!c.users || !c.otherUid) return false;
      const other = c.users[c.otherUid];
      if (!other) return false;
      if (!q) return true;
      return (other.name || "").toLowerCase().includes(q) || (other.username || "").toLowerCase().includes(q);
    });

    if (availableChats.length === 0) {
      forwardList.innerHTML = `<p style="text-align:center;font-size:var(--fs-sm);color:var(--text-muted);padding:14px;">No matching conversations found.</p>`;
      return;
    }

    forwardList.innerHTML = availableChats.map(c => {
      let avatarHtml = "";
      let nameHtml = "";
      if (c.isGroup) {
        avatarHtml = c.groupPhotoURL
          ? `<span class="avatar avatar--sm" style="background-image:url('${escapeHtml(c.groupPhotoURL)}');background-size:cover;background-position:center;color:transparent;"></span>`
          : `<span class="avatar avatar--sm" style="background:rgba(110,86,207,0.3);border:1px solid var(--accent);font-size:1rem;display:flex;align-items:center;justify-content:center;">👥</span>`;
        nameHtml = `${escapeHtml(c.groupName || 'Group')} <span class="group-pill" style="margin-left:4px;">Group</span>`;
      } else {
        const other = { uid: c.otherUid, ...c.users[c.otherUid] };
        avatarHtml = renderAvatarHtml(other, "avatar--sm");
        nameHtml = `${escapeHtml(other.name)} <span style="font-size:var(--fs-xs);color:var(--text-muted);margin-left:4px;">@${escapeHtml(other.username)}</span>`;
      }

      return `
        <div class="forward-item" data-chat-id="${c.id}">
          <div class="forward-item__info">
            ${avatarHtml}
            <span class="forward-item__name">${nameHtml}</span>
          </div>
          <button type="button" class="forward-item__send" data-chat-id="${c.id}">Send</button>
        </div>
      `;
    }).join("");

    forwardList.querySelectorAll(".forward-item__send").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const targetChatId = btn.dataset.chatId;
        await executeForwardMessage(targetChatId);
      });
    });

    forwardList.querySelectorAll(".forward-item").forEach(item => {
      item.addEventListener("click", async () => {
        const targetChatId = item.dataset.chatId;
        await executeForwardMessage(targetChatId);
      });
    });
  }

  async function executeForwardMessage(targetChatId) {
    if (!forwardingMessage || !targetChatId || !firebaseUser) return;
    const textToForward = forwardingMessage.text;
    closeForwardModal();

    const targetConv = chats.find(c => c.id === targetChatId);
    const myName = firebaseProfile?.name || firebaseUser.displayName || "User";

    try {
      await addDoc(collection(db, "chats", targetChatId, "messages"), {
        text: textToForward,
        senderId: firebaseUser.uid,
        senderName: myName,
        senderUsername: firebaseProfile?.username || "user",
        senderPhotoURL: firebaseProfile?.photoURL || null,
        forwarded: true,
        createdAt: serverTimestamp(),
        read: false
      });

      if (targetConv && targetConv.isGroup) {
        const unreadUpdates = {};
        (targetConv.participants || []).forEach(pUid => {
          if (pUid !== firebaseUser.uid) {
            unreadUpdates[`unreadCounts.${pUid}`] = increment(1);
          }
        });
        await updateDoc(doc(db, "chats", targetChatId), {
          lastMessage: textToForward,
          lastSenderName: myName,
          updatedAt: serverTimestamp(),
          ...unreadUpdates
        });
      } else {
        const recipientUid = targetConv?.otherUid;
        const unreadField = recipientUid ? { [`unreadCounts.${recipientUid}`]: increment(1) } : {};
        await updateDoc(doc(db, "chats", targetChatId), {
          lastMessage: textToForward,
          updatedAt: serverTimestamp(),
          ...unreadField
        });
      }

      showCustomAlert("Message forwarded successfully.", "Forwarded ➡️");
    } catch (err) {
      console.error("Error forwarding message:", err);
      showCustomAlert("Failed to forward message: " + err.message, "Error");
    }
  }

  /* ---------------------------------------------------------------------
     Group Chats: Creation, Participant Picker, and Group Info
     --------------------------------------------------------------------- */
  async function fetchAllAvailableContacts() {
    const contactsMap = new Map();

    // Only include people who are in our sidebar conversation menu / active chats list
    chats.forEach(c => {
      if (!c.isGroup && c.users && c.otherUid && c.otherUid !== AI_USER.uid) {
        const u = c.users[c.otherUid];
        if (u) {
          contactsMap.set(c.otherUid, { 
            uid: c.otherUid, 
            name: u.name || u.username || "User", 
            username: u.username || "user", 
            photoURL: u.photoURL || null 
          });
        }
      }
    });

    availableContactsCache = Array.from(contactsMap.values());
    return availableContactsCache;
  }

  function renderSelectedGroupBadges() {
    if (!groupSelectedBadges) return;
    if (selectedGroupMemberUids.size === 0) {
      groupSelectedBadges.innerHTML = `<span style="font-size:var(--fs-xs);color:var(--text-muted);font-style:italic;">No members selected yet</span>`;
      return;
    }

    groupSelectedBadges.innerHTML = Array.from(selectedGroupMemberUids).map(uid => {
      const contact = availableContactsCache.find(c => c.uid === uid) || { name: "User" };
      return `
        <span class="group-selected-chip">
          <span>${escapeHtml(contact.name.split(" ")[0])}</span>
          <button type="button" class="group-selected-chip__remove" data-uid="${uid}" aria-label="Remove member">✕</button>
        </span>
      `;
    }).join("");

    groupSelectedBadges.querySelectorAll(".group-selected-chip__remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        selectedGroupMemberUids.delete(uid);
        renderSelectedGroupBadges();
        renderGroupMemberChecklist(groupMemberSearch?.value || "");
      });
    });
  }

  function renderGroupMemberChecklist(filter = "") {
    if (!groupMemberChecklist) return;
    const q = filter.trim().toLowerCase();
    const filtered = availableContactsCache.filter(u => {
      if (!q) return true;
      return (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      const emptyMsg = availableContactsCache.length === 0 
        ? "No contacts in your menu yet. Add contacts to your chat list first."
        : "No matching contacts found.";
      groupMemberChecklist.innerHTML = `<p style="text-align:center;font-size:var(--fs-xs);color:var(--text-muted);padding:14px;">${emptyMsg}</p>`;
      return;
    }

    groupMemberChecklist.innerHTML = filtered.map(u => {
      const isChecked = selectedGroupMemberUids.has(u.uid);
      const photo = u.photoURL || DEFAULT_AVATAR;
      return `
        <div class="group-member-item ${isChecked ? 'is-selected' : ''}" data-uid="${u.uid}">
          <div class="group-member-item__left">
            <span class="avatar avatar--sm" style="background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;color:transparent;"></span>
            <span class="group-member-item__name">${escapeHtml(u.name)} <span class="group-member-item__handle">@${escapeHtml(u.username)}</span></span>
          </div>
          <input type="checkbox" class="group-member-item__checkbox" data-uid="${u.uid}" ${isChecked ? 'checked' : ''}>
        </div>
      `;
    }).join("");

    groupMemberChecklist.querySelectorAll(".group-member-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const uid = item.dataset.uid;
        const checkbox = item.querySelector(".group-member-item__checkbox");
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          selectedGroupMemberUids.add(uid);
          item.classList.add("is-selected");
        } else {
          selectedGroupMemberUids.delete(uid);
          item.classList.remove("is-selected");
        }
        renderSelectedGroupBadges();
      });
    });
  }

  async function openCreateGroupModal() {
    if (!createGroupModal) return;
    selectedGroupMemberUids.clear();
    if (groupNameInput) groupNameInput.value = "";
    if (groupMemberSearch) groupMemberSearch.value = "";
    renderSelectedGroupBadges();
    createGroupModal.removeAttribute("hidden");
    await fetchAllAvailableContacts();
    renderGroupMemberChecklist("");
    if (groupNameInput) groupNameInput.focus();
  }

  function closeCreateGroupModal() {
    if (createGroupModal) createGroupModal.setAttribute("hidden", "true");
  }

  if (newGroupBtn) newGroupBtn.addEventListener("click", openCreateGroupModal);
  if (createGroupClose) createGroupClose.addEventListener("click", closeCreateGroupModal);
  if (groupMemberSearch) {
    groupMemberSearch.addEventListener("input", () => {
      renderGroupMemberChecklist(groupMemberSearch.value);
    });
  }

  if (createGroupForm) {
    createGroupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (groupNameInput?.value || "").trim();
      if (!name) {
        showCustomAlert("Please enter a group name.", "Name Required");
        return;
      }
      if (selectedGroupMemberUids.size === 0) {
        showCustomAlert("Please select at least 1 contact to add to the group.", "Select Members");
        return;
      }

      createGroupSubmit.disabled = true;
      createGroupSubmit.querySelector(".auth-submit__label").textContent = "Creating...";

      try {
        const participantUids = [firebaseUser.uid, ...Array.from(selectedGroupMemberUids)];
        const usersMap = {
          [firebaseUser.uid]: {
            name: firebaseProfile?.name || firebaseUser.displayName || "User",
            username: firebaseProfile?.username || "user",
            photoURL: firebaseProfile?.photoURL || null
          }
        };
        const unreadCountsMap = {
          [firebaseUser.uid]: 0
        };

        participantUids.forEach(uid => {
          if (uid !== firebaseUser.uid) {
            const contact = availableContactsCache.find(c => c.uid === uid) || {};
            usersMap[uid] = {
              name: contact.name || "Member",
              username: contact.username || "user",
              photoURL: contact.photoURL || null
            };
            unreadCountsMap[uid] = 0;
          }
        });

        const newChatRef = await addDoc(collection(db, "chats"), {
          isGroup: true,
          groupName: name,
          groupPhotoURL: null,
          createdBy: firebaseUser.uid,
          admins: [firebaseUser.uid],
          participants: participantUids,
          users: usersMap,
          lastMessage: "Group created",
          lastSenderName: firebaseProfile?.name || "User",
          updatedAt: serverTimestamp(),
          unreadCounts: unreadCountsMap
        });

        closeCreateGroupModal();
        showCustomAlert(`Group "${name}" created!`, "Group Created 👥");

        const newGroupObj = {
          id: newChatRef.id,
          isGroup: true,
          groupName: name,
          participants: participantUids,
          users: usersMap,
          admins: [firebaseUser.uid]
        };
        selectConversation(newChatRef.id, newGroupObj);
      } catch (err) {
        console.error("Error creating group:", err);
        showCustomAlert("Failed to create group: " + err.message, "Error");
      } finally {
        createGroupSubmit.disabled = false;
        createGroupSubmit.querySelector(".auth-submit__label").textContent = "Create Group";
      }
    });
  }

  /* ── Group Info Modal & Management ──────────────────────────────── */
  function openGroupInfoModal() {
    if (!activeChatGroup || !groupInfoModal) return;
    const group = activeChatGroup;
    const count = (group.participants || []).length;

    if (groupInfoName) groupInfoName.textContent = group.groupName || "Group";
    if (groupInfoSub) groupInfoSub.textContent = `${count} member${count > 1 ? 's' : ''}`;

    if (groupInfoAvatar) {
      if (group.groupPhotoURL) {
        groupInfoAvatar.textContent = "";
        groupInfoAvatar.style.backgroundImage = `url('${group.groupPhotoURL}')`;
        groupInfoAvatar.style.backgroundSize = "cover";
      } else {
        groupInfoAvatar.textContent = "👥";
        groupInfoAvatar.style.backgroundImage = "none";
      }
    }

    renderGroupMembersList();
    groupInfoModal.removeAttribute("hidden");
  }

  function closeGroupInfoModal() {
    if (groupInfoModal) groupInfoModal.setAttribute("hidden", "true");
  }

  if (groupInfoClose) groupInfoClose.addEventListener("click", closeGroupInfoModal);

  function renderGroupMembersList() {
    if (!groupMembersList || !activeChatGroup) return;
    const group = activeChatGroup;
    const isCurrentUserAdmin = Array.isArray(group.admins) && group.admins.includes(firebaseUser.uid);
    const participants = group.participants || [];

    groupMembersList.innerHTML = participants.map(uid => {
      const u = (group.users && group.users[uid]) || { name: "Member", username: "user" };
      const isMemberAdmin = Array.isArray(group.admins) && group.admins.includes(uid);
      const isSelf = uid === firebaseUser.uid;
      const photo = u.photoURL || DEFAULT_AVATAR;

      const removeBtnHtml = (isCurrentUserAdmin && !isSelf)
        ? `<button type="button" class="group-member-remove-btn" data-uid="${uid}" title="Remove member">✕ Remove</button>`
        : "";

      return `
        <div class="group-member-row" data-uid="${uid}">
          <div class="group-member-row__info">
            <span class="avatar avatar--sm" style="background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;color:transparent;"></span>
            <span class="group-member-row__name">
              ${escapeHtml(u.name)} ${isSelf ? '<span style="color:var(--text-muted);font-weight:normal;">(You)</span>' : ''}
              ${isMemberAdmin ? '<span class="group-admin-badge">Admin</span>' : ''}
            </span>
          </div>
          ${removeBtnHtml}
        </div>
      `;
    }).join("");

    groupMembersList.querySelectorAll(".group-member-remove-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetUid = btn.dataset.uid;
        await removeMemberFromGroup(activeChatGroup.id, targetUid);
      });
    });
  }

  async function removeMemberFromGroup(groupId, memberUid) {
    const confirmed = await showCustomConfirm("Remove this member from the group?", "Remove Member");
    if (!confirmed || !groupId || !memberUid) return;

    try {
      await updateDoc(doc(db, "chats", groupId), {
        participants: arrayRemove(memberUid),
        [`users.${memberUid}`]: deleteField(),
        [`unreadCounts.${memberUid}`]: deleteField()
      });
      if (activeChatGroup) {
        activeChatGroup.participants = (activeChatGroup.participants || []).filter(u => u !== memberUid);
      }
      renderGroupMembersList();
      showCustomAlert("Member removed from group.", "Updated");
    } catch (err) {
      showCustomAlert("Failed to remove member: " + err.message, "Error");
    }
  }

  if (groupLeaveBtn) {
    groupLeaveBtn.addEventListener("click", async () => {
      if (!activeChatGroup) return;
      const confirmed = await showCustomConfirm("Are you sure you want to leave this group chat?", "Leave Group");
      if (!confirmed) return;

      const groupId = activeChatGroup.id;
      closeGroupInfoModal();

      try {
        await updateDoc(doc(db, "chats", groupId), {
          participants: arrayRemove(firebaseUser.uid),
          [`users.${firebaseUser.uid}`]: deleteField(),
          [`unreadCounts.${firebaseUser.uid}`]: deleteField()
        });
        closeChatPane();
        showCustomAlert("You have left the group.", "Left Group");
      } catch (err) {
        showCustomAlert("Failed to leave group: " + err.message, "Error");
      }
    });
  }

  /* ── Add Member to Existing Group ────────────────────────────────── */
  async function openGroupAddMemberModal() {
    if (!activeChatGroup || !groupAddMemberModal) return;
    selectedAddMemberUids.clear();
    if (addMemberSearch) addMemberSearch.value = "";
    groupAddMemberModal.removeAttribute("hidden");
    await fetchAllAvailableContacts();
    renderAddMemberChecklist("");
  }

  function closeGroupAddMemberModal() {
    if (groupAddMemberModal) groupAddMemberModal.setAttribute("hidden", "true");
  }

  if (groupAddMemberBtn) groupAddMemberBtn.addEventListener("click", openGroupAddMemberModal);
  if (groupAddMemberClose) groupAddMemberClose.addEventListener("click", closeGroupAddMemberModal);

  if (addMemberSearch) {
    addMemberSearch.addEventListener("input", () => {
      renderAddMemberChecklist(addMemberSearch.value);
    });
  }

  function renderAddMemberChecklist(filter = "") {
    if (!addMemberChecklist || !activeChatGroup) return;
    const currentMembers = new Set(activeChatGroup.participants || []);
    const q = filter.trim().toLowerCase();

    const candidates = availableContactsCache.filter(u => {
      if (currentMembers.has(u.uid)) return false;
      if (!q) return true;
      return (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
    });

    if (candidates.length === 0) {
      const emptyMsg = availableContactsCache.length === 0
        ? "No contacts in your menu yet."
        : "All contacts in your menu are already in this group.";
      addMemberChecklist.innerHTML = `<p style="text-align:center;font-size:var(--fs-xs);color:var(--text-muted);padding:14px;">${emptyMsg}</p>`;
      return;
    }

    addMemberChecklist.innerHTML = candidates.map(u => {
      const isChecked = selectedAddMemberUids.has(u.uid);
      const photo = u.photoURL || DEFAULT_AVATAR;
      return `
        <div class="group-member-item ${isChecked ? 'is-selected' : ''}" data-uid="${u.uid}">
          <div class="group-member-item__left">
            <span class="avatar avatar--sm" style="background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;color:transparent;"></span>
            <span class="group-member-item__name">${escapeHtml(u.name)} <span class="group-member-item__handle">@${escapeHtml(u.username)}</span></span>
          </div>
          <input type="checkbox" class="group-member-item__checkbox" data-uid="${u.uid}" ${isChecked ? 'checked' : ''}>
        </div>
      `;
    }).join("");

    addMemberChecklist.querySelectorAll(".group-member-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const uid = item.dataset.uid;
        const checkbox = item.querySelector(".group-member-item__checkbox");
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          selectedAddMemberUids.add(uid);
          item.classList.add("is-selected");
        } else {
          selectedAddMemberUids.delete(uid);
          item.classList.remove("is-selected");
        }
      });
    });
  }

  if (groupAddMemberSubmit) {
    groupAddMemberSubmit.addEventListener("click", async () => {
      if (!activeChatGroup || selectedAddMemberUids.size === 0) {
        showCustomAlert("Please select at least 1 contact to add.", "Selection Required");
        return;
      }

      const groupId = activeChatGroup.id;
      const uidsToAdd = Array.from(selectedAddMemberUids);
      closeGroupAddMemberModal();

      try {
        const updatePayload = {
          participants: arrayUnion(...uidsToAdd)
        };
        uidsToAdd.forEach(uid => {
          const contact = availableContactsCache.find(c => c.uid === uid) || {};
          updatePayload[`users.${uid}`] = {
            name: contact.name || "Member",
            username: contact.username || "user",
            photoURL: contact.photoURL || null
          };
          updatePayload[`unreadCounts.${uid}`] = 0;
        });

        await updateDoc(doc(db, "chats", groupId), updatePayload);
        showCustomAlert("Members added to group successfully!", "Members Added 👥");
        openGroupInfoModal();
      } catch (err) {
        showCustomAlert("Failed to add members: " + err.message, "Error");
      }
    });
  }

  function openMessageContextMenu(e, msg) {
    e.preventDefault();
    closeContextMenu();

    const isMe = msg.senderId === firebaseUser.uid;

    const menu = document.createElement("div");
    menu.className = "context-menu";

    let itemsHtml = `
      <div class="context-menu__reactions">
        <button type="button" class="ctx-reaction-btn" data-emoji="❤️">❤️</button>
        <button type="button" class="ctx-reaction-btn" data-emoji="😂">😂</button>
        <button type="button" class="ctx-reaction-btn" data-emoji="😮">😮</button>
        <button type="button" class="ctx-reaction-btn" data-emoji="😢">😢</button>
        <button type="button" class="ctx-reaction-btn" data-emoji="🔥">🔥</button>
        <button type="button" class="ctx-reaction-btn" data-emoji="👍">👍</button>
      </div>
      <button type="button" class="context-menu__item" id="ctxReplyMsg">
        <span>↩️</span> Reply
      </button>
      <button type="button" class="context-menu__item" id="ctxForwardMsg">
        <span>➡️</span> Forward
      </button>
      <button type="button" class="context-menu__item" id="ctxCopyMsg">
        <span>📋</span> Copy Text
      </button>
      <button type="button" class="context-menu__item" id="ctxTranslateMsg">
        <span>🌐</span> Translate
      </button>
    `;

    if (isMe) {
      itemsHtml += `
        <button type="button" class="context-menu__item" id="ctxEditMsg">
          <span>✏️</span> Edit Message
        </button>
        <button type="button" class="context-menu__item context-menu__item--danger" id="ctxDeleteMsg">
          <span>🗑️</span> Unsend Message
        </button>
      `;
    }

    menu.innerHTML = itemsHtml;
    document.body.appendChild(menu);
    activeContextMenu = menu;

    const menuWidth = 200;
    const menuHeight = isMe ? 280 : 190;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    menu.querySelectorAll(".ctx-reaction-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        closeContextMenu();
        toggleReaction(msg.id, btn.dataset.emoji);
      });
    });

    menu.querySelector("#ctxReplyMsg").addEventListener("click", () => {
      closeContextMenu();
      startReplying(msg);
    });

    menu.querySelector("#ctxForwardMsg").addEventListener("click", () => {
      closeContextMenu();
      openForwardModal(msg);
    });

    menu.querySelector("#ctxCopyMsg").addEventListener("click", async () => {
      closeContextMenu();
      try {
        await navigator.clipboard.writeText(msg.text);
        showCustomAlert("Message copied to clipboard.", "Copied");
      } catch (err) {
        showCustomAlert("Failed to copy message text.", "Error");
      }
    });

    menu.querySelector("#ctxTranslateMsg").addEventListener("click", () => {
      closeContextMenu();
      translateMessage(msg);
    });

    if (isMe) {
      menu.querySelector("#ctxEditMsg").addEventListener("click", () => {
        closeContextMenu();
        startEditingMessage(msg);
      });

      menu.querySelector("#ctxDeleteMsg").addEventListener("click", () => {
        closeContextMenu();
        unsendMessage(msg);
      });
    }
  }

  function startReplying(msg) {
    if (!msg) return;
    if (editingMessageId) cancelEditingMessage();

    const isMe = msg.senderId === firebaseUser.uid;
    const isAI = msg.senderId === AI_USER.uid;
    let senderName = "User";
    if (isMe) {
      senderName = "You";
    } else if (isAI) {
      senderName = "Relay AI";
    } else if (msg.senderName) {
      senderName = msg.senderName;
    } else if (activeChatUser?.name) {
      senderName = activeChatUser.name;
    }

    replyingTo = {
      id: msg.id,
      text: msg.text,
      senderName: senderName,
      senderId: msg.senderId
    };

    if (replyBar) {
      if (replyBarSender) replyBarSender.textContent = senderName;
      if (replyBarPreview) replyBarPreview.textContent = msg.text;
      replyBar.hidden = false;
    }

    if (!MOBILE_QUERY.matches) {
      messageInput.focus();
    }
  }

  function cancelReplying() {
    replyingTo = null;
    if (replyBar) replyBar.hidden = true;
    if (replyBarSender) replyBarSender.textContent = "";
    if (replyBarPreview) replyBarPreview.textContent = "";
  }

  if (replyBarCancel) {
    replyBarCancel.addEventListener("click", cancelReplying);
  }

  function cancelEditingMessage() {
    editingMessageId = null;
    if (editingBar) editingBar.hidden = true;
    if (editingBarPreview) editingBarPreview.textContent = "";
    messageInput.value = "";
    sendBtn.disabled = true;
    sendBtn.classList.remove("is-active");
  }

  if (editingBarCancel) {
    editingBarCancel.addEventListener("click", cancelEditingMessage);
  }

  function startEditingMessage(msg) {
    if (!msg || !msg.id) return;
    if (replyingTo) cancelReplying();
    editingMessageId = msg.id;

    if (editingBar && editingBarPreview) {
      editingBarPreview.textContent = msg.text;
      editingBar.hidden = false;
    }

    messageInput.value = msg.text;
    messageInput.focus();
    const hasText = msg.text.trim().length > 0;
    sendBtn.disabled = !hasText;
    sendBtn.classList.toggle("is-active", hasText);
  }

  async function unsendMessage(msg) {
    if (!msg || !msg.id || !activeChatId) return;

    const confirmed = await showCustomConfirm("Are you sure you want to unsend this message? It will be deleted for everyone in this chat.", "Unsend Message");
    if (!confirmed) return;

    if (editingMessageId === msg.id) {
      cancelEditingMessage();
    }

    try {
      await deleteDoc(doc(db, "chats", activeChatId, "messages", msg.id));

      const remainingMsgs = currentMessages.filter(m => m.id !== msg.id);
      const newLastMsg = remainingMsgs.length > 0 ? remainingMsgs[remainingMsgs.length - 1].text : "";

      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: newLastMsg
      });
    } catch (err) {
      console.error("Error unsending message:", err);
      showCustomAlert("Failed to unsend message: " + err.message, "Error");
    }
  }

  /* ---------------------------------------------------------------------
     Render: conversation list
     --------------------------------------------------------------------- */
  function renderConvList(filter = "") {
    const query = filter.trim().toLowerCase();
    convListEl.innerHTML = "";

    const currentUid = firebaseUser?.uid || firebaseProfile?.uid || null;

    if (sidebarEmpty) {
      sidebarEmpty.hidden = chats.length > 0;
    }

    sortChats();

    chats
      .filter((c) => {
        const q = query.replace(/^@/, "");
        if (c.isGroup) {
          return (c.groupName || "").toLowerCase().includes(query);
        }
        let otherUser = c.users && c.otherUid ? c.users[c.otherUid] : null;
        if (!otherUser && c.otherUid) {
          try {
            const rawCache = localStorage.getItem("relay_user_cache_" + c.otherUid);
            if (rawCache) otherUser = JSON.parse(rawCache);
          } catch (_) {}
        }
        if (!otherUser) return true;
        const uName = otherUser.name || "";
        const uHandle = otherUser.username || "";
        return uName.toLowerCase().includes(query) || uHandle.toLowerCase().includes(q);
      })
      .forEach((conv) => {
        const isGroup = !!conv.isGroup;
        let otherUser = isGroup ? null : (conv.users && conv.otherUid ? { uid: conv.otherUid, ...conv.users[conv.otherUid] } : null);
        if (!isGroup && !otherUser && conv.otherUid) {
          try {
            const rawCache = localStorage.getItem("relay_user_cache_" + conv.otherUid);
            if (rawCache) otherUser = { uid: conv.otherUid, ...JSON.parse(rawCache) };
          } catch (_) {}
        }
        if (!isGroup && !otherUser) {
          otherUser = { uid: conv.otherUid || "user", name: "Conversation", username: "user" };
        }

        const unreadCount = (currentUid && conv.unreadCounts && conv.unreadCounts[currentUid]) || 0;
        const isPinned = Array.isArray(firebaseProfile?.pinnedChats) && firebaseProfile.pinnedChats.includes(conv.id);
        const isMuted = isChatMuted(conv.id);

        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item";
        item.dataset.id = conv.id;
        if (conv.id === activeChatId) item.classList.add("is-active");
        if (unreadCount > 0 && conv.id !== activeChatId) item.classList.add("has-unread");
        if (isPinned) item.classList.add("is-pinned");
        if (isMuted) item.classList.add("is-muted");

        const displayName = isGroup ? (conv.groupName || "Group") : (otherUser?.name || "User");
        item.setAttribute("aria-label", `Open conversation with ${displayName}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`);

        let lastText = conv.lastMessage || "No messages yet";
        if (isGroup && conv.lastSenderName && conv.lastMessage) {
          lastText = `${conv.lastSenderName.split(" ")[0]}: ${conv.lastMessage}`;
        }

        let timeStr = "";
        if (conv.updatedAt) {
          const date = conv.updatedAt.toDate ? conv.updatedAt.toDate() : new Date(conv.updatedAt);
          timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }

        let requestTagHtml = "";
        if (!isGroup && conv.status === "pending" && currentUid) {
          if (conv.requestedTo === currentUid) {
            requestTagHtml = `<span class="request-pill">Request</span>`;
          } else if (conv.requestedBy === currentUid) {
            requestTagHtml = `<span class="request-pill request-pill--muted">Pending</span>`;
          }
        }

        const groupBadgeHtml = isGroup ? `<span class="group-pill">Group</span>` : "";
        const pinIconHtml = isPinned ? `<span class="conv-item__pin" title="Pinned conversation" aria-label="Pinned">📌</span>` : "";
        const muteIconHtml = isMuted ? `<span class="conv-item__mute" title="Muted conversation" aria-label="Muted">🔕</span>` : "";

        const badgeHtml = (unreadCount > 0 && conv.id !== activeChatId)
          ? `<span class="unread-badge" aria-label="${unreadCount} unread messages">${unreadCount > 99 ? "99+" : unreadCount}</span>`
          : "";

        let avatarHtml = "";
        if (isGroup) {
          avatarHtml = conv.groupPhotoURL
            ? `<span class="avatar avatar--sm" style="background-image: url('${escapeHtml(conv.groupPhotoURL)}'); background-size: cover; background-position: center; color: transparent;"></span>`
            : `<span class="avatar avatar--sm" style="background: rgba(110, 86, 207, 0.3); border: 1px solid var(--accent); font-size: 1.05rem; display:flex; align-items:center; justify-content:center;">👥</span>`;
        } else {
          avatarHtml = renderAvatarHtml(otherUser, "avatar--sm");
        }

        item.innerHTML = `
          <span class="avatar-wrap">
            ${avatarHtml}
          </span>
          <span class="conv-item__body">
            <span class="conv-item__top">
              <span class="conv-item__name" style="display:flex;align-items:center;gap:4px;min-width:0;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(displayName)}</span>
                ${groupBadgeHtml}
                ${pinIconHtml}
                ${muteIconHtml}
                ${requestTagHtml}
              </span>
              <span class="conv-item__time">${timeStr}</span>
            </span>
            <span class="conv-item__preview-row">
              <span class="conv-item__preview">${escapeHtml(lastText)}</span>
              ${badgeHtml}
            </span>
          </span>
        `;

        const targetArg = isGroup ? conv : otherUser;
        item.addEventListener("click", () => selectConversation(conv.id, targetArg));
        item.addEventListener("contextmenu", (e) => openChatContextMenu(e, conv, targetArg));

        let touchTimer = null;
        item.addEventListener("touchstart", (e) => {
          touchTimer = setTimeout(() => {
            const touch = e.touches[0];
            if (touch) {
              openChatContextMenu({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY }, conv, targetArg);
            }
          }, 500);
        }, { passive: true });
        item.addEventListener("touchend", () => clearTimeout(touchTimer));
        item.addEventListener("touchmove", () => clearTimeout(touchTimer));

        convListEl.appendChild(item);
      });
  }

  /* ---------------------------------------------------------------------
     Render: message thread
     --------------------------------------------------------------------- */
  function renderThread() {
    threadEl.innerHTML = "";

    currentMessages.forEach((msg, i) => {
      const prev = currentMessages[i - 1];
      const next = currentMessages[i + 1];
      const sameAsPrev = prev && prev.senderId === msg.senderId;
      const sameAsNext = next && next.senderId === msg.senderId;

      let groupClass = "group-start";
      if (sameAsPrev && sameAsNext) groupClass = "group-mid";
      else if (sameAsPrev && !sameAsNext) groupClass = "group-end";
      else if (!sameAsPrev && !sameAsNext) groupClass = "group-start";

      const isMe = msg.senderId === firebaseUser.uid;

      const row = document.createElement("div");
      row.className = `msg-row is-${isMe ? "out" : "in"} ${groupClass}`;

      let timeStr = "";
      if (msg.createdAt) {
          const date = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date();
          timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }

      // Show read receipt ticks only if the other user has read receipts enabled
      const recipientHasReceiptsOn = activeChatUser?.preferences?.readReceipts !== false;
      let checks = "";
      if (isMe) {
        if (msg.read && recipientHasReceiptsOn) {
          // Double tick (read)
          checks = `<span class="checkmarks is-read" aria-label="Read" aria-hidden="true">
               <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                 <path d="M1 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                 <path d="M6 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </span>`;
        } else {
          // Single tick (sent/delivered)
          checks = `<span class="checkmarks" aria-label="Sent" aria-hidden="true">
               <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                 <path d="M2 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </span>`;
        }
      }

      const editedHtml = msg.edited ? `<span class="bubble__edited" title="Edited">(edited)</span>` : "";
      const forwardedHtml = msg.forwarded ? `<div class="bubble__forwarded"><span>↗</span> Forwarded</div>` : "";

      let renderedTextHtml = escapeHtml(msg.text);
      if (threadSearchQuery) {
        const escapedQ = threadSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQ})`, "gi");
        renderedTextHtml = renderedTextHtml.replace(regex, `<mark class="search-highlight">$1</mark>`);
      }

      let quoteHtml = "";
      if (msg.replyTo) {
        quoteHtml = `
          <div class="bubble__quote" data-reply-id="${escapeHtml(msg.replyTo.id || '')}">
            <span class="bubble__quote-sender">${escapeHtml(msg.replyTo.senderName || 'Replying')}</span>
            <span class="bubble__quote-text">${escapeHtml(msg.replyTo.text || '')}</span>
          </div>
        `;
      }

      let reactionsHtml = "";
      if (msg.reactions && typeof msg.reactions === "object") {
        const counts = {};
        const myReaction = msg.reactions[firebaseUser?.uid];
        Object.values(msg.reactions).forEach(emoji => {
          if (emoji) counts[emoji] = (counts[emoji] || 0) + 1;
        });

        const reactionEntries = Object.entries(counts);
        if (reactionEntries.length > 0) {
          reactionsHtml = `
            <div class="bubble__reactions">
              ${reactionEntries.map(([emoji, count]) => {
                const isMeReaction = myReaction === emoji;
                return `<button type="button" class="bubble-reaction-pill ${isMeReaction ? 'is-me' : ''}" data-emoji="${escapeHtml(emoji)}" title="${count} reaction${count > 1 ? 's' : ''}">
                  <span>${emoji}</span>
                  ${count > 1 ? `<span class="bubble-reaction-count">${count}</span>` : ''}
                </button>`;
              }).join("")}
            </div>
          `;
        }
      }

      const floatingReactionHtml = `
        <div class="msg-reaction-bar" aria-label="Quick reactions">
          <button type="button" class="reaction-btn" data-emoji="❤️" title="Love">❤️</button>
          <button type="button" class="reaction-btn" data-emoji="😂" title="Laugh">😂</button>
          <button type="button" class="reaction-btn" data-emoji="😮" title="Surprised">😮</button>
          <button type="button" class="reaction-btn" data-emoji="😢" title="Sad">😢</button>
          <button type="button" class="reaction-btn" data-emoji="🔥" title="Fire">🔥</button>
          <button type="button" class="reaction-btn" data-emoji="👍" title="Thumbs up">👍</button>
        </div>
      `;

      let senderNameHtml = "";
      if (activeChatGroup && !isMe) {
        senderNameHtml = `<div class="bubble__sender-name">${escapeHtml(msg.senderName || msg.senderUsername || 'Member')}</div>`;
      }

      row.innerHTML = `
        <div class="reply-swipe-hint">↩️</div>
        ${floatingReactionHtml}
        <div class="bubble" id="msg-${msg.id}" data-id="${msg.id}">
          ${senderNameHtml}
          ${forwardedHtml}
          ${quoteHtml}
          <span class="bubble__text">${renderedTextHtml}</span>
          <span class="bubble__meta">${editedHtml}${timeStr}${checks}</span>
          ${reactionsHtml}
        </div>
      `;

      // Reaction bar clicks
      row.querySelectorAll(".reaction-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const emoji = btn.dataset.emoji;
          toggleReaction(msg.id, emoji);
        });
      });

      // Reaction badge pill clicks
      row.querySelectorAll(".bubble-reaction-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
          e.stopPropagation();
          const emoji = pill.dataset.emoji;
          toggleReaction(msg.id, emoji);
        });
      });

      const bubbleEl = row.querySelector(".bubble");
      const quoteEl = row.querySelector(".bubble__quote");

      if (quoteEl) {
        quoteEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const targetId = quoteEl.dataset.replyId;
          if (!targetId) return;
          const targetBubble = threadEl.querySelector(`[data-id="${targetId}"]`);
          if (targetBubble) {
            targetBubble.scrollIntoView({ behavior: "smooth", block: "center" });
            targetBubble.classList.add("search-active-match");
            setTimeout(() => targetBubble.classList.remove("search-active-match"), 1200);
          }
        });
      }

      if (bubbleEl) {
        bubbleEl.addEventListener("contextmenu", (e) => openMessageContextMenu(e, msg));

        // Touch handling: Long-press to open menu & Swipe to reply (Instagram style)
        let touchTimer = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        bubbleEl.addEventListener("touchstart", (e) => {
          if (e.touches.length > 1) return;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          isSwiping = false;

          touchTimer = setTimeout(() => {
            if (!isSwiping) {
              openMessageContextMenu({ preventDefault: () => {}, clientX: touchStartX, clientY: touchStartY }, msg);
            }
          }, 450);
        }, { passive: true });

        bubbleEl.addEventListener("touchmove", (e) => {
          if (e.touches.length > 1) return;
          const currentX = e.touches[0].clientX;
          const currentY = e.touches[0].clientY;
          const deltaX = currentX - touchStartX;
          const deltaY = currentY - touchStartY;

          // If vertical scrolling detected, cancel long-press and let page scroll
          if (Math.abs(deltaY) > 8 && !isSwiping) {
            clearTimeout(touchTimer);
            return;
          }

          // Direction logic: Swiping opposite/inward from bubble edge
          // Outgoing message (isMe): swiping left (deltaX < 0)
          // Incoming message (!isMe): swiping right (deltaX > 0)
          const isValidSwipe = isMe ? (deltaX < -5) : (deltaX > 5);

          if (isValidSwipe) {
            isSwiping = true;
            clearTimeout(touchTimer);

            const maxSwipe = 60;
            const clamped = isMe ? Math.max(-maxSwipe, Math.min(0, deltaX)) : Math.min(maxSwipe, Math.max(0, deltaX));
            row.classList.add("is-swiping");
            row.style.transform = `translateX(${clamped}px)`;

            if (Math.abs(clamped) >= 42) {
              row.classList.add("swipe-ready");
            } else {
              row.classList.remove("swipe-ready");
            }
          }
        }, { passive: true });

        bubbleEl.addEventListener("touchend", () => {
          clearTimeout(touchTimer);
          const wasReady = row.classList.contains("swipe-ready");
          row.classList.remove("is-swiping");
          row.classList.remove("swipe-ready");
          row.style.transform = "";

          if (wasReady) {
            if (navigator.vibrate) try { navigator.vibrate(25); } catch(_) {}
            startReplying(msg);
          }
        });

        bubbleEl.addEventListener("touchcancel", () => {
          clearTimeout(touchTimer);
          row.classList.remove("is-swiping");
          row.classList.remove("swipe-ready");
          row.style.transform = "";
        });
      }

      threadEl.appendChild(row);
    });

    threadEl.scrollTop = threadEl.scrollHeight;
  }

  /* ---------------------------------------------------------------------
     Render: chat header
     --------------------------------------------------------------------- */
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

  function renderChatHeader(target) {
    if (activeChatGroup) {
      chatNameEl.textContent = activeChatGroup.groupName || "Group";
      const photo = activeChatGroup.groupPhotoURL;
      chatAvatarEl.textContent = photo ? "" : "👥";
      if (photo) {
        chatAvatarEl.style.backgroundImage = `url('${photo}')`;
        chatAvatarEl.style.backgroundSize = "cover";
        chatAvatarEl.style.backgroundPosition = "center";
        chatAvatarEl.style.color = "transparent";
      } else {
        chatAvatarEl.style.backgroundImage = "none";
        chatAvatarEl.style.color = "var(--text-primary)";
        chatAvatarEl.style.fontSize = "1.2rem";
        chatAvatarEl.style.display = "flex";
        chatAvatarEl.style.alignItems = "center";
        chatAvatarEl.style.justifyContent = "center";
      }
      const count = (activeChatGroup.participants || []).length;
      chatStatusEl.innerHTML = `<span class="chat__handle">${count} member${count !== 1 ? 's' : ''} • Tap for group info</span>`;
    } else if (target) {
      chatNameEl.textContent = target.name || "User";
      const photo = (target && target.photoURL) || DEFAULT_AVATAR;
      chatAvatarEl.textContent = "";
      chatAvatarEl.style.backgroundImage = `url('${photo}')`;
      chatAvatarEl.style.backgroundSize = "cover";
      chatAvatarEl.style.backgroundPosition = "center";
      chatAvatarEl.style.color = "transparent";
      chatStatusEl.innerHTML = `<span class="chat__handle">@${escapeHtml(target.username || "")}</span>`;
    }
  }
  
  function updateChatStatus(statusText, isOnline) {
    chatStatusEl.innerHTML = `<span class="chat__status ${isOnline ? 'is-online' : ''}">${escapeHtml(statusText)}</span>`;
  }

  function isUserBlocked(uid) {
    if (!firebaseProfile || !firebaseProfile.blockedUsers) return false;
    return Array.isArray(firebaseProfile.blockedUsers) && firebaseProfile.blockedUsers.includes(uid);
  }

  function isBlockedByOther(otherUser) {
    if (!otherUser || !otherUser.blockedUsers || !firebaseUser) return false;
    return Array.isArray(otherUser.blockedUsers) && otherUser.blockedUsers.includes(firebaseUser.uid);
  }

  function updateBlockedUI(otherUser) {
    if (!otherUser) return;
    const iBlockedThem = isUserBlocked(otherUser.uid);
    const theyBlockedMe = isBlockedByOther(otherUser);

    if (blockUserBtnLabel) {
      blockUserBtnLabel.textContent = iBlockedThem ? "Unblock user" : "Block user";
    }

    if (iBlockedThem) {
      messageInput.disabled = true;
      messageInput.value = "";
      messageInput.placeholder = `You blocked @${otherUser.username}. Unblock to message.`;
      sendBtn.disabled = true;
      sendBtn.classList.remove("is-active");
    } else if (theyBlockedMe) {
      messageInput.disabled = true;
      messageInput.value = "";
      messageInput.placeholder = "You cannot reply to this conversation.";
      sendBtn.disabled = true;
      sendBtn.classList.remove("is-active");
    } else {
      messageInput.disabled = false;
      messageInput.placeholder = "Start typing…";
    }
  }

  /* ---------------------------------------------------------------------
     Selecting a conversation
     --------------------------------------------------------------------- */
  function selectConversation(id, target) {
    cancelEditingMessage();
    cancelReplying();
    closeThreadSearch();
    activeChatId = id;

    const isGroup = !!(target?.isGroup || chats.find(c => c.id === id)?.isGroup);
    if (isGroup) {
      activeChatGroup = target?.isGroup ? target : chats.find(c => c.id === id);
      activeChatUser = null;
    } else {
      activeChatGroup = null;
      activeChatUser = target;
    }

    // Push or update history state so Android system back gesture / back button returns to conversation list
    if (!history.state || !history.state.chatOpen) {
      history.pushState({ chatOpen: true, chatId: id }, "");
    } else if (history.state.chatId !== id) {
      history.replaceState({ chatOpen: true, chatId: id }, "");
    }

    renderConvList(searchInput.value);
    renderChatHeader(target);
    if (isGroup) {
      messageInput.disabled = false;
      messageInput.placeholder = `Message ${activeChatGroup?.groupName || "group"}…`;
      sendBtn.disabled = true;
      sendBtn.classList.remove("is-active");
    } else {
      updateBlockedUI(activeChatUser);
    }
    showChatPane();

    // Trigger smooth transition animation when switching conversations
    if (threadEl) {
      threadEl.classList.remove("is-switching");
      void threadEl.offsetWidth;
      threadEl.classList.add("is-switching");
    }
    if (chatHeaderEl) {
      chatHeaderEl.classList.remove("is-switching");
      void chatHeaderEl.offsetWidth;
      chatHeaderEl.classList.add("is-switching");
    }

    if (MOBILE_QUERY.matches) {
      appEl.classList.add("is-chat-open");
    }

    // Only auto-focus the input on desktop; on mobile, focusing
    // immediately triggers the virtual keyboard which resizes the layout.
    if (!MOBILE_QUERY.matches) {
      messageInput.focus({ preventScroll: true });
    }

    // Clear unread count for this user when they open the chat
    updateDoc(doc(db, "chats", id), {
      [`unreadCounts.${firebaseUser.uid}`]: 0
    }).catch(() => {});
    
    // Unsubscribe from previous listeners
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (otherUserUnsubscribe) otherUserUnsubscribe();
    if (chatDocUnsubscribe) chatDocUnsubscribe();
    
    // Subscribe to messages (limit to recent 100 for fast loading & low bandwidth)
    const messagesRef = collection(db, "chats", id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limitToLast(100));
    
    let lastKnownMsgCount = 0;
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const newMsgs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        if (newMsgs.length > lastKnownMsgCount && lastKnownMsgCount > 0) {
          const latestMsg = newMsgs[newMsgs.length - 1];
          if (latestMsg && latestMsg.senderId !== firebaseUser.uid) {
            if (!isChatMuted(id)) {
              playReceiveSound();
            }
          }
        }
        lastKnownMsgCount = newMsgs.length;

        currentMessages = newMsgs;
        renderThread();
        updateSmartReplies();
        markMessagesRead();
    });
    
    if (!isGroup && activeChatUser?.uid) {
      // Subscribe to the other user's profile changes, online status & block status
      otherUserUnsubscribe = onSnapshot(doc(db, "users", activeChatUser.uid), (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          
          activeChatUser.photoURL = data.photoURL || null;
          activeChatUser.name = data.name || activeChatUser.name;
          activeChatUser.blockedUsers = data.blockedUsers || [];
          activeChatUser.preferences = data.preferences || {};

          renderChatHeader(activeChatUser);
          renderConvList(searchInput.value);
          updateBlockedUI(activeChatUser);

          if (data.preferences?.onlineStatus === false) {
              updateChatStatus("", false);
          } else if (data.online) {
              updateChatStatus("Online", true);
          } else {
              updateChatStatus(formatLastSeen(data.lastSeen), false);
          }
      });
    }

    // Mark messages as read when this chat is open (if MY read receipts are on)
    const markMessagesRead = () => {
      if (firebaseProfile?.preferences?.readReceipts === false) return;
      if (activeChatId !== id) return;
      const batch = currentMessages.filter(m => !m.read && m.senderId !== firebaseUser.uid);
      batch.forEach(m => {
        updateDoc(doc(db, "chats", id, "messages", m.id), { read: true }).catch(() => {});
      });
    };
    
    // Subscribe to chat doc for typing indicator & request status updates
    chatDocUnsubscribe = onSnapshot(doc(db, "chats", id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (isGroup) {
          activeChatGroup = { id: snap.id, ...data };
          renderChatHeader(activeChatGroup);

          const typing = data.typing || {};
          const typingUsers = Object.keys(typing)
            .filter(uid => uid !== firebaseUser.uid && typing[uid])
            .map(uid => (data.users && data.users[uid]?.name?.split(" ")[0]) || "Someone");

          if (typingUsers.length === 1) {
            updateChatStatus(`${typingUsers[0]} is typing...`, true);
          } else if (typingUsers.length > 1) {
            updateChatStatus(`${typingUsers.length} people are typing...`, true);
          } else {
            const count = (data.participants || []).length;
            chatStatusEl.innerHTML = `<span class="chat__handle">${count} member${count !== 1 ? 's' : ''} • Tap for group info</span>`;
          }
          return;
        }

        if (!activeChatUser) return;

        const status = data.status || "accepted";
        const requestedBy = data.requestedBy;
        const requestedTo = data.requestedTo;

        if (status === "pending") {
          if (requestedTo === firebaseUser.uid) {
            if (composer) composer.hidden = true;
            if (requestBanner) {
              requestBanner.hidden = false;
              if (requestBannerText) {
                requestBannerText.innerHTML = `<strong>@${escapeHtml(activeChatUser.username || "User")}</strong> sent you a message request.`;
              }
              if (requestBannerSub) {
                requestBannerSub.hidden = false;
                requestBannerSub.textContent = "They won't know you've seen their message until you accept.";
              }
              if (requestBannerActions) requestBannerActions.hidden = false;
            }
          } else {
            if (requestBanner) requestBanner.hidden = true;
            if (composer) composer.hidden = false;
            messageInput.disabled = true;
            messageInput.value = "";
            messageInput.placeholder = `Message request sent. You can chat once @${activeChatUser.username || "User"} accepts.`;
            sendBtn.disabled = true;
            sendBtn.classList.remove("is-active");
          }
        } else if (status === "rejected") {
          if (composer) composer.hidden = true;
          if (requestBanner) {
            requestBanner.hidden = false;
            if (requestBannerText) {
              requestBannerText.textContent = "This message request was declined.";
            }
            if (requestBannerSub) requestBannerSub.hidden = true;
            if (requestBannerActions) requestBannerActions.hidden = true;
          }
        } else {
          if (requestBanner) requestBanner.hidden = true;
          if (composer) composer.hidden = false;
          updateBlockedUI(activeChatUser);
        }

        const typing = data.typing || {};
        if (typing[activeChatUser.uid]) {
            updateChatStatus("Typing...", true);
        }
    });
  }

  /* ---------------------------------------------------------------------
     Chat pane vs. empty state
     --------------------------------------------------------------------- */
  function showChatPane() {
    if (chatSkeleton) chatSkeleton.hidden = true;
    chatHeaderEl.hidden = false;
    threadEl.hidden = false;
    composer.hidden = false;
    if (chatEmpty) chatEmpty.hidden = true;
  }

  function showEmptyState() {
    if (chatSkeleton) chatSkeleton.hidden = true;
    chatHeaderEl.hidden = true;
    threadEl.hidden = true;
    composer.hidden = true;
    if (chatEmpty) chatEmpty.hidden = false;
  }

  function closeChatPane() {
    cancelEditingMessage();
    closeThreadSearch();
    appEl.classList.remove("is-chat-open");
    activeChatId = null;
    activeChatUser = null;
    activeChatGroup = null;
    if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
    if (otherUserUnsubscribe) { otherUserUnsubscribe(); otherUserUnsubscribe = null; }
    if (chatDocUnsubscribe) { chatDocUnsubscribe(); chatDocUnsubscribe = null; }
    renderConvList(searchInput.value);
    showEmptyState();
  }

  /* ---------------------------------------------------------------------
     Chat header menu: open/close + all contact actions (Pin, Mute, Search, AI Summarize, Block, Delete)
     --------------------------------------------------------------------- */
  function closeChatMenu() {
    chatMenuDropdown.hidden = true;
    chatMenuBtn.setAttribute("aria-expanded", "false");
  }

  function openChatMenu() {
    if (!activeChatId) return;

    const isPinned = Array.isArray(firebaseProfile?.pinnedChats) && firebaseProfile.pinnedChats.includes(activeChatId);
    const isMuted = isChatMuted(activeChatId);

    if (activeChatGroup) {
      if (viewProfileChatMenuBtnLabel) viewProfileChatMenuBtnLabel.textContent = "Group Info";
      if (viewProfileChatMenuBtnIcon) viewProfileChatMenuBtnIcon.textContent = "👥";
      if (blockUserBtnLabel) blockUserBtnLabel.textContent = "Leave Group";
    } else {
      const targetUid = activeChatUser?.uid || activeChatUser?.id;
      const isBlocked = targetUid ? isUserBlocked(targetUid) : false;
      if (viewProfileChatMenuBtnLabel) viewProfileChatMenuBtnLabel.textContent = "View Profile";
      if (viewProfileChatMenuBtnIcon) viewProfileChatMenuBtnIcon.textContent = "👤";
      if (blockUserBtnLabel) blockUserBtnLabel.textContent = isBlocked ? "Unblock user" : "Block user";
    }

    if (pinChatMenuBtnLabel) {
      pinChatMenuBtnLabel.textContent = isPinned ? "Unpin conversation" : "Pin conversation";
    }
    if (muteChatMenuBtnLabel) {
      muteChatMenuBtnLabel.textContent = isMuted ? "Unmute notifications" : "Mute notifications";
    }
    if (muteChatMenuBtnIcon) {
      muteChatMenuBtnIcon.textContent = isMuted ? "🔔" : "🔕";
    }

    chatMenuDropdown.hidden = false;
    chatMenuBtn.setAttribute("aria-expanded", "true");
  }

  chatMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (chatMenuDropdown.hidden) openChatMenu();
    else closeChatMenu();
  });

  document.addEventListener("click", (e) => {
    if (!chatMenu.contains(e.target)) closeChatMenu();
  });

  if (chatIdentity) {
    chatIdentity.addEventListener("click", () => {
      if (activeChatGroup) {
        openGroupInfoModal();
      } else if (activeChatUser) {
        openUserProfile(activeChatUser);
      }
    });
  }

  if (viewProfileChatMenuBtn) {
    viewProfileChatMenuBtn.addEventListener("click", () => {
      closeChatMenu();
      if (activeChatGroup) {
        openGroupInfoModal();
      } else if (activeChatUser) {
        openUserProfile(activeChatUser);
      }
    });
  }

  if (pinChatMenuBtn) {
    pinChatMenuBtn.addEventListener("click", () => {
      closeChatMenu();
      if (activeChatId) toggleChatPin(activeChatId);
    });
  }

  if (muteChatMenuBtn) {
    muteChatMenuBtn.addEventListener("click", () => {
      closeChatMenu();
      if (!activeChatId) return;
      if (isChatMuted(activeChatId)) {
        unmuteChat(activeChatId);
      } else {
        const nameToDisplay = activeChatGroup ? activeChatGroup.groupName : (activeChatUser?.username || activeChatUser?.name);
        openMuteModal(activeChatId, nameToDisplay);
      }
    });
  }

  if (searchChatMenuBtn) {
    searchChatMenuBtn.addEventListener("click", () => {
      closeChatMenu();
      if (threadSearchBar) {
        threadSearchBar.hidden = false;
        if (threadSearchBtn) threadSearchBtn.setAttribute("aria-expanded", "true");
        if (threadSearchInput) threadSearchInput.focus();
        updateThreadSearchResults();
      }
    });
  }

  if (summarizeChatMenuBtn) {
    summarizeChatMenuBtn.addEventListener("click", () => {
      closeChatMenu();
      summarizeAndOpenAI();
    });
  }

  blockUserBtn.addEventListener("click", async () => {
    closeChatMenu();
    if (activeChatGroup) {
      if (groupLeaveBtn) groupLeaveBtn.click();
    } else if (activeChatUser) {
      await toggleBlockUser(activeChatUser);
    }
  });

  deleteChatBtn.addEventListener("click", async () => {
    closeChatMenu();
    if (activeChatId) {
      await deleteChat(activeChatId);
    }
  });

  async function deleteChat(chatId) {
    if (!chatId) return;

    const confirmed = await showCustomConfirm("Are you sure you want to delete all messages in this conversation? All message history will be permanently cleared, but the user profile will remain in your list.", "Delete Messages");
    if (!confirmed) return;

    try {
      // Delete messages in subcollection
      const messagesRef = collection(db, "chats", chatId, "messages");
      const msgsSnap = await getDocs(messagesRef);
      const deletePromises = msgsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Reset last message on parent chat doc so the conversation profile stays in list
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: "",
        updatedAt: serverTimestamp(),
        [`unreadCounts.${firebaseUser.uid}`]: 0
      });

      if (activeChatId === chatId) {
        currentMessages = [];
        renderThread();
        if (smartRepliesBar) smartRepliesBar.hidden = true;
      }

      renderConvList(searchInput.value);
      showCustomAlert("All messages have been deleted.", "Messages Deleted");
    } catch (err) {
      console.error("Error deleting messages:", err);
      showCustomAlert("Failed to delete messages: " + err.message, "Error");
    }
  }

  if (acceptRequestBtn) {
    acceptRequestBtn.addEventListener("click", async () => {
      if (!activeChatId) return;
      try {
        acceptRequestBtn.disabled = true;
        acceptRequestBtn.textContent = "Accepting...";
        await updateDoc(doc(db, "chats", activeChatId), {
          status: "accepted"
        });
      } catch (err) {
        console.error("Error accepting chat request:", err);
        showCustomAlert("Failed to accept request: " + err.message, "Error");
      } finally {
        acceptRequestBtn.disabled = false;
        acceptRequestBtn.textContent = "Accept";
      }
    });
  }

  if (rejectRequestBtn) {
    rejectRequestBtn.addEventListener("click", async () => {
      if (!activeChatId) return;
      const confirmed = await showCustomConfirm("Decline this message request?", "Decline Request");
      if (!confirmed) return;
      try {
        rejectRequestBtn.disabled = true;
        rejectRequestBtn.textContent = "Declining...";
        await updateDoc(doc(db, "chats", activeChatId), {
          status: "rejected"
        });
      } catch (err) {
        console.error("Error declining chat request:", err);
        showCustomAlert("Failed to decline request: " + err.message, "Error");
      } finally {
        rejectRequestBtn.disabled = false;
        rejectRequestBtn.textContent = "Decline";
      }
    });
  }

  /* ---------------------------------------------------------------------
     Starting a conversation from adduser.html (?to=username)
     --------------------------------------------------------------------- */
  async function startConversationWith(username) {
      // Find the user by username
      const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return;
      
      const otherUser = snap.docs[0].data();
      const chatId = createChatId(firebaseUser.uid, otherUser.uid);
      
      // Check if chat exists
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
          // Create new chat request
          await setDoc(chatRef, {
              participants: [firebaseUser.uid, otherUser.uid],
              status: "pending",
              requestedBy: firebaseUser.uid,
              requestedTo: otherUser.uid,
              updatedAt: serverTimestamp(),
              lastMessage: "",
              users: {
                  [firebaseUser.uid]: { name: firebaseProfile.name, username: firebaseProfile.username, photoURL: firebaseProfile.photoURL || null },
                  [otherUser.uid]: { name: otherUser.name, username: otherUser.username, photoURL: otherUser.photoURL || null }
              }
          });
      }
      
      selectConversation(chatId, otherUser);
  }

  /* ---------------------------------------------------------------------
     Relay AI Agent Integration
     --------------------------------------------------------------------- */
  const AI_USER = {
    uid: "relay_ai_bot",
    name: "Relay AI",
    username: "relay_ai",
    photoURL: "Assets/logo.png",
    isAI: true
  };

  const DEFAULT_GROQ_KEY = "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";
  const GROQ_MODELS = [
    "qwen/qwen3.6-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "groq/compound"
  ];

  function cleanAIResponse(text) {
    if (!text) return "";
    let cleaned = text;

    // Strip <think>...</think> blocks
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // If an explicit Drafted message / Suggested message section exists, extract only that
    const draftMatch = cleaned.match(/\*\*(?:Drafted message|Drafted reply|Draft|Suggested response|Suggested message|Final response|Final message|Draft Message|Message)\*\*\s*[:\-]?\s*([\s\S]*)$/i);
    if (draftMatch && draftMatch[1] && draftMatch[1].trim()) {
      cleaned = draftMatch[1];
    } else if (/\*\*(?:Reasoning and approach|Reasoning Process|Reasoning|Approach|Analysis|Thought process|Explanation)\*\*/i.test(cleaned)) {
      // Split off reasoning and approach section
      const parts = cleaned.split(/\*\*(?:Reasoning and approach|Reasoning Process|Reasoning|Approach|Analysis|Thought process|Explanation)\*\*[\s\S]*?(?=\n\s*(?:[A-Z"“']|\*\*Draft|\*\*Response|\*\*Message))/i);
      if (parts.length > 1) {
        cleaned = parts[parts.length - 1];
      }
    }

    // Strip any lingering section headers
    cleaned = cleaned.replace(/^\s*\*\*(?:Reasoning and approach|Reasoning Process|Reasoning|Approach|Analysis|Drafted message|Drafted reply|Draft|Response|Summary|Final Response)\*\*[:\-]?\s*/gim, "");

    // Strip initial bullet points that belonged to reasoning if any
    cleaned = cleaned.replace(/^(?:\s*[-*•]\s+.*?\n)+/gm, "");

    // Strip wrapping quotes
    cleaned = cleaned.trim().replace(/^["“'`]([\s\S]*)["”'`]$/, "$1");

    return cleaned.trim();
  }

  function getOtherUserFromChat(c) {
    if (!c || !c.users || !firebaseUser) return null;
    if (c.otherUser) return c.otherUser;
    const otherUid = (c.participants || []).find(uid => uid !== firebaseUser.uid && uid !== "relay_ai_bot");
    if (otherUid && c.users[otherUid]) {
      return { uid: otherUid, ...c.users[otherUid] };
    }
    return null;
  }

  async function getChatContextForQuery(queryText) {
    if (!chats || chats.length === 0 || !firebaseUser) return "";
    const lowerQuery = queryText.toLowerCase();

    // Find matching conversation by participant name or username
    const matchedConv = chats.find(c => {
      const otherUser = getOtherUserFromChat(c);
      if (!otherUser) return false;
      const name = (otherUser.name || "").toLowerCase();
      const uname = (otherUser.username || "").toLowerCase();

      // Check full name, username, or any word in name (e.g. "chaturbhuj", "mishra", "vishesh")
      const nameWords = name.split(/\s+/).filter(w => w.length > 2);
      const nameMatch = lowerQuery.includes(name) || nameWords.some(nw => lowerQuery.includes(nw));
      const unameMatch = uname && lowerQuery.includes(uname);
      return nameMatch || unameMatch;
    });

    if (!matchedConv) return "";

    const otherUser = getOtherUserFromChat(matchedConv);
    const otherName = otherUser?.name || otherUser?.username || "User";

    try {
      const msgsSnap = await getDocs(query(collection(db, "chats", matchedConv.id, "messages"), orderBy("createdAt", "asc"), limitToLast(25)));
      const msgs = msgsSnap.docs.map(d => d.data());

      if (msgs.length === 0) {
        return `\n\n[Live Chat Status: You have a chat thread with ${otherName}, but no messages have been sent yet.]`;
      }

      return `\n\n[Live Chat History between User and ${otherName}]:\n` +
        msgs.map(m => {
          const sender = (m.senderId === firebaseUser.uid) ? "User" : otherName;
          return `${sender}: "${m.text}"`;
        }).join("\n");
    } catch (e) {
      console.error("Error fetching chat context:", e);
      return "";
    }
  }

  async function fetchGroqResponse(messages) {
    // 1. First, try Vercel Serverless proxy if deployed
    try {
      const serverlessRes = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return cleanAIResponse(content);
      }
    } catch (_) {
      // Not hosted on Vercel or running locally on plain static server — fallback to client-side key
    }

    // 2. Direct client-side Groq API fallback
    const rawLocal = (localStorage.getItem("relay_groq_api_key") || "").trim();
    const rawPref = (firebaseProfile?.preferences?.groqApiKey || "").trim();
    const apiKey = rawLocal || rawPref || DEFAULT_GROQ_KEY;

    if (!apiKey) return null;

    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return cleanAIResponse(content);
        } else {
          const errJson = await res.json().catch(() => ({}));
          console.warn(`[Relay Groq] Model ${model} failed (${res.status}):`, errJson);
        }
      } catch (e) {
        console.error(`[Relay Groq] Exception for ${model}:`, e);
      }
    }

    return null;
  }

  async function generateAIReply(userText) {
    const extraContext = await getChatContextForQuery(userText);

    const systemPrompt = `You are Relay AI, a friendly, smart, and casual buddy built into the Relay chat app.
You are talking to ${firebaseProfile?.name || "User"} (@${firebaseProfile?.username || "user"}).

Guidelines:
- Speak humanely, casually, and warmly like a real friend. Keep your response around 3-4 lines.
- Match the user's language and vibe naturally (English, Hindi, Hinglish, etc.).
- When summarizing or explaining a chat, weave the mood/vibe, recent topics, and status smoothly into conversational text.
- Do NOT use robotic headers (like "1. Mood & Tone:"), numbered lists, or corporate formatting unless asked.
- Never output <think> tags or internal thoughts under any circumstances.${extraContext}`;

    const groqReply = await fetchGroqResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ]);

    if (groqReply) return groqReply;

    // Fallback if API is offline
    const text = userText.toLowerCase().trim();
    if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
      return "Hey! What's up? How can I help you out today bro?";
    }
    return `Got it! Let me know if you need anything else with your chats or settings.`;
  }

  async function openAIChat() {
    if (!firebaseUser) return;
    const chatId = createChatId(firebaseUser.uid, AI_USER.uid);
    const chatRef = doc(db, "chats", chatId);

    try {
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        const welcomeText = "Hey there! I'm Relay AI, your assistant on Relay. What's on your mind today?";
        await setDoc(chatRef, {
          participants: [firebaseUser.uid, AI_USER.uid],
          status: "accepted",
          updatedAt: serverTimestamp(),
          lastMessage: welcomeText,
          users: {
            [firebaseUser.uid]: {
              name: firebaseProfile?.name || firebaseUser.displayName || "User",
              username: firebaseProfile?.username || "user",
              photoURL: firebaseProfile?.photoURL || null
            },
            [AI_USER.uid]: {
              name: AI_USER.name,
              username: AI_USER.username,
              photoURL: AI_USER.photoURL,
              isAI: true
            }
          }
        });

        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: welcomeText,
          senderId: AI_USER.uid,
          createdAt: serverTimestamp(),
          read: true
        });
      }

      selectConversation(chatId, AI_USER);
    } catch (err) {
      console.error("Error opening AI chat:", err);
    }
  }

  async function summarizeAndOpenAI() {
    if (!firebaseUser) return;
    if (!activeChatId || !activeChatUser) {
      showCustomAlert("Please open a conversation first to summarize it.");
      return;
    }
    if (!currentMessages || currentMessages.length === 0) {
      showCustomAlert("There are no messages in this chat to summarize yet.");
      return;
    }

    const otherName = activeChatUser.name || `@${activeChatUser.username}` || "User";
    const recentMsgs = currentMessages.slice(-25);

    const chatContext = recentMsgs.map(m => {
      const sender = (m.senderId === firebaseUser.uid) ? "User" : otherName;
      return `${sender}: "${m.text}"`;
    }).join("\n");

    let formattedSummary = null;

    // Attempt Groq LLM summary if key is set
    const groqSummary = await fetchGroqResponse([
      {
        role: "system",
        content: `You are Relay AI, a friendly and casual chat assistant on Relay app.
Summarize the chat between User and ${otherName} in a warm, natural, human-like way in 3-4 lines.
Weave the overall mood/vibe, what you guys talked about, and where things left off into a smooth 3-4 line casual message.
Do NOT use robotic headers like "Mood & Tone:" or numbered bullet points. Keep it super human and natural.`
      },
      { role: "user", content: `Here is the chat between User and ${otherName}:\n\n${chatContext}` }
    ]);

    if (groqSummary) {
      formattedSummary = groqSummary;
    } else {
      formattedSummary = `You and ${otherName} were chatting recently! Things seemed pretty chill and casual, mainly exchanging quick updates. Everything looks smooth on your thread!`;
    }

    const chatId = createChatId(firebaseUser.uid, AI_USER.uid);
    const chatRef = doc(db, "chats", chatId);

    try {
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: [firebaseUser.uid, AI_USER.uid],
          status: "accepted",
          updatedAt: serverTimestamp(),
          lastMessage: formattedSummary,
          users: {
            [firebaseUser.uid]: {
              name: firebaseProfile?.name || firebaseUser.displayName || "User",
              username: firebaseProfile?.username || "user",
              photoURL: firebaseProfile?.photoURL || null
            },
            [AI_USER.uid]: {
              name: AI_USER.name,
              username: AI_USER.username,
              photoURL: AI_USER.photoURL,
              isAI: true
            }
          }
        });
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: formattedSummary,
        senderId: AI_USER.uid,
        createdAt: serverTimestamp(),
        read: true
      });

      await updateDoc(chatRef, {
        lastMessage: formattedSummary,
        updatedAt: serverTimestamp()
      });

      selectConversation(chatId, AI_USER);
    } catch (err) {
      console.error("Error generating chat summary:", err);
    }
  }

  if (aiFabBtn) aiFabBtn.addEventListener("click", () => openAIChat());

  /* ---------------------------------------------------------------------
     AI Assistant Modal (Tone Rewriter, Draft Reply, Chat Summary)
     --------------------------------------------------------------------- */
  function openAIAssistantModal() {
    if (!aiAssistantModal) return;
    const rewriteInput = document.getElementById("aiRewriteInput");
    if (rewriteInput) {
      rewriteInput.value = messageInput.value || "";
    }
    aiAssistantModal.removeAttribute("hidden");
  }

  function closeAIAssistantModal() {
    if (aiAssistantModal) aiAssistantModal.setAttribute("hidden", "true");
  }

  if (aiModalClose) aiModalClose.addEventListener("click", closeAIAssistantModal);
  if (aiComposerBtn) aiComposerBtn.addEventListener("click", openAIAssistantModal);

  // Tab switching inside AI modal
  document.querySelectorAll(".ai-tab-btn").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".ai-tab-btn").forEach(b => b.classList.remove("is-active"));
      tabBtn.classList.add("is-active");

      const targetTab = tabBtn.dataset.tab;
      document.querySelectorAll(".ai-tab-pane").forEach(p => p.hidden = true);
      if (targetTab === "rewrite") {
        const p = document.getElementById("aiTabRewrite");
        if (p) p.hidden = false;
      } else if (targetTab === "draft") {
        const p = document.getElementById("aiTabDraft");
        if (p) p.hidden = false;
      } else if (targetTab === "summary") {
        const p = document.getElementById("aiTabSummary");
        if (p) p.hidden = false;
      }
    });
  });

  // Tone chips rewriting
  document.querySelectorAll(".ai-tone-chip").forEach(chip => {
    chip.addEventListener("click", async () => {
      const tone = chip.dataset.tone;
      const textToRewrite = (document.getElementById("aiRewriteInput")?.value || "").trim();
      if (!textToRewrite) {
        showCustomAlert("Please type or paste a message to rewrite first.", "Input Required");
        return;
      }

      const resBox = document.getElementById("aiRewriteResultContainer");
      const resText = document.getElementById("aiRewriteResult");
      if (resBox && resText) {
        resText.textContent = "✨ Rewriting message with AI...";
        resBox.hidden = false;
      }

      let toneInstruction = "professional, polished, and polite";
      if (tone === "casual") toneInstruction = "super casual, chill, friendly, and natural";
      if (tone === "concise") toneInstruction = "very concise, short, and straight to the point";
      if (tone === "funny") toneInstruction = "witty, humorous, and charming with a touch of fun";
      if (tone === "grammar") toneInstruction = "grammatically correct and polished, preserving original intent";

      const rewritten = await fetchGroqResponse([
        {
          role: "system",
          content: `You are an expert AI communication assistant in Relay chat. Rewrite the user's message so that the tone is ${toneInstruction}. Return ONLY the rewritten message without any introductory text, explanation, or quotes around it.`
        },
        { role: "user", content: textToRewrite }
      ]);

      if (resText) {
        resText.textContent = rewritten || textToRewrite;
      }
    });
  });

  const aiUseRewriteBtn = document.getElementById("aiUseRewriteBtn");
  if (aiUseRewriteBtn) {
    aiUseRewriteBtn.addEventListener("click", () => {
      const text = document.getElementById("aiRewriteResult")?.textContent;
      if (text) {
        messageInput.value = text;
        sendBtn.disabled = false;
        sendBtn.classList.add("is-active");
        closeAIAssistantModal();
        messageInput.focus();
      }
    });
  }

  // Draft Reply with AI
  const aiGenerateDraftBtn = document.getElementById("aiGenerateDraftBtn");
  if (aiGenerateDraftBtn) {
    aiGenerateDraftBtn.addEventListener("click", async () => {
      const prompt = (document.getElementById("aiDraftPrompt")?.value || "").trim();
      if (!prompt) {
        showCustomAlert("Please enter what you'd like to say.", "Prompt Required");
        return;
      }

      const resBox = document.getElementById("aiDraftResultContainer");
      const resText = document.getElementById("aiDraftResult");
      if (resBox && resText) {
        resText.textContent = "✨ Drafting reply with AI...";
        resBox.hidden = false;
      }

      const otherName = activeChatUser?.name || "Friend";
      const recentContext = currentMessages.slice(-5).map(m => `${m.senderId === firebaseUser.uid ? 'Me' : otherName}: ${m.text}`).join("\n");

      const draft = await fetchGroqResponse([
        {
          role: "system",
          content: "You are an AI assistant in Relay chat. Your task is to output the exact message text that will be sent in chat. NEVER output any reasoning, approach, analysis, thoughts, bullet points, or markdown headers (like '**Reasoning and approach**' or '**Drafted message**'). Output ONLY the final drafted text."
        },
        {
          role: "user",
          content: `Recent chat:\n${recentContext}\n\nWhat to say: "${prompt}"\n\nExact message:`
        }
      ]);

      if (resText) {
        resText.textContent = draft || prompt;
      }
    });
  }

  const aiUseDraftBtn = document.getElementById("aiUseDraftBtn");
  if (aiUseDraftBtn) {
    aiUseDraftBtn.addEventListener("click", () => {
      const text = document.getElementById("aiDraftResult")?.textContent;
      if (text) {
        messageInput.value = text;
        sendBtn.disabled = false;
        sendBtn.classList.add("is-active");
        closeAIAssistantModal();
        messageInput.focus();
      }
    });
  }

  // Summarize current chat
  const aiGenerateSummaryBtn = document.getElementById("aiGenerateSummaryBtn");
  if (aiGenerateSummaryBtn) {
    aiGenerateSummaryBtn.addEventListener("click", async () => {
      if (!activeChatId || !currentMessages || currentMessages.length === 0) {
        showCustomAlert("There are no messages in this chat to summarize yet.", "Empty Chat");
        return;
      }

      const resBox = document.getElementById("aiSummaryResultContainer");
      const resText = document.getElementById("aiSummaryResult");
      if (resBox && resText) {
        resText.textContent = "📝 Generating summary with AI...";
        resBox.hidden = false;
      }

      const otherName = activeChatUser?.name || `@${activeChatUser?.username}` || "User";
      const recentMsgs = currentMessages.slice(-25);
      const chatContext = recentMsgs.map(m => {
        const sender = (m.senderId === firebaseUser.uid) ? "Me" : otherName;
        return `${sender}: "${m.text}"`;
      }).join("\n");

      const summary = await fetchGroqResponse([
        {
          role: "system",
          content: `You are Relay AI. Provide a friendly, comprehensive 3-4 sentence summary of the chat between Me and ${otherName}. Highlight the mood, key topics discussed, and where things left off.`
        },
        { role: "user", content: `Chat:\n${chatContext}` }
      ]);

      if (resText) {
        resText.textContent = summary || `Chat summary with ${otherName}: Exchanged recent messages. Everything looks smooth!`;
      }
    });
  }

  /* ---------------------------------------------------------------------
     Smart Contextual Quick Replies
     --------------------------------------------------------------------- */
  function updateSmartReplies() {
    if (!smartRepliesBar || !smartRepliesList) return;
    if (!activeChatId || !currentMessages || currentMessages.length === 0) {
      smartRepliesBar.hidden = true;
      return;
    }

    const lastMsg = currentMessages[currentMessages.length - 1];
    if (!lastMsg || lastMsg.senderId === firebaseUser.uid) {
      smartRepliesBar.hidden = true;
      return;
    }

    const otherName = activeChatUser?.name || "Friend";
    const recentContext = currentMessages.slice(-4).map(m => `${m.senderId === firebaseUser.uid ? 'Me' : otherName}: ${m.text}`).join("\n");

    const fallbackReplies = ["Sounds good! 👍", "Let me check and get back to you", "Got it, thanks!"];
    smartRepliesList.innerHTML = fallbackReplies.map(s => `
      <button type="button" class="smart-reply-chip" data-text="${escapeHtml(s)}">${escapeHtml(s)}</button>
    `).join("");
    smartRepliesBar.hidden = false;

    // Async AI smart suggestions
    fetchGroqResponse([
      {
        role: "system",
        content: "Generate 3 quick, natural replies to the conversation. Format: exactly 3 short replies separated by '|' like: Sounds great! 👍|I will check on that|Got it, thank you"
      },
      { role: "user", content: `Context:\n${recentContext}\n\nReplies:` }
    ]).then(aiRes => {
      if (aiRes && aiRes.includes("|")) {
        const chips = aiRes.split("|").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean).slice(0, 3);
        if (chips.length > 0 && !smartRepliesBar.hidden) {
          smartRepliesList.innerHTML = chips.map(s => `
            <button type="button" class="smart-reply-chip" data-text="${escapeHtml(s)}">${escapeHtml(s)}</button>
          `).join("");
          bindSmartReplyChips();
        }
      }
    }).catch(() => {});

    bindSmartReplyChips();
  }

  function bindSmartReplyChips() {
    if (!smartRepliesList) return;
    smartRepliesList.querySelectorAll(".smart-reply-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.dataset.text;
        if (text) {
          messageInput.value = text;
          sendBtn.disabled = false;
          sendBtn.classList.add("is-active");
          smartRepliesBar.hidden = true;
          messageInput.focus();
        }
      });
    });
  }

  if (smartRepliesClose) {
    smartRepliesClose.addEventListener("click", () => {
      if (smartRepliesBar) smartRepliesBar.hidden = true;
    });
  }

  /* ---------------------------------------------------------------------
     Mobile back navigation & system back gesture (popstate)
     --------------------------------------------------------------------- */
  backBtn.addEventListener("click", () => {
    if (history.state && history.state.chatOpen) {
      history.back();
    } else {
      closeChatPane();
    }
  });

  window.addEventListener("popstate", (e) => {
    if (!e.state || !e.state.chatOpen) {
      closeChatPane();
    } else if (e.state && e.state.chatId && e.state.chatId !== activeChatId) {
      const targetChat = chats.find(c => c.id === e.state.chatId);
      if (targetChat) {
        if (targetChat.isGroup) {
          selectConversation(targetChat.id, targetChat);
        } else if (targetChat.otherUser) {
          selectConversation(targetChat.id, targetChat.otherUser);
        }
      }
    }
  });

  MOBILE_QUERY.addEventListener("change", (e) => {
    if (!e.matches) appEl.classList.remove("is-chat-open");
  });

  /* ---------------------------------------------------------------------
     Composer: enable/disable send button, submit new message
     --------------------------------------------------------------------- */
  async function setTyping(isTyping) {
    if (!activeChatId || !firebaseUser) return;
    try {
      await updateDoc(doc(db, "chats", activeChatId), {
        [`typing.${firebaseUser.uid}`]: isTyping
      });
    } catch (e) { /* ignore */ }
  }

  messageInput.addEventListener("input", () => {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
    sendBtn.classList.toggle("is-active", hasText);
    
    // Typing indicator
    setTyping(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => setTyping(false), 2000);
  });

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeChatGroup && activeChatUser && (isUserBlocked(activeChatUser.uid) || isBlockedByOther(activeChatUser))) {
      showCustomAlert("You cannot send messages in this conversation.", "Blocked");
      return;
    }
    const text = messageInput.value.trim();
    if (!text || !activeChatId) return;

    const chatId = activeChatId;

    if (editingMessageId) {
      const targetMsgId = editingMessageId;
      cancelEditingMessage();

      try {
        await updateDoc(doc(db, "chats", chatId, "messages", targetMsgId), {
          text: text,
          edited: true,
          editedAt: serverTimestamp()
        });

        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].id === targetMsgId) {
          await updateDoc(doc(db, "chats", chatId), {
            lastMessage: text
          });
        }
      } catch (err) {
        console.error("Error editing message:", err);
        showCustomAlert("Failed to update message.", "Error");
      }
      return;
    }

    let currentReplyData = null;
    if (replyingTo) {
      currentReplyData = {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName,
        senderId: replyingTo.senderId
      };
      cancelReplying();
    }

    messageInput.value = "";
    sendBtn.disabled = true;
    sendBtn.classList.remove("is-active");
    if (MOBILE_QUERY.matches) {
      messageInput.blur();
    } else {
      messageInput.focus();
    }
    setTyping(false);
    clearTimeout(typingTimeout);
    
    try {
        const myName = firebaseProfile?.name || firebaseUser.displayName || "User";
        const myUsername = firebaseProfile?.username || "user";
        const myPhoto = firebaseProfile?.photoURL || null;

        // Add message
        const msgDoc = {
            text,
            senderId: firebaseUser.uid,
            senderName: myName,
            senderUsername: myUsername,
            senderPhotoURL: myPhoto,
            createdAt: serverTimestamp(),
            read: false
        };
        if (currentReplyData) {
            msgDoc.replyTo = currentReplyData;
        }
        await addDoc(collection(db, "chats", chatId, "messages"), msgDoc);
        playSendSound();
        
        if (activeChatGroup) {
          const unreadUpdates = {};
          (activeChatGroup.participants || []).forEach(pUid => {
            if (pUid !== firebaseUser.uid) {
              unreadUpdates[`unreadCounts.${pUid}`] = increment(1);
            }
          });

          await updateDoc(doc(db, "chats", chatId), {
            lastMessage: text,
            lastSenderName: myName,
            updatedAt: serverTimestamp(),
            ...unreadUpdates
          });
        } else if (activeChatUser) {
          const recipientUid = activeChatUser.uid || activeChatUser.id;
          await updateDoc(doc(db, "chats", chatId), {
            lastMessage: text,
            updatedAt: serverTimestamp(),
            [`unreadCounts.${recipientUid}`]: increment(1)
          });

          // If recipient is Relay AI, send an automated AI response after brief delay
          if (recipientUid === AI_USER.uid) {
            setTimeout(async () => {
              try {
                const replyText = await generateAIReply(text);
                await addDoc(collection(db, "chats", chatId, "messages"), {
                  text: replyText,
                  senderId: AI_USER.uid,
                  createdAt: serverTimestamp(),
                  read: true
                });
                await updateDoc(doc(db, "chats", chatId), {
                  lastMessage: replyText,
                  updatedAt: serverTimestamp()
                });
              } catch (replyErr) {
                console.error("Error generating AI reply:", replyErr);
              }
            }, 800);
          }
        }
    } catch (err) {
        console.error("Error sending message:", err);
        showCustomAlert("Failed to send message.", "Error");
    }
  });

  /* ---------------------------------------------------------------------
     Search toggle
     --------------------------------------------------------------------- */
  searchToggle.addEventListener("click", () => {
    const isHidden = searchBar.hidden;
    searchBar.hidden = !isHidden;
    searchToggle.setAttribute("aria-expanded", String(isHidden));
    if (isHidden) searchInput.focus();
  });

  searchInput.addEventListener("input", () => renderConvList(searchInput.value));

  /* ---------------------------------------------------------------------
     Mobile / Web Notifications
     --------------------------------------------------------------------- */
  async function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (e) { /* ignore */ }
    }
  }

  function triggerMessageNotification(senderName, text, chatId) {
    if (chatId && isChatMuted(chatId)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const options = {
      body: text || "Sent you a message",
      icon: "Assets/icon-192.png",
      badge: "Assets/icon-192.png",
      tag: chatId || "relay-msg",
      data: { url: "index.html" },
      vibrate: [100, 50, 100],
      renotify: true
    };

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(`Relay — ${senderName}`, options);
      }).catch(() => {
        new Notification(`Relay — ${senderName}`, options);
      });
    } else {
      new Notification(`Relay — ${senderName}`, options);
    }
  }

  function updateWelcomeTitles() {
    const firstName = firebaseProfile?.name?.split(" ")[0] || "there";
    if (sidebarEmptyTitle) sidebarEmptyTitle.textContent = `Welcome, ${firstName}!`;
    if (chatEmptyTitle) chatEmptyTitle.textContent = `Welcome, ${firstName}!`;
  }

  function hydrateProfileUI(profile) {
    if (!profile) return;
    firebaseProfile = profile;
    updateWelcomeTitles();

    const photo = profile.photoURL || DEFAULT_AVATAR;
    if (myAvatarInitials) {
      myAvatarInitials.textContent = "";
      myAvatarInitials.style.backgroundImage = `url('${photo}')`;
      myAvatarInitials.style.backgroundSize = "cover";
      myAvatarInitials.style.backgroundPosition = "center";
      myAvatarInitials.style.color = "transparent";
    }
    if (profile.username && usernameModal) {
      usernameModal.setAttribute('hidden', 'true');
      localStorage.setItem("relay_username", profile.username);
    }
    if (profile.name && profile.username && myProfileBtn) {
      myProfileBtn.setAttribute("aria-label", `Your profile, ${profile.name}, @${profile.username}`);
      myProfileBtn.title = `@${profile.username}`;
    }
  }

  /* ---------------------------------------------------------------------
     Instant Cache Hydration (0ms load from localStorage)
     --------------------------------------------------------------------- */
  try {
    const cachedProfileRaw = localStorage.getItem("relay_user_profile");
    if (cachedProfileRaw) {
      hydrateProfileUI(JSON.parse(cachedProfileRaw));
    }
  } catch (e) { /* ignore */ }

  try {
    const cachedChatsRaw = localStorage.getItem("relay_chats_cache");
    let hasCache = false;
    if (cachedChatsRaw) {
      const cachedChats = JSON.parse(cachedChatsRaw);
      if (Array.isArray(cachedChats) && cachedChats.length > 0) {
        chats = cachedChats;
        renderConvList(searchInput.value);
        hasCache = true;
      }
    }
    if (sidebarSkeleton) sidebarSkeleton.hidden = hasCache;
    if (chatSkeleton) chatSkeleton.hidden = true;
    if (!activeChatId) showEmptyState();
  } catch (e) { /* ignore */ }

  /* ---------------------------------------------------------------------
     Init & Auth State
     --------------------------------------------------------------------- */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    firebaseUser = user;
    requestNotificationPermission();
    
    // If username is already known from local profile/cache, hide modal immediately and init app
    const knownUsername = (firebaseProfile && firebaseProfile.username) || localStorage.getItem("relay_username");
    if (knownUsername) {
      usernameModal.setAttribute('hidden', 'true');
      initializeApp();
    }

    // Listen to real-time updates for logged-in user profile
    onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        firebaseProfile = { ...data, photoURL: data.photoURL || user.photoURL || null, uid: user.uid };
        try {
          localStorage.setItem("relay_user_profile", JSON.stringify(firebaseProfile));
          localStorage.setItem("relay_user_cache_" + user.uid, JSON.stringify(firebaseProfile));
          if (firebaseProfile.username) {
            localStorage.setItem("relay_user_cache_" + firebaseProfile.username.toLowerCase(), JSON.stringify(firebaseProfile));
          }
          localStorage.setItem("relay_last_viewed_user", JSON.stringify(firebaseProfile));
        } catch (e) {
          console.warn("[Relay] localStorage quota exceeded, can't cache profile");
        }
        hydrateProfileUI(firebaseProfile);
        
        if (!firebaseProfile.username) {
          usernameModal.removeAttribute('hidden');
        } else {
          localStorage.setItem("relay_username", firebaseProfile.username);
          usernameModal.setAttribute('hidden', 'true');
          initializeApp();
        }
      } else {
        if (!knownUsername) {
          usernameModal.removeAttribute('hidden');
        }
      }
    }, (err) => {
      console.error("Error watching user profile:", err);
      if (!knownUsername) {
        if (err.code === "permission-denied") {
          showCustomAlert("Firestore Permission Denied. Please ensure your Firestore database is created and set to Test Mode rules.", "Permission Error");
        }
        usernameModal.removeAttribute('hidden');
      }
    });
  });
  
  let isAppInitialized = false;

  function initializeApp() {
      if (isAppInitialized) return;
      isAppInitialized = true;
      const onlineEnabled = firebaseProfile?.preferences?.onlineStatus !== false;

      // Set user as online (only if preference is on)
      if (onlineEnabled) {
        setDoc(doc(db, "users", firebaseUser.uid), { 
          online: true, 
          lastSeen: serverTimestamp() 
        }, { merge: true });
      }
      
      // Set offline when leaving the page
      window.addEventListener("beforeunload", () => {
        const userRef = doc(db, "users", firebaseUser.uid);
        setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
      });
      
      // Also handle visibility change (tab switch)
      document.addEventListener("visibilitychange", () => {
        if (!firebaseUser) return;
        const userRef = doc(db, "users", firebaseUser.uid);
        const stillEnabled = firebaseProfile?.preferences?.onlineStatus !== false;
        if (document.visibilityState === "hidden") {
          setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
        } else if (stillEnabled) {
          setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
        }
      });

      let previousUnreadCounts = {};
      let isFirstChatsSnapshot = true;

      // Listen to chats
      const q = query(collection(db, "chats"), where("participants", "array-contains", firebaseUser.uid));
      onSnapshot(q, (snapshot) => {
          const newChats = snapshot.docs.map(doc => {
              const data = doc.data();
              const otherUid = data.participants.find(id => id !== firebaseUser.uid);
              return { id: doc.id, otherUid, ...data };
          });
          
          // Check for incoming unread messages to trigger notifications
          if (!isFirstChatsSnapshot) {
            newChats.forEach(chat => {
              const myUnread = (chat.unreadCounts && chat.unreadCounts[firebaseUser.uid]) || 0;
              const prevUnread = previousUnreadCounts[chat.id] || 0;
              
              if (myUnread > prevUnread && (chat.id !== activeChatId || document.visibilityState === "hidden")) {
                const otherUserData = chat.users ? chat.users[chat.otherUid] : null;
                const senderName = otherUserData ? (otherUserData.name || `@${otherUserData.username}`) : "Someone";
                const messageText = chat.lastMessage || "Sent you a message";
                triggerMessageNotification(senderName, messageText, chat.id);
              }
            });
          }

          // Track unread counts
          newChats.forEach(c => {
            previousUnreadCounts[c.id] = (c.unreadCounts && c.unreadCounts[firebaseUser.uid]) || 0;
          });
          isFirstChatsSnapshot = false;

          chats = newChats;

          // Cache serializable chats list locally for 0ms instant load next time
          try {
            const serializableChats = chats.map(c => ({
              id: c.id,
              otherUid: c.otherUid,
              users: c.users || {},
              lastMessage: c.lastMessage || "",
              unreadCounts: c.unreadCounts || {}
            }));
            localStorage.setItem("relay_chats_cache", JSON.stringify(serializableChats));
            chats.forEach(c => {
              if (c.users && typeof c.users === "object") {
                Object.entries(c.users).forEach(([uid, uData]) => {
                  if (uData && typeof uData === "object") {
                    try {
                      const toSave = { uid, ...uData };
                      localStorage.setItem("relay_user_cache_" + uid, JSON.stringify(toSave));
                      if (uData.username) {
                        localStorage.setItem("relay_user_cache_" + uData.username.toLowerCase(), JSON.stringify(toSave));
                      }
                    } catch (_) {}
                  }
                });
              }
            });
          } catch (e) { /* ignore */ }
          
          chats.sort((a, b) => {
            const timeA = a.updatedAt ? (a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0) : 0;
            const timeB = b.updatedAt ? (b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0) : 0;
            return timeB - timeA;
          });
          
          renderConvList(searchInput.value);

          // Dismiss sidebar skeleton once real data has arrived
          if (sidebarSkeleton) sidebarSkeleton.hidden = true;

          if (!activeChatId) {
              // No chat selected yet — hide skeleton and show empty state
              showEmptyState();
          } else if (!chats.some(c => c.id === activeChatId)) {
              // The chat the user had open was deleted — clear it and show empty state
              activeChatId = null;
              activeChatUser = null;
              if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
              if (otherUserUnsubscribe) { otherUserUnsubscribe(); otherUserUnsubscribe = null; }
              if (chatDocUnsubscribe) { chatDocUnsubscribe(); chatDocUnsubscribe = null; }
              showEmptyState();
          }
          // Otherwise: user hasn't opened a chat yet — stay on the conversation list
      });
      
      const params = new URLSearchParams(window.location.search);
      const toUsername = params.get("to");
      const action = params.get("action");
      if (toUsername) {
        startConversationWith(toUsername).then(() => {
          if (action === "search") {
            setTimeout(() => {
              if (threadSearchBar) {
                threadSearchBar.hidden = false;
                if (threadSearchBtn) threadSearchBtn.setAttribute("aria-expanded", "true");
                if (threadSearchInput) threadSearchInput.focus();
                updateThreadSearchResults();
              }
            }, 300);
          } else if (action === "summarize") {
            setTimeout(() => summarizeAndOpenAI(), 400);
          }
        });
        window.history.replaceState({}, "", "index.html");
      }
  }

  usernameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = onboardingUsername.value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(val)) {
      onboardingUsernameError.textContent = "3-20 characters: letters, numbers, underscores.";
      onboardingUsernameError.hidden = false;
      return;
    }

    onboardingUsernameSubmit.disabled = true;
    onboardingUsernameSubmit.querySelector(".auth-submit__label").textContent = "Saving...";

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", val), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        onboardingUsernameError.textContent = "That username is already taken.";
        onboardingUsernameError.hidden = false;
        onboardingUsernameSubmit.disabled = false;
        onboardingUsernameSubmit.querySelector(".auth-submit__label").textContent = "Continue";
        return;
      }

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
        email: firebaseUser.email,
        username: val,
        createdAt: new Date().toISOString()
      }, { merge: true });

      localStorage.setItem("relay_username", val);
      usernameModal.setAttribute('hidden', 'true');
      
      // Update profile cache and init
      firebaseProfile = { ...firebaseProfile, username: val, name: firebaseUser.displayName || firebaseUser.email.split("@")[0] };
      updateWelcomeTitles();
      myAvatarInitials.textContent = getInitials(firebaseProfile.name);
      myProfileBtn.setAttribute("aria-label", `Your profile, ${firebaseProfile.name}, @${firebaseProfile.username}`);
      myProfileBtn.title = `@${firebaseProfile.username}`;
      
      initializeApp();
      
    } catch (err) {
      console.error(err);
      onboardingUsernameError.textContent = "Something went wrong. Try again.";
      onboardingUsernameError.hidden = false;
      onboardingUsernameSubmit.disabled = false;
      onboardingUsernameSubmit.querySelector(".auth-submit__label").textContent = "Continue";
    }
  });

})();
