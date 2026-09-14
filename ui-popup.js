/* ==========================================================================
   Relay — Custom Popup Window Module
   Replaces native window.alert() and window.confirm() with styled popups.
   ========================================================================== */

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function showCustomAlert(message, title = "Relay") {
  return new Promise((resolve) => {
    let overlay = document.getElementById("customPopupOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "customPopupOverlay";
      overlay.className = "modal-overlay custom-popup-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal custom-popup-modal" role="dialog" aria-modal="true">
        <div class="custom-popup__header">
          <h3 class="custom-popup__title">${escapeHtml(title)}</h3>
        </div>
        <div class="custom-popup__body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="custom-popup__actions">
          <button type="button" class="btn-primary custom-popup__ok-btn">OK</button>
        </div>
      </div>
    `;

    overlay.removeAttribute("hidden");
    overlay.style.display = "flex";

    const okBtn = overlay.querySelector(".custom-popup__ok-btn");
    const close = () => {
      overlay.style.display = "none";
      overlay.setAttribute("hidden", "true");
      resolve();
    };

    okBtn.addEventListener("click", close);
  });
}

export function showCustomConfirm(message, title = "Confirm Action") {
  return new Promise((resolve) => {
    let overlay = document.getElementById("customPopupOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "customPopupOverlay";
      overlay.className = "modal-overlay custom-popup-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal custom-popup-modal" role="dialog" aria-modal="true">
        <div class="custom-popup__header">
          <h3 class="custom-popup__title">${escapeHtml(title)}</h3>
        </div>
        <div class="custom-popup__body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="custom-popup__actions">
          <button type="button" class="btn-secondary custom-popup__cancel-btn">Cancel</button>
          <button type="button" class="btn-primary custom-popup__confirm-btn">Confirm</button>
        </div>
      </div>
    `;

    overlay.removeAttribute("hidden");
    overlay.style.display = "flex";

    const confirmBtn = overlay.querySelector(".custom-popup__confirm-btn");
    const cancelBtn = overlay.querySelector(".custom-popup__cancel-btn");

    const handleConfirm = () => {
      overlay.style.display = "none";
      overlay.setAttribute("hidden", "true");
      resolve(true);
    };

    const handleCancel = () => {
      overlay.style.display = "none";
      overlay.setAttribute("hidden", "true");
      resolve(false);
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
  });
}
