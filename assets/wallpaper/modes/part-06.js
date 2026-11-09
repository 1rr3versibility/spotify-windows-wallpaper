(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "060-data-rain",
    name: "Дождь данных",
    glsl: `
float m060_glyph(vec2 cell, vec2 f, float tk) {
  vec2 q = (f - vec2(0.16, 0.08)) / vec2(0.68, 0.84);
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec2 b = floor(q * vec2(3.0, 5.0));
  vec2 g = fract(q * vec2(3.0, 5.0));
  float on = step(0.42, hash(cell * 1.7 + b * vec2(3.1, 5.3) + tk * 0.37));
  float bit = step(0.1, g.x) * step(g.x, 0.9) * step(0.1, g.y) * step(g.y, 0.9);
  return inside * on * bit;
}
vec4 modeLayer(Ctx c) {
  float env = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    env += exp(-age * 2.5);
  }
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float sc = k == 0 ? 1.0 : 0.62;
    vec2 cs = vec2(0.022, 0.031) * sc;
    vec2 q = c.p + vec2(fk * 0.37, 0.0);
    float cx = floor(q.x / cs.x);
    float h = hash(vec2(cx, 11.0 + fk));
    float h2 = hash(vec2(cx, 23.0 + fk));
    float h3 = hash(vec2(cx, 41.0 + fk));
    if (h3 < 0.2) continue;
    float span = 1.9;
    float speed = (0.1 + h * 0.22) * sc;
    float head = 1.3 - fract(c.star * speed / span + h2) * span;
    float cy = floor(q.y / cs.y);
    float dy = (cy + 0.5) * cs.y - head;
    float len = (0.16 + h2 * 0.34) * (1.0 + c.bass * 0.6);
    float trail = step(-cs.y * 0.5, dy) * exp(-max(dy, 0.0) / len);
    float isHead = exp(-dy * dy / (cs.y * cs.y) * 2.0);
    float tk = floor(c.t * (1.0 + h * 3.0) + hash(vec2(cx, cy)) * 7.0);
    float g = m060_glyph(vec2(cx, cy), fract(q / cs), tk);
    vec3 tint = palette3(c.c1, c.c2, c.c3, h * 0.9 + cy * 0.004);
    float bright = trail * (0.4 + c.level * 0.25) + isHead * (0.55 + env * 0.3 + c.high * 0.35);
    float layer = k == 0 ? 1.0 : 0.5;
    col += mix(tint, vec3(1.0), isHead * 0.55) * g * bright * layer;
    col += tint * trail * 0.03 * layer;
  }
  return vec4(col, 0.22 + c.bass * 0.08);
}
`,
  },
  {
    id: "061-circuit",
    name: "Микросхема",
    glsl: `
float m061_e(vec2 k) {
  float dens = noise(k * 0.11 + 7.0);
  return step(0.3 + (1.0 - dens) * 0.5, hash(k * 1.31 + 4.7));
}
vec4 modeLayer(Ctx c) {
  float s = 0.04;
  vec2 g = c.p / s;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float eR = m061_e(id + vec2(0.5, 0.0));
  float eL = m061_e(id - vec2(0.5, 0.0));
  float eU = m061_e(id + vec2(0.0, 0.5));
  float eD = m061_e(id - vec2(0.0, 0.5));
  float lc = length(f);
  float dR = mix(9.0, f.x > 0.0 ? abs(f.y) : lc, eR);
  float dL = mix(9.0, f.x < 0.0 ? abs(f.y) : lc, eL);
  float dU = mix(9.0, f.y > 0.0 ? abs(f.x) : lc, eU);
  float dD = mix(9.0, f.y < 0.0 ? abs(f.x) : lc, eD);
  float dh = min(dR, dL) * s;
  float dv = min(dU, dD) * s;
  float d = min(dh, dv);
  float deg = eR + eL + eU + eD;
  float tr = line(d, 1.3 * c.px) + line(d, 5.0 * c.px) * 0.18;
  float pad = 0.0;
  if (deg > 0.5 && deg < 1.5) pad = ring(lc * s, 0.2 * s, 1.3 * c.px) + line(lc * s, 0.07 * s) * 0.6;
  if (deg > 2.5) pad = line(lc * s, 0.12 * s);
  float dirH = hash(vec2(id.y, 3.0)) < 0.5 ? -1.0 : 1.0;
  float dirV = hash(vec2(id.x, 5.0)) < 0.5 ? -1.0 : 1.0;
  float ph = pow(fract(g.x * 0.09 * dirH - c.star * (0.2 + hash(vec2(id.y, 8.0)) * 0.3) + hash(vec2(id.y, 1.0))), 14.0);
  float pv = pow(fract(g.y * 0.09 * dirV - c.star * (0.2 + hash(vec2(id.x, 9.0)) * 0.3) + hash(vec2(id.x, 2.0))), 14.0);
  float pulse = ph * line(dh, 2.0 * c.px) + pv * line(dv, 2.0 * c.px);
  vec3 tint = palette3(c.c1, c.c2, c.c3, noise(id * 0.06 + 2.0) * 1.4 + hash(id) * 0.08);
  vec3 wave = vec3(0.0);
  float reach = length(vec2(c.aspect, 1.0)) * 1.1;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.38;
    float fade = smoothstep(reach, reach * 0.6, r) * smoothstep(0.0, 0.15, age);
    wave += palette3(c.c1, c.c2, c.c3, (r - c.coverR) * 0.5 + 0.15) * ring(c.dc, r, 0.03 + age * 0.008) * fade;
  }
  vec3 col = tint * tr * (0.15 + c.mid * 0.12 + c.bass * 0.06);
  col += mix(tint, vec3(1.0), 0.4) * pulse * (0.45 + c.high * 0.5);
  col += tint * pad * (0.2 + c.high * 0.2);
  col += mix(wave, vec3(dot(wave, vec3(0.33))), -0.2) * (tr * 1.3 + pad * 0.8);
  return vec4(col, 0.18);
}
`,
  },
  {
    id: "062-holo-hud",
    name: "Голо-интерфейс",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float ang = atan(d.y, d.x) / TAU + 0.5;
  float R = c.coverR;
  float r0 = c.dc;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float rr = R * (1.28 + fi * 0.34) + c.bass * 0.012 * (fi + 1.0);
    float rot = (noise(vec2(c.t * 0.06, fi * 7.3)) - 0.5) * 3.0 * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    float a2 = fract(ang + rot);
    float n = 5.0 + fi * 9.0;
    float sf = fract(a2 * n);
    float on = step(0.3, hash(vec2(floor(a2 * n), fi + 2.0)));
    float gap = smoothstep(0.0, 0.03, sf) * smoothstep(1.0, 0.97, sf);
    float w = (i == 0 ? 2.4 : 1.2) * c.px;
    float arc = ring(r0, rr, w) * on * gap;
    float halo = ring(r0, rr, 0.012) * on * gap * 0.25;
    float ticks = 0.0;
    if (i == 2) ticks = step(fract(a2 * 144.0), 0.3) * smoothstep(rr + 0.003, rr + 0.005, r0) * smoothstep(rr + 0.008 + 0.016 * (0.3 + c.high), rr + 0.006 + 0.016 * (0.3 + c.high), r0);
    vec3 tint = palette3(c.c1, c.c2, c.c3, fi * 0.29 + 0.05);
    col += mix(tint, vec3(1.0), 0.25) * (arc * 0.55 + halo * (0.4 + c.level * 0.5) + ticks * 0.35);
  }
  float meterA = fract(ang + 0.25);
  col += mix(c.c2, vec3(1.0), 0.3) * ring(r0, R * 1.12, 2.5 * c.px) * smoothstep(0.08 + c.level * 0.5, 0.07 + c.level * 0.5, meterA) * 0.45;
  vec2 q = abs(d);
  float b = R * 2.75;
  col += c.c3 * line(max(q.x, q.y) - b, 1.2 * c.px) * step(b * 0.8, min(q.x, q.y)) * 0.35;
  float reach = length(vec2(c.aspect, 1.0)) * 1.15;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 16.0) continue;
    float r = R + age * 0.22 + age * age * 0.004;
    float fade = smoothstep(reach, reach * 0.72, r) * smoothstep(0.0, 0.25, age);
    float seg = step(0.22, hash(vec2(floor(fract(ang + uBeats[i] * 0.31) * 64.0), floor(uBeats[i] * 13.0))));
    vec3 tint = palette3(c.c1, c.c2, c.c3, (r - R) * 0.7 + 0.1);
    col += mix(tint, vec3(1.0), 0.15) * (ring(r0, r, 1.8 * c.px) * (0.35 + 0.65 * seg) + ring(r0, r, 0.02 + age * 0.003) * 0.3) * fade * (0.55 + 0.25 * c.high);
  }
  col *= 0.8 + 0.2 * sin(c.uv.y / c.px * 1.4);
  return vec4(col, 0.08);
}
`,
  },
  {
    id: "063-night-city",
    name: "Восходящие шлейфы",
    glsl: `
vec3 m063_layer(Ctx c, float k, float env) {
  float cols = 24.0 + k * 18.0;
  float sway = (noise(vec2(c.p.y * 0.7 + k * 4.0, c.t * 0.02 + k * 2.3)) - 0.5) * 0.06;
  float x = (c.p.x + sway) * cols + k * 0.37;
  float cid = floor(x);
  float fx = (fract(x) - 0.5) / cols;
  float h0 = hash(vec2(cid, k * 7.0 + 1.0));
  float spd = (0.035 + 0.09 * hash(vec2(cid, k * 7.0 + 2.0))) * (1.0 - k * 0.25);
  float L = 0.55 + 0.7 * hash(vec2(cid, k * 7.0 + 3.0));
  float sy = (c.uv.y - c.star * spd) / L + hash(vec2(cid, k * 7.0 + 4.0));
  float sid = mod(floor(sy), 37.0);
  float fy = fract(sy);
  float hs = hash(vec2(sid + k * 41.0, cid * 0.37));
  float len = 0.3 + 0.55 * hash(vec2(sid + 5.1, cid + k));
  float sv = fy / len;
  float on = step(0.3, hs) * step(0.2, h0);
  float body = sv * sv * smoothstep(0.0, 0.15, sv) * smoothstep(1.0, 0.985, sv) * on;
  float head = line((sv - 1.0) * len * L, 0.01) * on;
  float w = (1.2 - k * 0.25) * c.px;
  float across = line(fx, w) + line(fx, w * 6.0) * 0.22;
  vec3 tint = palette3(c.c1, c.c2, c.c3, h0 * 1.3 + k * 0.21 + c.uv.y * 0.18);
  float bright = (0.22 + c.mid * 0.35 + c.high * 0.3 + env * 0.15) * (1.0 - k * 0.28);
  return mix(tint, vec3(1.0), head * 0.5) * (body * across + head * line(fx, w * 2.2) * 0.9) * bright;
}
vec4 modeLayer(Ctx c) {
  float env = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 10.0) continue;
    env += exp(-age * 1.2);
  }
  env = min(env, 1.5);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    col += m063_layer(c, float(k), env);
  }
  float haze = noise(vec2(c.p.x * 2.5, c.p.y * 0.6 - c.star * 0.03));
  col += mix(c.c1, c.c3, c.uv.y) * haze * haze * (0.03 + c.level * 0.04);
  return vec4(col, 0.22);
}
`,
  },
  {
    id: "064-soft-glitch",
    name: "Мягкий глитч",
    glsl: `
float m064_text(vec2 p) {
  float rh = 0.024, cw = 0.012;
  float row = floor(p.y / rh);
  float ch = floor(p.x / cw);
  vec2 f = vec2(fract(p.x / cw), fract(p.y / rh));
  float rowOn = step(0.4, hash(vec2(row, 2.0)));
  float colId = mod(ch, 72.0);
  float indent = floor(hash(vec2(row, 5.0)) * 6.0);
  float len = indent + 6.0 + floor(hash(vec2(row + floor(ch / 72.0) * 13.0, 7.0)) * 54.0);
  float inLine = step(indent, colId) * step(colId, len);
  float present = step(0.17, hash(vec2(ch, row * 1.3)));
  vec2 q = (f - vec2(0.15, 0.22)) / vec2(0.7, 0.56);
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec2 b = floor(q * vec2(3.0, 4.0));
  float bit = step(0.4, hash(b + vec2(ch * 3.7, row * 11.3)));
  return rowOn * inLine * present * inside * bit;
}
vec4 modeLayer(Ctx c) {
  float env = 0.0, tear = 0.0, tearOff = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    env += exp(-age * 3.0);
    vec2 hb = hash2(vec2(uBeats[i] * 7.31, 1.7));
    float inBand = smoothstep(0.03 + hb.y * 0.05, 0.02 + hb.y * 0.05, abs(c.uv.y - 0.1 - hb.x * 0.8));
    float e = exp(-age * 3.5) * inBand;
    tear += e;
    tearOff += (hb.y - 0.5) * 0.08 * e;
  }
  float band = floor(c.uv.y * 36.0);
  float gl = smoothstep(0.66, 0.92, noise(vec2(band * 0.73, c.t * 0.8))) * (0.4 + c.high * 0.6);
  float off = (noise(vec2(band * 1.7, c.t * 2.1)) - 0.5) * 0.06 * gl + tearOff;
  float split = 0.0015 + gl * 0.006 + tear * 0.01;
  vec2 q = c.p + vec2(off, c.star * 0.012);
  float mask = smoothstep(0.42, 0.7, fbm(vec2(q.x * 1.3, q.y * 2.2) + vec2(0.0, c.t * 0.02)));
  float bar = exp(-pow((c.uv.y - 1.15 + fract(c.star * 0.025 + 0.3) * 1.4) / 0.05, 2.0));
  float tr = m064_text(q - vec2(split, 0.0));
  float tg = m064_text(q);
  float tb = m064_text(q + vec2(split, 0.0));
  float k = 0.05 + mask * (0.16 + c.bass * 0.08) + gl * 0.22 + tear * 0.3 + bar * 0.18;
  vec3 col = (c.c1 * tr + c.c2 * tg + c.c3 * tb) * k;
  float tt = c.t * 1.6;
  float blk = mix(hash(vec2(floor(q.x * 9.0), band + floor(tt) * 3.1)), hash(vec2(floor(q.x * 9.0), band + floor(tt + 1.0) * 3.1)), fract(tt));
  col += palette3(c.c1, c.c2, c.c3, hash(vec2(band, 4.0)) + floor(q.x * 9.0) * 0.11) * smoothstep(0.72, 0.9, blk) * (gl + tear) * 0.1;
  float edge = 0.5 - abs(fract(c.uv.y * 36.0) - 0.5);
  col += mix(c.c2, c.c3, hash(vec2(band, 9.0))) * line(edge / 36.0, 1.0 * c.px) * (gl + tear) * 0.3;
  col += mix(c.c1, c.c2, 0.5) * bar * 0.025;
  col *= 0.85 + 0.15 * sin(c.uv.y / c.px * 1.6);
  return vec4(col, 0.2);
}
`,
  },
  {
    id: "065-neon-grid",
    name: "Неоновые петли",
    glsl: `
float m065_flash(float t) {
  float f = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = t - uBeats[i];
    if (age >= 0.0 && age < 4.0) f += exp(-age * 2.6);
  }
  return min(f, 1.4);
}

vec4 modeLayer(Ctx c) {
  float s = c.star;
  float flash = m065_flash(c.t);
  vec3 col = vec3(0.0);
  float halo = 0.0;
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float dir = mod(fj, 2.0) * 2.0 - 1.0;
    vec2 ctr = vec2(c.aspect * (0.5 + 0.3 * sin(s * 0.031 + fj * 1.9)), 0.5 + 0.17 * cos(s * 0.027 + fj * 2.6));
    float R = 0.2 + 0.05 * fj + 0.03 * sin(s * 0.05 + fj);
    float m = 2.0 + fj;
    float n = m + 3.0;
    float am = (0.16 + 0.1 * sin(s * 0.043 + fj * 1.3)) * (1.0 + c.bass * 0.25);
    float bn = 0.07 * sin(s * 0.037 + fj * 2.1);
    float ph = s * 0.06 * dir + fj;
    float ps = -s * 0.045 * dir + fj * 2.0;
    vec2 v = c.p - ctr;
    float rho = length(v);
    float th = atan(v.y, v.x);
    float r = R * (1.0 + am * sin(m * th + ph) + bn * sin(n * th + ps));
    float dr = R * (am * m * cos(m * th + ph) + bn * n * cos(n * th + ps));
    float d = abs(rho - r) / sqrt(1.0 + (dr * dr) / max(rho * rho, R * R * 0.36));
    float w = c.px * (1.3 + 0.6 * c.level + 0.8 * flash);
    float core = exp(-d * d / (w * w));
    float glow = exp(-d / (0.018 + 0.01 * c.bass + 0.01 * flash));
    float run = pow(0.5 + 0.5 * cos(th - s * 0.35 * dir - fj * 1.7), 6.0);
    vec3 tint = palette3(c.c1, c.c2, c.c3, th / TAU + fj * 0.31 + s * 0.012);
    float b = (0.55 + 0.3 * c.level + 0.7 * flash) * (0.65 + 0.5 * run);
    col += mix(tint, vec3(1.0), 0.45 + 0.2 * flash) * core * b * 0.8;
    col += tint * glow * b * 0.28;
    halo += glow;
  }
  float a = clamp(0.14 + halo * 0.12, 0.0, 0.38);
  return vec4(col, a);
}
`,
  },
  {
    id: "066-hex-shield",
    name: "Гексащит",
    glsl: `
vec4 m066_hex(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, p - gv);
}
float m066_hd(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec4 modeLayer(Ctx c) {
  float s = 0.045;
  vec4 hx = m066_hex(c.p / s);
  vec2 gv = hx.xy;
  vec2 id = hx.zw;
  float e = 0.5 - m066_hd(gv);
  float dcell = length(id * s - c.cc);
  float cid = hash(id * 0.71 + 3.0);
  vec3 tint = palette3(c.c1, c.c2, c.c3, cid * 0.35 + noise(id * 0.08) * 1.2);
  float vis = smoothstep(0.25, 0.75, noise(id * 0.09 + vec2(c.t * 0.015, -c.t * 0.01)));
  float field = smoothstep(0.62, 0.84, noise(id * 0.21 + vec2(c.t * 0.07, -c.t * 0.05)));
  vec3 wcol = vec3(0.0);
  float reach = length(vec2(c.aspect, 1.0)) * 1.1;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.36;
    float w = exp(-pow((dcell - r) / 0.06, 2.0)) * smoothstep(reach, reach * 0.6, r) * smoothstep(0.0, 0.2, age);
    wcol += palette3(c.c1, c.c2, c.c3, (r - c.coverR) * 0.6 + 0.2) * w;
  }
  float ph = c.t * 1.3 + cid * 9.0;
  float sp = step(0.975 - c.high * 0.03, hash(id + floor(ph))) * sin(PI * fract(ph));
  float edge = line(e * s, 1.1 * c.px);
  float inner = smoothstep(0.0, 0.18, e);
  vec3 col = tint * edge * (0.05 + vis * 0.16 + c.bass * 0.08);
  col += tint * inner * (field * (0.07 + c.mid * 0.12) + sp * 0.32) * (0.4 + vis * 0.6);
  col += tint * line(e * s - 0.12 * s, c.px) * field * 0.25;
  col += wcol * (edge * 0.9 + inner * 0.2);
  return vec4(col, 0.1);
}
`,
  },
  {
    id: "067-light-trails",
    name: "Световые трассы",
    glsl: `
vec4 modeLayer(Ctx c) {
  float env = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    env += exp(-age * 2.2);
  }
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float lanes = 22.0 + fk * 16.0;
    float y = c.uv.y + (noise(vec2(c.p.x * 0.9 + fk * 5.0, fk * 3.0 + c.t * 0.03)) - 0.5) * 0.1;
    float ly = y * lanes;
    float lid = floor(ly);
    float fy = (fract(ly) - 0.5) / lanes;
    if (hash(vec2(lid, fk * 3.1 + 1.0)) < 0.3) continue;
    float dir = hash(vec2(lid, 9.0 + fk)) < 0.5 ? -1.0 : 1.0;
    float spd = (0.12 + hash(vec2(lid, 17.0 + fk)) * 0.3) / (1.0 + fk * 0.5);
    float L = 0.25 + 0.5 * hash(vec2(lid, 29.0 + fk));
    float sx = (c.p.x * dir - c.star * spd) / L;
    float sid = floor(sx);
    float fx = fract(sx);
    float hs = hash(vec2(sid, lid + fk * 57.0));
    float len = 0.3 + 0.55 * hash(vec2(sid + 3.3, lid));
    float sv = fx / len;
    float on = step(0.3, hs) * step(sv, 1.0);
    float body = sv * sv;
    float head = exp(-pow((1.0 - sv) * len * L / 0.005, 2.0));
    float w = (1.4 - fk * 0.3) * c.px * (1.0 + c.bass * 0.5);
    float across = line(fy, w) + line(fy, w * 5.0) * 0.2;
    vec3 tint = palette3(c.c1, c.c2, c.c3, hs * 1.7 + lid * 0.013);
    col += mix(tint, vec3(1.0), head * 0.6) * on * (body * across * (0.32 + c.high * 0.3) + head * line(fy, w * 1.8) * (0.7 + env * 0.5)) * (1.0 - fk * 0.3);
  }
  return vec4(col * 0.8, 0.12);
}
`,
  },
  {
    id: "068-net",
    name: "Сеть узлов",
    glsl: `
vec2 m068_node(vec2 id, float t) {
  vec2 h = hash2(id);
  vec2 h2 = hash2(id + 17.3);
  return id + 0.5 + vec2(sin(t * (0.11 + 0.17 * h.x) + h2.x * TAU), cos(t * (0.09 + 0.15 * h.y) + h2.y * TAU)) * 0.38;
}
vec2 m068_link(vec2 g, vec2 a, vec2 b, vec2 ia, vec2 ib, float s, float px, float star) {
  if (ia.x + ia.y * 57.0 > ib.x + ib.y * 57.0) { vec2 tmp = a; a = b; b = tmp; }
  vec2 pa = g - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h) * s;
  if (d > 12.0 * px) return vec2(0.0);
  float key = hash(ia + ib + 0.37);
  float L = length(ba);
  float fade = smoothstep(1.3, 0.85, L) * step(0.3, key);
  float ln = line(d, px) * 0.5 + line(d, 3.5 * px) * 0.12;
  float ph = fract(star * (0.12 + key * 0.2) + key * 7.0);
  float sig = exp(-pow((h - ph) * L * s / 0.01, 2.0)) * line(d, 2.5 * px);
  return vec2(ln, sig) * fade;
}
vec4 modeLayer(Ctx c) {
  float s = 0.11;
  vec2 g = c.p / s;
  vec2 id = floor(g);
  vec2 n[9];
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    n[i] = m068_node(id + vec2(mod(fi, 3.0) - 1.0, floor(fi / 3.0) - 1.0), c.t);
  }
  vec2 acc = vec2(0.0);
  float nodes = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 o = vec2(mod(fi, 3.0) - 1.0, floor(fi / 3.0) - 1.0);
    float dn = length(g - n[i]) * s;
    if (dn < 0.04) nodes += line(dn, (1.6 + c.high * 2.2) * c.px) + line(dn, 0.012) * 0.15;
    if (i != 4) acc += m068_link(g, n[4], n[i], id, id + o, s, c.px, c.star);
  }
  vec3 wcol = vec3(0.0);
  float reach = length(vec2(c.aspect, 1.0)) * 1.1;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.3;
    wcol += palette3(c.c1, c.c2, c.c3, (r - c.coverR) * 0.6 + 0.4) * ring(c.dc, r, 0.07) * smoothstep(reach, reach * 0.6, r) * smoothstep(0.0, 0.2, age);
  }
  vec3 tint = palette3(c.c1, c.c2, c.c3, noise(c.p * 1.3 + c.t * 0.02) * 1.5);
  vec3 col = tint * acc.x * (0.22 + c.mid * 0.2) + mix(tint, vec3(1.0), 0.45) * acc.y * (0.45 + c.high * 0.5);
  col += mix(tint, vec3(1.0), 0.3) * nodes * (0.35 + c.bass * 0.3);
  col += wcol * (acc.x * 1.5 + nodes * 1.2 + acc.y);
  return vec4(col, 0.12);
}
`,
  },
  {
    id: "069-rain-glass",
    name: "Капли на окне",
    glsl: `
vec3 m069_bokeh(vec2 p, Ctx c, float env) {
  vec3 col = mix(c.c1, c.c2, c.uv.x) * smoothstep(0.7, 0.0, p.y) * 0.05;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float s = 0.16 - fk * 0.07;
    vec2 q = p / s + vec2(fk * 3.7, c.t * 0.012 * (fk + 1.0));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 h = hash2(id + fk * 19.0);
    vec2 o = (h - 0.5) * 0.25;
    float rad = (0.15 + 0.15 * h.y) * (1.0 + c.bass * 0.2);
    float dd = length(f - o);
    float disc = smoothstep(rad, rad - 0.035, dd) * (0.55 + 0.45 * smoothstep(rad * 0.5, rad, dd));
    float flick = 0.6 + 0.4 * noise(vec2(c.t * 0.5, h.x * 40.0));
    vec3 tint = palette3(c.c1, c.c2, c.c3, h.x * 2.3 + h.y);
    col += tint * disc * step(0.35, h.x) * flick * (1.0 + env * step(0.6, h.y) * 0.8) * (0.2 + fk * 0.08) * (0.7 + c.level * 0.5);
  }
  return col;
}
vec4 modeLayer(Ctx c) {
  float env = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    env += exp(-age * 2.0);
  }
  vec3 bg = m069_bokeh(c.p, c, env);
  float s = 0.035;
  vec2 q = c.p / s;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = hash2(id + 3.0);
  vec2 o = (h - 0.5) * 0.5;
  float R = (0.08 + 0.17 * hash(id + 7.0)) * s;
  vec2 ctr = (id + 0.5 + o) * s;
  float m = smoothstep(1.0, 0.85, length(c.p - ctr) / R) * step(0.45, h.x);
  float cw = 0.06;
  float col0 = floor(c.p.x / cw);
  float hc = hash(vec2(col0, 5.0));
  float dropY = 1.2 - fract(c.star * (0.03 + 0.06 * hash(vec2(col0, 6.0))) + hc * 7.0) * 1.5;
  float dropX = (col0 + 0.5) * cw + (noise(vec2(col0 * 3.0, c.uv.y * 6.0)) - 0.5) * cw * 0.5;
  float R2 = 0.009 + 0.004 * hash(vec2(col0, 8.0));
  vec2 ctr2 = vec2((col0 + 0.5) * cw + (noise(vec2(col0 * 3.0, dropY * 6.0)) - 0.5) * cw * 0.5, dropY);
  vec2 dv = (c.p - ctr2) * vec2(1.0, 0.8);
  float m2 = smoothstep(1.0, 0.85, length(dv) / R2) * step(0.55, hc);
  float trail = line(c.p.x - dropX, 0.0018) * step(dropY, c.uv.y) * exp(-(c.uv.y - dropY) * 5.0) * step(0.55, hc);
  if (m2 > m) { m = m2; ctr = ctr2; R = R2; }
  vec2 rel = (c.p - ctr) / R;
  vec3 refr = bg;
  if (m > 0.001) refr = m069_bokeh(ctr - (c.p - ctr) * 6.0 + vec2(0.0, 0.08), c, env);
  float rim = smoothstep(0.55, 1.0, length(rel)) * m;
  float spec = line(length(rel - vec2(-0.35, 0.4)), 0.2) * m;
  vec3 col = mix(bg, refr * 1.7, m) + bg * trail * 0.9;
  col += mix(c.c2, vec3(1.0), 0.4) * rim * 0.06 + mix(c.c1, vec3(1.0), 0.6) * spec * (0.2 + c.high * 0.3);
  return vec4(col, 0.35 + m * 0.12);
}
`,
  }
);
