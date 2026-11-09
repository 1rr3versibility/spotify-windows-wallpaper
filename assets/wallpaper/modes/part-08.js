(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "080-swell",
    name: "Шёлковый блеск",
    glsl: `
float m080_fold(vec2 p, float t) {
  vec2 w = vec2(noise(p * 0.9 + vec2(t * 0.11, 3.7)), noise(p * 0.9 + vec2(7.3, -t * 0.09))) - 0.5;
  vec2 q = p + w * 0.55;
  float u = q.x * 0.82 + q.y * 0.57;
  float v = q.y * 0.82 - q.x * 0.57;
  float h = sin(u * 5.4 + t * 0.6 + sin(v * 1.7 - t * 0.35) * 1.3) * 0.55;
  h += sin(u * 7.1 - t * 0.45 + v * 1.4 + w.x * 4.0) * 0.22;
  h += sin(v * 2.3 + t * 0.3 + w.y * 3.0) * 0.18;
  return h;
}

vec4 modeLayer(Ctx c) {
  float t = c.star * 0.08 + c.t * 0.05;
  float e = 0.004;
  float h0 = m080_fold(c.p, t);
  float hx = m080_fold(c.p + vec2(e, 0.0), t);
  float hy = m080_fold(c.p + vec2(0.0, e), t);
  vec2 g = vec2(hx - h0, hy - h0) / e;
  vec3 n = normalize(vec3(-g * 0.22, 1.0));
  float la = t * 0.35;
  vec3 L = normalize(vec3(cos(la) * 0.7, sin(la) * 0.5 + 0.3, 0.6));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float nh = clamp(dot(n, H), 0.0, 1.0);
  vec2 gd = g / max(length(g), 0.0001);
  float aniso = 1.0 - abs(dot(gd, normalize(L.xy)));
  float sheen = pow(nh, 14.0 - c.bass * 6.0) * (0.45 + aniso * 0.55);
  float broad = pow(nh, 4.0);
  float k = h0 * 0.35 + c.p.x * 0.12 + c.p.y * 0.18 + t * 0.05;
  vec3 tint = palette3(c.c1, c.c2, c.c3, fract(k) );
  vec3 col = tint * (0.02 + diff * diff * 0.16 + broad * 0.1) * (0.85 + c.level * 0.3);
  col += mix(tint, vec3(1.0), 0.4) * sheen * (0.32 + c.bass * 0.45 + c.mid * 0.1);
  col += vec3(1.0) * pow(nh, 60.0) * (0.04 + c.high * 0.12);
  float a = 0.18 + (1.0 - diff) * 0.26;
  return vec4(col, a);
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
    name: "Плазменные разряды",
    glsl: `
float m083_h(float x) {
  return fract(sin(x * 12.9898 + 4.1) * 43758.5453);
}
float m083_off(float s, float k, float tt) {
  return (noise(vec2(s * 3.0 + tt, k)) - 0.5) * 0.24 + (noise(vec2(s * 9.0 - tt * 1.3, k + 5.0)) - 0.5) * 0.09 + (noise(vec2(s * 26.0 + tt * 0.7, k + 11.0)) - 0.5) * 0.03;
}
vec2 m083_bolt(vec2 p, vec2 a, vec2 b, float k, float tt, float w, float px) {
  vec2 ab = b - a;
  float len = max(length(ab), 0.001);
  vec2 dir = ab / len;
  vec2 n = vec2(-dir.y, dir.x);
  vec2 q = p - a;
  float s = dot(q, dir) / len;
  float d = dot(q, n);
  float env = smoothstep(0.0, 0.08, s) * smoothstep(1.0, 0.7, s);
  float o = m083_off(s, k, tt) * len * w;
  float dd = abs(d - o);
  float core = line(dd, px * 1.2) * env;
  float halo = exp(-dd * dd / 0.0018) * env;
  return vec2(core, halo);
}
vec2 m083_pt(vec2 a, vec2 b, float s, float k, float tt, float w) {
  vec2 ab = b - a;
  float len = length(ab);
  vec2 dir = ab / len;
  return a + ab * s + vec2(-dir.y, dir.x) * m083_off(s, k, tt) * len * w;
}
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float glow = 0.0;
  float tt = c.star * 0.12;
  float haze = fbm(c.p * 1.4 + vec2(tt * 0.6, -tt * 0.4));
  col += mix(c.c3, c.c2, haze) * smoothstep(0.35, 0.8, haze) * (0.05 + c.level * 0.06);
  for (int j = 0; j < 2; j++) {
    float fj = float(j);
    vec2 a = vec2(-0.1, 0.25 + 0.5 * fj + 0.1 * sin(tt * 0.7 + fj * 2.0));
    vec2 b = vec2(c.aspect + 0.1, 0.75 - 0.5 * fj + 0.1 * cos(tt * 0.6 + fj));
    vec2 r = m083_bolt(c.p, a, b, 30.0 + fj * 7.0, tt * 1.5, 0.7, c.px);
    float k = 0.1 + c.mid * 0.12;
    vec3 tint = j == 0 ? c.c1 : c.c2;
    col += mix(tint, vec3(1.0), 0.3) * (r.x * 0.35 + r.y * 0.12) * k * 2.0;
    glow += r.y * k;
  }
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 1.4) continue;
    float sd = fract(uBeats[i] * 0.61803) * 9.0 + float(i) * 0.37;
    float fl = smoothstep(0.0, 0.04, age) * exp(-age * 3.2);
    vec2 ctr = vec2(c.aspect * (0.2 + 0.6 * m083_h(sd)), 0.25 + 0.5 * m083_h(sd + 1.3));
    float ang = (m083_h(sd + 2.7) - 0.5) * 1.6;
    vec2 dir = vec2(cos(ang), sin(ang));
    float hl = 0.55 * c.aspect;
    vec2 a = ctr - dir * hl;
    vec2 b = ctr + dir * hl;
    float k = 20.0 + sd * 3.0;
    float bt = tt + age * 0.25;
    vec2 r = m083_bolt(c.p, a, b, k, bt, 0.55, c.px);
    for (int m = 0; m < 2; m++) {
      float fm = float(m);
      float s0 = 0.25 + 0.4 * m083_h(sd + 4.1 + fm * 1.7);
      vec2 o = m083_pt(a, b, s0, k, bt, 0.55);
      float ba = ang + (m083_h(sd + 5.3 + fm) < 0.5 ? -1.0 : 1.0) * (0.5 + 0.5 * m083_h(sd + 6.1 + fm));
      vec2 e = o + vec2(cos(ba), sin(ba)) * (0.25 + 0.2 * m083_h(sd + 7.9 + fm));
      vec2 rb = m083_bolt(c.p, o, e, k + 3.0 + fm * 4.0, bt, 0.7, c.px);
      r += rb * 0.6;
    }
    vec3 tint = palette3(c.c1, c.c2, c.c3, m083_h(sd + 8.8));
    float amp = fl * (0.7 + c.bass * 0.5);
    col += mix(tint, vec3(1.0), 0.55) * r.x * amp;
    col += tint * r.y * amp * 0.35;
    vec2 g = c.p - ctr;
    col += tint * exp(-dot(g, g) / 0.12) * amp * 0.06;
    glow += (r.y * 0.6 + 0.15) * amp;
  }
  return vec4(col, clamp(0.12 + glow * 0.25, 0.0, 0.4));
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
    name: "Призматическая дымка",
    glsl: `
float m085_veil(float s, float w) {
  float a = 0.5 + 0.5 * sin(s * 5.0 + w * 3.0);
  float b = 0.5 + 0.5 * sin(s * 8.3 - w * 2.2 + 1.7);
  float d = 0.5 + 0.5 * sin(s * 2.6 + w * 4.1 + 4.0);
  return pow(a, 6.0) * 0.6 + pow(b, 8.0) * 0.35 + pow(d, 3.0) * 0.4;
}

vec4 modeLayer(Ctx c) {
  vec2 dir = vec2(0.82, 0.57);
  vec2 nrm = vec2(-dir.y, dir.x);
  float tm = c.star * 0.06;
  vec2 q = c.p * 1.2;
  float w = fbm(q * 0.8 + vec2(tm, -tm * 0.7));
  float w2 = fbm(q * 1.6 + vec2(-tm * 0.5, tm * 0.9) + w * 0.8);
  float s = dot(c.p, dir) + (w - 0.5) * 0.4 - tm * 0.9;
  float along = dot(c.p, nrm);
  float split = 0.05 + 0.03 * sin(along * 1.7 + tm * 2.0) + c.level * 0.012;
  float r = m085_veil(s - split, w2);
  float g = m085_veil(s, w2);
  float b = m085_veil(s + split, w2);
  float haze = smoothstep(0.2, 0.75, w2) * 0.55 + 0.45;
  float glow = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    glow += exp(-age * 0.9);
  }
  glow = min(glow, 1.5);
  vec3 col = c.c1 * r + c.c2 * g + c.c3 * b;
  float white = smoothstep(0.55, 1.1, min(r, min(g, b)));
  col = mix(col, vec3(1.0) * (r + g + b) / 3.0, white * 0.35);
  float gain = 0.42 + c.level * 0.22 + c.bass * 0.1 + glow * 0.08;
  col *= haze * gain;
  float sheen = pow(max(g - 0.6, 0.0) * 2.5, 2.0) * (0.04 + c.high * 0.12);
  col += mix(c.c2, vec3(1.0), 0.6) * sheen * haze;
  float a = 0.14 + haze * (r + g + b) * 0.08;
  return vec4(col, a);
}
`,
  },
  {
    id: "086-mist",
    name: "Жидкий хром",
    glsl: `
float m086_h(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.97 + vec2(13.0, 7.0); a *= 0.5; }
  return v / 0.875;
}
vec4 modeLayer(Ctx c) {
  float s = c.star * 0.05;
  vec2 q = c.p * 1.3;
  vec2 w = vec2(fbm(q * 0.7 + vec2(s, -s * 0.6)), fbm(q * 0.7 + vec2(5.2 - s * 0.5, 1.3 + s * 0.4)));
  vec2 r = q + (w - 0.5) * 1.6 + vec2(s * 0.3, s * 0.2);
  float e = 0.006;
  float h0 = m086_h(r);
  float hx = m086_h(r + vec2(e, 0.0));
  float hy = m086_h(r + vec2(0.0, e));
  vec2 g = vec2(hx - h0, hy - h0) / e;
  float amp = 0.55 + c.level * 0.25;
  vec3 n = normalize(vec3(-g * amp, 1.0));
  vec3 v = vec3(0.0, 0.0, -1.0);
  vec3 rd = reflect(v, n);
  float band = rd.x * 0.9 + rd.y * 1.3 + h0 * 0.8 + s * 0.15;
  vec3 env = palette3(c.c1, c.c2, c.c3, band * 0.5);
  float stripe = 0.5 + 0.5 * sin(band * 5.0);
  stripe = smoothstep(0.3, 0.8, stripe);
  vec3 chrome = mix(env * 0.35, mix(env, vec3(1.0), 0.35), stripe);
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 4.0) continue;
    pulse += exp(-age * 1.6) * smoothstep(0.0, 0.08, age);
  }
  pulse = min(pulse, 1.2);
  vec3 l1 = normalize(vec3(-0.5, 0.6, 0.65));
  vec3 l2 = normalize(vec3(0.6, -0.3, 0.75));
  float sp1 = pow(max(dot(rd, l1), 0.0), 36.0);
  float sp2 = pow(max(dot(rd, l2), 0.0), 60.0);
  float bend = clamp(length(g) * 0.35, 0.0, 1.0);
  float glint = (sp1 + sp2 * 0.6) * (0.35 + bend * 0.9) * (0.6 + c.bass * 0.9 + pulse * 0.5);
  float fres = pow(1.0 - n.z, 2.0);
  vec3 col = chrome * (0.2 + c.level * 0.08 + pulse * 0.05);
  col += mix(c.c1, vec3(1.0), 0.6) * glint;
  col += mix(c.c2, vec3(1.0), 0.3) * fres * (0.25 + c.high * 0.3);
  return vec4(col, 0.18 + fres * 0.15 + (1.0 - stripe) * 0.08);
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
