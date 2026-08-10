/**
 * watchlist.js
 * Premium watchlist grid with symbol tiles, sparklines & solid color accents.
 */

function _isDark() {
  return document.documentElement.classList.contains("dark");
}
const C = {
  primary:   "text-mode-primary",
  secondary: "text-mode-secondary",
  tertiary:  "text-mode-tertiary",
};

function _seed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h || 1;
}
function _sparkVals(len, seed, vol = 0.12, base = 50) {
  const vals = []; let v = base; let s = seed || 1;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    v = Math.max(base * 0.5, Math.min(base * 1.5, v + ((s / 233280) - 0.5) * 2 * vol * v));
    vals.push(+v.toFixed(2));
  }
  return vals;
}
function _sparkSVG(values, w = 120, h = 32) {
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
  const stroke = up ? "var(--gw-gain)" : "var(--gw-loss)";
  const fillA = up ? "var(--gw-gain-soft)" : "var(--gw-loss-soft)";
  return `<span class="sparkline"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="0,${h} ${pts} ${w},${h}" fill="${fillA}"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg></span>`;
}

// ── Client-side quick-add watchlist ──────────────────────────────────────────
// Groww's API has no "saved watchlist" endpoint — the server-side list only
// comes from the WATCHLIST_SYMBOLS backend env var, which we're not allowed
// to touch. This lets a user build their own list from the browser instead,
// stored locally and merged with whatever the server returns.
const QUICK_ADD_KEY = "stocklysis.watchlist.quickadd";

function _loadQuickAdd() {
  try {
    const raw = localStorage.getItem(QUICK_ADD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function _saveQuickAdd(list) {
  try { localStorage.setItem(QUICK_ADD_KEY, JSON.stringify(list)); } catch (e) {}
}
function addQuickWatch(symbol, exchange) {
  symbol = String(symbol || "").trim().toUpperCase();
  if (!symbol) return false;
  exchange = (exchange || "NSE").toUpperCase();
  const list = _loadQuickAdd();
  if (list.some(w => w.symbol === symbol && w.exchange === exchange)) return false;
  list.push({ symbol, exchange });
  _saveQuickAdd(list);
  return true;
}
function removeQuickWatch(symbol, exchange) {
  const list = _loadQuickAdd().filter(w => !(w.symbol === symbol && w.exchange === exchange));
  _saveQuickAdd(list);
}

/** Fetch live prices for locally-added symbols and merge them with the
 *  server watchlist (server items take precedence on symbol collision). */
async function mergeWithQuickAdd(serverItems) {
  const quick = _loadQuickAdd();
  const serverSymbols = new Set(serverItems.map(i => (i.symbol || "").toUpperCase()));
  const toFetch = quick.filter(w => !serverSymbols.has(w.symbol));
  if (!toFetch.length) return serverItems;

  const fetched = await Promise.all(toFetch.map(async (w) => {
    try {
      const q = await API.getMarketPrice(w.symbol, w.exchange);
      return {
        symbol: w.symbol,
        company_name: null,
        last_traded_price: q.last_traded_price ?? null,
        change_percent: q.change_percent ?? null,
        ltp_source: q.ltp_source || "fallback",
        exchange: w.exchange,
        _quickAdd: true,
      };
    } catch (e) {
      return {
        symbol: w.symbol, company_name: null, last_traded_price: null,
        change_percent: null, ltp_source: "fallback", exchange: w.exchange, _quickAdd: true,
      };
    }
  }));
  return serverItems.concat(fetched);
}

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

// ── Card renderer ─────────────────────────────────────────────────────────────
function renderCards(items) {
  const grid = document.getElementById("watchlist-grid");

  if (!items.length) {
    grid.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "col-span-full";
    wrap.innerHTML = `<div class="state-wrap">
      <div class="state-icon empty">👁️</div>
      <p class="state-title">Watchlist empty</p>
      <p class="state-msg">Use "Add to Watchlist" above to start tracking symbols — they're saved to this browser. An admin can also set <code>WATCHLIST_SYMBOLS</code> in the backend environment for a shared default list.</p>
    </div>`;
    grid.appendChild(wrap);
    return;
  }

  grid.innerHTML = items.map((item, i) => {
    const hasChange = item.change_percent !== null && item.change_percent !== undefined;
    const cls = hasChange ? pnlClass(item.change_percent) : "pnl-neutral";
    const arrow = hasChange ? pnlArrow(item.change_percent) : "";
    const hue = ((item.symbol.length * 37) + (item.symbol.charCodeAt(0) || 0) * 13) % 360;
    const tileBg = `hsl(${hue} 65% 50%)`;
    const tileGlow = `0 10px 24px -8px hsla(${hue}, 70%, 50%, .55)`;
    const sparkSeed = _seed(item.symbol + "watch");
    const liveSrc = item.ltp_source || "fallback";
    const liveIsLive = liveSrc === "live";

    let sparkVals = _sparkVals(22, sparkSeed, 0.18, 50);
    if (hasChange) {
      const dir = item.change_percent >= 0 ? 1 : -1;
      const amplitude = Math.min(12, Math.abs(item.change_percent) * 0.8 + 3);
      sparkVals = sparkVals.map((v, idx) => {
        const t = idx / (sparkVals.length - 1);
        return 50 + Math.sin(t * Math.PI) * amplitude * dir + ((v - 50) * 0.25);
      });
    }
    const spark = _sparkSVG(sparkVals, 140, 36);
    const exchange = item.exchange || "NSE";

    return `
      <div class="wl-card fade-up overflow-hidden" style="animation-delay:${i*55}ms">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="wl-avatar" style="background:${tileBg}; box-shadow:${tileGlow};">
              ${item.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="wl-name truncate">${escapeHtml(item.symbol)}</p>
              ${item.company_name
                ? `<p class="wl-sub truncate max-w-[160px]">${escapeHtml(item.company_name)}</p>`
                : `<p class="wl-sub">${escapeHtml(exchange)}</p>`}
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="wl-tag">${escapeHtml(exchange)}</span>
            ${item._quickAdd ? `
              <button class="wl-remove-btn" data-remove-symbol="${escapeHtml(item.symbol)}" data-remove-exchange="${escapeHtml(exchange)}" title="Remove from watchlist" aria-label="Remove ${escapeHtml(item.symbol)} from watchlist">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>` : ""}
          </div>
        </div>

        <div>
          <p class="wl-kicker mb-1">
            <span class="live-dot ${liveIsLive ? "" : (liveSrc === "inline" || liveSrc === "derived" ? "stale" : "off")}"
                  style="width:6px;height:6px;vertical-align:middle;"></span>
            Last Traded
          </p>
          <p class="wl-ltp tabular-nums">
            ${item.last_traded_price !== null && item.last_traded_price !== undefined
              ? formatINR(item.last_traded_price)
              : `<span style="color:var(--text-muted);font-size:1.25rem;">—</span>`}
          </p>
        </div>

        <div class="-mx-1 h-10 flex items-end">
          ${spark}
        </div>

        <div class="wl-foot mt-auto">
          ${hasChange ? `
            <div class="inline-flex items-center gap-1.5 text-sm font-bold ${cls} tabular-nums">
              <span>${arrow}</span>
              <span>${formatPercent(item.change_percent)}</span>
              ${item.change_absolute != null
                ? `<span class="text-xs font-semibold opacity-80">(${formatINR(item.change_absolute)})</span>`
                : ""}
            </div>` : `<span class="wl-sub">No change data</span>`}
          <span class="wl-kicker">${liveIsLive ? "Live" : (liveSrc === "fallback" || liveSrc === "fallback_avg" ? "Delayed" : "Cached")}</span>
        </div>
      </div>`;
  }).join("");
}

// ── Skeleton cards while loading ──────────────────────────────────────────────
function showSkeletonGrid(count = 6) {
  const grid = document.getElementById("watchlist-grid");
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="flex items-center gap-3">
        <div class="skeleton w-11 h-11 rounded-xl"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-4 w-24 rounded"></div>
          <div class="skeleton h-3 w-32 rounded"></div>
        </div>
      </div>
      <div class="skeleton h-8 w-32 rounded"></div>
      <div class="skeleton h-10 w-full rounded"></div>
      <div class="skeleton h-4 w-1/3 rounded"></div>
    </div>`).join("");
}

// ── Main loader ───────────────────────────────────────────────────────────────
// silent=true (interval auto-refresh) skips the skeleton wipe and success
// toast so periodic updates patch the cards in place instead of flashing.
async function loadWatchlist(opts = {}) {
  const silent = !!opts.silent;
  if (!silent) showSkeletonGrid();
  try {
    const data = await API.getWatchlist();
    const items = await mergeWithQuickAdd(data.watchlist || []);
    renderCards(items);
    if (!silent) showToast(`${items.length} symbol${items.length !== 1 ? "s" : ""} in watchlist`, "success", 2000);
  } catch (err) {
    if (silent) return; // keep the last-good grid rather than replacing it with an error on a background tick
    const grid = document.getElementById("watchlist-grid");
    showError(grid, err.message);
    showToast(err.message, "error");
  }
}

// ── Live Market Graph (index overview, shown above the grid) ─────────────────
async function loadMarketGraph() {
  const el = document.getElementById("market-graph");
  if (!el) return;
  const INDEX = { symbol: "NIFTY", exchange: "NSE", label: "NIFTY 50" };

  try {
    const [quote, hist] = await Promise.all([
      API.getMarketPrice(INDEX.symbol, INDEX.exchange).catch(() => null),
      API.getHistory(INDEX.symbol, INDEX.exchange, 15, 7).catch(() => null),
    ]);
    const ltp = quote && quote.last_traded_price;
    const points = (hist && hist.points || []).map(p => p.c).filter(v => v != null);

    if (!ltp && points.length < 2) {
      el.innerHTML = `
        <div class="state-wrap" style="padding:1.5rem .5rem;">
          <div class="state-icon empty">📡</div>
          <p class="state-title">Live market graph unavailable</p>
          <p class="state-msg">Groww hasn't returned live index data for this account yet. This will populate automatically once it's available.</p>
        </div>`;
      return;
    }

    const up = points.length >= 2 ? points[points.length - 1] >= points[0] : (quote?.change || 0) >= 0;
    const spark = points.length >= 2 ? _sparkSVG(points, 640, 96) : "";
    const chg = quote?.change;
    const chgPct = quote?.change_percent;

    el.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="wl-kicker mb-1">${escapeHtml(INDEX.label)}</p>
          <p class="wl-ltp tabular-nums" style="font-size:2rem;">${ltp != null ? formatNumber(ltp) : "—"}</p>
          ${chg != null ? `
            <div class="inline-flex items-center gap-1.5 text-sm font-bold ${up ? "gw-gain" : "gw-loss"} tabular-nums mt-1">
              <span>${up ? "▲" : "▼"}</span>
              <span>${formatNumber(Math.abs(chg))}</span>
              ${chgPct != null ? `<span class="text-xs font-semibold opacity-80">(${formatPercent(chgPct)})</span>` : ""}
            </div>` : ""}
        </div>
      </div>
      <div class="mt-4 -mx-1" style="height:96px;">${spark}</div>`;
  } catch (err) {
    el.innerHTML = `<p class="${C.tertiary} text-xs">Could not load market graph.</p>`;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadWatchlist();
  loadMarketGraph();

  // Quick-add form
  const addForm = document.getElementById("wl-add-form");
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("wl-add-input");
      const exchangeSel = document.getElementById("wl-add-exchange");
      const symbol = (input?.value || "").trim();
      if (!symbol) return;
      const added = addQuickWatch(symbol, exchangeSel?.value || "NSE");
      if (input) input.value = "";
      if (added) {
        showToast(`${symbol.toUpperCase()} added to watchlist`, "success", 1800);
        loadWatchlist();
      } else {
        showToast(`${symbol.toUpperCase()} is already in your watchlist`, "info", 1800);
      }
    });
  }

  // Remove-from-watchlist delegation (cards re-render, so bind once on the grid)
  document.getElementById("watchlist-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".wl-remove-btn");
    if (!btn) return;
    removeQuickWatch(btn.dataset.removeSymbol, btn.dataset.removeExchange);
    showToast(`${btn.dataset.removeSymbol} removed`, "info", 1500);
    loadWatchlist();
  });

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(() => { loadWatchlist({ silent: true }); loadMarketGraph(); }, CONFIG.REFRESH_INTERVAL_MS);
  }
});
