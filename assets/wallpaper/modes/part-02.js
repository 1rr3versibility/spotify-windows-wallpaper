(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "020-ink",
    name: "Чернила",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 w = vec2(fbm(c.p * 2.6 + vec2(0.0, c.t * 0.05)), fbm(c.p * 2.6 + vec2(4.3, 1.9) - c.t * 0.04)) - 0.5;
  float grain = noise(c.p * 11.0 + w * 6.0);
  vec3 col = vec3(0.0);
  float dark = 0.0;
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = c.t - b;
    if (age < 0.0 || age > 13.0) continue;
    float ang = hash(vec2(b * 0.37, 1.7)) * TAU;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 center = c.cc + dir * (c.coverR * 0.9 + age * 0.045) + vec2(0.0, -age * 0.012);
    float R = 0.035 + 0.12 * sqrt(age);
    vec2 q = c.p - center + w * (0.12 + age * 0.05);
    float d = length(q * vec2(1.0, 0.85));
    float body = smoothstep(R, R * 0.2, d);
    float edge = ring(d, R * 0.92, 0.01 + age * 0.004);
    float fade = exp(-age * 0.16) * smoothstep(13.0, 9.0, age);
    vec3 tint = palette3(c.c1, c.c2, c.c3, b * 0.045);
    col += tint * (body * (0.18 + 0.32 * grain) + edge * (0.22 + c.high * 0.4)) * fade;
    dark += body * fade * 0.22;
  }
  float src = smoothstep(c.coverR * (1.6 + c.bass * 0.6), c.coverR, c.dc) * (0.5 + 0.5 * grain);
  col += mix(c.c1, c.c2, grain) * src * c.bass * 0.22;
  return vec4(col * (0.75 + c.level * 0.35), clamp(dark, 0.0, 0.45));
}
`,
  },
  {
    id: "021-smoke",
    name: "Дым",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = vec2(c.p.x * 1.6, c.p.y * 1.15 - c.star * 0.045);
  float h1 = fbm(q + vec2(c.t * 0.02, 0.0));
  float f = fbm(q * 1.5 + vec2(h1 * 2.2, -c.star * 0.02));
  float sw = 0.022 + c.bass * 0.02;
  float strand = exp(-pow((f - 0.5) / sw, 2.0)) + 0.7 * exp(-pow((f - 0.4) / sw, 2.0)) + 0.5 * exp(-pow((f - 0.6) / sw, 2.0));
  float haze = exp(-pow((f - 0.5) / 0.16, 2.0));
  float mask = smoothstep(1.05, 0.15, c.uv.y) * smoothstep(0.0, 0.12, c.uv.y);
  vec3 tint = palette3(c.c1, c.c2, c.c3, f * 1.4 + c.uv.y * 0.35 + h1 * 0.5);
  vec3 col = mix(tint, vec3(1.0), 0.12) * (strand * (0.28 + c.level * 0.25) + haze * 0.12) * mask;
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = c.t - b;
    if (age < 0.0 || age > 12.0) continue;
    float hx = hash(vec2(b * 0.21, 5.3));
    vec2 o = vec2((0.12 + 0.76 * hx) * c.aspect + (h1 - 0.5) * 0.3 * age * 0.2, -0.05 + age * 0.085);
    float r = 0.06 + age * 0.035;
    vec2 d = (c.p - o) / r;
    float puff = exp(-dot(d, d)) * (0.4 + strand + haze * 0.6) * exp(-age * 0.22);
    col += mix(palette3(c.c1, c.c2, c.c3, b * 0.05), vec3(1.0), 0.15) * puff * 0.22;
  }
  vec2 sg = vec2(c.p.x * 46.0, c.p.y * 46.0 - c.star * 1.6);
  vec2 sc = floor(sg);
  vec2 sj = hash2(sc + 3.0);
  float sd = length(fract(sg) - 0.2 - sj * 0.6);
  float ember = step(0.93, hash(sc + 11.0)) * exp(-sd * sd / 0.006) * mask * (1.0 - c.uv.y);
  col += mix(c.c2, vec3(1.0), 0.4) * ember * (0.15 + c.high * 0.7);
  return vec4(col, haze * mask * 0.12);
}
`,
  },
  {
    id: "022-lava",
    name: "Лава-лампа",
    glsl: `
vec4 modeLayer(Ctx c) {
  float field = 0.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi, 4.2));
    float x = (0.12 + 0.76 * h.x) * c.aspect + (noise(vec2(c.t * 0.05, fi * 7.0)) - 0.5) * 0.35;
    float y = noise(vec2(fi * 3.1, c.t * 0.035 + h.y * 10.0)) * 1.3 - 0.15;
    float r = (0.06 + 0.06 * h.y) * (1.0 + c.bass * 0.3);
    vec2 d = c.p - vec2(x, y);
    float k = r * r / (dot(d, d) + 1e-4);
    field += k;
    vec3 wt = vec3(h.x, h.y, hash(vec2(fi, 8.8)));
    wt = wt * wt;
    acc += (c.c1 * wt.x + c.c2 * wt.y + c.c3 * wt.z) / (wt.x + wt.y + wt.z + 1e-3) * k;
  }
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = c.t - b;
    if (age < 0.0 || age > 12.0) continue;
    float hb = hash(vec2(b * 0.13, 2.0));
    vec2 o = vec2((0.1 + 0.8 * hb) * c.aspect + sin(age * 0.7 + hb * 9.0) * 0.03, -0.08 + age * 0.09 + age * age * 0.003);
    float r = 0.05 * exp(-age * 0.06) + 0.012;
    vec2 d = c.p - o;
    float k = r * r / (dot(d, d) + 1e-4);
    field += k;
    acc += palette3(c.c1, c.c2, c.c3, b * 0.05) * k;
  }
  vec3 tint = acc / max(field, 1e-3);
  float inside = smoothstep(0.85, 1.15, field);
  float rim = exp(-pow((field - 1.0) / 0.14, 2.0));
  float core = smoothstep(1.2, 4.0, field);
  float halo = smoothstep(0.25, 1.0, field) * (1.0 - inside);
  vec3 col = tint * (inside * (0.16 + 0.22 * core) + halo * 0.1) + mix(tint, vec3(1.0), 0.35) * rim * (0.28 + c.high * 0.35);
  return vec4(col * (0.85 + c.level * 0.3), inside * 0.32);
}
`,
  },
  {
    id: "023-cells",
    name: "Клетки",
    glsl: `
vec4 modeLayer(Ctx c) {
  float sc = 6.0;
  vec2 g = c.p * sc + vec2(c.t * 0.03, c.t * 0.017);
  vec2 ip = floor(g), fp = fract(g);
  float d1 = 8.0, d2 = 8.0;
  vec2 id1 = vec2(0.0), pt1 = vec2(0.0);
  for (int j = 0; j < 9; j++) {
    float fj = float(j);
    vec2 o = vec2(mod(fj, 3.0) - 1.0, floor(fj / 3.0) - 1.0);
    vec2 h = hash2(ip + o);
    vec2 pt = o + 0.5 + 0.32 * vec2(sin(c.t * (0.21 + 0.17 * h.x) + h.y * TAU) + 0.4 * sin(c.t * 0.13 * (1.0 + h.y) + h.x * 9.0), cos(c.t * (0.19 + 0.15 * h.y) + h.x * TAU) + 0.4 * cos(c.t * 0.11 * (1.0 + h.x) + h.y * 7.0)) * 0.75;
    float dd = length(pt - fp);
    if (dd < d1) { d2 = d1; d1 = dd; id1 = ip + o; pt1 = pt; }
    else if (dd < d2) { d2 = dd; }
  }
  vec2 cw = (ip + pt1 - vec2(c.t * 0.03, c.t * 0.017)) / sc;
  float dcell = length(cw - c.cc);
  float hc = hash(id1 + 7.3);
  vec3 cellTint = palette3(c.c1, c.c2, c.c3, hc);
  float wob = noise(g * 3.0 + c.t * 0.2);
  float membrane = 1.0 - smoothstep(0.0, 0.05 + 0.04 * wob, d2 - d1);
  float nucR = 0.11 + 0.03 * c.bass + 0.03 * hc;
  float nucleus = smoothstep(nucR, nucR * 0.5, d1);
  float nucRim = ring(d1, nucR, 0.025);
  vec3 act = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = c.t - b;
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.32;
    float hit = exp(-pow((dcell - R) / 0.11, 2.0)) * exp(-age * 0.2);
    act += palette3(c.c1, c.c2, c.c3, b * 0.05) * hit;
  }
  float fill = smoothstep(0.7, 0.0, d1);
  vec3 col = mix(cellTint, vec3(1.0), 0.2) * membrane * (0.2 + c.high * 0.3 + c.level * 0.1);
  col += cellTint * (nucleus * (0.12 + c.bass * 0.18) + nucRim * 0.18);
  col += act * (fill * 0.35 + membrane * 0.4);
  return vec4(col, 0.18 * fill);
}
`,
  },
  {
    id: "024-marble",
    name: "Мрамор",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = c.p * 1.25;
  vec2 w = vec2(fbm(q + vec2(c.t * 0.014, 0.0)), fbm(q + vec2(5.2, 1.3) - c.t * 0.011));
  float f = fbm(q * 1.7 + w * (2.2 + c.bass * 0.4));
  float v = q.x * 1.1 + q.y * 0.8 + f * 4.2 + w.y * 2.0;
  float s1 = abs(sin(v * 2.6));
  float s2 = abs(sin(v * 9.0 + w.x * 7.0));
  float vein = exp(-pow(s1 / 0.035, 2.0)) + exp(-pow(s1 / 0.16, 2.0)) * 0.25;
  float fine = exp(-pow(s2 / 0.05, 2.0)) * smoothstep(0.35, 0.75, f) * 0.45;
  float flash = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float front = c.coverR + age * 0.38;
    flash += exp(-pow((c.dc - front) / (0.06 + age * 0.015), 2.0)) * exp(-age * 0.25);
  }
  vec3 tint = palette3(c.c1, c.c2, c.c3, f * 1.3 + w.x * 0.6);
  vec2 gc = floor(c.p * 180.0);
  float glint = step(0.992, hash(gc + floor(c.star * 3.0 + hash(gc) * 5.0))) * vein;
  vec3 col = mix(tint, vec3(1.0), 0.25) * (vein + fine) * (0.2 + c.level * 0.12 + flash * 0.45);
  col += mix(c.c3, c.c1, w.y) * smoothstep(0.3, 0.8, f) * 0.06;
  col += vec3(1.0) * glint * (0.2 + c.high * 0.8);
  return vec4(col, 0.22 * smoothstep(0.2, 0.7, f));
}
`,
  },
  {
    id: "025-currents",
    name: "Течения",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = c.p * 1.1 + vec2(c.t * 0.018, -c.t * 0.012);
  float e = 0.02;
  float psi = fbm(q);
  float px = fbm(q + vec2(e, 0.0));
  float py = fbm(q + vec2(0.0, e));
  vec2 grad = vec2(px - psi, py - psi) / e;
  float speed = length(grad);
  float n = 11.0;
  float lv = psi * n;
  float idx = floor(lv);
  float dist = (0.5 - abs(fract(lv) - 0.5)) / max(speed * n, 0.4);
  float w = (1.4 + c.bass * 1.6) * c.px;
  float lineV = exp(-pow(dist / w, 2.0));
  float glowV = exp(-pow(dist / (w * 5.0), 2.0)) * 0.3;
  idx = floor(lv + 0.5);
  float hl = hash(vec2(idx, 3.3));
  float dash = smoothstep(0.4, 0.85, noise(q * 3.2 + vec2(hl * 11.0, c.star * 0.12)));
  float surge = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    surge += exp(-age * 1.2);
  }
  vec3 tint = palette3(c.c1, c.c2, c.c3, idx * 0.071 + 0.3);
  float fast = smoothstep(0.3, 2.0, speed);
  vec3 col = mix(tint, vec3(1.0), 0.15) * (lineV + glowV) * (0.08 + fast * 0.16 + dash * (0.14 + c.high * 0.28 + surge * 0.12));
  return vec4(col * (0.85 + c.level * 0.3), 0.08);
}
`,
  },
  {
    id: "026-drops",
    name: "Капли",
    glsl: `
vec4 modeLayer(Ctx c) {
  float cs = 0.4;
  vec2 g = c.p / cs;
  vec2 ip = floor(g - 0.5);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    vec2 cell = ip + vec2(mod(fj, 2.0), floor(fj / 2.0));
    float h0 = hash(cell + 0.7);
    float rate = 0.3 + 0.25 * h0;
    float ph = c.t * rate + h0 * 13.0;
    float ep = floor(ph);
    float age = fract(ph) / rate;
    vec2 pos = (cell + 0.2 + 0.6 * hash2(cell + ep * 1.37)) * cs;
    float d = length(c.p - pos);
    float r = age * 0.1;
    float fade = exp(-age * 1.3) * step(0.3, hash(cell + ep * 2.11));
    float wd = 0.006 + age * 0.004;
    float rp = ring(d, r, wd) + 0.45 * ring(d, r - 0.022, wd * 1.3);
    col += palette3(c.c1, c.c2, c.c3, h0 + ep * 0.11) * rp * fade;
  }
  col *= 0.2 + c.high * 0.35;
  float reach = length(vec2(c.aspect, 1.0)) * 1.3;
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = c.t - b;
    if (age < 0.0 || age > 13.0) continue;
    vec2 hp = hash2(vec2(b * 0.29, 8.1));
    vec2 pos = mix(c.cc, vec2((0.1 + 0.8 * hp.x) * c.aspect, 0.1 + 0.8 * hp.y), 0.55);
    float d = length(c.p - pos);
    float r = age * 0.17 + age * age * 0.004;
    float fade = (1.0 - smoothstep(reach * 0.6, reach, r)) * (0.45 + 0.55 * exp(-age * 0.3));
    vec3 tint = palette3(c.c1, c.c2, c.c3, b * 0.05 + age * 0.03);
    float wv = ring(d, r, 0.008 + age * 0.003) + 0.55 * ring(d, r - 0.035 - age * 0.006, 0.01 + age * 0.004) + 0.3 * ring(d, r - 0.08 - age * 0.012, 0.014 + age * 0.005);
    col += mix(tint, vec3(1.0), 0.12) * wv * fade * (0.22 + c.bass * 0.14);
  }
  return vec4(col, 0.06);
}
`,
  },
  {
    id: "027-film",
    name: "Мыльная плёнка",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 q = c.p * 1.4;
  vec2 w = vec2(noise(q * 1.3 + vec2(c.star * 0.04, 0.0)), noise(q * 1.3 + vec2(3.7, -c.star * 0.035))) - 0.5;
  float th = fbm(q + w * 2.5 + vec2(0.0, c.t * 0.03)) + c.uv.y * 0.55;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float R = c.coverR + age * 0.3;
    th += ring(c.dc, R, 0.05 + age * 0.012) * 0.09 * exp(-age * 0.18);
  }
  float fr = 0.5 + 0.5 * cos(th * 34.0);
  vec3 irid = palette3(c.c1, c.c2, c.c3, th * 2.2);
  vec3 irid2 = hue(irid, th * 3.0);
  vec2 bc = c.cc + vec2(c.coverR * 0.6, 0.0);
  float br = c.coverR * 2.3 * (1.0 + c.bass * 0.12) + (noise(vec2(atan(c.p.y - bc.y, c.p.x - bc.x) * 2.0, c.t * 0.3)) - 0.5) * 0.05;
  float bd = length(c.p - bc);
  float inside = smoothstep(br, br - 0.03, bd);
  float rim = ring(bd, br, 0.006) + ring(bd, br - 0.012, 0.02) * 0.4;
  float fres = smoothstep(br * 0.55, br, bd) * inside;
  vec2 hl = (c.p - bc) / br - vec2(-0.45, 0.45);
  float spec = exp(-dot(hl, hl) / 0.02);
  float film = 0.1 + inside * (0.18 + fres * 0.35);
  vec3 col = mix(irid, irid2, 0.4) * fr * film * (0.75 + c.level * 0.4);
  col += mix(irid2, vec3(1.0), 0.4) * rim * (0.3 + c.high * 0.4);
  col += vec3(1.0) * spec * inside * 0.25;
  return vec4(col, inside * 0.12);
}
`,
  },
  {
    id: "028-jelly",
    name: "Медузы",
    glsl: `
vec4 modeLayer(Ctx c) {
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 4.0) continue;
    pulse += exp(-age * 3.0) * smoothstep(0.0, 0.06, age);
  }
  pulse = min(pulse, 1.2);
  vec3 col = vec3(0.0);
  float dark = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float h = hash(vec2(fk, 9.4));
    float size = 0.11 + 0.05 * h;
    float y = fract(c.star * (0.009 + 0.004 * h) + h * 3.7) * 1.6 - 0.3;
    float x = (0.18 + 0.32 * fk + 0.08 * h) * c.aspect + (noise(vec2(c.t * 0.06, fk * 5.0)) - 0.5) * 0.4;
    vec2 q = (c.p - vec2(x, y)) / size;
    float sq = 1.0 - 0.18 * pulse;
    vec2 bq = vec2(q.x / sq, q.y * sq);
    float d = length(bq * vec2(1.0, 1.35));
    float top = smoothstep(-0.25, 0.05, bq.y);
    float ang = atan(bq.y, bq.x);
    float bell = smoothstep(1.0, 0.75, d) * top * (0.55 + 0.45 * cos(ang * 9.0));
    float rim = ring(d, 0.96, 0.07) * top;
    float lip = exp(-pow((bq.y + 0.22) / 0.06, 2.0)) * step(abs(bq.x), 1.0);
    float tent = 0.0;
    if (q.y < 0.0 && q.y > -5.0) {
      float depth = -q.y;
      float tx = q.x + sin(depth * 2.2 - c.t * 1.6 + h * 10.0) * 0.18 * depth + (noise(vec2(depth * 1.5, fk + c.t * 0.3)) - 0.5) * 0.3 * depth;
      float lanes = abs(fract(tx * 2.0 + 0.5) - 0.5) / 2.0;
      tent = exp(-pow(lanes / (0.035 + 0.01 * depth), 2.0)) * step(abs(tx), 0.85) * smoothstep(5.0, 0.5, depth);
      float beads = step(0.8, hash(vec2(floor(depth * 6.0), floor(tx * 2.0 + 0.5) + fk * 7.0)));
      tent *= 0.5 + beads * c.high * 1.5;
    }
    vec3 tint = palette3(c.c1, c.c2, c.c3, h + fk * 0.33);
    float halo = exp(-dot(q, q) * 0.35);
    col += mix(tint, vec3(1.0), 0.2) * (bell * 0.3 + rim * (0.45 + pulse * 0.3) + lip * 0.2 + tent * 0.3) * (0.8 + c.level * 0.4);
    col += tint * halo * (0.06 + c.bass * 0.1);
    dark += smoothstep(1.0, 0.6, d) * top * 0.25;
  }
  return vec4(col, clamp(dark, 0.0, 0.3));
}
`,
  },
  {
    id: "029-plankton",
    name: "Биосвечение",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 warp = vec2(fbm(c.p * 1.8 + vec2(0.0, c.t * 0.03)), fbm(c.p * 1.8 + vec2(6.1, 2.4) - c.t * 0.025)) - 0.5;
  vec2 pf = c.p + warp * 0.25 + vec2(c.star * 0.012, c.star * 0.004);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 22.0 + fl * 13.0;
    vec2 g = pf * sc + fl * 17.3;
    vec2 cell = floor(g);
    vec2 hp = hash2(cell);
    float hs = hash(cell + 4.1);
    if (hs < 0.72) continue;
    vec2 pos = 0.2 + 0.6 * hp;
    float d = length(fract(g) - pos) / sc;
    vec2 wp = (cell + pos - fl * 17.3) / sc - warp * 0.25 - vec2(c.star * 0.012, c.star * 0.004);
    float dw = length(wp - c.cc);
    float lit = 0.0;
    vec3 litTint = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float b = uBeats[i];
      float age = c.t - b;
      if (age < 0.0 || age > 12.0) continue;
      float R = c.coverR + age * 0.3;
      float x = dw - R;
      float behind = (exp(-x * x / 0.006) + 0.25 * smoothstep(0.02, -0.02, x) * exp(x * 3.0)) * exp(-age * 0.18);
      lit += behind;
      litTint += palette3(c.c1, c.c2, c.c3, b * 0.05) * behind;
    }
    float tw = noise(vec2(hs * 40.0, c.t * (0.8 + hs)));
    float core = exp(-pow(d / (1.3 * c.px), 2.0));
    float glow = exp(-pow(d / (6.0 * c.px), 2.0));
    vec3 base = palette3(c.c1, c.c2, c.c3, hs * 2.0 + fl * 0.2);
    float baseI = 0.06 + tw * c.high * 0.35;
    col += (base * baseI + litTint * 0.45) * (core + glow * 0.5) + mix(base, vec3(1.0), 0.5) * core * min(lit, 1.0) * 0.3;
  }
  float wisp = exp(-pow((warp.x + warp.y) / 0.03, 2.0));
  col += mix(c.c2, c.c3, warp.x + 0.5) * wisp * (0.04 + c.bass * 0.08);
  return vec4(col, 0.35);
}
`,
  }
);
