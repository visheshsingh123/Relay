/* ==========================================================================
   Relay — App Logic
   Vanilla JS: conversation state, rendering, responsive navigation,
   and a local demo of sending messages. Built to be swapped for
   Supabase Auth / Realtime / Storage calls later.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Demo data — replace with a Supabase fetch later
     --------------------------------------------------------------------- */
  const conversations = [
    {
      id: "c1",
      name: "John Doe",
      username: "johndoe",
      initials: "JD",
      online: true,
      unread: 2,
      messages: [
        { from: "them", text: "Hey! Did you get a chance to look at the deck?", time: "10:12 AM" },
        { from: "them", text: "No rush, just checking in before the call.", time: "10:13 AM" },
        { from: "me", text: "Just opened it now, looks great so far.", time: "10:20 AM", read: true },
        { from: "me", text: "Sending a couple of comments in a sec.", time: "10:21 AM", read: true },
        { from: "them", text: "Sounds good, appreciate it.", time: "10:22 AM" },
        { from: "them", text: "Let's sync at 3?", time: "10:42 AM" },
      ],
    },
  ];

  // The signed-in person. In a real build this comes from the auth session
  // (e.g. Supabase's profiles table), populated at login/signup.
  const currentUser = { name: "Vivian Serrano", username: "vivian", initials: "VS" };

  let activeId = conversations[0].id;

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
  const chatEmptyEl = document.getElementById("chatEmpty");
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

  const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function getConversation(id) {
    return conversations.find((c) => c.id === id);
  }

  function lastMessage(conv) {
    return conv.messages[conv.messages.length - 1] || null;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------------
     Render: conversation list
     --------------------------------------------------------------------- */
  function renderConvList(filter = "") {
    const query = filter.trim().toLowerCase();
    convListEl.innerHTML = "";

    conversations
      .filter((c) => {
        const q = query.replace(/^@/, "");
        return c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(q);
      })
      .forEach((conv) => {
        const last = lastMessage(conv);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item";
        item.dataset.id = conv.id;
        if (conv.id === activeId) item.classList.add("is-active");
        if (conv.unread > 0) item.classList.add("has-unread");
        item.setAttribute(
          "aria-label",
          `Open conversation with ${conv.name}${conv.unread ? `, ${conv.unread} unread` : ""}`
        );

        const previewText = last
          ? `${last.from === "me" ? "You: " : ""}${escapeHtml(last.text)}`
          : "No messages yet";

        item.innerHTML = `
          <span class="avatar-wrap">
            <span class="avatar avatar--sm">${conv.initials}</span>
            ${conv.online ? '<span class="presence-dot" aria-hidden="true"></span>' : ""}
          </span>
          <span class="conv-item__body">
            <span class="conv-item__top">
              <span class="conv-item__name">${escapeHtml(conv.name)}</span>
              <span class="conv-item__time">${last ? last.time : ""}</span>
            </span>
            <span class="conv-item__preview-row">
              <span class="conv-item__preview">${previewText}</span>
              ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ""}
            </span>
          </span>
        `;

        item.addEventListener("click", () => selectConversation(conv.id));
        convListEl.appendChild(item);
      });
  }

  /* ---------------------------------------------------------------------
     Render: message thread
     --------------------------------------------------------------------- */
  function renderThread(conv) {
    threadEl.innerHTML = "";

    conv.messages.forEach((msg, i) => {
      const prev = conv.messages[i - 1];
      const next = conv.messages[i + 1];
      const sameAsPrev = prev && prev.from === msg.from;
      const sameAsNext = next && next.from === msg.from;

      let groupClass = "group-start";
      if (sameAsPrev && sameAsNext) groupClass = "group-mid";
      else if (sameAsPrev && !sameAsNext) groupClass = "group-end";
      else if (!sameAsPrev && !sameAsNext) groupClass = "group-start";

      const row = document.createElement("div");
      row.className = `msg-row is-${msg.from === "me" ? "out" : "in"} ${groupClass}`;

      const checks =
        msg.from === "me"
          ? `<span class="checkmarks${msg.read ? " is-read" : ""}" aria-hidden="true">
               <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                 <path d="M1 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                 <path d="M6 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </span>`
          : "";

      row.innerHTML = `
        <div class="bubble">
          <span class="bubble__text">${escapeHtml(msg.text)}</span>
          <span class="bubble__meta">${msg.time}${checks}</span>
        </div>
      `;
      threadEl.appendChild(row);
    });

    threadEl.scrollTop = threadEl.scrollHeight;
  }

  /* ---------------------------------------------------------------------
     Render: chat header
     --------------------------------------------------------------------- */
  function renderChatHeader(conv) {
    chatNameEl.textContent = conv.name;
    chatAvatarEl.textContent = conv.initials;
    chatStatusEl.innerHTML = `<span class="chat__handle">@${escapeHtml(conv.username)}</span>`;
  }

  /* ---------------------------------------------------------------------
     Selecting a conversation
     --------------------------------------------------------------------- */
  function selectConversation(id) {
    activeId = id;
    const conv = getConversation(id);
    conv.unread = 0; // mark as read on open

    renderConvList(searchInput.value);
    renderChatHeader(conv);
    renderThread(conv);
    showChatPane();

    if (MOBILE_QUERY.matches) {
      appEl.classList.add("is-chat-open");
    }

    messageInput.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------------
     Chat pane vs. empty state (shown once every conversation is deleted)
     --------------------------------------------------------------------- */
  function showChatPane() {
    chatEmptyEl.hidden = true;
    chatHeaderEl.hidden = false;
    threadEl.hidden = false;
    composer.hidden = false;
  }

  function showEmptyState() {
    chatHeaderEl.hidden = true;
    threadEl.hidden = true;
    composer.hidden = true;
    chatEmptyEl.hidden = false;
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

  deleteChatBtn.addEventListener("click", () => {
    closeChatMenu();

    const conv = getConversation(activeId);
    if (!conv) return;

    const confirmed = window.confirm(`Delete your conversation with ${conv.name}? This can't be undone.`);
    if (!confirmed) return;

    deleteConversation(conv.id);
  });

  function deleteConversation(id) {
    const index = conversations.findIndex((c) => c.id === id);
    if (index === -1) return;

    conversations.splice(index, 1);

    if (activeId === id) {
      const next = conversations[index] || conversations[index - 1] || null;
      activeId = next ? next.id : null;
    }

    renderConvList(searchInput.value);

    if (activeId) {
      const nextConv = getConversation(activeId);
      renderChatHeader(nextConv);
      renderThread(nextConv);
      showChatPane();
    } else {
      showEmptyState();
      if (MOBILE_QUERY.matches) appEl.classList.remove("is-chat-open");
    }
  }

  /* ---------------------------------------------------------------------
     Starting a conversation from adduser.html (?to=username)
     --------------------------------------------------------------------- */
  function findConversationByUsername(username) {
    return conversations.find((c) => c.username.toLowerCase() === username.toLowerCase());
  }

  function initialsFromName(name) {
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
    return initials || name.slice(0, 2).toUpperCase();
  }

  function nameFromUsername(username) {
    return username
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function startConversationWith(username) {
    let conv = findConversationByUsername(username);

    if (!conv) {
      const name = nameFromUsername(username) || username;
      conv = {
        id: `c_${username.toLowerCase()}_${Date.now()}`,
        name,
        username: username.toLowerCase(),
        initials: initialsFromName(name),
        online: false,
        unread: 0,
        messages: [],
      };
      conversations.unshift(conv);
    }

    selectConversation(conv.id);
  }

  /* ---------------------------------------------------------------------
     Mobile back navigation
     --------------------------------------------------------------------- */
  backBtn.addEventListener("click", () => {
    appEl.classList.remove("is-chat-open");
  });

  // Keep layout correct if the viewport crosses the breakpoint live
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

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    const conv = getConversation(activeId);
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    conv.messages.push({ from: "me", text, time, read: false });

    renderThread(conv);
    renderConvList(searchInput.value);

    messageInput.value = "";
    sendBtn.disabled = true;
    sendBtn.classList.remove("is-active");
    messageInput.focus();

    // Demo-only: simulate a reply so the thread feels alive.
    window.setTimeout(() => {
      conv.messages.push({
        from: "them",
        text: "Got it, thanks!",
        time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
      if (activeId === conv.id) renderThread(conv);
      renderConvList(searchInput.value);
    }, 1200);
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
     Init
     --------------------------------------------------------------------- */
  const myProfileBtn = document.getElementById("myProfileBtn");
  const myAvatarInitials = document.getElementById("myAvatarInitials");
  myAvatarInitials.textContent = currentUser.initials;
  myProfileBtn.setAttribute(
    "aria-label",
    `Your profile, ${currentUser.name}, @${currentUser.username}`
  );
  myProfileBtn.title = `@${currentUser.username}`;

  renderConvList();
  renderChatHeader(getConversation(activeId));
  renderThread(getConversation(activeId));

  const params = new URLSearchParams(window.location.search);
  const toUsername = params.get("to");
  if (toUsername) {
    startConversationWith(toUsername);
    window.history.replaceState({}, "", "app.html");
  }
})();
