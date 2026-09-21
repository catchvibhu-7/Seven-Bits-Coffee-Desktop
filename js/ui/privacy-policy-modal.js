/**
 * SEVEN BITS COFFEE - PRIVACY POLICY MODAL
 * Location: /js/ui/privacy-policy-modal.js
 *
 * Themed, scrollable display for config.privacyPolicy (see GET /api/config
 * and PATCH /api/config/privacy-policy) - the plain-text version of the
 * TERMS_AND_PRIVACY.txt the desktop app's installer shows, but this one is
 * customer-facing, admin/owner-editable at runtime, and rendered in the
 * app's own theme rather than opened in a system text viewer.
 */
import { escapeHtml } from "../features/html-utils.js";

export function renderPrivacyPolicyModal(text) {
    document.getElementById("privacy-policy-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "privacy-policy-overlay";
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "6000";
    overlay.innerHTML = `
        <div class="modal-content" style="border: 2px solid var(--color-accent); background: var(--color-surface); color: var(--color-text); padding: 30px; width: min(560px, 92vw); max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; font-family: 'Courier New', monospace;">
            <h2 class="modal-title-header" style="margin-top:0;">PRIVACY POLICY</h2>
            <div style="overflow-y: auto; padding-right: 6px; margin: 10px 0 20px;">
                <p style="font-size: 12px; line-height: 1.7; color: var(--color-text-muted); white-space: pre-wrap;">${escapeHtml(text)}</p>
            </div>
            <button id="privacy-policy-close" class="modal-btn-primary">CLOSE</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("privacy-policy-close").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
    });
}
