/**
 * holdings.js — Groww-style live holdings view.
 *
 * Data is imported LIVE from the Groww account via the backend:
 *   • GET /dashboard      → portfolio value, today's P&L, total P&L, invested
 *   • GET /holdings       → every holding (auto-synced, no manual entry)
 *   • GET /history/:sym   → real price series that powers each sparkline
 *   • GET /market-price   → live index chips (best-effort)
 *
 * Depends on: config.js, api.js, utils.js
 */

let _allHoldings = [];
let _dashboard = null;
const MASK_KEY = "stocklysis.masked";
const OPEN_KEY = "stocklysis.openHolding";
let _masked = _loadBool(MASK_KEY, false);
let _openSymbol = _loadStr(OPEN_KEY, "");

function _loadBool(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v === "1"; } catch (e) { return d; } }
function _loadStr(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function _save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// ── Formatting helpers ────────────────────────────────────────────────────────
function gwSigned(n) {
  if (n === null || n === undefined) return "—";
  return (n >= 0 ? "+" : "−") + formatINR(Math.abs(n));
}
function gwPct(n) {
  if (n === null || n === undefined) return "—";
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%";
}
function maskINR(v) { return _masked ? "₹ • • • •" : formatINR(v); }
function maskSigned(n) { return _masked ? "₹ • • • •" : gwSigned(n); }

// ── Sparkline (real history, seeded fallback) ─────────────────────────────────
function _seed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h || 1; }
function _seedValues(length, seed, volatility, base) {
  const values = []; let v = base; let s = seed || 1;
  for (let i = 0; i < length; i++) { s = (s * 9301 + 49297) % 233280; const r = s / 233280; v = Math.max(base * 0.5, Math.min(base * 1.5, v + (r - 0.5) * 2 * volatility * v)); values.push(v); }
  return values;
}
function _sparkSVG(values, up, w, h) {
  w = w || 84; h = h || 32;
  if (!values || values.length < 2) values = [1, 1];
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values), range = (max - min) || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 5) - 2.5).toFixed(1)}`).join(" ");
  const stroke = up ? "var(--gw-gain)" : "var(--gw-loss)";
  const fill = up ? "var(--gw-gain-soft)" : "var(--gw-loss-soft)";
  const area = `0,${h} ${pts} ${w},${h}`;
  return `<svg class="gw-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="${area}" fill="${fill}"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// history cache (5 min TTL, sessionStorage)
const _histCache = {};
function _histCacheGet(sym) {
  if (_histCache[sym]) return _histCache[sym];
  try { const raw = sessionStorage.getItem("hist." + sym); if (!raw) return null; const o = JSON.parse(raw); if (Date.now() - o.ts > 300000) return null; _histCache[sym] = o.v; return o.v; } catch (e) { return null; }
}
function _histCacheSet(sym, v) { _histCache[sym] = v; try { sessionStorage.setItem("hist." + sym, JSON.stringify({ ts: Date.now(), v: v })); } catch (e) {} }

/** Fetch real history for a symbol, then swap its sparkline in place. */
async function _hydrateSpark(h) {
  const ex = (h.exchange && /BSE/i.test(h.exchange)) ? "BSE" : "NSE";
  let values = _histCacheGet(h.symbol);
  if (!values) {
    try {
      const data = await API.getHistory(h.symbol, ex, 15, 7);
      values = (data.points || []).map(p => p.c).filter(c => typeof c === "number");
      if (values.length >= 2) _histCacheSet(h.symbol, values);
    } catch (e) { values = null; }
  }
  if (!values || values.length < 2) return; // keep seeded fallback
  const up = _rowUp(h);
  const holder = document.querySelector(`.gw-spark-wrap[data-sym="${cssEsc(h.symbol)}"]`);
  if (holder) holder.innerHTML = _sparkSVG(values, up);
}
function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

// ── Direction helper ──────────────────────────────────────────────────────────
function _rowUp(h) {
  if (h.day_change_percent !== null && h.day_change_percent !== undefined) return h.day_change_percent >= 0;
  if (h.day_change !== null && h.day_change !== undefined) return h.day_change >= 0;
  return (h.pnl || 0) >= 0;
}

// ── Health badge ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  if (!badge) return;
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.35rem;"><span class="health-dot${ok ? "" : " err"}"></span><span class="text-mode-secondary">${ok ? "Backend OK" : "Degraded"}</span></span>`;
  } catch {
    badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.35rem;"><span class="health-dot err"></span><span class="text-mode-tertiary">Offline</span></span>`;
  }
}

// ── Index chips (best-effort; hidden if unavailable) ──────────────────────────
async function loadIndices() {
  const el = document.getElementById("gw-indices");
  if (!el) return;
  const wanted = [{ sym: "NIFTY", label: "NIFTY 50" }, { sym: "SENSEX", label: "SENSEX", ex: "BSE" }];
  const results = await Promise.all(wanted.map(async (w) => {
    try {
      const q = await API.getMarketPrice(w.sym, w.ex || "NSE");
      const ltp = q.last_traded_price;
      if (ltp == null || ltp <= 0) return null;
      return { label: w.label, val: ltp, chg: q.change, pct: q.change_percent };
    } catch (e) { return null; }
  }));
  const ok = results.filter(Boolean);
  if (!ok.length) { el.style.display = "none"; return; }
  el.style.display = "flex";
  el.innerHTML = ok.map(ix => {
    const up = (ix.chg || 0) >= 0;
    const cls = up ? "gw-gain" : "gw-loss";
    const chg = ix.chg == null ? "" : `${up ? "+" : "−"}${formatNumber(Math.abs(ix.chg))}` + (ix.pct != null ? ` (${gwPct(ix.pct)})` : "");
    return `<div class="gw-index"><div class="gw-ix-name">${escapeHtml(ix.label)}</div>
      <div class="gw-ix-val">${formatNumber(ix.val)}</div>
      <div class="gw-ix-chg ${cls}">${chg}</div></div>`;
  }).join("");
}

// ── Summary card ──────────────────────────────────────────────────────────────
function renderSummary() {
  const el = document.getElementById("gw-summary");
  if (!el) return;

  // Prefer live /dashboard numbers; fall back to computing from holdings.
  let curVal, invested, totPnl, totPct, dayPnl, dayPct;
  if (_dashboard) {
    curVal = _dashboard.current_portfolio_value;
    invested = _dashboard.invested_amount;
    totPnl = _dashboard.total_pnl;
    totPct = _dashboard.total_pnl_percent;
    dayPnl = _dashboard.todays_pnl;
    dayPct = _dashboard.todays_pnl_percent;
  } else {
    invested = _allHoldings.reduce((s, h) => s + (h.invested_value || 0), 0);
    curVal = _allHoldings.reduce((s, h) => s + (h.current_value || h.invested_value || 0), 0);
    totPnl = curVal - invested;
    totPct = invested > 0 ? (totPnl / invested) * 100 : 0;
    dayPnl = _allHoldings.reduce((s, h) => s + ((h.day_change || 0) * (h.quantity || 0)), 0);
    const base = curVal - dayPnl;
    dayPct = base > 0 ? (dayPnl / base) * 100 : 0;
  }

  const eyeIcon = _masked
    ? '<path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1"/><path d="M3 3l18 18"/><path d="M9.5 9.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"/>'
    : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';

  el.innerHTML = `
    <div class="gw-summary">
      <div class="gw-sum-head">
        <div>
          <div class="gw-count">Holdings (${_allHoldings.length})</div>
          <div class="gw-total ${_masked ? "gw-masked" : ""}">${maskINR(curVal)}</div>
        </div>
        <button class="gw-eye" id="gw-eye-btn" title="Hide / show values" aria-label="Hide or show values">
          <svg viewBox="0 0 24 24">${eyeIcon}</svg>
        </button>
      </div>
      <div class="gw-rows">
        <div class="gw-srow"><span class="gw-lab">1D returns</span>
          <span class="gw-amt ${dayPnl >= 0 ? "gw-gain" : "gw-loss"}">${_masked ? "₹ • • • •" : gwSigned(dayPnl) + "  (" + gwPct(dayPct) + ")"}</span></div>
        <div class="gw-srow"><span class="gw-lab">Total returns</span>
          <span class="gw-amt ${totPnl >= 0 ? "gw-gain" : "gw-loss"}">${_masked ? "₹ • • • •" : gwSigned(totPnl) + "  (" + gwPct(totPct) + ")"}</span></div>
        <div class="gw-srow"><span class="gw-lab">Invested</span>
          <span class="gw-amt" style="color:var(--text)">${maskINR(invested)}</span></div>
      </div>
    </div>`;

  const eyeBtn = document.getElementById("gw-eye-btn");
  if (eyeBtn) eyeBtn.addEventListener("click", () => {
    _masked = !_masked; _save(MASK_KEY, _masked ? "1" : "0"); render();
  });
}

// ── Holdings list ─────────────────────────────────────────────────────────────
function renderList(holdings) {
  const el = document.getElementById("gw-list");
  if (!el) return;

  if (!holdings.length) {
    el.innerHTML = `<div class="state-wrap" style="padding:3rem 1rem;text-align:center;">
      <div class="state-icon empty">📊</div>
      <p class="state-title">No holdings found</p>
      <p class="state-msg">Once your Groww account has holdings, they sync here automatically — no manual entry.</p>
    </div>`;
    return;
  }

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_value || 0), 0);

  el.innerHTML = holdings.map((h) => {
    const up = _rowUp(h);
    const name = (h.company_name && h.company_name !== h.symbol) ? h.company_name : h.symbol;
    const qty = formatNumber(h.quantity, (h.quantity % 1 === 0) ? 0 : 2);
    const dayPctTxt = (h.day_change_percent != null) ? gwPct(h.day_change_percent) : gwPct(h.pnl_percent);
    const liveCur = (h.current_value != null && h.current_value > 0) ? h.current_value : h.invested_value;
    const seed = _seedValues(20, _seed(h.symbol), 0.14, 50);
    const spark = _sparkSVG(seed, up);
    const isOpen = _openSymbol === h.symbol;

    const src = h.ltp_source || "fallback";
    const liveDot = src === "live" ? "" : "off";
    const ltp = (h.last_traded_price != null && h.last_traded_price > 0) ? h.last_traded_price : h.average_price;
    const weight = totalInvested > 0 ? ((h.invested_value || 0) / totalInvested) * 100 : 0;

    return `
    <div class="gw-holding ${isOpen ? "open" : ""}" data-sym="${escapeHtml(h.symbol)}">
      <div class="gw-h-left">
        <div class="stock-avatar" style="background:hsl(${(name.length * 37) % 360} 60% 48%);">${escapeHtml((name).slice(0, 2).toUpperCase())}</div>
        <div style="min-width:0;">
          <div class="gw-h-name">${escapeHtml(name)}</div>
          <div class="gw-h-sub">${qty} ${Math.abs(h.quantity) === 1 ? "share" : "shares"} · <span class="${up ? "gw-gain" : "gw-loss"}">${dayPctTxt}</span></div>
        </div>
      </div>
      <span class="gw-spark-wrap" data-sym="${escapeHtml(h.symbol)}">${spark}</span>
      <div class="gw-h-right">
        <div class="gw-h-cur ${up ? "gw-gain" : "gw-loss"}">${maskINR(liveCur)}</div>
        <div class="gw-h-inv">${_masked ? "(₹ • • • •)" : "(" + formatINR(h.invested_value) + ")"}</div>
      </div>
    </div>
    <div class="gw-detail ${isOpen ? "open" : ""}" data-detail="${escapeHtml(h.symbol)}">
      <div class="gw-dt"><span class="k">Avg price</span><span class="v">${maskINR(h.average_price)}</span></div>
      <div class="gw-dt"><span class="k">LTP <span class="live-dot ${liveDot}" style="width:5px;height:5px;"></span></span><span class="v">${maskINR(ltp)}</span></div>
      <div class="gw-dt"><span class="k">Day change</span><span class="v ${up ? "gw-gain" : "gw-loss"}">${h.day_change != null ? maskSigned(h.day_change) : "—"}</span></div>
      <div class="gw-dt"><span class="k">Total P&amp;L</span><span class="v ${(h.pnl || 0) >= 0 ? "gw-gain" : "gw-loss"}">${maskSigned(h.pnl)} (${gwPct(h.pnl_percent)})</span></div>
      <div class="gw-dt"><span class="k">Weight</span><span class="v">${formatPercent(weight)}</span></div>
      <div class="gw-dt"><span class="k">Exchange</span><span class="v">${escapeHtml(h.exchange || "—")}</span></div>
    </div>`;
  }).join("");

  // Wire row toggles
  el.querySelectorAll(".gw-holding").forEach(row => {
    row.addEventListener("click", () => {
      const sym = row.getAttribute("data-sym");
      _openSymbol = (_openSymbol === sym) ? "" : sym;
      _save(OPEN_KEY, _openSymbol);
      row.classList.toggle("open", _openSymbol === sym);
      const det = el.querySelector(`.gw-detail[data-detail="${cssEsc(sym)}"]`);
      if (det) det.classList.toggle("open", _openSymbol === sym);
    });
  });

  // Swap in real sparklines (throttled concurrency)
  _hydrateAllSparks(holdings);
}

async function _hydrateAllSparks(holdings) {
  const queue = holdings.slice();
  const LIMIT = 4;
  async function worker() { while (queue.length) { const h = queue.shift(); await _hydrateSpark(h); } }
  const workers = []; for (let i = 0; i < LIMIT; i++) workers.push(worker());
  await Promise.all(workers);
}

// ── Filter + sort ─────────────────────────────────────────────────────────────
function applyFilters() {
  const query = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const sortBy = document.getElementById("sort-select")?.value || "current_value";

  const labels = { current_value: "Current value", day: "1D change %", pnl_percent: "Total return %", pnl: "Total P&L", symbol: "Name (A–Z)" };
  const lbl = document.getElementById("gw-sort-label"); if (lbl) lbl.textContent = labels[sortBy] || "Current value";

  let result = _allHoldings.filter(h =>
    !query || h.symbol.toLowerCase().includes(query) || (h.company_name || "").toLowerCase().includes(query)
  );
  result.sort((a, b) => {
    if (sortBy === "symbol") return ((a.company_name || a.symbol)).localeCompare(b.company_name || b.symbol);
    if (sortBy === "day") return (b.day_change_percent || 0) - (a.day_change_percent || 0);
    if (sortBy === "pnl") return (b.pnl || 0) - (a.pnl || 0);
    if (sortBy === "pnl_percent") return (b.pnl_percent || 0) - (a.pnl_percent || 0);
    return (b.current_value || 0) - (a.current_value || 0); // current_value
  });
  renderList(result);
}

function render() { renderSummary(); applyFilters(); }

// ── Main loader ───────────────────────────────────────────────────────────────
// silent=true (interval auto-refresh) skips the skeleton wipe and success
// toast so periodic updates patch values in place instead of flashing.
async function loadHoldings(opts = {}) {
  const silent = !!opts.silent;
  const list = document.getElementById("gw-list");
  if (!silent && list) list.innerHTML = skeletonRows(6, 1);

  try {
    const [dash, hold] = await Promise.allSettled([API.getDashboard(), API.getHoldings()]);
    _dashboard = dash.status === "fulfilled" ? dash.value : null;
    if (hold.status === "fulfilled") {
      _allHoldings = hold.value.holdings || [];
    } else {
      throw new Error(hold.reason?.message || "Could not load holdings");
    }
    render();

    const stamp = document.getElementById("gw-updated");
    if (stamp) {
      const cov = _dashboard && _dashboard.live_coverage != null ? Math.round(_dashboard.live_coverage * 100) : null;
      stamp.innerHTML = `<span class="gw-live"><span class="live-dot"></span>Live from Groww${cov != null ? " · " + cov + "% live prices" : ""}</span> · updated ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (!silent) showToast(`${_allHoldings.length} holdings synced`, "success", 1800);
  } catch (err) {
    if (silent) return; // keep showing last-good state rather than replacing it with an error on a background tick
    const friendly = _friendlyError(err.message);
    const summary = document.getElementById("gw-summary");
    if (summary) summary.innerHTML = "";
    if (list) {
      list.innerHTML = `<div class="state-wrap" style="padding:2.5rem 1.25rem;text-align:center;max-width:460px;margin:0 auto;">
        <div class="state-icon" style="font-size:2rem;">${friendly.icon}</div>
        <p class="state-title" style="margin-top:.5rem;">${friendly.title}</p>
        <p class="state-msg" style="margin-top:.35rem;">${escapeHtml(friendly.msg)}</p>
        ${friendly.steps ? `<ol style="text-align:left;margin:1rem auto 0;max-width:380px;color:var(--text-mid);font-size:.85rem;line-height:1.6;padding-left:1.2rem;">${friendly.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : ""}
        <button onclick="loadHoldings()" style="margin-top:1.1rem;" class="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition">Retry</button>
      </div>`;
    }
    showToast(friendly.title, "error");
  }
}

/** Map raw backend/Groww errors to a friendly, actionable message. */
function _friendlyError(raw) {
  const r = String(raw || "").toLowerCase();
  if (r.includes("session approval") || r.includes("token") || r.includes("401") || r.includes("expired") || r.includes("forbidden") || r.includes("403")) {
    return {
      icon: "🔑", title: "Groww session expired",
      msg: "Your Groww access token needs to be refreshed — tokens expire daily at 6:00 AM IST. Your holdings will load once it's renewed.",
      steps: [
        "Open groww.in → Profile → Trading APIs.",
        "Approve API access for today (or generate a fresh Access Token).",
        "Update ACCESS_TOKEN in the backend environment, then hit Retry.",
      ],
    };
  }
  if (r.includes("network error") || r.includes("cors")) {
    return {
      icon: "📡", title: "Can't reach the backend",
      msg: "The backend didn't respond, or this origin isn't allowed by CORS. Add this URL to ALLOWED_ORIGINS on the backend.",
    };
  }
  return { icon: "⚠️", title: "Couldn't load holdings", msg: raw || "Unknown error." };
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  checkHealth();
  loadIndices();
  loadHoldings();

  document.getElementById("search-input")?.addEventListener("input", applyFilters);
  document.getElementById("sort-select")?.addEventListener("change", applyFilters);

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(() => { loadHoldings({ silent: true }); loadIndices(); }, CONFIG.REFRESH_INTERVAL_MS);
  }
});
