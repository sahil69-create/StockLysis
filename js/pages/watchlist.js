/**
 * watchlist.js
 * Premium watchlist grid with symbol tiles, sparklines & solid color accents.
 */

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
  const stroke = up ? "#34d399" : "#f87171";
  const fillA = up ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.22)";
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
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}" style="color: ${ok ? "#4ade80" : "#fbbf24"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
  } catch {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500" style="color:#f87171"></span><span>Offline</span>`;
  }
}

// ── Card renderer ─────────────────────────────────────────────────────────────
function renderCards(items) {
  const grid = document.getElementById("watchlist-grid");

  if (!items.length) {
    showEmpty(grid, "No symbols in watchlist. Add NSE symbols to WATCHLIST_SYMBOLS in backend .env");
    return;
  }

  grid.innerHTML = items.map((item, i) => {
    const hasChange = item.change_percent !== null && item.change_percent !== undefined;
    const cls = hasChange ? pnlClass(item.change_percent) : "pnl-neutral";
    const arrow = hasChange ? pnlArrow(item.change_percent) : "";
    const hue = ((item.symbol.length * 37) + (item.symbol.charCodeAt(0) || 0) * 13) % 360;
    const tileBg = `hsl(${hue} 70% 52%)`;
    const tileGlow = `0 10px 24px -8px hsl(${hue} 70% 50% / .6)`;
    const sparkSeed = _seed(item.symbol + "watch");
    // Override sparkline trend to match real change direction if available
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
      <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 card-hover flex flex-col gap-4 fade-up overflow-hidden"
           style="animation-delay:${i*55}ms">
        <!-- Symbol tile + exchange badge -->
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold tracking-tight"
                 style="background:${tileBg}; box-shadow:${tileGlow};">
              ${item.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-100 tracking-tight truncate">${escapeHtml(item.symbol)}</p>
              ${item.company_name
                ? `<p class="text-[11px] text-slate-500 truncate max-w-[160px]">${escapeHtml(item.company_name)}</p>`
                : `<p class="text-[11px] text-slate-600">NSE</p>`}
            </div>
          </div>
          <span class="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-700/70 px-2 py-1 rounded-md shrink-0">NSE</span>
        </div>

        <!-- LTP -->
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-[0.18em] mb-1">Last Traded</p>
          <p class="text-3xl font-extrabold text-slate-50 tracking-tight leading-none tabular-nums">
            ${item.last_traded_price !== null && item.last_traded_price !== undefined
              ? formatINR(item.last_traded_price)
              : `<span class="text-slate-600 text-xl">—</span>`}
          </p>
        </div>

        <!-- Sparkline -->
        <div class="-mx-1 h-10 flex items-end">
          ${spark}
        </div>

        <!-- Change -->
        <div class="flex items-center justify-between pt-1 border-t border-slate-700/60 mt-auto">
          ${hasChange ? `
            <div class="inline-flex items-center gap-1.5 text-sm font-bold ${cls} tabular-nums">
              <span>${arrow}</span>
              <span>${formatPercent(item.change_percent)}</span>
              ${item.change_absolute != null
                ? `<span class="text-xs font-semibold opacity-80">(${formatINR(item.change_absolute)})</span>`
                : ""}
            </div>` : `<span class="text-xs text-slate-600">No change data</span>`}
          <span class="text-[10px] uppercase tracking-wider text-slate-500">Live</span>
        </div>
      </div>`;
  }).join("");
}

// ── Skeleton cards while loading ──────────────────────────────────────────────
function showSkeletonGrid(count = 6) {
  const grid = document.getElementById("watchlist-grid");
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
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
