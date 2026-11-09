using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CapriDesktop
{
    internal sealed class Wallpaper : Form
    {
        private const string Host = "talia.wallpaper";
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
        private readonly string pages, dataFolder;
        private readonly Func<string> character;
        private readonly float nativeScale;
        private readonly int frameRate;
        private readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Transparent };
        private NativeFx nativeFx;
        private readonly Desktop.MouseRelay relay;
        private static readonly object pulseGate = new object();
        private static readonly List<Wallpaper> listeners = new List<Wallpaper>();
        private static AudioPulse sharedPulse;
        private SearchBox searchBox;
        private IntPtr webHandle, widget;
        private bool closing;

        internal event Action Lost;
        internal static Func<bool?> AppHearted;

        internal sealed class Reply
        {
            internal int Status;
            internal string Body;
        }

        private readonly Rectangle screenBounds, workArea;
        private readonly string screenName;
        private readonly System.Windows.Forms.Timer coverWatch = new System.Windows.Forms.Timer { Interval = 1000 };
        private volatile bool covered;

        internal static SpicetifyBridge Bridge;
        private static readonly HashSet<string> BridgeOps = new HashSet<string>
        {
            "play", "pause", "next", "previous", "seek", "volume", "shuffle", "repeat", "dj", "liked-play", "contains", "like", "unlike",
            "enqueue", "queue", "playlists", "playlist", "liked", "search", "search-tracks", "artist", "artist-albums", "album", "mixes", "lyrics"
        };

        internal Wallpaper(string pagesFolder, string dataFolder, Func<string> character, Screen screen, float scale, int fps)
        {
            nativeScale = scale;
            frameRate = fps;
            screenBounds = screen.Bounds;
            screenName = screen.DeviceName;
            workArea = screen.WorkingArea;
            coverWatch.Tick += delegate { CheckCovered(); };
            pages = pagesFolder;
            this.dataFolder = dataFolder;
            this.character = character;
            Text = "Spotify on Wallpaper";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(19, 21, 33);
            Bounds = screenBounds;
            Controls.Add(web);
            relay = new Desktop.MouseRelay(RenderWidget, screenBounds, Wheel);
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams p = base.CreateParams;
                p.ExStyle = (p.ExStyle | 0x00000080 | 0x08000000 | 0x00200000) & ~0x00040000;
                return p;
            }
        }

        internal bool Loaded { get; private set; }

        internal Task<string> Evaluate(string script) { return web.CoreWebView2.ExecuteScriptAsync(script); }

        internal string ParentClass { get { return Desktop.ClassOfParent(Handle); } }

        protected override async void OnShown(EventArgs e)
        {
            base.OnShown(e);
            try { await Start(); }
            catch (Exception error)
            {
                if (closing || IsDisposed) return;
                Journal.Write("Обои", error);
                MessageBox.Show("Обои не запустились: " + error.Message, "Spotify on Wallpaper", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Close();
            }
        }

        private async Task Start()
        {
            webHandle = web.Handle;
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataFolder, "WebView2"));
            if (closing || IsDisposed) return;
            await web.EnsureCoreWebView2Async(environment);
            if (closing || IsDisposed) return;
            CoreWebView2 core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.SetVirtualHostNameToFolderMapping(Host, Path.GetDirectoryName(pages), CoreWebView2HostResourceAccessKind.Deny);
            core.NavigationStarting += (s, a) => { if (!a.Uri.StartsWith("https://" + Host + "/", StringComparison.Ordinal)) a.Cancel = true; };
            core.NewWindowRequested += (s, a) => a.Handled = true;
            core.WebMessageReceived += Received;
            core.NavigationCompleted += (s, a) => { Loaded = a.IsSuccess; };
            Attach();
            nativeFx = new NativeFx(Handle, ClientSize.Width, ClientSize.Height, nativeScale, NativeFx.RefreshOf(screenName), frameRate, Path.Combine(pages, "modes"),
                reason => PostFromAnyThread("{\"nativeFxFailed\":" + Json.Serialize(reason) + "}"),
                (url, w, h) => PostFromAnyThread("{\"canvasShown\":{\"url\":" + Json.Serialize(url) + ",\"w\":" + w + ",\"h\":" + h + "}}"),
                (url, reason) => PostFromAnyThread("{\"canvasFailed\":{\"url\":" + Json.Serialize(url) + ",\"reason\":" + Json.Serialize(reason) + "}}"));
            core.Navigate("https://" + Host + "/" + Path.GetFileName(pages) + "/index.html");
            relay.Start();
            Listen(this);
            coverWatch.Start();
        }

        private static void Listen(Wallpaper paper)
        {
            lock (pulseGate)
            {
                if (!listeners.Contains(paper)) listeners.Add(paper);
                if (sharedPulse != null) return;
                sharedPulse = new AudioPulse(Broadcast);
                sharedPulse.Start();
            }
        }

        private static void Unlisten(Wallpaper paper)
        {
            AudioPulse stop = null;
            lock (pulseGate)
            {
                listeners.Remove(paper);
                if (listeners.Count == 0) { stop = sharedPulse; sharedPulse = null; }
            }
            if (stop != null) stop.Dispose();
        }

        private static void Broadcast(AudioPulse.Beat beat)
        {
            Wallpaper[] copy;
            lock (pulseGate) copy = listeners.ToArray();
            foreach (Wallpaper paper in copy) paper.Pulse(beat);
        }

        private void CheckCovered()
        {
            if (closing || IsDisposed) return;
            bool now = Desktop.Covered(workArea);
            if (now == covered) return;
            covered = now;
            web.Visible = !now;
            if (nativeFx != null) nativeFx.Paused = now;
        }

        private void Pulse(AudioPulse.Beat beat)
        {
            NativeFx fx = nativeFx;
            if (fx != null) fx.Feed(beat.Bass, beat.Mid, beat.High, beat.Level, beat.Hit);
            if (closing || IsDisposed || !IsHandleCreated || covered) return;
            var c = System.Globalization.CultureInfo.InvariantCulture;
            string message = "{\"pulse\":[" + beat.Bass.ToString("0.###", c) + "," + beat.Mid.ToString("0.###", c) + "," + beat.High.ToString("0.###", c) + "," +
                beat.Level.ToString("0.###", c) + "," + (beat.Hit ? "1" : "0") + "]}";
            try
            {
                BeginInvoke((Action)delegate
                {
                    if (!closing && !IsDisposed && Loaded && web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(message);
                });
            }
            catch (InvalidOperationException) { }
        }

        private void Wheel(int x, int y, int delta)
        {
            if (closing || IsDisposed || !IsHandleCreated) return;
            string message = "{\"wheel\":[" + (x - screenBounds.Left) + "," + (y - screenBounds.Top) + "," + delta + "]}";
            try { BeginInvoke((Action)delegate { Post(message); }); }
            catch (InvalidOperationException) { }
        }

        private IntPtr RenderWidget()
        {
            IntPtr known = widget;
            if (known != IntPtr.Zero && Desktop.IsWindow(known)) return known;
            widget = webHandle == IntPtr.Zero ? IntPtr.Zero : Desktop.FindDescendant(webHandle, "Chrome_RenderWidgetHostHWND");
            return widget;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            closing = true;
            base.OnFormClosing(e);
        }

        protected override void OnHandleDestroyed(EventArgs e)
        {
            base.OnHandleDestroyed(e);
            if (closing || Disposing || IsDisposed) return;
            closing = true;
            relay.Dispose();
            Unlisten(this);
            Action lost = Lost;
            if (lost != null) lost();
        }

        private void Attach()
        {
            Desktop.AttachBehindIcons(Handle, screenBounds);
        }

        private void Received(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (!e.Source.StartsWith("https://" + Host + "/", StringComparison.Ordinal)) return;
            Dictionary<string, object> message;
            try { message = Json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); }
            catch (ArgumentException error)
            {
                Journal.Write("Сообщение от страницы обоев", error);
                return;
            }
            object fxState;
            if (message.TryGetValue("fx", out fxState))
            {
                var fields = fxState as Dictionary<string, object>;
                if (nativeFx != null && fields != null)
                {
                    object modeId, videoUrl;
                    fields.TryGetValue("mode", out modeId);
                    nativeFx.SetPalette(Floats(fields, "colors"), Floats(fields, "center"), modeId as string, Floats(fields, "accent"), Floats(fields, "dark"));
                    fields.TryGetValue("video", out videoUrl);
                    nativeFx.SetVideo(videoUrl as string, Floats(fields, "rect"));
                    object cover;
                    fields.TryGetValue("cover", out cover);
                    try { nativeFx.SetBackdrop(Floats(fields, "backdrop"), cover as string); }
                    catch (FormatException error) { Journal.Write("Обложка для размытого фона", error); }
                    catch (ArgumentException error) { Journal.Write("Обложка для размытого фона", error); }
                }
                return;
            }
            object id, op, args;
            message.TryGetValue("id", out id);
            message.TryGetValue("op", out op);
            message.TryGetValue("args", out args);
            var parameters = args as Dictionary<string, object> ?? new Dictionary<string, object>();
            string name = op as string ?? "";
            Task.Run(() => Answer(name, parameters)).ContinueWith(task =>
            {
                var reply = new Dictionary<string, object> { { "id", id } };
                if (task.IsFaulted)
                {
                    Exception error = task.Exception.GetBaseException();
                    reply["status"] = 0;
                    reply["error"] = error.Message;
                    if (!(error is ArgumentException)) Journal.Write("Обои → Spotify «" + name + "»", error);
                }
                else
                {
                    reply["status"] = task.Result.Status;
                    reply["body"] = task.Result.Body;
                }
                if (!closing && !IsDisposed && web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(Json.Serialize(reply));
            }, TaskScheduler.FromCurrentSynchronizationContext());
        }

        private void PostFromAnyThread(string json)
        {
            if (closing || IsDisposed || !IsHandleCreated) return;
            try { BeginInvoke((Action)delegate { Post(json); }); }
            catch (InvalidOperationException) { }
        }

        private static float[] Floats(Dictionary<string, object> a, string key)
        {
            object value;
            var list = a.TryGetValue(key, out value) ? value as System.Collections.ArrayList : null;
            if (list == null) return null;
            var result = new float[list.Count];
            for (int i = 0; i < list.Count; i++) result[i] = Convert.ToSingle(list[i], System.Globalization.CultureInfo.InvariantCulture);
            return result;
        }

        internal async Task Snapshot(string path)
        {
            using (var file = File.Create(path)) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, file);
        }

        internal Reply Answer(string op, Dictionary<string, object> a)
        {
            SpicetifyBridge bridge = Bridge;
            bool viaApp = bridge != null && bridge.Connected;
            if (op == "status")
                return new Reply { Status = 200, Body = Json.Serialize(new Dictionary<string, object>
                    { { "configured", SpicetifyInstaller.FindCli() != null }, { "connected", viaApp }, { "character", character() }, { "problem", null }, { "source", "spicetify" }, { "nativeFx", nativeFx != null && !nativeFx.Broken }, { "fps", frameRate } }) };
            if (op == "search-input")
            {
                double scale = Num(a, "scale");
                if (scale <= 0 || scale > 8) scale = 1;
                var place = new Rectangle((int)(Num(a, "x") * scale), (int)(Num(a, "y") * scale), (int)(Num(a, "w") * scale), (int)(Num(a, "h") * scale));
                string text = a.ContainsKey("text") && a["text"] is string ? (string)a["text"] : "";
                BeginInvoke((Action)delegate { ShowSearch(place, text); });
                return new Reply { Status = 200, Body = "{}" };
            }
            if (!viaApp) return new Reply { Status = 503, Body = "{\"error\":\"Spotify с расширением Spicetify не подключён\"}" };
            return AnswerFromApp(bridge, op, a ?? new Dictionary<string, object>());
        }

        private static readonly object coverGate = new object();
        private static string coverKey, coverData;
        private static DateTime coverReadAt = DateTime.MinValue;

        private static string SessionCover()
        {
            lock (coverGate)
            {
                if ((DateTime.UtcNow - coverReadAt).TotalSeconds < 2) return coverData;
                coverReadAt = DateTime.UtcNow;
                Tune tune;
                try { tune = Tunes.Spotify(); }
                catch (Exception error) { Journal.Write("Обложка из медиасессии", error); return coverData; }
                if (tune == null || tune.Thumbnail == null) return coverData = null;
                if (tune.Key == coverKey) return coverData;
                try
                {
                    var opening = tune.Thumbnail.OpenReadAsync().AsTask();
                    if (!opening.Wait(1500)) return coverData;
                    using (var random = opening.Result)
                    {
                        if (random.Size == 0 || random.Size > 4 * 1024 * 1024) return coverData = null;
                        using (Stream input = System.IO.WindowsRuntimeStreamExtensions.AsStreamForRead(random.GetInputStreamAt(0)))
                        using (var buffer = new MemoryStream())
                        {
                            input.CopyTo(buffer);
                            byte[] bytes = buffer.ToArray();
                            string type = bytes.Length > 3 && bytes[0] == 0x89 && bytes[1] == 0x50 ? "image/png" : "image/jpeg";
                            coverKey = tune.Key;
                            coverData = "data:" + type + ";base64," + Convert.ToBase64String(bytes);
                        }
                    }
                }
                catch (Exception error) { Journal.Write("Обложка из медиасессии", error); }
                return coverData;
            }
        }

        private static long liveStateUntil;
        private static readonly HashSet<string> Mutating = new HashSet<string>
        {
            "play", "resume", "pause", "next", "previous", "seek", "volume", "shuffle", "repeat", "dj", "liked-play", "like", "unlike", "enqueue"
        };

        private Reply AnswerFromApp(SpicetifyBridge bridge, string op, Dictionary<string, object> a)
        {
            try
            {
                if (op == "state")
                {
                    bool live = DateTime.UtcNow.Ticks < Interlocked.Read(ref liveStateUntil) || bridge.State == null;
                    string state = live ? bridge.CallSync("state", null) : bridge.State;
                    if (live) bridge.Remember(state);
                    var data = Json.Deserialize<Dictionary<string, object>>(state);
                    object playing, progress;
                    if (!live && data != null && data.TryGetValue("is_playing", out playing) && playing is bool && (bool)playing && data.TryGetValue("progress_ms", out progress) && progress != null)
                        data["progress_ms"] = Convert.ToDouble(progress, System.Globalization.CultureInfo.InvariantCulture) + bridge.StateAgeMs;
                    if (data != null) data["cover_data"] = SessionCover();
                    return new Reply { Status = 200, Body = Json.Serialize(data) };
                }
                if (!BridgeOps.Contains(op)) return new Reply { Status = 400, Body = "{\"error\":\"unknown op\"}" };
                var args = new Dictionary<string, object>(a);
                if (op == "play" && args.Count == 0) op = "resume";
                bool slow = op == "search" || op == "artist" || op == "album" || op == "playlists" || op == "liked" || op == "playlist" || op == "mixes" || op == "lyrics";
                string body = bridge.CallSync(op, args, slow ? 15000 : 8000);
                if (Mutating.Contains(op)) Interlocked.Exchange(ref liveStateUntil, DateTime.UtcNow.AddSeconds(4).Ticks);
                return new Reply { Status = 200, Body = body };
            }
            catch (Exception error)
            {
                Journal.Write("Обои → Spotify «" + op + "»", error);
                return new Reply { Status = 502, Body = Json.Serialize(new Dictionary<string, object> { { "error", error.Message } }) };
            }
        }

        internal void CharacterChanged()
        {
            if (Loaded) Post("{\"characterChanged\":true}");
        }

        private void ShowSearch(Rectangle place, string text)
        {
            if (closing || IsDisposed) return;
            if (searchBox != null && !searchBox.IsDisposed) searchBox.Close();
            Point origin = web.PointToScreen(Point.Empty);
            place.Offset(origin);
            searchBox = new SearchBox(place, text,
                query => Post("{\"searchText\":" + Json.Serialize(query) + "}"),
                () => Post("{\"searchDone\":true}"));
            searchBox.Show();
        }

        private void Post(string json)
        {
            if (!closing && !IsDisposed && web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(json);
        }

        private static double Num(Dictionary<string, object> a, string key)
        {
            object value;
            if (!a.TryGetValue(key, out value) || value == null) return 0;
            return Convert.ToDouble(value, System.Globalization.CultureInfo.InvariantCulture);
        }

        private static int Int(Dictionary<string, object> a, string key)
        {
            object value;
            if (!a.TryGetValue(key, out value) || value == null) return 0;
            return Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
        }

        private static bool Bool(Dictionary<string, object> a, string key)
        {
            object value;
            return a.TryGetValue(key, out value) && value is bool && (bool)value;
        }

        private static string Str(Dictionary<string, object> a, string key)
        {
            object value;
            if (!a.TryGetValue(key, out value) || !(value is string)) throw new ArgumentException("Нет параметра " + key);
            return (string)value;
        }

        private static string Id(Dictionary<string, object> a, string key)
        {
            string value = Str(a, key);
            foreach (char c in value) if (!char.IsLetterOrDigit(c)) throw new ArgumentException("Неверный id");
            return value;
        }

        private static string Uri(string value)
        {
            if (!value.StartsWith("spotify:", StringComparison.Ordinal) || value.Length > 200) throw new ArgumentException("Неверный Spotify URI");
            foreach (char c in value) if (!(char.IsLetterOrDigit(c) || c == ':' || c == '%' || c == '+' || c == '.' || c == '-' || c == '_')) throw new ArgumentException("Неверный Spotify URI");
            return value;
        }

        private static string Repeat(Dictionary<string, object> a)
        {
            string mode = Str(a, "mode");
            if (mode != "off" && mode != "context" && mode != "track") throw new ArgumentException("Неверный режим повтора");
            return mode;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                coverWatch.Dispose();
                relay.Dispose();
                Unlisten(this);
                if (nativeFx != null) nativeFx.Dispose();
                if (searchBox != null && !searchBox.IsDisposed) searchBox.Dispose();
                web.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal static class Desktop
    {
        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr FindWindow(string cls, string name);
        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
        [DllImport("user32.dll")] private static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc proc, IntPtr l);
        [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc proc, IntPtr l);
        [DllImport("user32.dll")] private static extern int GetClassName(IntPtr h, StringBuilder s, int n);
        [DllImport("user32.dll")] private static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr h, int i);
        [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr h, int i, int v);
        [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(POINT p);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr h, uint flags);
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] private static extern bool ScreenToClient(IntPtr h, ref POINT p);
        [DllImport("user32.dll")] internal static extern uint RegisterWindowMessage(string name);
        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
        [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
        [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr w, IntPtr l);
        [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string name);
        [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] private static extern int GetMessage(out MSG message, IntPtr window, uint min, uint max);
        [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, uint message, IntPtr w, IntPtr l);

        private delegate bool EnumProc(IntPtr h, IntPtr l);
        private delegate IntPtr HookProc(int code, IntPtr w, IntPtr l);
        [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public POINT pt; }
        [StructLayout(LayoutKind.Sequential)] private struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public IntPtr extra; }

        private const int WsChild = 0x40000000;
        private const int WsPopup = unchecked((int)0x80000000);

        private static string ClassOf(IntPtr h)
        {
            var name = new StringBuilder(256);
            GetClassName(h, name, name.Capacity);
            return name.ToString();
        }

        [DllImport("user32.dll")] private static extern IntPtr GetParent(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr h);

        internal static string ClassOfParent(IntPtr window) { return ClassOf(GetParent(window)); }

        internal static bool Ready()
        {
            IntPtr progman = FindWindow("Progman", null);
            if (progman == IntPtr.Zero) return false;
            if (FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) return true;
            bool found = false;
            EnumWindows((h, l) =>
            {
                if (FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero) return true;
                found = true;
                return false;
            }, IntPtr.Zero);
            return found;
        }

        internal static IntPtr FindDescendant(IntPtr parent, string cls)
        {
            IntPtr found = IntPtr.Zero;
            EnumChildWindows(parent, (h, l) =>
            {
                if (ClassOf(h) != cls) return true;
                found = h;
                return false;
            }, IntPtr.Zero);
            return found;
        }

        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out RECT r);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr h, int attribute, out int value, int size);
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }

        internal static bool Covered(Rectangle area)
        {
            uint mine = (uint)Process.GetCurrentProcess().Id;
            bool found = false;
            EnumWindows((h, l) =>
            {
                if (!IsWindowVisible(h) || IsIconic(h)) return true;
                uint pid;
                GetWindowThreadProcessId(h, out pid);
                if (pid == mine) return true;
                int cloaked;
                if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
                if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
                string cls = ClassOf(h);
                if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd") return true;
                RECT r;
                if (!GetWindowRect(h, out r)) return true;
                if (r.Left <= area.Left + 8 && r.Top <= area.Top + 8 && r.Right >= area.Right - 8 && r.Bottom >= area.Bottom - 8)
                {
                    found = true;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        internal static void AttachBehindIcons(IntPtr window, Rectangle screen)
        {
            IntPtr progman = FindWindow("Progman", null);
            if (progman == IntPtr.Zero) throw new InvalidOperationException("Не найден рабочий стол (Progman).");
            IntPtr ignored;
            SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(1), 0, 1000, out ignored);
            SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, 0, 1000, out ignored);
            Rectangle desk = SystemInformation.VirtualScreen;
            int x = screen.Left - desk.Left, y = screen.Top - desk.Top;
            int style = GetWindowLong(window, -16);
            SetWindowLong(window, -16, (style & ~WsPopup) | WsChild);

            IntPtr icons = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (icons != IntPtr.Zero)
            {
                SetParent(window, progman);
                SetWindowPos(window, icons, x, y, screen.Width, screen.Height, 0x0010 | 0x0040);
                IntPtr shellWorker = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
                if (shellWorker != IntPtr.Zero) SetWindowPos(shellWorker, new IntPtr(1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
                return;
            }
            IntPtr host = IntPtr.Zero;
            EnumWindows((h, l) =>
            {
                if (FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero) return true;
                host = h;
                return false;
            }, IntPtr.Zero);
            IntPtr worker = host == IntPtr.Zero ? IntPtr.Zero : FindWindowEx(IntPtr.Zero, host, "WorkerW", null);
            if (worker == IntPtr.Zero) throw new InvalidOperationException("Не нашёл слой обоев рабочего стола (WorkerW).");
            SetParent(window, worker);
            SetWindowPos(window, IntPtr.Zero, x, y, screen.Width, screen.Height, 0x0004 | 0x0010 | 0x0040);
        }

        private static bool OnDesktop(POINT p)
        {
            IntPtr under = WindowFromPoint(p);
            if (under == IntPtr.Zero) return false;
            string root = ClassOf(GetAncestor(under, 2));
            return root == "Progman" || root == "WorkerW";
        }

        internal sealed class MouseRelay : IDisposable
        {
            private readonly Func<IntPtr> target;
            private readonly Rectangle area;
            private readonly Action<int, int, int> wheel;
            private readonly System.Collections.Concurrent.BlockingCollection<Motion> queue = new System.Collections.Concurrent.BlockingCollection<Motion>(512);
            private HookProc proc;
            private Thread hookThread, workThread;
            private uint hookThreadId;
            private volatile bool stopping;

            private struct Motion { public int Message; public POINT Point; public int Wheel; }

            internal MouseRelay(Func<IntPtr> target, Rectangle area, Action<int, int, int> wheel)
            {
                this.target = target;
                this.area = area;
                this.wheel = wheel;
            }

            internal void Start()
            {
                if (hookThread != null) return;
                var installed = new ManualResetEventSlim();
                Exception failure = null;
                hookThread = new Thread(() =>
                {
                    hookThreadId = GetCurrentThreadId();
                    proc = Hook;
                    IntPtr hook = SetWindowsHookEx(14, proc, GetModuleHandle(null), 0);
                    if (hook == IntPtr.Zero) failure = new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
                    installed.Set();
                    if (hook == IntPtr.Zero) return;
                    MSG message;
                    while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { }
                    UnhookWindowsHookEx(hook);
                }) { IsBackground = true, Name = "Wallpaper mouse hook" };
                hookThread.Start();
                installed.Wait();
                if (failure != null) throw failure;
                workThread = new Thread(Work) { IsBackground = true, Name = "Wallpaper mouse relay" };
                workThread.SetApartmentState(ApartmentState.MTA);
                workThread.Start();
            }

            private IntPtr Hook(int code, IntPtr w, IntPtr l)
            {
                if (code >= 0 && !stopping)
                {
                    int message = w.ToInt32();
                    if (message == 0x0200 || message == 0x0201 || message == 0x0202 || message == 0x020A)
                    {
                        var data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(MSLLHOOKSTRUCT));
                        queue.TryAdd(new Motion { Message = message, Point = data.pt, Wheel = message == 0x020A ? (short)(data.mouseData >> 16) : 0 });
                    }
                }
                return CallNextHookEx(IntPtr.Zero, code, w, l);
            }

            private void Work()
            {
                bool forwardedDown = false;
                foreach (Motion motion in queue.GetConsumingEnumerable())
                {
                    try
                    {
                        if (motion.Message == 0x0202)
                        {
                            if (forwardedDown) Forward(0x0202, motion.Point, 0);
                            forwardedDown = false;
                            continue;
                        }
                        if (motion.Message == 0x0200 && queue.Count > 0) continue;
                        if (motion.Message == 0x0200 && forwardedDown)
                        {
                            Forward(0x0200, motion.Point, 1);
                            continue;
                        }
                        if (!area.Contains(motion.Point.X, motion.Point.Y)) continue;
                        if (!OnDesktop(motion.Point)) continue;
                        if (motion.Message == 0x020A)
                        {
                            wheel(motion.Point.X, motion.Point.Y, motion.Wheel);
                            continue;
                        }
                        if (motion.Message == 0x0201)
                        {
                            forwardedDown = !OverIcon(motion.Point);
                            if (forwardedDown) Forward(0x0201, motion.Point, 0);
                        }
                        else Forward(motion.Message, motion.Point, motion.Wheel);
                    }
                    catch (ElementNotAvailableException) { forwardedDown = false; }
                    catch (Exception error) { Journal.Write("Пересылка мыши в обои", error); }
                }
            }

            private static bool OverIcon(POINT p)
            {
                AutomationElement element = AutomationElement.FromPoint(new System.Windows.Point(p.X, p.Y));
                if (element == null) return false;
                ControlType type = element.Current.ControlType;
                return type == ControlType.ListItem || type == ControlType.Edit;
            }

            private void Forward(int message, POINT screen, int wheel)
            {
                IntPtr widget = target();
                if (widget == IntPtr.Zero) return;
                if (message == 0x020A)
                {
                    PostMessage(widget, 0x020A, new IntPtr(wheel << 16), new IntPtr((screen.Y << 16) | (screen.X & 0xFFFF)));
                    return;
                }
                POINT client = screen;
                ScreenToClient(widget, ref client);
                IntPtr lp = new IntPtr((client.Y << 16) | (client.X & 0xFFFF));
                int buttons = message == 0x0201 || (message == 0x0200 && wheel == 1) ? 1 : 0;
                PostMessage(widget, (uint)message, new IntPtr(buttons), lp);
            }

            public void Dispose()
            {
                stopping = true;
                if (hookThreadId != 0) PostThreadMessage(hookThreadId, 0x0012, IntPtr.Zero, IntPtr.Zero);
                queue.CompleteAdding();
            }
        }
    }
}
