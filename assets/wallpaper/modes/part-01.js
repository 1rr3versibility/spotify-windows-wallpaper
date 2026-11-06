(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "010-honeycomb",
    name: "Соты",
    glsl: `
vec4 m010_hex(vec2 q) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(q, r) - h;
  vec2 b = mod(q - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, q - gv);
}
float m010_hexd(vec2 g) {
  g = abs(g);
  return max(dot(g, vec2(0.5, 0.8660254)), g.x);
}
vec4 modeLayer(Ctx c) {
  float s = 13.0;
  vec4 h = m010_hex((c.p - c.cc) * s);
  vec2 cellC = c.cc + h.zw / s;
  float dcell = length(cellC - c.cc);
  float e = m010_hexd(h.xy);
  float edge = 0.5 - e;
  float lw = 1.3 * c.px * s + c.bass * 0.025;
  float lineA = exp(-edge * edge / (lw * lw));
  float hc = hash(h.zw + 0.37);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float fade = (1.0 - smoothstep(reach * 0.85, reach * 1.08, R)) * (0.55 + 0.45 * exp(-age * 0.4));
    float x = (dcell - R) / (0.05 + age * 0.012);
    wave += exp(-x * x) * fade;
  }
  wave = min(wave, 1.4);
  float idle = smoothstep(0.58, 0.92, noise(h.zw * 0.33 + vec2(c.t * 0.13, -c.t * 0.09))) * (0.35 + c.mid * 0.6);
  float spark = pow(hash(h.zw + floor(c.star * 0.7) * 0.1), 30.0) * c.high;
  float fill = wave * (0.45 + 0.55 * hc) + idle + spark * 1.5;
  vec3 tint = palette3(c.c1, c.c2, c.c3, dcell * 0.75 + hc * 0.12);
  float inside = smoothstep(0.5, 0.32, e) * (0.55 + 0.45 * (1.0 - e * 2.0));
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  vec3 col = tint * fill * inside * 0.32 + mix(tint, vec3(1.0), 0.35) * lineA * (0.05 + wave * 0.3 + c.high * 0.07);
  return vec4(col * clear, 0.12 * clear);
}
`,
  },
  {
    id: "011-kaleidoscope",
    name: "Калейдоскоп",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = length(d);
  float seg = TAU / 10.0;
  float a = atan(d.y, d.x) + c.star * 0.012 + (noise(vec2(c.t * 0.035, 3.7)) - 0.5) * 2.2;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 k = vec2(cos(a), sin(a)) * r;
  vec2 q = k * (3.2 - c.bass * 0.45) + vec2(-c.t * 0.05, c.t * 0.021);
  float v = fbm(q + vec2(fbm(q * 0.7 + c.t * 0.02), 0.0) * 0.8);
  float bands = v * 9.0 + r * 2.0;
  float bi = floor(bands);
  float fb = fract(bands);
  float dl = min(fb, 1.0 - fb);
  float lw = 0.045 + c.high * 0.03;
  float lineA = exp(-dl * dl / (lw * lw));
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (r - R) / (0.07 + age * 0.015);
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.3);
  float shade = 0.35 + 0.65 * hash(vec2(bi, 1.7));
  vec3 tint = palette3(c.c1, c.c2, c.c3, bi * 0.11 + r * 0.5);
  float mask = smoothstep(c.coverR * 0.95, c.coverR * 1.35, r) * (1.0 - smoothstep(0.55, 1.25, r) * 0.75);
  float rib = exp(-pow(a / (0.006 + 1.2 * c.px / max(r, 0.05)), 2.0)) * 0.6;
  vec3 col = tint * shade * (0.13 + c.level * 0.1 + wave * 0.22) + mix(tint, vec3(1.0), 0.4) * (lineA * (0.16 + wave * 0.3) + rib * (0.06 + c.high * 0.12));
  return vec4(col * mask, 0.22 * mask);
}
`,
  },
  {
    id: "012-polygons",
    name: "Многоугольники",
    glsl: `
float m012_poly(float r, float ang, float n, float rot) {
  float seg = TAU / n;
  float a = ang + rot;
  return r * cos(a - floor(a / seg + 0.5) * seg);
}
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = c.dc;
  float ang = atan(d.y, d.x);
  float vw = 1.0 / pow(0.006 + c.high * 0.006, 2.0);
  vec3 col = vec3(0.0);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R0 = c.coverR * 1.05 + age * 0.3 + age * age * 0.03;
    if (R0 - 0.32 > r || R0 > r * 2.0 + 0.1) continue;
    float birth = uBeats[i];
    float h = hash(vec2(birth * 0.731, 1.3));
    float n = 3.0 + floor(h * 4.0);
    float rot = hash(vec2(birth * 0.377, 4.1)) * TAU + age * (h - 0.5) * 0.7;
    float R = c.coverR * 1.05 + age * 0.3 + age * age * 0.03;
    float pd = m012_poly(r, ang, n, rot);
    float fade = (1.0 - smoothstep(reach * 0.85, reach * 1.08, R)) * (0.6 + 0.4 * exp(-age * 0.35));
    float seg = TAU / n;
    float va = (floor((ang + rot) / seg) + 0.5) * seg - rot;
    vec2 vp = vec2(cos(va), sin(va)) * R / cos(seg * 0.5);
    float vtx = exp(-dot(d - vp, d - vp) * vw);
    vec3 tint = palette3(c.c1, c.c2, c.c3, (R - c.coverR) * 0.75 + h * 0.08);
    float edge = ring(pd, R, 1.8 * c.px) + ring(pd, R, 0.022 + age * 0.006) * 0.4;
    float body = smoothstep(R, R - 0.12, pd) * smoothstep(R - 0.3, R - 0.12, pd) * 0.06;
    col += mix(tint, vec3(1.0), 0.2) * (edge + body + vtx * 0.9) * fade;
  }
  col *= 0.6;
  float idle = ring(m012_poly(r, ang, 6.0, c.star * 0.02), c.coverR * (1.12 + c.bass * 0.18), 1.6 * c.px) * (0.15 + c.bass * 0.3);
  col += mix(c.c1, c.c2, 0.5) * idle;
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "013-flower-of-life",
    name: "Цветок жизни",
    glsl: `
vec4 modeLayer(Ctx c) {
  float s = 0.095 * (1.0 + c.bass * 0.07);
  float ang = (noise(vec2(c.t * 0.03, 8.1)) - 0.5) * 1.6;
  float ca = cos(ang), sa = sin(ang);
  vec2 d = c.p - c.cc;
  vec2 q = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) / s;
  float j0 = q.y / 0.8660254;
  float i0 = q.x - 0.5 * j0;
  vec2 base = floor(vec2(i0, j0));
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float w = 1.4 * c.px / s + c.high * 0.01;
  float wave = 0.0;
  for (int k = 0; k < 8; k++) {
    float age = c.t - uBeats[k];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float y = (c.dc - R) / 0.09;
    wave += exp(-y * y) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.0);
  float drift = smoothstep(0.5, 0.85, noise(q * 0.4 + vec2(c.t * 0.1, -c.t * 0.07))) * 0.5;
  vec3 col = vec3(0.0);
  float lsum = 0.0;
  for (int di = -1; di <= 2; di++) {
    for (int dj = -1; dj <= 2; dj++) {
      if (di == dj && (di == -1 || di == 2)) continue;
      vec2 ij = base + vec2(float(di), float(dj));
      vec2 cp = vec2(ij.x + 0.5 * ij.y, ij.y * 0.8660254);
      float cd = length(cp) * s;
      float x = (length(q - cp) - 1.0) / w;
      float l = exp(-x * x);
      float core = 1.0 - smoothstep(s * 1.5, s * (4.5 + c.level * 2.0), cd);
      lsum += l * (core * 0.22 + drift * 0.12 + wave * 0.4);
    }
  }
  col = mix(palette3(c.c1, c.c2, c.c3, c.dc * 0.8 + 0.05), vec3(1.0), 0.25) * (1.0 - exp(-lsum * 2.2)) / 2.2 * 1.3;
  float big = ring(length(q), 3.0 + c.bass * 0.15, w) * 0.35 + ring(length(q), 3.0, w * 6.0) * 0.08;
  col += mix(c.c2, vec3(1.0), 0.3) * big;
  col *= smoothstep(c.coverR * 0.9, c.coverR * 1.15, c.dc) * 0.5 + 0.5;
  return vec4(col, 0.05);
}
`,
  },
  {
    id: "014-facets",
    name: "Грани",
    glsl: `
vec4 modeLayer(Ctx c) {
  float sc = 8.5;
  vec2 q = c.p * sc + vec2(c.t * 0.05, c.t * 0.017);
  float j = q.y / 0.8660254;
  float i = q.x - 0.5 * j;
  vec2 cell = floor(vec2(i, j));
  vec2 f = fract(vec2(i, j));
  float up = step(1.0, f.x + f.y);
  float ed = up < 0.5 ? min(min(f.x, f.y), 1.0 - f.x - f.y) : min(min(1.0 - f.x, 1.0 - f.y), f.x + f.y - 1.0);
  ed *= 0.8660254;
  vec2 id = cell * 2.0 + vec2(up, 0.0);
  vec2 ctr = cell + (up < 0.5 ? vec2(1.0 / 3.0) : vec2(2.0 / 3.0));
  vec2 cpos = (vec2(ctr.x + 0.5 * ctr.y, ctr.y * 0.8660254) - vec2(c.t * 0.05, c.t * 0.017)) / sc;
  float dcell = length(cpos - c.cc);
  float hc = hash(id + 0.19);
  float n = noise(cell * 0.23 + up * 0.37 + vec2(c.t * 0.07, -c.t * 0.05));
  float lit = smoothstep(0.48, 0.85, n);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int k = 0; k < 8; k++) {
    float age = c.t - uBeats[k];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (dcell - R) / (0.06 + age * 0.012);
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R)) * (0.5 + 0.5 * hc);
  }
  wave = min(wave, 1.2);
  float gap = 0.03 + c.bass * 0.03;
  float inside = smoothstep(gap, gap + 0.025, ed);
  float bevel = smoothstep(gap, 0.29, ed);
  float spark = pow(noise(id * 1.7 + c.star * 0.9), 10.0) * c.high * 3.0;
  vec3 tint = palette3(c.c1, c.c2, c.c3, hc * 0.35 + dcell * 0.6);
  float light = 0.55 + 0.45 * (up < 0.5 ? 1.0 : 0.6) * (0.5 + 0.5 * sin(hc * 6.0));
  float amt = (lit * (0.16 + c.level * 0.1) + wave * 0.32 + spark) * light;
  vec3 col = tint * amt * inside * (0.55 + 0.45 * bevel) + mix(tint, vec3(1.0), 0.5) * exp(-pow((ed - gap - 0.012) / 0.012, 2.0)) * (lit * 0.12 + wave * 0.25);
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  return vec4(col * clear, (0.14 + lit * 0.08) * clear);
}
`,
  },
  {
    id: "015-mandala",
    name: "Мандала",
    glsl: `
float m015_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = length(d);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (r - R) / 0.1;
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.0);
  float dw = 1.0 / pow(0.007 + c.high * 0.008, 2.0);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float n = 5.0 + fk;
    float rk = c.coverR * (1.35 + fk * 0.5) * (1.0 + c.bass * 0.04 * (fk + 1.0));
    if (r > rk * 1.25 || r < rk * 0.3) continue;
    float dir = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
    float rot = dir * c.star * (0.01 + fk * 0.004) + (noise(vec2(c.t * 0.04, fk * 5.3)) - 0.5) * 1.4;
    float step2 = 2.0 + floor(fk * 0.5);
    float dl = 10.0, dv = 10.0;
    for (int j = 0; j < 8; j++) {
      if (float(j) >= n) break;
      float a0 = rot + float(j) * TAU / n;
      float a1 = a0 + step2 * TAU / n;
      vec2 v0 = vec2(cos(a0), sin(a0)) * rk;
      dl = min(dl, m015_seg(d, v0, vec2(cos(a1), sin(a1)) * rk));
      dv = min(dv, length(d - v0));
    }
    vec3 tint = palette3(c.c1, c.c2, c.c3, (rk - c.coverR) * 0.75 + 0.05);
    float lw = 1.5 * c.px;
    float lines = exp(-dl * dl / (lw * lw)) + exp(-dl * dl / (lw * lw * 16.0)) * 0.3;
    float circ = ring(r, rk, lw) * 0.6;
    float dots = exp(-dv * dv * dw);
    col += mix(tint, vec3(1.0), 0.25) * ((lines + circ) * (0.22 + wave * 0.5) + dots * (0.4 + wave * 0.5));
  }
  return vec4(col * 0.8, 0.0);
}
`,
  },
  {
    id: "016-crystals",
    name: "Кристаллы",
    glsl: `
vec2 m016_seed(vec2 id, float t) {
  vec2 h = hash2(id);
  vec2 k = hash2(id + 17.3);
  return 0.5 + 0.36 * vec2(sin(h.x * TAU + t * (0.11 + k.x * 0.17)), sin(h.y * TAU + t * (0.09 + k.y * 0.19)) * cos(k.x * 3.0 + t * 0.05 * k.y));
}
vec4 modeLayer(Ctx c) {
  float sc = 5.0;
  vec2 q = c.p * sc;
  vec2 ip = floor(q), fp = fract(q);
  float md = 10.0;
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 rr = g + m016_seed(ip + g, c.t) - fp;
      float dd = dot(rr, rr);
      if (dd < md) { md = dd; mr = rr; mg = g; }
    }
  }
  float ed = 10.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = mg + vec2(float(x), float(y));
      vec2 rr = g + m016_seed(ip + g, c.t) - fp;
      vec2 dr = rr - mr;
      if (dot(dr, dr) > 0.00001) ed = min(ed, dot(0.5 * (mr + rr), normalize(dr)));
    }
  }
  vec2 cid = ip + mg;
  float hc = hash(cid + 0.71);
  vec2 seedP = (cid + m016_seed(cid, c.t)) / sc;
  float dcell = length(seedP - c.cc);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (dcell - R) / (0.08 + age * 0.015);
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.2);
  vec3 tint = palette3(c.c1, c.c2, c.c3, dcell * 0.7 + hc * 0.2);
  float facet = 0.5 + 0.5 * dot(normalize(mr + 0.0001), normalize(vec2(cos(hc * TAU), sin(hc * TAU))));
  float body = (0.08 + c.level * 0.06 + wave * 0.3) * (0.4 + 0.6 * facet) * (0.4 + 0.6 * hc);
  float lw = 1.4 * c.px * sc + c.bass * 0.015;
  float edge = exp(-ed * ed / (lw * lw)) * (0.18 + wave * 0.35 + c.high * 0.12) + exp(-ed * ed / (lw * lw * 25.0)) * 0.06;
  float seedDot = exp(-md / pow(0.025 + c.high * 0.03, 2.0)) * (0.2 + wave * 0.5);
  vec3 col = tint * body + mix(tint, vec3(1.0), 0.4) * (edge + seedDot);
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  return vec4(col * clear, 0.18 * clear);
}
`,
  },
  {
    id: "017-truchet",
    name: "Трюше",
    glsl: `
float m017_arc(vec2 f, float w) {
  vec2 g = vec2(mix(f.x, 1.0 - f.x, w), f.y);
  return min(abs(length(g) - 0.5), abs(length(g - 1.0) - 0.5));
}
vec4 modeLayer(Ctx c) {
  float sc = 9.0;
  vec2 q = c.p * sc + vec2(noise(vec2(c.t * 0.02, 2.0)) * 3.0, c.t * 0.04);
  vec2 id = floor(q), f = fract(q);
  float hc = hash(id + 0.3);
  float flip = smoothstep(0.42, 0.58, noise(id * 0.37 + vec2(c.t * 0.06, hc * 3.0)));
  float d0 = m017_arc(f, 0.0), d1 = m017_arc(f, 1.0);
  float lw = 1.4 * c.px * sc + 0.012 + c.bass * 0.04;
  float l = mix(exp(-d0 * d0 / (lw * lw)), exp(-d1 * d1 / (lw * lw)), flip);
  float halo = mix(exp(-d0 * d0 / (lw * lw * 20.0)), exp(-d1 * d1 / (lw * lw * 20.0)), flip);
  vec2 cpos = c.p;
  float dcell = length(cpos - c.cc);
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (dcell - R) / (0.05 + age * 0.012);
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.2);
  float flow = smoothstep(0.45, 0.85, noise(q * 0.45 - vec2(c.star * 0.12, c.star * 0.05)));
  vec3 tint = palette3(c.c1, c.c2, c.c3, dcell * 0.75 + hc * 0.1);
  float glow = 0.07 + flow * (0.22 + c.mid * 0.15) + wave * 0.45;
  vec3 col = mix(tint, vec3(1.0), 0.2 + c.high * 0.2) * l * glow + tint * halo * (0.04 + wave * 0.12);
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  return vec4(col * clear, 0.08 * clear);
}
`,
  },
  {
    id: "018-isometric",
    name: "Изометрия",
    glsl: `
vec4 m018_hex(vec2 q) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(q, r) - h;
  vec2 b = mod(q - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, q - gv);
}
vec4 modeLayer(Ctx c) {
  float sc = 11.0;
  vec2 drift = vec2(c.t * 0.03, -c.t * 0.012);
  vec4 h = m018_hex(c.p * sc + drift);
  vec2 g = h.xy;
  float ang = atan(g.y, g.x);
  float face = ang > PI * 0.5 || ang < -PI * 0.8333 ? 0.0 : (ang < -PI * 0.1667 ? 1.0 : 2.0);
  float shade = face < 0.5 ? 1.0 : (face < 1.5 ? 0.38 : 0.62);
  vec2 cpos = (h.zw - drift) / sc;
  float dcell = length(cpos - c.cc);
  float hc = hash(h.zw + 0.53);
  float island = smoothstep(0.42, 0.7, fbm(h.zw * 0.09 + vec2(c.t * 0.025, c.t * 0.017)));
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float x = (dcell - R) / (0.06 + age * 0.012);
    wave += exp(-x * x) * (1.0 - smoothstep(reach * 0.85, reach * 1.08, R));
  }
  wave = min(wave, 1.2);
  float a1 = abs(g.x), d2 = abs(dot(g, vec2(0.8660254, 0.5))), d3 = abs(dot(g, vec2(-0.8660254, 0.5)));
  float seam = min(face < 0.5 ? min(a1, d3) : (face < 1.5 ? min(d2, d3) : min(a1, d2)), 1.0);
  float hexEdge = 0.5 - max(dot(abs(g), vec2(0.5, 0.8660254)), abs(g.x));
  float lw = 1.3 * c.px * sc;
  float lines = exp(-hexEdge * hexEdge / (lw * lw)) + exp(-seam * seam / (lw * lw)) * 0.6;
  vec3 tint = palette3(c.c1, c.c2, c.c3, dcell * 0.7 + hc * 0.15);
  float vis = island * (0.6 + 0.4 * hc) + wave * 0.8;
  float body = shade * vis * (0.12 + c.level * 0.08 + c.bass * 0.06 + wave * 0.25);
  vec3 col = tint * body + mix(tint, vec3(1.0), 0.45) * lines * (0.04 + vis * 0.14 + c.high * 0.05);
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.3, c.dc);
  return vec4(col * clear, (0.1 + island * 0.22) * clear);
}
`,
  },
  {
    id: "019-gravity-grid",
    name: "Гравитационная сетка",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float r = max(length(d), 0.001);
  vec2 n = d / r;
  float pull = (0.035 + c.bass * 0.05) * c.coverR / (r + 0.05);
  vec2 q = c.p - n * pull;
  float reach = length(vec2(max(c.cc.x, c.aspect - c.cc.x), max(c.cc.y, 1.0 - c.cc.y)));
  float lift = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3 + age * age * 0.03;
    float wdt = 0.06 + age * 0.012;
    float x = (r - R) / wdt;
    float fade = 1.0 - smoothstep(reach * 0.85, reach * 1.08, R);
    q += n * x * exp(-x * x) * wdt * 0.35 * fade;
    lift += exp(-x * x) * fade;
  }
  lift = min(lift, 1.2);
  float ang = (noise(vec2(c.t * 0.03, 5.5)) - 0.5) * 0.5;
  float ca = cos(ang), sa = sin(ang);
  vec2 qr = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y) + vec2(c.t * 0.01, 0.0);
  float sc = 14.0;
  vec2 gq = qr * sc;
  vec2 dl = abs(fract(gq + 0.5) - 0.5) / sc;
  float lw = 1.3 * c.px;
  float lines = exp(-dl.x * dl.x / (lw * lw)) + exp(-dl.y * dl.y / (lw * lw));
  float glowL = exp(-dl.x * dl.x / (lw * lw * 30.0)) + exp(-dl.y * dl.y / (lw * lw * 30.0));
  float node = exp(-dot(dl, dl) / pow(0.003 + c.high * 0.004, 2.0));
  vec3 tint = palette3(c.c1, c.c2, c.c3, r * 0.75 + 0.05);
  float well = exp(-r * 2.2) * (0.6 + c.bass * 0.8);
  float base = 0.06 + well * 0.25 + lift * 0.3;
  vec3 col = mix(tint, vec3(1.0), 0.2) * (lines * base + glowL * (0.02 + lift * 0.06)) + mix(tint, vec3(1.0), 0.5) * node * (0.15 + c.high * 0.35 + lift * 0.3);
  float clear = smoothstep(c.coverR * 0.95, c.coverR * 1.25, c.dc);
  return vec4(col * clear, 0.06 * clear);
}
`,
  }
);
