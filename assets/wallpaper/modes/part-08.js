(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "080-swell",
    name: "Зыбь",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float cover = 0.0;
  float ha = c.t - c.hits.x;
  float flare = ha >= 0.0 ? exp(-ha * 2.2) : 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float depth = fi / 5.0;
    float base = 0.5 - depth * 0.4;
    float f = 2.2 - depth * 1.3;
    float amp = (0.02 + depth * 0.07) * (0.75 + c.bass * 0.9 + flare * 0.4);
    float x = c.p.x * f;
    float n1 = noise(vec2(x + c.t * (0.1 + depth * 0.16) + fi * 11.3, fi * 4.7 + c.t * 0.03));
    float n2 = noise(vec2(x * 2.7 - c.t * (0.07 + depth * 0.1) + fi * 3.1, fi * 9.1 + c.t * 0.02));
    float h = n1 * 0.75 + n2 * 0.25;
    float y = base + amp * (pow(h, 1.6) * 2.0 - 0.6);
    float below = y - c.uv.y;
    float body = smoothstep(-c.px * 1.5, c.px * 1.5, below);
    vec3 tint = palette3(c.c1, c.c2, c.c3, fi * 0.17 + 0.05);
    float bb = max(below, 0.0);
    vec3 water = tint * (0.04 + 0.14 * exp(-bb * (30.0 - depth * 18.0))) * (0.6 + depth * 0.6);
    float glint = pow(noise(vec2(c.p.x * (14.0 - depth * 8.0) + c.t * 0.3 + fi * 5.0, bb * (320.0 - depth * 180.0) + fi * 7.0)), 7.0) * exp(-bb * 14.0);
    water += mix(tint, vec3(1.0), 0.5) * glint * (0.2 + c.high * 0.5);
    col = mix(col, water, body);
    float crestMask = smoothstep(0.35, 0.8, h);
    float foam = line(below, 0.0025 + depth * 0.004) * crestMask;
    float spray = line(below + 0.008 + depth * 0.01, 0.01 + depth * 0.012) * crestMask * smoothstep(0.4, 0.8, n2);
    col += mix(tint, vec3(1.0), 0.6) * (foam + spray * (0.3 + c.high * 0.7)) * (0.18 + c.high * 0.3 + flare * 0.3) * (0.5 + depth * 0.6);
    cover = max(cover, body);
  }
  return vec4(col, cover * 0.6);
}
`,
  },
  {
    id: "081-clouds",
    name: "Облака",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 sc = vec2(1.3, 2.4);
  vec2 q = c.p * sc + vec2(c.t * 0.035, c.t * 0.004);
  float w = fbm(q * 0.6 + vec2(-c.t * 0.02, 3.0));
  vec2 qq = q + vec2(w * 1.2, w * 0.4);
  float d = fbm(qq);
  vec2 dir = normalize((c.cc - c.p) * sc + vec2(1e-4));
  float d2 = fbm(qq + dir * 0.12);
  float thr = 0.44 - c.bass * 0.09;
  float dens = smoothstep(thr, thr + 0.26, d);
  float lit = clamp((d - d2) * 5.0 + 0.5, 0.0, 1.0);
  float sun = exp(-c.dc * 1.5);
  vec3 shade = mix(c.c3 * 0.08, c.c2 * 0.32, lit);
  vec3 rim = mix(c.c1, vec3(1.0), 0.4) * pow(lit, 3.0) * (0.15 + sun * (0.45 + c.level * 0.35));
  float edge = dens * (1.0 - dens) * 4.0;
  float reach = length(vec2(c.aspect, 1.0)) * 1.05;
  vec3 pulse = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.3;
    float fade = (1.0 - smoothstep(reach * 0.7, reach, r)) * (0.5 + 0.5 * exp(-age * 0.4));
    pulse += palette3(c.c1, c.c2, c.c3, (c.dc - c.coverR) * 0.5) * ring(c.dc, r, 0.07 + age * 0.02) * fade;
  }
  vec3 col = (shade + rim) * dens;
  col += mix(pulse, vec3(dot(pulse, vec3(0.33))), 0.2) * (0.25 + edge * 0.6) * (0.3 + dens);
  col += mix(c.c1, vec3(1.0), 0.3) * edge * sun * c.high * 0.3;
  return vec4(col, dens * 0.4);
}
`,
  },
  {
    id: "082-fire",
    name: "Пламя",
    glsl: `
vec4 modeLayer(Ctx c) {
  float ha = c.t - c.hits.x;
  float flare = ha >= 0.0 ? exp(-ha * 2.0) : 0.0;
  vec2 q = vec2(c.p.x * 2.6, c.uv.y * 1.8 - c.t * 0.75);
  float w = noise(q * 1.3 + vec2(0.0, -c.t * 0.4));
  float n = fbm(q + vec2(w * 0.9 - 0.45, 0.0));
  float height = 0.3 + c.bass * 0.2 + flare * 0.1 + (noise(vec2(c.p.x * 1.3, c.t * 0.15)) - 0.5) * 0.16;
  float heat = smoothstep(0.15, 0.95, n * 1.6 + 0.1 - c.uv.y / height);
  vec3 col = mix(c.c3 * 0.35, c.c1, smoothstep(0.08, 0.5, heat));
  col = mix(col, mix(c.c2, vec3(1.0), 0.3), smoothstep(0.6, 1.0, heat));
  col *= heat * 0.75;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float s = 12.0 + fk * 7.0;
    vec2 g = vec2(c.p.x * s, c.uv.y * s - c.star * (1.4 + fk * 0.6));
    g.x += (noise(vec2(c.uv.y * 3.0 + fk * 5.0, c.t * 0.3)) - 0.5) * 3.0;
    vec2 id = floor(g);
    vec2 h = hash2(id + fk * 17.0);
    vec2 f = fract(g) - 0.5 - (h - 0.5) * 0.6;
    float rr = 0.05 + 0.05 * h.y;
    float on = step(0.72 - c.high * 0.3, h.x);
    float flick = 0.5 + 0.5 * noise(vec2(c.t * 3.0 + h.y * 50.0, fk));
    float life = 1.0 - smoothstep(0.05, 0.7 + c.bass * 0.2, c.uv.y);
    col += mix(palette3(c.c1, c.c2, c.c3, h.y), vec3(1.0), 0.35) * exp(-dot(f, f) / (rr * rr)) * on * flick * life * (0.35 + c.high * 0.4);
  }
  return vec4(col, heat * 0.4 + smoothstep(0.5, 0.0, c.uv.y) * 0.2);
}
`,
  },
  {
    id: "083-storm",
    name: "Гроза вдали",
    glsl: `
float m083_off(float y, float seed) {
  return (noise(vec2(y * 9.0, seed * 13.0)) - 0.5) * 0.1 + (noise(vec2(y * 34.0, seed * 7.0)) - 0.5) * 0.025 + sin(y * 140.0 + seed * 5.0) * 0.003;
}
vec4 modeLayer(Ctx c) {
  float hz = 0.2;
  float cl = fbm(vec2(c.p.x * 1.6 + c.t * 0.02, c.uv.y * 3.5 - c.t * 0.01));
  float band = smoothstep(0.78, 0.48, c.uv.y) * smoothstep(hz - 0.02, hz + 0.12, c.uv.y);
  float clouds = band * smoothstep(0.3, 0.7, cl);
  float ground = smoothstep(hz + 0.004, hz - 0.004, c.uv.y);
  vec3 col = mix(c.c3, c.c2, cl) * clouds * (0.05 + c.bass * 0.12);
  col += c.c3 * line(c.uv.y - hz - 0.01, 0.03) * (0.04 + c.bass * 0.1);
  vec3 flash = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 1.6) continue;
    float seed = uBeats[i];
    vec2 hs = hash2(vec2(seed, 1.7));
    float x0 = c.aspect * (0.1 + 0.8 * hs.x);
    float top = 0.6 + 0.12 * hs.y;
    float yy = c.uv.y;
    float fl = exp(-age * 4.5) + 0.45 * exp(-pow((age - 0.22) * 10.0, 2.0));
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, fract(hs.x * 5.31 + hs.y * 2.17)), vec3(1.0), 0.5);
    vec2 e = (c.p - vec2(x0, top - 0.06)) * vec2(0.8, 1.7);
    float sky = exp(-dot(e, e) / 0.05) * (0.25 + clouds * 1.5) * (1.0 - ground);
    flash += tint * sky * 0.28 * fl;
    if (abs(c.p.x - x0) > 0.3) continue;
    if (yy < hz - 0.12 || yy > top) continue;
    float dx = abs(c.p.x - x0 - m083_off(yy, seed));
    float span = step(hz, yy) * smoothstep(top, top - 0.04, yy);
    float mid = mix(hz, top, 0.5 + 0.25 * fract(hs.y * 7.7));
    float side = fract(hs.x * 13.1) < 0.5 ? -1.0 : 1.0;
    float bx = x0 + (noise(vec2(mid * 9.0, seed * 13.0)) - 0.5) * 0.1 + (mid - yy) * side * 0.45 + sin(yy * 120.0 + seed) * 0.006;
    float bspan = step(yy, mid) * smoothstep(mid - 0.15, mid - 0.04, yy);
    float db = abs(c.p.x - bx);
    float core = line(dx, 1.4 * c.px) * span + line(db, 1.0 * c.px) * bspan * 0.6;
    float halo = exp(-dx * dx / 0.0012) * span + exp(-db * db / 0.0008) * bspan * 0.5;
    float refl = ground * exp(-pow((c.p.x - x0) / 0.04, 2.0)) * smoothstep(hz - 0.12, hz, c.uv.y) * (0.5 + 0.5 * sin(c.uv.y * 900.0 + c.p.x * 40.0));
    flash += tint * (core * 0.85 + halo * 0.18 + refl * 0.25) * fl;
  }
  col += flash;
  vec2 rq = vec2((c.p.x + c.uv.y * 0.18) * 150.0, c.uv.y * 5.0 + c.t * 4.5);
  float rid = floor(rq.x);
  float rh = hash(vec2(rid, 3.0));
  float seg = fract(rq.y + rh * 10.0);
  float rain = step(0.72, rh) * smoothstep(0.0, 0.08, seg) * smoothstep(0.3, 0.08, seg) * line(fract(rq.x) - 0.5, 0.15);
  col += mix(c.c2, vec3(1.0), 0.4) * rain * (0.03 + c.high * 0.12) * (1.0 - ground);
  return vec4(col, clouds * 0.35 + ground * 0.35);
}
`,
  },
  {
    id: "084-caustics",
    name: "Под водой",
    glsl: `
float m084_caustic(vec2 uv, float time) {
  vec2 p = mod(uv * TAU, TAU) - 250.0;
  vec2 i = p;
  float cc = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    cc += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  cc /= 5.0;
  cc = 1.17 - pow(cc, 1.4);
  return pow(abs(cc), 8.0);
}
vec4 modeLayer(Ctx c) {
  vec2 wv = vec2(noise(c.p * 1.3 + c.t * 0.05), noise(c.p * 1.3 + 7.0 - c.t * 0.04)) - 0.5;
  float cau = m084_caustic(c.p * 0.75 + wv * 0.12, c.t * 0.3 + 23.0);
  float reach = length(vec2(c.aspect, 1.0)) * 1.05;
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.28;
    pulse += ring(c.dc, r, 0.09 + age * 0.015) * (1.0 - smoothstep(reach * 0.7, reach, r)) * (0.5 + 0.5 * exp(-age * 0.4));
  }
  vec3 tint = mix(c.c1, c.c2, smoothstep(0.3, 0.7, noise(c.p * 1.1 + vec2(c.t * 0.03, 0.0))));
  float depth = smoothstep(0.0, 1.0, c.uv.y);
  vec3 col = c.c3 * 0.05 * depth;
  col += mix(tint, vec3(1.0), 0.25) * min(cau, 1.5) * (0.18 + c.high * 0.22 + pulse * 0.35) * (0.45 + depth * 0.55);
  float rays = pow(noise(vec2((c.p.x + c.uv.y * 0.35) * 5.0, c.t * 0.08)), 3.0) * smoothstep(0.1, 1.0, c.uv.y);
  col += mix(c.c2, c.c3, 0.5) * rays * (0.12 + c.bass * 0.18);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float s = 7.0 + fk * 6.0;
    vec2 g = vec2(c.p.x * s, c.uv.y * s - c.star * (0.8 + fk * 0.4));
    g.x += sin(g.y * 0.9 + fk * 3.0) * 0.25;
    vec2 id = floor(g);
    vec2 h = hash2(id + fk * 23.0);
    vec2 f = fract(g) - 0.5 - (h - 0.5) * 0.5;
    float rr = 0.06 + 0.1 * h.y * (1.0 + c.bass * 0.5);
    float b = ring(length(f), rr, 0.02) + exp(-dot(f - rr * 0.35, f - rr * 0.35) / (rr * rr * 0.04)) * 0.6;
    col += mix(tint, vec3(1.0), 0.5) * b * step(0.8 - c.high * 0.2, h.x) * (0.18 + c.high * 0.25);
  }
  return vec4(col, 0.3);
}
`,
  },
  {
    id: "085-polar",
    name: "Полярная ночь",
    glsl: `
vec4 modeLayer(Ctx c) {
  float yr = 0.08 + fbm(vec2(c.p.x * 1.8, 7.0)) * 0.16;
  float mount = smoothstep(yr + c.px, yr - c.px, c.uv.y);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 g = c.p * (60.0 + fk * 45.0);
    vec2 id = floor(g);
    vec2 h = hash2(id + fk * 31.0);
    vec2 f = fract(g) - 0.5 - (h - 0.5) * 0.7;
    float tw = 0.4 + 0.6 * noise(vec2(c.star * 0.9 + h.y * 40.0, fk));
    col += mix(palette3(c.c1, c.c2, c.c3, h.y), vec3(1.0), 0.6) * step(0.93, h.x) * exp(-dot(f, f) / 0.01) * tw * (0.3 + c.high * 0.6) * (1.0 - fk * 0.4);
  }
  float wf = fbm(vec2(c.p.x * 0.7 + c.t * 0.03, c.t * 0.02));
  float yl = 0.48 + (wf - 0.5) * 0.6;
  float above = c.uv.y - yl;
  float ray = noise(vec2(c.p.x * 26.0 + wf * 8.0 + c.t * 0.25, c.t * 0.15));
  ray = 0.3 + 0.7 * ray * ray;
  float wave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 8.0) continue;
    float hx = c.aspect * hash(vec2(uBeats[i], 3.3));
    float front = abs(c.p.x - hx) - age * 0.45;
    wave += exp(-front * front / 0.012) * exp(-age * 0.45);
  }
  float up = max(above, 0.0);
  float curtain = smoothstep(-0.012, 0.006, above) * exp(-up * (5.5 - c.bass * 2.5)) * ray;
  float edge = line(above, 0.01) * (0.5 + 0.5 * ray);
  vec3 aur = mix(c.c2, c.c1, smoothstep(0.0, 0.2, up));
  aur = mix(aur, c.c3, smoothstep(0.15, 0.45, up));
  col += mix(aur, vec3(1.0), 0.1) * (curtain * (0.28 + c.level * 0.2 + wave * 0.3) + edge * (0.3 + c.high * 0.35 + wave * 0.4));
  col *= 1.0 - mount;
  col += aur * line(c.uv.y - yr, 1.5 * c.px) * 0.18 + c.c3 * 0.025 * mount;
  return vec4(col, 0.2 + mount * 0.7);
}
`,
  },
  {
    id: "086-mist",
    name: "Туман над водой",
    glsl: `
vec4 modeLayer(Ctx c) {
  float hz = 0.4;
  float fog = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float fy = hz + 0.015 + fk * 0.075;
    float f = fbm(vec2(c.p.x * (1.0 + fk * 0.5) - c.t * (0.03 + fk * 0.015) + fk * 7.0, c.uv.y * 4.0 + fk * 3.0 + c.t * 0.01));
    float band = exp(-pow((c.uv.y - fy) / (0.04 + fk * 0.035), 2.0));
    fog += band * smoothstep(0.3 - c.bass * 0.1, 0.75, f) * (0.65 - fk * 0.15);
  }
  float under = smoothstep(hz + 0.003, hz - 0.003, c.uv.y);
  float depth = max(hz - c.uv.y, 0.0);
  float wy = 0.4 / (depth + 0.02);
  float rip = noise(vec2(c.p.x * (3.0 + wy * 0.8) + c.t * 0.2, wy * 2.0 - c.t * 0.6));
  float width = 0.025 + depth * 0.5 + c.bass * 0.03;
  float path = exp(-pow((c.p.x - c.cc.x) / width, 2.0));
  vec3 moon = mix(c.c1, vec3(1.0), 0.45);
  vec3 col = moon * path * pow(rip, 4.0) * (0.35 + c.high * 0.6) * under;
  col += c.c3 * 0.05 * under * smoothstep(0.0, 0.3, depth);
  vec2 ctr = vec2(c.cc.x, hz - 0.13);
  float e = length((c.p - ctr) * vec2(1.0, 4.0));
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = age * 0.22;
    float fade = (1.0 - smoothstep(c.aspect * 0.5, c.aspect * 0.8, r)) * (0.45 + 0.55 * exp(-age * 0.35));
    vec3 tint = palette3(c.c1, c.c2, c.c3, e * 0.5);
    col += mix(tint, vec3(1.0), 0.2) * (ring(e, r, 0.012 + age * 0.003) + ring(e, r - 0.05, 0.01) * 0.4) * fade * under * (0.25 + c.bass * 0.25);
  }
  vec3 fogc = mix(c.c3, mix(c.c1, vec3(1.0), 0.35), smoothstep(0.2, 0.9, fog) * 0.6 + exp(-abs(c.p.x - c.cc.x) * 2.0) * 0.3);
  col += fogc * fog * (0.22 + c.level * 0.12);
  col += moon * line(c.uv.y - hz, 0.004) * 0.1 * (0.5 + path);
  return vec4(col, fog * 0.2 + under * 0.35);
}
`,
  },
  {
    id: "087-rain",
    name: "Дождь на воде",
    glsl: `
float m087_drops(vec2 p, float s, float tm, float seed) {
  vec2 g = p * s;
  vec2 id0 = floor(g);
  float acc = 0.0;
  for (int j = 0; j < 9; j++) {
    vec2 o = vec2(mod(float(j), 3.0) - 1.0, floor(float(j) / 3.0) - 1.0);
    vec2 id = id0 + o;
    float h = hash(id + seed);
    float tt = tm * (0.35 + 0.3 * h) + h * 7.0;
    float k = floor(tt);
    float age = fract(tt);
    vec2 hp = hash2(id + k * 1.31 + seed);
    vec2 pos = id + 0.2 + 0.6 * hp;
    float on = step(0.35, fract(hp.x * 7.13 + hp.y * 3.71));
    float x = (length(g - pos) - age * 1.3) / (0.05 + age * 0.07);
    acc += (exp(-x * x) - 0.4 * exp(-(x + 1.6) * (x + 1.6))) * (1.0 - age) * (1.0 - age) * on;
  }
  return acc;
}
vec4 modeLayer(Ctx c) {
  float d1 = m087_drops(c.p, 6.0, c.star * 1.1, 0.0);
  float d2 = m087_drops(c.p + 3.7, 11.0, c.star * 1.5, 9.0);
  vec3 col = (mix(c.c1, vec3(1.0), 0.3) * max(d1, 0.0) * 0.6 + mix(c.c2, vec3(1.0), 0.3) * max(d2, 0.0) * 0.45) * (0.18 + c.high * 0.3);
  float reach = length(vec2(c.aspect, 1.0)) * 1.08;
  vec3 tint = palette3(c.c1, c.c2, c.c3, (c.dc - c.coverR) * 0.55);
  float rings = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 14.0) continue;
    float r = c.coverR + age * 0.2 + age * age * 0.004;
    float fade = (1.0 - smoothstep(reach * 0.8, reach * 1.05, r)) * (0.6 + 0.4 * exp(-age * 0.3));
    rings += (ring(c.dc, r, 2.0 * c.px + age * 0.0015) + ring(c.dc, r, 0.02 + age * 0.004) * 0.4 + ring(c.dc, r - 0.035 - age * 0.004, 0.012) * 0.3) * fade;
  }
  col += mix(tint, vec3(1.0), 0.15) * rings * (0.4 + c.bass * 0.35);
  col += tint * smoothstep(c.coverR * (1.8 + c.bass * 0.6), c.coverR, c.dc) * 0.18 * c.bass;
  float sheen = pow(noise(c.p * vec2(3.0, 18.0) + vec2(c.t * 0.05, -c.t * 0.1)), 5.0);
  col += c.c3 * sheen * (0.06 + c.high * 0.1);
  return vec4(col, 0.25);
}
`,
  },
  {
    id: "088-wind",
    name: "Ветер",
    glsl: `
vec4 modeLayer(Ctx c) {
  float gust = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    float front = -0.3 + age * 0.75 * (0.8 + 0.4 * hash(vec2(uBeats[i], 1.0)));
    gust += exp(-pow((c.p.x - front) / 0.3, 2.0)) * exp(-age * 0.35);
  }
  float warp = fbm(vec2(c.p.x * 0.6 - c.t * 0.05, c.p.y * 1.4 + c.t * 0.02));
  vec2 q = vec2(c.p.x, c.p.y + (warp - 0.5) * (0.28 + c.bass * 0.25 + gust * 0.05));
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float rows = 40.0 + fk * 32.0;
    float v = noise(vec2(q.x * (1.4 + fk * 0.9) - c.star * (0.3 + fk * 0.14), q.y * rows + fk * 13.0));
    float s = pow(v, 8.0);
    float row = floor(q.y * rows + fk * 13.0 + 0.5);
    vec3 tint = palette3(c.c1, c.c2, c.c3, hash(vec2(row, fk)) * 0.9 + fk * 0.2);
    col += mix(tint, vec3(1.0), 0.15) * s * (0.14 + c.high * 0.22 + gust * 0.25) * (1.0 - fk * 0.25);
  }
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float sc = 6.0 + fk * 5.0;
    vec2 g = vec2(q.x * sc - c.star * (1.0 + fk * 0.6), q.y * sc + fk * 4.0);
    g.y += (noise(vec2(g.x * 0.3, c.t * 0.2 + fk)) - 0.5) * 1.2;
    vec2 id = floor(g);
    vec2 h = hash2(id + fk * 41.0);
    vec2 f = fract(g) - 0.5 - (h - 0.5) * 0.5;
    float a = h.y * TAU + c.t * (0.5 + h.x);
    vec2 rf = vec2(cos(a) * f.x + sin(a) * f.y, -sin(a) * f.x + cos(a) * f.y) * vec2(1.0, 2.4);
    float petal = exp(-dot(rf, rf) / (0.006 + c.bass * 0.004));
    col += mix(palette3(c.c1, c.c2, c.c3, h.x * 2.0), vec3(1.0), 0.3) * petal * step(0.75 - c.level * 0.2, h.x) * (0.3 + gust * 0.25);
  }
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "089-lava",
    name: "Трещины лавы",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 g = c.p * 3.2 + vec2(c.t * 0.02, -c.t * 0.012);
  vec2 id0 = floor(g);
  vec2 f = fract(g);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 nid = id0;
  for (int j = 0; j < 9; j++) {
    vec2 o = vec2(mod(float(j), 3.0) - 1.0, floor(float(j) / 3.0) - 1.0);
    vec2 id = id0 + o;
    vec2 h = hash2(id);
    vec2 pt = o + 0.5 + 0.7 * (h - 0.5) + 0.12 * vec2(sin(c.t * (0.07 + 0.08 * h.x) + h.y * TAU), cos(c.t * (0.06 + 0.07 * h.y) + h.x * TAU));
    float d = length(f - pt);
    if (d < f1) { f2 = f1; f1 = d; nid = id; } else if (d < f2) { f2 = d; }
  }
  float edge = f2 - f1;
  float reach = length(vec2(c.aspect, 1.0)) * 1.05;
  float heatwave = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float r = c.coverR + age * 0.26;
    heatwave += ring(c.dc, r, 0.1 + age * 0.012) * (1.0 - smoothstep(reach * 0.7, reach, r)) * (0.5 + 0.5 * exp(-age * 0.4));
  }
  float flick = 0.75 + 0.25 * noise(g * 5.0 + vec2(c.t * 0.6, -c.t * 0.4)) * (1.0 + c.high);
  float crack = exp(-edge * (16.0 - c.bass * 7.0 - heatwave * 4.0)) * flick;
  float crust = fbm(g * 1.6 + hash(nid) * 9.0);
  float cool = hash(nid + 3.0);
  vec3 hot = mix(c.c3 * 0.5, c.c1, smoothstep(0.1, 0.6, crack));
  hot = mix(hot, mix(c.c2, vec3(1.0), 0.45), smoothstep(0.65, 1.0, crack));
  vec3 col = hot * crack * (0.38 + c.level * 0.14 + heatwave * 0.25);
  col += c.c3 * (0.02 + 0.05 * crust * crust) * (0.6 + cool * 0.8) * (1.0 + heatwave);
  col += c.c1 * exp(-edge * 4.0) * 0.06 * (1.0 + c.bass);
  return vec4(col, 0.5);
}
`,
  }
);
