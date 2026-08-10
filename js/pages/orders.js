/**
 * orders.js
 * Orders page — premium summary, symbol tiles, fade-up animations, filters.
 */

let _allOrders = [];

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
      <span style="display:inline-flex;align-items:center;gap:.35rem;">
        <span class="health-dot${ok ? "" : " err"}"></span>
        <span class="${C.secondary}">${ok ? "Backend OK" : "Degraded"}</span>
      </span>`;
  } catch {
    badge.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:.35rem;">
        <span class="health-dot err"></span>
        <span class="${C.tertiary}">Offline</span>
      </span>`;
  }
}

// ── Status badges ─────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (!status) return "<span class='badge badge-cancelled'>—</span>";
  const s = status.toUpperCase();
  let cls = "badge-pending";
  if (s === "COMPLETE" || s === "EXECUTED" || s === "FILLED") cls = "badge-complete";
  else if (s === "CANCELLED" || s === "REJECTED" || s === "FAILED") cls = "badge-cancelled";
  else if (s === "REJECTED") cls = "badge-rejected";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function sideBadge(type) {
  if (!type) return "—";
  const s = type.toUpperCase();
  return `<span class="badge ${s === "BUY" ? "badge-buy" : "badge-sell"}" style="${s === "BUY" ? "background:color-mix(in srgb,var(--success-500) 16%, var(--bg-soft));color:var(--success-600);border-color:color-mix(in srgb,var(--success-500) 30%, var(--border));" : "background:color-mix(in srgb,var(--error-500) 16%, var(--bg-soft));color:var(--error-600);border-color:color-mix(in srgb,var(--error-500) 30%, var(--border));"}">${escapeHtml(type)}</span>`;
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary(orders) {
  const el = document.getElementById("orders-summary");
  const total     = orders.length;
  const completed = orders.filter(o => ["COMPLETE","EXECUTED","FILLED"].includes(o.status?.toUpperCase())).length;
  const pending   = orders.filter(o => !["COMPLETE","CANCELLED","EXECUTED","FILLED","REJECTED","FAILED"].includes(o.status?.toUpperCase())).length;
  const cancelled = orders.filter(o => ["CANCELLED","REJECTED","FAILED"].includes(o.status?.toUpperCase())).length;
  const buys      = orders.filter(o => o.transaction_type?.toUpperCase() === "BUY");
  const sells     = orders.filter(o => o.transaction_type?.toUpperCase() === "SELL");
  const buyVal    = buys.reduce((s, o) => s + ((o.price || 0) * (o.quantity || 0)), 0);
  const sellVal   = sells.reduce((s, o) => s + ((o.price || 0) * (o.quantity || 0)), 0);

  el.innerHTML = `
    <div class="summary-stat">
      <p class="sl">Total</p>
      <p class="sv ${C.primary}">${total}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Complete</p>
      <p class="sv up">${completed}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Pending</p>
      <p class="sv" style="color:var(--warning-600);">${pending}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Cancelled</p>
      <p class="sv ${C.secondary}">${cancelled}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Buy Value</p>
      <p class="sv up">${formatINR(buyVal)}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Sell Value</p>
      <p class="sv down">${formatINR(sellVal)}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">B / S</p>
      <p class="sv ${C.primary}">
        <span class="pnl-positive">${buys.length}</span>
        <span style="color:var(--text-muted);margin:0 .25rem;">·</span>
        <span class="pnl-negative">${sells.length}</span>
      </p>
    </div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(orders) {
  const tbody = document.getElementById("orders-body");

  if (!orders.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-4 py-14 text-center">
        <div class="state-wrap">
          <div class="state-icon empty">📋</div>
          <p class="state-title">No orders found</p>
          <p class="state-msg">No orders match the current filter. Try clearing filters or check back after placing an order on Groww.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((o, i) => {
    const hue = ((o.symbol.length * 37) + (o.symbol.charCodeAt(0) || 0) * 13) % 360;
    const side = (o.transaction_type || "").toUpperCase();
    const sideColor = side === "BUY" ? "var(--success-600)" : "var(--error-600)";
    return `
    <tr class="table-row-hover fade-up" style="animation-delay:${i*25}ms">
      <td class="px-4 py-3.5" title="${escapeHtml(o.order_id)}">
        <span class="order-id-chip">
          <span class="oid-dot"></span>
          <span class="${C.tertiary}" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;">${escapeHtml(o.order_id).slice(-10)}</span>
        </span>
      </td>
      <td class="px-4 py-3.5">
        <div class="stock-cell">
          <div class="stock-avatar" style="background:hsl(${hue} 65% 50%);">
            ${o.symbol.slice(0,2).toUpperCase()}
          </div>
          <div class="stock-meta">
            <span class="stock-name" style="color:${sideColor};">${escapeHtml(o.symbol)}</span>
            ${o.exchange ? `<span class="stock-sym">${escapeHtml(o.exchange)}</span>` : ""}
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-center ${C.secondary}" style="font-size:12.5px;">${escapeHtml(o.order_type) || "—"}</td>
      <td class="px-4 py-3.5 text-center">${sideBadge(o.transaction_type)}</td>
      <td class="px-4 py-3.5 right num ${C.primary}">${formatNumber(o.quantity, 0)}</td>
      <td class="px-4 py-3.5 right num ${C.primary}" style="font-weight:600;">${formatINR(o.price)}</td>
      <td class="px-4 py-3.5 text-center">${statusBadge(o.status)}</td>
      <td class="px-4 py-3.5 ${C.secondary}" style="font-size:12px;white-space:nowrap;">${formatDateTime(o.order_time)}</td>
    </tr>`;
  }).join("");
}

// ── Apply filters ─────────────────────────────────────────────────────────────
function applyFilters() {
  const statusFilter = document.getElementById("filter-status").value.toUpperCase();
  const typeFilter   = document.getElementById("filter-type").value.toUpperCase();

  let result = _allOrders.filter(o => {
    const statusOk = !statusFilter || o.status?.toUpperCase() === statusFilter ||
      (statusFilter === "OPEN" && !["COMPLETE","CANCELLED"].includes(o.status?.toUpperCase()));
    const typeOk   = !typeFilter   || o.transaction_type?.toUpperCase() === typeFilter;
    return statusOk && typeOk;
  });

  renderTable(result);
}

// ── Main loader ───────────────────────────────────────────────────────────────
// silent=true (interval auto-refresh) skips the skeleton wipe and success
// toast so periodic updates patch the table in place instead of flashing.
async function loadOrders(opts = {}) {
  const silent = !!opts.silent;
  const tbody = document.getElementById("orders-body");
  if (!silent) {
    tbody.innerHTML = skeletonRows(8, 8);
    document.getElementById("orders-summary").innerHTML = "";
  }

  try {
    const data = await API.getOrders();
    _allOrders = data.orders || [];
    renderSummary(_allOrders);
    applyFilters();
    if (!silent) showToast(`${_allOrders.length} orders loaded`, "success", 2000);
  } catch (err) {
    if (silent) return; // keep the last-good table rather than replacing it with an error on a background tick
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-12"></td></tr>`;
    showError(tbody.querySelector("td"), err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadOrders();

  document.getElementById("filter-status").addEventListener("change", applyFilters);
  document.getElementById("filter-type").addEventListener("change", applyFilters);

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(() => loadOrders({ silent: true }), CONFIG.REFRESH_INTERVAL_MS);
  }
});
