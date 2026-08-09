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
  const stroke = up ? "var(--success-500)" : "var(--error-500)";
  const fillA = up
    ? "color-mix(in srgb, var(--success-500) 28%, transparent)"
    : "color-mix(in srgb, var(--error-500)   22%, transparent)";
  return `<span class="sparkline"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="0,${h} ${pts} ${w},${h}" fill="${fillA}"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg></span>`;
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
      <p class="state-msg">Add NSE trading symbols to <code>WATCHLIST_SYMBOLS</code> (comma-separated) in the backend environment, or come back and check the defaults.</p>
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
                : `<p class="wl-sub">NSE</p>`}
            </div>
          </div>
          <span class="wl-tag">NSE</span>
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
