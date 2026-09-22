/**
 * SEVEN BITS COFFEE - FIRST-RUN SETUP
 * Location: /js/ui/first-run-setup.js
 *
 * Shown instead of the normal app on a genuinely fresh install (see GET
 * /api/setup/status) - creates the real owner account and names the shop/
 * first store before anyone can use the app for real, optionally loading
 * the bundled demo catalog to explore with. Not a modal (there's nothing
 * to see behind it yet, and no session to cancel back to) - a full-screen
 * page that replaces the boot flow entirely until POST /api/setup/complete
 * succeeds, at which point it just reloads the page so the normal boot
 * sequence runs fresh against the now-configured app.
 */
import { renderPasswordStrengthMeter } from "../features/password-strength.js";

function escapeHtmlAttr(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fieldStyle(extra = "") {
    return `width:100%; box-sizing:border-box; background:var(--color-bg); border:1px solid var(--color-border); color:var(--color-text); padding:11px; font-family:inherit; margin: 4px 0 12px; ${extra}`;
}

export function renderFirstRunSetup() {
    document.getElementById("boot-loading-overlay")?.remove();
    document.getElementById("first-run-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "first-run-overlay";
    overlay.style.cssText = "position:fixed; inset:0; z-index:9000; background:var(--color-bg); overflow-y:auto; display:flex; align-items:center; justify-content:center; padding:24px;";
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div style="width:min(460px, 100%); font-family:'Courier New',monospace; color:var(--color-text);">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:22px; font-weight:bold; letter-spacing:.06em; color:var(--color-accent);">SEVEN BITS COFFEE</div>
                <div style="font-size:11px; color:var(--color-text-muted); letter-spacing:.16em; text-transform:uppercase; margin-top:6px;">First-time setup</div>
            </div>
            <div style="border:2px solid var(--color-accent); background:var(--color-surface); padding:26px;">
                <h2 class="modal-title-header" style="margin-top:0;">CREATE YOUR OWNER ACCOUNT</h2>
                <p style="font-size:11px; color:var(--color-text-muted); margin-top:-6px;">This is the real account you'll use every day - full access to everything.</p>
                <label for="fr-owner-name" class="field-hint">YOUR NAME</label>
                <input id="fr-owner-name" type="text" autocomplete="name" style="${fieldStyle()}" />
                <label for="fr-owner-username" class="field-hint">USERNAME</label>
                <input id="fr-owner-username" type="text" autocomplete="username" style="${fieldStyle()}" />
                <label for="fr-owner-password" class="field-hint">PASSWORD</label>
                <input id="fr-owner-password" type="password" autocomplete="new-password" style="${fieldStyle("margin-bottom:4px;")}" />
                <div id="fr-password-meter"></div>

                <h2 class="modal-title-header" style="margin-top:22px;">NAME YOUR SHOP</h2>
                <label for="fr-shop-name" class="field-hint">SHOP NAME</label>
                <input id="fr-shop-name" type="text" value="SEVEN BITS COFFEE" style="${fieldStyle()}" />
                <label for="fr-shop-address" class="field-hint">ADDRESS (OPTIONAL - SHOWN ON HOME PAGE)</label>
                <input id="fr-shop-address" type="text" style="${fieldStyle()}" />
                <label for="fr-shop-phone" class="field-hint">PHONE (OPTIONAL)</label>
                <input id="fr-shop-phone" type="tel" style="${fieldStyle()}" />

                <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--color-text); cursor:pointer; margin:14px 0 4px;">
                    <input id="fr-load-demo" type="checkbox" style="margin-top:2px;" />
                    <span>Load a sample menu &amp; branding so there's something to look at right away - safe to turn off later from Admin &gt; Data &amp; Backup.</span>
                </label>

                <p id="fr-error" style="color:var(--color-danger); font-size:11px; min-height:12px; margin:12px 0 0;"></p>
                <button id="fr-submit" class="modal-btn-primary" style="width:100%; margin-top:10px;">COMPLETE SETUP</button>
            </div>
        </div>
    `;

    const pwField = document.getElementById("fr-owner-password");
    const meterEl = document.getElementById("fr-password-meter");
    pwField.addEventListener("input", () => renderPasswordStrengthMeter(meterEl, pwField.value));

    document.getElementById("fr-submit").addEventListener("click", async () => {
        const errorEl = document.getElementById("fr-error");
        errorEl.textContent = "";
        const submitBtn = document.getElementById("fr-submit");
        const body = {
            ownerName: document.getElementById("fr-owner-name").value,
            ownerUsername: document.getElementById("fr-owner-username").value,
            ownerPassword: pwField.value,
            shopName: document.getElementById("fr-shop-name").value,
            storeAddress: document.getElementById("fr-shop-address").value,
            storePhone: document.getElementById("fr-shop-phone").value,
            loadDemoData: document.getElementById("fr-load-demo").checked
        };
        submitBtn.disabled = true;
        submitBtn.textContent = "SETTING UP…";
        try {
            const res = await fetch("/api/setup/complete", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not complete setup");
            // Simplest correct way to hand off into the normal boot flow -
            // the session cookie is already set, so this reload lands
            // straight in the app as the new owner, config/menu freshly
            // reflecting whatever was just set (and demo data, if chosen).
            window.location.reload();
        } catch (e) {
            errorEl.textContent = e.message || "Something went wrong";
            submitBtn.disabled = false;
            submitBtn.textContent = "COMPLETE SETUP";
        }
    });

    overlay.querySelectorAll("input").forEach((input) => {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") document.getElementById("fr-submit").click();
        });
    });
}
