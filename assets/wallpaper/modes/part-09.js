(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "090-bloom",
    name: "Цветок баса",
    glsl: `
float m090_kick(Ctx c) {
  float k = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    k += exp(-age * 3.5);
  }
  return min(k, 1.5);
}
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = length(d), a = atan(d.y, d.x);
  float kick = m090_kick(c);
  vec3 col = vec3(0.0);
  float shade = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float n = 5.0 + fk * 2.0;
    float rot = (noise(vec2(c.t * 0.045, fk * 7.3)) - 0.5) * 3.0 + c.star * 0.015 * (fk - 1.0);
    float R = c.coverR * (1.35 + fk * 0.6) * (1.0 + c.bass * (0.42 - fk * 0.1) + kick * (0.1 - fk * 0.025));
    float ph = (a + rot) * n * 0.5;
    float pet = pow(abs(cos(ph)), 0.7 + fk * 0.35);
    float rf = mix(c.coverR * 1.05, R, pet);
    float dd = r - rf;
    float edge = exp(-pow(dd / (1.5 * c.px + 0.0015), 2.0)) * 0.7 + exp(-pow(dd / 0.025, 2.0)) * 0.22;
    float s = clamp((r - c.coverR) / max(rf - c.coverR, 0.001), 0.0, 1.0);
    float inside = step(dd, 0.0) * s * s;
    float vein = exp(-pow(sin(ph) * r / (1.2 * c.px + 0.001), 2.0)) * inside * 0.35;
    vec3 tint = palette3(c.c1, c.c2, c.c3, fk * 0.31 + r * 0.35 + noise(vec2(c.t * 0.03, fk)) * 0.4);
    float lift = (0.55 + c.level * 0.35 + kick * 0.25) * (1.0 - fk * 0.18);
    col += mix(tint, vec3(1.0), 0.12 + kick * 0.08) * (edge + vein * (0.6 + c.high)) * lift;
    col += tint * inside * 0.16 * lift;
    shade = max(shade, inside * 0.25);
  }
  col *= smoothstep(c.coverR * 0.95, c.coverR * 1.15, r);
  return vec4(col * 0.7, shade);
}
`,
  },
  {
    id: "091-wake",
    name: "Круги от обложки",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 cn = vec2(clamp(c.cc.x, 0.0, c.aspect), clamp(c.cc.y, 0.0, 1.0));
  float reach = length(max(cn, vec2(c.aspect, 1.0) - cn)) + 0.15;
  float flow = (c.dc - c.coverR) * 0.55 - c.t * 0.035 + (noise(c.p * 1.3 + c.t * 0.05) - 0.5) * 0.25;
  vec3 grad = palette3(c.c1, c.c2, c.c3, flow);
  vec3 tint = mix(grad, palette3(c.c1, c.c2, c.c3, flow + 0.33), 0.35);
  vec3 col = vec3(0.0);
  float wake = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 9.0) continue;
    float r = c.coverR + age * 0.26 + age * age * 0.075;
    float gone = 1.0 - smoothstep(reach - 0.1, reach + 0.1, r);
    float born = smoothstep(0.0, 0.12, age);
    float spread = 1.0 / (1.0 + age * 0.35);
    float behind = c.dc < r ? exp(-(r - c.dc) / (0.06 + age * 0.05)) : 0.0;
    float ln = ring(c.dc, r, 1.8 * c.px + age * 0.0008) * (0.7 + c.high * 0.5) + ring(c.dc, r, 0.02 + age * 0.012) * 0.35 * spread;
    col += mix(tint, vec3(1.0), 0.15) * ln * gone * born;
    wake += behind * gone * born * 0.16 * spread;
  }
  col += grad * min(wake, 0.6) * (0.7 + c.level * 0.4);
  col += c.c1 * smoothstep(c.coverR * (1.8 + c.bass * 0.8), c.coverR, c.dc) * 0.25 * c.bass;
  col *= smoothstep(c.coverR * 0.9, c.coverR * 1.05, c.dc);
  return vec4(col * 0.65, 0.0);
}
`,
  },
  {
    id: "092-drops",
    name: "Всплески",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float hgt = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 8.0) continue;
    vec2 hp = hash2(vec2(uBeats[i] * 1.37, 4.1));
    vec2 ctr = vec2((0.08 + hp.x * 0.84) * c.aspect, 0.1 + hp.y * 0.8);
    float d = length(c.p - ctr);
    float r = age * 0.3;
    float x = d - r;
    float env = exp(-x * x / (0.004 + age * 0.006)) * step(x, 0.05);
    float amp = exp(-age * 1.0) * (0.6 + 0.4 * hash(hp)) / (1.0 + r * 4.0);
    float wave = cos(x * (70.0 - age * 6.0)) * env * amp;
    hgt += wave;
    vec3 tint = palette3(c.c1, c.c2, c.c3, hash(hp + 2.3));
    col += mix(tint, vec3(1.0), 0.3) * max(wave, 0.0) * (0.9 + c.high * 0.8);
    col += tint * exp(-d * d / 0.0006) * exp(-age * 5.0) * 0.6;
  }
  float sheen = noise(c.p * 5.0 + vec2(c.t * 0.07, -c.t * 0.05)) * noise(c.p * 9.0 - c.t * 0.06);
  col += mix(c.c2, c.c3, sheen) * pow(sheen, 2.0) * (0.12 + c.bass * 0.18);
  col += mix(c.c1, vec3(1.0), 0.5) * pow(max(hgt, 0.0), 2.0) * 0.6;
  return vec4(col * 0.75, 0.12 - clamp(hgt, -0.1, 0.1) * 0.6);
}
`,
  },
  {
    id: "093-pulse",
    name: "Линия пульса",
    glsl: `
vec2 m093_g(float dx, float w, float a) { float e = a * exp(-dx * dx / (w * w)); return vec2(e, -2.0 * dx / (w * w) * e); }
vec4 modeLayer(Ctx c) {
  float pen = c.aspect * 0.9;
  float y0 = 0.3;
  float x = c.p.x;
  float speed = 0.36;
  float wig = 0.004 + c.high * 0.018;
  float xs = -10.0, A = 0.0, best = 1.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 10.0) continue;
    float xi = pen - age * speed;
    if (abs(x - xi) < best) { best = abs(x - xi); xs = xi; A = (0.6 + 0.6 * hash(vec2(uBeats[i], 1.7))) * (0.8 + c.bass * 0.5); }
  }
  float n0 = (noise(vec2((x + c.t * speed) * 9.0, 1.0)) - 0.5) * wig;
  float ns = ((noise(vec2((x + 0.01 + c.t * speed) * 9.0, 1.0)) - 0.5) * wig - n0) / 0.01;
  vec2 prev = vec2(0.0);
  float dmin = 1.0;
  float f = 0.0;
  for (int j = 0; j < 13; j++) {
    float xj = x + (float(j) - 6.0) * 0.0028;
    float dx = xj - xs;
    float yj = n0 + (xj - x) * ns;
    if (abs(dx) < 0.12) yj += A * (m093_g(dx + 0.05, 0.016, 0.018).x + m093_g(dx + 0.009, 0.004, -0.03).x + m093_g(dx, 0.0055, 0.17).x + m093_g(dx - 0.011, 0.005, -0.06).x + m093_g(dx - 0.065, 0.02, 0.035).x);
    vec2 cur = vec2(xj, yj);
    if (j == 6) f = yj;
    if (j > 0) {
      vec2 ab = cur - prev, ap = vec2(x, c.uv.y - y0) - prev;
      float h = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
      dmin = min(dmin, length(ap - ab * h));
    }
    prev = cur;
  }
  float dy = min(dmin, abs(c.uv.y - y0 - f));
  float drawn = step(x, pen) * smoothstep(0.0, pen * 0.8, x);
  float lw = 1.6 * c.px;
  float l = exp(-dy * dy / (lw * lw)) + exp(-dy * dy / (36.0 * lw * lw)) * 0.3 + exp(-abs(dy) / 0.05) * 0.08;
  vec3 tint = palette3(c.c1, c.c2, c.c3, x * 0.25 - c.t * 0.02);
  vec3 col = mix(tint, vec3(1.0), 0.2) * l * drawn * (0.6 + c.level * 0.4);
  vec2 hd = vec2(x - pen, c.uv.y - y0 - f);
  col += mix(c.c1, vec3(1.0), 0.5) * exp(-dot(hd, hd) / 0.00012) * (0.6 + c.bass * 0.6);
  col += c.c2 * exp(-dot(hd, hd) / 0.01) * 0.15 * c.level;
  vec2 g = abs(fract(c.p * vec2(16.0)) - 0.5) / 16.0;
  float grid = (exp(-g.x * g.x / (c.px * c.px)) + exp(-g.y * g.y / (c.px * c.px))) * exp(-abs(c.uv.y - y0) * 7.0);
  col += c.c3 * grid * (0.04 + c.high * 0.05);
  return vec4(col, exp(-abs(c.uv.y - y0) * 6.0) * 0.18);
}
`,
  },
  {
    id: "094-orbits",
    name: "Орбиты",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float kick = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    kick += exp(-age * 4.0);
  }
  kick = min(kick, 1.4);
  vec2 d0 = c.p - c.cc;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float h = hash(vec2(fk, 9.1));
    float tilt = h * PI + (noise(vec2(c.t * 0.03, fk * 3.1)) - 0.5) * 0.8;
    float ct = cos(tilt), st = sin(tilt);
    float flt = 0.35 + 0.3 * hash(vec2(fk, 2.2));
    float R = c.coverR * (1.45 + fk * 0.42) * (1.0 + c.bass * 0.12 * (1.0 - fk * 0.1) + kick * 0.04);
    vec2 q = vec2(ct * d0.x + st * d0.y, -st * d0.x + ct * d0.y);
    vec2 qe = vec2(q.x, q.y / flt);
    float rr = length(qe);
    float ang = atan(qe.y, qe.x) / TAU;
    float N = 2.0 + floor(h * 4.0) + fk;
    float dir = h < 0.5 ? 1.0 : -1.0;
    float phase = c.star * (0.03 + 0.05 * hash(vec2(fk, 5.5))) * dir / (1.0 + fk * 0.25);
    float u = ang * N - phase * N;
    float cell = floor(u + 0.5);
    float th = (cell / N + phase) * TAU;
    vec2 dp = vec2(cos(th) * R, sin(th) * R * flt);
    dp = vec2(ct * dp.x - st * dp.y, st * dp.x + ct * dp.y);
    float dd = length(d0 - dp);
    float size = 0.004 + c.high * 0.004 + kick * 0.003;
    float dotv = exp(-dd * dd / (size * size)) + exp(-dd * dd / (size * size * 16.0)) * 0.25;
    float loc = (u - cell) * dir;
    float tlen = 0.18 + c.level * 0.3;
    float tail = step(loc, 0.0) * exp(loc / tlen * 3.0) * smoothstep(-0.5, -0.4, loc);
    float band = exp(-pow((rr - R) / (1.4 * c.px + size * 0.4), 2.0));
    float orbit = exp(-pow((rr - R) / (1.2 * c.px), 2.0)) * 0.12;
    vec3 tint = palette3(c.c1, c.c2, c.c3, h + fk * 0.13);
    col += mix(tint, vec3(1.0), 0.35) * dotv * (0.9 + kick * 0.5);
    col += tint * (band * tail * (0.45 + c.level * 0.3) + orbit * (0.6 + kick));
  }
  col *= smoothstep(c.coverR * 0.95, c.coverR * 1.15, length(d0));
  return vec4(col * 0.8, 0.0);
}
`,
  },
  {
    id: "095-breath",
    name: "Дыхание",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float dark = 0.0;
  vec3 kick = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    vec3 ag = vec3(age) - vec3(0.0, 0.1, 0.2);
    kick += exp(-max(ag, 0.0) * 3.0) * step(vec3(0.0), ag);
  }
  kick = min(kick, vec3(1.3));
  for (int s = 0; s < 3; s++) {
    float fs = float(s);
    vec2 pos = vec2(c.aspect * (0.15 + 0.7 * noise(vec2(c.t * 0.025 + fs * 11.0, 1.3))), 0.2 + 0.6 * noise(vec2(c.t * 0.022 + fs * 5.0, 7.1)));
    vec2 d = c.p - pos;
    float r = length(d);
    vec2 dir = d / max(r, 0.0001);
    float R = (0.14 + 0.05 * fs) * (1.0 + c.level * 0.25);
    float wob = noise(dir * 1.6 + vec2(c.t * 0.12, fs * 4.0)) - 0.5;
    float wob2 = noise(dir * 3.2 - vec2(c.t * 0.09, fs * 2.0)) - 0.5;
    vec3 tint = palette3(c.c1, c.c2, c.c3, fs * 0.33 + noise(vec2(c.t * 0.02, fs)) * 0.5);
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float kj = j == 0 ? kick.x : (j == 1 ? kick.y : kick.z);
      float rj = R * (0.4 + fj * 0.3) * (1.0 + kj * 0.14 + c.bass * 0.1) * (1.0 + wob * (0.25 + fj * 0.08) + wob2 * 0.1);
      float dd = r - rj;
      float l = exp(-dd * dd / pow(1.4 * c.px + 0.001, 2.0)) * 0.6 + exp(-dd * dd / 0.0007) * 0.15;
      col += mix(tint, vec3(1.0), 0.1 + kj * 0.1) * l * (0.5 + kj * 0.4 + c.high * 0.2) * (1.0 - fj * 0.12);
    }
    float outer = R * 1.01 * (1.0 + wob * 0.49 + wob2 * 0.1);
    float inside = smoothstep(outer, outer * 0.2, r);
    col += tint * inside * (0.1 + c.bass * 0.1);
    dark = max(dark, inside * 0.3);
  }
  return vec4(col * 0.75, dark);
}
`,
  },
  {
    id: "096-shock",
    name: "Волна давления",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  vec2 dir = d / max(c.dc, 0.0001);
  float disp = 0.0, comp = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    float r = c.coverR + age * 0.55;
    float w = 0.05 + age * 0.03;
    float x = (c.dc - r) / w;
    float a = exp(-age * 0.55) * (0.5 + 0.5 * c.bass);
    float g = exp(-x * x);
    disp += -x * g * a * 0.035;
    comp += g * a;
  }
  vec2 drift = vec2(noise(c.p * 1.5 + c.t * 0.07), noise(c.p * 1.5 - c.t * 0.06 + 3.0)) - 0.5;
  vec2 q = c.p - dir * disp + drift * (0.01 + c.bass * 0.012);
  float sp = 0.032;
  vec2 cell = floor(q / sp);
  vec2 g = fract(q / sp) - 0.5;
  float tw = noise(cell * 0.7 + c.t * 0.4);
  float size = 0.1 + comp * 0.12 + c.high * 0.06 * tw;
  float dotv = exp(-dot(g, g) / (size * size));
  vec3 tint = palette3(c.c1, c.c2, c.c3, (c.dc - c.coverR) * 0.5 - c.t * 0.03);
  vec3 col = mix(tint, vec3(1.0), 0.2 + comp * 0.2) * dotv * (0.22 + comp * 0.6 + c.level * 0.1);
  col += tint * comp * 0.12;
  col *= smoothstep(c.coverR * 0.95, c.coverR * 1.2, c.dc);
  return vec4(col, 0.1);
}
`,
  },
  {
    id: "097-petals",
    name: "Лепестки",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float kick = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    kick += exp(-age * 3.0);
  }
  kick = min(kick, 1.4);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 5.0 + fl * 3.0;
    vec2 p = c.p * sc;
    p.y += c.t * (0.25 + fl * 0.08) + c.star * 0.12;
    p.x += sin(p.y * 0.4 + fl) * 0.3 + (noise(vec2(p.y * 0.2, fl * 5.0 + c.t * 0.1)) - 0.5) * 1.2;
    vec2 cell = floor(p);
    vec2 h = hash2(cell + fl * 31.0);
    if (h.x < 0.35) continue;
    vec2 ctr = cell + 0.5 + (hash2(cell + 7.0 + fl) - 0.5) * 0.4;
    vec2 q = p - ctr;
    float ang = h.y * TAU + c.t * (h.x - 0.65) * 1.6 + noise(cell + c.t * 0.2) * 2.0;
    float ca = cos(ang), sa = sin(ang);
    q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    float flip = 0.35 + 0.65 * abs(sin(c.t * (0.4 + h.x * 0.6) + h.y * 9.0));
    q.y /= flip;
    float size = (0.2 + 0.07 * hash(cell + 3.3)) * (1.0 + c.bass * 0.2);
    q /= size;
    float o = 0.55;
    float v = max(length(q - vec2(0.0, -o)), length(q + vec2(0.0, -o))) - 1.0;
    float body = smoothstep(0.08, -0.08, v);
    float rim = exp(-pow(v / 0.12, 2.0));
    float vein = exp(-pow(q.y / 0.05, 2.0)) * body;
    vec3 tint = palette3(c.c1, c.c2, c.c3, hash(cell + 11.0 + fl));
    float depth = 1.0 - fl * 0.25;
    float lit = 0.5 + 0.5 * q.x;
    col += tint * body * (0.22 + 0.25 * lit) * depth * (0.8 + kick * 0.3);
    col += mix(tint, vec3(1.0), 0.4) * (rim * 0.25 + vein * 0.2) * depth * (0.6 + c.high * 0.6 + kick * 0.3) * flip;
  }
  return vec4(col * 0.75, 0.05);
}
`,
  },
  {
    id: "098-string",
    name: "Струна-кольцо",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = c.dc;
  float a = atan(d.y, d.x);
  vec2 dir = d / max(r, 0.0001);
  vec3 col = vec3(0.0);
  vec2 wave = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 7.0) continue;
    float a0 = hash(vec2(uBeats[i], 3.3)) * TAU;
    float travel = age * 0.9;
    float w = 0.3 + age * 0.15;
    float amp = exp(-age * 0.75) * (0.6 + c.bass * 0.6);
    vec2 da = mod(vec2(a - a0 - travel, a - a0 + travel) + PI, TAU) - PI;
    vec2 e = exp(-da * da / (w * w)) * amp;
    wave += vec2(e.x * cos(da.x * 18.0) + e.y * cos(da.y * 18.0), e.x * cos(da.x * 11.0 + 1.0) + e.y * cos(da.y * 11.0 + 1.0));
  }
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float R = c.coverR * (1.6 + fk * 0.7) * (1.0 + c.bass * 0.06);
    float disp = (noise(dir * (4.0 + fk * 2.0) + vec2(c.t * 0.3, fk * 3.0)) - 0.5) * (0.004 + c.high * 0.012);
    disp += (k == 1 ? wave.y : wave.x) * (0.035 - fk * 0.006);
    float dd = r - R - disp;
    float lw = 1.5 * c.px + abs(disp) * 0.08;
    float l = exp(-dd * dd / (lw * lw)) + exp(-dd * dd / 0.0006) * 0.2 * (1.0 + abs(disp) * 20.0);
    vec3 tint = palette3(c.c1, c.c2, c.c3, fk * 0.33 + dir.x * 0.2 + dir.y * 0.12 + noise(vec2(c.t * 0.03, fk)) * 0.4);
    col += mix(tint, vec3(1.0), 0.15 + min(abs(disp) * 10.0, 0.4)) * l * (0.5 + c.level * 0.3 + min(abs(disp) * 15.0, 0.6)) * (1.0 - fk * 0.2);
  }
  return vec4(col * 0.8, 0.0);
}
`,
  },
  {
    id: "099-chladni",
    name: "Песок Хладни",
    glsl: `
vec4 modeLayer(Ctx c) {
  float kick = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    kick += exp(-age * 2.5);
  }
  kick = min(kick, 1.5);
  vec2 q = (c.p - c.cc) * 1.6;
  vec2 jit = (hash2(floor(c.p / c.px) + floor(c.t * 30.0)) - 0.5) * kick * 0.012;
  q += jit;
  float n = 2.0 + 4.0 * noise(vec2(c.t * 0.018, 1.7));
  float m = 3.0 + 4.0 * noise(vec2(c.t * 0.015, 8.3));
  float f = cos(n * PI * q.x) * cos(m * PI * q.y) - cos(m * PI * q.x) * cos(n * PI * q.y);
  float f2 = cos((n + 1.0) * PI * q.x) * cos((m - 1.0) * PI * q.y) - cos((m - 1.0) * PI * q.x) * cos((n + 1.0) * PI * q.y);
  f = mix(f, f2, 0.3 + 0.2 * c.mid);
  float w = 0.05 + 0.05 * c.bass + kick * 0.05;
  float node = exp(-f * f / (w * w));
  float grain = step(0.55 - c.level * 0.15, hash(floor(c.p / (c.px * 1.5))));
  float tw = 0.7 + 0.6 * noise(floor(c.p / (c.px * 1.5)) * 0.37 + c.t * 2.0) * c.high;
  vec3 tint = palette3(c.c1, c.c2, c.c3, length(q) * 0.3 - c.t * 0.02);
  float fade = smoothstep(1.6, 0.3, length(q) * 0.7) * smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  vec3 col = mix(tint, vec3(1.0), 0.25) * node * grain * tw * 0.55 * fade;
  col += tint * node * 0.08 * fade;
  return vec4(col, 0.15 * fade);
}
`,
  }
);
