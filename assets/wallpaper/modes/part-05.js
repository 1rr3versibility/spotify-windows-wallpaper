(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "050-outrun-sun",
    name: "Неоновые волны",
    glsl: `
vec2 m050_wave(float x, float fk, float s) {
  float k1 = 2.1 + fk * 0.37;
  float k2 = 4.3 - fk * 0.29;
  float k3 = 7.7 + fk * 0.53;
  float p1 = s * (0.23 + fk * 0.031) + fk * 1.7;
  float p2 = -s * (0.17 + fk * 0.027) + fk * 2.9;
  float p3 = s * (0.31 - fk * 0.019) + fk * 0.8;
  float y = 0.07 * sin(x * k1 + p1) + 0.035 * sin(x * k2 + p2) + 0.012 * sin(x * k3 + p3);
  float dy = 0.07 * k1 * cos(x * k1 + p1) + 0.035 * k2 * cos(x * k2 + p2) + 0.012 * k3 * cos(x * k3 + p3);
  return vec2(y, dy);
}
vec3 m050_tint(Ctx c, float k) {
  float u = k * TAU;
  vec3 w = max(vec3(cos(u), cos(u - TAU / 3.0), cos(u + TAU / 3.0)), 0.0);
  w = w * w + 0.05;
  return (c.c1 * w.x + c.c2 * w.y + c.c3 * w.z) / (w.x + w.y + w.z);
}
vec4 modeLayer(Ctx c) {
  float s = c.star * 0.6 + c.t * 0.05;
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age >= 0.0 && age < 1.2) pulse += exp(-age * 3.5) * 0.35;
  }
  pulse = min(pulse, 0.6);
  vec3 col = vec3(0.0);
  float a = 0.0;
  float x = c.p.x;
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float base = 0.2 + fk * 0.15 + 0.03 * sin(s * 0.11 + fk * 2.3);
    float amp = 1.0 + 0.25 * c.bass + 0.15 * sin(s * 0.07 + fk);
    vec2 w = m050_wave(x, fk, s);
    float yc = base + w.x * amp;
    float d = abs(c.p.y - yc) / sqrt(1.0 + w.y * w.y * amp * amp);
    float th = 0.0045 + 0.004 * c.bass + 0.0012 * sin(x * 1.3 + s * 0.4 + fk);
    float core = exp(-d * d / (th * th));
    float halo = exp(-d / (0.03 + 0.03 * c.bass));
    float ribbonW = 0.045 + 0.02 * sin(x * 0.9 - s * 0.3 + fk * 1.9) + 0.02 * c.bass;
    float side = c.p.y - yc;
    float sheet = smoothstep(0.0, -ribbonW, side) * smoothstep(-ribbonW * 2.2, -ribbonW * 0.3, side);
    float along = 0.5 + 0.5 * sin(x * 1.7 - s * 0.5 + fk * 2.1);
    vec3 tint = m050_tint(c, fk * 0.21 + along * 0.35 + s * 0.01);
    float br = 0.55 + c.level * 0.35 + pulse;
    col += mix(tint, vec3(1.0), 0.25) * core * br * 0.9;
    col += tint * halo * (0.12 + c.bass * 0.12 + pulse * 0.2);
    col += tint * sheet * (0.13 + c.mid * 0.08) * (0.6 + 0.4 * along);
    a = max(a, halo * 0.25 + sheet * 0.2);
  }
  col += mix(c.c1, c.c3, c.uv.x) * c.high * 0.03;
  return vec4(col, clamp(a, 0.0, 0.4));
}
`,
  },
  
  {
    id: "052-vhs",
    name: "Кассета VHS",
    glsl: `
float m052_g(float dy, float th) { return exp(-dy / th) * 0.55 + exp(-dy * dy / (th * th * 0.08)) * 0.6; }
vec4 m052_scene(vec2 p, float s, Ctx c) {
  vec3 col = vec3(0.0);
  float tot = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float y0 = 0.27 + fk * 0.23 + (noise(vec2(fk * 3.1, c.t * 0.05)) - 0.5) * 0.18;
    float y = y0 + (noise(vec2(p.x * 0.9 + fk * 5.0, c.t * 0.1 + fk)) - 0.5) * 0.16;
    float th = 0.01 + c.bass * 0.018 + fk * 0.003;
    float g = m052_g(abs(p.y - y), th);
    float ga = m052_g(abs(p.y - y - s), th) - m052_g(abs(p.y - y + s), th);
    vec3 tint = k == 0 ? c.c1 : (k == 1 ? c.c2 : c.c3);
    col += tint * g;
    tot += ga;
  }
  return vec4(col, tot);
}
vec4 modeLayer(Ctx c) {
  vec2 p = c.p;
  float row = floor(c.uv.y / (c.px * 2.0));
  float jit = (noise(vec2(row * 0.15, c.t * 6.0)) - 0.5) * (0.003 + c.high * 0.009);
  float tear = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 0.7) continue;
    float by = hash(vec2(uBeats[i], 4.1));
    float bh = 0.02 + 0.05 * hash(vec2(uBeats[i], 8.3));
    tear += smoothstep(bh, bh * 0.5, abs(c.uv.y - by)) * (1.0 - age / 0.7);
  }
  tear = min(tear, 1.0);
  p.x += jit + tear * 0.05 * (hash(vec2(row, floor(c.t * 20.0))) - 0.3);
  float s = 0.006 + c.bass * 0.01 + tear * 0.02;
  vec4 m = m052_scene(p, s, c);
  vec3 col = m.rgb * (0.3 + c.level * 0.15);
  col += c.c1 * max(m.a, 0.0) * 0.16 + c.c3 * max(-m.a, 0.0) * 0.16;
  float ty = fract(-c.t * 0.03 + 0.35 * noise(vec2(c.t * 0.05, 2.0))) * 1.2 - 0.1;
  float trk = smoothstep(0.03, 0.012, abs(c.uv.y - ty));
  float stat = hash(vec2(floor(c.p.x / (c.px * 3.0)), row + floor(c.t * 30.0)));
  col += mix(c.c2, vec3(1.0), 0.5) * trk * stat * stat * 0.28;
  col += mix(c.c1, vec3(1.0), 0.6) * tear * stat * 0.12;
  float dr = step(0.996 - c.high * 0.01, hash(vec2(row, floor(c.t * 24.0))));
  float hx = hash(vec2(row, floor(c.t * 24.0) + 3.7)) * c.aspect;
  col += mix(c.c3, vec3(1.0), 0.6) * dr * smoothstep(0.05, 0.02, abs(c.p.x - hx)) * 0.4;
  col += mix(c.c1, c.c3, c.uv.x) * 0.025;
  col *= 0.78 + 0.22 * sin(c.uv.y / c.px * PI * 0.5);
  return vec4(col, 0.15 + trk * 0.1);
}
`,
  },
  {
    id: "053-palms",
    name: "Солнечные блики",
    glsl: `
vec2 m053_path(float k, float s, float aspect) {
  float a = s * (0.031 + 0.011 * k) + k * 2.399;
  float b = s * (0.027 + 0.009 * k) + k * 1.618;
  return vec2((0.5 + 0.44 * sin(a) * cos(b * 0.7)) * aspect, 0.5 + 0.42 * sin(b + 0.6 * cos(a)));
}
vec4 m053_fleck(vec2 q, vec2 cp, float r, float k, float s, vec3 tint) {
  vec2 d = q - cp;
  float ang = 0.6 * sin(s * 0.02 + k * 1.7);
  float ca = cos(ang), sa = sin(ang);
  d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) * vec2(1.0, 1.35);
  float dist = length(d) / r;
  float body = smoothstep(1.0, 0.35, dist);
  float core = exp(-dist * dist * 3.2);
  return vec4(tint * (body * 0.55 + core * 0.45), body);
}
vec4 modeLayer(Ctx c) {
  float s = c.star;
  vec2 p = c.p;
  vec2 w = vec2(fbm(p * 1.4 + vec2(s * 0.021, -s * 0.017)), fbm(p * 1.4 + vec2(5.2 - s * 0.019, 1.3 + s * 0.015))) - 0.5;
  vec2 q = p + w * 0.18;
  float leaf = fbm(q * 2.6 + vec2(-s * 0.03, s * 0.022));
  float gaps = 0.55 + 0.45 * smoothstep(0.38, 0.62, leaf);
  vec3 col = vec3(0.0);
  float cover = 0.0;
  for (int i = 0; i < 8; i++) {
    float k = float(i);
    vec2 cp = m053_path(k, s, c.aspect);
    float r = 0.18 + 0.07 * sin(s * 0.04 + k * 1.3) + c.bass * 0.02;
    float breathe = 0.7 + 0.3 * sin(s * 0.05 + k * 2.1);
    vec3 tint = palette3(c.c1, c.c2, c.c3, k * 0.37 + s * 0.003);
    tint = mix(tint, vec3(1.0), 0.3);
    vec4 f = m053_fleck(q, cp, r, k, s, tint);
    col += f.rgb * breathe;
    cover = max(cover, f.a * breathe);
  }
  col *= gaps;
  col = col / (1.0 + col * 0.6);
  float gain = 0.85 + c.level * 0.35 + c.bass * 0.2;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 1.6) continue;
    gain += 0.05 * exp(-age * 2.2);
  }
  col *= gain;
  col += mix(c.c2, vec3(1.0), 0.6) * pow(cover, 3.0) * gaps * (0.08 + c.high * 0.1);
  float a = mix(0.38, 0.1, cover);
  return vec4(col, a);
}
`,
  },
  {
    id: "054-wire-mountains",
    name: "Стеклянные складки",
    glsl: `
vec2 m054_warp(vec2 p, float T) {
  float a = fbm(p * 0.65 + vec2(0.0, T));
  float b = fbm(p * 0.65 + vec2(5.2, 1.3) - vec2(T * 0.8, 0.0));
  return vec2(a, b);
}
vec4 modeLayer(Ctx c) {
  float T = c.star * 0.035 + c.t * 0.004;
  vec2 p = c.p * 1.15;
  vec2 q = m054_warp(p, T);
  vec2 w = p + (q - 0.5) * (1.5 + c.bass * 0.12);
  float d = fbm(w * 0.8 + vec2(-T * 0.6, T * 0.4));
  float u = (w.y * 1.0 + w.x * 0.38 + d * 0.6) * 11.0 - T * 4.0;
  float s = sin(u);
  float cr = cos(u);
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 4.0) continue;
    pulse += exp(-age * 1.4) * smoothstep(0.0, 0.12, age);
  }
  pulse = min(pulse, 1.2);
  float mask = smoothstep(0.28, 0.72, q.x * 0.6 + d * 0.6);
  float body = 0.5 + 0.5 * s;
  float edge = 0.5 + 0.5 * cr;
  float gleam = exp(-(1.0 - s) * 18.0);
  float sheen = exp(-(1.0 - s) * 2.5);
  vec3 tint = palette3(c.c1, c.c2, c.c3, q.y * 1.3 + d * 0.5 + T * 0.2);
  vec3 tint2 = palette3(c.c1, c.c2, c.c3, q.y * 1.3 + d * 0.5 + T * 0.2 + 0.33);
  vec3 col = mix(tint2, tint, body) * (0.05 + 0.2 * body * edge) * (0.4 + mask * 0.6);
  col += tint * sheen * (0.08 + c.level * 0.06) * mask;
  col += mix(tint, vec3(1.0), 0.55) * gleam * (0.28 + c.high * 0.25 + c.level * 0.1 + pulse * 0.25) * (0.25 + mask * 0.75);
  float a = 0.12 + 0.18 * mask * (1.0 - body * 0.6);
  return vec4(col, a);
}
`,
  },
  {
    id: "055-neon-tunnel",
    name: "Неоновый тоннель",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 ctr = vec2(c.aspect * (0.5 + (noise(vec2(c.t * 0.08, 1.0)) - 0.5) * 0.14), 0.5 + (noise(vec2(c.t * 0.08, 7.0)) - 0.5) * 0.12);
  vec2 d = c.p - ctr;
  float m = max(max(abs(d.x) / 1.6, abs(d.y)), 1e-3);
  float z = 0.08 / m;
  float dz = 0.08 / (m * m) * c.px;
  float zz = z + c.star * 0.5;
  float fd = 0.5 - abs(fract(zz) - 0.5);
  float idn = floor(zz + 0.5);
  float fr = exp(-fd * fd / (dz * dz * 1.7)) + 0.3 * exp(-fd * fd / (dz * dz * 25.0));
  float vis = smoothstep(0.012, 0.07, m) * smoothstep(0.3, 0.05, dz);
  vec3 tint = palette3(c.c1, c.c2, c.c3, idn * 0.11);
  float lit = 0.3 + c.level * 0.3 + 0.7 * step(0.8, hash(vec2(idn, 5.0))) * c.high;
  vec3 col = tint * fr * lit * vis * 0.55;
  float side = step(abs(d.y), abs(d.x) / 1.6);
  float s = mix(d.x / 1.6, d.y, side) / m;
  float dots = exp(-pow((fract(s * 6.0 + idn * 0.37 + c.star * 0.05) - 0.5) / 0.04, 2.0));
  col += mix(tint, vec3(1.0), 0.5) * dots * fr * vis * c.high * 0.6;
  float e = abs(abs(d.x) / 1.6 - abs(d.y));
  col += mix(c.c2, c.c3, 0.5) * exp(-e * e / (4.0 * c.px * c.px)) * smoothstep(0.02, 0.2, m) * 0.14;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 2.0) continue;
    float zp = 12.0 / (1.0 + age * 5.0);
    float g = exp(-pow((z - zp) / (0.15 * zp + 0.1), 2.0)) * (1.0 - age / 2.0);
    vec3 bt = palette3(c.c1, c.c2, c.c3, fract(uBeats[i] * 0.173));
    col += mix(bt, vec3(1.0), 0.3) * g * (0.15 + fr * 0.7) * vis * (0.6 + c.bass * 0.8);
  }
  col += c.c1 * exp(-m * 30.0) * (0.12 + c.bass * 0.2);
  return vec4(col, 0.4 * smoothstep(0.3, 0.0, m));
}
`,
  },
  {
    id: "056-checker-prism",
    name: "Шахматный вихрь",
    glsl: `
vec2 m056_rot(vec2 p, float a) { float s = sin(a), co = cos(a); return vec2(co * p.x - s * p.y, s * p.x + co * p.y); }
vec4 modeLayer(Ctx c) {
  vec2 q = c.p - c.cc;
  float r = length(q);
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    float x = r - c.coverR - age * 0.28;
    wave += exp(-x * x / 0.006) * exp(-age * 0.55);
  }
  wave = min(wave, 1.2);
  float warp = (noise(q * 1.4 + vec2(c.t * 0.03, -c.t * 0.025)) - 0.5) * 0.35;
  float twist = 2.6 * exp(-r * 1.5) + warp + wave * 0.12;
  vec2 w = m056_rot(q, c.star * 0.08 + twist);
  float cell = 0.085 * (1.0 + r * 0.6);
  vec2 g = w / cell * PI;
  float sv = sin(g.x) * sin(g.y);
  float ch = 0.5 + 0.5 * clamp(sv * 2.5, -1.0, 1.0);
  float edge = exp(-sv * sv * 18.0);
  float hueT = r * 0.9 + twist * 0.12 + noise(w * 0.8 + c.t * 0.01) * 0.3;
  vec3 base = palette3(c.c1, c.c2, c.c3, hueT);
  vec3 alt = palette3(c.c3, c.c1, c.c2, hueT + 0.2);
  vec3 tile = mix(base, alt, ch);
  float fade = smoothstep(c.coverR * 0.6, c.coverR * 1.6, r);
  float glow = exp(-r * 1.2);
  vec3 col = tile * (0.07 + 0.06 * ch + c.level * 0.05) * (0.6 + glow * 0.8);
  col += mix(tile, vec3(1.0), 0.35) * edge * (0.035 + c.high * 0.05 + wave * 0.12);
  col += mix(base, vec3(1.0), 0.3) * wave * (0.05 + 0.08 * ch) * (0.7 + c.bass * 0.6);
  col *= fade * 0.85 + 0.15;
  return vec4(col, (0.16 + 0.1 * ch) * (0.5 + 0.5 * fade));
}
`,
  },
  {
    id: "057-scope",
    name: "Осциллограф",
    glsl: `
float m057_n1(float x, float sd) { float i = floor(x), f = fract(x); return mix(hash(vec2(i, sd)), hash(vec2(i + 1.0, sd)), f * f * (3.0 - 2.0 * f)); }
float m057_pk(float x, float hit, float t, float k) {
  float age = t - hit;
  if (age < 0.0 || age > 4.0) return 0.0;
  float x0 = age * 0.9;
  return exp(-pow((x - x0) / 0.07, 2.0)) * exp(-age * 0.7) * sin((x - x0) * 70.0) * 0.07 / (1.0 + k * 0.6);
}
float m057_wave(float x, float k, Ctx c) {
  float s = c.star * 0.35;
  float y = (m057_n1(x * 2.2 - s * (1.0 + k * 0.3), k * 7.1) - 0.5) * (0.1 + c.bass * 0.24);
  y += (m057_n1(x * 9.0 - s * 2.0, k * 3.3 + 1.0) - 0.5) * (0.015 + c.high * 0.06);
  y += m057_pk(x, c.hits.x, c.t, k) + m057_pk(x, c.hits.y, c.t, k) + m057_pk(x, c.hits.z, c.t, k);
  return y;
}
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  vec2 g = vec2(c.p.x / c.aspect * 12.0, c.p.y * 8.0);
  vec2 gf = abs(fract(g + 0.5) - 0.5) / vec2(12.0 / c.aspect, 8.0);
  float grid = exp(-gf.x * gf.x / (c.px * c.px)) + exp(-gf.y * gf.y / (c.px * c.px));
  vec2 tk = abs(fract(g * 5.0 + 0.5) - 0.5) / vec2(60.0 / c.aspect, 40.0);
  float ticks = (exp(-tk.x * tk.x / (c.px * c.px)) * step(abs(c.p.y - 0.5), 0.008) + exp(-tk.y * tk.y / (c.px * c.px)) * step(abs(c.p.x - 0.5 * c.aspect), 0.008));
  float axis = exp(-pow((c.p.y - 0.5) / c.px, 2.0)) + exp(-pow((c.p.x - 0.5 * c.aspect) / c.px, 2.0));
  col += mix(c.c3, vec3(1.0), 0.3) * (grid * 0.05 + axis * 0.08 + ticks * 0.1);
  float e = 0.004;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float y0 = 0.28 + fk * 0.22;
    float x = c.p.x / c.aspect;
    float w0 = m057_wave(x, fk, c);
    float w1 = m057_wave(x + e, fk, c);
    float sl = (w1 - w0) / (e * c.aspect);
    float sq = sqrt(1.0 + sl * sl);
    float dist = abs(c.p.y - y0 - w0) / sq;
    float beam = exp(-pow(dist / (1.4 * c.px), 2.0)) + 0.35 * exp(-pow(dist / (8.0 * c.px), 2.0)) + 0.1 * exp(-dist / 0.03);
    vec3 tint = k == 0 ? c.c1 : (k == 1 ? c.c2 : c.c3);
    col += mix(tint, vec3(1.0), 0.25) * beam * (0.3 + c.level * 0.3) / (0.6 + 0.4 * sq);
  }
  vec2 q = c.uv * 2.0 - 1.0;
  float frame = smoothstep(1.0, 0.9, max(abs(q.x), abs(q.y)));
  return vec4(col * frame, 0.3 * frame);
}
`,
  },
  {
    id: "058-pixel-sunset",
    name: "Светящаяся мозаика",
    glsl: `
float m058_box(vec2 q, float h, float r) {
  vec2 d = abs(q) - vec2(h - r);
  return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
}
vec4 modeLayer(Ctx c) {
  float s = 1.0 / 7.0;
  vec2 id = floor(c.p / s);
  vec2 g = (id + 0.5) * s;
  vec2 q = c.p - g;
  float tm = c.star * 0.05 + c.t * 0.01;
  vec2 w = vec2(fbm(g * 0.9 + vec2(tm, -tm * 0.7)), fbm(g * 0.9 + vec2(5.2 - tm * 0.6, 1.3 + tm))) - 0.5;
  float v = fbm(g * 1.4 + w * 1.6 + vec2(-tm * 0.8, tm * 0.5));
  float k = smoothstep(0.34, 0.68, v);
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 3.0) continue;
    pulse += exp(-age * 1.6) * smoothstep(0.0, 0.12, age);
  }
  pulse = min(pulse, 1.0);
  float hsz = s * (0.36 + 0.08 * k);
  float d = m058_box(q, hsz, s * 0.12);
  float body = 1.0 - smoothstep(-s * 0.06, s * 0.02, d);
  float glow = exp(-max(d, 0.0) / (s * 0.12)) * 0.35;
  vec3 tint = palette3(c.c1, c.c2, c.c3, v * 1.3 + w.x * 0.4);
  tint = mix(tint, vec3(1.0), k * k * 0.3);
  float lum = 0.04 + 0.42 * k * k + c.bass * 0.18 * k + c.level * 0.06 + pulse * 0.1 * k;
  float inner = 1.0 - 0.25 * smoothstep(0.0, hsz, length(q));
  vec3 col = tint * lum * (body * inner + glow);
  return vec4(col, 0.18 + 0.14 * k * body);
}
`,
  },
  {
    id: "059-lasers",
    name: "Лазерное шоу",
    glsl: `
float m059_n1(float x, float sd) { float i = floor(x), f = fract(x); return mix(hash(vec2(i, sd)), hash(vec2(i + 1.0, sd)), f * f * (3.0 - 2.0 * f)); }
float m059_beam(vec2 dd, float rr, float a0, float w0) {
  vec2 dir = vec2(sin(a0), cos(a0));
  float dist = abs(dd.x * dir.y - dd.y * dir.x);
  float w = w0 + rr * 0.006;
  float q = dist * dist / (w * w);
  return (exp(-q) + 0.25 / (1.0 + q * 0.04)) * step(0.0, dot(dd, dir));
}
vec4 modeLayer(Ctx c) {
  vec2 o = vec2(0.5 * c.aspect, 0.3);
  vec2 d = c.p - o;
  float r = length(d);
  vec2 dd = d;
  float refl = 1.0;
  if (d.y < 0.0) {
    dd.y = -d.y * 1.6;
    dd.x += (noise(vec2(c.p.x * 20.0, c.p.y * 60.0 - c.t * 0.8)) - 0.5) * (0.01 + c.bass * 0.02);
    refl = 0.35;
  }
  float rr = length(dd);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float base = ((fk + 0.5) / 6.0 * 2.0 - 1.0) * 1.05;
    float sw = (m059_n1(c.t * 0.12, fk * 3.7) - 0.5) * 0.7;
    float on = smoothstep(0.35, 0.6, m059_n1(c.star * 0.25, fk * 1.9 + 11.0));
    vec3 tint = palette3(c.c1, c.c2, c.c3, fk / 6.0);
    col += mix(tint, vec3(1.0), 0.15) * m059_beam(dd, rr, base + sw, 0.0018) * on * (0.16 + c.level * 0.2 + c.high * 0.18);
  }
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 1.6) continue;
    float hb = hash(vec2(uBeats[i], 1.7));
    float a0 = (hb - 0.5) * 2.2 + age * (hash(vec2(uBeats[i], 3.3)) - 0.5) * 0.8;
    vec3 bt = palette3(c.c1, c.c2, c.c3, hb);
    col += mix(bt, vec3(1.0), 0.3) * m059_beam(dd, rr, a0, 0.003) * exp(-age * 2.2) * (0.35 + c.bass * 0.3);
  }
  col *= exp(-rr * 0.9);
  float haze = noise(vec2(c.p.x * 2.0 + c.t * 0.04, c.p.y * 4.0 - c.t * 0.02));
  col *= 0.6 + 0.8 * haze;
  col *= refl;
  col += mix(c.c1, vec3(1.0), 0.5) * exp(-r * r / 0.0015) * (0.25 + c.bass * 0.35);
  col += mix(c.c2, vec3(1.0), 0.3) * exp(-abs(d.y) / 0.003) * exp(-abs(d.x) / (0.25 + c.bass * 0.2)) * (0.15 + c.bass * 0.2);
  col += c.c3 * exp(-abs(d.y) / 0.004) * 0.12;
  return vec4(col, refl < 1.0 ? 0.25 : 0.0);
}
`,
  }
);
