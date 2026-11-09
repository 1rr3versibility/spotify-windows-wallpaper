using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace CapriDesktop
{
    internal static class FxShaders
    {
        internal const string Fallback = "000-blobs";

        internal const string Vertex = @"
float4 VS(uint id : SV_VertexID) : SV_Position
{
    float2 q = float2(id & 2, (id << 1) & 2);
    return float4(q * 2.0 - 1.0, 0.0, 1.0);
}
";

        private const string Header = @"
cbuffer U : register(b0)
{
    float2 uRes; float uTime; float uFade;
    float uStar; float uAccent; float uAccentGain; float uDark;
    float3 uC1; float uBackdrop;
    float3 uC2; float uBackdropAspect;
    float3 uC3; float uPad3;
    float3 uCenter; float uPad4;
    float3 uHits; float uPad5;
    float4 uAudio;
    float4 uBeatsV[4];
    float4 uBackdropRect; float uBackdropRadius; float3 uPad6;
};
static const float TAU = 6.28318530718;
static const float PI = 3.14159265359;
float beatAt(int i) { return uBeatsV[i >> 2][i & 3]; }
float glslMod(float x, float y) { return x - y * floor(x / y); }
float2 glslMod(float2 x, float y) { return x - y * floor(x / y); }
float3 glslMod(float3 x, float y) { return x - y * floor(x / y); }
float4 glslMod(float4 x, float y) { return x - y * floor(x / y); }
float2 glslMod(float2 x, float2 y) { return x - y * floor(x / y); }
float3 glslMod(float3 x, float3 y) { return x - y * floor(x / y); }
float4 glslMod(float4 x, float4 y) { return x - y * floor(x / y); }
float glslAtan(float y, float x) { return atan2(y, x); }
float glslAtan(float x) { return atan(x); }
float2 glslAtan(float2 y, float2 x) { return atan2(y, x); }
float2 glslAtan(float2 x) { return atan(x); }
struct Ctx { float2 uv; float2 p; float aspect; float px; float t; float bass; float mid; float high; float level; float3 c1; float3 c2; float3 c3; float2 cc; float coverR; float dc; float3 hits; float star; };
float hash(float2 p) { return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float2 hash2(float2 p) { return frac(sin(float2(dot(p, float2(127.1, 311.7)), dot(p, float2(269.5, 183.3)))) * 43758.5453); }
float noise(float2 p)
{
    float2 i = floor(p), f = frac(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    return lerp(lerp(hash(i), hash(i + float2(1.0, 0.0)), u.x), lerp(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p)
{
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + float2(17.0, 9.0); a *= 0.5; }
    return v;
}
float3 screen(float3 a, float3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }
float3 blob(float2 p, float2 c, float r, float3 col) { float2 d = p - c; return col * exp(-dot(d, d) / (r * r)); }
float3 hue(float3 c, float a)
{
    const float3 k = float3(0.57735, 0.57735, 0.57735);
    float ca = cos(a);
    return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
float ring(float d, float r, float w) { float x = (d - r) / w; return exp(-x * x); }
float glslLine(float d, float w) { return exp(-(d * d) / (w * w)); }
float3 palette3(float3 a, float3 b, float3 c, float x)
{
    x = frac(x) * 3.0;
    return x < 1.0 ? lerp(a, b, smoothstep(0.0, 1.0, x)) : (x < 2.0 ? lerp(b, c, smoothstep(1.0, 2.0, x)) : lerp(c, a, smoothstep(2.0, 3.0, x)));
}
Texture2D backdropTex : register(t0);
SamplerState backdropSampler : register(s0);
float backdropMask(float2 uv)
{
    float2 rp = float2(uv.x, 1.0 - uv.y);
    float2 hs = uBackdropRect.zw * 0.5 * uRes;
    float2 q = (rp - uBackdropRect.xy) * uRes - hs;
    float r = uBackdropRadius * uRes.y;
    float2 e = abs(q) - hs + r;
    float d = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
    return 1.0 - smoothstep(-1.5, 1.5, d);
}
float3 backdropColor(float2 uv)
{
    float2 rp = float2(uv.x, 1.0 - uv.y);
    float2 local = (rp - uBackdropRect.xy) / max(uBackdropRect.zw, float2(0.0001, 0.0001));
    float boxAspect = uBackdropRect.z * uRes.x / max(uBackdropRect.w * uRes.y, 1.0);
    float2 fit = boxAspect > uBackdropAspect ? float2(1.0, uBackdropAspect / boxAspect) : float2(boxAspect / uBackdropAspect, 1.0);
    float2 b = 0.5 + (local - 0.5) * fit;
    return backdropTex.SampleLevel(backdropSampler, b, 0).rgb;
}
float3 baseColor(float2 p, float aspect, float t, float bass, float mid, float level, float3 c1, float3 c2, float3 c3, float dc)
{
    float flow = t * 0.045;
    float2 q = p * 1.15;
    float2 w = float2(fbm(q + float2(0.0, flow)), fbm(q + float2(5.2, 1.3) - flow));
    float f = fbm(q + 1.8 * w + float2(flow * 0.7, -flow * 0.4) + bass * 0.12);
    float3 liquid = lerp(c1, c2, smoothstep(0.25, 0.75, f));
    liquid = lerp(liquid, c3, smoothstep(0.45, 0.85, w.x) * 0.8);
    float folds = smoothstep(0.2, 0.9, f) * (0.75 + 0.25 * sin(f * 9.0 + t * 0.6));
    float3 col = float3(0.03, 0.033, 0.052) + liquid * folds * (0.34 + level * 0.22 + bass * 0.12);
    float glow = 0.5 + level * 0.25;
    col = screen(col, blob(p, float2(aspect * (0.38 + 0.2 * sin(t * 0.11)), 0.78 + 0.16 * cos(t * 0.13)), 0.6 * (1.0 + bass * 0.25), c1) * glow);
    col = screen(col, blob(p, float2(aspect * (0.7 + 0.2 * cos(t * 0.09)), 0.34 + 0.16 * sin(t * 0.12)), 0.55 * (1.0 + mid * 0.18 + bass * 0.08), c2) * glow);
    col = screen(col, blob(p, float2(aspect * (0.18 + 0.16 * cos(t * 0.07)), 0.28 + 0.13 * sin(t * 0.1)), 0.5 * (1.0 + level * 0.16), c3) * (0.38 + level * 0.18));
    return screen(col, lerp(c1, c2, 0.5) * exp(-dc * dc / 0.14) * bass * 0.22);
}
";

        private const string Main = @"
float4 PS(float4 pos : SV_Position) : SV_Target
{
    float2 frag = float2(pos.x, uRes.y - pos.y);
    float2 uv = frag / uRes;
    float aspect = uRes.x / uRes.y;
    float px = 1.0 / uRes.y;
    float2 p = float2(uv.x * aspect, uv.y);
    float t = uTime, bass = uAudio.x, mid = uAudio.y, high = uAudio.z, level = uAudio.w;
    float shift = sin(t * 0.37) * (0.1 + high * 0.24) + mid * 0.1;
    float3 c1 = hue(uC1, shift), c2 = hue(uC2, shift), c3 = hue(uC3, shift);
    float2 cc = float2(uCenter.x * aspect, uCenter.y);
    float dc = length(p - cc);
    float3 col = baseColor(p, aspect, t, bass, mid, level, c1, c2, c3, dc);
    col = lerp(col, float3(0.01, 0.01, 0.014), smoothstep(0.45, 0.85, uDark) * 0.85);
    col = screen(col, beatAccent(uAccent, p, cc, dc, uCenter.z, aspect, px, t, c1, c2, c3) * uAccentGain);
    Ctx c;
    c.uv = uv; c.p = p; c.aspect = aspect; c.px = px; c.t = t;
    c.bass = bass; c.mid = mid; c.high = high; c.level = level;
    c.c1 = c1; c.c2 = c2; c.c3 = c3; c.cc = cc; c.coverR = uCenter.z; c.dc = dc; c.hits = uHits; c.star = uStar;
    float4 layer = modeLayer(c);
    col = lerp(col, float3(0.025, 0.027, 0.045), clamp(layer.a, 0.0, 1.0) * uFade);
    col = screen(col, max(layer.rgb, 0.0) * uFade);
    if (uBackdrop > 0.001) { float bm = backdropMask(uv) * uBackdrop; if (bm > 0.001) col = lerp(col, backdropColor(uv), bm); }
    float vig = smoothstep(1.35, 0.2, length((uv - float2(0.55, 0.5)) * float2(aspect * 0.72, 1.0)));
    col *= lerp(0.32, 1.0, vig) * (1.0 + bass * 0.08);
    col += (hash(frag + frac(t * 7.0)) - 0.5) * (2.0 / 255.0);
    return float4(col, 1.0);
}
";

        private static readonly Dictionary<string, string[][]> Patches = new Dictionary<string, string[][]>
        {
            {
                "107-halftone", new[]
                {
                    new[] { "R * c.p / s", "mul(c.p, R) / s" },
                    new[] { "((id + 0.5) * s) * R", "mul(R, ((id + 0.5) * s))" }
                }
            }
        };

        private static readonly string[] Reserved =
        {
            "pass", "technique", "technique10", "technique11", "compile", "sampler", "sampler1D", "sampler2D", "sampler3D", "samplerCUBE", "sampler_state",
            "texture", "texture1D", "texture2D", "texture3D", "textureCUBE", "point", "triangle", "lineadj", "triangleadj", "matrix", "vector", "half",
            "string", "dword", "snorm", "unorm", "precise", "shared", "groupshared", "linear", "centroid", "nointerpolation", "noperspective", "sample",
            "register", "packoffset", "cbuffer", "tbuffer", "extern", "export", "inline", "column_major", "row_major", "globallycoherent", "Buffer",
            "asm", "decl", "stateblock", "vertexshader", "pixelshader", "geometryshader", "computeshader", "hullshader", "domainshader", "NULL",
            "unsigned", "typedef", "min16float", "min10float", "min16int", "min12int", "min16uint", "uint", "double", "interface", "class", "namespace",
            "template", "typename", "sizeof", "goto", "union", "volatile", "auto", "char", "short", "long", "signed",
            "static_cast", "const_cast", "dynamic_cast", "reinterpret_cast", "friend", "virtual", "public", "private", "protected", "operator", "new",
            "delete", "this", "throw", "try", "catch", "explicit", "mutable"
        };

        private static readonly Regex ModeBlock = new Regex("id:\\s*\"(?<id>[^\"]+)\"[\\s\\S]*?glsl:\\s*`(?<glsl>[^`]*)`", RegexOptions.Compiled);

        internal static List<KeyValuePair<string, string>> LoadModes(string modesFolder)
        {
            var found = new SortedDictionary<string, string>(StringComparer.Ordinal);
            foreach (string file in Directory.GetFiles(modesFolder, "*.js"))
            {
                string text = File.ReadAllText(file, Encoding.UTF8);
                foreach (Match match in ModeBlock.Matches(text))
                {
                    string id = match.Groups["id"].Value;
                    if (!found.ContainsKey(id)) found[id] = match.Groups["glsl"].Value;
                }
            }
            return new List<KeyValuePair<string, string>>(found);
        }

        private static readonly Regex AccentBlock = new Regex("glsl:\\s*`(?<glsl>[^`]*)`", RegexOptions.Compiled);

        internal static string LoadAccent(string wallpaperFolder)
        {
            string path = Path.Combine(wallpaperFolder, "accent.js");
            Match match = AccentBlock.Match(File.ReadAllText(path, Encoding.UTF8));
            if (!match.Success) throw new InvalidOperationException("В " + path + " нет шейдера акцентов");
            return match.Groups["glsl"].Value;
        }

        internal static string Pixel(string id, string glsl, string accent)
        {
            return Header + "\n" + Transpile("accent", accent) + "\n" + Transpile(id, glsl) + "\n" + Main;
        }
        internal static string Transpile(string id, string glsl)
        {
            string code = glsl;
            string[][] patches;
            if (Patches.TryGetValue(id, out patches))
            {
                foreach (string[] patch in patches)
                {
                    if (code.IndexOf(patch[0], StringComparison.Ordinal) < 0) throw new InvalidOperationException("Режим " + id + ": замена «" + patch[0] + "» не нашла места");
                    code = code.Replace(patch[0], patch[1]);
                }
            }
            if (Regex.IsMatch(code, "\\bmat[234]\\b") && patches == null)
                throw new InvalidOperationException("Режим " + id + " использует матрицы GLSL, для него нужна явная замена умножений в FxShaders.Patches");
            code = ScalarConstructors(code);
            code = Subscripts(code, "uBeats", "beatAt");
            code = Regex.Replace(code, "\\bvec([234])\\b", "float$1");
            code = Regex.Replace(code, "\\bmat([234])\\b", "float$1x$1");
            code = Regex.Replace(code, "\\bmix\\b", "lerp");
            code = Regex.Replace(code, "\\bfract\\b", "frac");
            code = Regex.Replace(code, "\\bmod\\b", "glslMod");
            code = Regex.Replace(code, "\\batan\\b", "glslAtan");
            code = Regex.Replace(code, "\\bline\\b", "glslLine");
            code = Regex.Replace(code, "\\b(" + string.Join("|", Reserved) + ")\\b", "$1_");
            code = StaticGlobals(code);
            return code;
        }

        private static string ScalarConstructors(string code)
        {
            var output = new StringBuilder(code.Length + 256);
            var pattern = new Regex("\\bvec([234])\\s*\\(");
            int position = 0;
            while (true)
            {
                Match match = pattern.Match(code, position);
                if (!match.Success) { output.Append(code, position, code.Length - position); break; }
                int open = match.Index + match.Length - 1;
                int close = Matching(code, open, '(', ')');
                string inner = code.Substring(open + 1, close - open - 1);
                output.Append(code, position, match.Index - position);
                string translated = ScalarConstructors(inner);
                if (TopLevelCommas(inner) == 0) output.Append("((vec").Append(match.Groups[1].Value).Append(")(").Append(translated).Append("))");
                else output.Append("vec").Append(match.Groups[1].Value).Append('(').Append(translated).Append(')');
                position = close + 1;
            }
            return output.ToString();
        }

        private static string Subscripts(string code, string name, string function)
        {
            var output = new StringBuilder(code.Length + 64);
            var pattern = new Regex("\\b" + name + "\\s*\\[");
            int position = 0;
            while (true)
            {
                Match match = pattern.Match(code, position);
                if (!match.Success) { output.Append(code, position, code.Length - position); break; }
                int open = match.Index + match.Length - 1;
                int close = Matching(code, open, '[', ']');
                output.Append(code, position, match.Index - position);
                output.Append(function).Append("(int(").Append(Subscripts(code.Substring(open + 1, close - open - 1), name, function)).Append("))");
                position = close + 1;
            }
            return output.ToString();
        }

        private static string StaticGlobals(string code)
        {
            var lines = code.Split('\n');
            int depth = 0;
            var declaration = new Regex("^\\s*(const\\s+)?(float[234]?|int|bool|float[234]x[234])\\s+\\w+\\s*(=|;|,)");
            for (int i = 0; i < lines.Length; i++)
            {
                if (depth == 0 && declaration.IsMatch(lines[i])) lines[i] = "static " + lines[i].TrimStart();
                foreach (char ch in lines[i])
                {
                    if (ch == '{') depth++;
                    else if (ch == '}') depth--;
                }
            }
            return string.Join("\n", lines);
        }

        private static int Matching(string code, int open, char opening, char closing)
        {
            int depth = 0;
            for (int i = open; i < code.Length; i++)
            {
                if (code[i] == opening) depth++;
                else if (code[i] == closing && --depth == 0) return i;
            }
            throw new InvalidOperationException("Несбалансированные скобки в шейдере режима");
        }

        private static int TopLevelCommas(string inner)
        {
            int depth = 0, commas = 0;
            foreach (char ch in inner)
            {
                if (ch == '(' || ch == '[') depth++;
                else if (ch == ')' || ch == ']') depth--;
                else if (ch == ',' && depth == 0) commas++;
            }
            return commas;
        }
    }
}
