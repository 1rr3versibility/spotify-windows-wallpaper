using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace CapriDesktop
{
    internal static class SpicetifyInstaller
    {
        internal const string ExtensionName = "talia-bridge.js";

        internal static string DefaultFolder
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "spicetify"); }
        }

        internal static string FindCli()
        {
            var candidates = new List<string>
            {
                Path.Combine(DefaultFolder, "spicetify.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "spicetify", "spicetify.exe")
            };
            foreach (string dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
            {
                if (dir.Length == 0) continue;
                try { candidates.Add(Path.Combine(dir.Trim('"'), "spicetify.exe")); } catch (ArgumentException) { }
            }
            foreach (string path in candidates) if (File.Exists(path)) return path;
            return null;
        }

        internal static string Install(string assetsFolder, string token)
        {
            string cli = FindCli();
            if (cli == null)
                throw new FileNotFoundException("Spicetify не установлен. Переустанови Talia через TaliaSetup.exe, он ставит Spicetify сам.");
            var log = new StringBuilder();
            int code;
            string userdata = Run(cli, "path userdata", 30, log, out code).Trim();
            string lastLine = userdata.Contains("\n") ? userdata.Substring(userdata.LastIndexOf('\n') + 1).Trim() : userdata;
            if (code != 0 || !Directory.Exists(lastLine)) lastLine = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "spicetify");
            string extensions = Path.Combine(lastLine, "Extensions");
            Directory.CreateDirectory(extensions);
            string template = File.ReadAllText(Path.Combine(assetsFolder, "spicetify", ExtensionName), Encoding.UTF8);
            File.WriteAllText(Path.Combine(extensions, ExtensionName), template.Replace("__TALIA_TOKEN__", token), new UTF8Encoding(false));
            log.AppendLine("Расширение записано в " + extensions);
            Require(cli, "config extensions " + ExtensionName, 30, log);
            Apply(cli, log);
            return log.ToString();
        }

        internal static string Reapply()
        {
            string cli = FindCli();
            if (cli == null) throw new FileNotFoundException("Spicetify не установлен.");
            var log = new StringBuilder();
            Apply(cli, log);
            return log.ToString();
        }

        internal static string Restore()
        {
            string cli = FindCli();
            if (cli == null) return "";
            var log = new StringBuilder();
            int code;
            Run(cli, "config extensions " + ExtensionName + "-", 30, log, out code);
            Run(cli, "restore", 180, log, out code);
            return log.ToString();
        }

        private static void Apply(string cli, StringBuilder log)
        {
            int code;
            string applied = Run(cli, "apply", 240, log, out code);
            bool needsBackup = applied.IndexOf("backup apply", StringComparison.OrdinalIgnoreCase) >= 0
                || applied.IndexOf("mismatched", StringComparison.OrdinalIgnoreCase) >= 0
                || applied.IndexOf("stock state", StringComparison.OrdinalIgnoreCase) >= 0;
            if (needsBackup) Require(cli, "backup apply", 300, log);
            else if (code != 0) throw new InvalidOperationException("spicetify apply завершился с кодом " + code + ":\n" + applied.Trim());
        }

        private static void Require(string cli, string arguments, int seconds, StringBuilder log)
        {
            int code;
            string text = Run(cli, arguments, seconds, log, out code);
            if (code != 0) throw new InvalidOperationException("spicetify " + arguments + " завершился с кодом " + code + ":\n" + text.Trim());
        }

        private static string Run(string cli, string arguments, int seconds, StringBuilder log, out int exitCode)
        {
            var info = new ProcessStartInfo(cli, arguments)
            {
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
            };
            using (Process process = Process.Start(info))
            {
                var output = new StringBuilder();
                process.OutputDataReceived += (s, e) => { if (e.Data != null) lock (output) output.AppendLine(e.Data); };
                process.ErrorDataReceived += (s, e) => { if (e.Data != null) lock (output) output.AppendLine(e.Data); };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                try
                {
                    process.StandardInput.NewLine = "\n";
                    for (int i = 0; i < 4; i++) process.StandardInput.WriteLine("y");
                    process.StandardInput.Close();
                }
                catch (IOException) { }
                if (!process.WaitForExit(seconds * 1000))
                {
                    try { process.Kill(); } catch (InvalidOperationException) { }
                    throw new TimeoutException("spicetify " + arguments + " не завершился за " + seconds + " с.");
                }
                process.WaitForExit();
                string text = System.Text.RegularExpressions.Regex.Replace(output.ToString(), "\u001b\\[[0-9;]*m", "");
                log.AppendLine("> spicetify " + arguments);
                log.AppendLine(text.Trim());
                exitCode = process.ExitCode;
                return text;
            }
        }
    }
}
