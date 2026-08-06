/**
 * positions.js
 * Intraday positions page — symbol tiles, badges, fade-ups.
 */

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

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(positions) {
  const tbody = document.getElementById("positions-body");

  if (!positions.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="px-4 py-14 text-center text-slate-500 text-sm">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2"/></svg>
        No positions found. Positions are intraday — they reset at end of day.
      </td></tr>`;
    return;
  }

  const totalQty = positions.reduce((s, p) => s + (Math.abs(p.quantity) || 0), 0);
  const posCount = positions.length;
  const winCount = positions.filter(p => (p.pnl || 0) > 0).length;
  const lossCount = positions.filter(p => (p.pnl || 0) < 0).length;
  // Hit rate line (insert before table)
  const headerBox = document.getElementById("positions-header-summary");
  if (headerBox) {
    headerBox.innerHTML = `
      <div class="flex flex-wrap gap-4 sm:gap-6 text-sm">
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Active</p>
          <p class="font-semibold text-slate-100 tabular-nums mt-0.5">${posCount}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Qty</p>
          <p class="font-semibold text-emerald-300 tabular-nums mt-0.5">${totalQty}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Win / Loss</p>
          <p class="font-semibold tabular-nums mt-0.5">
            <span class="pnl-positive">${winCount}</span>
            <span class="text-slate-600 mx-1">/</span>
            <span class="pnl-negative">${lossCount}</span>
          </p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Net P&amp;L</p>
          <p class="font-semibold tabular-nums mt-0.5 ${pnlClass(positions.reduce((s, p) => s + (p.pnl || 0), 0))}">
            ${formatINR(positions.reduce((s, p) => s + (p.pnl || 0), 0))}
          </p>
        </div>
      </div>`;
  }

  tbody.innerHTML = positions.map((p, i) => {
    const hue = ((p.symbol.length * 37) + (p.symbol.charCodeAt(0) || 0) * 13) % 360;
    return `
    <tr class="border-b border-slate-700/40 table-row-hover fade-up" style="animation-delay:${i*45}ms">
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <div class="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-sm font-bold text-white"
               style="background: linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue+40)%360} 70% 45%)); box-shadow: 0 6px 16px -6px hsl(${hue} 70% 50% / .6);">
            ${p.symbol.slice(0,2).toUpperCase()}
          </div>
          <p class="font-bold text-emerald-400 tracking-tight">${escapeHtml(p.symbol)}</p>
        </div>
      </td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatNumber(p.quantity, 0)}</td>
      <td class="px-4 py-3.5 text-right text-slate-300 tabular-nums">${formatINR(p.average_price)}</td>
      <td class="px-4 py-3.5 text-right font-semibold text-slate-100 tabular-nums">${formatINR(p.last_traded_price)}</td>
      <td class="px-4 py-3.5 text-right ${pnlClass(p.pnl)} font-semibold tabular-nums">
        ${pnlArrow(p.pnl || 0)} ${formatINR(p.pnl)}
      </td>
      <td class="px-4 py-3.5 text-center">
        ${p.product
          ? `<span class="badge ${(p.product||"").toUpperCase().includes("MIS") ? "badge-pending" : "badge-complete"}">${escapeHtml(p.product)}</span>`
          : "—"}
      </td>
      <td class="px-4 py-3.5 text-center text-slate-400">${escapeHtml(p.exchange) || "—"}</td>
    </tr>`;
  }).join("");
}

// ── Main loader ───────────────────────────────────────────────────────────────
async function loadPositions() {
  const tbody = document.getElementById("positions-body");
  tbody.innerHTML = skeletonRows(5, 7);

  try {
    const data = await API.getPositions();
    const positions = data.positions || [];
    renderTable(positions);
    showToast(`${positions.length} position${positions.length !== 1 ? "s" : ""} loaded`, "success", 2000);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"></td></tr>`;
    showError(tbody.querySelector("td"), err.message);
    showToast(err.message, "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Inject summary row into positions page if not yet present
  if (document.getElementById("positions-header-summary") == null) {
    const t = document.querySelector(".flex-1.overflow-y-auto > .bg-slate-800.rounded-xl");
    if (t) {
      const wrap = document.createElement("div");
      wrap.className = "bg-slate-800/60 border-b border-slate-700 px-6 py-3 mb-0 rounded-t-xl -mb-px";
      wrap.id = "positions-header-summary";
      t.parentNode.insertBefore(wrap, t);
      t.classList.add("rounded-t-none");
    }
  }

  setActiveNav();
  checkHealth();
  loadPositions();

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(loadPositions, CONFIG.REFRESH_INTERVAL_MS);
  }
});
