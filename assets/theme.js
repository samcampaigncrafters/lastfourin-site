/* Light or dark, chosen before the page paints so it never flashes the wrong one.
   The player's own pick (the sun/moon switch, saved in this browser) wins; otherwise the phone or computer's setting. */
(function () {
  let t = null;
  try { t = localStorage.getItem("lfi-theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = t;
})();
