/* ==========================================================================
   Relay — New Message / Add User
   Searches users by name or @username and loads recommended suggestions.
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

  function createResultItem(user) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "conv-item adduser-item";
    item.setAttribute("aria-label", `Start a conversation with ${user.name}, @${user.username}`);

    const photo = user.photoURL || "Assets/pfp.jpg";
    const avatarHtml = `<span class="avatar avatar--sm" style="background-image: url('${escapeHtml(photo)}'); background-size: cover; background-position: center; color: transparent;"></span>`;

    item.innerHTML = `
      <span class="avatar-wrap">
        ${avatarHtml}
      </span>
      <span class="conv-item__body">
        <span class="conv-item__name">${escapeHtml(user.name || "Relay User")}</span>
        <span class="chat__handle">@${escapeHtml(user.username || "user")}</span>
      </span>
      <span class="adduser-item__action">Chat</span>
    `;

    const avatarWrap = item.querySelector(".avatar-wrap");
    if (avatarWrap) {
      avatarWrap.style.cursor = "pointer";
      avatarWrap.title = "View profile";
      avatarWrap.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          if (user.uid) localStorage.setItem("relay_user_cache_" + user.uid, JSON.stringify(user));
          if (user.username) localStorage.setItem("relay_user_cache_" + user.username.toLowerCase(), JSON.stringify(user));
          localStorage.setItem("relay_last_viewed_user", JSON.stringify(user));
        } catch (_) {}
        window.location.href = `profileview.html?uid=${encodeURIComponent(user.uid)}`;
      });
    }

    item.addEventListener("click", () => startConversation(user));
    return item;
  }

  /* ---------------------------------------------------------------------
     Load Suggested People (Recommendations)
     --------------------------------------------------------------------- */
  async function loadRecommendations() {
    resultsEl.innerHTML = `
      <div class="adduser-section">
        <h3 class="adduser-section__title">Suggested for you</h3>
        <div class="adduser-section__list" id="recList">
          <p class="adduser__empty">Loading suggestions...</p>
        </div>
      </div>
    `;

    const recList = document.getElementById("recList");

    try {
      const usersRef = collection(db, "users");
      const qRef = query(usersRef, limit(8));
      const snapshot = await getDocs(qRef);

      recList.innerHTML = "";

      let count = 0;
      snapshot.forEach((doc) => {
        const user = doc.data();
        if (auth.currentUser && user.uid === auth.currentUser.uid) {
          return;
        }

        count++;
        recList.appendChild(createResultItem(user));
      });

      if (count === 0) {
        recList.innerHTML = '<p class="adduser__empty">No suggestions available right now.</p>';
      }
    } catch (err) {
      console.warn("Could not load recommendations from Firestore:", err);
      recList.innerHTML = '<p class="adduser__empty">Type a username or name above to search.</p>';
    }
  }

  /* ---------------------------------------------------------------------
     Render results for the current search query
     --------------------------------------------------------------------- */
  async function searchUsers(q) {
    const queryStr = q.trim().toLowerCase().replace(/^@/, "");
    
    if (!queryStr) {
      loadRecommendations();
      return;
    }

    resultsEl.innerHTML = '<p class="adduser__empty">Searching...</p>';

    try {
      const usersRef = collection(db, "users");
      const qRef = query(
        usersRef,
        where("username", ">=", queryStr),
        where("username", "<=", queryStr + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(qRef);

      resultsEl.innerHTML = "";

      let count = 0;
      snapshot.forEach((doc) => {
        const user = doc.data();
        if (auth.currentUser && user.uid === auth.currentUser.uid) {
          return;
        }

        count++;
        resultsEl.appendChild(createResultItem(user));
      });

      if (count === 0) {
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
     Hand off to the chat app with the picked user
     --------------------------------------------------------------------- */
  function startConversation(user) {
    window.location.href = `index.html?to=${encodeURIComponent(user.username)}`;
  }

  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchUsers(searchInput.value);
    }, 300);
  });

  // Initial load: show recommendations and focus searchbar
  loadRecommendations();
  searchInput.focus();
})();
