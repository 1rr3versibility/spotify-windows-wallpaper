using System;
using System.IO;

namespace CapriDesktop
{
    internal static class Journal
    {
        private static readonly object Gate = new object();
        private static string file;

        internal static string Last { get; private set; }

        internal static void Open(string folder)
        {
            Directory.CreateDirectory(folder);
            file = Path.Combine(folder, "SpotifyOnWallpaper.log");
            if (File.Exists(file) && new FileInfo(file).Length > 2 * 1024 * 1024) File.Delete(file);
        }

        internal static void Write(string where, Exception error)
        {
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + where + ": " + error.GetType().Name + ": " + error.Message;
            lock (Gate)
            {
                Last = where + ": " + error.Message;
                if (file != null) File.AppendAllText(file, line + Environment.NewLine + error.StackTrace + Environment.NewLine);
            }
        }
    }
}
