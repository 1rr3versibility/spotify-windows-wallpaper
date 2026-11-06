using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CapriDesktop
{
    internal static class Setup
    {
        internal const string Product = "Spotify on Wallpaper";
        internal const string Version = "1.0.0";
        internal const string AppKey = "SpotifyOnWallpaper";
        internal const string ExeName = "SpotifyOnWallpaper.exe";
        internal const string SetupName = "SpotifyOnWallpaperSetup.exe";
        internal static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SpotifyOnWallpaper");
        internal static readonly string SettingsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TaliaSpotifyMiniPlayer");
        internal static readonly string StartMenuLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Product + ".lnk");
        internal static readonly string DesktopLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Product + ".lnk");

        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (args.Length == 2 && args[0] == "/extract")
            {
                ExtractApp(Path.GetFullPath(args[1]), null);
                return 0;
            }
            bool uninstall = args.Length > 0 && args[0].Equals("/uninstall", StringComparison.OrdinalIgnoreCase);
            Application.Run(new SetupForm(uninstall));
            return 0;
        }

        internal static void ExtractApp(string target, Action<string> say)
        {
            using (Stream payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("Talia.App.zip"))
            {
                if (payload == null) throw new InvalidOperationException("В установщике нет файлов плеера.");
                using (var zip = new ZipArchive(payload, ZipArchiveMode.Read))
                {
                    int done = 0;
                    foreach (ZipArchiveEntry entry in zip.Entries)
                    {
                        string path = Path.GetFullPath(Path.Combine(target, entry.FullName));
                        if (!path.StartsWith(Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Недопустимый путь в архиве: " + entry.FullName);
                        if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(path); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(path));
                        entry.ExtractToFile(path, true);
                        if (say != null && ++done % 500 == 0) say("  распаковано файлов: " + done);
                    }
                    if (say != null) say("  распаковано файлов: " + zip.Entries.Count);
                }
            }
        }

        internal static void ExtractSpicetify(string target)
        {
            using (Stream payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("Talia.Spicetify.zip"))
            {
                if (payload == null) throw new InvalidOperationException("В установщике нет Spicetify.");
                Directory.CreateDirectory(target);
                using (var zip = new ZipArchive(payload, ZipArchiveMode.Read))
                    foreach (ZipArchiveEntry entry in zip.Entries)
                    {
                        string path = Path.GetFullPath(Path.Combine(target, entry.FullName));
                        if (!path.StartsWith(Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Недопустимый путь в архиве: " + entry.FullName);
                        if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(path); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(path));
                        entry.ExtractToFile(path, true);
                    }
            }
        }

        internal static void AddToUserPath(string folder)
        {
            using (RegistryKey env = Registry.CurrentUser.OpenSubKey("Environment", true))
            {
                string current = env.GetValue("Path", "", RegistryValueOptions.DoNotExpandEnvironmentNames) as string ?? "";
                foreach (string part in current.Split(';')) if (part.Trim().TrimEnd('\\').Equals(folder.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) return;
                env.SetValue("Path", current.Length == 0 ? folder : current.TrimEnd(';') + ";" + folder, RegistryValueKind.ExpandString);
            }
            IntPtr result;
            SendMessageTimeout(new IntPtr(0xFFFF), 0x001A, IntPtr.Zero, "Environment", 0x0002, 3000, out result);
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, string lParam, uint flags, uint timeout, out IntPtr result);

        internal static string EnsureToken()
        {
            Directory.CreateDirectory(SettingsDir);
            string file = Path.Combine(SettingsDir, "spicetify-token.txt");
            if (File.Exists(file))
            {
                string existing = File.ReadAllText(file).Trim();
                if (existing.Length == 32) return existing;
            }
            var bytes = new byte[16];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            string token = BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
            File.WriteAllText(file, token);
            return token;
        }

        internal static void Shortcut(string link, string target, string description)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { link });
            Type kind = shortcut.GetType();
            kind.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { target });
            kind.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(target) });
            kind.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { description });
            kind.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { target + ",0" });
            kind.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            Marshal.FinalReleaseComObject(shortcut);
            Marshal.FinalReleaseComObject(shell);
        }

        internal static void StopPlayer()
        {
            foreach (string name in new[] { "SpotifyOnWallpaper", "TaliaPlayer" })
                foreach (Process process in Process.GetProcessesByName(name))
                {
                    try { process.Kill(); process.WaitForExit(5000); }
                    catch (Exception) { }
                }
        }

        internal static void Register(string exe, string setup, long sizeKb)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + AppKey))
            {
                key.SetValue("DisplayName", Product);
                key.SetValue("DisplayVersion", Version);
                key.SetValue("Publisher", Product);
                key.SetValue("DisplayIcon", exe + ",0");
                key.SetValue("InstallLocation", InstallDir);
                key.SetValue("UninstallString", "\"" + setup + "\" /uninstall");
                key.SetValue("EstimatedSize", (int)Math.Min(int.MaxValue, sizeKb), RegistryValueKind.DWord);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }

        internal static void Autostart(string exe, bool on)
        {
            using (RegistryKey run = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
            {
                if (on) run.SetValue(AppKey, "\"" + exe + "\"");
                else if (run.GetValue(AppKey) != null) run.DeleteValue(AppKey);
            }
        }

        internal static void RemoveLegacy(Action<string> say)
        {
            const string oldProduct = "Talia Spotify Player", oldKey = "TaliaSpotifyPlayer";
            string oldDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "TaliaPlayer");
            string[] oldLinks =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), oldProduct + ".lnk"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), oldProduct + ".lnk")
            };
            bool found = Directory.Exists(oldDir);
            foreach (string link in oldLinks) if (File.Exists(link)) { File.Delete(link); found = true; }
            using (RegistryKey run = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                if (run.GetValue(oldKey) != null) { run.DeleteValue(oldKey); found = true; }
            using (RegistryKey old = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + oldKey))
                if (old != null) found = true;
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + oldKey, false);
            if (!found) return;
            say("Убираю прежнюю версию Talia Spotify Player…");
            if (Directory.Exists(oldDir))
            {
                try { Directory.Delete(oldDir, true); }
                catch (IOException error) { say("  папку " + oldDir + " удалить не вышло: " + error.Message); }
                catch (UnauthorizedAccessException error) { say("  папку " + oldDir + " удалить не вышло: " + error.Message); }
            }
        }

        internal static long FolderSizeKb(string folder)
        {
            long total = 0;
            foreach (string file in Directory.GetFiles(folder, "*", SearchOption.AllDirectories)) total += new FileInfo(file).Length;
            return total / 1024;
        }
    }

    internal sealed class SetupForm : Form
    {
        private readonly bool uninstall;
        private readonly CheckBox spicetify = new CheckBox(), desktop = new CheckBox(), autostart = new CheckBox(), wallpaper = new CheckBox(), restore = new CheckBox(), settings = new CheckBox();
        private readonly Button go = new Button(), close = new Button();
        private readonly TextBox log = new TextBox();
        private readonly ProgressBar progress = new ProgressBar();
        private bool busy, finished, cleanupPending;

        internal SetupForm(bool uninstall)
        {
            this.uninstall = uninstall;
            Text = uninstall ? "Удаление " + Setup.Product : "Установка " + Setup.Product;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(620, 470);
            BackColor = Color.FromArgb(22, 23, 33);
            ForeColor = Color.FromArgb(240, 236, 246);
            Font = new Font("Segoe UI", 10f);
            try { Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch (Exception) { }

            var title = new Label { Text = uninstall ? "Удалить " + Setup.Product : Setup.Product, Font = new Font("Segoe UI Semibold", 18f), AutoSize = true, Location = new Point(24, 18) };
            Controls.Add(title);
            int y = 72;
            if (uninstall)
            {
                AddCheck(restore, "Убрать расширение плеера из Spotify", true, ref y);
                AddCheck(spicetify, "Полностью вернуть Spotify без Spicetify (spicetify restore)", false, ref y);
                AddCheck(settings, "Удалить настройки плеера", false, ref y);
            }
            else
            {
                AddCheck(spicetify, "Установить Spicetify и подключить расширение плеера к Spotify", true, ref y);
                AddCheck(wallpaper, "Включить живые обои рабочего стола", true, ref y);
                AddCheck(desktop, "Ярлык на рабочем столе", true, ref y);
                AddCheck(autostart, "Запускать вместе с Windows", true, ref y);
            }
            log.Multiline = true;
            log.ReadOnly = true;
            log.ScrollBars = ScrollBars.Vertical;
            log.BackColor = Color.FromArgb(14, 15, 22);
            log.ForeColor = Color.FromArgb(200, 196, 214);
            log.BorderStyle = BorderStyle.FixedSingle;
            log.Font = new Font("Consolas", 9f);
            log.Location = new Point(26, y + 6);
            log.Size = new Size(568, 400 - y - 30);
            Controls.Add(log);
            progress.Location = new Point(26, 412);
            progress.Size = new Size(330, 8);
            progress.Style = ProgressBarStyle.Marquee;
            progress.Visible = false;
            Controls.Add(progress);
            StyleButton(go, uninstall ? "Удалить" : "Установить", true);
            go.Location = new Point(384, 420);
            go.Click += delegate { Start(); };
            StyleButton(close, "Закрыть", false);
            close.Location = new Point(494, 420);
            close.Click += delegate { Close(); };
            Controls.Add(go);
            Controls.Add(close);
        }

        private void AddCheck(CheckBox box, string label, bool on, ref int y)
        {
            box.Text = label;
            box.Checked = on;
            box.AutoSize = true;
            box.Location = new Point(28, y);
            box.ForeColor = ForeColor;
            Controls.Add(box);
            y += 30;
        }

        private void StyleButton(Button button, string label, bool primary)
        {
            button.Text = label;
            button.Size = new Size(100, 34);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = primary ? Color.FromArgb(255, 122, 182) : Color.FromArgb(44, 45, 60);
            button.ForeColor = primary ? Color.FromArgb(20, 16, 28) : ForeColor;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (busy) { e.Cancel = true; return; }
            base.OnFormClosing(e);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            base.OnFormClosed(e);
            if (!cleanupPending) return;
            var cleanup = new ProcessStartInfo("cmd.exe", "/c for /l %i in (1,1,20) do (ping -n 2 127.0.0.1 >nul & rmdir /s /q \"" + Setup.InstallDir + "\" 2>nul & if not exist \"" + Setup.InstallDir + "\" exit)")
            { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
            Process.Start(cleanup);
        }

        private void Say(string line)
        {
            if (InvokeRequired) { BeginInvoke((Action)delegate { Say(line); }); return; }
            log.AppendText(line.Replace("\r", "").Replace("\n", Environment.NewLine) + Environment.NewLine);
        }

        private void Start()
        {
            if (finished) { if (!uninstall) Launch(); Close(); return; }
            busy = true;
            go.Enabled = close.Enabled = false;
            foreach (Control c in Controls) if (c is CheckBox) c.Enabled = false;
            progress.Visible = true;
            bool withSpicetify = spicetify.Checked, withDesktop = desktop.Checked, withAutostart = autostart.Checked, withWallpaper = wallpaper.Checked;
            bool removeExtension = restore.Checked, removeSettings = settings.Checked;
            var worker = new Thread(() =>
            {
                string failure = null;
                try
                {
                    if (uninstall) Uninstall(removeExtension, withSpicetify, removeSettings);
                    else Install(withSpicetify, withDesktop, withAutostart, withWallpaper);
                }
                catch (Exception error) { failure = error.Message; }
                BeginInvoke((Action)delegate { Done(failure); });
            });
            worker.IsBackground = true;
            worker.SetApartmentState(ApartmentState.STA);
            worker.Start();
        }

        private void Install(bool withSpicetify, bool withDesktop, bool withAutostart, bool withWallpaper)
        {
            string exe = Path.Combine(Setup.InstallDir, Setup.ExeName);
            string setupCopy = Path.Combine(Setup.InstallDir, Setup.SetupName);
            Say("Закрываю плеер, если он запущен…");
            Setup.StopPlayer();
            Setup.RemoveLegacy(Say);
            Say("Копирую файлы плеера в " + Setup.InstallDir);
            Directory.CreateDirectory(Setup.InstallDir);
            Setup.ExtractApp(Setup.InstallDir, Say);
            string self = Assembly.GetExecutingAssembly().Location;
            if (!self.Equals(setupCopy, StringComparison.OrdinalIgnoreCase)) File.Copy(self, setupCopy, true);
            Say("Ярлыки…");
            Setup.Shortcut(Setup.StartMenuLink, exe, "Мини-плеер и живые обои Spotify");
            if (withDesktop) Setup.Shortcut(Setup.DesktopLink, exe, "Мини-плеер и живые обои Spotify");
            Setup.Autostart(exe, withAutostart);
            Setup.Register(exe, setupCopy, Setup.FolderSizeKb(Setup.InstallDir));
            Directory.CreateDirectory(Setup.SettingsDir);
            File.WriteAllText(Path.Combine(Setup.SettingsDir, "wallpaper.txt"), withWallpaper ? "on" : "off");
            string token = Setup.EnsureToken();
            if (!withSpicetify) { Say("Spicetify пропущен по выбору."); return; }
            string cli = SpicetifyInstaller.FindCli();
            if (cli == null)
            {
                Say("Ставлю Spicetify 2.46.4 в " + SpicetifyInstaller.DefaultFolder);
                Setup.ExtractSpicetify(SpicetifyInstaller.DefaultFolder);
                Setup.AddToUserPath(SpicetifyInstaller.DefaultFolder);
            }
            else Say("Spicetify уже стоит: " + cli);
            Say("Подключаю расширение плеера к Spotify (Spotify перезапустится)…");
            try { Say(SpicetifyInstaller.Install(Path.Combine(Setup.InstallDir, "assets"), token)); }
            catch (Exception error)
            {
                Say("Не получилось подключить расширение: " + error.Message);
                Say("Плеер установлен. Когда Spotify будет установлен и запущен, открой меню плеера ☰ → «Spicetify» → «Установить расширение в Spotify».");
            }
        }

        private void Uninstall(bool removeExtension, bool fullRestore, bool removeSettings)
        {
            Say("Закрываю плеер…");
            Setup.StopPlayer();
            if (fullRestore) { Say("Возвращаю Spotify без Spicetify…"); try { Say(SpicetifyInstaller.Restore()); } catch (Exception error) { Say("spicetify restore: " + error.Message); } }
            else if (removeExtension)
            {
                Say("Убираю расширение плеера из Spotify…");
                try
                {
                    string cli = SpicetifyInstaller.FindCli();
                    if (cli != null)
                    {
                        var info = new ProcessStartInfo(cli, "config extensions " + SpicetifyInstaller.ExtensionName + "-") { UseShellExecute = false, CreateNoWindow = true };
                        using (Process p = Process.Start(info)) p.WaitForExit(30000);
                        Say(SpicetifyInstaller.Reapply());
                    }
                }
                catch (Exception error) { Say("Расширение: " + error.Message); }
            }
            Say("Удаляю ярлыки, автозапуск и запись в «Приложениях»…");
            foreach (string link in new[] { Setup.StartMenuLink, Setup.DesktopLink }) if (File.Exists(link)) File.Delete(link);
            Setup.Autostart(null, false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + Setup.AppKey, false);
            if (removeSettings && Directory.Exists(Setup.SettingsDir)) { Say("Удаляю настройки…"); Directory.Delete(Setup.SettingsDir, true); }
            Say("Папка плеера удалится после закрытия этого окна.");
            cleanupPending = true;
        }

        private void Done(string failure)
        {
            busy = false;
            progress.Visible = false;
            close.Enabled = true;
            if (failure != null)
            {
                Say("ОШИБКА: " + failure);
                go.Enabled = true;
                go.Text = "Повторить";
                foreach (Control c in Controls) if (c is CheckBox) c.Enabled = true;
                return;
            }
            finished = true;
            Say(uninstall ? Setup.Product + " удалён." : "Готово.");
            go.Enabled = true;
            go.Text = uninstall ? "Закрыть" : "Запустить";
        }

        private void Launch()
        {
            string exe = Path.Combine(Setup.InstallDir, Setup.ExeName);
            if (File.Exists(exe)) Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Setup.InstallDir });
        }
    }
}
