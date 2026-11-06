"use strict";

window.taliaRender = function (id, w, h, u) {
  const mode = fxModes().find((m) => m.id === id);
  if (!mode) return "missing:" + id;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  if (!gl) return "error:no webgl";
  try {
    fxQuad(gl);
    gl.viewport(0, 0, w, h);
    const compiled = fxCompile(gl, mode.glsl);
    fxDraw(gl, compiled, { time: u.time, fade: u.fade, star: u.star, accent: u.accent, accentGain: u.accentGain, dark: u.dark, colors: u.colors, center: u.center, hits: u.hits, beats: u.beats, audio: u.audio });
    gl.finish();
    const url = canvas.toDataURL("image/png");
    gl.deleteProgram(compiled.program);
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return url;
  } catch (error) {
    return "error:" + (error && error.message ? error.message : String(error));
  }
};
