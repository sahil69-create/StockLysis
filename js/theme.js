/* =========================================================================
   Theme Manager: 4 fully self-contained themes
     finance — Professional Finance (navy + gold)
     coding  — Programmer / Coding (terminal black + neon green, monospace)
     dark    — Modern Dark (default; near-black + indigo)
     light   — Minimal Light (white + restrained slate-indigo)
   Each theme owns its own background/surface/border/text tiers, so there is
   no separate light/dark toggle — picking a theme picks its base too.
   Persistence: localStorage — applies instantly before first paint (see HEAD)
   ========================================================================= */
(function () {
  var THEME_KEY = "stocklysis.theme";
  var VALID_THEMES = ["finance", "coding", "dark", "light"];
  var DARK_THEMES = ["finance", "coding", "dark"]; // reuse existing html.dark component overrides
  var THEME_META = {
    finance: { accent: "#c08a26", label: "Professional Finance" },
    coding:  { accent: "#17c96e", label: "Programmer / Coding" },
    dark:    { accent: "#6238ff", label: "Modern Dark" },
    light:   { accent: "#4550a8", label: "Minimal Light" },
  };

  function getStored(key, fallback, valid) {
    try {
      var v = localStorage.getItem(key);
      if (v && valid.indexOf(v) !== -1) return v;
    } catch (e) {}
    return fallback;
  }

  function setStored(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.classList.toggle("dark", DARK_THEMES.indexOf(theme) !== -1);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", (THEME_META[theme] || THEME_META.dark).accent);
  }

  function applyAll() {
    applyTheme(getStored(THEME_KEY, "dark", VALID_THEMES));
  }

  function initToggles() {
    var swatches = document.querySelectorAll(".swatch[data-theme]");
    var currentTheme = getStored(THEME_KEY, "dark", VALID_THEMES);
    swatches.forEach(function (sw) {
      if (sw.getAttribute("data-theme") === currentTheme) sw.classList.add("active");
      sw.addEventListener("click", function () {
        var t = sw.getAttribute("data-theme");
        setStored(THEME_KEY, t);
        applyTheme(t);
        swatches.forEach(function (s) { s.classList.remove("active"); });
        sw.classList.add("active");
      });
    });
  }

  /* ── Public API (also available before load) ──────────────────────────── */
  window.StockLysisTheme = {
    get: function () {
      return { theme: getStored(THEME_KEY, "dark", VALID_THEMES) };
    },
    setTheme: function (theme) {
      if (VALID_THEMES.indexOf(theme) === -1) return;
      setStored(THEME_KEY, theme);
      applyTheme(theme);
      var swatches = document.querySelectorAll(".swatch[data-theme]");
      swatches.forEach(function (s) {
        s.classList.toggle("active", s.getAttribute("data-theme") === theme);
      });
    },
    themes: THEME_META,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToggles);
  } else {
    initToggles();
  }

  applyAll();
})();
