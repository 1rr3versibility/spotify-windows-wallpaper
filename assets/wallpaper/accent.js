window.TaliaAccent = {
  names: ["Кольца", "Искры", "Лучи", "Линии", "Ореол", "Осколки"],
  glsl: `
float acRnd(float seed, float k, float j) { return fract(seed * (13.0 + j * 5.0) + k * 0.7548777 + j * 0.5698403); }
float acAngle(float a, float b) { return mod(a - b + PI, TAU) - PI; }
vec3 beatAccent(float style, vec2 p, vec2 cc, float dc, float coverR, float aspect, float px, float t, vec3 c1, vec3 c2, vec3 c3) {
  vec2 d = p - cc;
  float ang = atan(d.y, d.x);
  float reach = length(vec2(aspect, 1.0)) * 1.05;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float b = uBeats[i];
    float age = t - b;
    if (age < 0.0 || age > 3.2) continue;
    float seed = fract(b * 0.173);
    vec3 tint = mix(palette3(c1, c2, c3, seed), vec3(1.0), 0.3);
    float v = 0.0;
    if (style < 0.5) {
      float wr = coverR + age * 0.55 + age * age * 0.04;
      float wf = (1.0 - age / 3.2) * (1.0 - smoothstep(reach * 0.8, reach, wr));
      v = (ring(dc, wr, 0.05) * 0.18 + ring(dc, wr, 0.012) * 0.22) * wf;
    } else if (style < 1.5) {
      if (age > 2.4) continue;
      float sector = TAU / 28.0;
      float k = floor((ang + PI) / sector);
      float ak = -PI + (k + 0.5 + (acRnd(seed, k, 0.0) - 0.5) * 0.6) * sector;
      float sp = 0.25 + 0.55 * acRnd(seed, k, 1.0);
      float dist = coverR + sp * (1.0 - exp(-age * 2.2)) / 1.1;
      float da = acAngle(ang, ak) * dc;
      float dr = dc - dist;
      float w = 0.0045 * (1.0 + acRnd(seed, k, 2.0));
      float tail = dr < 0.0 ? 4.0 : 1.0;
      v = exp(-(da * da) / (w * w) - (dr * dr) / (w * w * tail * tail)) * exp(-age * 1.6) * 0.9;
    } else if (style < 2.5) {
      if (age > 1.8) continue;
      float sector = TAU / 14.0;
      float rot = seed * TAU;
      float k = floor(mod(ang - rot, TAU) / sector);
      float ak = rot + (k + 0.5 + (acRnd(seed, k, 0.0) - 0.5) * 0.5) * sector;
      float da = acAngle(ang, ak) * dc;
      float w = 0.003 + dc * 0.012;
      float len = age * 1.4;
      float inside = smoothstep(coverR * 0.95, coverR * 1.05, dc) * (1.0 - smoothstep(coverR + len * 0.7, coverR + len, dc));
      v = exp(-(da * da) / (w * w)) * inside * exp(-age * 2.4) * (0.5 + 0.5 * acRnd(seed, k, 1.0)) * 0.5;
    } else if (style < 3.5) {
      float off = age * 0.32 + age * age * 0.03;
      float fall = exp(-abs(p.x - cc.x) * 0.9) * (1.0 - age / 3.2);
      float dy1 = p.y - (cc.y + off);
      float dy2 = p.y - (cc.y - off);
      v = (exp(-dy1 * dy1 / 0.00001225) * 0.35 + exp(-dy1 * dy1 / 0.0004) * 0.12 + exp(-dy2 * dy2 / 0.00001225) * 0.35 + exp(-dy2 * dy2 / 0.0004) * 0.12) * fall;
    } else if (style < 4.5) {
      if (dc < coverR * 0.9) continue;
      float hw = 0.04 + age * 0.22;
      float x = (dc - coverR) / hw;
      v = exp(-x * x) * exp(-age * 1.8) * 0.35;
    } else {
      if (age > 2.6) continue;
      float sector = TAU / 18.0;
      float rot = seed * PI;
      float k = floor(mod(ang - rot, TAU) / sector);
      float ak = rot + (k + 0.5) * sector;
      float start = coverR + age * (0.35 + 0.4 * acRnd(seed, k, 0.0));
      float len = 0.03 + 0.05 * acRnd(seed, k, 1.0);
      float along = dc - start;
      float inside = smoothstep(0.0, 0.006, along) * (1.0 - smoothstep(len - 0.01, len, along));
      float da = acAngle(ang, ak) * dc;
      float w = 1.4 * px + 0.0015;
      v = exp(-(da * da) / (w * w)) * inside * exp(-age * 1.4) * 0.7;
    }
    col += tint * v * smoothstep(0.0, 0.1, age);
  }
  return col;
}
`,
};
