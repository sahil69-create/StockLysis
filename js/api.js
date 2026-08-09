/**
 * api.js
 * Thin fetch wrapper that talks to the FastAPI backend.
 * All functions return the parsed JSON on success, or throw an Error
 * with a human-readable message on failure.
 */

const API = (() => {
  /**
   * Core fetch helper.
   * @param {string} path  - e.g. "/dashboard"
   * @returns {Promise<any>}
   */
  async function _get(path) {
    const url = `${CONFIG.API_BASE_URL}${path}`;
    let res;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    } catch (networkErr) {
      throw new Error(
        "Network error — check that the backend is running and CORS is configured correctly."
      );
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch (_) {}
      throw new Error(detail);
    }

    return res.json();
  }

  return {
    /** GET /health */
    getHealth: () => _get("/health"),

    /** GET /diagnostic */
    getDiagnostic: () => _get("/diagnostic"),

    /** GET /dashboard */
    getDashboard: () => _get("/dashboard"),

    /** GET /holdings */
    getHoldings: () => _get("/holdings"),

    /** GET /positions */
    getPositions: () => _get("/positions"),

    /** GET /orders */
    getOrders: () => _get("/orders"),

    /** GET /watchlist */
    getWatchlist: () => _get("/watchlist"),

    /** GET /portfolio */
    getPortfolio: () => _get("/portfolio"),

    /** GET /market-price/:symbol?exchange=NSE */
    getMarketPrice: (symbol, exchange = "NSE") =>
      _get(`/market-price/${encodeURIComponent(symbol)}?exchange=${exchange}`),
  };
})();
