/**
 * holdings.js
 * Loads, sorts, filters and renders the holdings page.
 * Depends on: config.js, api.js, utils.js
 */

let _allHoldings = [];

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

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary(holdings) {
  const el = document.getElementById("summary-bar");
  const invested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);
  const current  = holdings.reduce((s, h) => s + (h.current_value  || 0), 0);
  const pnl      = current - invested;
  const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;

  el.innerHTML = `
    <div>
      <p class="text-xs text-slate-500">Invested</p>
      <p class="font-semibold text-slate-200">${formatINR(invested)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500">Current Value</p>
      <p class="font-semibold text-slate-200">${formatINR(current)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500">Total P&L</p>
      <p class="font-semibold ${pnlClass(pnl)}">${formatINR(pnl)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500">P&L %</p>
      <p class="font-semibold ${pnlClass(pnlPct)}">${pnlArrow(pnlPct)} ${formatPercent(pnlPct)}</p>
    </div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(holdings) {
  const tbody = document.getElementById("holdings-body");
  if (!holdings.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-4 py-12 text-center text-slate-500 text-sm">
        No holdings found
      </td></tr>`;
    return;
  }

  tbody.innerHTML = holdings.map(h => `
    <tr class="border-b border-slate-700/50 table-row-hover">
      <td class="px-4 py-3">
        <p class="font-semibold text-sky-400">${escapeHtml(h.symbol)}</p>
        ${h.exchange ? `<p class="text-xs text-slate-500">${escapeHtml(h.exchange)}</p>` : ""}
      </td>
      <td class="px-4 py-3 text-right text-slate-300">${formatNumber(h.quantity, 0)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.average_price)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.last_traded_price)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.invested_value)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.current_value)}</td>
      <td class="px-4 py-3 text-right ${pnlClass(h.pnl)} font-medium">${formatINR(h.pnl)}</td>
      <td class="px-4 py-3 text-right ${pnlClass(h.pnl_percent)} font-semibold">
        ${pnlArrow(h.pnl_percent)} ${formatPercent(h.pnl_percent)}
      </td>
    </tr>`).join("");
}

// ── Filter + Sort ─────────────────────────────────────────────────────────────
function applyFilters() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  const sortBy = document.getElementById("sort-select").value;

  let result = _allHoldings.filter(h =>
    !query || h.symbol.toLowerCase().includes(query)
  );

  result.sort((a, b) => {
    if (sortBy === "symbol")      return a.symbol.localeCompare(b.symbol);
    if (sortBy === "pnl")         return (b.pnl || 0) - (a.pnl || 0);
    if (sortBy === "pnl_percent") return (b.pnl_percent || 0) - (a.pnl_percent || 0);
    if (sortBy === "current_value") return (b.current_value || 0) - (a.current_value || 0);
    return 0;
  });

  renderTable(result);
}

// ── Main loader ───────────────────────────────────────────────────────────────
async function loadHoldings() {
  const tbody = document.getElementById("holdings-body");
  tbody.innerHTML = skeletonRows(8, 8);
  document.getElementById("summary-bar").innerHTML = "";

  try {
    const data = await API.getHoldings();
    _allHoldings = data.holdings || [];
    renderSummary(_allHoldings);
    applyFilters();
    showToast(`${_allHoldings.length} holdings loaded`, "success", 2000);
  } catch (err) {
    const container = document.createElement("tr");
    container.innerHTML = `<td colspan="8"></td>`;
    tbody.innerHTML = "";
    tbody.appendChild(container);
    showError(container.querySelector("td"), err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadHoldings();

  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("sort-select").addEventListener("change", applyFilters);

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(loadHoldings, CONFIG.REFRESH_INTERVAL_MS);
  }
});
