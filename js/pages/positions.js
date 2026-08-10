/**
 * positions.js
 * Intraday positions page — symbol tiles, badges, fade-ups.
 */

function _isDark() {
  return document.documentElement.classList.contains("dark");
}
const C = {
  primary:   "text-mode-primary",
  secondary: "text-mode-secondary",
  tertiary:  "text-mode-tertiary",
};

// ── Health badge ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="health ${ok ? "" : "err"}" style="display:inline-flex;align-items:center;gap:.35rem;">
        <span class="health-dot${ok ? "" : " err"}"></span>
        <span class="${C.secondary}">${ok ? "Backend OK" : "Degraded"}</span>
      </span>`;
  } catch {
    badge.innerHTML = `
      <span class="health" style="display:inline-flex;align-items:center;gap:.35rem;">
        <span class="health-dot err"></span>
        <span class="${C.tertiary}">Offline</span>
      </span>`;
  }
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(positions) {
  const tbody = document.getElementById("positions-body");

  if (!positions.length) {
    const headerBox = document.getElementById("positions-header-summary");
    if (headerBox) headerBox.innerHTML = "";
    tbody.innerHTML = `
      <tr><td colspan="6" class="px-4 py-16 text-center">
        <div class="state-wrap">
          <svg class="empty-illustration" width="128" height="96" viewBox="0 0 128 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="14" y="30" width="100" height="54" rx="10" fill="var(--bg-soft)" stroke="var(--border)" stroke-width="1.5"/>
            <path d="M14 52h27a5 5 0 0 1 4.6 3l3 7a5 5 0 0 0 4.6 3h21.6a5 5 0 0 0 4.6-3l3-7a5 5 0 0 1 4.6-3h27" stroke="var(--border)" stroke-width="1.5" fill="none"/>
            <rect x="34" y="12" width="60" height="34" rx="8" fill="var(--bg-elev)" stroke="var(--border)" stroke-width="1.5"/>
            <path d="M46 32l9-11 8 8 11-13" stroke="var(--brand-500)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="74" cy="16" r="3" fill="var(--brand-500)"/>
            <circle cx="30" cy="66" r="3" fill="var(--border)"/>
            <circle cx="98" cy="66" r="3" fill="var(--border)"/>
          </svg>
          <p class="state-title">No Active Positions</p>
          <p class="state-msg">Positions are intraday and reset at the end of each trading day. Once you take a position on Groww, it'll appear here automatically.</p>
        </div>
      </td></tr>`;
    return;
  }

  const totalQty = positions.reduce((s, p) => s + (Math.abs(p.quantity) || 0), 0);
  const posCount = positions.length;
  const winCount = positions.filter(p => (p.pnl || 0) > 0).length;
  const lossCount = positions.filter(p => (p.pnl || 0) < 0).length;
  const netPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  const headerBox = document.getElementById("positions-header-summary");
  if (headerBox) {
    headerBox.className = "positions-header-summary";
    headerBox.innerHTML = `
        <div class="summary-stat">
          <p class="sl">Active</p>
          <p class="sv ${C.primary}">${posCount}</p>
        </div>
        <div class="summary-stat">
          <p class="sl">Total Qty</p>
          <p class="sv brand">${totalQty}</p>
        </div>
        <div class="summary-stat">
          <p class="sl">Win / Loss</p>
          <p class="sv ${C.primary}">
            <span class="pnl-positive">${winCount}</span>
            <span style="color:var(--text-muted);margin:0 .3rem;">/</span>
            <span class="pnl-negative">${lossCount}</span>
          </p>
        </div>
        <div class="summary-stat">
          <p class="sl">Net P&amp;L</p>
          <p class="sv ${netPnl >= 0 ? 'up' : 'down'}">${formatINR(netPnl)}</p>
        </div>`;
  }

  tbody.innerHTML = positions.map((p, i) => {
    const hue = ((p.symbol.length * 37) + (p.symbol.charCodeAt(0) || 0) * 13) % 360;
    const hasLive = p.last_traded_price != null && p.last_traded_price > 0 && Math.abs(p.last_traded_price - p.average_price) > 0.001;
    const ltpStatus = hasLive ? "" : (p.last_traded_price != null ? "stale" : "off");
    const liveLtp = hasLive ? p.last_traded_price : p.average_price;

    return `
    <tr class="table-row-hover fade-up" style="animation-delay:${i*45}ms">
      <td class="px-4 py-3.5">
        <div class="stock-cell">
          <div class="stock-avatar" style="background: hsl(${hue} 65% 50%);">
            ${p.symbol.slice(0,2).toUpperCase()}
          </div>
          <div class="stock-meta">
            <span class="stock-name">${escapeHtml(p.symbol)}</span>
            ${p.exchange ? `<span class="stock-sym">${escapeHtml(p.exchange)}</span>` : ""}
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right num ${C.primary}">${formatNumber(p.quantity, 0)}</td>
      <td class="px-4 py-3.5 right">
        <div class="dual-data">
          <div class="dd-row">
            <span class="dd-label" style="color:var(--text-muted);">AVG</span>
            <span class="dd-val inv">${formatINR(p.average_price)}</span>
          </div>
          <div class="dd-row">
            <span class="dd-label" style="color:var(--brand-600);">
              <span class="live-dot ${ltpStatus}" style="width:5px;height:5px;"></span>LTP
            </span>
            <span class="dd-val live">${formatINR(liveLtp)}</span>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right num ${pnlClass(p.pnl)}">
        ${pnlArrow(p.pnl || 0)} ${formatINR(p.pnl)}
      </td>
      <td class="px-4 py-3.5 text-center">
        ${p.product
          ? `<span class="badge ${(p.product||"").toUpperCase().includes("MIS") ? "badge-pending" : "badge-complete"}">${escapeHtml(p.product)}</span>`
          : "—"}
      </td>
      <td class="px-4 py-3.5 text-center ${C.secondary}">${escapeHtml(p.exchange) || "—"}</td>
    </tr>`;
  }).join("");
}

// ── Main loader ───────────────────────────────────────────────────────────────
// silent=true (interval auto-refresh) skips the skeleton wipe and success
// toast so periodic updates patch the table in place instead of flashing.
async function loadPositions(opts = {}) {
  const silent = !!opts.silent;
  const tbody = document.getElementById("positions-body");
  if (!silent) tbody.innerHTML = skeletonRows(5, 6);

  try {
    const data = await API.getPositions();
    const positions = data.positions || [];
    renderTable(positions);
    if (!silent) showToast(`${positions.length} position${positions.length !== 1 ? "s" : ""} loaded`, "success", 2000);
  } catch (err) {
    if (silent) return; // keep the last-good table rather than replacing it with an error on a background tick
    tbody.innerHTML = `<tr><td colspan="6"></td></tr>`;
    showError(tbody.querySelector("td"), err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadPositions();

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(() => loadPositions({ silent: true }), CONFIG.REFRESH_INTERVAL_MS);
  }
});
