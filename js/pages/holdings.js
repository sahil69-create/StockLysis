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

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary(holdings) {
  const el = document.getElementById("summary-bar");
  const invested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);
  const current  = holdings.reduce((s, h) => s + (h.current_value  || h.invested_value || 0), 0);
  const pnl      = current - invested;
  const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;
  const winners  = holdings.filter(h => (h.pnl || 0) > 0).length;
  const losers   = holdings.filter(h => (h.pnl || 0) < 0).length;

  el.innerHTML = `
    <div class="summary-stat">
      <p class="sl data-invested-label">Invested</p>
      <p class="sv ${C.primary}">${formatINR(invested)}</p>
    </div>
    <div class="summary-stat">
      <p class="sl data-live-label">
        <span class="live-dot" style="vertical-align:middle;"></span>Current
      </p>
      <p class="sv brand">${formatINR(current)}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">Total P&amp;L</p>
      <p class="sv ${pnl >= 0 ? 'up' : 'down'}">${pnlArrow(pnl)} ${formatINR(pnl)}</p>
    </div>
    <div class="summary-stat">
      <p class="sl">P&amp;L %</p>
      <p class="sv ${pnlPct >= 0 ? 'up' : 'down'}">${pnlArrow(pnlPct)} ${formatPercent(pnlPct)}</p>
    </div>
    <div class="summary-stat" style="display:none;">
      <p class="sl">Hit rate</p>
      <p class="sv ${C.primary}">
        <span class="pnl-positive">${winners}</span>
        <span style="color:var(--text-muted);margin:0 .25rem;">/</span>
        <span class="pnl-negative">${losers}</span>
      </p>
    </div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(holdings) {
  const tbody = document.getElementById("holdings-body");
  if (!holdings.length) {
    tbody.innerHTML = `
      <tr><td colspan="10" class="px-4 py-14 text-center">
        <div class="state-wrap">
          <div class="state-icon empty">📊</div>
          <p class="state-title">No holdings found</p>
          <p class="state-msg">Your portfolio appears empty. Holdings will appear here once your Groww account data syncs.</p>
        </div>
      </td></tr>`;
    return;
  }

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);

  tbody.innerHTML = holdings.map((h, i) => {
    const weight = totalInvested > 0 ? ((h.invested_value || 0) / totalInvested) * 100 : 0;
    const spark = _sparkSVG(_sparkValues(20, _seed(h.symbol + "hold"), 0.15, 50), 78, 22);

    const weightClass = weight >= 25 ? "danger" : weight >= 12 ? "warn" : "safe";

    const hasRealName = h.company_name && h.company_name !== h.symbol;
    const avatarSeed = (h.company_name || h.symbol || "").slice(0, 2).toUpperCase();

    const src = h.ltp_source || "fallback_avg";
    const ltpIsLive = src === "live";
    const ltpStatus = ltpIsLive ? "" : (src === "inline" || src === "derived" ? "stale" : "off");
    const liveLtp = (h.last_traded_price != null && h.last_traded_price > 0) ? h.last_traded_price : h.average_price;
    const liveCur = h.current_value != null && h.current_value > 0 ? h.current_value : h.invested_value;

    return `
    <tr class="table-row-hover fade-up" style="animation-delay:${i*35}ms">
      <td class="px-4 py-3.5">
        <div class="stock-cell">
          <div class="stock-avatar"
               style="background: hsl(${((h.company_name||h.symbol).length*37)%360} 65% 50%);">
            ${avatarSeed}
          </div>
          <div class="stock-meta">
            <span class="stock-name">${escapeHtml(hasRealName ? h.company_name : h.symbol)}</span>
            <span class="stock-sym">
              ${escapeHtml(h.symbol)}${h.exchange ? ` · ${escapeHtml(h.exchange)}` : ""}
            </span>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right num ${C.primary}">${formatNumber(h.quantity, 0)}</td>
      <td class="px-4 py-3.5 right">
        <div class="dual-data">
          <div class="dd-row">
            <span class="dd-label" style="color:var(--text-muted);">AVG</span>
            <span class="dd-val inv">${formatINR(h.average_price)}</span>
          </div>
          <div class="dd-row">
            <span class="dd-label" style="color:var(--brand-600);">
              <span class="live-dot ${ltpStatus}" style="width:5px;height:5px;"></span>LTP
            </span>
            <span class="dd-val live">${formatINR(liveLtp)}</span>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right hidden md:table-cell">
        <div class="weight-cell">
          <span class="tabular-nums" style="color:var(--text-mid);font-size:12px;font-weight:600;">${formatPercent(weight)}</span>
          <div class="weight-bar">
            <div class="weight-fill ${weightClass}" style="width:${Math.min(100, weight)}%"></div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right">
        <div class="dual-data">
          <div class="dd-row">
            <span class="dd-label" style="color:var(--text-muted);">INV</span>
            <span class="dd-val inv">${formatINR(h.invested_value)}</span>
          </div>
          <div class="dd-row">
            <span class="dd-label" style="color:var(--brand-600);">CUR</span>
            <span class="dd-val live">${formatINR(liveCur)}</span>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 right hidden lg:table-cell">${spark}</td>
      <td class="px-4 py-3.5 right num ${pnlClass(h.pnl)}">${formatINR(h.pnl)}</td>
      <td class="px-4 py-3.5 right">
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
