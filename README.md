# Portfolio Frontend

Vanilla HTML · Tailwind CSS (CDN) · Plain JavaScript — no build step required.

---

## Project Structure

```
portfolio-frontend/
├── index.html          → Redirects to dashboard.html
├── dashboard.html      → Overview: stats, movers, allocation, holdings preview
├── holdings.html       → Full holdings table with search & sort
├── positions.html      → Intraday positions
├── orders.html         → Order history with filters
├── watchlist.html      → Watchlist cards (symbols from backend .env)
│
├── css/
│   └── style.css       → Custom styles on top of Tailwind
│
└── js/
    ├── config.js       → API base URL + app settings
    ├── api.js          → Fetch wrapper for all backend endpoints
    ├── utils.js        → Formatters, DOM helpers, toast, skeleton loaders
    └── pages/
        ├── dashboard.js
        ├── holdings.js
        ├── positions.js
        ├── orders.js
        └── watchlist.js
```

---

## Quick Start

### 1. Start the backend

```bash
# In portfolio-backend/
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

### 2. Set the API URL

Open `js/config.js` and confirm:

```js
const CONFIG = {
  API_BASE_URL: "http://localhost:8000",  // ← change for production
  REFRESH_INTERVAL_MS: 60000,             // auto-refresh every 60s (0 = off)
  PAGE_SIZE: 20,
};
```

### 3. Open in browser

Just open `dashboard.html` directly in your browser — or serve with any static file server:

```bash
# Python (simplest)
python -m http.server 3000

# Node (if you have npx)
npx serve .
```

Then visit: `http://localhost:3000`

---

## Pages

| Page | Route | What it shows |
|---|---|---|
| Dashboard | `dashboard.html` | Portfolio value, P&L, top movers, allocation bars, holdings preview |
| Holdings | `holdings.html` | All holdings — searchable, sortable by symbol / P&L / value |
| Positions | `positions.html` | Intraday positions with realised P&L |
| Orders | `orders.html` | Full order list — filterable by status and buy/sell side |
| Watchlist | `watchlist.html` | Live price cards for symbols in `WATCHLIST_SYMBOLS` |

---

## Connecting to a Deployed Backend

1. Deploy the backend to Vercel (or anywhere).
2. Open `js/config.js` and update `API_BASE_URL`:

```js
API_BASE_URL: "https://your-backend.vercel.app",
```

3. Make sure the backend's `ALLOWED_ORIGINS` in `.env` includes your frontend URL:

```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

---

## Deploying the Frontend

Since this is pure static HTML/JS/CSS, deploy anywhere that serves static files:

- **Vercel** — drag the folder into vercel.com or `vercel deploy`
- **Netlify** — drag the folder into netlify.com
- **GitHub Pages** — push to a repo and enable Pages on the main branch

No build command needed. No `package.json`. No Node.js required.

---

## Backend Endpoints Used

| Endpoint | Page |
|---|---|
| `GET /health` | All pages (sidebar status badge) |
| `GET /dashboard` | Dashboard |
| `GET /holdings` | Holdings, Dashboard preview |
| `GET /positions` | Positions |
| `GET /orders` | Orders |
| `GET /watchlist` | Watchlist |
| `GET /market-price/{symbol}` | Available via `API.getMarketPrice()` |
