/**
 * dashboard.js
 * Loads and renders the dashboard page.
 * Depends on: config.js, api.js, utils.js
 */

// ── Palette for allocation bars ───────────────────────────────────────────────
const COLORS = [
  "#0ea5e9","#8b5cf6","#22c55e","#f59e0b","#ef4444",
  "#06b6d4","#ec4899","#14b8a6","#f97316","#6366f1",
];

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
    if (!ok && data.issues?.length) {
      showToast("Backend issues: " + data.issues.join(", "), "error", 6000);
    }
  } catch (err) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span><span>Offline</span>`;
    showToast("Cannot reach backend — is it running?", "error");
  }
}

// ── Stat Cards ────────────────────────────────────────────────────────────────
function renderStatCards(data) {
  const el = document.getElementById("stat-cards");
  const cards = [
    {
      label: "Portfolio Value",
      value: formatINR(data.current_portfolio_value),
      sub: `Invested: ${formatINR(data.invested_amount)}`,
      color: "text-sky-400",
    },
    {
      label: "Total P&L",
      value: formatINR(data.total_pnl),
      sub: formatPercent(data.total_pnl_percent),
      color: pnlClass(data.total_pnl),
    },
    {
      label: "Today's P&L",
      value: formatINR(data.todays_pnl),
      sub: formatPercent(data.todays_pnl_percent),
      color: pnlClass(data.todays_pnl),
    },
    {
      label: "Holdings",
      value: data.holdings_count ?? "—",
      sub: "Active positions",
      color: "text-violet-400",
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="bg-slate-800 rounded-xl p-5 border border-slate-700 card-hover">
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">${c.label}</p>
      <p class="text-2xl font-bold ${c.color} mb-1">${c.value}</p>
      <p class="text-xs text-slate-400">${c.sub}</p>
    </div>`).join("");
}

// ── Movers ────────────────────────────────────────────────────────────────────
function renderMovers(gainers, losers) {
  const gEl = document.getElementById("gainers-list");
  const lEl = document.getElementById("losers-list");

  const item = (m) => `
    <li class="flex items-center justify-between">
      <span class="font-medium text-slate-200">${escapeHtml(m.symbol)}</span>
      <span class="${pnlClass(m.pnl_percent)} font-semibold text-xs">
        ${pnlArrow(m.pnl_percent)} ${formatPercent(m.pnl_percent)}
      </span>
    </li>`;

  gEl.innerHTML = gainers.length
    ? gainers.map(item).join("")
    : `<li class="text-slate-500 text-xs">No gainers</li>`;

  lEl.innerHTML = losers.length
    ? losers.map(item).join("")
    : `<li class="text-slate-500 text-xs">No losers</li>`;
}

// ── Allocation Bars ───────────────────────────────────────────────────────────
function renderAllocation(slices) {
  const el = document.getElementById("allocation-chart");
  if (!slices || !slices.length) {
    el.innerHTML = `<p class="text-slate-500 text-xs">No allocation data</p>`;
    return;
  }

  el.innerHTML = slices.map((s, i) => `
    <div class="mb-2">
      <div class="flex justify-between text-xs text-slate-400 mb-1">
        <span class="font-medium">${escapeHtml(s.label)}</span>
        <span>${formatPercent(s.percent, 1)}</span>
      </div>
      <div class="w-full bg-slate-700 rounded-full h-2">
        <div class="alloc-bar h-2 rounded-full"
          style="width:${s.percent}%; background:${COLORS[i % COLORS.length]}"></div>
      </div>
    </div>`).join("");
}

// ── Holdings Preview Table ────────────────────────────────────────────────────
async function renderHoldingsPreview() {
  const el = document.getElementById("holdings-preview");
  showSpinner(el);
  try {
    const data = await API.getHoldings();
    const top5 = (data.holdings || []).slice(0, 5);
    if (!top5.length) { showEmpty(el, "No holdings"); return; }

    el.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
            <th class="px-4 py-3 text-left">Symbol</th>
            <th class="px-4 py-3 text-right">Qty</th>
            <th class="px-4 py-3 text-right">LTP</th>
            <th class="px-4 py-3 text-right">Current Value</th>
            <th class="px-4 py-3 text-right">P&L</th>
            <th class="px-4 py-3 text-right">P&L %</th>
          </tr>
        </thead>
        <tbody>
          ${top5.map(h => `
            <tr class="border-b border-slate-700/50 table-row-hover">
              <td class="px-4 py-3 font-semibold text-sky-400">${escapeHtml(h.symbol)}</td>
              <td class="px-4 py-3 text-right text-slate-300">${formatNumber(h.quantity, 0)}</td>
              <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.last_traded_price)}</td>
              <td class="px-4 py-3 text-right text-slate-300">${formatINR(h.current_value)}</td>
              <td class="px-4 py-3 text-right ${pnlClass(h.pnl)}">${formatINR(h.pnl)}</td>
              <td class="px-4 py-3 text-right ${pnlClass(h.pnl_percent)} font-semibold">
                ${pnlArrow(h.pnl_percent)} ${formatPercent(h.pnl_percent)}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    showError(el, err.message);
  }
}

// ── Main loader ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Show skeletons immediately
  document.getElementById("stat-cards").innerHTML = skeletonCards(4);
  document.getElementById("gainers-list").innerHTML = `<li class="skeleton h-4 w-full rounded"></li>`.repeat(3);
  document.getElementById("losers-list").innerHTML  = `<li class="skeleton h-4 w-full rounded"></li>`.repeat(3);
  document.getElementById("allocation-chart").innerHTML = skeletonCards(4);

  try {
    const data = await API.getDashboard();
    renderStatCards(data);
    renderMovers(data.top_gainers || [], data.top_losers || []);
    renderAllocation(data.portfolio_allocation || []);
    document.getElementById("last-updated").textContent =
      "Updated " + new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    showToast("Dashboard refreshed", "success", 2000);
  } catch (err) {
    showToast(err.message, "error");
    document.getElementById("stat-cards").innerHTML = `
      <div class="col-span-4">
        ${document.getElementById("stat-cards").innerHTML}
      </div>`;
    showError(document.getElementById("stat-cards"), err.message);
  }

  // Load holdings preview in parallel (independent)
  renderHoldingsPreview();
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
let _refreshTimer = null;

function startAutoRefresh() {
  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    _refreshTimer = setInterval(loadDashboard, CONFIG.REFRESH_INTERVAL_MS);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadDashboard();
  startAutoRefresh();
});
