(window.TaliaModes = window.TaliaModes || []).push(
  {
    id: "000-blobs",
    name: "Пятна",
    glsl: `
vec4 modeLayer(Ctx c) { return vec4(0.0); }
`,
  },
  {
    id: "001-rings",
    name: "Кольца",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  float reach = length(vec2(c.aspect, 1.0)) * 1.05;
  for (int i = 0; i < 16; i++) {
    float age = c.t - uBeats[i];
    if (age < 0.0 || age > 14.0) continue;
    float r = c.coverR + age * 0.3 + age * age * 0.03;
    float fade = (1.0 - smoothstep(reach * 0.75, reach, r)) * (0.55 + 0.45 * exp(-age * 0.35));
    vec3 tint = palette3(c.c1, c.c2, c.c3, age * 0.09 + fract(uBeats[i] * 0.173));
    col += mix(tint, vec3(1.0), 0.18) * (ring(c.dc, r, 2.2 * c.px) + ring(c.dc, r, 0.025 + age * 0.004) * 0.45) * fade;
  }
  col *= 0.6;
  col += c.c1 * smoothstep(c.coverR * (1.7 + c.bass * 0.7), c.coverR * 0.95, c.dc) * 0.28 * c.bass;
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "002-stars",
    name: "Звёздный поток",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec2 d = c.p - vec2(0.5 * c.aspect, 0.54);
  float r = length(d), ang = atan(d.y, d.x) / TAU + 0.5;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sectors = k == 0 ? 160.0 : 260.0;
    float cell = floor(ang * sectors);
    float h = hash(vec2(cell, 3.1 + float(k))), h2 = hash(vec2(cell, 7.7 + float(k)));
    float travel = fract(c.star * (0.035 + h * 0.06) + h2) * 1.35;
    float across = abs(fract(ang * sectors) - 0.5) * TAU / sectors * r;
    float len = 0.03 + 0.12 * travel * (1.0 + c.level);
    float along = clamp((r - (travel - len)) / len, 0.0, 1.0) * step(r, travel);
    float width = (1.2 + travel * 1.5) * c.px;
    float streak = along * along * (exp(-pow(across / width, 2.0)) + 0.3 * exp(-pow(across / (width * 4.0), 2.0)));
    float head = exp(-pow((r - travel) / (width * 3.0), 2.0)) * exp(-pow(across / (width * 2.0), 2.0));
    vec3 tint = h2 < 0.33 ? c.c1 : (h2 < 0.66 ? c.c2 : c.c3);
    col += mix(tint, vec3(1.0), 0.45) * (streak + head * 1.5) * step(0.5, h) * (0.4 + travel) * (0.7 + c.high * 0.6) * (k == 0 ? 1.0 : 0.6);
  }
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "003-aurora",
    name: "Сияние",
    glsl: `
vec4 modeLayer(Ctx c) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float b = float(i);
    float amp = 0.05 + c.bass * 0.09 + b * 0.02;
    float y = 0.82 - b * 0.15 + sin(c.p.x * 2.4 + c.t * (0.5 + b * 0.16) + b * 2.0) * amp + sin(c.p.x * 6.3 - c.t * 0.9 + b) * amp * 0.35 + (fbm(vec2(c.p.x * 1.5 + c.t * 0.1, b)) - 0.5) * 0.08;
    float below = y - c.uv.y;
    float rays = 0.55 + 0.45 * noise(vec2(c.p.x * 22.0 + c.t * 0.35 + b * 13.0, b));
    float curtain = smoothstep(0.0, 0.01, below) * exp(-max(below, 0.0) * 3.2) * rays;
    float edge = exp(-pow(below / 0.006, 2.0)) * 0.8 + exp(-pow(below / 0.04, 2.0)) * 0.25;
    vec3 tint = i == 0 ? c.c1 : (i == 1 ? c.c2 : c.c3);
    col += mix(tint, vec3(1.0), 0.15) * (curtain * (0.32 + c.level * 0.22) + edge * (0.35 + c.high * 0.4));
  }
  return vec4(col, 0.0);
}
`,
  },
  {
    id: "004-tide",
    name: "Волны",
    glsl: `
vec4 modeLayer(Ctx c) {
  float lines = 28.0;
  float edgeFade = max(0.0, 1.0 - abs(c.uv.y - 0.54) * 1.35);
  float amp = (0.35 + c.bass * 1.7) * edgeFade;
  float v = c.uv.y * lines + sin(c.p.x * 3.6 + c.t * 1.2 + c.uv.y * 5.0) * amp * sin(PI * c.uv.x) + sin(c.p.x * 9.0 - c.t * 1.7) * amp * 0.15;
  float dist = 0.5 - abs(fract(v) - 0.5);
  float pxv = lines * c.px * 1.3;
  float l = exp(-pow(dist / (1.1 * pxv), 2.0)) + 0.35 * exp(-pow(dist / (5.0 * pxv), 2.0));
  float id = mod(floor(v + 0.5), 3.0);
  vec3 tint = id < 0.5 ? c.c1 : (id < 1.5 ? c.c2 : c.c3);
  return vec4(mix(tint, vec3(1.0), 0.2) * l * (0.15 + c.high * 0.22) * smoothstep(0.1, 0.18, c.uv.y) * smoothstep(0.96, 0.88, c.uv.y), 0.0);
}
`,
  }
);
