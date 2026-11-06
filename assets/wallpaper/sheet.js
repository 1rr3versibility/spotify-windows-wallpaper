"use strict";

(function boot() {
  const params = new URLSearchParams(location.search);
  const part = params.get("part");
  if (part && !window.__partLoaded) {
    if (!/^[a-z0-9-]+$/.test(part)) throw new Error("bad part");
    window.TaliaModes = [];
    const tag = document.createElement("script");
    tag.src = "modes/" + part + ".js?v=" + Date.now();
    tag.onload = () => { window.__partLoaded = true; boot(); };
    tag.onerror = () => { document.getElementById("status").textContent = "не загрузился modes/" + part + ".js"; };
    document.body.appendChild(tag);
    return;
  }
  sheet();
})();

function sheet() {
  const params = new URLSearchParams(location.search);
  const from = Number(params.get("from") || 0), count = Number(params.get("count") || 1000);
  const cols = Number(params.get("cols") || 5);
  const w = 384, h = 216;
  const palettes = [
    [[0.59, 0.2, 0.38], [0.25, 0.38, 0.63], [0.36, 0.24, 0.55]],
    [[0.2, 0.45, 0.42], [0.55, 0.42, 0.2], [0.18, 0.25, 0.5]],
  ];
  const modes = fxModes().slice(from, from + count);
  const gl = document.createElement("canvas").getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  const tile = gl.canvas;
  tile.width = w; tile.height = h;
  gl.viewport(0, 0, w, h);
  fxQuad(gl);
  const big = document.createElement("canvas").getContext("webgl", { antialias: false });
  big.canvas.width = 1920; big.canvas.height = 1080;
  big.viewport(0, 0, 1920, 1080);
  fxQuad(big);
  const out = document.getElementById("sheet");
  const rows = Math.ceil(modes.length / cols);
  out.width = cols * w; out.height = rows * (h + 22);
  const g = out.getContext("2d");
  g.fillStyle = "#0c0d14"; g.fillRect(0, 0, out.width, out.height);
  const errors = [], timings = {};
  modes.forEach((mode, i) => {
    const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 22);
    let compiled;
    try { compiled = fxCompile(gl, mode.glsl); }
    catch (error) { errors.push(mode.id + ": " + String(error.message || error).trim()); g.fillStyle = "#ff6b6b"; g.fillText("ОШИБКА " + mode.id, x + 8, y + 16); return; }
    const time = 1000 + i * 3.7;
    fxDraw(gl, compiled, { time, fade: 1, star: time, colors: palettes[i % 2], center: [0.36, 0.55, 0.2], hits: [time - 0.35, time - 0.9, time - 1.6], beats: [time - 0.35, time - 0.9, time - 1.6, time - 2.4, time - 3.3, time - 4.5, time - 6, time - 8, -100, -100, -100, -100, -100, -100, -100, -100], audio: [0.75, 0.55, 0.5, 0.65] });
    g.drawImage(tile, x, y + 22);
    g.fillStyle = "#c9c9d6"; g.font = "13px Segoe UI";
    g.fillText(mode.id + " · " + (mode.name || ""), x + 6, y + 15);
    try {
      const heavy = fxCompile(big, mode.glsl);
      fxDraw(big, heavy, { time, fade: 1, star: time, colors: palettes[0], center: [0.36, 0.55, 0.2], hits: [time - 0.35, time - 0.9, time - 1.6], audio: [0.7, 0.5, 0.5, 0.6] });
      big.finish();
      const start = performance.now();
      for (let k = 0; k < 10; k++) fxDraw(big, heavy, { time: time + k / 60, fade: 1, star: time, colors: palettes[0], center: [0.36, 0.55, 0.2], hits: [time - 0.35, time - 0.9, time - 1.6], audio: [0.7, 0.5, 0.5, 0.6] });
      const pixel = new Uint8Array(4);
      big.readPixels(0, 0, 1, 1, big.RGBA, big.UNSIGNED_BYTE, pixel);
      timings[mode.id] = +((performance.now() - start) / 10).toFixed(2);
      if (timings[mode.id] > 4) { g.fillStyle = "#ffb86b"; g.fillText(timings[mode.id] + " мс", x + w - 60, y + 15); }
    } catch (error) { errors.push(mode.id + " (1080p): " + String(error.message || error).trim()); }
  });
  document.getElementById("status").textContent = modes.length + " режимов, ошибок: " + errors.length;
  document.getElementById("errors").textContent = errors.join("\n\n");
  window.SheetResult = { count: modes.length, errors, timings };
}
