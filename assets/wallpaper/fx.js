"use strict";

const FxShader = {
  header: `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uFade, uStar, uAccent, uAccentGain, uDark;
uniform vec3 uC1, uC2, uC3, uCenter, uHits;
uniform vec4 uAudio;
uniform float uBeats[16];
const float TAU = 6.28318530718;
const float PI = 3.14159265359;
struct Ctx {
  vec2 uv;
  vec2 p;
  float aspect;
  float px;
  float t;
  float bass;
  float mid;
  float high;
  float level;
  vec3 c1;
  vec3 c2;
  vec3 c3;
  vec2 cc;
  float coverR;
  float dc;
  vec3 hits;
  float star;
};
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}
vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }
vec3 blob(vec2 p, vec2 c, float r, vec3 col) { vec2 d = p - c; return col * exp(-dot(d, d) / (r * r)); }
vec3 hue(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
float ring(float d, float r, float w) { float x = (d - r) / w; return exp(-x * x); }
float line(float d, float w) { return exp(-(d * d) / (w * w)); }
vec3 palette3(vec3 a, vec3 b, vec3 c, float x) {
  x = fract(x) * 3.0;
  return x < 1.0 ? mix(a, b, smoothstep(0.0, 1.0, x)) : (x < 2.0 ? mix(b, c, smoothstep(1.0, 2.0, x)) : mix(c, a, smoothstep(2.0, 3.0, x)));
}
`,
  main: `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float px = 1.0 / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime, bass = uAudio.x, mid = uAudio.y, high = uAudio.z, level = uAudio.w;
  float shift = sin(t * 0.37) * (0.1 + high * 0.24) + mid * 0.1;
  vec3 c1 = hue(uC1, shift), c2 = hue(uC2, shift), c3 = hue(uC3, shift);
  float flow = t * 0.045;
  vec2 q = p * 1.15;
  vec2 w = vec2(fbm(q + vec2(0.0, flow)), fbm(q + vec2(5.2, 1.3) - flow));
  float f = fbm(q + 1.8 * w + vec2(flow * 0.7, -flow * 0.4) + bass * 0.12);
  vec3 liquid = mix(c1, c2, smoothstep(0.25, 0.75, f));
  liquid = mix(liquid, c3, smoothstep(0.45, 0.85, w.x) * 0.8);
  float folds = smoothstep(0.2, 0.9, f) * (0.75 + 0.25 * sin(f * 9.0 + t * 0.6));
  vec3 col = vec3(0.03, 0.033, 0.052) + liquid * folds * (0.34 + level * 0.22 + bass * 0.12);
  float glow = 0.5 + level * 0.25;
  col = screen(col, blob(p, vec2(aspect * (0.38 + 0.2 * sin(t * 0.11)), 0.78 + 0.16 * cos(t * 0.13)), 0.6 * (1.0 + bass * 0.25), c1) * glow);
  col = screen(col, blob(p, vec2(aspect * (0.7 + 0.2 * cos(t * 0.09)), 0.34 + 0.16 * sin(t * 0.12)), 0.55 * (1.0 + mid * 0.18 + bass * 0.08), c2) * glow);
  col = screen(col, blob(p, vec2(aspect * (0.18 + 0.16 * cos(t * 0.07)), 0.28 + 0.13 * sin(t * 0.1)), 0.5 * (1.0 + level * 0.16), c3) * (0.38 + level * 0.18));
  vec2 cc = vec2(uCenter.x * aspect, uCenter.y);
  float dc = length(p - cc);
  col = screen(col, mix(c1, c2, 0.5) * exp(-dc * dc / 0.14) * bass * 0.22);
  col = mix(col, vec3(0.01, 0.01, 0.014), smoothstep(0.45, 0.85, uDark) * 0.85);
  col = screen(col, beatAccent(uAccent, p, cc, dc, uCenter.z, aspect, px, t, c1, c2, c3) * uAccentGain);
  Ctx c;
  c.uv = uv; c.p = p; c.aspect = aspect; c.px = px; c.t = t;
  c.bass = bass; c.mid = mid; c.high = high; c.level = level;
  c.c1 = c1; c.c2 = c2; c.c3 = c3; c.cc = cc; c.coverR = uCenter.z; c.dc = dc; c.hits = uHits; c.star = uStar;
  vec4 layer = modeLayer(c);
  col = mix(col, vec3(0.025, 0.027, 0.045), clamp(layer.a, 0.0, 1.0) * uFade);
  col = screen(col, max(layer.rgb, 0.0) * uFade);
  float vig = smoothstep(1.35, 0.2, length((uv - vec2(0.55, 0.5)) * vec2(aspect * 0.72, 1.0)));
  col *= mix(0.32, 1.0, vig) * (1.0 + bass * 0.08);
  col += (hash(gl_FragCoord.xy + fract(t * 7.0)) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`,
  vertex: `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`,
  uniforms: ["uRes", "uTime", "uFade", "uStar", "uAccent", "uAccentGain", "uDark", "uC1", "uC2", "uC3", "uCenter", "uHits", "uAudio", "uBeats[0]"],
};

function fxModes() {
  const list = (window.TaliaModes || []).filter((m) => m && m.id && typeof m.glsl === "string");
  const seen = new Set();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function fxCompile(gl, glsl) {
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log);
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, FxShader.vertex);
  const fs = shader(gl.FRAGMENT_SHADER, FxShader.header + "\n" + window.TaliaAccent.glsl + "\n" + glsl + "\n" + FxShader.main);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const u = {};
  for (const name of FxShader.uniforms) u[name] = gl.getUniformLocation(program, name);
  return { program, u };
}

function fxQuad(gl) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

function fxDraw(gl, compiled, values) {
  gl.useProgram(compiled.program);
  const u = compiled.u;
  gl.uniform2f(u.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform1f(u.uTime, values.time);
  gl.uniform1f(u.uFade, values.fade);
  gl.uniform1f(u.uStar, values.star);
  gl.uniform1f(u.uAccent, values.accent || 0);
  gl.uniform1f(u.uAccentGain, values.accentGain == null ? 1 : values.accentGain);
  gl.uniform1f(u.uDark, values.dark || 0);
  gl.uniform3fv(u.uC1, values.colors[0]);
  gl.uniform3fv(u.uC2, values.colors[1]);
  gl.uniform3fv(u.uC3, values.colors[2]);
  gl.uniform3fv(u.uCenter, values.center);
  gl.uniform3fv(u.uHits, values.hits);
  gl.uniform4fv(u.uAudio, values.audio);
  gl.uniform1fv(u["uBeats[0]"], values.beats || [values.hits[0], values.hits[1], values.hits[2], -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
