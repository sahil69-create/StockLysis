/**
 * dashboard.js
 * Premium dashboard loader with charts: SVG donut, sparklines,
 * P&L per-stock bars, and insight cards.
 */

// ── Palette ─────────────────────────────────────────────────────────────────
const COLORS = [
  "#0ea5e9","#8b5cf6","#22c55e","#f59e0b","#ef4444",
  "#06b6d4","#ec4899","#14b8a6","#f97316","#6366f1",
  "#38bdf8","#a855f7","#84cc16","#eab308","#f43f5e",
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
  const fillStart = trend ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.22)";
  const fillEnd = "rgba(15,23,42,0)";

  const areaPts = `0,${height} ${pts} ${width},${height}`;

  return `
    <span class="sparkline" aria-hidden="true">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-grad-${Math.floor(Math.random()*1e6)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fillStart}"/>
            <stop offset="100%" stop-color="${fillEnd}"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPts}" fill="url(#spark-grad)" />
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

// ── Health check ─────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}" style="color: ${ok ? "#4ade80" : "#fbbf24"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
    if (!ok && data.issues?.length) {
      showToast("Backend issues: " + data.issues.join(", "), "error", 6000);
    }
  } catch (err) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500" style="color:#f87171"></span><span>Offline</span>`;
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
      <div class="relative rounded-xl p-5 fade-up overflow-hidden" style="animation-delay: ${opts.delay}ms">
        <div class="stat-ring"></div>
        <div class="relative z-10">
          <div class="flex items-start justify-between mb-3">
            <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                 style="background: ${opts.iconBg}; box-shadow: 0 8px 20px -8px ${opts.iconGlow};">
              <span class="text-lg">${opts.icon}</span>
            </div>
            <span class="trend-chip trend-${trendLabel}">${trendText}</span>
          </div>
          <p class="text-xs text-slate-500 uppercase tracking-[0.14em] mb-1">${opts.label}</p>
          <div class="flex items-end justify-between gap-3">
            <div>
              <p class="text-2xl font-extrabold ${opts.color} tracking-tight leading-none">${opts.value}</p>
              <p class="text-xs text-slate-400 mt-1.5">${opts.sub}</p>
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
      value: formatINR(data.current_portfolio_value),
      sub: `Invested: ${formatINR(data.invested_amount)}`,
      color: "text-sky-400",
      icon: "💎",
      iconBg: "linear-gradient(135deg, rgba(14,165,233,0.22), rgba(56,189,248,0.1))",
      iconGlow: "rgba(14,165,233,0.55)",
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
      iconBg: "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(168,85,247,0.1))",
      iconGlow: "rgba(139,92,246,0.5)",
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
      iconBg: "linear-gradient(135deg, rgba(234,179,8,0.22), rgba(250,204,21,0.1))",
      iconGlow: "rgba(234,179,8,0.5)",
      trendOverride: data.todays_pnl || 0,
      trendText: formatPercent(data.todays_pnl_percent || 0),
    }) +
    buildCard({
      delay: 190,
      label: "Holdings",
      value: data.holdings_count ?? "—",
      sub: "Active positions",
      color: "text-violet-400",
      icon: "📦",
      iconBg: "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(34,197,94,0.1))",
      iconGlow: "rgba(16,185,129,0.5)",
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
    return `
      <li class="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 transition fade-up">
        <div class="min-w-0 flex-1">
          <span class="font-semibold text-slate-200 text-sm">${escapeHtml(m.symbol)}</span>
          <p class="text-[10px] text-slate-500 mt-0.5">${formatINR(m.pnl)}</p>
        </div>
        ${spark}
        <span class="${pnlClass(m.pnl_percent)} font-bold text-xs whitespace-nowrap">
          ${pnlArrow(m.pnl_percent)} ${formatPercent(m.pnl_percent)}
        </span>
      </li>`;
  };

  gEl.innerHTML = gainers.length
    ? gainers.map(item).join("")
    : `<li class="text-slate-500 text-xs p-2">No gainers</li>`;
  lEl.innerHTML = losers.length
    ? losers.map(item).join("")
    : `<li class="text-slate-500 text-xs p-2">No losers</li>`;
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
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" class="drop-shadow-[0_0_25px_rgba(14,165,233,0.15)]">
      <defs>
        ${segments.map((s, i) => `
          <filter id="donut-glow-${i}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>`).join("")}
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="rgba(148,163,184,0.06)" stroke-width="${R-r}"/>
      ${segments.map((s, i) => `
        <path d="${s.path}" fill="${s.color}" class="donut-segment"
              style="color:${s.color}; filter: url(#donut-glow-${i}); animation: fadeUp .5s ease ${i*60}ms both;"
              data-label="${escapeHtml(s.label)}" data-value="${formatINR(s.value)}" data-percent="${s.percent.toFixed(1)}">
          <title>${escapeHtml(s.label)} — ${formatINR(s.value)} (${s.percent.toFixed(1)}%)</title>
        </path>`).join("")}
      <g class="donut-center" text-anchor="middle" dominant-baseline="middle" transform="translate(${cx},${cy})">
        <text font-size="14" fill="#64748b" y="-16">Portfolio</text>
        <text font-size="20" font-weight="800" y="6" fill="#f1f5f9">${centerValue}</text>
        <text font-size="11" y="24" fill="#64748b">${slices.length} stocks</text>
      </g>
    </svg>`;

  legend.innerHTML = slices.map((s, i) => `
    <div class="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-white/5 transition">
      <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${s.color}; box-shadow:0 0 8px ${s.color}55"></span>
      <span class="text-slate-300 font-medium min-w-0 truncate">${escapeHtml(s.label)}</span>
      <span class="ml-auto text-slate-400 tabular-nums">${s.percent.toFixed(1)}%</span>
    </div>`).join("");
}

// ── Horizontal P&L bars ──────────────────────────────────────────────────────
function renderPnlBars(holdings) {
  const el = document.getElementById("pnl-bars");
  if (!holdings?.length) {
    el.innerHTML = `<p class="text-slate-500 text-xs py-4 text-center">No holdings data</p>`;
    return;
  }

  const items = holdings
    .filter(h => h.pnl != null)
    .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
    .slice(0, 8);

  if (!items.length) {
    el.innerHTML = `<p class="text-slate-500 text-xs py-4 text-center">No P&amp;L data</p>`;
    return;
  }

  const maxAbs = Math.max(...items.map(h => Math.abs(h.pnl || 0)), 1);

  el.innerHTML = items.map((h, i) => {
    const isPos = (h.pnl || 0) >= 0;
    const pct = Math.min(100, (Math.abs(h.pnl || 0) / maxAbs) * 100);
    const color = isPos
      ? "linear-gradient(90deg, rgba(52,211,153,0.25), rgba(52,211,153,0.7))"
      : "linear-gradient(90deg, rgba(248,113,113,0.25), rgba(248,113,113,0.7))";
    const barInner = isPos
      ? `<div class="h-full rounded-l-md" style="width:${pct}%; background:${color};"></div>`
      : `<div class="h-full rounded-r-md ml-auto" style="width:${pct}%; background:${color};"></div>`;

    return `
      <div class="fade-up" style="animation-delay: ${i*50}ms">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="font-semibold text-slate-200 truncate max-w-[50%]">${escapeHtml(h.symbol)}</span>
          <span class="font-bold ${pnlClass(h.pnl)} tabular-nums">${formatINR(h.pnl)}</span>
        </div>
        <div class="h-2.5 rounded-full bg-slate-700/50 overflow-hidden">
          ${barInner}
        </div>
      </div>`;
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
  // Herfindahl-style diversification score (higher = more concentrated / less diverse)
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
    <div class="relative rounded-xl p-5 overflow-hidden fade-up">
      <div class="absolute -right-10 -top-10 w-36 h-36 rounded-full blur-3xl opacity-30" style="background:${opts.bgGlow}"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-4">
          <span class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">${opts.eyebrow}</span>
          <span class="trend-chip ${opts.chipCls}">${opts.chipLabel}</span>
        </div>
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl leading-none">${opts.emoji}</div>
          <div>
            <p class="font-extrabold text-lg ${opts.valueCls} leading-tight">${opts.title}</p>
            ${opts.subtitle ? `<p class="text-xs text-slate-400 mt-0.5">${opts.subtitle}</p>` : ""}
          </div>
        </div>
        <p class="text-xs text-slate-400 leading-relaxed">${opts.note}</p>
      </div>
    </div>`;

  el.innerHTML =
    (best ? cardHTML({
      eyebrow: "Best Performer",
      chipCls: best.pnl_percent >= 0 ? "trend-up" : "trend-down",
      chipLabel: formatPercent(best.pnl_percent || 0),
      emoji: "🏆",
      title: escapeHtml(best.symbol),
      subtitle: `P&L: ${formatINR(best.pnl || 0)}`,
      valueCls: "text-emerald-300",
      bgGlow: "rgba(16,185,129,0.35)",
      note: best.pnl_percent > 0
        ? "Strong contributor — you may consider trimming a portion to lock gains if it becomes overweight."
        : "Even your best holding is underwater — review thesis before adding more.",
    }) : "") +
    (worst && worst !== best ? cardHTML({
      eyebrow: "Needs Review",
      chipCls: worst.pnl_percent < 0 ? "trend-down" : "trend-flat",
      chipLabel: formatPercent(worst.pnl_percent || 0),
      emoji: "⚠️",
      title: escapeHtml(worst.symbol),
      subtitle: `P&L: ${formatINR(worst.pnl || 0)}`,
      valueCls: "text-rose-300",
      bgGlow: "rgba(239,68,68,0.3)",
      note: "Largest drag on returns. Revisit the investment thesis and check for sector/company-specific news.",
    }) : "") +
    cardHTML({
      eyebrow: "Diversification",
      chipCls: diversityRating.cls,
      chipLabel: `${diversityScore}/100 · ${diversityRating.label}`,
      emoji: "🎯",
      title: `${N} stocks`,
      subtitle: diversityRating.text,
      valueCls: "text-violet-300",
      bgGlow: "rgba(139,92,246,0.35)",
      note: totalInvested > 0
        ? `Top holding: ${holdings.slice().sort((a,b)=>(b.invested_value||0)-(a.invested_value||0))[0]?.symbol || "—"} · ${formatPercent(((holdings.slice().sort((a,b)=>(b.invested_value||0)-(a.invested_value||0))[0]?.invested_value||0) / Math.max(totalInvested, 0.0001) * 100))}`
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
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700/70">
            <th class="px-4 py-3 text-left">Symbol</th>
            <th class="px-4 py-3 text-right">Qty</th>
            <th class="px-4 py-3 text-right">LTP</th>
            <th class="px-4 py-3 text-right">Current Value</th>
            <th class="px-4 py-3 text-right">P&L</th>
            <th class="px-4 py-3 text-right hidden md:table-cell">Trend</th>
            <th class="px-4 py-3 text-right">P&L %</th>
          </tr>
        </thead>
        <tbody>
          ${top5.map((h, i) => {
            const spark = sparklineSVG(generateSparkline(20, hashSeed(h.symbol + "h"), 0.14, 50), 80, 22);
            return `
              <tr class="border-b border-slate-700/40 table-row-hover fade-up" style="animation-delay:${i*55}ms">
                <td class="px-4 py-3">
                  <p class="font-bold text-sky-400">${escapeHtml(h.symbol)}</p>
                  ${h.exchange ? `<p class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(h.exchange)}</p>` : ""}
                </td>
                <td class="px-4 py-3 text-right text-slate-300 tabular-nums">${formatNumber(h.quantity, 0)}</td>
                <td class="px-4 py-3 text-right text-slate-300 tabular-nums">${h.last_traded_price != null ? formatINR(h.last_traded_price) : "—"}</td>
                <td class="px-4 py-3 text-right text-slate-300 tabular-nums font-medium">${h.current_value != null ? formatINR(h.current_value) : "—"}</td>
                <td class="px-4 py-3 text-right ${pnlClass(h.pnl)} font-semibold tabular-nums">${h.pnl != null ? formatINR(h.pnl) : "—"}</td>
                <td class="px-4 py-3 text-right hidden md:table-cell">${spark}</td>
                <td class="px-4 py-3 text-right ${pnlClass(h.pnl_percent)} font-bold tabular-nums">
                  ${h.pnl_percent != null ? `${pnlArrow(h.pnl_percent)} ${formatPercent(h.pnl_percent)}` : "—"}
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
