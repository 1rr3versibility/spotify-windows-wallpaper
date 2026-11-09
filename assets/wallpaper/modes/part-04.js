(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "040-godrays",
    name: "Лучи сквозь облака",
    glsl: `
float m040_beat(float t) {
  float b = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    b += exp(-age * 1.6);
  }
  return min(b, 1.5);
}
vec4 modeLayer(Ctx c) {
  vec2 src = vec2(c.aspect * (0.25 + 0.5 * noise(vec2(c.t * 0.035, 1.7))), 1.12);
  vec2 d = c.p - src;
  float r = length(d);
  float ang = atan(d.x, -d.y);
  float drift = c.t * 0.05;
  float rays = smoothstep(0.36, 0.78, fbm(vec2(ang * 6.0 + drift * 0.3, drift)));
  rays *= 0.55 + 0.45 * noise(vec2(ang * 38.0, drift * 2.0 + 3.0));
  float beat = m040_beat(c.t);
  float fall = exp(-r * 1.15) * smoothstep(0.0, 0.3, r);
  vec3 tint = mix(palette3(c.c1, c.c2, c.c3, ang * 0.22 + 0.15), vec3(1.0), 0.3);
  vec3 col = tint * rays * fall * (0.22 + c.bass * 0.3 + beat * 0.16);
  vec2 cq = vec2(c.p.x * 1.4 + drift * 0.7, c.uv.y * 3.2 - drift * 0.2);
  float cl = fbm(cq);
  float top = smoothstep(0.55, 0.95, c.uv.y);
  float cloud = smoothstep(0.46, 0.68, cl) * top;
  float lining = smoothstep(0.4, 0.48, cl) * (1.0 - smoothstep(0.5, 0.6, cl)) * top * exp(-r * 1.4);
  col *= 1.0 - cloud * 0.65;
  col += mix(c.c1, vec3(1.0), 0.5) * lining * (0.22 + c.high * 0.35 + beat * 0.1);
  return vec4(col, cloud * 0.35);
}
`,
  },
  {
    id: "041-flare",
    name: "Блик линзы",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 L = vec2(c.aspect * (0.16 + 0.34 * noise(vec2(c.t * 0.03, 4.1))), 0.6 + 0.3 * noise(vec2(c.t * 0.037, 8.3)));
  vec2 C = vec2(0.5 * c.aspect, 0.5);
  vec2 v = C - L;
  vec2 d = c.p - L;
  float r = length(d);
  float beat = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    beat += exp(-age * 2.2);
  }
  beat = min(beat, 1.5);
  vec3 col = vec3(0.0);
  vec3 warm = mix(c.c1, vec3(1.0), 0.6);
  col += warm * (exp(-r * r / 0.0012) * 0.8 + exp(-r * r / 0.02) * 0.22) * (0.6 + c.level * 0.6);
  float ang = atan(d.y, d.x);
  float near = exp(-r * 5.0);
  if (near > 0.01) {
    float spikes = pow(abs(cos(ang * 3.0 + noise(vec2(c.t * 0.1, 2.0)) * 2.0)), 60.0) + pow(abs(cos(ang * 4.0 + 1.1)), 90.0) * 0.6;
    col += warm * spikes * near * (0.22 + c.high * 0.6);
  }
  float sw = 2.5 * c.px;
  col += mix(c.c2, vec3(1.0), 0.5) * exp(-d.y * d.y / (sw * sw)) * exp(-abs(d.x) * 1.8) * (0.22 + beat * 0.35 + c.bass * 0.2);
  float hr = 0.32 + c.bass * 0.04;
  col += (c.c1 * ring(r, hr - 0.014, 0.01) + c.c2 * ring(r, hr, 0.01) + c.c3 * ring(r, hr + 0.014, 0.01)) * 0.12 * (0.6 + c.level);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, 3.3));
    float h2 = hash(vec2(fi, 5.9));
    float k = 0.55 + fi * 0.32 + h * 0.15;
    vec2 g = L + v * k;
    float s = 0.018 + 0.075 * hash(vec2(fi, 7.1));
    vec2 gd = c.p - g;
    vec2 aq = abs(gd);
    float hx = max(aq.x * 0.866 + aq.y * 0.5, aq.y);
    float dist = mix(length(gd), hx, step(0.5, h2));
    if (dist > s + 0.02) continue;
    float fill = smoothstep(s, s - 0.006, dist);
    float rim = ring(dist, s, 0.004);
    vec3 tint = palette3(c.c1, c.c2, c.c3, h * 1.7);
    col += tint * (fill * 0.065 + rim * 0.11) * (0.5 + c.level * 0.8 + beat * 0.3);
  }
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "042-spotlights",
    name: "Прожекторы",
    glsl: `
vec4 modeLayer(Ctx c) {
  float haze = fbm(c.p * vec2(2.2, 3.0) + vec2(c.t * 0.04, -c.t * 0.02));
  vec3 col = vec3(0.0);
  vec4 kicks = vec4(0.0);
  for (int j = 0; j < 8; j++) {
    float age = c.t - uBeats[j];
    if (age < 0.0 || age > 5.0) continue;
    float idx = floor(hash(vec2(uBeats[j], 1.3)) * 4.0);
    float e = exp(-age * 2.2);
    kicks += e * vec4(step(idx, 0.5), step(abs(idx - 1.0), 0.5), step(abs(idx - 2.0), 0.5), step(2.5, idx));
  }
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 base = vec2(c.aspect * (0.14 + fi * 0.24), -0.06);
    float a = (noise(vec2(c.t * 0.09 + fi * 3.7, fi * 11.0)) - 0.5) * 1.3 + (1.5 - fi) * 0.14;
    vec2 dir = vec2(sin(a), cos(a));
    vec2 d = c.p - base;
    float al = dot(d, dir);
    float pe = dot(d, vec2(dir.y, -dir.x));
    float w = 0.01 + max(al, 0.0) * (0.26 + c.bass * 0.08);
    float cone = smoothstep(1.0, 0.55, abs(pe) / w) * step(0.0, al);
    float kick = i == 0 ? kicks.x : (i == 1 ? kicks.y : (i == 2 ? kicks.z : kicks.w));
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, fi * 0.27 + 0.1), vec3(1.0), 0.25);
    float I = (0.2 + c.level * 0.14 + kick * 0.28) * exp(-al * 0.7);
    col += tint * cone * I * (0.35 + haze * 1.2);
    col += mix(tint, vec3(1.0), 0.5) * exp(-dot(d, d) / 0.0016) * (0.4 + kick * 0.8);
  }
  return vec4(col, 0.3);
}
`,
  },
  {
    id: "043-prism",
    name: "Призма",
    glsl: `
float m043_sq(float x) { return x * x; }
float m043_tri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float m043_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec4 modeLayer(Ctx c) {
  vec2 P = vec2(c.aspect * 0.36, 0.52);
  float rot = (noise(vec2(c.t * 0.05, 2.0)) - 0.5) * 0.5;
  vec2 d = c.p - P;
  float cr = cos(rot), sr = sin(rot);
  vec2 q = vec2(cr * d.x - sr * d.y, sr * d.x + cr * d.y);
  float sz = 0.11;
  float tri = m043_tri(q, sz);
  float env = 0.0;
  vec3 col = vec3(0.0);
  float a0 = -0.1 - rot * 0.6;
  float spread = 0.22 + c.bass * 0.12;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 8.0) continue;
    env += exp(-age * 2.0);
    float h = hash(vec2(uBeats[i], 5.1));
    float x = 0.05 + h * 0.9;
    float pa = a0 + (x - 0.5) * spread;
    float pr = sz + age * 0.42;
    vec2 pp = P + pr * vec2(cos(pa), sin(pa));
    vec2 dp = c.p - pp;
    float dd = dot(dp, dp);
    if (dd > 0.006) continue;
    vec3 tint = hue(palette3(c.c1, c.c2, c.c3, x * 0.95), (x - 0.5) * 0.8);
    col += mix(tint, vec3(1.0), 0.4) * (exp(-dd / 0.00004) + exp(-dd / 0.0012) * 0.2) * exp(-age * 0.25) * (0.7 + c.high * 0.8);
  }
  float ang = atan(d.y, d.x);
  float x = (ang - a0) / spread + 0.5;
  float rr = length(d);
  float mask = smoothstep(0.0, 0.07, x) * smoothstep(1.0, 0.93, x) * step(0.0, d.x) * smoothstep(sz * 0.5, sz * 1.3, rr);
  vec3 spec = hue(palette3(c.c1, c.c2, c.c3, x * 0.95), (x - 0.5) * 0.8);
  float bands = 0.65 + 0.35 * noise(vec2(x * 28.0, c.t * 0.2));
  col += spec * mask * bands * exp(-rr * 0.55) * (0.26 + c.level * 0.2 + min(env, 1.5) * 0.08);
  vec2 S = vec2(-0.1, P.y + 0.16 + (noise(vec2(c.t * 0.04, 9.0)) - 0.5) * 0.1);
  float bd = m043_seg(c.p, S, P);
  float inBeam = step(0.0, tri);
  vec3 white = mix(c.c1, vec3(1.0), 0.7);
  col += white * (exp(-bd * bd / (c.px * c.px * 4.0)) * 0.55 + exp(-bd * bd / 0.0006) * 0.12) * inBeam * (0.6 + c.level * 0.5);
  float edge = exp(-m043_sq(tri / (c.px * 1.6)));
  float inside = smoothstep(0.0, -0.01, tri);
  col += mix(c.c3, vec3(1.0), 0.6) * edge * (0.45 + c.high * 0.3);
  col += mix(c.c2, c.c3, q.y / sz + 0.5) * inside * (0.08 + 0.06 * noise(q * 18.0 + c.t * 0.2));
  return vec4(col, inside * 0.25);
}
`,
  },
  {
    id: "044-lasergrid",
    name: "Лазерные нити",
    glsl: `
float m044_sq(float x) { return x * x; }
vec3 m044_famColor(Ctx c, int k) {
  vec3 base = k == 0 ? c.c1 : (k == 1 ? c.c2 : c.c3);
  return mix(base, vec3(1.0), 0.3);
}
vec4 modeLayer(Ctx c) {
  vec2 C0 = vec2(0.5 * c.aspect, 0.5);
  float T = c.star;
  float L = 0.55 * c.aspect + 0.6;
  vec3 col = vec3(0.0);
  float moire = 1.0;
  float cover = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float spd = k == 0 ? 0.021 : (k == 1 ? -0.014 : 0.009);
    float th = fk * 2.09 + 0.4 + T * spd;
    vec2 C = C0 + vec2(noise(vec2(T * 0.03, fk * 7.1)) - 0.5, noise(vec2(fk * 3.3, T * 0.03)) - 0.5) * vec2(0.5 * c.aspect, 0.4);
    vec2 q = c.p - C;
    vec3 fcol = m044_famColor(c, k);
    float gr = 0.5 + 0.5 * cos(dot(q, vec2(cos(th), sin(th))) * 70.0);
    moire *= gr;
    for (int j = 0; j < 5; j++) {
      float fj = float(j);
      float li = fk * 5.0 + fj;
      float an = th + (fj - 2.0) * 0.045;
      vec2 dir = vec2(cos(an), sin(an));
      vec2 nrm = vec2(-dir.y, dir.x);
      float off = (fj - 2.0) * 0.17 + (noise(vec2(T * 0.05, li * 1.7)) - 0.5) * 0.12;
      float d = abs(dot(q, nrm) - off);
      float s = dot(q, dir);
      float core = exp(-m044_sq(d / (c.px * 1.1)));
      float glow = exp(-m044_sq(d / (c.px * 6.0)));
      float halo = exp(-m044_sq(d / 0.03));
      float vr = 0.45 + 0.55 * noise(vec2(s * 1.3 + T * 0.08 * (fj - 2.0), li * 2.9));
      float breathe = 0.7 + 0.3 * sin(T * 0.21 + li * 1.3);
      float lineB = (core * 0.55 + glow * 0.16 + halo * 0.05) * vr * breathe;
      float dirSign = fract(li * 0.618) > 0.5 ? 1.0 : -1.0;
      float pulse = 0.0;
      for (int i = 0; i < 4; i++) {
        float age = c.t - uBeats[i];
        if (age < 0.0 || age > 3.0) continue;
        float sel = smoothstep(0.35, 0.6, fract(uBeats[i] * 0.618 + li * 0.377));
        float s0 = dirSign * (-L + age * 1.25);
        float bead = exp(-m044_sq((s - s0) / 0.07)) + 0.35 * exp(-m044_sq((s - s0 + dirSign * 0.15) / 0.18));
        pulse += sel * bead * exp(-age * 0.7);
      }
      float pw = exp(-m044_sq(d / (c.px * 2.5))) + 0.3 * exp(-m044_sq(d / 0.012));
      col += fcol * lineB * (0.65 + c.level * 0.5 + c.high * 0.25);
      col += mix(fcol, vec3(1.0), 0.45) * pulse * pw * (0.8 + c.bass * 0.4);
      cover += halo;
    }
  }
  vec3 mc = mix(c.c2, c.c3, 0.5 + 0.5 * sin(T * 0.05));
  col += mc * smoothstep(0.35, 0.9, moire) * (0.05 + c.mid * 0.05);
  return vec4(col, 0.12 + min(cover, 1.5) * 0.08);
}
`,
  },
  {
    id: "045-neon",
    name: "Неоновые трубки",
    glsl: `
float m045_sq(float x) { return x * x; }
float m045_glow(float d, float px, float bass) {
  float w2 = 0.0005 * (1.0 + bass * 1.5);
  return exp(-m045_sq(d / (px * 2.2))) * 0.9 + exp(-d * d / w2) * 0.35 + 0.003 / (d + 0.03);
}
float m045_flick(float t, float fi) {
  float f = 0.88 + 0.12 * noise(vec2(t * 6.0, fi * 9.0));
  float dn = noise(vec2(t * 0.5, fi * 4.0 + 20.0));
  return f * mix(0.45, 1.0, smoothstep(0.08, 0.2, dn));
}
float m045_tri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
vec4 modeLayer(Ctx c) {
  vec2 qa = c.p - vec2(c.aspect * 0.27, 0.34);
  float dA = abs(length(qa) - 0.1);
  float sA = atan(qa.y, qa.x) / TAU + 0.5;
  vec2 qb = c.p - vec2(c.aspect * 0.74, 0.64);
  vec2 bb = vec2(0.16, 0.09);
  vec2 ob = abs(qb) - bb + 0.035;
  float dB = abs(length(max(ob, 0.0)) + min(max(ob.x, ob.y), 0.0) - 0.035);
  float sB = atan(qb.y, qb.x) / TAU + 0.5;
  float x0 = 0.12 * c.aspect, x1 = 0.88 * c.aspect;
  float yw = 0.16 + 0.035 * sin(c.p.x * 14.0);
  float slope = 0.035 * 14.0 * cos(c.p.x * 14.0);
  float dyc = abs(c.p.y - yw) / sqrt(1.0 + slope * slope);
  float dxo = max(0.0, max(x0 - c.p.x, c.p.x - x1));
  float dC = length(vec2(dxo, dyc));
  float sC = clamp((c.p.x - x0) / (x1 - x0), 0.0, 1.0);
  vec2 qd = c.p - vec2(c.aspect * 0.52, 0.8);
  float dD = abs(m045_tri(qd, 0.06));
  float sD = atan(qd.y, qd.x) / TAU + 0.5;
  float pA = 0.0, pB = 0.0, pC = 0.0, pD = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 4.0) continue;
    float hb = hash(vec2(uBeats[i], 2.7));
    float idx = floor(hb * 4.0);
    float sp = age * 0.6 + fract(hb * 13.1);
    float e = exp(-age * 0.9);
    if (idx < 0.5) { float ds = abs(fract(sA - sp + 0.5) - 0.5); pA += exp(-ds * ds / 0.003) * e; }
    else if (idx < 1.5) { float ds = abs(fract(sB - sp + 0.5) - 0.5); pB += exp(-ds * ds / 0.003) * e; }
    else if (idx < 2.5) { float ds = sC - age * 0.6; pC += exp(-ds * ds / 0.003) * e; }
    else { float ds = abs(fract(sD - sp + 0.5) - 0.5); pD += exp(-ds * ds / 0.003) * e; }
  }
  vec3 col = vec3(0.0);
  float base = 0.32 + c.level * 0.18;
  vec3 tA = c.c1, tB = c.c2, tC = c.c3, tD = mix(c.c1, c.c2, 0.5);
  float gA = m045_glow(dA, c.px, c.bass), gB = m045_glow(dB, c.px, c.bass), gC = m045_glow(dC, c.px, c.bass), gD = m045_glow(dD, c.px, c.bass);
  col += mix(tA, vec3(1.0), 0.35) * gA * (base * m045_flick(c.t, 0.0) + pA * 0.6);
  col += mix(tB, vec3(1.0), 0.35) * gB * (base * m045_flick(c.t, 1.0) + pB * 0.6);
  col += mix(tC, vec3(1.0), 0.35) * gC * (base * m045_flick(c.t, 2.0) + pC * 0.6);
  col += mix(tD, vec3(1.0), 0.35) * gD * (base * m045_flick(c.t, 3.0) + pD * 0.6);
  col += vec3(1.0) * (exp(-m045_sq(dA / c.px)) + exp(-m045_sq(dB / c.px)) + exp(-m045_sq(dC / c.px)) + exp(-m045_sq(dD / c.px))) * (0.12 + c.high * 0.25);
  return vec4(col, 0.3);
}
`,
  },
  {
    id: "046-caustics",
    name: "Блики на дне",
    glsl: `
float m046_cell(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = 0; y < 3; y++) {
    for (int x = 0; x < 3; x++) {
      vec2 g = vec2(float(x) - 1.0, float(y) - 1.0);
      vec2 n = i + g;
      vec2 hh = hash2(n);
      vec2 o = 0.5 + 0.5 * sin(t * (0.6 + hh.yx * 0.9) + hh * TAU);
      vec2 r = g + 0.1 + o * 0.8 - f;
      float dd = dot(r, r);
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}
vec4 modeLayer(Ctx c) {
  vec2 q = c.p * 5.0;
  q += (vec2(noise(c.p * 2.0 + c.t * 0.1), noise(c.p * 2.0 + vec2(5.0, c.t * 0.1))) - 0.5) * (0.8 + c.bass * 1.2);
  float reach = length(vec2(c.aspect, 1.0)) * 1.1;
  vec2 rad = (c.p - c.cc) / max(c.dc, 0.001);
  float rip = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 12.0) continue;
    float rr = c.coverR + age * 0.3;
    rip += ring(c.dc, rr, 0.05) * (1.0 - smoothstep(reach * 0.8, reach, rr)) * (0.4 + 0.6 * exp(-age * 0.3));
  }
  q += rad * rip * 1.2;
  float e1 = m046_cell(q, c.t * 0.25);
  float e2 = m046_cell(q * 1.6 + 3.1, c.t * 0.31);
  float l1 = exp(-e1 * e1 / 0.006);
  float l2 = exp(-e2 * e2 / 0.004);
  float k = l1 * 0.6 + l2 * 0.35 + l1 * l2 * 1.2;
  vec3 tint = mix(palette3(c.c1, c.c2, c.c3, noise(c.p * 1.2 + c.t * 0.03) * 1.5), vec3(1.0), 0.35);
  vec3 col = tint * k * (0.16 + c.level * 0.14 + c.high * 0.12);
  col += tint * rip * 0.06;
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "047-dustbeams",
    name: "Пиксельная пыль",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 dir = normalize(vec2(0.45, -1.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 d = c.p - vec2(c.aspect * 0.12, 1.08);
  float along = dot(d, dir), across = dot(d, nrm);
  float m = noise(vec2(across * 5.0, c.t * 0.04)) + 0.5 * noise(vec2(across * 13.0, c.t * 0.06 + 7.0));
  float shaft = smoothstep(0.62, 1.0, m);
  float pass = 0.7 + 0.3 * noise(vec2(c.t * 0.08, 3.0));
  float fall = smoothstep(-0.05, 0.2, along) * exp(-along * 0.8);
  float env = smoothstep(-0.15, 0.1, across) * smoothstep(1.3, 0.75, across);
  float beat = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    beat += exp(-age * 1.8);
  }
  beat = min(beat, 1.5);
  float light = shaft * fall * env * pass;
  vec3 tint = mix(palette3(c.c1, c.c2, c.c3, across * 0.4 + 0.1), vec3(1.0), 0.45);
  vec3 col = tint * light * (0.2 + c.level * 0.14 + beat * 0.1);
  vec2 sway = (vec2(noise(c.p * 2.0 + c.t * 0.07), noise(c.p * 2.0 + vec2(3.0, c.t * 0.07))) - 0.5) * (0.6 + beat * 0.5);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float sc = k == 0 ? 16.0 : 27.0;
    vec2 g = c.p * sc + vec2(c.t * 0.25, -c.t * 0.4) * (1.0 + fk * 0.6) + sway * sc * 0.06;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    vec2 h = hash2(cell + fk * 17.0);
    float hp = hash(cell + 3.3 + fk);
    float dd = length(f - (0.2 + 0.6 * h)) / sc;
    float size = c.px * (1.4 + hp * 2.2) * (1.0 + c.high * 0.6);
    float tw = 0.5 + 0.5 * noise(vec2(hp * 40.0, c.t * 1.5));
    float mote = (exp(-dd * dd / (size * size)) + 0.15 * exp(-dd * dd / (size * size * 9.0))) * step(0.8, hp);
    col += mix(c.c1, vec3(1.0), 0.7) * mote * tw * (light * 2.4 + 0.05) * (0.6 + c.high * 0.9 + beat * 0.4) * (k == 0 ? 1.0 : 0.7);
  }
  return vec4(col, 0.18 * (1.0 - light));
}
`,
  },
  {
    id: "048-halo",
    name: "Радужное гало",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  vec2 d = c.p - c.cc;
  float ang = atan(d.y, d.x);
  vec2 dirv = d / max(c.dc, 0.001);
  float reach = length(vec2(c.aspect, 1.0)) * 1.15;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 16.0) continue;
    float r = c.coverR + age * 0.26 + age * age * 0.004;
    float disp = 0.006 + age * 0.009;
    float w = 0.005 + age * 0.0025;
    float fade = (1.0 - smoothstep(reach * 0.8, reach, r)) * (0.5 + 0.5 * exp(-age * 0.4));
    vec3 base = palette3(c.c1, c.c2, c.c3, fract(uBeats[i] * 0.137) + age * 0.05 + noise(dirv * 1.5 + uBeats[i]) * 0.6);
    col += (hue(base, -0.6) * ring(c.dc, r - disp, w) + base * ring(c.dc, r, w) + hue(base, 0.6) * ring(c.dc, r + disp, w)) * fade * 0.32;
    col += vec3(1.0) * ring(c.dc, r, 1.5 * c.px) * fade * 0.14 * exp(-age * 0.5);
  }
  float hr = c.coverR * 2.4 + c.bass * 0.02;
  float var = 0.5 + noise(dirv * 2.0 + c.t * 0.05);
  vec3 halo = c.c1 * ring(c.dc, hr - 0.012, 0.008) + c.c2 * ring(c.dc, hr, 0.012) + c.c3 * ring(c.dc, hr + 0.02, 0.026) * 0.6;
  col += halo * (0.12 + c.level * 0.16) * var;
  float side = sign(d.x);
  vec2 sd = c.p - (c.cc + vec2(side * hr * 1.03, 0.0));
  float dog = exp(-(sd.x * sd.x / 0.0005 + sd.y * sd.y / 0.003));
  col += mix(c.c1, c.c3, clamp(0.5 + side * sd.x * 25.0, 0.0, 1.0)) * dog * (0.22 + c.bass * 0.35);
  col += mix(c.c2, vec3(1.0), 0.4) * exp(-d.y * d.y / (c.px * c.px * 2.5)) * exp(-abs(d.x) * 0.9) * smoothstep(c.coverR, c.coverR * 1.6, abs(d.x)) * (0.06 + c.high * 0.1);
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "049-bokeh",
    name: "Шестигранное боке",
    glsl: `
vec4 modeLayer(Ctx c) {
  float env = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 5.0) continue;
    env += exp(-age * 2.5);
  }
  env = min(env, 1.5);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float sc = 3.5 + fk * 2.6;
    vec2 g = c.p * sc + vec2(c.t * (0.02 + fk * 0.012), c.t * (0.035 + fk * 0.015)) + vec2(noise(vec2(c.t * 0.05, fk * 3.0)), noise(vec2(fk * 5.0, c.t * 0.05))) * 1.5;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float h = hash(cell + fk * 31.7);
    if (h < 0.35) continue;
    vec2 cpos = 0.3 + 0.4 * hash2(cell + fk * 7.3);
    float rad = (0.15 + 0.1 * hash(cell + 2.1)) * (1.0 + c.bass * 0.12);
    vec2 q = f - cpos;
    vec2 aq = abs(q);
    float hx = max(aq.x * 0.866 + aq.y * 0.5, aq.y);
    float dist = mix(length(q), hx, 0.55);
    float aa = sc * c.px * (1.5 + (2.0 - fk) * 1.5);
    float disk = smoothstep(rad, rad - aa, dist);
    float rim = smoothstep(rad * 0.75, rad - aa * 0.5, dist) * disk;
    float body = disk * (0.35 + 0.65 * rim) * (0.85 + 0.15 * noise(q * 30.0 + h * 50.0));
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, hash(cell + 9.1)), vec3(1.0), 0.15);
    float pulse = 1.0 + env * 1.1 * step(0.62, hash(cell + 4.4));
    float tw = 1.0 + c.high * 0.8 * fk * 0.5 * noise(vec2(h * 30.0, c.t * 2.0));
    col += tint * body * (0.3 - fk * 0.06) * pulse * tw * (0.7 + c.level * 0.6);
  }
  return vec4(col, 0.1);
}
`,
  }
);
