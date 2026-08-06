/**
 * watchlist.js
 * Loads and renders the watchlist page as a card grid.
 * Depends on: config.js, api.js, utils.js
 */

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

// ── Card renderer ─────────────────────────────────────────────────────────────
function renderCards(items) {
  const grid = document.getElementById("watchlist-grid");

  if (!items.length) {
    showEmpty(grid, "No symbols in watchlist. Add NSE symbols to WATCHLIST_SYMBOLS in backend .env");
    return;
  }

  grid.innerHTML = items.map(item => {
    const hasChange = item.change_percent !== null && item.change_percent !== undefined;
    const cls = hasChange ? pnlClass(item.change_percent) : "pnl-neutral";
    const arrow = hasChange ? pnlArrow(item.change_percent) : "";

    return `
      <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 card-hover flex flex-col gap-3">
        <!-- Symbol & exchange -->
        <div class="flex items-start justify-between">
          <div>
            <p class="text-base font-bold text-sky-400">${escapeHtml(item.symbol)}</p>
            ${item.company_name
              ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(item.company_name)}</p>`
              : `<p class="text-xs text-slate-600">NSE</p>`}
          </div>
          <span class="text-xs text-slate-600 bg-slate-700 px-2 py-0.5 rounded">NSE</span>
        </div>

        <!-- LTP -->
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-0.5">LTP</p>
          <p class="text-2xl font-bold text-slate-100">
            ${item.last_traded_price !== null && item.last_traded_price !== undefined
              ? formatINR(item.last_traded_price)
              : `<span class="text-slate-600 text-base">—</span>`}
          </p>
        </div>

        <!-- Change -->
        ${hasChange ? `
          <div class="flex items-center gap-1 text-sm font-semibold ${cls}">
            <span>${arrow}</span>
            <span>${formatPercent(item.change_percent)}</span>
          </div>` : `<div class="text-xs text-slate-600">No change data</div>`}
      </div>`;
  }).join("");
}

// ── Skeleton cards while loading ──────────────────────────────────────────────
function showSkeletonGrid(count = 6) {
  const grid = document.getElementById("watchlist-grid");
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
      <div class="skeleton h-4 w-24 rounded"></div>
      <div class="skeleton h-8 w-32 rounded"></div>
      <div class="skeleton h-3 w-16 rounded"></div>
    </div>`).join("");
}

// ── Main loader ───────────────────────────────────────────────────────────────
async function loadWatchlist() {
  showSkeletonGrid();
  try {
    const data = await API.getWatchlist();
    const items = data.watchlist || [];
    renderCards(items);
    showToast(`${items.length} symbol${items.length !== 1 ? "s" : ""} in watchlist`, "success", 2000);
  } catch (err) {
    const grid = document.getElementById("watchlist-grid");
    showError(grid, err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadWatchlist();

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(loadWatchlist, CONFIG.REFRESH_INTERVAL_MS);
  }
});
