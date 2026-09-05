/* ==========================================================================
   Relay — App Logic
   Real-time chat powered by Firebase Firestore
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs, 
  onSnapshot, addDoc, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(() => {
  "use strict";

  let firebaseUser = null;
  let firebaseProfile = null;
  
  let chats = []; // Store active chats for sidebar
  let currentMessages = []; // Store messages for active chat
  
  let activeChatId = null;
  let activeChatUser = null; // Store the "other" user's info for header
  let messagesUnsubscribe = null;

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
  const myAvatarInitials = document.getElementById("myAvatarInitials");

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

  function createChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  /* ---------------------------------------------------------------------
     Render: conversation list
     --------------------------------------------------------------------- */
  function renderConvList(filter = "") {
    const query = filter.trim().toLowerCase();
    convListEl.innerHTML = "";

    chats
      .filter((c) => {
        const q = query.replace(/^@/, "");
        const otherUser = c.users[c.otherUid];
        if (!otherUser) return false;
        return otherUser.name.toLowerCase().includes(query) || otherUser.username.toLowerCase().includes(q);
      })
      .forEach((conv) => {
        const otherUser = conv.users[conv.otherUid];
        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item";
        item.dataset.id = conv.id;
        if (conv.id === activeChatId) item.classList.add("is-active");
        
        // TODO: proper unread logic later
        // if (conv.unread > 0) item.classList.add("has-unread");
        
        item.setAttribute("aria-label", `Open conversation with ${otherUser.name}`);

        const lastText = conv.lastMessage || "No messages yet";
        
        let timeStr = "";
        if (conv.updatedAt) {
          const date = conv.updatedAt.toDate ? conv.updatedAt.toDate() : new Date(conv.updatedAt);
          timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }

        item.innerHTML = `
          <span class="avatar-wrap">
            <span class="avatar avatar--sm">${getInitials(otherUser.name)}</span>
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
  function renderChatHeader(otherUser) {
    chatNameEl.textContent = otherUser.name;
    chatAvatarEl.textContent = getInitials(otherUser.name);
    chatStatusEl.innerHTML = `<span class="chat__handle">@${escapeHtml(otherUser.username)}</span>`;
  }

  /* ---------------------------------------------------------------------
     Selecting a conversation
     --------------------------------------------------------------------- */
  function selectConversation(id, otherUser) {
    activeChatId = id;
    activeChatUser = otherUser;

    renderConvList(searchInput.value);
    renderChatHeader(otherUser);
    showChatPane();

    if (MOBILE_QUERY.matches) {
      appEl.classList.add("is-chat-open");
    }

    messageInput.focus({ preventScroll: true });
    
    // Subscribe to messages
    if (messagesUnsubscribe) messagesUnsubscribe();
    
    const messagesRef = collection(db, "chats", id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        currentMessages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderThread();
    });
  }

  /* ---------------------------------------------------------------------
     Chat pane vs. empty state
     --------------------------------------------------------------------- */
  function showChatPane() {
    chatHeaderEl.hidden = false;
    threadEl.hidden = false;
    composer.hidden = false;
  }

  function showEmptyState() {
    chatHeaderEl.hidden = true;
    threadEl.hidden = true;
    composer.hidden = true;
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

  deleteChatBtn.addEventListener("click", async () => {
    closeChatMenu();

    if (!activeChatId) return;

    const confirmed = window.confirm(`Delete this conversation? This can't be undone.`);
    if (!confirmed) return;

    // For now we just hide it / remove it locally or do a real delete.
    // A real delete requires deleting all subcollection docs which is hard from client.
    alert("Deleting chats requires a Cloud Function in Firebase. Not fully implemented in demo.");
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
                  [firebaseUser.uid]: { name: firebaseProfile.name, username: firebaseProfile.username },
                  [otherUser.uid]: { name: otherUser.name, username: otherUser.username }
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
  messageInput.addEventListener("input", () => {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
    sendBtn.classList.toggle("is-active", hasText);
  });

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !activeChatId) return;

    const chatId = activeChatId; // capture current
    messageInput.value = "";
    sendBtn.disabled = true;
    sendBtn.classList.remove("is-active");
    messageInput.focus();
    
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
        myAvatarInitials.textContent = getInitials(firebaseProfile.name);
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
      // Listen to chats
      const q = query(collection(db, "chats"), where("participants", "array-contains", firebaseUser.uid));
      onSnapshot(q, (snapshot) => {
          chats = snapshot.docs.map(doc => {
              const data = doc.data();
              const otherUid = data.participants.find(id => id !== firebaseUser.uid);
              return { id: doc.id, otherUid, ...data };
          });
          
          // Sort chats in memory to avoid requiring a Firestore composite index
          chats.sort((a, b) => {
            const timeA = a.updatedAt ? (a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0) : 0;
            const timeB = b.updatedAt ? (b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0) : 0;
            return timeB - timeA;
          });
          
          renderConvList(searchInput.value);
          
          if (chats.length > 0 && !activeChatId) {
              const firstChat = chats[0];
              selectConversation(firstChat.id, firstChat.users[firstChat.otherUid]);
          } else if (chats.length === 0) {
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
