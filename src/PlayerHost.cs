using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Windows.Storage.Streams;

namespace CapriDesktop
{
    internal sealed class PlayerHost : ApplicationContext
    {
        internal static readonly string[] DanceIds = Dancer.Dances;
        private readonly MiniPlayer player = new MiniPlayer();
        private readonly Dancer dancer;
        private readonly PlayerOptions settings;
        private readonly ContextMenuStrip menu = new ContextMenuStrip();
        private readonly ToolStripMenuItem talia, capri, hide, wallpaperItem, problemItem;
        private readonly SpicetifyBridge bridge;
        private ToolStripMenuItem bridgeItem, fullItem, halfItem, rate60Item, rate30Item;
        private readonly string assetsFolder;
        private readonly Func<bool?> appHearted = Tunes.Hearted;
        private readonly List<Wallpaper> wallpapers = new List<Wallpaper>();
        private readonly System.Windows.Forms.Timer media = new System.Windows.Forms.Timer { Interval = 700 };
        private readonly System.Windows.Forms.Timer motion = new System.Windows.Forms.Timer { Interval = 32 };
        private readonly Queue<PendingPress> presses = new Queue<PendingPress>();
        private bool reading, sending, heartBusy, stopped;
        private string artKey;
        private double retryArtAt, heartAt, mediaPressedAt;

        internal PlayerHost(string assets, PlayerOptions options)
        {
            settings = options;
            assetsFolder = assets;
            Journal.Open(settings.Folder);
            Skin.Capri = settings.Character == "capri";
            dancer = new Dancer(assets);
            bridge = new SpicetifyBridge(settings.Folder);
            try { bridge.Start(); } catch (Exception error) { Journal.Write("Мост Spicetify", error); }
            Wallpaper.Bridge = bridge;
            Tunes.Hearted = Hearted;
            Wallpaper.AppHearted = appHearted;
            MainForm = player;
            player.Text = "Spotify on Wallpaper";
            player.AccessibleName = "Мини-плеер Spotify";
            player.Motion = false;
            player.Command += Press;
            player.Moved += Moved;
            player.LocationChanged += delegate { FollowPlayer(); };

            menu.ShowImageMargin = false;
            menu.ShowCheckMargin = true;
            menu.Renderer = new ToolStripProfessionalRenderer(new MenuColors()) { RoundedEdges = false };
            menu.ForeColor = TaliaSkin.Ink;
            menu.Items.Add("Открыть Spotify", null, delegate { QueueOpen(); });
            menu.Items.Add(new ToolStripSeparator());
            var characters = new ToolStripMenuItem("Персонаж");
            talia = (ToolStripMenuItem)characters.DropDownItems.Add("Талия Янг", null, delegate { Choose("talia"); });
            capri = (ToolStripMenuItem)characters.DropDownItems.Add("Capri", null, delegate { Choose("capri"); });
            characters.DropDownItems.Add(new ToolStripSeparator());
            hide = (ToolStripMenuItem)characters.DropDownItems.Add("Скрыть персонажа", null, delegate { Choose("none"); });
            menu.Items.Add(characters);
            var spice = new ToolStripMenuItem("Spicetify");
            bridgeItem = (ToolStripMenuItem)spice.DropDownItems.Add("", null, delegate { });
            bridgeItem.Enabled = false;
            spice.DropDownItems.Add(new ToolStripSeparator());
            spice.DropDownItems.Add("Установить расширение в Spotify", null, delegate { RunSpicetify(true); });
            spice.DropDownItems.Add("Переприменить после обновления Spotify", null, delegate { RunSpicetify(false); });
            spice.DropDownItems.Add(new ToolStripSeparator());
            problemItem = (ToolStripMenuItem)spice.DropDownItems.Add("", null, delegate { OpenJournal(); });
            menu.Items.Add(spice);
            wallpaperItem = (ToolStripMenuItem)menu.Items.Add("Обои рабочего стола", null, delegate { ToggleWallpaper(); });
            var resolution = new ToolStripMenuItem("Разрешение фона");
            fullItem = (ToolStripMenuItem)resolution.DropDownItems.Add("100 %", null, delegate { ChooseResolution(true); });
            halfItem = (ToolStripMenuItem)resolution.DropDownItems.Add("50 %", null, delegate { ChooseResolution(false); });
            menu.Items.Add(resolution);
            var rate = new ToolStripMenuItem("Частота кадров");
            rate60Item = (ToolStripMenuItem)rate.DropDownItems.Add("60", null, delegate { ChooseRate(false); });
            rate30Item = (ToolStripMenuItem)rate.DropDownItems.Add("30", null, delegate { ChooseRate(true); });
            menu.Items.Add(rate);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Закрыть плеер", null, delegate { player.Close(); });
            ThemeMenu(menu.Items);
            if (settings.Wallpaper) player.Shown += delegate { ShowWallpaper(); };
            Microsoft.Win32.SystemEvents.DisplaySettingsChanged += ScreensChanged;

            player.ShowTune(Waiting(), settings.Spot);
            media.Tick += delegate { ReadSpotify(); };
            motion.Tick += delegate { FollowPlayer(); };
            media.Start();
            motion.Start();
            ReadSpotify();
        }

        internal static Tune Waiting()
        {
            return new Tune { Title = "Spotify", Artist = "Открой Spotify и включи музыку", CanBack = false,
                CanSkip = false, CanSeek = false, CanPause = false, ReadAt = Tunes.Now };
        }

        private void Moved(Point spot)
        {
            settings.Spot = spot;
            settings.Save();
            FollowPlayer();
        }

        private void Choose(string character)
        {
            settings.Character = character;
            settings.Save();
            Skin.Capri = character == "capri";
            player.Restyle();
            foreach (Wallpaper paper in wallpapers) if (!paper.IsDisposed) paper.CharacterChanged();
            FollowPlayer();
        }

        private void RunSpicetify(bool install)
        {
            string assets = assetsFolder;
            string token = bridge.Token;
            ThreadPool.QueueUserWorkItem(delegate
            {
                string text;
                bool ok = true;
                try { text = install ? SpicetifyInstaller.Install(assets, token) : SpicetifyInstaller.Reapply(); }
                catch (Exception error)
                {
                    ok = false;
                    text = error.Message;
                    Journal.Write("Spicetify", error);
                }
                if (text.Length > 1800) text = text.Substring(0, 900) + "\n…\n" + text.Substring(text.Length - 800);
                Post(delegate
                {
                    MessageBox.Show(ok ? "Готово. Spotify перезапустится с расширением, плеер подключится к нему сам.\n\n" + text : text,
                        "Talia · Spicetify", MessageBoxButtons.OK, ok ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
                });
            });
        }

        private bool? AppLiked()
        {
            string state = bridge.State;
            if (state == null) return null;
            var data = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Dictionary<string, object>>(state);
            object liked;
            return data != null && data.TryGetValue("liked", out liked) && liked is bool ? (bool?)(bool)liked : null;
        }

        private bool LikeThroughApp(Tune pressed, bool like)
        {
            var data = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Dictionary<string, object>>(bridge.State ?? bridge.CallSync("state", null));
            var item = data == null ? null : data["item"] as Dictionary<string, object>;
            string uri = item == null ? null : item["uri"] as string, title = item == null ? null : item["name"] as string;
            if (uri == null) throw new InvalidOperationException("Spotify не видит трек, который сейчас играет.");
            if (!string.Equals((title ?? "").Trim(), (pressed.Title ?? "").Trim(), StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Трек сменился: в плеере «" + pressed.Title + "», в Spotify «" + title + "».");
            bridge.CallSync(like ? "like" : "unlike", new Dictionary<string, object> { { "uri", uri } });
            return true;
        }

        private bool? Hearted()
        {
            return bridge.Connected ? AppLiked() : appHearted();
        }

        private void OpenJournal()
        {
            string file = Path.Combine(settings.Folder, "SpotifyOnWallpaper.log");
            if (File.Exists(file)) System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(file) { UseShellExecute = true });
        }

        private void ToggleWallpaper()
        {
            if (wallpapers.Count > 0)
            {
                CloseWallpapers();
                settings.Wallpaper = false;
            }
            else
            {
                settings.Wallpaper = true;
                ShowWallpaper();
            }
            settings.Save();
        }

        private void ShowWallpaper()
        {
            if (wallpapers.Count > 0) return;
            foreach (Screen screen in Screen.AllScreens)
            {
                var paper = new Wallpaper(Path.Combine(assetsFolder, "wallpaper"), settings.Folder, () => settings.Character, screen, settings.FullResolution ? 1f : 0.5f, settings.HalfRate ? 30 : 60);
                paper.Lost += delegate { player.BeginInvoke(new Action(() => Recover(paper))); };
                wallpapers.Add(paper);
                paper.Show();
            }
        }

        private void ChooseResolution(bool full)
        {
            if (settings.FullResolution == full) return;
            settings.FullResolution = full;
            settings.Save();
            if (wallpapers.Count == 0) return;
            CloseWallpapers();
            ShowWallpaper();
        }

        private void ChooseRate(bool half)
        {
            if (settings.HalfRate == half) return;
            settings.HalfRate = half;
            settings.Save();
            if (wallpapers.Count == 0) return;
            CloseWallpapers();
            ShowWallpaper();
        }

        private void CloseWallpapers()
        {
            var open = new List<Wallpaper>(wallpapers);
            wallpapers.Clear();
            foreach (Wallpaper paper in open) if (!paper.IsDisposed) paper.Close();
        }

        private void ScreensChanged(object sender, EventArgs e)
        {
            if (stopped || !settings.Wallpaper || wallpapers.Count == 0) return;
            player.BeginInvoke(new Action(() =>
            {
                CloseWallpapers();
                if (!stopped && settings.Wallpaper) ShowWallpaper();
            }));
        }

        private void Recover(Wallpaper dead)
        {
            dead.Dispose();
            if (!wallpapers.Contains(dead) || stopped) return;
            CloseWallpapers();
            var wait = new System.Windows.Forms.Timer { Interval = 2000 };
            int tries = 0;
            wait.Tick += delegate
            {
                tries++;
                if (stopped || !settings.Wallpaper) { wait.Dispose(); return; }
                if (!Desktop.Ready() && tries < 60) return;
                wait.Dispose();
                ShowWallpaper();
            };
            wait.Start();
        }

        private void ShowMenu()
        {
            talia.Checked = settings.Character == "talia";
            capri.Checked = settings.Character == "capri";
            hide.Checked = settings.Character == "none";
            wallpaperItem.Checked = wallpapers.Count > 0;
            fullItem.Checked = settings.FullResolution;
            halfItem.Checked = !settings.FullResolution;
            rate60Item.Checked = !settings.HalfRate;
            rate30Item.Checked = settings.HalfRate;
            problemItem.Text = Journal.Last == null ? "" : "Последняя ошибка: " + Journal.Last;
            problemItem.Visible = problemItem.Text.Length > 0;
            bridgeItem.Text = bridge.Connected ? "Подключено к Spotify" + (string.IsNullOrEmpty(bridge.Version) ? "" : " (Spicetify " + bridge.Version + ")")
                : SpicetifyInstaller.FindCli() == null ? "Spicetify не установлен" : "Spotify с расширением не подключён";
            menu.Show(Cursor.Position);
        }

        private void ThemeMenu(ToolStripItemCollection items)
        {
            foreach (ToolStripItem item in items)
            {
                item.ForeColor = TaliaSkin.Ink;
                var child = item as ToolStripMenuItem;
                if (child == null || !child.HasDropDownItems) continue;
                child.DropDown.Renderer = menu.Renderer;
                ThemeMenu(child.DropDownItems);
            }
        }

        private void FollowPlayer()
        {
            if (stopped) return;
            Tune tune = player.Tune;
            Rectangle plate = player.Plate;
            bool playing = tune != null && tune.Spotify && tune.Playing;
            bool enabled = player.Visible && settings.Character != "none";
            dancer.Offstage = true;
            dancer.Update(plate, playing, settings.Character, null, enabled);
            int? hip = dancer.SeatHipX;
            bool onPlate = hip.HasValue && dancer.SurfaceBounds.Bottom > plate.Top && dancer.SurfaceBounds.Top < plate.Top;
            player.Sitting(onPlate ? hip : null, dancer.SeatWidth, false);
        }

        private void ReadSpotify()
        {
            if (reading || sending || stopped) return;
            reading = true;
            double start = Tunes.Now;
            string knownArt = artKey;
            bool tryArt = start >= retryArtAt;
            ThreadPool.QueueUserWorkItem(delegate
            {
                Tune tune = null;
                Bitmap cover = null;
                try
                {
                    tune = Tunes.Spotify();
                    if (tune != null && tune.Title.Length == 0 && tune.Artist.Length == 0) tune = null;
                    if (tune != null && (tune.Key != knownArt || tryArt)) cover = ReadCover(tune);
                }
                catch (Exception error) { Journal.Write("Чтение медиасессии", error); }
                if (!Post(delegate { ApplyTune(tune, cover, start); }) && cover != null) cover.Dispose();
            });
        }

        private void ApplyTune(Tune tune, Bitmap cover, double started)
        {
            reading = false;
            if (stopped || started < mediaPressedAt)
            {
                if (cover != null) cover.Dispose();
                return;
            }
            string key = tune == null ? null : tune.Key;
            bool changed = key != artKey;
            if (changed || cover != null)
            {
                player.SetArtwork(cover);
                artKey = key;
                retryArtAt = cover != null ? double.PositiveInfinity : Tunes.Now + 3;
            }
            else if (key != null && started >= retryArtAt) retryArtAt = Tunes.Now + 3;
            player.ShowTune(tune ?? Waiting(), settings.Spot);
            FollowPlayer();
            if (tune != null) ReadHeart(key);
        }

        private void ReadHeart(string key)
        {
            double start = Tunes.Now;
            if (heartBusy || start < heartAt) return;
            heartBusy = true;
            heartAt = start + 8;
            ThreadPool.QueueUserWorkItem(delegate
            {
                bool? liked = null;
                try { liked = Tunes.Hearted(); } catch (Exception error) { Journal.Write("Проверка лайка", error); }
                Post(delegate
                {
                    heartBusy = false;
                    if (liked.HasValue) player.Hearted(key, liked.Value, start);
                });
            });
        }

        private static Bitmap ReadCover(Tune tune)
        {
            IRandomAccessStreamReference thumbnail = tune.Thumbnail;
            if (thumbnail == null) return null;
            try
            {
                var opening = thumbnail.OpenReadAsync().AsTask();
                if (!opening.Wait(1600)) return null;
                using (var random = opening.Result)
                {
                    if (random.Size == 0 || random.Size > 10 * 1024 * 1024) return null;
                    using (Stream input = random.GetInputStreamAt(0).AsStreamForRead())
                    using (var buffer = new MemoryStream())
                    {
                        input.CopyTo(buffer);
                        buffer.Position = 0;
                        using (Image image = Image.FromStream(buffer)) return new Bitmap(image, 160, 160);
                    }
                }
            }
            catch (Exception error)
            {
                Journal.Write("Обложка", error);
                return null;
            }
        }

        private void Press(string command)
        {
            if (command == "menu") { ShowMenu(); return; }
            if (command == "close") { player.Close(); return; }
            Tune tune = player.Tune;
            if (tune == null || !tune.Spotify || tune.Session == null)
            {
                if (command == "play" || command == "pause") { player.ShowTune(Waiting(), settings.Spot); QueueOpen(); }
                return;
            }
            mediaPressedAt = Tunes.Now;
            presses.Enqueue(new PendingPress(tune, command));
            SendNext();
        }

        private void QueueOpen()
        {
            Tune tune = player.Tune;
            presses.Enqueue(new PendingPress(tune != null && tune.Spotify ? tune : new Tune { App = "Spotify.exe" }, "open"));
            SendNext();
        }

        private void SendNext()
        {
            if (sending || presses.Count == 0 || stopped) return;
            sending = true;
            PendingPress press = presses.Dequeue();
            ThreadPool.QueueUserWorkItem(delegate
            {
                bool sent = false;
                try
                {
                    bool like = press.Command == "like" || press.Command == "unlike";
                    if (press.Command == "open") sent = Tunes.Open(press.Tune);
                    else if (like && bridge.Connected) sent = LikeThroughApp(press.Tune, press.Command == "like");
                    else sent = Tunes.Send(press.Tune, press.Command);
                }
                catch (Exception error) { Journal.Write("Команда «" + press.Command + "»", error); }
                Post(delegate
                {
                    if (stopped) return;
                    sending = false;
                    player.Sent(press.Command, sent);
                    SendNext();
                    if (!sending) ReadSpotify();
                });
            });
        }

        private bool Post(Action action)
        {
            try
            {
                if (player.IsDisposed || !player.IsHandleCreated) return false;
                player.BeginInvoke(action);
                return true;
            }
            catch (InvalidOperationException) { return false; }
        }

        protected override void ExitThreadCore()
        {
            if (!stopped)
            {
                stopped = true;
                media.Dispose();
                motion.Dispose();
                menu.Dispose();
                Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= ScreensChanged;
                foreach (Wallpaper paper in wallpapers) paper.Dispose();
                wallpapers.Clear();
                bridge.Dispose();
                dancer.Dispose();
                player.Dispose();
            }
            base.ExitThreadCore();
        }

        private sealed class PendingPress
        {
            internal readonly Tune Tune;
            internal readonly string Command;
            internal PendingPress(Tune tune, string command) { Tune = tune; Command = command; }
        }

        private sealed class MenuColors : ProfessionalColorTable
        {
            private static readonly Color Surface = Color.FromArgb(27, 28, 43);
            private static readonly Color Focus = Color.FromArgb(63, 48, 73);
            private static readonly Color Divider = Color.FromArgb(67, 62, 85);
            public override Color ToolStripDropDownBackground { get { return Surface; } }
            public override Color ImageMarginGradientBegin { get { return Surface; } }
            public override Color ImageMarginGradientMiddle { get { return Surface; } }
            public override Color ImageMarginGradientEnd { get { return Surface; } }
            public override Color MenuItemSelected { get { return Focus; } }
            public override Color MenuItemBorder { get { return Focus; } }
            public override Color MenuBorder { get { return Divider; } }
            public override Color SeparatorDark { get { return Divider; } }
            public override Color SeparatorLight { get { return Divider; } }
            public override Color CheckBackground { get { return TaliaSkin.Pink; } }
            public override Color CheckSelectedBackground { get { return TaliaSkin.Pink; } }
        }
    }

    internal sealed class PlayerOptions
    {
        private readonly string file;
        internal string Character = "talia";
        internal string Dance = "01-jump";
        internal Point? Spot;
        internal bool Wallpaper;
        internal bool FullResolution;
        internal bool HalfRate;
        private string RateFile { get { return Path.Combine(Folder, "wallpaper-fps.txt"); } }
        internal string Folder { get { return Path.GetDirectoryName(file); } }
        private string WallpaperFile { get { return Path.Combine(Folder, "wallpaper.txt"); } }
        private string ResolutionFile { get { return Path.Combine(Folder, "wallpaper-resolution.txt"); } }

        internal PlayerOptions(string file)
        {
            this.file = file;
            try
            {
                Wallpaper = File.Exists(WallpaperFile) && File.ReadAllText(WallpaperFile).Trim() == "on";
                FullResolution = File.Exists(ResolutionFile) && File.ReadAllText(ResolutionFile).Trim() == "100";
                HalfRate = File.Exists(RateFile) && File.ReadAllText(RateFile).Trim() == "30";
                if (!File.Exists(file)) return;
                string[] lines = File.ReadAllLines(file);
                if (lines.Length >= 1 && (lines[0] == "talia" || lines[0] == "capri" || lines[0] == "none")) Character = lines[0];
                if (lines.Length >= 2 && Array.IndexOf(PlayerHost.DanceIds, lines[1]) >= 0) Dance = lines[1];
                int x, y;
                if (lines.Length >= 4 && int.TryParse(lines[2], out x) && int.TryParse(lines[3], out y)) Spot = new Point(x, y);
            }
            catch (IOException error) { Journal.Write("Настройки", error); }
            catch (UnauthorizedAccessException error) { Journal.Write("Настройки", error); }
        }

        internal void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                File.WriteAllText(WallpaperFile, Wallpaper ? "on" : "off");
                File.WriteAllText(ResolutionFile, FullResolution ? "100" : "50");
                File.WriteAllText(RateFile, HalfRate ? "30" : "60");
                string[] lines = Spot.HasValue ? new[] { Character, Dance, Spot.Value.X.ToString(), Spot.Value.Y.ToString() }
                    : new[] { Character, Dance };
                string temp = file + ".tmp";
                File.WriteAllLines(temp, lines);
                if (File.Exists(file)) File.Replace(temp, file, null);
                else File.Move(temp, file);
            }
            catch (IOException error) { Journal.Write("Настройки", error); }
            catch (UnauthorizedAccessException error) { Journal.Write("Настройки", error); }
        }
    }
}
