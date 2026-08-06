/**
 * config.js
 * Central configuration for the frontend.
 * Change API_BASE_URL to point to your deployed backend.
 */

const CONFIG = {
  // Local development: "http://localhost:8000"
  // Production:        "https://your-backend.vercel.app"
  API_BASE_URL: "https://beck2endapiconnected.vercel.app",

  // How often to auto-refresh data (milliseconds). 0 = disabled.
  REFRESH_INTERVAL_MS: 60000, // 1 minute

  // Number of items shown per page in tables
  PAGE_SIZE: 20,
};

// Freeze so it can't be accidentally mutated at runtime
Object.freeze(CONFIG);
