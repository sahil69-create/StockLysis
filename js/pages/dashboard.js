/**
 * dashboard.js
 * Premium dashboard loader with charts: SVG donut, sparklines,
 * P&L per-stock bars, and insight cards.
 */

// ── Palette: Premium emerald + amber + violet (no sky blue) ────────────────
const COLORS = [
  "#10b981","#f59e0b","#8b5cf6","#ef4444","#22c55e",
  "#f97316","#a855f7","#14b8a6","#eab308","#ec4899",
  "#84cc16","#6366f1","#f43f5e","#06b6d4","#0ea5e9",
];

// ── Real price history cache (one fetch per symbol, shared across widgets) ──
const _historyCache = new Map();
function getHistory(symbol, exchange) {
  const key = `${exchange || "NSE"}:${symbol}`;
  if (!_historyCache.has(key)) {
    _historyCache.set(
      key,
      API.getHistory(symbol, exchange || "NSE").catch(() => null)
    );
  }
  return _historyCache.get(key);
}

// Render a REAL sparkline (from actual close prices) into a placeholder element.
// fluid=true makes the SVG scale to its container width (for the trend cards).
async function injectSpark(elId, symbol, exchange, w = 90, h = 28, fluid = false) {
  const el = document.getElementById(elId);
  if (!el) return null;
  const hist = await getHistory(symbol, exchange);
  const vals = ((hist && hist.points) || []).map((p) => p.c).filter((v) => v != null);
  if (vals.length >= 2) {
    el.innerHTML = sparklineSVG(vals, w, h);
    if (fluid) {
      const svg = el.querySelector("svg");
      if (svg) { svg.setAttribute("width", "100%"); svg.style.maxWidth = "100%"; }
    }
  } else {
    el.innerHTML = `<span class="text-[10px] text-mode-tertiary">no chart data</span>`;
  }
  return hist;
}

// ── Sparkline SVG renderer ──────────────────────────────────────────────────
function sparklineSVG(values, width = 90, height = 28, colorClass = "") {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (height - ((v - min) / range) * (height - 4) - 2).toFixed(1);
    return `${x},${y}`;
  }).join(" ");

  const last = values[values.length - 1];
  const first = values[0];
  const trend = last >= first;
  const stroke = trend ? "#34d399" : "#f87171";
  const fill = trend ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.18)";

  const areaPts = `0,${height} ${pts} ${width},${height}`;

  return `
    <span class="sparkline" aria-hidden="true">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polygon points="${areaPts}" fill="${fill}" />
        <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
}

// ── Helper: detect if we should use dark-style slate fallback ──────────────
function _isDark() {
  return document.documentElement.classList.contains("dark");
}

// ── Mode-aware text color helpers (no hardcoded slate) ──────────────────────
const C = {
  primary:   "text-mode-primary",
  secondary: "text-mode-secondary",
  tertiary:  "text-mode-tertiary",
};

// ── Health check ─────────────────────────────────────────────────────────────
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
    if (!ok && data.issues?.length) {
      showToast("Backend issues: " + data.issues.join(", "), "error", 6000);
    }
  } catch (err) {
    badge.innerHTML = `
      <span class="health" style="display:inline-flex;align-items:center;gap:.35rem;">
        <span class="health-dot err"></span>
        <span class="${C.tertiary}">Offline</span>
      </span>`;
    showToast("Cannot reach backend — is it running?", "error");
  }
}

// ── Connection Status Banner ──────────────────────────────────────────────────
async function renderConnectionStatus() {
  const el = document.getElementById("connection-status");
  try {
    const diag = await API.getDiagnostic();
    
    // If overall is ready and not in demo mode, hide banner
    if (diag.overall === "ready" && !diag.credential_status?.force_demo) {
      el.classList.add("hidden");
      return;
    }
    
    el.classList.remove("hidden");
    
    const isError = diag.overall === "not_configured" || diag.overall === "groww_error";
    const bgCls = isError ? "bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/20" : "bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/20";
    const iconColor = isError ? "text-error-500" : "text-warning-500";
    
    let html = `
      <div class="rounded-xl border ${bgCls} p-4 mb-6">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 ${iconColor}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-white/90">${diag.summary}</h3>
            <div class="mt-2 space-y-2">
    `;
    
    diag.steps.forEach(step => {
      if (step.status === "fail" || step.status === "warn") {
        html += `
          <div class="text-sm text-gray-600 dark:text-gray-300">
            <span class="font-medium">${step.name}:</span> ${step.message}
            ${step.action ? `<div class="mt-1 p-2 rounded bg-white/50 dark:bg-black/20 text-xs font-mono">🔧 Action: ${step.action}</div>` : ""}
          </div>
        `;
      }
    });
    
    html += `
            </div>
          </div>
        </div>
      </div>
    `;
    
    el.innerHTML = html;
  } catch (err) {
    el.classList.remove("hidden");
    el.innerHTML = `
      <div class="rounded-xl border bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/20 p-4 mb-6 text-sm text-error-600 dark:text-error-400">
        Failed to load connection status: ${err.message}
      </div>
    `;
  }
}

// ── Stat Cards with icon + sparkline + trend chip ────────────────────────────
function renderStatCards(data) {
  const el = document.getElementById("stat-cards");

  const buildCard = (opts) => {
    const trendLabel = opts.trendOverride != null
      ? (opts.trendOverride > 0 ? "up" : opts.trendOverride < 0 ? "down" : "flat")
      : "flat";
    const trendText = opts.trendText || (trendLabel === "flat" ? "Stable" : trendLabel === "up" ? "Up" : "Down");

    return `
      <div class="stat-card fade-up overflow-hidden" style="animation-delay: ${opts.delay}ms">
        <div class="stat-ring"></div>
        <div class="relative z-10">
          <div class="flex items-start justify-between mb-3">
            <div class="stat-icon" style="background: ${opts.iconBg}; box-shadow: 0 8px 20px -8px ${opts.iconGlow}; color:#fff;">
              <span>${opts.icon}</span>
            </div>
            <span class="trend-chip trend-${trendLabel}">${trendText}</span>
          </div>
          <p class="stat-label">${opts.label}</p>
          <div class="flex items-end justify-between gap-3">
            <div>
              <p class="stat-value ${opts.color}">${opts.value}</p>
              <p class="stat-sub">${opts.sub}</p>
            </div>
          </div>
        </div>
      </div>`;
  };

  el.innerHTML =
    buildCard({
      delay: 40,
      label: "Portfolio Value",
      value: `<span class="live-dot" style="vertical-align:middle;"></span>${formatINR(data.current_portfolio_value)}`,
      sub: `<span class="data-invested-label">Invested</span> ${formatINR(data.invested_amount)}`,
      color: C.primary,
      icon: "💎",
      iconBg: "var(--brand-500)",
      iconGlow: "color-mix(in srgb, var(--brand-500) 55%, transparent)",
      trendOverride: data.total_pnl,
      trendText: formatPercent(data.total_pnl_percent),
    }) +
    buildCard({
      delay: 90,
      label: "Total Return",
      value: formatINR(data.total_pnl),
      sub: formatPercent(data.total_pnl_percent),
      color: pnlClass(data.total_pnl),
      icon: "📈",
      iconBg: "var(--success-500)",
      iconGlow: "rgba(18,183,106,0.5)",
      trendOverride: data.total_pnl,
      trendText: formatPercent(data.total_pnl_percent),
    }) +
    buildCard({
      delay: 140,
      label: "1-Day Return",
      value: formatINR(data.todays_pnl || 0),
      sub: formatPercent(data.todays_pnl_percent || 0),
      color: pnlClass(data.todays_pnl || 0),
      icon: "⚡",
      iconBg: "var(--warning-500)",
      iconGlow: "rgba(247,144,9,0.5)",
      trendOverride: data.todays_pnl || 0,
      trendText: formatPercent(data.todays_pnl_percent || 0),
    }) +
    buildCard({
      delay: 190,
      label: "Holdings",
      value: data.holdings_count ?? "—",
      sub: "Active positions",
      color: C.primary,
      icon: "📦",
      iconBg: "var(--purple-500)",
      iconGlow: "rgba(122,90,248,0.45)",
      trendOverride: 0,
      trendText: "Live",
    });
}

// ── Movers ───────────────────────────────────────────────────────────────────
function renderMovers(gainers, losers) {
  const gEl = document.getElementById("gainers-list");
  const lEl = document.getElementById("losers-list");

  const item = (m, sparkId) => {
    const title = m.company_name && m.company_name !== m.symbol
      ? `<span class="font-semibold ${C.primary} text-sm block truncate">${escapeHtml(m.company_name)}</span>
         <span class="text-[10px] ${C.tertiary} font-medium tracking-wide">${escapeHtml(m.symbol)}</span>`
      : `<span class="font-semibold ${C.primary} text-sm block truncate">${escapeHtml(m.symbol)}</span>`;
    return `
      <li class="mover-item fade-up">
        <div class="min-w-0 flex-1">
          ${title}
          <p class="text-[10px] ${C.tertiary} mt-0.5">${formatINR(m.pnl)}</p>
        </div>
        <span id="${sparkId}" class="sparkline"></span>
        <span class="${pnlClass(m.pnl_percent)} font-bold text-xs whitespace-nowrap mover-pct">
          ${pnlArrow(m.pnl_percent)} ${formatPercent(m.pnl_percent)}
        </span>
      </li>`;
  };

  gEl.innerHTML = gainers.length
    ? gainers.map((m, i) => item(m, `mv-g-${i}`)).join("")
    : `<li class="${C.tertiary} text-xs p-2">No gainers</li>`;
  lEl.innerHTML = losers.length
    ? losers.map((m, i) => item(m, `mv-l-${i}`)).join("")
    : `<li class="${C.tertiary} text-xs p-2">No losers</li>`;

  // Draw REAL price sparklines for each mover (fetched per symbol, cached).
  gainers.forEach((m, i) => injectSpark(`mv-g-${i}`, m.symbol, m.exchange, 52, 18));
  losers.forEach((m, i) => injectSpark(`mv-l-${i}`, m.symbol, m.exchange, 52, 18));
}

// ── Per-stock Returns & Trend grid (1D + Total return, real price graph) ─────
async function renderHoldingsTrend(holdings) {
  const el = document.getElementById("holdings-trend");
  if (!el) return;
  if (!holdings || !holdings.length) {
    el.innerHTML = `<p class="${C.tertiary} text-sm col-span-full text-center py-6">No stocks yet — your holdings will appear here.</p>`;
    return;
  }

  const list = holdings.slice(0, 12); // bound the number of history calls

  el.innerHTML = list.map((h, i) => {
    const sym = escapeHtml(h.symbol);
    const name = h.company_name && h.company_name !== h.symbol ? escapeHtml(h.company_name) : sym;
    const totalPct = h.pnl_percent;
    return `
      <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-white/[0.02] fade-up" style="animation-delay:${i * 40}ms">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold ${C.primary} text-sm truncate">${name}</div>
            <div class="text-[10px] ${C.tertiary} tracking-wide">${sym}${h.exchange ? " · " + escapeHtml(h.exchange) : ""}</div>
          </div>
          <span id="trend-badge-${i}" class="trend-chip trend-flat">…</span>
        </div>
        <div id="trend-spark-${i}" class="mt-3 h-9 flex items-center">
          <span class="skeleton h-7 w-full rounded"></span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-center">
          <div class="rounded-lg bg-gray-50 dark:bg-white/[0.03] py-1.5">
            <div class="text-[10px] ${C.tertiary} uppercase tracking-wide">1-Day</div>
            <div id="trend-1d-${i}" class="text-sm font-semibold ${C.secondary}">…</div>
          </div>
          <div class="rounded-lg bg-gray-50 dark:bg-white/[0.03] py-1.5">
            <div class="text-[10px] ${C.tertiary} uppercase tracking-wide">Total</div>
            <div class="text-sm font-semibold ${pnlClass(totalPct)}">${totalPct != null ? `${pnlArrow(totalPct)} ${formatPercent(totalPct)}` : "—"}</div>
          </div>
        </div>
      </div>`;
  }).join("");

  await Promise.all(list.map(async (h, i) => {
    const hist = await injectSpark(`trend-spark-${i}`, h.symbol, h.exchange, 220, 36, true);

    // 1-Day return: prefer the holding's own day change, else derive from history.
    let oneDay = (h.day_change_percent != null)
      ? h.day_change_percent
      : (hist && hist.change_percent != null ? hist.change_percent : null);
    const dir = hist && hist.direction
      ? hist.direction
      : (oneDay == null ? "flat" : oneDay > 0 ? "up" : oneDay < 0 ? "down" : "flat");

    const oneDayEl = document.getElementById(`trend-1d-${i}`);
    if (oneDayEl) {
      oneDayEl.className = `text-sm font-semibold ${pnlClass(oneDay)}`;
      oneDayEl.textContent = oneDay != null ? `${pnlArrow(oneDay)} ${formatPercent(oneDay)}` : "—";
    }
    const badge = document.getElementById(`trend-badge-${i}`);
    if (badge) {
      badge.className = `trend-chip trend-${dir}`;
      badge.textContent = dir === "up" ? "▲ Up" : dir === "down" ? "▼ Down" : "Flat";
    }
  }));
}

// ── SVG Donut chart ──────────────────────────────────────────────────────────
function renderDonut(slices, totalValue) {
  const container = document.getElementById("donut-chart");
  const legend = document.getElementById("donut-legend");

  if (!slices || !slices.length) {
    container.innerHTML = `<p class="text-slate-500 text-xs">No allocation data</p>`;
    legend.innerHTML = "";
    return;
  }

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = 100;
  const r = 66;

  let cumAngle = -Math.PI / 2; // start at top
  const segments = slices.map((s, i) => {
    const color = COLORS[i % COLORS.length];
    const percent = Math.max(0, Math.min(100, s.percent || 0));
    const angle = (percent / 100) * Math.PI * 2;
    if (angle === 0) return null;

    const a0 = cumAngle;
    const a1 = cumAngle + angle - (slices.length > 1 ? 0.008 : 0);
    cumAngle += angle;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x0 = cx + R * Math.cos(a0);
    const y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);

    const x2 = cx + r * Math.cos(a1);
    const y2 = cy + r * Math.sin(a1);
    const x3 = cx + r * Math.cos(a0);
    const y3 = cy + r * Math.sin(a0);

    const path = `
      M ${x0.toFixed(2)} ${y0.toFixed(2)}
      A ${R} ${R} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}
      L ${x2.toFixed(2)} ${y2.toFixed(2)}
      A ${r} ${r} 0 ${largeArc} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}
      Z`;

    return { path, color, label: s.label, value: s.value, percent: percent };
  }).filter(Boolean);

  const centerValue = totalValue != null
    ? `<tspan x="0" y="-2">${formatINR(totalValue).replace("₹","₹ ")}</tspan>`
    : `<tspan x="0" y="-2">${(slices[0]?.value != null ? formatINR(slices[0].value).replace("₹","₹ ") : "—")}</tspan>`;

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%">
      <defs>
        ${segments.map((s, i) => `
          <filter id="donut-glow-${i}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>`).join("")}
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="var(--border)" stroke-width="${R-r}" opacity="0.5"/>
      ${segments.map((s, i) => `
        <path d="${s.path}" fill="${s.color}" class="donut-seg"
              style="color:${s.color}; filter: url(#donut-glow-${i}); animation: fadeUp .5s ease ${i*60}ms both;"
              data-label="${escapeHtml(s.label)}" data-value="${formatINR(s.value)}" data-percent="${s.percent.toFixed(1)}">
          <title>${escapeHtml(s.label)} — ${formatINR(s.value)} (${s.percent.toFixed(1)}%)</title>
        </path>`).join("")}
      <g class="donut-center" text-anchor="middle" dominant-baseline="middle" transform="translate(${cx},${cy})">
        <text class="donut-center-label" y="-22">Portfolio</text>
        <text class="donut-center-value" y="2">${centerValue}</text>
        <text class="donut-center-sub" y="20">${slices.length} stocks</text>
      </g>
    </svg>`;

  legend.innerHTML = slices.map((s, i) => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span class="legend-name">${escapeHtml(s.label)}</span>
      <span class="legend-meta">
        <span class="legend-pct">${s.percent.toFixed(1)}%</span>
      </span>
    </div>`).join("");
}

// ── Horizontal P&L bars ──────────────────────────────────────────────────────
function renderPnlBars(holdings) {
  const el = document.getElementById("pnl-bars");
  if (!holdings?.length) {
    el.innerHTML = `<p class="${C.tertiary} text-xs py-4 text-center">No holdings data</p>`;
    return;
  }

  const items = holdings
    .filter(h => h.pnl != null)
    .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
    .slice(0, 8);

  if (!items.length) {
    el.innerHTML = `<p class="${C.tertiary} text-xs py-4 text-center">No P&amp;L data</p>`;
    return;
  }

  const maxAbs = Math.max(...items.map(h => Math.abs(h.pnl || 0)), 1);

  el.innerHTML = items.map((h, i) => {
    const isPos = (h.pnl || 0) >= 0;
    const pct = Math.min(100, (Math.abs(h.pnl || 0) / maxAbs) * 100);
    const barColor = isPos ? "var(--success-500)" : "var(--error-500)";
    const barInner = isPos
      ? `<div class="pnl-row-bar up" style="width:${pct}%;"></div>`
      : `<div class="pnl-row-bar down" style="width:${pct}%; margin-left:auto;"></div>`;

    const hasRealName = h.company_name && h.company_name !== h.symbol;
    const labelHtml = hasRealName
      ? `<span class="pnl-row-name">${escapeHtml(h.company_name)}</span>
         <span class="text-[10px] ${C.tertiary} font-medium tracking-wide">${escapeHtml(h.symbol)}</span>`
      : `<span class="pnl-row-name">${escapeHtml(h.symbol)}</span>`;

    return `
      <div class="pnl-row fade-up" style="animation-delay: ${i*50}ms">
        <div class="flex flex-col gap-1 leading-tight min-w-0" style="grid-column:1;">
          ${labelHtml}
        </div>
        <div class="pnl-row-track" style="grid-column:2;">
          ${barInner}
        </div>
        <div class="pnl-row-val ${isPos ? 'up' : 'down'}" style="grid-column:3;">
          ${formatINR(h.pnl)}
        </div>
      </div>
      <style>
        .pnl-row-bar { background: ${barColor}; opacity: .7; }
      </style>`;
  }).join("");
}

// ── Analysis insight cards ───────────────────────────────────────────────────
function renderAnalysis(holdings, data) {
  const el = document.getElementById("analysis-row");
  if (!holdings?.length) {
    el.innerHTML = "";
    return;
  }

  const sorted = [...holdings].filter(h => h.pnl_percent != null)
    .sort((a, b) => (b.pnl_percent || 0) - (a.pnl_percent || 0));

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);
  const N = holdings.length;
  const hhi = holdings.reduce((s, h) => {
    const w = totalInvested ? ((h.invested_value || 0) / totalInvested) : (1 / Math.max(N, 1));
    return s + w * w;
  }, 0);
  const normalized = N > 1 ? (1 - (hhi - 1 / N) / (1 - 1 / N)) : 1;
  const diversityScore = Math.max(0, Math.min(100, Math.round(normalized * 100)));
  const diversityRating =
    diversityScore >= 75 ? { label: "Excellent", cls: "trend-up", text: "Well diversified" } :
    diversityScore >= 50 ? { label: "Good", cls: "trend-up", text: "Balanced allocation" } :
    diversityScore >= 30 ? { label: "Fair", cls: "trend-flat", text: "Consider spreading risk" } :
                            { label: "Concentrated", cls: "trend-down", text: "High single-stock risk" };

  const cardHTML = (opts) => `
    <div class="analysis-card fade-up">
      <div class="analysis-icon ${opts.iconType}" style="background:${opts.iconBg};">
        <span>${opts.emoji}</span>
      </div>
      <div class="analysis-body">
        <h4>${opts.eyebrow}
          <span class="trend-chip ${opts.chipCls}" style="margin-left:.5rem;">${opts.chipLabel}</span>
        </h4>
        <span class="big ${C.primary}">${opts.title}</span>
        ${opts.subtitle ? `<p class="${C.secondary}">${opts.subtitle}</p>` : ""}
        <p style="margin-top:.4rem;">${opts.note}</p>
      </div>
    </div>`;

  const topHolding = holdings.slice().sort((a,b)=>(b.invested_value||0)-(a.invested_value||0))[0];
  const topHoldingLabel = topHolding
    ? (topHolding.company_name || topHolding.symbol)
    : "—";
  const topHoldingWeight = totalInvested > 0 && topHolding
    ? formatPercent(((topHolding.invested_value || 0) / Math.max(totalInvested, 0.0001)) * 100)
    : "";

  const bestTitle = best.company_name && best.company_name !== best.symbol
    ? escapeHtml(best.company_name)
    : escapeHtml(best.symbol);
  const bestSub = best.company_name && best.company_name !== best.symbol
    ? `${escapeHtml(best.symbol)} · P&L: ${formatINR(best.pnl || 0)}`
    : `P&L: ${formatINR(best.pnl || 0)}`;

  const worstTitle = worst.company_name && worst.company_name !== worst.symbol
    ? escapeHtml(worst.company_name)
    : escapeHtml(worst.symbol);
  const worstSub = worst.company_name && worst.company_name !== worst.symbol
    ? `${escapeHtml(worst.symbol)} · P&L: ${formatINR(worst.pnl || 0)}`
    : `P&L: ${formatINR(worst.pnl || 0)}`;

  el.innerHTML =
    (best ? cardHTML({
      eyebrow: "Best Performer",
      chipCls: best.pnl_percent >= 0 ? "trend-up" : "trend-down",
      chipLabel: formatPercent(best.pnl_percent || 0),
      emoji: "🏆",
      iconType: "score",
      iconBg: "var(--success-500)",
      title: bestTitle,
      subtitle: bestSub,
      note: best.pnl_percent > 0
        ? "Strong contributor — you may consider trimming a portion to lock gains if it becomes overweight."
        : "Even your best holding is underwater — review thesis before adding more.",
    }) : "") +
    (worst && worst !== best ? cardHTML({
      eyebrow: "Needs Review",
      chipCls: worst.pnl_percent < 0 ? "trend-down" : "trend-flat",
      chipLabel: formatPercent(worst.pnl_percent || 0),
      emoji: "⚠️",
      iconType: "quality",
      iconBg: "var(--error-500)",
      title: worstTitle,
      subtitle: worstSub,
      note: "Largest drag on returns. Revisit the investment thesis and check for sector/company-specific news.",
    }) : "") +
    cardHTML({
      eyebrow: "Diversification",
      chipCls: diversityRating.cls,
      chipLabel: `${diversityScore}/100 · ${diversityRating.label}`,
      emoji: "🎯",
      iconType: "holdings",
      iconBg: "var(--warning-500)",
      title: `${N} stocks`,
      subtitle: diversityRating.text,
      note: totalInvested > 0
        ? `Top holding: ${topHoldingLabel} · ${topHoldingWeight}`
        : "Add holdings to measure portfolio concentration.",
    });
}

// ── Holdings Preview Table ───────────────────────────────────────────────────
async function renderHoldingsPreview() {
  const el = document.getElementById("holdings-preview");
  showSpinner(el);
  try {
    const data = await API.getHoldings();
    const all = data.holdings || [];
    const top5 = all.slice(0, 5);
    if (!top5.length) { showEmpty(el, "No holdings"); return; }

    el.innerHTML = `
      <table class="data-table w-full text-sm">
        <thead>
          <tr>
            <th class="px-4 py-3 text-left">Stock</th>
            <th class="px-4 py-3 text-right">Qty</th>
            <th class="px-4 py-3 text-right">Avg / LTP</th>
            <th class="px-4 py-3 text-right">Invested / Live</th>
            <th class="px-4 py-3 text-right hidden md:table-cell">Trend</th>
            <th class="px-4 py-3 text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          ${top5.map((h, i) => {
            const hasRealName = h.company_name && h.company_name !== h.symbol;
            const avatarSeed = (h.company_name || h.symbol || "").slice(0, 2).toUpperCase();
            const nameCell = hasRealName
              ? `<div class="stock-cell">
                  <div class="stock-avatar" style="background: hsl(${((h.company_name||h.symbol).length*37)%360} 65% 50%);">${avatarSeed}</div>
                  <div class="stock-meta">
                    <span class="stock-name">${escapeHtml(h.company_name)}</span>
                    <span class="stock-sym">${escapeHtml(h.symbol)}${h.exchange ? ` · ${escapeHtml(h.exchange)}` : ""}</span>
                  </div>
                </div>`
              : `<div class="stock-cell">
                  <div class="stock-avatar" style="background: hsl(${(h.symbol.length*37)%360} 65% 50%);">${avatarSeed}</div>
                  <div class="stock-meta">
                    <span class="stock-name">${escapeHtml(h.symbol)}</span>
                    ${h.exchange ? `<span class="stock-sym">${escapeHtml(h.exchange)}</span>` : ""}
                  </div>
                </div>`;

            const hasLiveLtp = h.last_traded_price != null && h.last_traded_price > 0 && Math.abs(h.last_traded_price - h.average_price) > 0.001;
            const ltpStatus = hasLiveLtp ? "" : (h.last_traded_price != null ? "stale" : "off");

            const priceCell = `
              <div class="dual-data">
                <div class="dd-row">
                  <span class="dd-label" style="color:var(--text-muted);">AVG</span>
                  <span class="dd-val inv">${formatINR(h.average_price)}</span>
                </div>
                <div class="dd-row">
                  <span class="dd-label" style="color:var(--brand-600);">
                    <span class="live-dot ${ltpStatus}" style="width:5px;height:5px;"></span>LIVE
                  </span>
                  <span class="dd-val live">${hasLiveLtp ? formatINR(h.last_traded_price) : formatINR(h.average_price)}</span>
                </div>
              </div>`;

            const valueCell = `
              <div class="dual-data">
                <div class="dd-row">
                  <span class="dd-label" style="color:var(--text-muted);">INV</span>
                  <span class="dd-val inv">${formatINR(h.invested_value)}</span>
                </div>
                <div class="dd-row">
                  <span class="dd-label" style="color:var(--brand-600);">CUR</span>
                  <span class="dd-val live">${h.current_value != null ? formatINR(h.current_value) : formatINR(h.invested_value)}</span>
                </div>
              </div>`;

            return `
              <tr class="table-row-hover fade-up" style="animation-delay:${i*55}ms">
                <td class="px-4 py-3">
                  ${nameCell}
                </td>
                <td class="px-4 py-3 right num">${formatNumber(h.quantity, 0)}</td>
                <td class="px-4 py-3 right">${priceCell}</td>
                <td class="px-4 py-3 right">${valueCell}</td>
                <td class="px-4 py-3 right hidden md:table-cell"><span id="prev-spark-${i}" class="sparkline"></span></td>
                <td class="px-4 py-3 right num ${pnlClass(h.pnl)}">
                  <div>
                    <div>${h.pnl != null ? formatINR(h.pnl) : "—"}</div>
                    <div class="text-[11px]">${h.pnl_percent != null ? `${pnlArrow(h.pnl_percent)} ${formatPercent(h.pnl_percent)}` : "—"}</div>
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;

    // Draw REAL price sparklines in the Trend column (fetched per symbol, cached).
    top5.forEach((h, i) => injectSpark(`prev-spark-${i}`, h.symbol, h.exchange, 80, 22));
  } catch (err) {
    showError(el, err.message);
  }
}

// ── Main loader ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Fresh prices on every (re)load — drop any cached history.
  _historyCache.clear();

  // Skeletons
  document.getElementById("stat-cards").innerHTML = skeletonCards(4);
  document.getElementById("holdings-trend").innerHTML = Array.from({length: 4}, () => `
    <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 h-40 skeleton"></div>`).join("");
  document.getElementById("gainers-list").innerHTML = `<li class="skeleton h-10 w-full rounded"></li>`.repeat(3);
  document.getElementById("losers-list").innerHTML  = `<li class="skeleton h-10 w-full rounded"></li>`.repeat(3);
  document.getElementById("donut-chart").innerHTML = `<div class="w-full aspect-square max-w-[260px] mx-auto skeleton rounded-full"></div>`;
  document.getElementById("donut-legend").innerHTML = `<div class="skeleton h-4 w-full mb-2 rounded"></div><div class="skeleton h-4 w-5/6 mb-2 rounded"></div><div class="skeleton h-4 w-4/6 rounded"></div>`;
  document.getElementById("pnl-bars").innerHTML = Array.from({length: 6}, () => `
    <div><div class="skeleton h-3 w-1/3 mb-1.5 rounded"></div><div class="skeleton h-2.5 w-full rounded"></div></div>`).join("");
  document.getElementById("analysis-row").innerHTML = Array.from({length: 3}, () => `
    <div class="rounded-xl p-5 h-40 skeleton"></div>`).join("");

  // Fetch connection status independently
  renderConnectionStatus().catch(err => console.error("Diag failed", err));

  try {
    const data = await API.getDashboard();
    renderStatCards(data);
    renderMovers(data.top_gainers || [], data.top_losers || []);
    renderDonut(data.portfolio_allocation || [], data.current_portfolio_value);

    // Fetch holdings for P&L bars & analysis (same call feeds preview too)
    let holdings = [];
    try {
      const hData = await API.getHoldings();
      holdings = hData.holdings || [];
    } catch (_) { /* dashboard still usable */ }

    renderPnlBars(holdings);
    renderAnalysis(holdings, data);
    renderHoldingsTrend(holdings);

    document.getElementById("last-updated").textContent =
      "Updated " + new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    showToast("Dashboard refreshed", "success", 2000);
  } catch (err) {
    showToast(err.message, "error");
    showError(document.getElementById("stat-cards"), err.message);
  }

  // Holdings preview (independent)
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
