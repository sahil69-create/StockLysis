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
    tbody.innerHTML = `
      <tr><td colspan="7" class="px-4 py-14 text-center">
        <div class="state-wrap">
          <div class="state-icon empty">📋</div>
          <p class="state-title">No intraday positions</p>
          <p class="state-msg">Positions are intraday and reset at the end of each trading day. They'll appear here once you take a position.</p>
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
    headerBox.innerHTML = `
      <div class="positions-header-summary">
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
        </div>
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
async function loadPositions() {
  const tbody = document.getElementById("positions-body");
  tbody.innerHTML = skeletonRows(5, 7);

  try {
    const data = await API.getPositions();
    const positions = data.positions || [];
    renderTable(positions);
    showToast(`${positions.length} position${positions.length !== 1 ? "s" : ""} loaded`, "success", 2000);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"></td></tr>`;
    showError(tbody.querySelector("td"), err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Inject summary row into positions page if not yet present
  if (document.getElementById("positions-header-summary") == null) {
    const t = document.querySelector(".flex-1.overflow-y-auto > .bg-slate-800.rounded-xl");
    if (t) {
      const wrap = document.createElement("div");
      wrap.className = "bg-slate-800/60 border-b border-slate-700 px-6 py-3 mb-0 rounded-t-xl -mb-px";
      wrap.id = "positions-header-summary";
      t.parentNode.insertBefore(wrap, t);
      t.classList.add("rounded-t-none");
    }
  }

  setActiveNav();
  checkHealth();
  loadPositions();

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(loadPositions, CONFIG.REFRESH_INTERVAL_MS);
  }
});
