using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CapriDesktop
{
    internal static class FxTools
    {
        private sealed class Sample
        {
            internal float Time, Star;
            internal float[] Colors, Center, Hits, Audio, Beats;
        }

        private static readonly Sample[] Samples =
        {
            Make(137.25f, 0.62f, 0.41f, 0.33f, 0.55f, new[] { .95f, .45f, .62f, .38f, .78f, .92f, .55f, .36f, .82f }, new[] { .36f, .55f, .21f }),
            Make(912.7f, 0.15f, 0.72f, 0.58f, 0.31f, new[] { .25f, .85f, .55f, .95f, .82f, .35f, .30f, .40f, .90f }, new[] { .30f, .48f, .24f })
        };

        private static Sample Make(float t, float bass, float mid, float high, float level, float[] colors, float[] center)
        {
            var beats = new float[16];
            for (int i = 0; i < 16; i++) beats[i] = t - (0.21f + i * 0.73f + (i % 3) * 0.11f);
            return new Sample
            {
                Time = t, Star = t * 1.37f % 1000f, Colors = colors, Center = center,
                Hits = new[] { t - 0.35f, t - 1.2f, t - 2.6f }, Audio = new[] { bass, mid, high, level }, Beats = beats
            };
        }

        internal static int Run(string assets, string[] args)
        {
            string modesFolder = Path.Combine(assets, "wallpaper", "modes");
            string command = args[0];
            string output = Path.GetFullPath(args[1]);
            var only = new HashSet<string>(args.Skip(2), StringComparer.Ordinal);
            var modes = FxShaders.LoadModes(modesFolder).Where(m => only.Count == 0 || only.Contains(m.Key)).ToList();
            string accent = FxShaders.LoadAccent(Path.Combine(assets, "wallpaper"));
            if (command == "--modecompile") return CompileAll(modes, output, accent);
            if (command == "--modebench") return Bench(modes, output, accent);
            if (command == "--modecheck") return Check(assets, modes, output, accent);
            if (command == "--accentsheet") return AccentSheet(FxShaders.LoadModes(modesFolder), output, accent);
            return 2;
        }

        private static int CompileAll(List<KeyValuePair<string, string>> modes, string output, string accent)
        {
            var report = new StringBuilder();
            int failed = 0;
            using (var offscreen = new FxOffscreen(8, 8))
            {
                foreach (var mode in modes)
                {
                    try
                    {
                        IntPtr pixel = offscreen.Pipeline.CreatePixel(FxShaders.Pixel(mode.Key, mode.Value, accent));
                        ComCall.Release(pixel);
                        report.AppendLine(mode.Key + "\tOK");
                    }
                    catch (Exception error)
                    {
                        failed++;
                        report.AppendLine(mode.Key + "\tFAIL\t" + error.Message.Replace("\r", " ").Replace("\n", " | "));
                    }
                }
            }
            report.AppendLine("TOTAL\t" + modes.Count + "\tFAILED\t" + failed);
            File.WriteAllText(output, report.ToString(), new UTF8Encoding(false));
            return failed == 0 ? 0 : 1;
        }

        private static int Bench(List<KeyValuePair<string, string>> modes, string output, string accent)
        {
            var report = new StringBuilder("id\tms_1720x720\tms_1280x720\tms_both\n");
            var sizes = new[] { new Size(1720, 720), new Size(1280, 720) };
            var results = new Dictionary<string, double[]>();
            foreach (Size size in sizes)
            {
                using (var offscreen = new FxOffscreen(size.Width, size.Height))
                {
                    foreach (var mode in modes)
                    {
                        IntPtr pixel = IntPtr.Zero;
                        try
                        {
                            pixel = offscreen.Pipeline.CreatePixel(FxShaders.Pixel(mode.Key, mode.Value, accent));
                            Sample s = Samples[0];
                            FxPipeline.Fill(offscreen.Pipeline.Constants, size.Width, size.Height, s.Time, 1f, s.Star, 2f, 1f, 0f, s.Colors, s.Center, s.Hits, s.Audio, s.Beats);
                            for (int i = 0; i < 10; i++) offscreen.Draw(pixel);
                            offscreen.Read();
                            const int frames = 120;
                            var watch = Stopwatch.StartNew();
                            for (int i = 0; i < frames; i++) offscreen.Draw(pixel);
                            offscreen.Read();
                            double ms = watch.Elapsed.TotalMilliseconds / frames;
                            double[] row;
                            if (!results.TryGetValue(mode.Key, out row)) results[mode.Key] = row = new double[2];
                            row[size.Width == 1720 ? 0 : 1] = ms;
                        }
                        catch (Exception error)
                        {
                            results[mode.Key] = new[] { -1.0, -1.0 };
                            report.AppendLine("#" + mode.Key + " " + error.Message.Replace("\n", " | "));
                        }
                        finally { ComCall.Release(pixel); }
                    }
                }
            }
            var c = CultureInfo.InvariantCulture;
            foreach (var pair in results.OrderByDescending(p => p.Value[0] + p.Value[1]))
                report.AppendLine(pair.Key + "\t" + pair.Value[0].ToString("0.000", c) + "\t" + pair.Value[1].ToString("0.000", c) + "\t" + (pair.Value[0] + pair.Value[1]).ToString("0.000", c));
            File.WriteAllText(output, report.ToString(), new UTF8Encoding(false));
            return 0;
        }

        private static int Check(string assets, List<KeyValuePair<string, string>> modes, string folder, string accent)
        {
            Directory.CreateDirectory(folder);
            int exit = 1;
            var form = new Form
            {
                ShowInTaskbar = false, FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.Manual,
                Location = new Point(-30000, -30000), Size = new Size(300, 300), Text = "Talia mode check"
            };
            var web = new WebView2 { Dock = DockStyle.Fill };
            form.Controls.Add(web);
            form.Shown += async delegate
            {
                try { exit = await CheckAsync(assets, modes, folder, web, accent); }
                catch (Exception error)
                {
                    File.WriteAllText(Path.Combine(folder, "error.txt"), error.ToString(), new UTF8Encoding(false));
                    exit = 3;
                }
                form.Close();
            };
            Application.Run(form);
            return exit;
        }

        private static async Task<int> CheckAsync(string assets, List<KeyValuePair<string, string>> modes, string folder, WebView2 web, string accent)
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Path.GetTempPath(), "TaliaModeCheck"));
            await web.EnsureCoreWebView2Async(environment);
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("talia.check", assets, CoreWebView2HostResourceAccessKind.Deny);
            var loaded = new TaskCompletionSource<bool>();
            web.CoreWebView2.NavigationCompleted += (s, a) => loaded.TrySetResult(a.IsSuccess);
            web.CoreWebView2.Navigate("https://talia.check/wallpaper/refrender.html");
            if (!await loaded.Task) throw new InvalidOperationException("refrender.html не загрузилась");

            const int width = 480, height = 200;
            var json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
            var report = new StringBuilder("id\tsample\tmean\tp99\tmax\tstatus\n");
            int bad = 0;
            var c = CultureInfo.InvariantCulture;
            int index = 0;
            using (var offscreen = new FxOffscreen(width, height))
            {
                foreach (var mode in modes)
                {
                    int modeIndex = index++;
                    IntPtr pixel = IntPtr.Zero;
                    string compileError = null;
                    try { pixel = offscreen.Pipeline.CreatePixel(FxShaders.Pixel(mode.Key, mode.Value, accent)); }
                    catch (Exception error) { compileError = error.Message.Replace("\r", " ").Replace("\n", " | "); }
                    bool modeBad = false;
                    for (int si = 0; si < Samples.Length; si++)
                    {
                        Sample s = Samples[si];
                        float style = (modeIndex + si * 3) % 6;
                        Func<float[], double[]> exact = values => values.Select(v => (double)v).ToArray();
                        var u = new Dictionary<string, object>
                        {
                            { "time", (double)s.Time }, { "fade", 1.0 }, { "star", (double)s.Star }, { "accent", (double)style }, { "accentGain", 1.0 }, { "dark", si == 1 ? (double)0.9f : 0.0 },
                            { "colors", new[] { exact(s.Colors.Take(3).ToArray()), exact(s.Colors.Skip(3).Take(3).ToArray()), exact(s.Colors.Skip(6).Take(3).ToArray()) } },
                            { "center", exact(s.Center) }, { "hits", exact(s.Hits) }, { "audio", exact(s.Audio) }, { "beats", exact(s.Beats) }
                        };
                        string script = "taliaRender(" + json.Serialize(mode.Key) + "," + width + "," + height + "," + json.Serialize(u) + ")";
                        string result = json.Deserialize<string>(await web.CoreWebView2.ExecuteScriptAsync(script));
                        if (compileError != null || result == null || !result.StartsWith("data:image/png;base64,", StringComparison.Ordinal))
                        {
                            report.AppendLine(mode.Key + "\t" + si + "\t\t\t\tERROR " + (compileError ?? ("glsl: " + result)));
                            modeBad = true;
                            break;
                        }
                        byte[] reference = Pixels(Convert.FromBase64String(result.Substring(22)), width, height);
                        FxPipeline.Fill(offscreen.Pipeline.Constants, width, height, s.Time, 1f, s.Star, style, 1f, si == 1 ? 0.9f : 0f, s.Colors, s.Center, s.Hits, s.Audio, s.Beats);
                        offscreen.Draw(pixel);
                        byte[] native = offscreen.Read();
                        double mean, p99; int max;
                        Compare(reference, native, out mean, out p99, out max);
                        Save(native, width, height, Path.Combine(folder, mode.Key + "-" + si + ".png"));
                        bool ok = mean <= 1.0 && p99 <= 6;
                        report.AppendLine(mode.Key + "\t" + si + "\t" + mean.ToString("0.000", c) + "\t" + p99.ToString("0", c) + "\t" + max + "\t" + (ok ? "OK" : "DIFF"));
                        if (!ok)
                        {
                            modeBad = true;
                            Save(reference, width, height, Path.Combine(folder, mode.Key + "-" + si + "-glsl.png"));
                            Save(native, width, height, Path.Combine(folder, mode.Key + "-" + si + "-hlsl.png"));
                        }
                    }
                    if (modeBad) bad++;
                    ComCall.Release(pixel);
                }
            }
            report.AppendLine("TOTAL\t" + modes.Count + "\tBAD\t" + bad);
            File.WriteAllText(Path.Combine(folder, "report.tsv"), report.ToString(), new UTF8Encoding(false));
            return bad == 0 ? 0 : 1;
        }

        private static int AccentSheet(List<KeyValuePair<string, string>> modes, string output, string accent)
        {
            const int width = 640, height = 300, columns = 3;
            string blobs = modes.First(m => m.Key == FxShaders.Fallback).Value;
            var ages = new[] { 0.25f, 0.7f };
            using (var sheet = new Bitmap(width * columns, height * 4, PixelFormat.Format32bppArgb))
            using (var g = Graphics.FromImage(sheet))
            using (var offscreen = new FxOffscreen(width, height))
            {
                IntPtr pixel = offscreen.Pipeline.CreatePixel(FxShaders.Pixel(FxShaders.Fallback, blobs, accent));
                try
                {
                    for (int style = 0; style < 6; style++)
                    {
                        for (int a = 0; a < ages.Length; a++)
                        {
                            Sample s = Samples[0];
                            var beats = new float[16];
                            for (int i = 0; i < 16; i++) beats[i] = s.Time - (ages[a] + i * 0.55f);
                            FxPipeline.Fill(offscreen.Pipeline.Constants, width, height, s.Time, 1f, s.Star, style, 1f, 0f, s.Colors, new[] { .5f, .5f, .16f }, s.Hits, new[] { .5f, .4f, .3f, .5f }, beats);
                            offscreen.Draw(pixel);
                            byte[] frame = offscreen.Read();
                            string tmp = Path.GetTempFileName();
                            Save(frame, width, height, tmp);
                            using (var image = Image.FromFile(tmp))
                            {
                                int cell = style * ages.Length + a;
                                g.DrawImage(image, (cell % columns) * width, (cell / columns) * height);
                            }
                            File.Delete(tmp);
                        }
                    }
                }
                finally { ComCall.Release(pixel); }
                sheet.Save(output, ImageFormat.Png);
            }
            return 0;
        }

        private static byte[] Pixels(byte[] png, int width, int height)
        {
            using (var stream = new MemoryStream(png))
            using (var bitmap = new Bitmap(stream))
            {
                if (bitmap.Width != width || bitmap.Height != height) throw new InvalidOperationException("Эталон " + bitmap.Width + "x" + bitmap.Height + " вместо " + width + "x" + height);
                var data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                try
                {
                    var pixels = new byte[width * height * 4];
                    for (int y = 0; y < height; y++) Marshal.Copy(data.Scan0 + y * data.Stride, pixels, y * width * 4, width * 4);
                    return pixels;
                }
                finally { bitmap.UnlockBits(data); }
            }
        }

        private static void Save(byte[] pixels, int width, int height, string path)
        {
            using (var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb))
            {
                var data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                try
                {
                    var copy = (byte[])pixels.Clone();
                    for (int i = 3; i < copy.Length; i += 4) copy[i] = 255;
                    for (int y = 0; y < height; y++) Marshal.Copy(copy, y * width * 4, data.Scan0 + y * data.Stride, width * 4);
                }
                finally { bitmap.UnlockBits(data); }
                bitmap.Save(path, ImageFormat.Png);
            }
        }

        private static void Compare(byte[] a, byte[] b, out double mean, out double p99, out int max)
        {
            var histogram = new long[256];
            long sum = 0, count = 0;
            max = 0;
            for (int i = 0; i < a.Length; i += 4)
            {
                for (int k = 0; k < 3; k++)
                {
                    int d = Math.Abs(a[i + k] - b[i + k]);
                    histogram[d]++;
                    sum += d;
                    count++;
                    if (d > max) max = d;
                }
            }
            mean = (double)sum / count;
            long threshold = (long)(count * 0.99), seen = 0;
            p99 = 0;
            for (int d = 0; d < 256; d++) { seen += histogram[d]; if (seen >= threshold) { p99 = d; break; } }
        }
    }
}
