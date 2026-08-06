/**
 * orders.js
 * Orders page — premium summary, symbol tiles, fade-up animations, filters.
 */

let _allOrders = [];

// ── Health badge ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}" style="color: ${ok ? "#4ade80" : "#fbbf24"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
  } catch {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500" style="color:#f87171"></span><span>Offline</span>`;
  }
}

// ── Status badges ─────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (!status) return "<span class='badge badge-cancelled'>—</span>";
  const s = status.toUpperCase();
  const cls = s === "COMPLETE" ? "badge-complete" : s === "CANCELLED" ? "badge-cancelled" : "badge-pending";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function sideBadge(type) {
  if (!type) return "—";
  const s = type.toUpperCase();
  return `<span class="badge ${s === "BUY" ? "badge-buy" : "badge-sell"}">${escapeHtml(type)}</span>`;
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary(orders) {
  const el = document.getElementById("orders-summary");
  const total     = orders.length;
  const completed = orders.filter(o => o.status?.toUpperCase() === "COMPLETE").length;
  const pending   = orders.filter(o => !["COMPLETE","CANCELLED"].includes(o.status?.toUpperCase())).length;
  const cancelled = orders.filter(o => o.status?.toUpperCase() === "CANCELLED").length;
  const buys      = orders.filter(o => o.transaction_type?.toUpperCase() === "BUY");
  const sells     = orders.filter(o => o.transaction_type?.toUpperCase() === "SELL");
  const buyVal    = buys.reduce((s, o) => s + ((o.price || 0) * (o.quantity || 0)), 0);
  const sellVal   = sells.reduce((s, o) => s + ((o.price || 0) * (o.quantity || 0)), 0);

  el.innerHTML = `
    <div>
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
      <p class="font-semibold text-slate-200 text-sm mt-0.5 tabular-nums">${total}</p>
    </div>
    <div>
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Complete</p>
      <p class="font-semibold text-emerald-300 text-sm mt-0.5 tabular-nums">${completed}</p>
    </div>
    <div>
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Pending</p>
      <p class="font-semibold text-yellow-300 text-sm mt-0.5 tabular-nums">${pending}</p>
    </div>
    <div>
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Cancelled</p>
      <p class="font-semibold text-slate-400 text-sm mt-0.5 tabular-nums">${cancelled}</p>
    </div>
    <div class="hidden md:block">
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Buy Value</p>
      <p class="font-semibold text-emerald-300 text-sm mt-0.5 tabular-nums">${formatINR(buyVal)}</p>
    </div>
    <div class="hidden md:block">
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">Sell Value</p>
      <p class="font-semibold text-rose-300 text-sm mt-0.5 tabular-nums">${formatINR(sellVal)}</p>
    </div>
    <div class="ml-auto hidden sm:block">
      <p class="text-[10px] text-slate-500 uppercase tracking-wider">B / S</p>
      <p class="font-semibold text-sm mt-0.5 tabular-nums">
        <span class="pnl-positive">${buys.length}</span>
        <span class="text-slate-600 mx-1">·</span>
        <span class="pnl-negative">${sells.length}</span>
      </p>
    </div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(orders) {
  const tbody = document.getElementById("orders-body");

  if (!orders.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-4 py-14 text-center text-slate-500 text-sm">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
        No orders match the current filter
      </td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((o, i) => {
    const hue = ((o.symbol.length * 37) + (o.symbol.charCodeAt(0) || 0) * 13) % 360;
    const side = (o.transaction_type || "").toUpperCase();
    return `
    <tr class="border-b border-slate-700/40 table-row-hover fade-up" style="animation-delay:${i*25}ms">
      <td class="px-4 py-3.5 text-xs text-slate-500 font-mono max-w-[120px] truncate" title="${escapeHtml(o.order_id)}">
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/40 border border-slate-700/60">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          <span>${escapeHtml(o.order_id).slice(-10)}</span>
        </span>
      </td>
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <div class="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-sm font-bold text-white"
               style="background: linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue+40)%360} 70% 45%)); box-shadow: 0 6px 16px -6px hsl(${hue} 70% 50% / .6);">
            ${o.symbol.slice(0,2).toUpperCase()}
          </div>
          <div>
            <p class="font-bold ${side === "BUY" ? "text-emerald-400" : "text-rose-400"} tracking-tight">${escapeHtml(o.symbol)}</p>
            ${o.exchange ? `<p class="text-[10px] text-slate-500 uppercase tracking-wider">${escapeHtml(o.exchange)}</p>` : ""}
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-center text-slate-300 text-xs">${escapeHtml(o.order_type) || "—"}</td>
      <td class="px-4 py-3.5 text-center">${sideBadge(o.transaction_type)}</td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatNumber(o.quantity, 0)}</td>
      <td class="px-4 py-3.5 text-right font-semibold text-slate-100 tabular-nums">${formatINR(o.price)}</td>
      <td class="px-4 py-3.5 text-center">${statusBadge(o.status)}</td>
      <td class="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">${formatDateTime(o.order_time)}</td>
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
async function loadOrders() {
  const tbody = document.getElementById("orders-body");
  tbody.innerHTML = skeletonRows(8, 8);
  document.getElementById("orders-summary").innerHTML = "";

  try {
    const data = await API.getOrders();
    _allOrders = data.orders || [];
    renderSummary(_allOrders);
    applyFilters();
    showToast(`${_allOrders.length} orders loaded`, "success", 2000);
  } catch (err) {
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
    setInterval(loadOrders, CONFIG.REFRESH_INTERVAL_MS);
  }
});
