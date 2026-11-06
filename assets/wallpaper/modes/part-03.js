(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "030-fireflies",
    name: "Светлячки",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float S = 5.0 + fl * 3.0;
    vec2 off = vec2(fl * 7.3, fl * 3.1);
    vec2 q = c.p * S + off;
    vec2 id0 = floor(q - 0.5);
    for (int j = 0; j < 4; j++) {
      vec2 id = id0 + vec2(mod(float(j), 2.0), floor(float(j) / 2.0));
      float h = hash(id + fl * 13.7);
      if (h < 0.3) continue;
      vec2 h2 = hash2(id + fl * 5.1);
      float wn = noise(vec2(c.t * 0.07 + h * 40.0, h2.x * 30.0)) * 6.0 + h2.y * TAU;
      vec2 pos = id + 0.5 + 0.3 * vec2(cos(wn * 1.3), sin(wn * 1.7));
      vec2 d = q - pos;
      float r2 = dot(d, d);
      if (r2 > 0.2) continue;
      float blink = smoothstep(0.42, 0.82, noise(vec2(c.t * 0.45 + h * 91.0, h2.y * 17.0)));
      float dd = length((pos - off) / S - c.cc);
      float a0 = c.t - c.hits.x - dd * 0.9;
      float a1 = c.t - c.hits.y - dd * 0.9;
      float flare = (a0 > 0.0 ? exp(-a0 * 2.2) : 0.0) + (a1 > 0.0 ? exp(-a1 * 2.2) * 0.6 : 0.0);
      float b = blink * (0.45 + c.high * 0.8) + flare * h2.x * 0.9;
      vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h2.x * 0.7 + h * 0.3), vec3(1.0, 1.0, 0.88), 0.3);
      float core = exp(-r2 / (0.0016 * (1.0 + fl)));
      float halo = exp(-r2 / (0.022 * (1.0 + c.bass * 1.4)));
      col += tint * b * (core * 1.3 + halo * 0.32) * (L == 0 ? 1.0 : 0.55);
    }
  }
  return vec4(col * 0.85, 0.12);
}
`,
  },
  {
    id: "031-snow",
    name: "Снег",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  vec2 p = c.p;
  float aw = c.t - c.hits.x;
  float wave = exp(-pow((c.dc - (c.coverR + aw * 0.7)) / 0.08, 2.0)) * exp(-aw * 1.2);
  p += (c.p - c.cc) / max(c.dc, 0.001) * wave * 0.025;
  float wind = (noise(vec2(c.t * 0.04, 2.0)) - 0.5) * 1.2;
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float S = 3.0 + fl * 4.5;
    float depth = 1.0 / (1.0 + fl * 0.7);
    vec2 q = p * S;
    q.y += c.star * (0.09 * depth + 0.02) * S;
    q.x += wind * S * depth + fl * 17.0;
    vec2 id0 = floor(q - 0.5);
    for (int j = 0; j < 4; j++) {
      vec2 id = id0 + vec2(mod(float(j), 2.0), floor(float(j) / 2.0));
      float h = hash(id + fl * 9.1);
      if (h < 0.5 - fl * 0.06) continue;
      vec2 h2 = hash2(id + fl * 3.7);
      float sway = noise(vec2(c.t * 0.35 + h * 50.0, fl)) - 0.5;
      vec2 pos = id + 0.5 + (h2 - 0.5) * 0.5 + vec2(sway * 0.22, 0.0);
      float d = length(q - pos);
      if (d > 0.4) continue;
      float r = (0.03 + 0.045 * h2.y) * (1.0 + c.bass * 0.45) * (L == 0 ? 1.8 : 1.0);
      float blur = L == 0 ? r * 0.8 : c.px * S * 1.2;
      float flake = smoothstep(r + blur, r - blur * 0.3, d);
      float glow = exp(-d * d / (r * r * 6.0)) * 0.22;
      float tw = 0.7 + abs(sway) * (0.6 + c.high * 0.8);
      vec3 tint = mix(vec3(1.0), palette3(c.c1, c.c2, c.c3, h2.x), 0.35);
      col += tint * (flake * (L == 0 ? 0.3 : 0.6) + glow) * depth * tw * (0.7 + c.level * 0.5);
    }
  }
  col += mix(c.c2, vec3(1.0), 0.5) * wave * 0.08;
  return vec4(col, 0.05);
}
`,
  },
  {
    id: "032-rainglass",
    name: "Дождь на стекле",
    glsl: `
vec3 m032_drop(vec2 d, float r, vec2 uv, Ctx c, float pxs) {
  d.y *= 1.12;
  float l = length(d);
  float inside = smoothstep(r, r - pxs * 1.5, l);
  if (inside <= 0.0) return vec3(0.0);
  vec3 lens = palette3(c.c1, c.c2, c.c3, (1.0 - uv.y) * 0.7 + uv.x * 0.25 + d.y * 2.0) * 0.22;
  float rim = smoothstep(r * 0.55, r, l) * inside;
  float spec = exp(-dot(d - vec2(-0.3, 0.35) * r, d - vec2(-0.3, 0.35) * r) / (r * r * 0.03));
  float caustic = exp(-pow((l - r * 0.8) / (r * 0.12), 2.0)) * smoothstep(0.0, -r, d.y) * 0.5;
  return lens * inside + vec3(1.0) * spec * 0.7 + mix(c.c1, vec3(1.0), 0.5) * (rim * 0.12 + caustic * 0.3);
}
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float S = 13.0;
  vec2 q = c.p * S;
  vec2 id = floor(q);
  float pxs = c.px * S;
  float h = hash(id + 3.3);
  vec2 h2 = hash2(id + 1.9);
  float life = fract(c.t * (0.015 + h * 0.03) + h2.x);
  float grow = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.7, life);
  if (h > 0.6) {
    float r = (0.05 + 0.3 * pow(h2.y, 3.0)) * grow * (1.0 + c.bass * 0.15);
    col += m032_drop(q - id - 0.5 - (h2 - 0.5) * (0.9 - 2.0 * r), r, c.uv, c, pxs);
  }
  for (int i = 0; i < 4; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 9.0) continue;
    float hb = hash(id + fract(uBeats[i] * 0.371) * 97.0);
    if (hb < 0.82) continue;
    vec2 hp = hash2(id + uBeats[i] * 0.013);
    float r = (0.16 + 0.2 * hp.x) * smoothstep(0.0, 0.12, age) * smoothstep(9.0, 4.0, age);
    vec2 d = q - id - 0.5 - (hp - 0.5) * 0.4;
    col += m032_drop(d, r, c.uv, c, pxs) * 1.1;
    float splash = ring(length(d), r + age * 0.6, 0.03) * exp(-age * 5.0);
    col += mix(c.c2, vec3(1.0), 0.5) * splash * 0.5;
  }
  float SX = 9.0;
  float xs = c.p.x * SX;
  for (int k = 0; k < 2; k++) {
    float cx = floor(xs - 0.5) + float(k);
    float hs = hash(vec2(cx, 7.7));
    if (hs < 0.35) continue;
    float yy = 1.2 - fract(c.star * (0.025 + hs * 0.035) + hash(vec2(cx, 2.1))) * 1.5;
    float pathx = cx + 0.5 + (noise(vec2(c.uv.y * 5.0, cx * 3.1)) - 0.5) * 0.7;
    float headx = cx + 0.5 + (noise(vec2(yy * 5.0, cx * 3.1)) - 0.5) * 0.7;
    float dx = (xs - pathx) / SX;
    float above = c.uv.y - yy;
    float trailW = 0.0022 * (1.0 - smoothstep(0.0, 0.5, above));
    float trail = step(0.0, above) * exp(-dx * dx / (trailW * trailW + 1e-6)) * exp(-above * 3.0);
    float bead = step(0.82, hash(vec2(cx, floor(c.uv.y * 70.0)))) * trail;
    col += mix(c.c3, vec3(1.0), 0.4) * (trail * 0.18 + bead * 0.3);
    vec2 dh = vec2((xs - headx) / SX, c.uv.y - yy) * S;
    col += m032_drop(dh, 0.3 + hs * 0.12, c.uv, c, pxs) * (0.9 + c.high * 0.4);
  }
  return vec4(col, 0.18);
}
`,
  },
  {
    id: "033-bokeh",
    name: "Боке",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float S = 2.4 + fl * 1.9;
    vec2 off = vec2(fl * 11.0, fl * 4.0);
    vec2 q = c.p * S + off + vec2(c.star * 0.01 * (1.0 + fl), 0.0);
    vec2 id0 = floor(q - 0.5);
    for (int j = 0; j < 4; j++) {
      vec2 id = id0 + vec2(mod(float(j), 2.0), floor(float(j) / 2.0));
      float h = hash(id + fl * 21.3);
      if (h < 0.4) continue;
      vec2 h2 = hash2(id + fl * 8.9);
      vec2 drift = vec2(noise(vec2(c.t * 0.05 + h * 30.0, 1.0)), noise(vec2(c.t * 0.05 + h2.x * 30.0, 4.0))) - 0.5;
      vec2 pos = id + 0.5 + (h2 - 0.5) * 0.3 + drift * 0.35;
      float d = length(q - pos);
      float r = (0.16 + 0.22 * h2.y) * (1.0 + c.bass * 0.3);
      float edge = 0.012 + 0.03 * fl;
      float disc = smoothstep(r, r - edge, d);
      if (disc <= 0.0) continue;
      float rim = smoothstep(r * 0.6, r - edge, d);
      float onion = 0.9 + 0.1 * sin(d / r * 18.0);
      float pulse = 0.55 + 0.45 * noise(vec2(c.t * 0.3 + h * 70.0, fl * 5.0));
      float bt = 0.0;
      float a0 = c.t - c.hits.x;
      float a1 = c.t - c.hits.y;
      bt += step(0.65, hash(id + fract(c.hits.x * 0.731) * 91.0)) * exp(-a0 * 1.6);
      bt += step(0.65, hash(id + fract(c.hits.y * 0.731) * 91.0)) * exp(-a1 * 1.6) * 0.7;
      vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h * 1.7 + fl * 0.3), vec3(1.0), 0.12);
      col += tint * disc * (0.25 + 0.75 * rim) * onion * (pulse * (0.08 + c.level * 0.09) + bt * 0.18 + c.mid * 0.04) * (L == 0 ? 1.0 : 0.8);
    }
  }
  return vec4(col, 0.14);
}
`,
  },
  {
    id: "034-sparks",
    name: "Искры",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  vec2 d = c.p - c.cc;
  float r = c.dc;
  float ang = atan(d.y, d.x);
  for (int i = 0; i < 8; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 5.0) continue;
    float seed = fract(uBeats[i] * 0.6173);
    float swirl = (seed - 0.5) * 2.4;
    float a2 = ang - swirl * max(r - c.coverR, 0.0);
    float sectors = 70.0;
    float u = a2 / TAU * sectors + seed * 100.0;
    float cell = floor(u);
    float h = hash(vec2(cell, seed * 31.0));
    if (h < 0.5) continue;
    float jit = hash(vec2(cell + 3.1, seed * 17.0));
    float v = 0.18 + 0.7 * jit * jit;
    float k = 1.6 + h;
    float rs = c.coverR * 1.02 + v * (1.0 - exp(-age * k));
    float across = (fract(u) - 0.5 - (hash(vec2(cell, seed + 5.0)) - 0.5) * 0.5) * TAU / sectors * r;
    float len = 0.006 + v * exp(-age * k) * 0.35;
    float along = clamp((r - (rs - len)) / len, 0.0, 1.0) * step(r, rs);
    float w = (1.0 + exp(-age * 2.0) * 1.2) * c.px;
    float streak = along * along * exp(-pow(across / w, 2.0));
    float head = exp(-(pow((r - rs) / (w * 2.5), 2.0) + pow(across / (w * 2.5), 2.0)));
    float heat = exp(-age * 1.8);
    float fade = exp(-age * 0.8) * smoothstep(5.0, 3.0, age);
    float flick = 0.6 + 0.4 * noise(vec2(cell * 3.7, c.t * 6.0 + seed * 40.0));
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, seed + jit * 0.3), vec3(1.0, 0.97, 0.9), heat * 0.7);
    col += tint * (streak * 0.9 + head * 1.4) * fade * flick * (0.7 + c.high * 0.6);
  }
  float rimN = noise(vec2(ang * 9.0, c.t * 1.3)) * noise(vec2(ang * 23.0 + 5.0, c.t * 2.1));
  float rim = exp(-pow((r - c.coverR * 1.04) / (0.004 + c.bass * 0.01), 2.0));
  col += mix(c.c1, vec3(1.0), 0.4) * rim * smoothstep(0.25, 0.6, rimN) * (0.25 + c.bass * 0.4);
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "035-dustbeam",
    name: "Пыль в луче",
    glsl: `
float m035_beam(vec2 p, vec2 o, float th, float w0) {
  vec2 dir = vec2(cos(th), sin(th));
  vec2 v = p - o;
  float along = dot(v, dir);
  float across = dot(v, vec2(-dir.y, dir.x));
  float w = w0 + max(along, 0.0) * 0.22;
  return exp(-pow(across / w, 2.0)) * smoothstep(0.0, 0.25, along) * exp(-max(along, 0.0) * 0.5);
}
vec4 modeLayer(Ctx c) {
  float n1 = noise(vec2(c.t * 0.03, 1.0)), n2 = noise(vec2(c.t * 0.025, 7.0));
  vec2 o1 = vec2(c.aspect * (0.15 + 0.25 * n1), 1.2);
  vec2 o2 = vec2(c.aspect * (0.55 + 0.3 * n2), 1.25);
  float b1 = m035_beam(c.p, o1, -1.15 + (n2 - 0.5) * 0.3, 0.05);
  float b2 = m035_beam(c.p, o2, -1.35 + (n1 - 0.5) * 0.3, 0.035) * 0.7;
  float beam = b1 + b2;
  float rays = 0.65 + 0.35 * noise(vec2((c.p.x + c.p.y * 0.45) * 30.0, c.t * 0.08));
  vec3 col = mix(c.c1, vec3(1.0, 0.97, 0.9), 0.35) * beam * rays * (0.14 + c.level * 0.12);
  float stir = 0.0;
  for (int i = 0; i < 4; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    stir += exp(-age * 1.1);
  }
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float S = 22.0 + fl * 14.0;
    vec2 q = c.p * S + vec2(c.t * 0.02, c.t * 0.012) * S + fl * 31.0;
    q += (vec2(noise(c.p * 3.0 + c.t * 0.2 + fl), noise(c.p * 3.0 - c.t * 0.2 + 9.0)) - 0.5) * stir * 2.5;
    vec2 id = floor(q);
    float h = hash(id + fl * 5.0);
    if (h < 0.8) continue;
    vec2 h2 = hash2(id + fl * 2.0);
    vec2 jig = vec2(noise(vec2(c.t * 0.6 + h * 40.0, 0.0)), noise(vec2(c.t * 0.6 + h2.x * 40.0, 3.0))) - 0.5;
    vec2 pos = id + 0.5 + (h2 - 0.5) * 0.4 + jig * 0.3;
    float d = length(q - pos) / (c.px * S);
    float sz = 0.9 + h2.y * 1.4 * (1.0 + c.bass * 0.4);
    float mote = exp(-d * d / (sz * sz));
    float tw = 0.5 + 0.5 * smoothstep(0.3, 0.8, noise(vec2(c.t * 1.7 + h * 60.0, fl))) * (0.6 + c.high);
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h2.x), vec3(1.0), 0.55);
    col += tint * mote * tw * (beam * 1.8 + 0.05) * (1.0 - fl * 0.22);
  }
  return vec4(col, 0.22 * (1.0 - clamp(beam, 0.0, 1.0)));
}
`,
  },
  {
    id: "036-bubbles",
    name: "Пузырьки",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float S = 5.0 + fl * 4.0;
    vec2 q = c.p * S + vec2(fl * 13.0, 0.0);
    q.y -= c.star * (0.07 + fl * 0.03) * S;
    float pxs = c.px * S;
    for (int k = -1; k < 2; k++) {
      vec2 id = vec2(floor(q.x) + float(k), floor(q.y));
      float h = hash(id + fl * 7.0);
      if (h < 0.45) continue;
      vec2 h2 = hash2(id + fl * 4.0);
      float wob = (noise(vec2(id.x * 7.0 + fl * 3.0, q.y * 0.7)) - 0.5) * 0.3;
      vec2 pos = id + 0.5 + vec2((h2.x - 0.5) * 0.3 + wob, (h2.y - 0.5) * 0.2);
      float popA = c.t - c.hits.x;
      bool popped = hash(id + fract(c.hits.x * 0.731) * 91.0) < 0.14;
      float scale = popped ? smoothstep(0.3, 3.0, popA) : 1.0;
      float r = (0.08 + 0.16 * h * h) * (1.0 + c.bass * 0.3) * scale;
      vec2 d = q - pos;
      float l = length(d);
      float ang = atan(d.y, d.x);
      if (popped && popA < 0.5) {
        float br = ring(l, 0.12 + popA * 0.8, pxs * 1.5) * (1.0 - popA / 0.5);
        float dots = step(0.6, fract(ang / TAU * 9.0 + h));
        col += mix(c.c2, vec3(1.0), 0.6) * br * (0.3 + 0.5 * dots) * 0.8;
      }
      if (r < 0.01) continue;
      float shell = exp(-pow((l - r) / max(pxs * 1.3, r * 0.08), 2.0));
      float fill = smoothstep(r, r - pxs, l);
      float spec = exp(-dot(d - vec2(-0.38, 0.4) * r, d - vec2(-0.38, 0.4) * r) / (r * r * 0.025));
      float cres = exp(-pow((l - r * 0.78) / (r * 0.07), 2.0)) * smoothstep(0.1, -0.6, d.y / r) * smoothstep(-0.9, 0.2, d.x / r);
      vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h2.x + h * 0.5), vec3(1.0), 0.35);
      float rim = 0.6 + 0.4 * sin(ang * 2.0 + h * 9.0 + d.y * 6.0);
      col += (tint * (shell * 0.45 * rim + fill * 0.05 + cres * 0.25) + vec3(1.0) * spec * 0.8) * (0.7 + c.high * 0.5) * (L == 0 ? 1.0 : 0.6);
      alpha = max(alpha, fill * 0.1);
    }
  }
  return vec4(col, alpha);
}
`,
  },
  {
    id: "037-confetti",
    name: "Конфетти",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float S = 6.0 + fl * 4.0;
    float depth = 1.0 / (1.0 + fl * 0.6);
    vec2 q = c.p * S + vec2(fl * 19.0, 0.0);
    q.y += c.star * (0.06 * depth + 0.015) * S;
    q.x += (fbm(vec2(c.t * 0.05, fl * 2.0)) - 0.5) * S * 0.5;
    vec2 id = floor(q);
    float h = hash(id + fl * 6.3);
    if (h < 0.5) continue;
    vec2 h2 = hash2(id + fl * 2.9);
    float sway = noise(vec2(c.t * 0.4 + h * 40.0, fl)) - 0.5;
    vec2 pos = id + 0.5 + (h2 - 0.5) * 0.3 + vec2(sway * 0.2 * (1.0 + c.bass), 0.0);
    vec2 d = q - pos;
    float rot = h * TAU + (noise(vec2(c.t * 0.25 + h2.x * 30.0, 2.0)) - 0.5) * 5.0;
    float cr = cos(rot), sr = sin(rot);
    d = vec2(cr * d.x - sr * d.y, sr * d.x + cr * d.y);
    float phase = c.t * (1.2 + h2.y * 1.8) + 3.0 * noise(vec2(c.t * 0.2 + h * 30.0, 6.0));
    float flip = cos(phase);
    vec2 bsz = vec2(0.17, 0.065 * abs(flip) + 0.004) * (1.0 + c.bass * 0.2);
    vec2 bq = abs(d) - bsz;
    float sd = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0);
    float pxs = c.px * S;
    float cov = smoothstep(pxs * 1.2, -pxs * 0.3, sd);
    if (cov <= 0.0) continue;
    float face = flip > 0.0 ? 1.0 : 0.7;
    vec3 base = mix(c.c1, c.c2, step(0.5, h2.x) * 0.7 + 0.15);
    base = mix(base, vec3(1.0), 0.06) * 1.5;
    float a0 = c.t - c.hits.x;
    float glint = pow(abs(flip), 12.0) * (0.25 + c.high * 0.6) + step(0.7, hash(id + fract(c.hits.x * 0.731) * 91.0)) * exp(-a0 * 3.0) * 0.6;
    vec3 pc = base * face * (0.35 + 0.2 * c.level) + vec3(1.0) * glint * 0.4;
    col += pc * cov * depth;
    alpha = max(alpha, cov * 0.45 * depth);
  }
  return vec4(col, alpha);
}
`,
  },
  {
    id: "038-embers",
    name: "Угольки",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float heatBase = smoothstep(0.45, 0.0, c.uv.y);
  float flick = fbm(vec2(c.p.x * 3.0, c.t * 0.4));
  col += mix(c.c1, c.c3, flick) * heatBase * heatBase * flick * (0.12 + c.bass * 0.22);
  float a0 = c.t - c.hits.x;
  float burst = exp(-a0 * 1.5);
  for (int L = 0; L < 4; L++) {
    float fl = float(L);
    float S = 6.0 + fl * 4.0;
    vec2 q = c.p * S + vec2(fl * 23.0, 0.0);
    float rise = c.star * (0.08 + 0.02 * fl) * S;
    q.y -= rise;
    float sway = (noise(vec2(q.x * 0.3 + fl, (q.y) * 0.35)) - 0.5) * 1.1 + (noise(vec2(c.t * 0.3, fl * 3.0 + q.y * 0.2)) - 0.5) * 0.6;
    q.x += sway;
    vec2 id = floor(q);
    float h = hash(id + fl * 3.3);
    float thr = 0.62 - c.bass * 0.15 - fl * 0.04;
    float on = smoothstep(thr, thr + 0.08, h);
    if (on <= 0.0) continue;
    vec2 h2 = hash2(id + fl * 8.1);
    vec2 pos = id + 0.5 + (h2 - 0.5) * vec2(0.5, 0.3);
    vec2 d = q - pos;
    d.y *= 0.35 + 0.25 * h2.y;
    float pxs = c.px * S;
    float sz = (0.02 + 0.03 * h2.y) * (1.0 + c.bass * 0.5);
    float l2 = dot(d, d);
    float core = exp(-l2 / (sz * sz + pxs * pxs));
    float glow = exp(-l2 / (sz * sz * 30.0)) * 0.25;
    float life = smoothstep(1.05, 0.25, c.uv.y + h * 0.25);
    float fl2 = 0.55 + 0.45 * noise(vec2(c.t * 5.0 + h * 80.0, fl));
    vec3 tint = mix(palette3(c.c1, c.c2, c.c3, h2.x * 0.5), vec3(1.0, 0.95, 0.85), 0.45 * life);
    col += tint * (core + glow) * on * life * fl2 * (0.6 + c.high * 0.6 + burst * 0.6 * h2.x) * (1.0 - fl * 0.18);
  }
  return vec4(col, 0.1 * heatBase);
}
`,
  },
  {
    id: "039-dandelion",
    name: "Пух",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float gust = 0.0;
  for (int i = 0; i < 3; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 6.0) continue;
    gust += exp(-age * 1.3);
  }
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float S = 3.2 + fl * 2.6;
    vec2 q = c.p * S + vec2(fl * 9.0, fl * 5.0);
    q -= vec2(c.star * 0.035, c.star * 0.012) * S * (1.0 - fl * 0.3);
    q.y += (fbm(vec2(c.t * 0.04, fl + q.x * 0.05)) - 0.5) * 0.8;
    vec2 id = floor(q);
    float h = hash(id + fl * 4.4);
    if (h < 0.5) continue;
    vec2 h2 = hash2(id + fl * 1.3);
    vec2 bob = vec2(noise(vec2(c.t * 0.2 + h * 30.0, 0.0)), noise(vec2(c.t * 0.2 + h2.x * 30.0, 5.0))) - 0.5;
    vec2 pos = id + 0.5 + (h2 - 0.5) * 0.24 + bob * 0.16;
    float tilt = (noise(vec2(c.t * 0.15 + h * 20.0, 9.0)) - 0.5) * 1.2 + gust * (h - 0.5) * 1.5;
    vec2 d = q - pos;
    float ct = cos(tilt), st = sin(tilt);
    d = vec2(ct * d.x - st * d.y, st * d.x + ct * d.y);
    float pxs = c.px * S;
    float R = (0.16 + 0.08 * h2.y) * (1.0 + c.bass * 0.15);
    vec2 hub = d - vec2(0.0, 0.02);
    float l = length(hub);
    float a = atan(hub.x, hub.y);
    float fan = smoothstep(1.9, 1.3, abs(a));
    float n = 16.0;
    float fil = pow(abs(cos(a * n * 0.5 + h * 10.0)), 30.0) * smoothstep(R, R * 0.2, l) * fan;
    float tips = exp(-pow((l - R) / (pxs * 1.5 + R * 0.06), 2.0)) * fan;
    float puff = exp(-l * l / (R * R * 0.6)) * fan * 0.25;
    float stalk = exp(-pow(d.x / (pxs * 0.9), 2.0)) * step(-0.17, d.y) * step(d.y, 0.02);
    float seedb = exp(-dot(d - vec2(0.0, -0.18), d - vec2(0.0, -0.18)) / (pxs * pxs * 6.0 + 0.0004));
    float shimmer = 0.6 + 0.4 * noise(vec2(a * 6.0, c.t * 1.5 + h * 20.0)) * (0.5 + c.high);
    vec3 tint = mix(vec3(1.0), palette3(c.c1, c.c2, c.c3, h2.x), 0.3);
    float blur = L == 0 ? 0.75 : 1.0;
    col += tint * (fil * 0.5 * shimmer + tips * 0.35 * shimmer + puff * 0.4 + stalk * 0.35 + seedb * 0.5) * blur * (0.6 + c.level * 0.5);
  }
  return vec4(col, 0.06);
}
`,
  }
);
