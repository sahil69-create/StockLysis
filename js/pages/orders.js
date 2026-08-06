/**
 * orders.js
 * Loads, filters and renders the orders page.
 * Depends on: config.js, api.js, utils.js
 */

let _allOrders = [];

// ── Health badge ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
  } catch {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span><span>Offline</span>`;
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (!status) return "<span class='badge bg-slate-700 text-slate-400'>—</span>";
  const s = status.toUpperCase();
  const cls =
    s === "COMPLETE"  ? "badge-complete" :
    s === "CANCELLED" ? "badge-cancelled" :
    "badge-pending";
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
  const buys      = orders.filter(o => o.transaction_type?.toUpperCase() === "BUY").length;
  const sells     = orders.filter(o => o.transaction_type?.toUpperCase() === "SELL").length;

  el.innerHTML = `
    <span class="text-slate-400">Total: <strong class="text-slate-200">${total}</strong></span>
    <span class="text-green-400">Complete: <strong>${completed}</strong></span>
    <span class="text-yellow-400">Pending: <strong>${pending}</strong></span>
    <span class="text-slate-500">Cancelled: <strong>${cancelled}</strong></span>
    <span class="text-sky-400 ml-auto">Buy: <strong>${buys}</strong></span>
    <span class="text-red-400">Sell: <strong>${sells}</strong></span>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(orders) {
  const tbody = document.getElementById("orders-body");

  if (!orders.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-4 py-12 text-center text-slate-500 text-sm">
        No orders match the current filter
      </td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr class="border-b border-slate-700/50 table-row-hover">
      <td class="px-4 py-3 text-xs text-slate-500 font-mono max-w-[120px] truncate" title="${escapeHtml(o.order_id)}">
        ${escapeHtml(o.order_id)}
      </td>
      <td class="px-4 py-3 font-semibold text-sky-400">${escapeHtml(o.symbol)}</td>
      <td class="px-4 py-3 text-center text-slate-300">${escapeHtml(o.order_type) || "—"}</td>
      <td class="px-4 py-3 text-center">${sideBadge(o.transaction_type)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatNumber(o.quantity, 0)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(o.price)}</td>
      <td class="px-4 py-3 text-center">${statusBadge(o.status)}</td>
      <td class="px-4 py-3 text-xs text-slate-400">${formatDateTime(o.order_time)}</td>
    </tr>`).join("");
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
