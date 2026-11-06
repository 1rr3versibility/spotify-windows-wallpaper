(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "070-nebula",
    name: "Туманность",
    glsl: `
vec4 modeLayer(Ctx c) {
  float drift = c.t * 0.011;
  vec2 q = c.p * 1.5 + vec2(drift, -drift * 0.6);
  vec2 w = vec2(fbm(q + vec2(3.1, 7.4)), fbm(q * 1.2 + vec2(8.2, 1.7) - drift * 0.8));
  float n = fbm(q + 2.4 * w + vec2(0.0, c.bass * 0.08));
  float dust = fbm(q * 2.3 - w * 1.4 + vec2(11.0, 4.0));
  float gas = smoothstep(0.38, 0.86, n);
  float lanes = smoothstep(0.42, 0.72, dust);
  float glow = gas * (1.0 - lanes * 0.8);
  vec3 tint = palette3(c.c1, c.c2, c.c3, n * 1.3 + w.y * 0.7);
  float fil = exp(-pow((n - 0.62) / 0.018, 2.0)) * (1.0 - lanes);
  float echo = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    echo += ring(c.dc, c.coverR + age * 0.42, 0.06 + age * 0.05) * exp(-age * 0.45) * keep;
  }
  vec3 col = tint * glow * (0.3 + c.level * 0.18 + c.bass * 0.16);
  col += mix(tint, vec3(1.0), 0.35) * (fil * (0.12 + c.high * 0.25) + glow * echo * 0.45);
  vec2 g = c.p * 48.0;
  vec2 id = floor(g);
  vec2 h = hash2(id);
  vec2 f = (g - id - 0.2 - 0.6 * h) / 48.0;
  float on = step(0.9, hash(id + 5.3));
  float tw = 0.55 + 0.45 * noise(vec2(c.t * (1.5 + h.x * 2.5), h.y * 40.0));
  float s = exp(-dot(f, f) / pow((0.6 + h.y * 0.6 + c.high * 0.5) * c.px, 2.0));
  col += mix(palette3(c.c1, c.c2, c.c3, h.x), vec3(1.0), 0.65) * s * on * tw * (0.35 + 0.5 * glow + c.high * 0.3);
  return vec4(col, 0.18 + glow * 0.22 + lanes * gas * 0.25);
}
`,
  },
  {
    id: "071-galaxy",
    name: "Спиральная галактика",
    glsl: `
vec2 m071_rot(vec2 v, float a) { float s = sin(a), co = cos(a); return vec2(co * v.x - s * v.y, s * v.x + co * v.y); }
vec4 modeLayer(Ctx c) {
  vec2 g0 = vec2(0.66 * c.aspect, 0.5) + (vec2(noise(vec2(c.t * 0.02, 1.0)), noise(vec2(c.t * 0.02, 7.0))) - 0.5) * 0.06;
  vec2 d = m071_rot(c.p - g0, 0.45);
  d.y /= 0.52;
  d /= 1.9;
  float r = length(d);
  float th = atan(d.y, d.x);
  float spin = c.star * 0.025;
  float arm = pow(0.5 + 0.5 * cos(2.0 * (th - log(r + 0.015) * 2.4 - spin)), 3.0);
  vec2 dr = m071_rot(d, -spin);
  float clump = fbm(dr * 7.0 + 3.0);
  float dust = smoothstep(0.5, 0.75, fbm(dr * 11.0 + 9.0));
  float disk = exp(-r * 4.2);
  float bulge = exp(-r * r / (0.004 * (1.0 + c.bass * 0.8)));
  float wave = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    wave += ring(r, age * 0.13, 0.03 + age * 0.012) * exp(-age * 0.4) * keep;
  }
  float armI = arm * disk * (0.55 + clump * 0.9) * (1.0 - dust * 0.6 * arm);
  vec3 armCol = mix(c.c2, c.c3, smoothstep(0.05, 0.45, r));
  float hii = smoothstep(0.7, 0.88, clump) * arm * disk;
  vec3 col = armCol * armI * (0.42 + c.level * 0.28 + wave * 1.1);
  col += mix(c.c1, c.c2, 0.5) * disk * (0.1 + wave * 0.15);
  col += mix(c.c1, vec3(1.0), 0.55) * bulge * (0.5 + c.bass * 0.4);
  col += mix(c.c1, vec3(1.0), 0.3) * hii * (0.35 + c.high * 0.6);
  vec2 g = c.p * 70.0;
  vec2 id = floor(g);
  vec2 h = hash2(id + 4.0);
  vec2 f = (g - id - 0.2 - 0.6 * h) / 70.0;
  float on = step(0.93 - armI * 0.7, hash(id + 1.7));
  float tw = 0.5 + 0.5 * noise(vec2(c.t * (2.0 + h.x * 3.0), h.y * 30.0));
  col += mix(armCol, vec3(1.0), 0.6) * on * exp(-dot(f, f) / pow((0.8 + h.y * 0.7) * c.px, 2.0)) * tw * (0.3 + c.high * 0.5);
  return vec4(col, disk * 0.35);
}
`,
  },
  {
    id: "072-planet-rings",
    name: "Кольца планеты",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float tilt = -0.32 + (noise(vec2(c.t * 0.015, 2.0)) - 0.5) * 0.12;
  float s = sin(tilt), co = cos(tilt);
  vec2 e = vec2(co * d.x - s * d.y, s * d.x + co * d.y);
  vec2 pl = vec2(e.x, e.y / 0.27);
  float rr = max(length(pl), 0.0001);
  float R1 = c.coverR * 1.3, R2 = c.coverR * 2.9;
  float x = (rr - R1) / (R2 - R1);
  float inside = smoothstep(-0.02, 0.02, x) * smoothstep(1.02, 0.97, x);
  float bands = 0.45 + 0.35 * noise(vec2(x * 38.0, 1.0)) + 0.2 * noise(vec2(x * 140.0, 4.0));
  bands *= 1.0 - 0.92 * exp(-pow((x - 0.63) / 0.025, 2.0));
  bands *= 1.0 - 0.6 * exp(-pow((x - 0.86) / 0.01, 2.0));
  bands *= mix(0.5, 1.0, smoothstep(0.0, 0.25, x));
  float ang = c.star * 0.06 * pow(R1 / rr, 1.5);
  vec2 rp = vec2(cos(ang) * pl.x - sin(ang) * pl.y, sin(ang) * pl.x + cos(ang) * pl.y);
  float grain = noise(rp * 70.0);
  float sparkle = pow(noise(rp * 260.0 + 5.0), 8.0) * (0.6 + c.high * 3.0);
  float wave = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    wave += ring(x, age * 0.14, 0.03 + age * 0.006) * exp(-age * 0.22) * keep;
  }
  float vis = e.y > 0.0 ? smoothstep(c.coverR * 0.98, c.coverR * 1.05, c.dc) : 1.0;
  float dens = inside * bands * (0.75 + 0.25 * grain) * vis;
  vec3 tint = palette3(c.c1, c.c2, c.c3, x * 0.9 + 0.05);
  vec3 col = mix(tint, vec3(1.0), 0.15) * dens * (0.3 + c.bass * 0.22 + wave * 0.55);
  col += mix(tint, vec3(1.0), 0.7) * sparkle * dens * 0.5;
  col += tint * ring(x, 1.3, 0.14) * 0.06 * vis * (1.0 + wave);
  col += mix(c.c1, vec3(1.0), 0.3) * ring(c.dc, c.coverR * 1.02, 0.012) * (0.12 + c.bass * 0.3);
  return vec4(col, dens * 0.35);
}
`,
  },
  {
    id: "073-parallax",
    name: "Параллакс звёзд",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 dir = normalize(vec2(1.0, 0.22));
  vec2 nrm = vec2(-dir.y, dir.x);
  float beat = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    beat += exp(-age * 2.5) * keep;
  }
  float wob = (noise(vec2(c.t * 0.04, 5.0)) - 0.5) * 0.3;
  float fog = fbm((c.p + dir * c.star * 0.004) * 1.7 + vec2(0.0, wob * 0.1));
  vec3 col = mix(c.c2, c.c3, fog) * smoothstep(0.45, 0.85, fog) * (0.08 + c.level * 0.06);
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float depth = 1.0 + fk * 0.9;
    float scale = 34.0 / depth;
    vec2 off = dir * c.star * 0.006 * depth * depth + vec2(0.0, wob * depth * 0.1);
    vec2 g = (c.p + off) * scale + fk * 31.7;
    vec2 id = floor(g);
    vec2 h = hash2(id + fk * 13.1);
    float on = step(0.6 + fk * 0.08, hash(id + 7.7 + fk));
    vec2 f = (g - id - 0.3 - 0.4 * h) / scale;
    float along = dot(f, dir) / (1.0 + c.level * fk * 0.6);
    float across = dot(f, nrm);
    float size = (0.6 + fk * 0.35 + h.y * 0.4) * c.px * (1.0 + (c.bass * 0.2 + beat * 0.2) * fk / 3.0);
    float sd = (along * along + across * across) / (size * size);
    float tw = 0.65 + 0.35 * (noise(vec2(c.t * (2.0 + h.x * 3.0), h.y * 50.0 + fk * 9.0)) - 0.5) * (1.0 + c.high * 2.0);
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h.x + fk * 0.21), vec3(1.0), 0.6 - fk * 0.08);
    float bright = 0.3 + fk * 0.22;
    col += tint * on * exp(-sd) * tw * bright * (0.8 + c.high * 0.4 + beat * 0.25 * fk);
  }
  return vec4(col, 0.22);
}
`,
  },
  {
    id: "074-black-hole",
    name: "Чёрная дыра",
    glsl: `
vec2 m074_rot(vec2 v, float a) { float s = sin(a), co = cos(a); return vec2(co * v.x - s * v.y, s * v.x + co * v.y); }
vec4 modeLayer(Ctx c) {
  float Rs = c.coverR * 0.98;
  vec2 d = c.p - c.cc;
  float r = max(c.dc, 0.0001);
  float E = Rs * 1.55;
  vec2 src = d * (1.0 - E * E / (r * r));
  vec2 bgp = src + c.cc + vec2(c.t * 0.006, c.t * 0.002);
  float gas = fbm(bgp * 2.2);
  vec3 col = palette3(c.c1, c.c2, c.c3, gas * 1.5 + 0.2) * smoothstep(0.4, 0.9, gas) * (0.2 + c.level * 0.1);
  vec2 g = bgp * 40.0;
  vec2 id = floor(g);
  vec2 h = hash2(id);
  vec2 f = (g - id - 0.2 - 0.6 * h) / 40.0;
  float st = step(0.86, hash(id + 2.3)) * exp(-dot(f, f) / pow((0.55 + h.y * 0.6) * c.px, 2.0)) * (0.5 + 0.5 * h.x);
  col += mix(palette3(c.c1, c.c2, c.c3, h.y), vec3(1.0), 0.6) * st * (0.6 + c.high * 0.5);
  float shadow = smoothstep(Rs * 1.02, Rs * 0.95, r);
  col *= 1.0 - shadow;
  vec2 e = m074_rot(d, 0.18);
  vec2 dp = vec2(e.x, e.y / 0.22);
  float rd = length(dp);
  float band = smoothstep(Rs * 1.2, Rs * 1.55, rd) * smoothstep(Rs * 3.6, Rs * 1.9, rd);
  vec2 dr = m074_rot(dp, c.star * 0.12);
  float turb = fbm(dr * 6.0) * 0.6 + 0.4 * noise(vec2(rd * 45.0, 2.0));
  float dopp = 1.0 + 0.7 * clamp(e.x / (Rs * 3.0), -1.0, 1.0);
  float behind = e.y > 0.0 ? 1.0 - shadow : 1.0;
  vec3 hot = mix(c.c1, vec3(1.0), 0.5);
  vec3 diskCol = mix(hot, mix(c.c2, c.c3, 0.5), smoothstep(Rs * 1.4, Rs * 3.2, rd));
  float flare = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    flare += exp(-age * 1.6) * keep;
  }
  col += diskCol * band * turb * dopp * behind * (0.35 + c.bass * 0.3 + flare * 0.15);
  vec2 hp = vec2(e.x, e.y / 0.8);
  float rh = length(hp);
  float halo = ring(rh, Rs * 1.32, Rs * 0.1) * smoothstep(-Rs * 0.2, Rs * 0.4, e.y) + ring(rh, Rs * 1.15, Rs * 0.05) * smoothstep(Rs * 0.2, -Rs * 0.4, e.y) * 0.5;
  col += diskCol * halo * (0.3 + c.bass * 0.2) * (0.8 + 0.2 * dopp);
  col += hot * ring(r, Rs * 1.04, 0.003 + c.px * 1.5) * (0.35 + flare * 0.4 + c.high * 0.2);
  return vec4(col, 0.5 + shadow * 0.5);
}
`,
  },
  {
    id: "075-comets",
    name: "Кометы",
    glsl: `
vec3 m075_comet(Ctx c, vec2 pos, vec2 vel, vec3 tint) {
  vec2 q = c.p - pos;
  float qq = dot(q, q);
  vec2 ion = normalize(pos - c.cc + vec2(0.0001));
  vec2 dust = normalize(ion * 0.45 - 0.55 * normalize(vel + vec2(0.00001)));
  float L = 0.16 + c.bass * 0.12;
  float r1 = dot(q, ion), a1 = max(r1, 0.0), b1 = min(r1, 0.0) / 0.004;
  float x1 = dot(q, vec2(-ion.y, ion.x)) / (0.002 + a1 * 0.045);
  float r2 = dot(q, dust), a2 = max(r2, 0.0), b2 = min(r2, 0.0) / 0.006;
  float x2 = dot(q, vec2(-dust.y, dust.x)) / (0.004 + a2 * 0.16);
  float hr = (2.2 + c.high * 1.5) * c.px;
  float t1 = exp(-a1 / L - x1 * x1 - b1 * b1) * (0.4 + c.high * 0.3);
  float t2 = exp(-a2 / (L * 0.7) - x2 * x2 - b2 * b2) * 0.3;
  float head = exp(-qq / (hr * hr));
  float coma = exp(-qq * 2000.0) * 0.35;
  return tint * (t1 * 0.55 + t2 + coma) + vec3(1.0) * (head + t1 * 0.45);
}
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  vec2 ctr = vec2(0.5 * c.aspect, 0.5);
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    float b = uBeats[i];
    vec2 h = hash2(vec2(fract(b * 0.1317) * 91.0, fract(b * 0.2713) * 37.0));
    float a0 = h.x * TAU;
    vec2 start = ctr + vec2(cos(a0) * c.aspect * 0.62, sin(a0) * 0.62);
    vec2 to = normalize(ctr - start);
    float tw = (h.y - 0.5) * 1.1;
    vec2 dirv = vec2(cos(tw) * to.x - sin(tw) * to.y, sin(tw) * to.x + cos(tw) * to.y);
    vec2 perp = vec2(-dirv.y, dirv.x);
    float sp = 0.13 + 0.12 * h.y;
    float bend = (h.x - 0.5) * 0.02;
    vec2 pos = start + dirv * sp * age + perp * bend * age * age;
    vec2 vel = dirv * sp + perp * 2.0 * bend * age;
    float br = smoothstep(0.0, 0.5, age) * (1.0 - smoothstep(8.0, 12.0, age)) * keep * (0.6 + c.level * 0.5);
    col += m075_comet(c, pos, vel, mix(mix(c.c1, c.c2, h.x), c.c3, h.y * h.y)) * br;
  }
  float tt = c.t * 0.025;
  vec2 pa = vec2(noise(vec2(tt, 2.0)) * c.aspect * 1.6 - 0.3 * c.aspect, noise(vec2(tt, 5.1)) * 1.6 - 0.3);
  vec2 pb = vec2(noise(vec2(tt - 0.025, 2.0)) * c.aspect * 1.6 - 0.3 * c.aspect, noise(vec2(tt - 0.025, 5.1)) * 1.6 - 0.3);
  col += m075_comet(c, pa, pa - pb, mix(c.c2, c.c3, 0.4)) * 0.55;
  vec2 g = c.p * 55.0;
  vec2 id = floor(g);
  vec2 h = hash2(id + 9.0);
  vec2 f = (g - id - 0.2 - 0.6 * h) / 55.0;
  float tw2 = 0.5 + 0.5 * noise(vec2(c.t * (1.0 + h.x * 2.0), h.y * 20.0));
  col += vec3(0.85) * step(0.88, hash(id + 0.4)) * exp(-dot(f, f) / pow(0.9 * c.px, 2.0)) * tw2 * (0.25 + c.high * 0.3);
  return vec4(col * 0.85, 0.12);
}
`,
  },
  {
    id: "076-pulsar",
    name: "Пульсар",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  float reach = length(max(c.cc, vec2(c.aspect, 1.0) - c.cc)) + 0.05;
  vec3 col = vec3(0.0);
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.4, fresh) : 1.0;
    float r = c.coverR + age * 0.26 + age * age * 0.012;
    float fade = (1.0 - smoothstep(reach * 0.9, reach, r)) * keep * (0.6 + 0.4 * exp(-age * 0.5));
    float gpos = (r - c.coverR) / (reach - c.coverR);
    vec3 tint = palette3(c.c1, c.c2, c.c3, gpos * 0.9 + fract(uBeats[i] * 0.0731) * 0.12);
    float span = 0.1 + age * 0.04;
    float wake = clamp((c.dc - (r - span)) / span, 0.0, 1.0);
    wake = wake * wake * step(c.dc, r) * 0.16;
    col += mix(tint, vec3(1.0), 0.2) * (ring(c.dc, r, 1.8 * c.px) * 0.9 + ring(c.dc, r, 0.02 + age * 0.006) * 0.4 + wake) * fade;
  }
  float ang = c.star * 0.05 + (fbm(vec2(c.t * 0.03, 4.0)) - 0.5) * 4.0;
  vec2 ax = vec2(cos(ang), sin(ang));
  float al = dot(d, ax), ac = dot(d, vec2(-ax.y, ax.x));
  float w = 0.006 + abs(al) * 0.09;
  float beam = exp(-pow(ac / w, 2.0)) * exp(-abs(al) * 1.6) * smoothstep(c.coverR * 0.9, c.coverR * 1.3, c.dc);
  vec3 beamCol = mix(c.c1, c.c2, smoothstep(0.0, 0.8, abs(al)));
  col += mix(beamCol, vec3(1.0), 0.3) * beam * (0.16 + c.high * 0.35);
  col += mix(c.c1, vec3(1.0), 0.25) * exp(-pow((c.dc - c.coverR) / (0.03 + c.bass * 0.05), 2.0)) * (0.15 + c.bass * 0.35);
  return vec4(col * 0.75, 0.0);
}
`,
  },
  {
    id: "077-milky-way",
    name: "Млечный путь",
    glsl: `
vec4 modeLayer(Ctx c) {
  float a = 0.42 + (noise(vec2(c.t * 0.01, 3.0)) - 0.5) * 0.1;
  vec2 ax = vec2(cos(a), sin(a));
  vec2 d = c.p - vec2(0.5 * c.aspect, 0.5);
  float u = dot(d, ax) + c.t * 0.004;
  float v = dot(d, vec2(-ax.y, ax.x));
  float vb = v + (fbm(vec2(u * 1.3, 2.0)) - 0.5) * 0.18;
  float band = exp(-vb * vb / (0.035 * (1.0 + c.bass * 0.35)));
  float clouds = fbm(vec2(u * 4.0, vb * 9.0) + 5.0);
  float rift = smoothstep(0.42, 0.68, fbm(vec2(u * 6.0, vb * 20.0) + 13.0)) * exp(-pow((vb - (noise(vec2(u * 2.5, 9.0)) - 0.5) * 0.08) / 0.05, 2.0));
  float glow = band * (0.35 + clouds * 0.9) * (1.0 - rift * 0.85);
  vec3 tint = palette3(c.c1, c.c2, c.c3, u * 0.6 + clouds * 0.5);
  vec3 col = mix(tint, vec3(1.0), band * 0.2) * glow * (0.24 + c.level * 0.16);
  float fresh = c.t - uBeats[0];
  for (int k = 0; k < 2; k++) {
    float scale = k == 0 ? 60.0 : 130.0;
    vec2 g = vec2(u, v) * scale;
    vec2 id = floor(g);
    vec2 h = hash2(id + float(k) * 21.0);
    vec2 f = (g - id - 0.2 - 0.6 * h) / scale;
    float on = step(0.95 - band * (1.0 - rift) * 0.5, hash(id + 3.3 + float(k)));
    float fl = 0.0;
    if (k == 0) {
      for (int i = 0; i < 8; i++) {
        float age = c.t - uBeats[i];
        if (age < 0.0 || age > 12.0) continue;
        float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
        fl += step(0.86, hash(id + fract(uBeats[i] * 0.37) * 100.0)) * exp(-age * 1.8) * keep;
      }
    }
    float size = (0.75 + h.y * 0.6 + fl * 1.2) * c.px;
    float tw = 0.55 + 0.45 * noise(vec2(c.t * (2.0 + h.x * 3.0), h.y * 40.0));
    col += mix(palette3(c.c1, c.c2, c.c3, h.x), vec3(1.0), 0.6) * on * exp(-dot(f, f) / (size * size)) * (tw * (0.3 + c.high * 0.35) + fl * 0.8) * (k == 0 ? 1.0 : 0.6);
  }
  return vec4(col, 0.15 + rift * band * 0.3);
}
`,
  },
  {
    id: "078-corona",
    name: "Корона",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - c.cc;
  vec2 dir = d / max(c.dc, 0.0001);
  float x = max(c.dc - c.coverR, 0.0) / c.coverR;
  float slow = c.t * 0.025;
  float n = fbm(dir * 2.2 + vec2(slow, -slow * 0.7));
  float streamer = pow(smoothstep(0.3, 0.8, n), 1.5);
  float len = 0.35 + streamer * 2.4 + c.bass * 0.9;
  float rays = 0.6 + 0.4 * noise(dir * 28.0 + vec2(slow * 2.0, 0.0));
  float corona = exp(-x / len) * (0.25 + streamer * 0.75) * rays;
  float flame = fbm(dir * 7.0 + vec2(-x * 2.5 + c.t * 0.08, slow));
  float prom = smoothstep(0.55, 0.8, flame) * exp(-x * 5.0) * (0.6 + c.mid);
  float outside = smoothstep(c.coverR * 0.97, c.coverR * 1.02, c.dc);
  vec3 hot = mix(c.c1, vec3(1.0), 0.45);
  vec3 col = mix(palette3(c.c2, c.c3, c.c1, n * 1.2), hot, exp(-x * 3.0)) * corona * (0.3 + c.level * 0.25);
  col += hot * prom * 0.4;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    float hb = hash(vec2(fract(uBeats[i] * 0.1931) * 57.0, 4.2));
    vec2 bdir = vec2(cos(hb * TAU), sin(hb * TAU));
    vec2 ctr = c.cc + bdir * (c.coverR + age * 0.22);
    vec2 rel = c.p - ctr;
    float rr = length(rel);
    float shell = ring(rr, 0.03 + age * 0.07, 0.008 + age * 0.006) * smoothstep(-0.3, 0.4, dot(rel / max(rr, 0.0001), bdir));
    col += mix(palette3(c.c1, c.c2, c.c3, hb + age * 0.05), vec3(1.0), 0.25) * shell * exp(-age * 0.35) * keep * 0.4;
  }
  col *= outside;
  col += hot * ring(c.dc, c.coverR, 0.006) * (0.2 + c.bass * 0.3);
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "079-quasar",
    name: "Квазар",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 Q = vec2(0.72 * c.aspect, 0.52) + (vec2(noise(vec2(c.t * 0.017, 1.0)), noise(vec2(c.t * 0.017, 6.0))) - 0.5) * 0.05;
  vec2 d = c.p - Q;
  float a = 1.05 + (fbm(vec2(c.t * 0.025, 2.0)) - 0.5) * 0.9;
  vec2 ax = vec2(cos(a), sin(a)), pr = vec2(-ax.y, ax.x);
  float al = dot(d, ax), ac = dot(d, pr);
  float aal = abs(al);
  float helix = sin(aal * 12.0 - c.star * 0.9) * min(aal, 0.3) * 0.06;
  float w = 0.0025 + aal * 0.025;
  float jet = exp(-pow((ac - helix) / w, 2.0)) * exp(-aal * 1.4) * smoothstep(0.0, 0.03, aal);
  float sheath = exp(-pow((ac - helix * 0.5) / (w * 5.0), 2.0)) * exp(-aal * 1.1) * 0.4;
  float knots = 0.0;
  float fresh = c.t - uBeats[0];
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float keep = float(i) > 6.5 ? 1.0 - smoothstep(0.0, 0.35, fresh) : 1.0;
    float k = age * 0.3;
    float kh = sin(k * 12.0 - c.star * 0.9) * min(k, 0.3) * 0.06;
    vec2 kd = vec2(aal - k, ac - kh);
    float kr = 0.006 + age * 0.004;
    knots += exp(-dot(kd, kd) / (kr * kr)) * exp(-age * 0.3) * keep;
  }
  float L = 0.4;
  vec2 ld = vec2(aal - L, ac);
  float lobeR = 0.012 * (1.0 + c.bass * 0.5);
  float lobe = exp(-dot(ld, ld) / lobeR) * (0.4 + fbm(vec2(aal, ac) * 9.0 + c.t * 0.02));
  float core = exp(-dot(d, d) / pow(0.006 + c.bass * 0.006, 2.0));
  float disk = exp(-pow(al / 0.004, 2.0) - pow(ac / 0.06, 2.0));
  float host = exp(-(al * al / 0.02 + ac * ac / 0.05));
  vec3 jetCol = palette3(c.c2, c.c3, c.c1, aal * 1.4);
  vec3 col = mix(jetCol, vec3(1.0), 0.35) * jet * (0.4 + c.high * 0.4);
  col += jetCol * sheath * (0.3 + c.level * 0.3);
  col += mix(jetCol, vec3(1.0), 0.5) * knots * 0.7;
  col += palette3(c.c3, c.c1, c.c2, ac * 2.0 + 0.3) * lobe * (0.45 + c.level * 0.2);
  col += mix(c.c1, vec3(1.0), 0.6) * core * (0.6 + c.bass * 0.4);
  col += c.c1 * disk * 0.45;
  col += c.c3 * host * 0.1;
  return vec4(col, host * 0.4);
}
`,
  }
);
