/**
 * holdings.js
 * Loads, sorts, filters and renders the holdings page.
 * Premium upgrades: weight column, mini sparklines, row animations.
 * Depends on: config.js, api.js, utils.js
 */

let _allHoldings = [];

// ── Sparkline helpers (shared with dashboard) ────────────────────────────────
function _sparkValues(length, seed, volatility = 0.12, base = 50) {
  const values = []; let v = base; let s = seed || 1;
  for (let i = 0; i < length; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rand = s / 233280;
    v = Math.max(base * 0.5, Math.min(base * 1.5, v + (rand - 0.5) * 2 * volatility * v));
    values.push(+v.toFixed(2));
  }
  return values;
}
function _seed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h || 1;
}
function _sparkSVG(values, w = 80, h = 24) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (h - ((v - min) / range) * (h - 4) - 2).toFixed(1);
    return `${x},${y}`;
  }).join(" ");
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.22)";
  const area = `0,${h} ${pts} ${w},${h}`;
  return `<span class="sparkline"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="${area}" fill="${fill}"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg></span>`;
}

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

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary(holdings) {
  const el = document.getElementById("summary-bar");
  const invested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);
  const current  = holdings.reduce((s, h) => s + (h.current_value  || 0), 0);
  const pnl      = current - invested;
  const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;
  const winners  = holdings.filter(h => (h.pnl || 0) > 0).length;
  const losers   = holdings.filter(h => (h.pnl || 0) < 0).length;

  el.innerHTML = `
    <div>
      <p class="text-xs text-slate-500 uppercase tracking-wider">Invested</p>
      <p class="font-semibold text-slate-200 text-base mt-0.5 tabular-nums">${formatINR(invested)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500 uppercase tracking-wider">Current Value</p>
      <p class="font-semibold text-emerald-300 text-base mt-0.5 tabular-nums">${formatINR(current)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500 uppercase tracking-wider">Total P&amp;L</p>
      <p class="font-semibold ${pnlClass(pnl)} text-base mt-0.5 tabular-nums">${pnlArrow(pnl)} ${formatINR(pnl)}</p>
    </div>
    <div>
      <p class="text-xs text-slate-500 uppercase tracking-wider">P&amp;L %</p>
      <p class="font-semibold ${pnlClass(pnlPct)} text-base mt-0.5 tabular-nums">${pnlArrow(pnlPct)} ${formatPercent(pnlPct)}</p>
    </div>
    <div class="hidden md:block">
      <p class="text-xs text-slate-500 uppercase tracking-wider">Hit rate</p>
      <p class="font-semibold text-slate-200 text-base mt-0.5 tabular-nums">
        <span class="pnl-positive">${winners}</span>
        <span class="text-slate-600 mx-1">/</span>
        <span class="pnl-negative">${losers}</span>
      </p>
    </div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(holdings) {
  const tbody = document.getElementById("holdings-body");
  if (!holdings.length) {
    tbody.innerHTML = `
      <tr><td colspan="10" class="px-4 py-14 text-center text-slate-500 text-sm">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        No holdings found
      </td></tr>`;
    return;
  }

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);

  tbody.innerHTML = holdings.map((h, i) => {
    const weight = totalInvested > 0 ? ((h.invested_value || 0) / totalInvested) * 100 : 0;
    const spark = _sparkSVG(_sparkValues(20, _seed(h.symbol + "hold"), 0.15, 50), 78, 22);

    const weightBarColor = weight >= 25
      ? "rgba(239,68,68,0.7)"
      : weight >= 12
        ? "rgba(245,158,11,0.65)"
        : "rgba(16,185,129,0.6)";

    const hasRealName = h.company_name && h.company_name !== h.symbol;
    const nameCell = hasRealName
      ? `<p class="font-bold text-emerald-400 tracking-tight truncate">${escapeHtml(h.company_name)}</p>
         <p class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
           ${escapeHtml(h.symbol)}${h.exchange ? ` · ${escapeHtml(h.exchange)}` : ""}
         </p>`
      : `<p class="font-bold text-emerald-400 tracking-tight">${escapeHtml(h.symbol)}</p>
         ${h.exchange ? `<p class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">${escapeHtml(h.exchange)}</p>` : ""}`;

    const avatarSeed = (h.company_name || h.symbol || "").slice(0, 2).toUpperCase();

    return `
    <tr class="border-b border-slate-700/40 table-row-hover fade-up" style="animation-delay:${i*35}ms">
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <div class="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-sm font-bold text-white"
               style="background: hsl(${((h.company_name||h.symbol).length*37)%360} 70% 50%); box-shadow: 0 6px 16px -6px hsl(${((h.company_name||h.symbol).length*37)%360} 70% 50% / .6);">
            ${avatarSeed}
          </div>
          <div>
            ${nameCell}
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatNumber(h.quantity, 0)}</td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatINR(h.average_price)}</td>
      <td class="px-4 py-3.5 text-right font-semibold text-slate-100 tabular-nums">${formatINR(h.last_traded_price)}</td>
      <td class="px-4 py-3.5 text-right hidden md:table-cell">
        <div class="flex items-center justify-end gap-2 min-w-[90px]">
          <span class="text-xs text-slate-400 tabular-nums w-10 text-right">${formatPercent(weight)}</span>
          <div class="w-16 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
            <div class="h-full rounded-full" style="width:${Math.min(100, weight)}%; background:${weightBarColor}"></div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatINR(h.invested_value)}</td>
      <td class="px-4 py-3.5 text-right text-slate-100 font-medium tabular-nums">${formatINR(h.current_value)}</td>
      <td class="px-4 py-3.5 text-right hidden lg:table-cell">${spark}</td>
      <td class="px-4 py-3.5 text-right ${pnlClass(h.pnl)} font-semibold tabular-nums">${formatINR(h.pnl)}</td>
      <td class="px-4 py-3.5 text-right">
        <span class="inline-flex items-center justify-end min-w-[72px] gap-1 font-bold tabular-nums ${pnlClass(h.pnl_percent)}">
          ${pnlArrow(h.pnl_percent)} ${formatPercent(h.pnl_percent)}
        </span>
      </td>
    </tr>`;
  }).join("");
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
  tbody.innerHTML = skeletonRows(8, 10);
  document.getElementById("summary-bar").innerHTML = "";

  try {
    const data = await API.getHoldings();
    _allHoldings = data.holdings || [];
    renderSummary(_allHoldings);
    applyFilters();
    showToast(`${_allHoldings.length} holdings loaded`, "success", 2000);
  } catch (err) {
    const container = document.createElement("tr");
    container.innerHTML = `<td colspan="10"></td>`;
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
