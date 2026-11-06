(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "100-contours",
    name: "Изолинии",
    glsl: `
float m100_f(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v / 0.875;
}
vec4 modeLayer(Ctx c) {
  float e = 0.006;
  float amp = 1.0 + c.bass * 0.35;
  vec2 o = vec2(c.t * 0.025, -c.t * 0.018);
  vec2 q = c.p * 1.4 + o;
  float f0 = m100_f(q);
  float n0 = noise(q);
  vec2 gn = vec2(noise(q + vec2(e, 0.0)) - n0, noise(q + vec2(0.0, e)) - n0) / e * 1.4 * 0.5 / 0.875;
  float b0 = 0.0, db = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.22, w = 0.07 + age * 0.02;
    float k = ring(c.dc, r, w) * 0.07 * exp(-age * 0.25);
    b0 += k;
    db += k * -2.0 * (c.dc - r) / (w * w);
  }
  vec2 rad = (c.p - c.cc) / max(c.dc, 0.0001);
  float h = f0 * amp + b0;
  vec2 g = gn * amp * 1.3 + rad * db;
  float levels = 18.0;
  float v = h * levels;
  float idx = floor(v + 0.5);
  float dist = abs(fract(v + 0.5) - 0.5) / max(length(g) * levels, 0.001);
  float major = step(mod(idx, 5.0), 0.5);
  float l = line(dist, (0.9 + major * 0.9) * c.px) + 0.22 * line(dist, 5.0 * c.px);
  vec3 tint = palette3(c.c1, c.c2, c.c3, idx * 0.07);
  float b = 0.2 + major * 0.2 + c.high * 0.22;
  float band = smoothstep(0.55, 0.8, h) * 0.05;
  return vec4(mix(tint, vec3(1.0), 0.22) * (l * b + band), 0.1);
}
`,
  },
  {
    id: "101-dotfield",
    name: "Поле точек",
    glsl: `
vec4 modeLayer(Ctx c) {
  float s = 0.032;
  vec2 id = floor(c.p / s);
  vec2 g = (id + 0.5) * s;
  float n1 = noise(g * 2.2 + vec2(c.t * 0.06, 0.0));
  float n2 = noise(g * 2.2 + vec2(13.1, -c.t * 0.05));
  vec2 off = (vec2(n1, n2) - 0.5) * s * 0.3;
  vec2 dv = g - c.cc;
  float dg = length(dv);
  vec2 dir = dv / max(dg, 0.0001);
  float glow = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    glow += ring(dg, c.coverR + age * 0.3, 0.05 + age * 0.01) * exp(-age * 0.3);
  }
  glow = min(glow, 1.0);
  off += dir * glow * s * 0.22;
  float field = noise(g * 1.3 - vec2(0.0, c.t * 0.04));
  float r = s * (0.05 + 0.09 * field + c.high * 0.05 + glow * 0.05 + c.bass * 0.07 * exp(-dg * dg / 0.12));
  r = min(r, s * 0.21);
  float d = length(c.p - g - off);
  float dotm = smoothstep(r + c.px, r - c.px, d);
  float halo = exp(-d * d / (r * r * 9.0)) * 0.22;
  vec3 tint = palette3(c.c1, c.c2, c.c3, field * 0.8 + n1 * 0.3 + hash(id) * 0.12);
  return vec4(mix(tint, vec3(1.0), 0.25 + glow * 0.35) * (dotm + halo) * (0.32 + glow * 0.45 + c.level * 0.18), 0.12);
}
`,
  },
  {
    id: "102-moire",
    name: "Муар",
    glsl: `
vec4 modeLayer(Ctx c) {
  float drift = c.t * 0.035;
  vec2 o1 = (vec2(noise(vec2(drift, 1.7)), noise(vec2(4.2, drift))) - 0.5) * (0.3 + c.bass * 0.12);
  vec2 o2 = (vec2(noise(vec2(drift * 0.8, 8.3)), noise(vec2(2.9, drift * 0.8 + 5.0))) - 0.5) * 0.6;
  vec2 a = c.cc + o1;
  vec2 b = vec2(0.55 * c.aspect, 0.5) + o2;
  float F = 95.0;
  float d1 = length(c.p - a), d2 = length(c.p - b);
  float l1 = pow(0.5 + 0.5 * cos(d1 * F), 4.0);
  float l2 = pow(0.5 + 0.5 * cos(d2 * F), 4.0);
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    pulse += ring(c.dc, c.coverR + age * 0.26, 0.09 + age * 0.015) * exp(-age * 0.28);
  }
  pulse = min(pulse, 1.2);
  float env = smoothstep(1.6, 0.1, min(d1, d2));
  vec3 col = c.c1 * l1 * 0.16 + c.c2 * l2 * 0.16;
  col += mix(c.c3, vec3(1.0), 0.35) * l1 * l2 * (0.3 + c.high * 0.25 + pulse * 0.4);
  return vec4(col * env, 0.06);
}
`,
  },
  {
    id: "103-weave",
    name: "Ткань",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = c.p;
  float fold = fbm(q * 1.1 + vec2(c.t * 0.03, c.t * 0.02));
  float fold2 = fbm(q * 1.1 + vec2(7.3, 2.1) - c.t * 0.025);
  q += (vec2(fold, fold2) - 0.5) * (0.12 + c.bass * 0.06);
  vec2 dv = c.p - c.cc;
  float dg = length(dv);
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    wave += ring(dg, c.coverR + age * 0.28, 0.06 + age * 0.01) * exp(-age * 0.35);
  }
  q += dv / max(dg, 0.0001) * wave * 0.012;
  float s = 0.05;
  vec2 id = floor(q / s);
  vec2 f = fract(q / s);
  float k = mod(id.x + id.y, 3.0);
  float ax = abs(2.0 * f.x - 1.0), ay = abs(2.0 * f.y - 1.0);
  float warpP = sqrt(max(0.0, 1.0 - ax * ax * 1.25));
  float weftP = sqrt(max(0.0, 1.0 - ay * ay * 1.25));
  float fibX = 0.85 + 0.15 * noise(vec2(q.x * 400.0, q.y * 30.0));
  float fibY = 0.85 + 0.15 * noise(vec2(q.x * 30.0, q.y * 400.0));
  vec3 warpCol = palette3(c.c1, c.c2, c.c3, hash(vec2(id.x, 1.0)) * 0.25);
  vec3 weftCol = palette3(c.c1, c.c2, c.c3, hash(vec2(id.y, 2.0)) * 0.25 + 0.5);
  float warpOn = step(k, 1.5) * step(0.02, warpP);
  float weftOn = (1.0 - step(k, 1.5)) * step(0.02, weftP);
  float shade = warpOn > 0.5 ? warpP * fibX : (weftOn > 0.5 ? weftP * fibY : max(warpP, weftP) * 0.35);
  vec3 tint = warpOn > 0.5 ? warpCol : (weftOn > 0.5 ? weftCol : mix(warpCol, weftCol, 0.5));
  float light = 0.55 + 1.1 * (fold - 0.45);
  float sheen = pow(shade, 6.0) * (0.08 + c.high * 0.25 + wave * 0.35);
  vec3 col = tint * shade * (0.26 + c.level * 0.1) * light + mix(tint, vec3(1.0), 0.5) * sheen * light;
  return vec4(col, 0.3);
}
`,
  },
  {
    id: "104-paper",
    name: "Мятая бумага",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = c.p * 3.2;
  vec2 ip = floor(q), fp = fract(q);
  float d1 = 9.0, d2 = 9.0;
  vec2 nid = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 cell = ip + o;
      float ha = hash(cell + 0.37) * TAU;
      vec2 pt = o + 0.5 + vec2(cos(ha), sin(ha)) * (noise(cell * 1.7 + vec2(c.t * 0.05, 0.0)) - 0.5) * 0.8 + (hash2(cell) - 0.5) * 0.3;
      float d = length(fp - pt);
      if (d < d1) { d2 = d1; d1 = d; nid = cell; } else if (d < d2) { d2 = d; }
    }
  }
  float edge = (d2 - d1) / 3.2;
  vec2 nh = hash2(nid * 1.7 + 3.0) * 2.0 - 1.0;
  vec3 n = normalize(vec3(nh * (0.4 + c.bass * 0.35), 1.0));
  vec2 la = vec2(noise(vec2(c.t * 0.03, 2.0)), noise(vec2(5.0, c.t * 0.03))) * 2.0 - 1.0;
  vec3 L = normalize(vec3(la, 0.8));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float cw = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    cw += ring(c.dc, c.coverR + age * 0.24, 0.07 + age * 0.01) * exp(-age * 0.3);
  }
  cw = min(cw, 1.0);
  float crease = line(edge, 1.1 * c.px) * (0.12 + cw * 0.45 + c.high * 0.15);
  float grain = (hash(floor(c.p / (c.px * 1.5))) - 0.5) * 0.025;
  vec3 paper = mix(vec3(0.85, 0.84, 0.82), palette3(c.c1, c.c2, c.c3, hash(nid) * 0.35 + 0.1), 0.55);
  vec3 col = paper * (pow(diff, 3.0) * (0.16 + c.level * 0.08) + grain);
  col += mix(paper, vec3(1.0), 0.4) * crease;
  return vec4(max(col, 0.0), 0.35);
}
`,
  },
  {
    id: "105-meshgrad",
    name: "Градиентная сетка",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 w = vec2(noise(c.p * 1.3 + vec2(c.t * 0.05, 0.0)), noise(c.p * 1.3 + vec2(9.1, -c.t * 0.045))) - 0.5;
  w += (vec2(noise(c.p * 3.1 + vec2(3.0, c.t * 0.08)), noise(c.p * 3.1 + vec2(-c.t * 0.07, 6.0))) - 0.5) * 0.35 * (1.0 + c.mid);
  vec2 q = c.p + w * (0.16 + c.bass * 0.08);
  vec2 dv = c.p - c.cc;
  float dg = length(dv);
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    wave += ring(dg, c.coverR + age * 0.3, 0.07 + age * 0.012) * exp(-age * 0.3);
  }
  wave = min(wave, 1.0);
  q += dv / max(dg, 0.0001) * wave * 0.02;
  float s = 0.075;
  vec2 g = abs(fract(q / s + 0.5) - 0.5) * s;
  float gl = line(g.x, c.px) + line(g.y, c.px);
  float nr = (2.2 + c.high * 2.5 + wave * 2.0) * c.px;
  float node = exp(-dot(g, g) / (nr * nr));
  vec3 grad = palette3(c.c1, c.c2, c.c3, q.x * 0.22 + q.y * 0.35 + noise(q * 0.7 + c.t * 0.01) * 0.3);
  vec3 col = grad * (0.1 + c.level * 0.06);
  col += mix(grad, vec3(1.0), 0.3) * gl * (0.16 + c.high * 0.16 + wave * 0.3);
  col += mix(grad, vec3(1.0), 0.6) * node * (0.35 + wave * 0.3);
  return vec4(col, 0.25);
}
`,
  },
  {
    id: "106-strings",
    name: "Струны",
    glsl: `
float m106_disp(Ctx c, float idx, float y) {
  float hs = hash(vec2(idx, 9.0));
  float d = (noise(vec2(idx * 3.7, y * 2.5 + c.t * 0.6)) - 0.5) * (0.003 + c.mid * 0.01);
  d += sin(PI * y) * c.bass * 0.006 * (hs - 0.5);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 4.0) continue;
    float h = hash(vec2(idx, floor(uBeats[i] * 60.0)));
    float amp = step(0.6, h) * exp(-age * 1.4) * (0.01 + 0.02 * h);
    float md = 1.0 + floor(h * 2.99);
    d += amp * sin(PI * md * y) * cos(age * (16.0 + 12.0 * h));
  }
  return d;
}
vec4 modeLayer(Ctx c) {
  float s = 0.045;
  float base = floor(c.p.x / s - 0.5);
  float y = c.uv.y;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float idx = base + float(k);
    float dsp = m106_disp(c, idx, y);
    float dist = abs(c.p.x - (idx + 0.5) * s - dsp);
    float energy = min(abs(dsp) * 30.0, 1.0);
    vec3 tint = palette3(c.c1, c.c2, c.c3, hash(vec2(idx, 4.0)) * 0.6 + y * 0.3);
    float b = 0.14 + energy * 0.45 + c.high * 0.12;
    col += mix(tint, vec3(1.0), 0.2 + energy * 0.3) * (line(dist, 0.9 * c.px) + 0.3 * line(dist, (4.0 + energy * 6.0) * c.px)) * b;
  }
  col *= smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.9, y);
  return vec4(col, 0.05);
}
`,
  },
  {
    id: "107-halftone",
    name: "Растр",
    glsl: `
vec4 modeLayer(Ctx c) {
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    wave += ring(c.dc, c.coverR + age * 0.25, 0.08 + age * 0.015) * exp(-age * 0.3);
  }
  wave = min(wave, 1.0);
  vec3 col = vec3(0.0);
  float s = 0.038;
  for (int k = 0; k < 2; k++) {
    float a = k == 0 ? 0.26 : 1.05;
    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 q = R * c.p / s;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 ce = ((id + 0.5) * s) * R;
    float field = fbm(ce * 1.4 + vec2(c.t * 0.03 + float(k) * 3.0, -c.t * 0.02));
    field = smoothstep(0.32, 0.72, field) * (0.75 + c.level * 0.3) + wave * 0.45 + c.bass * 0.35 * exp(-dot(ce - c.cc, ce - c.cc) / 0.08);
    float r = 0.42 * sqrt(clamp(field, 0.0, 1.0));
    float aa = c.px / s;
    float dotm = smoothstep(r + aa, r - aa, length(f));
    vec3 tint = k == 0 ? c.c1 : c.c2;
    col += mix(tint, vec3(1.0), 0.15 + wave * 0.2) * dotm * (0.17 + c.high * 0.14);
  }
  return vec4(col, 0.1);
}
`,
  },
  {
    id: "108-hatching",
    name: "Штриховка",
    glsl: `
vec4 modeLayer(Ctx c) {
  float s = 0.05;
  vec2 id = floor(c.p / s);
  vec2 g = (id + 0.5) * s;
  vec2 f = c.p - g;
  float an = noise(g * 1.6 + vec2(c.t * 0.04, -c.t * 0.03)) * TAU * 1.2;
  vec2 dir = vec2(cos(an), sin(an));
  vec2 dv = g - c.cc;
  float dg = length(dv);
  vec2 rad = dv / max(dg, 0.0001);
  float w = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    w += ring(dg, c.coverR + age * 0.26, 0.07 + age * 0.012) * exp(-age * 0.3);
  }
  w = min(w, 1.0);
  dir = normalize(mix(dir, rad, w * 0.9) + vec2(0.0001));
  float along = dot(f, dir), across = dot(f, vec2(-dir.y, dir.x));
  float density = noise(g * 0.9 - vec2(0.0, c.t * 0.025));
  float th = 0.62 - c.bass * 0.22 - w * 0.3;
  float on = smoothstep(th, th + 0.08, density + hash(id) * 0.25);
  float len = s * (0.36 + 0.12 * hash(id + 7.0));
  float stroke = (line(across, 1.1 * c.px) + 0.25 * line(across, 4.0 * c.px)) * smoothstep(len, len - 2.0 * c.px, abs(along));
  vec3 tint = palette3(c.c1, c.c2, c.c3, density * 0.7 + hash(id) * 0.2);
  return vec4(mix(tint, vec3(1.0), 0.25 + w * 0.3) * stroke * on * (0.32 + c.high * 0.25 + w * 0.4), 0.08);
}
`,
  },
  {
    id: "109-dotrings",
    name: "Пунктирные круги",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float ang = atan(d.y, d.x);
  float reach = length(vec2(c.aspect, 1.0)) * 1.1;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 16.0) continue;
    float r = c.coverR + age * 0.15 + age * age * 0.004;
    float fade = (1.0 - smoothstep(reach * 0.8, reach, r)) * smoothstep(0.0, 0.15, age) * (0.45 + 0.55 * exp(-age * 0.35));
    float hb = hash(vec2(uBeats[i], 1.3));
    float n = 72.0 + floor(hb * 48.0);
    float spin = hb * TAU + age * 0.03 * (hb - 0.5);
    float a = fract((ang + spin) / TAU * n) - 0.5;
    float along = a * TAU * r / n;
    float across = c.dc - r;
    float dsz = (1.3 + 1.4 * exp(-age * 0.5) + c.high * 1.2) * c.px;
    float dotm = exp(-(along * along + across * across) / (dsz * dsz));
    float hair = ring(c.dc, r, 0.8 * c.px) * 0.2;
    vec3 tint = palette3(c.c1, c.c2, c.c3, (r - c.coverR) * 0.45);
    col += mix(tint, vec3(1.0), 0.25) * (dotm + hair) * fade;
  }
  col *= 0.75;
  col += c.c1 * smoothstep(c.coverR * (1.6 + c.bass * 0.6), c.coverR, c.dc) * 0.2 * c.bass;
  return vec4(col, 0.0);
}
`,
  }
);
