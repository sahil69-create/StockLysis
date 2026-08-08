/* =========================================================================
   Theme Manager: Light/Dark mode + 4 color palettes (Blue/Red/Lime/Pink)
   Persistence: localStorage — applies instantly before first paint (see HEAD)
   ========================================================================= */
(function () {
  var THEME_KEY = "stocklysis.theme";
  var MODE_KEY = "stocklysis.mode";
  var VALID_THEMES = ["blue", "red", "lime", "pink"];
  var VALID_MODES = ["light", "dark"];

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

  function applyMode(mode) {
    var html = document.documentElement;
    if (mode === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    for (var i = 0; i < VALID_THEMES.length; i++) {
      html.removeAttribute("data-theme-" + VALID_THEMES[i]);
    }
    html.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    var accent = { blue: "#465fff", red: "#ef4444", lime: "#65a30d", pink: "#e11d48" };
    if (meta) meta.setAttribute("content", accent[theme] || "#465fff");
  }

  function applyAll() {
    applyMode(getStored(MODE_KEY, "dark", VALID_MODES));
    applyTheme(getStored(THEME_KEY, "blue", VALID_THEMES));
  }

  function initToggles() {
    var modeBtn = document.getElementById("theme-mode-toggle");
    if (modeBtn) {
      updateModeButton(modeBtn, getStored(MODE_KEY, "dark", VALID_MODES));
      modeBtn.addEventListener("click", function () {
        var next = getStored(MODE_KEY, "dark", VALID_MODES) === "dark" ? "light" : "dark";
        setStored(MODE_KEY, next);
        applyMode(next);
        updateModeButton(modeBtn, next);
      });
    }

    var swatches = document.querySelectorAll(".swatch[data-theme]");
    var currentTheme = getStored(THEME_KEY, "blue", VALID_THEMES);
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

  function updateModeButton(btn, mode) {
    var sun = btn.querySelector(".ico-sun");
    var moon = btn.querySelector(".ico-moon");
    if (mode === "dark") {
      if (sun) sun.style.display = "";
      if (moon) moon.style.display = "none";
      btn.title = "Light mode";
    } else {
      if (sun) sun.style.display = "none";
      if (moon) moon.style.display = "";
      btn.title = "Dark mode";
    }
  }

  /* ── Public API (also available before load) ──────────────────────────── */
  window.StockLysisTheme = {
    get: function () {
      return {
        mode: getStored(MODE_KEY, "dark", VALID_MODES),
        theme: getStored(THEME_KEY, "blue", VALID_THEMES)
      };
    },
    setMode: function (mode) {
      if (VALID_MODES.indexOf(mode) === -1) return;
      setStored(MODE_KEY, mode);
      applyMode(mode);
      var btn = document.getElementById("theme-mode-toggle");
      if (btn) updateModeButton(btn, mode);
    },
    setTheme: function (theme) {
      if (VALID_THEMES.indexOf(theme) === -1) return;
      setStored(THEME_KEY, theme);
      applyTheme(theme);
      var swatches = document.querySelectorAll(".swatch[data-theme]");
      swatches.forEach(function (s) {
        s.classList.toggle("active", s.getAttribute("data-theme") === theme);
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToggles);
  } else {
    initToggles();
  }

  applyAll();
})();
