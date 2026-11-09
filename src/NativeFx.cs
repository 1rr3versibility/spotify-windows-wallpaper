using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace CapriDesktop
{
    internal sealed class NativeFx : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct SwapChainDesc1
        {
            public uint Width, Height;
            public int Format, Stereo;
            public uint SampleCount, SampleQuality, BufferUsage, BufferCount;
            public int Scaling, SwapEffect, AlphaMode;
            public uint Flags;
        }

        [DllImport("d3d11.dll")]
        private static extern int D3D11CreateDevice(IntPtr adapter, int driverType, IntPtr software, uint flags, IntPtr levels, uint levelCount, uint sdkVersion, out IntPtr device, out int level, out IntPtr context);
        [DllImport("dcomp.dll")] private static extern int DCompositionCreateDevice(IntPtr dxgiDevice, ref Guid iid, out IntPtr device);
        [DllImport("winmm.dll")] private static extern uint timeBeginPeriod(uint period);
        [DllImport("winmm.dll")] private static extern uint timeEndPeriod(uint period);
        [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr reserved, uint mode);

        private delegate int GetOutFn(IntPtr self, out IntPtr result);
        private delegate int GetParentFn(IntPtr self, ref Guid iid, out IntPtr result);
        private delegate int CreateCompositionSwapChainFn(IntPtr self, IntPtr device, ref SwapChainDesc1 desc, IntPtr restrict, out IntPtr swapChain);
        private delegate int GetBufferFn(IntPtr self, uint index, ref Guid iid, out IntPtr surface);
        private delegate int PresentFn(IntPtr self, uint sync, uint flags);
        private delegate int CreateViewFn(IntPtr self, IntPtr resource, IntPtr desc, out IntPtr view);
        private delegate int CommitFn(IntPtr self);
        private delegate int CreateTargetFn(IntPtr self, IntPtr hwnd, int topmost, out IntPtr target);
        private delegate int SetPointerFn(IntPtr self, IntPtr value);
        private delegate int SetModeFn(IntPtr self, int mode);
        private delegate int AddVisualFn(IntPtr self, IntPtr visual, int above, IntPtr reference);
        private delegate int SetProtectedFn(IntPtr self, int value);
        private delegate int SetLatencyFn(IntPtr self, uint frames);

        private static readonly Guid DxgiDeviceId = new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");
        private static readonly Guid DxgiFactory2Id = new Guid("50c83a1c-e072-4c48-87b0-3630fa36a6d0");
        private static readonly Guid Texture2DId = new Guid("6f15aaf2-d208-4e89-9ab4-489535d34f9c");
        private static readonly Guid CompositionDeviceId = new Guid("c37ea93a-e7aa-450d-b16f-9746cb0407f3");
        private static readonly Guid MultithreadId = new Guid("9b7e4e00-342c-4106-a19f-4f2704f689f0");

        private static readonly object modesGate = new object();
        private static Dictionary<string, string> modes;
        private static string accentGlsl;
        private float accent, accentGain = 1f, darkTarget, darkNow, backdropTarget, backdropNow;
        private readonly float[] backdropBox = new float[5];
        private byte[] coverPixels;

        private readonly IntPtr hwnd;
        private readonly int width, height;
        private readonly float scale;
        private readonly string modesFolder;
        private readonly Action<string> broken;
        private readonly Action<string, int, int> videoShown;
        private readonly Action<string, string> videoFailed;
        private readonly Thread thread;
        private readonly object gate = new object();
        private readonly float[] audio = new float[4];
        private readonly float[] target = new float[4];
        private float[] colors = { 1f, .6f, .73f, .52f, .87f, .92f, .52f, .42f, .75f };
        private float[] center = { .38f, .54f, .2f };
        private readonly float[] hits = { -100f, -100f, -100f };
        private readonly float[] beats = new float[16];
        private string wantedMode = FxShaders.Fallback;
        private string videoUrl;
        private readonly float[] videoRect = new float[5];
        private volatile bool running = true, paused;
        private DateTime lastFeed = DateTime.MinValue;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct DevMode
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
            public short SpecVersion, DriverVersion, Size, DriverExtra;
            public int Fields, PositionX, PositionY, Orientation, FixedOutput;
            public short Color, Duplex, YResolution, TTOption, Collate;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string FormName;
            public short LogPixels;
            public int BitsPerPel, PelsWidth, PelsHeight, DisplayFlags, DisplayFrequency;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool EnumDisplaySettings(string device, int mode, ref DevMode settings);

        internal static int RefreshOf(string device)
        {
            var settings = new DevMode();
            settings.Size = (short)Marshal.SizeOf(typeof(DevMode));
            if (!EnumDisplaySettings(device, -1, ref settings) || settings.DisplayFrequency < 24) return 60;
            return settings.DisplayFrequency;
        }

        private readonly int interval;
        private readonly double frameMs;

        internal NativeFx(IntPtr hwnd, int width, int height, float scale, int refreshHz, int fps, string modesFolder, Action<string> broken, Action<string, int, int> videoShown, Action<string, string> videoFailed)
        {
            this.hwnd = hwnd;
            this.scale = scale;
            bool paced = fps < 60;
            interval = paced ? 1 : Math.Max(1, Math.Min(4, (int)Math.Round(refreshHz / 60.0)));
            frameMs = paced ? 1000.0 / Math.Max(1, fps) : 0;
            this.modesFolder = modesFolder;
            this.broken = broken;
            this.videoShown = videoShown;
            this.videoFailed = videoFailed;
            this.width = Math.Max(1, (int)Math.Round(width * scale));
            this.height = Math.Max(1, (int)Math.Round(height * scale));
            for (int i = 0; i < beats.Length; i++) beats[i] = -100f;
            thread = new Thread(Run) { IsBackground = true, Name = "Talia native fx", Priority = ThreadPriority.BelowNormal };
            thread.Start();
        }

        internal bool Paused { set { paused = value; } }

        private volatile bool failed;
        internal bool Broken { get { return failed; } private set { failed = value; } }

        internal static Dictionary<string, string> Modes(string folder)
        {
            lock (modesGate)
            {
                if (modes != null) return modes;
                var loaded = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var pair in FxShaders.LoadModes(folder)) loaded[pair.Key] = pair.Value;
                accentGlsl = FxShaders.LoadAccent(System.IO.Path.GetDirectoryName(folder));
                modes = loaded;
                return modes;
            }
        }

        internal void SetBackdrop(float[] amount, string coverBase64)
        {
            byte[] pixels = null;
            if (!string.IsNullOrEmpty(coverBase64))
            {
                byte[] rgba = Convert.FromBase64String(coverBase64);
                if (rgba.Length != 512 * 512 * 4) throw new ArgumentException("Обложка для фона должна быть 512×512, пришло " + rgba.Length + " байт");
                pixels = new byte[rgba.Length];
                for (int i = 0; i < rgba.Length; i += 4) { pixels[i] = rgba[i + 2]; pixels[i + 1] = rgba[i + 1]; pixels[i + 2] = rgba[i]; pixels[i + 3] = 255; }
            }
            lock (gate)
            {
                if (amount != null && amount.Length == 6)
                {
                    backdropTarget = Math.Max(0f, Math.Min(1f, amount[0]));
                    Array.Copy(amount, 1, backdropBox, 0, 5);
                }
                if (pixels != null) coverPixels = pixels;
            }
        }

        internal void SetPalette(float[] rgb, float[] coverCenter, string mode, float[] accentStyle, float[] dark)
        {
            lock (gate)
            {
                if (dark != null && dark.Length == 1) darkTarget = Math.Max(0f, Math.Min(1f, dark[0]));
                if (rgb != null && rgb.Length == 9) colors = rgb;
                if (coverCenter != null && coverCenter.Length == 3) center = coverCenter;
                if (!string.IsNullOrEmpty(mode)) wantedMode = mode;
                if (accentStyle != null && accentStyle.Length == 2) { accent = accentStyle[0]; accentGain = accentStyle[1]; }
            }
        }

        internal void SetVideo(string url, float[] rect)
        {
            lock (gate)
            {
                videoUrl = string.IsNullOrEmpty(url) ? null : url;
                if (rect != null && rect.Length == 5) Array.Copy(rect, videoRect, 5);
                else Array.Clear(videoRect, 0, 5);
            }
        }

        internal void Feed(float bass, float mid, float high, float level, bool hit)
        {
            lock (gate)
            {
                target[0] = bass; target[1] = mid; target[2] = high; target[3] = level;
                lastFeed = DateTime.UtcNow;
                if (!hit) return;
                float now = Clock();
                hits[2] = hits[1]; hits[1] = hits[0]; hits[0] = now;
                Array.Copy(beats, 0, beats, 1, beats.Length - 1);
                beats[0] = now;
            }
        }

        internal static float Clock()
        {
            return (float)((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds % 10000.0);
        }

        private void Run()
        {
            IntPtr device = IntPtr.Zero, context = IntPtr.Zero, dxgiDevice = IntPtr.Zero, adapter = IntPtr.Zero, factory = IntPtr.Zero;
            IntPtr swapChain = IntPtr.Zero, backBuffer = IntPtr.Zero, view = IntPtr.Zero;
            IntPtr composition = IntPtr.Zero, compTarget = IntPtr.Zero, visual = IntPtr.Zero, root = IntPtr.Zero;
            IntPtr fallbackPixel = IntPtr.Zero, modePixel = IntPtr.Zero, coverTexture = IntPtr.Zero, coverView = IntPtr.Zero;
            bool coverReady = false;
            FxPipeline pipeline = null;
            NativeVideo video = null;
            Task<IntPtr> compiling = null;
            string compilingMode = null, currentMode = FxShaders.Fallback;
            var failedModes = new HashSet<string>(StringComparer.Ordinal);
            timeBeginPeriod(1);
            CoInitializeEx(IntPtr.Zero, 0);
            try
            {
                int level;
                ComCall.Check(D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, 0x20 | 0x800, IntPtr.Zero, 0, 7, out device, out level, out context), "D3D11CreateDevice");
                IntPtr multithread = ComCall.Query(device, MultithreadId, "ID3D10Multithread");
                ComCall.Method<SetProtectedFn>(multithread, 5)(multithread, 1);
                ComCall.Release(multithread);
                dxgiDevice = ComCall.Query(device, DxgiDeviceId, "IDXGIDevice");
                IntPtr dxgiDevice1 = ComCall.Query(device, new Guid("77db970f-6276-48ba-ba28-070143b4392c"), "IDXGIDevice1");
                ComCall.Check(ComCall.Method<SetLatencyFn>(dxgiDevice1, 12)(dxgiDevice1, 1), "SetMaximumFrameLatency");
                ComCall.Release(dxgiDevice1);
                ComCall.Check(ComCall.Method<GetOutFn>(dxgiDevice, 7)(dxgiDevice, out adapter), "GetAdapter");
                Guid id = DxgiFactory2Id;
                ComCall.Check(ComCall.Method<GetParentFn>(adapter, 6)(adapter, ref id, out factory), "IDXGIFactory2");
                var desc = new SwapChainDesc1
                {
                    Width = (uint)width, Height = (uint)height, Format = 87, SampleCount = 1, BufferUsage = 0x20, BufferCount = 2,
                    Scaling = 0, SwapEffect = 3, AlphaMode = 3
                };
                ComCall.Check(ComCall.Method<CreateCompositionSwapChainFn>(factory, 24)(factory, device, ref desc, IntPtr.Zero, out swapChain), "CreateSwapChainForComposition");
                id = Texture2DId;
                ComCall.Check(ComCall.Method<GetBufferFn>(swapChain, 9)(swapChain, 0, ref id, out backBuffer), "GetBuffer");
                ComCall.Check(ComCall.Method<CreateViewFn>(device, 9)(device, backBuffer, IntPtr.Zero, out view), "CreateRenderTargetView");

                pipeline = new FxPipeline(device, context);
                var all = Modes(modesFolder);
                string fallbackGlsl;
                if (!all.TryGetValue(FxShaders.Fallback, out fallbackGlsl)) throw new InvalidOperationException("Не найден режим " + FxShaders.Fallback + " в " + modesFolder);
                string accentSource = accentGlsl;
                fallbackPixel = pipeline.CreatePixel(FxShaders.Pixel(FxShaders.Fallback, fallbackGlsl, accentSource));

                id = CompositionDeviceId;
                ComCall.Check(DCompositionCreateDevice(dxgiDevice, ref id, out composition), "DCompositionCreateDevice");
                ComCall.Check(ComCall.Method<CreateTargetFn>(composition, 6)(composition, hwnd, 0, out compTarget), "CreateTargetForHwnd");
                ComCall.Check(ComCall.Method<GetOutFn>(composition, 7)(composition, out visual), "CreateVisual");
                ComCall.Check(ComCall.Method<SetPointerFn>(visual, 15)(visual, swapChain), "SetContent");
                if (scale != 1f)
                {
                    var matrix = new float[] { 1f / scale, 0f, 0f, 1f / scale, 0f, 0f };
                    var held = GCHandle.Alloc(matrix, GCHandleType.Pinned);
                    try { ComCall.Check(ComCall.Method<SetPointerFn>(visual, 8)(visual, held.AddrOfPinnedObject()), "SetTransform"); }
                    finally { held.Free(); }
                    ComCall.Check(ComCall.Method<SetModeFn>(visual, 11)(visual, 1), "SetBitmapInterpolationMode");
                }
                ComCall.Check(ComCall.Method<GetOutFn>(composition, 7)(composition, out root), "CreateVisual (корень)");
                ComCall.Check(ComCall.Method<AddVisualFn>(root, 16)(root, visual, 0, IntPtr.Zero), "AddVisual (фон)");
                ComCall.Check(ComCall.Method<SetPointerFn>(compTarget, 3)(compTarget, root), "SetRoot");
                coverTexture = pipeline.CreateTexture(512, 512, false, out coverView);
                try { video = new NativeVideo(device, factory, composition, root, pipeline, videoShown, videoFailed); }
                catch (Exception error)
                {
                    Journal.Write("Видеообложка: слой", error);
                    video = null;
                }
                var commit = ComCall.Method<CommitFn>(composition, 3);
                ComCall.Check(commit(composition), "Commit");
                var present = ComCall.Method<PresentFn>(swapChain, 8);

                var clock = Stopwatch.StartNew();
                double last = 0, modeAt = -10000;
                float star = Clock() % 100000f;
                float[] data = pipeline.Constants;
                while (running)
                {
                    if (paused)
                    {
                        if (video != null) RunVideo(ref video, commit, composition, true);
                        Thread.Sleep(100);
                        last = 0;
                        continue;
                    }
                    double nowMs = clock.Elapsed.TotalMilliseconds;
                    if (frameMs > 0 && last != 0 && nowMs - last < frameMs - 1.0)
                    {
                        Thread.Sleep(Math.Max(1, (int)(frameMs - (nowMs - last) - 1.0)));
                        continue;
                    }
                    float dt = last == 0 ? 0f : (float)Math.Min(0.1, (nowMs - last) / 1000.0);
                    last = nowMs;

                    string wanted;
                    lock (gate) wanted = wantedMode;
                    if (compiling == null && wanted != currentMode && wanted != compilingMode && !failedModes.Contains(wanted))
                    {
                        string glsl;
                        if (wanted == FxShaders.Fallback)
                        {
                            if (modePixel != IntPtr.Zero) { ComCall.Release(modePixel); modePixel = IntPtr.Zero; }
                            currentMode = wanted;
                            modeAt = nowMs;
                        }
                        else if (all.TryGetValue(wanted, out glsl))
                        {
                            compilingMode = wanted;
                            FxPipeline owner = pipeline;
                            string source = FxShaders.Pixel(wanted, glsl, accentSource);
                            compiling = Task.Run(() => owner.CreatePixel(source));
                        }
                        else
                        {
                            failedModes.Add(wanted);
                            Journal.Write("Нативный фон обоев", new InvalidOperationException("Режим " + wanted + " не найден в " + modesFolder));
                        }
                    }
                    if (compiling != null && compiling.IsCompleted)
                    {
                        if (compiling.Status == TaskStatus.RanToCompletion)
                        {
                            if (modePixel != IntPtr.Zero) ComCall.Release(modePixel);
                            modePixel = compiling.Result;
                            currentMode = compilingMode;
                            modeAt = nowMs;
                        }
                        else
                        {
                            failedModes.Add(compilingMode);
                            Journal.Write("Нативный фон обоев: режим " + compilingMode, compiling.Exception.GetBaseException());
                        }
                        compiling = null;
                        compilingMode = null;
                    }

                    lock (gate)
                    {
                        if ((DateTime.UtcNow - lastFeed).TotalMilliseconds > 600) { target[0] = target[1] = target[2] = target[3] = 0f; }
                        float rise = 1f - (float)Math.Exp(-dt / 0.08), fall = 1f - (float)Math.Exp(-dt / 0.3);
                        for (int i = 0; i < 4; i++) audio[i] += (target[i] - audio[i]) * (target[i] > audio[i] ? rise : fall);
                        star = (star + dt * (1f + audio[3] * 1.8f)) % 100000f;
                        float fade = (float)Math.Min(1.0, (nowMs - modeAt) / 1500.0);
                        darkNow += (darkTarget - darkNow) * (1f - (float)Math.Exp(-dt / 0.5));
                        backdropNow += (backdropTarget - backdropNow) * (1f - (float)Math.Exp(-dt / 0.04));
                        FxPipeline.Fill(data, width, height, Clock(), fade, star, accent, accentGain, darkNow, colors, center, hits, audio, beats);
                        if (coverPixels != null)
                        {
                            pipeline.UploadTexture(coverTexture, coverPixels, 512);
                            coverPixels = null;
                            coverReady = true;
                        }
                    }
                    IntPtr backdropView = video != null ? video.SmallView : IntPtr.Zero;
                    float backdropAspect = backdropView != IntPtr.Zero ? video.SmallAspect : 1f;
                    if (backdropView == IntPtr.Zero && coverReady) backdropView = coverView;
                    pipeline.BindBackdrop(backdropView);
                    float[] box;
                    lock (gate) box = (float[])backdropBox.Clone();
                    pipeline.SetBackdrop(backdropView != IntPtr.Zero && box[2] > 0f ? backdropNow : 0f, backdropAspect, box);
                    pipeline.Draw(view, width, height, currentMode == FxShaders.Fallback || modePixel == IntPtr.Zero ? fallbackPixel : modePixel);
                    int hr = present(swapChain, (uint)interval, 0);
                    if (hr < 0) throw new InvalidOperationException("Present вернул 0x" + hr.ToString("X8"));
                    if (video != null) RunVideo(ref video, commit, composition, false);
                }
            }
            catch (Exception error)
            {
                Journal.Write("Нативный фон обоев", error);
                Broken = true;
                if (running) broken(error.Message);
            }
            finally
            {
                if (compiling != null)
                {
                    try { compiling.Wait(5000); if (compiling.Status == TaskStatus.RanToCompletion) ComCall.Release(compiling.Result); }
                    catch (AggregateException) { }
                }
                if (video != null) { try { video.Dispose(); } catch (Exception error) { Journal.Write("Видеообложка: закрытие", error); } }
                ComCall.Release(modePixel);
                ComCall.Release(fallbackPixel);
                ComCall.Release(coverView);
                ComCall.Release(coverTexture);
                if (pipeline != null) pipeline.Dispose();
                foreach (IntPtr item in new[] { root, visual, compTarget, composition, view, backBuffer, swapChain, factory, adapter, dxgiDevice, context, device })
                    ComCall.Release(item);
                timeEndPeriod(1);
            }
        }

        private void RunVideo(ref NativeVideo video, CommitFn commit, IntPtr composition, bool pause)
        {
            string url;
            float x, y, w, h, r;
            lock (gate)
            {
                url = videoUrl;
                x = videoRect[0]; y = videoRect[1]; w = videoRect[2]; h = videoRect[3]; r = videoRect[4];
            }
            try
            {
                if (video.Update(url, x, y, w, h, r, pause)) commit(composition);
            }
            catch (Exception error)
            {
                Journal.Write("Видеообложка: отрисовка", error);
                if (url != null) videoFailed(url, error.Message);
                try { video.Dispose(); } catch (Exception) { }
                video = null;
                commit(composition);
            }
        }

        public void Dispose()
        {
            running = false;
            if (Thread.CurrentThread != thread) thread.Join(3000);
        }
    }
}
