/**
 * utils.js
 * Shared helper functions used across all pages.
 */

// ── Formatting ────────────────────────────────────────────────────────────────

/** Format a number as Indian Rupee currency: ₹1,23,456.78 */
function formatINR(value, decimals = 2) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format a plain number with commas: 1,23,456.78 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format a percentage: +2.34% */
function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** Format an ISO timestamp to readable IST date-time */
function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

/** Format just the date portion */
function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

// ── P&L helpers ───────────────────────────────────────────────────────────────

/** Return the CSS class for a P&L value */
function pnlClass(value) {
  if (value === null || value === undefined) return "pnl-neutral";
  if (value > 0) return "pnl-positive";
  if (value < 0) return "pnl-negative";
  return "pnl-neutral";
}

/** Return ▲ or ▼ arrow string */
function pnlArrow(value) {
  if (value === null || value === undefined) return "";
  return value >= 0 ? "▲" : "▼";
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

/** Replace element innerHTML with a centered spinner */
function showSpinner(el) {
  el.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="spinner"></div>
    </div>`;
}

/** Replace element innerHTML with an error message */
function showError(el, message) {
  el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg class="w-12 h-12 mb-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      <p class="text-sm">${escapeHtml(message)}</p>
    </div>`;
}

/** Replace element innerHTML with an empty-state message */
function showEmpty(el, message = "No data available") {
  el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-slate-500">
      <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"/>
      </svg>
      <p class="text-sm">${escapeHtml(message)}</p>
    </div>`;
}

/** Safely escape HTML to prevent XSS */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Toast notification ────────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Show a toast message.
 * @param {string} message
 * @param {"info"|"success"|"error"} type
 * @param {number} duration  ms to auto-hide
 */
function showToast(message, type = "info", duration = 3500) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  const colors = {
    info:    "bg-slate-700 text-white",
    success: "bg-green-700 text-white",
    error:   "bg-red-700 text-white",
  };

  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium opacity-0 translate-y-4 ${colors[type] || colors.info}`;
  toast.textContent = message;

  requestAnimationFrame(() => toast.classList.add("show"));

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

/** Generate N skeleton table rows with C columns */
function skeletonRows(rows = 5, cols = 5) {
  return Array.from({ length: rows }, () => `
    <tr>
      ${Array.from({ length: cols }, () => `
        <td class="px-4 py-3">
          <div class="skeleton h-4 w-full"></div>
        </td>`).join("")}
    </tr>`).join("");
}

/** Generate N skeleton stat cards */
function skeletonCards(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="bg-slate-800 rounded-xl p-5 card-hover">
      <div class="skeleton h-3 w-24 mb-3"></div>
      <div class="skeleton h-7 w-36 mb-2"></div>
      <div class="skeleton h-3 w-20"></div>
    </div>`).join("");
}

// ── Misc ──────────────────────────────────────────────────────────────────────

/** Set the active nav link based on current page filename */
function setActiveNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href === page || (page === "index.html" && href === "dashboard.html")) {
      link.classList.add("active");
    }
  });
}
