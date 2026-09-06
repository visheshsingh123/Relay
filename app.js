/* ==========================================================================
   Relay — App Logic
   Real-time chat powered by Firebase Firestore
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit, getDocs, 
  onSnapshot, addDoc, serverTimestamp, orderBy, arrayUnion, arrayRemove 
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
  const chatMenu = document.getElementById("chatMenu");
  const chatMenuBtn = document.getElementById("chatMenuBtn");
  const chatMenuDropdown = document.getElementById("chatMenuDropdown");
  const blockUserBtn = document.getElementById("blockUserBtn");
  const blockUserBtnLabel = document.getElementById("blockUserBtnLabel");
  const deleteChatBtn = document.getElementById("deleteChatBtn");
  const composer = document.getElementById("composer");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const searchToggle = document.getElementById("searchToggle");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");

  const usernameModal = document.getElementById("usernameModal");
  const usernameForm = document.getElementById("usernameForm");
  const onboardingUsername = document.getElementById("onboardingUsername");
  const onboardingUsernameError = document.getElementById("onboardingUsernameError");
  const onboardingUsernameSubmit = document.getElementById("onboardingUsernameSubmit");
  const myProfileBtn = document.getElementById("myProfileBtn");
  const sidebarEmpty = document.getElementById("sidebarEmpty");
  const chatEmpty = document.getElementById("chatEmpty");

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

  function renderAvatarHtml(user, sizeClass = "avatar--sm") {
    const initials = getInitials(user ? (user.name || user.username || "") : "");
    if (user && user.photoURL) {
      return `<span class="avatar ${sizeClass}" style="background-image: url('${escapeHtml(user.photoURL)}'); background-size: cover; background-position: center; color: transparent;">${escapeHtml(initials)}</span>`;
    }
    return `<span class="avatar ${sizeClass}">${escapeHtml(initials)}</span>`;
  }

  function createChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  /* ---------------------------------------------------------------------
     Render: conversation list
     --------------------------------------------------------------------- */
  function renderConvList(filter = "") {
    const query = filter.trim().toLowerCase();
    convListEl.innerHTML = "";

    if (sidebarEmpty) {
      sidebarEmpty.hidden = chats.length > 0;
    }

    chats
      .filter((c) => {
        const q = query.replace(/^@/, "");
        const otherUser = c.users[c.otherUid];
        if (!otherUser) return false;
        return otherUser.name.toLowerCase().includes(query) || otherUser.username.toLowerCase().includes(q);
      })
      .forEach((conv) => {
        const otherUser = { uid: conv.otherUid, ...conv.users[conv.otherUid] };
        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item";
        item.dataset.id = conv.id;
        if (conv.id === activeChatId) item.classList.add("is-active");
        
        item.setAttribute("aria-label", `Open conversation with ${otherUser.name}`);

        const lastText = conv.lastMessage || "No messages yet";
        
        let timeStr = "";
        if (conv.updatedAt) {
          const date = conv.updatedAt.toDate ? conv.updatedAt.toDate() : new Date(conv.updatedAt);
          timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }

        item.innerHTML = `
          <span class="avatar-wrap">
            ${renderAvatarHtml(otherUser, "avatar--sm")}
          </span>
          <span class="conv-item__body">
            <span class="conv-item__top">
              <span class="conv-item__name">${escapeHtml(otherUser.name)}</span>
              <span class="conv-item__time">${timeStr}</span>
            </span>
            <span class="conv-item__preview-row">
              <span class="conv-item__preview">${escapeHtml(lastText)}</span>
            </span>
          </span>
        `;

        item.addEventListener("click", () => selectConversation(conv.id, otherUser));
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          deleteChat(conv.id);
        });
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

      const checks = isMe
          ? `<span class="checkmarks is-read" aria-hidden="true">
               <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                 <path d="M1 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                 <path d="M6 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </span>`
          : "";

      row.innerHTML = `
        <div class="bubble">
          <span class="bubble__text">${escapeHtml(msg.text)}</span>
          <span class="bubble__meta">${timeStr}${checks}</span>
        </div>
      `;
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

  function renderChatHeader(otherUser) {
    chatNameEl.textContent = otherUser.name;
    if (otherUser && otherUser.photoURL) {
      chatAvatarEl.textContent = "";
      chatAvatarEl.style.backgroundImage = `url('${otherUser.photoURL}')`;
      chatAvatarEl.style.backgroundSize = "cover";
      chatAvatarEl.style.backgroundPosition = "center";
      chatAvatarEl.style.color = "transparent";
    } else {
      chatAvatarEl.textContent = getInitials(otherUser.name);
      chatAvatarEl.style.backgroundImage = "none";
      chatAvatarEl.style.color = "";
    }
    chatStatusEl.innerHTML = `<span class="chat__handle">@${escapeHtml(otherUser.username)}</span>`;
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
  function selectConversation(id, otherUser) {
    activeChatId = id;
    activeChatUser = otherUser;

    renderConvList(searchInput.value);
    renderChatHeader(otherUser);
    updateBlockedUI(otherUser);
    showChatPane();

    if (MOBILE_QUERY.matches) {
      appEl.classList.add("is-chat-open");
    }

    messageInput.focus({ preventScroll: true });
    
    // Unsubscribe from previous listeners
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (otherUserUnsubscribe) otherUserUnsubscribe();
    if (chatDocUnsubscribe) chatDocUnsubscribe();
    
    // Subscribe to messages
    const messagesRef = collection(db, "chats", id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        currentMessages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderThread();
    });
    
    // Subscribe to the other user's profile changes, online status & block status
    otherUserUnsubscribe = onSnapshot(doc(db, "users", otherUser.uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        
        // Sync latest profile data (like photoURL & blockedUsers)
        otherUser.photoURL = data.photoURL || null;
        otherUser.name = data.name || otherUser.name;
        otherUser.blockedUsers = data.blockedUsers || [];

        renderChatHeader(otherUser);
        renderConvList(searchInput.value);
        updateBlockedUI(otherUser);

        if (data.online) {
            updateChatStatus("Online", true);
        } else {
            updateChatStatus(formatLastSeen(data.lastSeen), false);
        }
    });
    
    // Subscribe to chat doc for typing indicator
    chatDocUnsubscribe = onSnapshot(doc(db, "chats", id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const typing = data.typing || {};
        
        if (typing[otherUser.uid]) {
            updateChatStatus("Typing...", true);
        }
        // If not typing, the otherUser listener above handles the status
    });
  }

  /* ---------------------------------------------------------------------
     Chat pane vs. empty state
     --------------------------------------------------------------------- */
  function showChatPane() {
    chatHeaderEl.hidden = false;
    threadEl.hidden = false;
    composer.hidden = false;
    if (chatEmpty) chatEmpty.hidden = true;
  }

  function showEmptyState() {
    chatHeaderEl.hidden = true;
    threadEl.hidden = true;
    composer.hidden = true;
    if (chatEmpty) chatEmpty.hidden = false;
  }

  /* ---------------------------------------------------------------------
     Chat header menu: open/close + delete chat
     --------------------------------------------------------------------- */
  function closeChatMenu() {
    chatMenuDropdown.hidden = true;
    chatMenuBtn.setAttribute("aria-expanded", "false");
  }

  function openChatMenu() {
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChatMenu();
  });

  async function deleteChat(chatId) {
    if (!chatId) return;

    const confirmed = window.confirm("Are you sure you want to delete this conversation? All messages will be permanently deleted.");
    if (!confirmed) return;

    try {
      if (activeChatId === chatId) {
        if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
        if (otherUserUnsubscribe) { otherUserUnsubscribe(); otherUserUnsubscribe = null; }
        if (chatDocUnsubscribe) { chatDocUnsubscribe(); chatDocUnsubscribe = null; }
        activeChatId = null;
        activeChatUser = null;
      }

      // Delete messages in subcollection
      const messagesRef = collection(db, "chats", chatId, "messages");
      const msgsSnap = await getDocs(messagesRef);
      const deletePromises = msgsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Delete parent chat doc
      await deleteDoc(doc(db, "chats", chatId));

    } catch (err) {
      console.error("Error deleting chat:", err);
      alert("Failed to delete chat: " + err.message);
    }
  }

  blockUserBtn.addEventListener("click", async () => {
    closeChatMenu();
    if (!activeChatUser || !firebaseUser) return;

    const targetUid = activeChatUser.uid || activeChatUser.id;
    if (!targetUid) {
      alert("Failed to identify user ID to block.");
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
        updateBlockedUI(activeChatUser);
      } catch (err) {
        console.error("Error unblocking user:", err);
        alert("Failed to unblock user: " + err.message);
      }
    } else {
      const confirmed = window.confirm(`Block @${activeChatUser.username}? You won't be able to send or receive messages in this chat.`);
      if (!confirmed) return;

      try {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          blockedUsers: arrayUnion(targetUid)
        }, { merge: true });

        if (!firebaseProfile.blockedUsers) firebaseProfile.blockedUsers = [];
        if (!firebaseProfile.blockedUsers.includes(targetUid)) {
          firebaseProfile.blockedUsers.push(targetUid);
        }
        updateBlockedUI(activeChatUser);
      } catch (err) {
        console.error("Error blocking user:", err);
        alert("Failed to block user: " + err.message);
      }
    }
  });

  deleteChatBtn.addEventListener("click", async () => {
    closeChatMenu();
    if (activeChatId) {
      await deleteChat(activeChatId);
    }
  });

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
          // Create chat
          await setDoc(chatRef, {
              participants: [firebaseUser.uid, otherUser.uid],
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
     Mobile back navigation
     --------------------------------------------------------------------- */
  backBtn.addEventListener("click", () => {
    appEl.classList.remove("is-chat-open");
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
    if (activeChatUser && (isUserBlocked(activeChatUser.uid) || isBlockedByOther(activeChatUser))) {
      alert("You cannot send messages in this conversation.");
      return;
    }
    const text = messageInput.value.trim();
    if (!text || !activeChatId) return;

    const chatId = activeChatId;
    messageInput.value = "";
    sendBtn.disabled = true;
    sendBtn.classList.remove("is-active");
    messageInput.focus();
    setTyping(false);
    clearTimeout(typingTimeout);
    
    try {
        // Add message
        await addDoc(collection(db, "chats", chatId, "messages"), {
            text,
            senderId: firebaseUser.uid,
            createdAt: serverTimestamp(),
            read: false
        });
        
        // Update parent chat
        await updateDoc(doc(db, "chats", chatId), {
            lastMessage: text,
            updatedAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Error sending message:", err);
        alert("Failed to send message.");
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
     Init & Auth State
     --------------------------------------------------------------------- */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    firebaseUser = user;
    
    // Fetch profile
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        firebaseProfile = docSnap.data();
        
        // Setup UI
        const photo = firebaseProfile.photoURL || user.photoURL;
        if (photo) {
          myAvatarInitials.textContent = "";
          myAvatarInitials.style.backgroundImage = `url('${photo}')`;
          myAvatarInitials.style.backgroundSize = "cover";
          myAvatarInitials.style.backgroundPosition = "center";
          myAvatarInitials.style.color = "transparent";
        } else {
          myAvatarInitials.textContent = getInitials(firebaseProfile.name);
          myAvatarInitials.style.backgroundImage = "none";
          myAvatarInitials.style.color = "";
        }
        myProfileBtn.setAttribute("aria-label", `Your profile, ${firebaseProfile.name}, @${firebaseProfile.username}`);
        myProfileBtn.title = `@${firebaseProfile.username}`;
        
        if (!firebaseProfile.username) {
          usernameModal.removeAttribute('hidden');
        } else {
          localStorage.setItem("relay_username", firebaseProfile.username);
          initializeApp();
        }
      } else {
        usernameModal.removeAttribute('hidden');
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      if (err.code === "permission-denied") {
        alert("Firestore Permission Denied. Please ensure your Firestore database is created and set to Test Mode rules.");
      }
      usernameModal.removeAttribute('hidden');
    }
  });
  
  function initializeApp() {
      // Set user as online
      setDoc(doc(db, "users", firebaseUser.uid), { 
        online: true, 
        lastSeen: serverTimestamp() 
      }, { merge: true });
      
      // Set offline when leaving the page
      window.addEventListener("beforeunload", () => {
        navigator.sendBeacon || null; // fallback check
        // Use a sync-safe approach
        const userRef = doc(db, "users", firebaseUser.uid);
        setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
      });
      
      // Also handle visibility change (tab switch)
      document.addEventListener("visibilitychange", () => {
        if (!firebaseUser) return;
        const userRef = doc(db, "users", firebaseUser.uid);
        if (document.visibilityState === "hidden") {
          setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
        } else {
          setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
        }
      });

      // Listen to chats
      const q = query(collection(db, "chats"), where("participants", "array-contains", firebaseUser.uid));
      onSnapshot(q, (snapshot) => {
          chats = snapshot.docs.map(doc => {
              const data = doc.data();
              const otherUid = data.participants.find(id => id !== firebaseUser.uid);
              return { id: doc.id, otherUid, ...data };
          });
          
          chats.sort((a, b) => {
            const timeA = a.updatedAt ? (a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0) : 0;
            const timeB = b.updatedAt ? (b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0) : 0;
            return timeB - timeA;
          });
          
          renderConvList(searchInput.value);
          
          if (chats.length > 0 && (!activeChatId || !chats.some(c => c.id === activeChatId))) {
              const firstChat = chats[0];
              selectConversation(firstChat.id, { uid: firstChat.otherUid, ...firstChat.users[firstChat.otherUid] });
          } else if (chats.length === 0) {
              activeChatId = null;
              activeChatUser = null;
              if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
              if (otherUserUnsubscribe) { otherUserUnsubscribe(); otherUserUnsubscribe = null; }
              if (chatDocUnsubscribe) { chatDocUnsubscribe(); chatDocUnsubscribe = null; }
              showEmptyState();
          }
      });
      
      const params = new URLSearchParams(window.location.search);
      const toUsername = params.get("to");
      if (toUsername) {
        startConversationWith(toUsername);
        window.history.replaceState({}, "", "app.html");
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
