/* ==========================================================================
   Relay — New Message / Add User
   Vanilla JS: searches a demo user directory by name or @username and
   hands the pick off to app.html?to=username. Swap `directory` and
   fakeUserSearch() for a real Supabase query later.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Demo directory — replace with a Supabase profiles query later
     --------------------------------------------------------------------- */
  const directory = [
    { name: "Mira Kapoor", username: "mira", initials: "MK", online: true },
    { name: "Ravi Shah", username: "ravishah", initials: "RS", online: true },
    { name: "Priya Nair", username: "priyan", initials: "PN", online: false },
    { name: "Jordan Lee", username: "jordanlee", initials: "JL", online: false },
    { name: "Sam Okafor", username: "samokafor", initials: "SO", online: true },
    { name: "Elena Volkov", username: "elenav", initials: "EV", online: false },
    { name: "John Doe", username: "johndoe", initials: "JD", online: true },
  ];

  const resultsEl = document.getElementById("results");
  const searchInput = document.getElementById("usernameSearch");

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------------
     Render results for the current query
     --------------------------------------------------------------------- */
  function renderResults(query) {
    const q = query.trim().toLowerCase().replace(/^@/, "");

    resultsEl.innerHTML = "";
    if (!q) return; // Empty state: just the heading and search bar, nothing below.

    const matches = directory.filter(
      (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "adduser__empty";
      empty.textContent = `No one found matching "${query.trim()}".`;
      resultsEl.appendChild(empty);
      return;
    }

    matches.forEach((user) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "conv-item";
      item.setAttribute("aria-label", `Start a conversation with ${user.name}, @${user.username}`);

      item.innerHTML = `
        <span class="avatar-wrap">
          <span class="avatar avatar--sm">${user.initials}</span>
          ${user.online ? '<span class="presence-dot" aria-hidden="true"></span>' : ""}
        </span>
        <span class="conv-item__body">
          <span class="conv-item__name">${escapeHtml(user.name)}</span>
          <span class="chat__handle">@${escapeHtml(user.username)}</span>
        </span>
      `;

      item.addEventListener("click", () => startConversation(user));
      resultsEl.appendChild(item);
    });
  }

  /* ---------------------------------------------------------------------
     Hand off to the chat app with the picked username
     --------------------------------------------------------------------- */
  function startConversation(user) {
    window.location.href = `app.html?to=${encodeURIComponent(user.username)}`;
  }

  searchInput.addEventListener("input", () => renderResults(searchInput.value));

  renderResults("");
  searchInput.focus();
})();
