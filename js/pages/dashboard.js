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

// ── Utility: generate a deterministic pseudo-sparkline from a seed ──────────
function generateSparkline(length, seed, volatility = 0.12, base = 50) {
  const values = [];
  let v = base;
  let s = seed || 1;
  for (let i = 0; i < length; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rand = s / 233280;
    const delta = (rand - 0.5) * 2 * volatility * v;
    v = Math.max(base * 0.5, Math.min(base * 1.5, v + delta));
    values.push(+v.toFixed(2));
  }
  return values;
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

// ── Seed helper (hash string to int) ────────────────────────────────────────
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h || 1;
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

// ── Stat Cards with icon + sparkline + trend chip ────────────────────────────
function renderStatCards(data) {
  const el = document.getElementById("stat-cards");

  const buildCard = (opts) => {
    const sparkVals = generateSparkline(24, hashSeed(opts.label + (data.generated_at || "")), 0.18, 50);
    const trendDir = sparkVals[sparkVals.length - 1] >= sparkVals[0];
    const trendLabel = opts.trendOverride != null
      ? (opts.trendOverride > 0 ? "up" : opts.trendOverride < 0 ? "down" : "flat")
      : (trendDir ? "up" : "down");
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
            ${sparklineSVG(sparkVals, 90, 28)}
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
      label: "Total P&L",
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
      label: "Today's P&L",
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

  const item = (m) => {
    const spark = sparklineSVG(generateSparkline(16, hashSeed(m.symbol + "m"), 0.15, 50), 52, 18);
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
        ${spark}
        <span class="${pnlClass(m.pnl_percent)} font-bold text-xs whitespace-nowrap mover-pct">
          ${pnlArrow(m.pnl_percent)} ${formatPercent(m.pnl_percent)}
        </span>
      </li>`;
  };

  gEl.innerHTML = gainers.length
    ? gainers.map(item).join("")
    : `<li class="${C.tertiary} text-xs p-2">No gainers</li>`;
  lEl.innerHTML = losers.length
    ? losers.map(item).join("")
    : `<li class="${C.tertiary} text-xs p-2">No losers</li>`;
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
            const spark = sparklineSVG(generateSparkline(20, hashSeed(h.symbol + "h"), 0.14, 50), 80, 22);
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
                <td class="px-4 py-3 right hidden md:table-cell">${spark}</td>
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
  } catch (err) {
    showError(el, err.message);
  }
}

// ── Main loader ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Skeletons
  document.getElementById("stat-cards").innerHTML = skeletonCards(4);
  document.getElementById("gainers-list").innerHTML = `<li class="skeleton h-10 w-full rounded"></li>`.repeat(3);
  document.getElementById("losers-list").innerHTML  = `<li class="skeleton h-10 w-full rounded"></li>`.repeat(3);
  document.getElementById("donut-chart").innerHTML = `<div class="w-full aspect-square max-w-[260px] mx-auto skeleton rounded-full"></div>`;
  document.getElementById("donut-legend").innerHTML = `<div class="skeleton h-4 w-full mb-2 rounded"></div><div class="skeleton h-4 w-5/6 mb-2 rounded"></div><div class="skeleton h-4 w-4/6 rounded"></div>`;
  document.getElementById("pnl-bars").innerHTML = Array.from({length: 6}, () => `
    <div><div class="skeleton h-3 w-1/3 mb-1.5 rounded"></div><div class="skeleton h-2.5 w-full rounded"></div></div>`).join("");
  document.getElementById("analysis-row").innerHTML = Array.from({length: 3}, () => `
    <div class="rounded-xl p-5 h-40 skeleton"></div>`).join("");

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
