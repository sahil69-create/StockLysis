/**
 * positions.js
 * Loads and renders the intraday positions page.
 * Depends on: config.js, api.js, utils.js
 */

// ── Health badge ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("health-badge");
  try {
    const data = await API.getHealth();
    const ok = data.status === "ok";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}"></span>
      <span>${ok ? "Backend OK" : "Degraded"}</span>`;
  } catch {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span><span>Offline</span>`;
  }
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(positions) {
  const tbody = document.getElementById("positions-body");

  if (!positions.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="px-4 py-12 text-center text-slate-500 text-sm">
        No positions found. Positions are intraday — they reset at end of day.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = positions.map(p => `
    <tr class="border-b border-slate-700/50 table-row-hover">
      <td class="px-4 py-3">
        <p class="font-semibold text-sky-400">${escapeHtml(p.symbol)}</p>
      </td>
      <td class="px-4 py-3 text-right text-slate-300">${formatNumber(p.quantity, 0)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(p.average_price)}</td>
      <td class="px-4 py-3 text-right text-slate-300">${formatINR(p.last_traded_price)}</td>
      <td class="px-4 py-3 text-right ${pnlClass(p.pnl)} font-medium">${formatINR(p.pnl)}</td>
      <td class="px-4 py-3 text-center">
        ${p.product
          ? `<span class="badge bg-slate-700 text-slate-300">${escapeHtml(p.product)}</span>`
          : "—"}
      </td>
      <td class="px-4 py-3 text-center text-slate-400">${escapeHtml(p.exchange) || "—"}</td>
    </tr>`).join("");
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
  setActiveNav();
  checkHealth();
  loadPositions();

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(loadPositions, CONFIG.REFRESH_INTERVAL_MS);
  }
});
