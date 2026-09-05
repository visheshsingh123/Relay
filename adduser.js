/* ==========================================================================
   Relay — New Message / Add User
   Vanilla JS: searches a demo user directory by name or @username and
   hands the pick off to app.html?to=username. Swap `directory` and
   fakeUserSearch() for a real Supabase query later.
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(() => {
  "use strict";

  const resultsEl = document.getElementById("results");
  const searchInput = document.getElementById("usernameSearch");

  let searchTimer = null;

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

  /* ---------------------------------------------------------------------
     Render results for the current query
     --------------------------------------------------------------------- */
  async function searchUsers(q) {
    const queryStr = q.trim().toLowerCase().replace(/^@/, "");
    resultsEl.innerHTML = "";
    
    if (!queryStr) return; // Empty state

    // Show loading state
    resultsEl.innerHTML = '<p class="adduser__empty">Searching...</p>';

    try {
      const usersRef = collection(db, "users");
      // Search for usernames starting with the query string
      const qRef = query(
        usersRef,
        where("username", ">=", queryStr),
        where("username", "<=", queryStr + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(qRef);

      resultsEl.innerHTML = "";

      if (snapshot.empty) {
        const empty = document.createElement("p");
        empty.className = "adduser__empty";
        empty.textContent = `No one found matching "${q.trim()}".`;
        resultsEl.appendChild(empty);
        return;
      }

      snapshot.forEach((doc) => {
        const user = doc.data();
        
        // Skip ourselves if we are logged in
        if (auth.currentUser && user.uid === auth.currentUser.uid) {
          return;
        }

        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item";
        item.setAttribute("aria-label", `Start a conversation with ${user.name}, @${user.username}`);

        item.innerHTML = `
          <span class="avatar-wrap">
            <span class="avatar avatar--sm">${getInitials(user.name)}</span>
          </span>
          <span class="conv-item__body">
            <span class="conv-item__name">${escapeHtml(user.name)}</span>
            <span class="chat__handle">@${escapeHtml(user.username)}</span>
          </span>
        `;

        item.addEventListener("click", () => startConversation(user));
        resultsEl.appendChild(item);
      });
      
      // If the only result was ourselves and got skipped
      if (resultsEl.children.length === 0) {
        const empty = document.createElement("p");
        empty.className = "adduser__empty";
        empty.textContent = `No one found matching "${q.trim()}".`;
        resultsEl.appendChild(empty);
      }

    } catch (err) {
      console.error("Search error:", err);
      resultsEl.innerHTML = '<p class="adduser__empty">Error searching. Please try again.</p>';
    }
  }

  /* ---------------------------------------------------------------------
     Hand off to the chat app with the picked username
     --------------------------------------------------------------------- */
  function startConversation(user) {
    window.location.href = `app.html?to=${encodeURIComponent(user.username)}`;
  }

  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchUsers(searchInput.value);
    }, 300); // 300ms debounce
  });

  searchInput.focus();
})();
