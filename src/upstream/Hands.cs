// Extracted from lachydotmcg/capri-desktop commit eeee07edb497ce071d1cd56be6a935ddcc6987e5.
// See upstream LICENSE.md for required notices and terms.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace CapriDesktop
{
    internal sealed class OpenWindow
    {
        internal readonly IntPtr Handle;
        internal readonly string Title;
        internal readonly string Program;
        internal OpenWindow(IntPtr handle, string title, string program) { Handle = handle; Title = title; Program = program; }
    }

    internal static class Hands
    {
        private const int KeyGap = 20;
        internal static Action<string> Run = Start;
        internal static Action<byte> Press = Tap;
        internal static Action<byte[]> Chord = PressChord;
        internal static Func<List<OpenWindow>> Windows = ReadWindows;
        private static readonly string[] Shell = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd" };
        private delegate bool Visit(IntPtr window, IntPtr data);
        [StructLayout(LayoutKind.Sequential)]
        private struct MessageQueueEntry
        {
            internal IntPtr Window;
            internal uint Message;
            internal IntPtr WParam, LParam;
            internal uint Time;
            internal int X, Y;
            internal uint Private;
        }
        [DllImport("user32.dll")] private static extern bool EnumWindows(Visit visit, IntPtr data);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
        [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr window);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int size);
        [DllImport("user32.dll")] private static extern int GetWindowThreadProcessId(IntPtr window, out int process);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
        [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);
        [DllImport("user32.dll")] private static extern bool AttachThreadInput(int from, int to, bool attach);
        [DllImport("kernel32.dll")] private static extern int GetCurrentThreadId();
        [DllImport("user32.dll")] private static extern bool PeekMessage(out MessageQueueEntry message, IntPtr window, uint first, uint last, uint flags);
        [DllImport("user32.dll")] private static extern uint MapVirtualKey(uint code, uint kind);
        [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(int access, bool inherit, int id);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref int size);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);

        private static void Start(string id)
        {
            using (Process.Start(Launch(id))) { }
        }

        internal static ProcessStartInfo Launch(string id)
        {
            // A launcher's command, like Riot Client with the game to start, runs its program with the rest, from that program's
            // folder, and so does a game's own program.
            Match command = Regex.Match(id, @"^""([A-Za-z]:\\[^""]+\.exe)""\s+(\S.*)$", RegexOptions.IgnoreCase);
            ProcessStartInfo info = command.Success ? new ProcessStartInfo(command.Groups[1].Value, command.Groups[2].Value)
                : Regex.IsMatch(id, @"^[A-Za-z]:\\|^\\\\|^[a-z][a-z0-9+.-]*://|^spotify:", RegexOptions.IgnoreCase) ? new ProcessStartInfo(id) : new ProcessStartInfo("explorer.exe", "shell:AppsFolder\\" + id);
            if (Regex.IsMatch(info.FileName, @"^[A-Za-z]:\\[^""<>|]+\.exe$", RegexOptions.IgnoreCase)) info.WorkingDirectory = Path.GetDirectoryName(info.FileName);
            info.UseShellExecute = true;
            return info;
        }

        // A beat apart and with their scan codes, so an app that reads either one, like Discord's page, gets the whole chord.
        private static void PressChord(byte[] keys)
        {
            for (int i = 0; i < keys.Length; i++)
            {
                if (i > 0) Thread.Sleep(KeyGap);
                Native.keybd_event(keys[i], (byte)MapVirtualKey(keys[i], 0), keys[i] == 0x5B ? 0x1 : 0, UIntPtr.Zero);
            }
            for (int i = keys.Length - 1; i >= 0; i--)
            {
                Thread.Sleep(KeyGap);
                Native.keybd_event(keys[i], (byte)MapVirtualKey(keys[i], 0), (keys[i] == 0x5B ? 0x1 : 0) | 0x2, UIntPtr.Zero);
            }
        }
        private static void Tap(byte key)
        {
            Native.keybd_event(key, 0, 0x1, UIntPtr.Zero);
            Native.keybd_event(key, 0, 0x1 | 0x2, UIntPtr.Zero);
        }

        private static List<OpenWindow> ReadWindows()
        {
            List<OpenWindow> found = new List<OpenWindow>();
            Dictionary<int, string> programs = new Dictionary<int, string>();
            int own = Process.GetCurrentProcess().Id;
            Visit visit = delegate(IntPtr window, IntPtr data)
            {
                int cloaked;
                if (!IsWindowVisible(window) || Native.GetWindow(window, 4) != IntPtr.Zero || (Native.GetWindowLong(window, -20) & 0x80) != 0) return true;
                if (DwmGetWindowAttribute(window, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
                int length = GetWindowTextLength(window);
                if (length == 0) return true;
                StringBuilder kind = new StringBuilder(64);
                GetClassName(window, kind, kind.Capacity);
                if (Array.IndexOf(Shell, kind.ToString()) >= 0) return true;
                int id;
                GetWindowThreadProcessId(window, out id);
                if (id == own) return true;
                string program;
                if (!programs.TryGetValue(id, out program))
                {
                    program = ProgramName(id);
                    programs[id] = program;
                }
                StringBuilder title = new StringBuilder(length + 1);
                GetWindowText(window, title, title.Capacity);
                found.Add(new OpenWindow(window, title.ToString(), program));
                return true;
            };
            EnumWindows(visit, IntPtr.Zero);
            GC.KeepAlive(visit);
            return found;
        }

        // A program's name as Process has it, chrome or soffice.bin, or "". Process took a snapshot of every process and thread on
        // the PC for each one, and her windows are read every second or so.
        internal static string ProgramName(int id)
        {
            IntPtr handle = OpenProcess(0x1000, false, id);
            if (handle != IntPtr.Zero)
            {
                try
                {
                    StringBuilder path = new StringBuilder(1024);
                    int size = path.Capacity;
                    if (QueryFullProcessImageName(handle, 0, path, ref size))
                    {
                        string full = path.ToString(), name = full.Substring(full.LastIndexOf('\\') + 1);
                        return name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? name.Substring(0, name.Length - 4) : name;
                    }
                }
                finally { CloseHandle(handle); }
            }
            // An elevated or closing window can refuse its process name during enumeration.
            try { using (Process process = Process.GetProcessById(id)) return process.ProcessName; }
            catch (ArgumentException) { return ""; }
            catch (InvalidOperationException) { return ""; }
            catch (System.ComponentModel.Win32Exception) { return ""; }
        }

        internal static bool Front(IntPtr handle)
        {
            if (!IsWindow(handle)) return false;
            if (IsIconic(handle))
            {
                ShowWindowAsync(handle, 9);
            }
            MessageQueueEntry pending;
            PeekMessage(out pending, IntPtr.Zero, 0, 0, 0);
            int ignored;
            int mine = GetCurrentThreadId();
            int theirs = GetWindowThreadProcessId(Native.GetForegroundWindow(), out ignored);
            bool attached = theirs != 0 && theirs != mine && AttachThreadInput(mine, theirs, true);
            try
            {
                BringWindowToTop(handle);
                SetForegroundWindow(handle);
            }
            finally { if (attached) AttachThreadInput(mine, theirs, false); }
            for (int i = 0; i < 10 && Native.GetForegroundWindow() != handle; i++) Thread.Sleep(50);
            return Native.GetForegroundWindow() == handle;
        }
    }
}
