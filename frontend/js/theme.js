/* VALIDRIFT theme switcher — Forge (dark) / Dayshift (light).
   A tiny inline snippet in <head> sets data-theme before first paint;
   this file owns the toggle UI + persistence. */
(function () {
  "use strict";
  var KEY = "vr_theme";
  var THEMES = ["forge", "dayshift"];
  var LABEL = { forge: "Forge", dayshift: "Dayshift" };
  var ICON = { forge: "dark_mode", dayshift: "light_mode" };

  function current() {
    try {
      var t = localStorage.getItem(KEY);
      return THEMES.indexOf(t) >= 0 ? t : "forge";
    } catch (e) { return "forge"; }
  }
  function apply(name) {
    document.documentElement.setAttribute("data-theme", name);
    try { localStorage.setItem(KEY, name); } catch (e) {}
    var btns = document.querySelectorAll("[data-vr-theme-btn]");
    for (var i = 0; i < btns.length; i++) {
      var icon = btns[i].querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = ICON[name];
      btns[i].setAttribute("title", "Switch to " + LABEL[name === "forge" ? "dayshift" : "forge"] + " theme");
      btns[i].setAttribute("aria-label", "Switch color theme (current: " + LABEL[name] + ")");
    }
  }
  function toggle() {
    apply(current() === "forge" ? "dayshift" : "forge");
  }
  function renderButtons() {
    var slots = document.querySelectorAll("[data-vr-theme-toggle]");
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].querySelector("[data-vr-theme-btn]")) continue;
      var b = document.createElement("button");
      b.type = "button";
      b.id = "vr-theme-toggle";
      b.setAttribute("data-vr-theme-btn", "1");
      b.className = "p-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest/60 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors";
      b.innerHTML = '<span class="material-symbols-outlined text-[20px] block">' + ICON[current()] + "</span>";
      b.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
      slots[i].appendChild(b);
    }
  }
  function init() {
    apply(current());
    renderButtons();
  }
  window.ValidriftTheme = { current: current, apply: apply, toggle: toggle };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
