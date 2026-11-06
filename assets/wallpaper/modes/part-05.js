(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "050-outrun-sun",
    name: "Закат над сеткой",
    glsl: `
float m050_l(float d, float w) { return exp(-d * d / (w * w)); }
vec4 modeLayer(Ctx c) {
  float hz = 0.38;
  float cx = 0.5 * c.aspect;
  vec3 col = vec3(0.0);
  float a = 0.0;
  vec2 sc = vec2(cx, hz + 0.17);
  float R = 0.2 * (1.0 + c.bass * 0.12);
  vec2 d = c.p - sc;
  float r = length(d);
  float sy = d.y / R;
  vec3 sun = mix(c.c2, mix(c.c1, vec3(1.0), 0.35), smoothstep(-1.0, 1.0, sy));
  if (c.p.y >= hz) {
    float cut = 1.0;
    if (sy < 0.3) {
      float k = 0.3 - sy;
      float f = fract(sy * 5.0 + c.star * 0.06);
      cut = smoothstep(0.0, 0.05, f - k * 0.5);
    }
    float disk = smoothstep(R, R - 2.0 * c.px, r) * cut;
    col += sun * disk * (0.4 + c.level * 0.14);
    col += mix(c.c1, c.c2, 0.5) * exp(-max(r - R, 0.0) * 9.0) * (1.0 - disk) * (0.12 + c.bass * 0.18);
    col += c.c3 * exp(-(c.p.y - hz) * 12.0) * (0.16 + c.mid * 0.12);
    a = disk * 0.35;
  } else {
    float dy = hz - c.p.y;
    float z = 0.09 / dy;
    float dz = 0.09 / (dy * dy) * c.px;
    float xw = (c.p.x - cx) * z;
    float zz = z + c.star * 0.35;
    float fh = 0.5 - abs(fract(zz) - 0.5);
    float fv = 0.5 - abs(fract(xw * 2.0) - 0.5);
    float dxw = 2.0 * (z * c.px + abs(c.p.x - cx) * dz);
    float lh = (m050_l(fh, dz * 1.3) + 0.3 * m050_l(fh, dz * 5.0)) * smoothstep(0.35, 0.08, dz);
    float lv = (m050_l(fv, dxw * 1.3) + 0.3 * m050_l(fv, dxw * 5.0)) * smoothstep(0.35, 0.08, dxw);
    float fade = smoothstep(0.0, 0.08, dy);
    vec3 gcol = mix(mix(c.c1, vec3(1.0), 0.2), c.c3, smoothstep(0.0, 0.35, dy));
    float glit = lh * lv * c.high * 1.5;
    col += gcol * (lh + lv + glit) * fade * (0.26 + c.bass * 0.32);
    float spread = 0.05 + dy * 0.45;
    float shimmer = 0.55 + 0.45 * noise(vec2(c.p.x * 30.0, z * 3.0 - c.t * 0.8));
    col += sun * exp(-pow((c.p.x - cx) / spread, 2.0)) * exp(-dy * 5.0) * 0.2 * shimmer;
    for (int i = 0; i < 8; i++) {
      float age = c.t - uBeats[i];
      if (age < 0.0 || age > 1.6) continue;
      float zb = 10.0 - age * 6.5;
      if (zb < 0.2) continue;
      float g = exp(-pow((z - zb) / (0.06 * zb + 0.05), 2.0)) * (1.0 - age / 1.6);
      vec3 bt = palette3(c.c1, c.c2, c.c3, fract(uBeats[i] * 0.173));
      col += mix(bt, vec3(1.0), 0.25) * g * fade * (0.2 + lv * 0.6) * (0.6 + c.bass);
    }
    a = 0.3 * fade;
  }
  col += mix(c.c1, vec3(1.0), 0.3) * exp(-abs(c.p.y - hz) / 0.004) * (0.25 + c.level * 0.2);
  return vec4(col, a);
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
    name: "Пальмы",
    glsl: `
float m053_n1(float x, float sd) { float i = floor(x), f = fract(x); return mix(hash(vec2(i, sd)), hash(vec2(i + 1.0, sd)), f * f * (3.0 - 2.0 * f)); }
float m053_trunk(vec2 p, vec2 b, float h, float lean) {
  float t = clamp((p.y - b.y) / h, 0.0, 1.0);
  float cx = b.x + lean * t * t;
  float w = mix(0.015, 0.007, t);
  float d = (abs(p.x - cx) - w) / sqrt(1.0 + pow(2.0 * lean * t / h, 2.0));
  return max(d, max(b.y - p.y, p.y - b.y - h));
}
float m053_frond(vec2 p, vec2 top, float ang, float L, float droop) {
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 q = p - top;
  float u = dot(q, dir);
  float v = dot(q, nrm);
  float s = clamp(u / L, 0.0, 1.0);
  float vc = -dir.x * droop * s * s * L;
  float w = 0.017 * (1.0 - s) * (0.45 + 0.55 * abs(sin(u * 110.0))) + 0.002;
  float d = abs(v - vc) - w;
  return max(d, max(-u, u - L));
}
float m053_palm(vec2 p, vec2 b, float h, float lean, float seed, Ctx c) {
  float d = m053_trunk(p, b, h, lean);
  vec2 top = b + vec2(lean, h);
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float base = 0.12 + fk * 0.48;
    float sw = (m053_n1(c.t * 0.35, fk * 1.7 + seed) - 0.5) * 0.16 + c.bass * 0.05 * sin(fk * 2.3 + seed);
    float L = (0.15 + 0.06 * hash(vec2(fk, seed))) * h / 0.6;
    d = min(d, m053_frond(p, top, base + sw, L, 0.55));
  }
  return d;
}
vec4 modeLayer(Ctx c) {
  float hz = 0.34;
  float sx = 0.56 * c.aspect;
  vec3 col = vec3(0.0);
  float a = 0.0;
  float R = 0.16 * (1.0 + c.bass * 0.1);
  vec2 d = c.p - vec2(sx, hz);
  vec3 sun = mix(c.c2, mix(c.c1, vec3(1.0), 0.3), smoothstep(0.0, R, d.y));
  if (c.p.y >= hz) {
    float y = c.p.y - hz;
    col += palette3(c.c3, c.c2, c.c1, y * 0.9 + 0.1) * exp(-y * 3.5) * 0.24;
    float disk = smoothstep(R, R - 2.0 * c.px, length(d));
    col += sun * disk * (0.36 + c.level * 0.12);
    col += sun * exp(-max(length(d) - R, 0.0) * 10.0) * (1.0 - disk) * (0.12 + c.bass * 0.15);
  } else {
    float dy = hz - c.p.y;
    float wdt = R * (0.9 + dy * 2.0);
    float sh = smoothstep(0.42, 0.78, noise(vec2((c.p.x - sx) * 9.0 / (0.25 + dy * 2.0), dy * 90.0 / (0.3 + dy * 3.0) - c.t * 0.5)));
    col += sun * sh * smoothstep(wdt, wdt * 0.3, abs(c.p.x - sx)) * exp(-dy * 3.0) * (0.3 + c.mid * 0.2);
    vec2 gcell = floor(c.p / vec2(0.012, 0.004));
    float gh = hash(gcell + floor(c.star * 2.0));
    col += mix(c.c1, vec3(1.0), 0.5) * step(0.993 - c.high * 0.012, gh) * exp(-dy * 2.5) * 0.35;
    for (int i = 0; i < 8; i++) {
      float age = c.t - uBeats[i];
      if (age < 0.0 || age > 2.5) continue;
      float rr = length((c.p - vec2(sx, hz - 0.09)) * vec2(1.0, 5.0));
      vec3 bt = palette3(c.c1, c.c2, c.c3, fract(uBeats[i] * 0.173));
      col += bt * ring(rr, age * 0.32, 0.012 + age * 0.006) * (1.0 - age / 2.5) * 0.22;
    }
    col += c.c3 * exp(-dy * 18.0) * 0.12;
    a = 0.28;
  }
  col += mix(c.c1, vec3(1.0), 0.3) * exp(-abs(c.p.y - hz) / 0.003) * 0.22;
  float pd = min(m053_palm(c.p, vec2(0.1 * c.aspect, 0.0), 0.66, 0.1, 1.0, c), m053_palm(c.p, vec2(0.9 * c.aspect, 0.0), 0.5, -0.08, 7.0, c));
  float sil = smoothstep(1.5 * c.px, -1.5 * c.px, pd);
  col *= 1.0 - sil;
  col += mix(c.c1, c.c2, 0.4) * exp(-abs(pd) / (2.0 * c.px)) * (0.12 + c.high * 0.15);
  a = max(a, sil * 0.88);
  return vec4(col, a);
}
`,
  },
  {
    id: "054-wire-mountains",
    name: "Каркасные горы",
    glsl: `
float m054_n1(float x, float sd) { float i = floor(x), f = fract(x); return mix(hash(vec2(i, sd)), hash(vec2(i + 1.0, sd)), f * f * (3.0 - 2.0 * f)); }
vec4 modeLayer(Ctx c) {
  float hz = 0.52;
  float cx = 0.5 * c.aspect;
  vec3 col = c.c2 * exp(-abs(c.p.y - hz) * 10.0) * 0.18;
  float a = 0.0;
  if (c.p.y > hz) {
    vec2 g = c.p * 70.0;
    vec2 gi = floor(g);
    float h = hash(gi);
    float tw = 0.5 + 0.5 * noise(vec2(h * 50.0, c.t * 1.5));
    float st = step(0.982, h) * exp(-dot(fract(g) - 0.5, fract(g) - 0.5) * 30.0) * tw * (0.25 + c.high * 0.6);
    col += mix(c.c3, vec3(1.0), 0.5) * st * smoothstep(0.0, 0.15, c.p.y - hz) * 0.5;
  }
  float amp = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 3.0) continue;
    amp += exp(-age * 2.5) * 0.18;
  }
  float ageH = c.t - c.hits.x;
  float front = ageH * 6.0;
  float zc = c.star * 0.25;
  float sp = 0.6;
  float base = floor(zc / sp) * sp;
  for (int j = 0; j < 14; j++) {
    float jj = 14.0 - float(j);
    float Z = base + jj * sp;
    float z = Z - zc;
    float xw = (c.p.x - cx) * z * 1.6;
    float hgt = m054_n1(xw * 1.3, Z * 1.7) + 0.18 * sin(xw * 6.0 + Z * 3.0);
    hgt = max(hgt, 0.0);
    hgt = hgt * hgt * smoothstep(0.12, 1.0, abs(xw)) * (0.4 + c.bass * 0.28 + amp);
    hgt = hgt / (1.0 + hgt * 1.2);
    float y = hz + (hgt - 0.24) / (z + 0.5);
    float under = step(c.p.y, y);
    col *= 1.0 - under;
    a = mix(a, 0.55, under);
    float dp = abs(c.p.y - y);
    float band = under * step(y - c.p.y, 0.08);
    if (dp > 20.0 * c.px && band < 0.5) continue;
    float fog = smoothstep(0.05, 0.6, z) / (1.0 + z * 0.3);
    vec3 tint = palette3(c.c1, c.c2, c.c3, Z * 0.07);
    float q = dp * dp / (c.px * c.px);
    float ln = exp(-q / 1.7) + 0.25 / (1.0 + q / 20.0);
    float pf = (z - front) / 0.7;
    float pulse = ageH > 0.0 && ageH < 2.0 ? (1.0 - ageH / 2.0) / (1.0 + pf * pf * 2.0) * step(abs(pf), 2.0) : 0.0;
    float dx = 4.0 * z * 1.6 * c.px;
    float fv = 0.5 - abs(fract(xw * 4.0) - 0.5);
    float mesh = exp(-fv * fv / (dx * dx * 1.5)) * smoothstep(0.3, 0.08, dx) * band * smoothstep(0.08, 0.0, y - c.p.y);
    col += mix(tint, vec3(1.0), 0.15) * (ln * (0.35 + c.high * 0.25 + pulse * 0.8) + mesh * 0.12) * fog;
  }
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
    name: "Вейпор-шахматы",
    glsl: `
float m056_tri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
vec2 m056_rot(vec2 p, float a) { float s = sin(a), co = cos(a); return vec2(co * p.x - s * p.y, s * p.x + co * p.y); }
vec4 modeLayer(Ctx c) {
  float hz = 0.42;
  float cx = 0.5 * c.aspect;
  vec3 col = vec3(0.0);
  float a = 0.0;
  vec2 tc = vec2(cx, hz + 0.27);
  float ang = c.star * 0.12 + (noise(vec2(c.t * 0.1, 3.0)) - 0.5) * 0.8;
  float tr = 0.13 * (1.0 + c.bass * 0.15);
  if (c.p.y < hz) {
    float dy = hz - c.p.y;
    float z = 0.12 / dy;
    float dz = 0.12 / (dy * dy) * c.px;
    float xw = (c.p.x - cx) * z;
    float zw = z + c.star * 0.4;
    vec2 g = vec2(xw, zw) * 1.5;
    vec2 fw = vec2(1.5 * (z * c.px + abs(c.p.x - cx) * dz), 1.5 * dz);
    float sxx = smoothstep(-fw.x, fw.x, abs(fract(g.x) - 0.5) - 0.25) * 2.0 - 1.0;
    float syy = smoothstep(-fw.y, fw.y, abs(fract(g.y) - 0.5) - 0.25) * 2.0 - 1.0;
    float ch = mix(0.5, 0.5 + 0.5 * sxx * syy, smoothstep(0.5, 0.1, max(fw.x, fw.y)));
    float fog = exp(-z * 0.12);
    float th = hash(floor(g));
    float flash = step(0.9, th) * c.high * 0.8;
    float wave = 0.0;
    for (int i = 0; i < 8; i++) {
      float age = c.t - uBeats[i];
      if (age < 0.0 || age > 2.0) continue;
      wave += exp(-pow(z - 0.5 - age * 5.0, 2.0) * 1.5) * (1.0 - age / 2.0);
    }
    vec3 tile = mix(c.c1, c.c3, ch);
    col += tile * (0.08 + 0.2 * ch + flash * ch + wave * 0.35 * ch) * fog * (0.7 + c.bass * 0.6);
    vec2 mq = vec2(c.p.x, 2.0 * hz - c.p.y) + vec2((noise(vec2(c.p.y * 80.0, c.t * 0.7)) - 0.5) * 0.012, 0.0);
    float rd = m056_tri(m056_rot(mq - tc, ang), tr);
    col += mix(c.c2, vec3(1.0), 0.2) * exp(-abs(rd) / 0.006) * 0.16 * smoothstep(0.0, 0.03, dy);
    a = 0.42 * smoothstep(0.0, 0.05, dy);
  } else {
    float y = c.p.y - hz;
    col += palette3(c.c3, c.c2, c.c1, y * 1.1 + 0.15) * exp(-y * 2.5) * 0.2;
  }
  col += mix(c.c2, vec3(1.0), 0.3) * exp(-abs(c.p.y - hz) / 0.004) * 0.25;
  vec2 q = c.p - tc;
  float d1 = m056_tri(m056_rot(q, ang), tr);
  float d2 = m056_tri(m056_rot(q, -ang * 1.6 + 1.0), tr * 0.5);
  col += mix(c.c1, vec3(1.0), 0.3) * (exp(-d1 * d1 / (4.0 * c.px * c.px)) * 0.55 + exp(-abs(d1) / 0.02) * 0.15) * (0.6 + c.level * 0.5);
  col += mix(c.c3, vec3(1.0), 0.25) * (exp(-d2 * d2 / (3.0 * c.px * c.px)) * 0.4 + exp(-abs(d2) / 0.015) * 0.1) * (0.5 + c.high * 0.6);
  col += c.c2 * step(d1, 0.0) * 0.06;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 2.4) continue;
    float de = m056_tri(m056_rot(q, ang + age * 0.4), tr * (1.0 + age * 1.3));
    vec3 bt = palette3(c.c1, c.c2, c.c3, fract(uBeats[i] * 0.173));
    col += bt * exp(-de * de / (6.0 * c.px * c.px + age * 0.00004)) * (1.0 - age / 2.4) * 0.35;
  }
  a = max(a, step(d1, 0.0) * 0.15);
  return vec4(col, a);
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
    name: "Пиксельный закат",
    glsl: `
float m058_b2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float m058_bayer(vec2 a) { return m058_b2(a * 0.5) * 0.25 + m058_b2(a); }
vec4 modeLayer(Ctx c) {
  float ps = 1.0 / 90.0;
  vec2 cell = floor(c.p / ps);
  vec2 q = (cell + 0.5) * ps;
  float dith = m058_bayer(cell) - 0.5;
  float hz = 0.36;
  vec3 col = vec3(0.0);
  vec2 sc = vec2(0.62 * c.aspect, hz + 0.15);
  float R = 0.15 + c.bass * 0.025;
  vec3 sunc = mix(c.c2, mix(c.c1, vec3(1.0), 0.3), smoothstep(-R, R, q.y - sc.y));
  if (q.y >= hz) {
    float gr = (q.y - hz) / (1.0 - hz);
    float band = floor(clamp(gr + dith * 0.22, 0.0, 0.999) * 5.0) / 5.0;
    col += palette3(c.c3, c.c2, c.c1, band * 0.5 + 0.1) * (0.05 + 0.16 * (1.0 - band));
    float sd = length(q - sc) + dith * 0.012;
    float row = floor((q.y - sc.y) / ps);
    float gap = (q.y < sc.y) ? step(mod(row, 4.0), floor((sc.y - q.y) / R * 3.0) * 1.0 - 0.5) * step(mod(row, 4.0), 2.5) : 0.0;
    float disk = step(sd, R) * (1.0 - gap);
    col = mix(col, sunc * (0.38 + c.level * 0.12), disk);
    float cl = fbm(vec2(q.x * 2.5 + c.t * 0.02, q.y * 6.0));
    float cm = smoothstep(0.1, 0.25, gr) * smoothstep(0.75, 0.45, gr);
    float c1m = step(0.56 + dith * 0.08, cl) * cm;
    float c2m = step(0.64 + dith * 0.08, cl) * cm;
    col = mix(col, mix(c.c3, c.c2, 0.4) * 0.14, c1m);
    col = mix(col, mix(c.c1, vec3(1.0), 0.2) * 0.26, c2m * (0.5 + 0.5 * step(sc.x, q.x + 0.1)));
    float h = hash(cell);
    float sky = (1.0 - disk) * (1.0 - c1m) * smoothstep(0.35, 0.6, gr);
    float tw = step(0.992, h) * (0.5 + 0.5 * step(0.5, noise(vec2(h * 40.0, c.t * 2.0)))) * (0.25 + c.high * 0.5);
    float pop = 0.0;
    pop += step(0.985, hash(cell + fract(c.hits.x * 0.37) * 91.0)) * max(0.0, 1.0 - (c.t - c.hits.x) / 1.2) * step(0.0, c.t - c.hits.x);
    pop += step(0.985, hash(cell + fract(c.hits.y * 0.37) * 91.0)) * max(0.0, 1.0 - (c.t - c.hits.y) / 1.2) * step(0.0, c.t - c.hits.y);
    col += mix(palette3(c.c1, c.c2, c.c3, h * 3.0), vec3(1.0), 0.5) * (tw + pop * 0.5) * sky;
  } else {
    float dy = hz - q.y;
    float rowi = floor(dy / ps);
    col += mix(c.c3, c.c2, 0.3) * (0.08 + 0.05 * step(0.0, dith - 0.2 + dy * 2.0)) * exp(-dy * 1.5);
    float wdt = R * (1.0 - dy * 0.8) * (0.4 + 0.6 * hash(vec2(rowi, floor(c.star * 3.0))));
    float off = (hash(vec2(rowi, floor(c.star * 3.0) + 5.0)) - 0.5) * 0.03;
    float refl = step(abs(q.x - sc.x - off), wdt) * step(0.5, mod(rowi, 2.0));
    col += sunc * refl * (0.25 + c.mid * 0.15) * exp(-dy * 2.0);
    float gl = step(0.994 - c.high * 0.015, hash(cell + floor(c.star * 4.0)));
    col += mix(c.c1, vec3(1.0), 0.6) * gl * 0.35;
  }
  vec2 gm = fract(c.p / ps);
  col *= 0.8 + 0.2 * step(0.08, gm.x) * step(0.08, gm.y);
  return vec4(col, 0.35);
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
