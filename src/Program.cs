using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace CapriDesktop
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr context);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
        private static extern int WindowStyle(IntPtr window, int index);

        [STAThread]
        private static int Main(string[] args)
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            string assets = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets");
            if (args.Length == 2 && args[0] == "--smoke") return Smoke(assets, Path.GetFullPath(args[1]));
            if (args.Length == 2 && args[0] == "--bridgedump")
            {
                string folder = Path.GetFullPath(args[1]);
                Directory.CreateDirectory(folder);
                string settingsFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TaliaSpotifyMiniPlayer");
                var bridge = new SpicetifyBridge(settingsFolder);
                bridge.Start();
                var lines = new List<string>();
                DateTime until = DateTime.UtcNow.AddSeconds(40);
                while (!bridge.Connected && DateTime.UtcNow < until) Thread.Sleep(200);
                Thread.Sleep(1500);
                lines.Add("connected " + bridge.Connected + " version " + bridge.Version);
                if (bridge.Definitions != null) File.WriteAllLines(Path.Combine(folder, "definitions.txt"), bridge.Definitions);
                File.WriteAllText(Path.Combine(folder, "state-pushed.json"), bridge.State ?? "null");
                Func<string, Dictionary<string, object>, string> dump = (op, a) =>
                {
                    try
                    {
                        string body = bridge.CallSync(op, a, 20000);
                        File.WriteAllText(Path.Combine(folder, op + ".json"), body);
                        lines.Add(op + " ok " + body.Length);
                        return body;
                    }
                    catch (Exception error) { lines.Add(op + " FAILED " + error.Message); return null; }
                };
                string rawName = Environment.GetEnvironmentVariable("TALIA_RAW_NAME");
                if (rawName != null)
                {
                    var vars = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Environment.GetEnvironmentVariable("TALIA_RAW_VARS") ?? "{}");
                    string track = null;
                    try
                    {
                        var st = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Dictionary<string, object>>(bridge.State ?? "{}");
                        var it = st.ContainsKey("item") ? st["item"] as Dictionary<string, object> : null;
                        track = it == null ? null : it["uri"] as string;
                    }
                    catch (Exception) { }
                    foreach (var key in new List<string>(vars.Keys)) if (vars[key] as string == "$track") vars[key] = track;
                    lines.Add("track " + track);
                    dump("raw", new Dictionary<string, object> { { "name", rawName }, { "variables", vars } });
                    File.WriteAllLines(Path.Combine(folder, "dump.txt"), lines);
                    bridge.Dispose();
                    return 0;
                }
                if (args.Length == 2 && Environment.GetEnvironmentVariable("TALIA_RAW") != null)
                {
                    dump("raw", new Dictionary<string, object> { { "name", "searchModalResults" }, { "variables", new Dictionary<string, object> { { "searchTerm", "Эмпи" }, { "offset", 0 }, { "limit", 10 }, { "numberOfTopResults", 5 }, { "includeAudiobooks", false }, { "includePreReleases", false }, { "includeLocalConcertsField", false }, { "includeArtistHasConcertsField", false }, { "includeAuthors", false } } } });
                    File.WriteAllLines(Path.Combine(folder, "dump.txt"), lines);
                    bridge.Dispose();
                    return 0;
                }
                if (Environment.GetEnvironmentVariable("TALIA_META") != null)
                {
                    dump("meta", null);
                    File.WriteAllLines(Path.Combine(folder, "dump.txt"), lines);
                    bridge.Dispose();
                    return 0;
                }
                dump("state", null);
                dump("playlists", new Dictionary<string, object> { { "offset", 0 } });
                dump("liked", new Dictionary<string, object> { { "offset", 0 } });
                dump("queue", null);
                dump("mixes", null);
                dump("search", new Dictionary<string, object> { { "q", "Эмпи" } });
                dump("artist", new Dictionary<string, object> { { "id", "7kB4F3PktJEy9jbwI6ujjZ" } });
                dump("album", new Dictionary<string, object> { { "id", "1DSkufM6ThSPBKqbZeUGut" } });
                dump("contains", new Dictionary<string, object> { { "uri", "spotify:track:25KN5IFew2JifHoqx5Q7Z7" } });
                File.WriteAllLines(Path.Combine(folder, "dump.txt"), lines);
                bridge.Dispose();
                return 0;
            }
            if (args.Length == 2 && args[0] == "--bridgetest")
            {
                var bridge = new SpicetifyBridge(Path.GetFullPath(args[1]));
                bridge.Start();
                var lines = new List<string> { "token " + bridge.Token };
                DateTime until = DateTime.UtcNow.AddSeconds(20);
                while (!bridge.Connected && DateTime.UtcNow < until) Thread.Sleep(100);
                lines.Add("connected " + bridge.Connected + " version " + bridge.Version + " defs " + (bridge.Definitions == null ? 0 : bridge.Definitions.Length));
                Thread.Sleep(300);
                lines.Add("state " + bridge.State);
                try { lines.Add("reply " + bridge.CallSync("search", new Dictionary<string, object> { { "q", "тест" } }, 5000)); } catch (Exception error) { lines.Add("call failed " + error.Message); }
                try { lines.Add("reply2 " + bridge.CallSync("unknown", null, 5000)); } catch (Exception error) { lines.Add("call2 failed " + error.Message); }
                File.WriteAllLines(Path.Combine(Path.GetFullPath(args[1]), "bridge.txt"), lines);
                bridge.Dispose();
                return 0;
            }

            bool created;
            using (var once = new Mutex(true, @"Local\TaliaSpotifyMiniPlayer", out created))
            {
                if (!created) return 0;
                try
                {
                    string settings = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "TaliaSpotifyMiniPlayer", "settings.txt");
                    using (var app = new PlayerHost(assets, new PlayerOptions(settings))) Application.Run(app);
                    return 0;
                }
                catch (Exception error)
                {
                    MessageBox.Show(error.Message, "Talia · Spotify", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }
            }
        }

        private static int Smoke(string assets, string output)
        {
            Directory.CreateDirectory(output);
            try
            {
                var results = new List<string>();
                using (var player = new MiniPlayer())
                using (var dancer = new Dancer(assets))
                {
                    player.Motion = false;
                    Tune song = new Tune { App = "Spotify.exe", Title = "Night Transit", Artist = "Talia Player · визуальная проверка",
                        Playing = true, CanSeek = true, Length = 200, Position = 66, ReadAt = Tunes.Now };
                    var commands = new List<string>();
                    player.Command += commands.Add;
                    player.ShowTune(PlayerHost.Waiting(), null);
                    Require(player.Visible && !player.Plate.IsEmpty, "Player hidden before Spotify starts");
                    Require((WindowStyle(player.Handle, -20) & 8) != 0, "Player is not topmost");
                    Save(player.Image, Path.Combine(output, "waiting.png"));
                    player.SetArtwork(ExampleCover());
                    player.ShowTune(song, null);
                    Save(player.Image, Path.Combine(output, "playing.png"));
                    Skin.Capri = true;
                    player.Restyle();
                    Save(player.Image, Path.Combine(output, "playing-capri.png"));
                    Skin.Capri = false;
                    player.Restyle();
                    player.Press(PlayerPart.Previous);
                    player.Press(PlayerPart.PlayPause);
                    Require(!song.Playing && player.Visible, "Pause hid the player or failed");
                    player.Press(PlayerPart.PlayPause);
                    player.Press(PlayerPart.Next);
                    player.SeekTo(.25);
                    player.Press(PlayerPart.Heart);
                    Require(string.Join(",", commands) == "previous,pause,play,next,seek:50,like", "Unexpected native player commands");
                    Require(MiniPlayer.PartAt(new PointF(MiniPlayer.Wide / 2, 88), 1, true) == PlayerPart.PlayPause,
                        "Play icon and hit area disagree");
                    results.Add("PASS original MiniPlayer appears paused and routes playback controls");

                    Rectangle before = player.Plate;
                    var area = Screen.FromRectangle(before).WorkingArea;
                    int newX = before.Left + (before.Left + before.Width + 40 < area.Right ? 40 : -40);
                    player.MoveTo(new Point(newX - 12, before.Top - 12));
                    Require(player.Plate.Left != before.Left, "Moving the original player had no effect");
                    results.Add("PASS player stays topmost and moves; attached displays: " + Screen.AllScreens.Length);

                    dancer.Update(player.Plate, true, "talia", null, true);
                    var originalScreen = Screen.FromRectangle(player.Plate);
                    Require(!dancer.SurfaceBounds.IsEmpty && originalScreen.WorkingArea.Contains(dancer.SurfaceBounds), "Animation outside player screen");
                    Require((WindowStyle(dancer.SurfaceHandle, -20) & 0x08080028) == 0x08080028, "Animation window lost click-through, topmost, alpha or no-activate style");
                    foreach (var screen in Screen.AllScreens)
                    {
                        if (screen.DeviceName == originalScreen.DeviceName) continue;
                        Point grab = new Point(player.Left + 60, player.Top + 30);
                        Point destination = new Point(screen.WorkingArea.Left + 24, screen.WorkingArea.Top + 140);
                        player.Grab(grab);
                        player.Haul(new Point(grab.X + destination.X - player.Left, grab.Y + destination.Y - player.Top));
                        player.LetGo();
                        Require(Screen.FromRectangle(player.Plate).DeviceName == screen.DeviceName, "Player could not cross to the other display");
                        dancer.Update(player.Plate, true, "talia", null, true);
                        Require(!dancer.SurfaceBounds.IsEmpty && screen.WorkingArea.Contains(dancer.SurfaceBounds), "Animation did not follow to the other display");
                        results.Add("PASS player and click-through animation switched to second display");
                        break;
                    }

                    foreach (string character in new[] { "talia", "capri" })
                    {
                        var dances = new List<string>();
                        foreach (string folder in Directory.GetDirectories(Path.Combine(assets, "characters", character)))
                            if (File.Exists(Path.Combine(folder, "frames.tsv"))) dances.Add(Path.GetFileName(folder));
                        foreach (string dance in dances)
                        {
                            Require(dancer.HasAssets(character, dance), "Cannot load " + character + "/" + dance);
                            for (int tick = 0; tick < 6; tick++)
                            {
                                dancer.Update(player.Plate, true, character, dance, true);
                                Thread.Sleep(40);
                            }
                            Require(!dancer.SurfaceBounds.IsEmpty, "No frame shown for " + character + "/" + dance);
                            results.Add("PASS " + character + "/" + dance + " " + dancer.SurfaceBounds.Size);
                        }
                        dancer.Update(player.Plate, false, character, null, true);
                    }
                    var journey = new List<string>();
                    Rectangle work = Screen.FromRectangle(player.Plate).WorkingArea;
                    for (int tick = 0; tick < 230; tick++)
                    {
                        bool music = tick >= 20 && tick < 150;
                        dancer.Update(player.Plate, music, "capri", null, true);
                        if (tick == 10 || tick == 30 || tick == 60 || tick == 140 || tick == 175 || tick == 229)
                        {
                            Rectangle at = dancer.SurfaceBounds;
                            journey.Add(tick + ":" + dancer.State + "@" + at.X);
                            SavePreview(player, dancer, Path.Combine(output, "capri-" + tick + ".png"));
                        }
                        Thread.Sleep(32);
                        Application.DoEvents();
                    }
                    results.Add("PASS capri journey " + string.Join(" ", journey));
                    Require(journey[0].Contains(":Sit@") && (journey[2].Contains(":Dance@") || journey[2].Contains(":Walk@")) && journey[5].Contains(":Sit@"),"Capri did not leave the perch for the floor and come back: " + string.Join(" ", journey) + " work " + work);
                    dancer.Update(player.Plate, false, "talia", null, false);
                    Require(dancer.SurfaceBounds.IsEmpty, "Hidden character still has a visible window");
                    song.Playing = false;
                    player.ShowTune(song, null);
                    var plate = player.Plate;
                    player.Sitting((int)(plate.Left + plate.Width * .72), (int)(plate.Width * .42), false);
                    dancer.Update(plate, false, "talia", null, true);
                    Require(dancer.SurfaceBounds.Top < plate.Top, "Talia did not perch above the plate");
                    SavePreview(player, dancer, Path.Combine(output, "perched.png"));
                    results.Add("PASS both characters, all dance clips, pause and hide");
                }
                using (var paper = new Wallpaper(Path.Combine(assets, "wallpaper"), output, () => "capri", Screen.PrimaryScreen))
                {
                    paper.Show();
                    DateTime until = DateTime.UtcNow.AddSeconds(20);
                    while (!paper.Loaded && DateTime.UtcNow < until) { Application.DoEvents(); Thread.Sleep(30); }
                    Require(paper.Loaded, "Wallpaper page did not load");
                    for (int i = 0; i < 40; i++) { Application.DoEvents(); Thread.Sleep(30); }
                    Task<string> probe = paper.Evaluate("document.title + '|' + !document.getElementById('setup').hidden + '|' + document.body.dataset.character");
                    until = DateTime.UtcNow.AddSeconds(10);
                    while (!probe.IsCompleted && DateTime.UtcNow < until) { Application.DoEvents(); Thread.Sleep(30); }
                    Require(probe.IsCompleted && probe.Result == "\"Talia · Spotify|true|capri\"", "Wallpaper page state: " + (probe.IsCompleted ? probe.Result : "timeout"));
                    Require(paper.ParentClass == "Progman" || paper.ParentClass == "WorkerW", "Wallpaper is not behind the desktop icons: " + paper.ParentClass);
                    results.Add("PASS wallpaper behind icons in " + paper.ParentClass + ", page asks to connect Spotify");
                    paper.Close();
                }
                using (var host = new PlayerHost(assets, new PlayerOptions(Path.Combine(output, "settings.txt"))))
                {
                    Require(host.MainForm.Visible, "App host did not start the mini player");
                    Application.DoEvents();
                    host.MainForm.Close();
                }
                results.Add("PASS native host starts and closes with its menu and companion");
                Task<Tune> reading = Task.Factory.StartNew(Tunes.Spotify);
                Require(reading.Wait(12000), "Windows Spotify session read timed out");
                results.Add(reading.Result == null ? "PASS system media read; no active Spotify session" : "PASS found Spotify session through original backend");
                File.WriteAllLines(Path.Combine(output, "smoke.txt"), results);
                return 0;
            }
            catch (Exception error)
            {
                File.WriteAllText(Path.Combine(output, "smoke.txt"), error.ToString());
                return 1;
            }
        }

        private static void Save(Bitmap bitmap, string path)
        {
            using (var copy = new Bitmap(bitmap)) copy.Save(path, ImageFormat.Png);
        }

        private static void SavePreview(MiniPlayer player, Dancer dancer, string path)
        {
            Rectangle bounds = Rectangle.Union(player.Bounds, dancer.SurfaceBounds);
            const int pad = 20;
            using (var canvas = new Bitmap(bounds.Width + pad * 2, bounds.Height + pad * 2))
            using (var g = Graphics.FromImage(canvas))
            using (var backdrop = new LinearGradientBrush(new Rectangle(Point.Empty, canvas.Size), Color.FromArgb(39, 34, 60),
                Color.FromArgb(18, 22, 34), LinearGradientMode.ForwardDiagonal))
            {
                g.FillRectangle(backdrop, 0, 0, canvas.Width, canvas.Height);
                g.DrawImageUnscaled(player.Image, player.Left - bounds.Left + pad, player.Top - bounds.Top + pad);
                g.DrawImageUnscaled(dancer.SurfaceImage, dancer.SurfaceBounds.Left - bounds.Left + pad, dancer.SurfaceBounds.Top - bounds.Top + pad);
                canvas.Save(path, ImageFormat.Png);
            }
        }

        private static Bitmap ExampleCover()
        {
            var art = new Bitmap(160, 160);
            using (var g = Graphics.FromImage(art))
            using (var ink = new LinearGradientBrush(new Rectangle(0, 0, 160, 160), Color.FromArgb(62, 37, 111),
                Color.FromArgb(239, 98, 149), 38f))
            {
                g.FillRectangle(ink, 0, 0, 160, 160);
                g.FillPolygon(Brushes.Indigo, new[] { new Point(12, 137), new Point(95, 20), new Point(139, 113) });
                g.FillEllipse(Brushes.MistyRose, 92, 39, 32, 32);
            }
            return art;
        }

        private static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
