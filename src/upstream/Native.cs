// Extracted from lachydotmcg/capri-desktop commit eeee07edb497ce071d1cd56be6a935ddcc6987e5.
// See upstream LICENSE.md for required notices and terms.
using System;
using System.Drawing;
using System.Runtime.InteropServices;

namespace CapriDesktop
{
    internal static class Native
    {
        [StructLayout(LayoutKind.Sequential)] internal struct Point { internal int X, Y; internal Point(int x, int y) { X = x; Y = y; } }
        [StructLayout(LayoutKind.Sequential)] internal struct Size { internal int Width, Height; internal Size(int width, int height) { Width = width; Height = height; } }
        [StructLayout(LayoutKind.Sequential, Pack = 1)] internal struct Blend { internal byte Operation, Flags, Alpha, Format; }
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] internal static extern IntPtr GetWindow(IntPtr window, int command);
        [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, int flags);
        [DllImport("user32.dll")] internal static extern int GetWindowLong(IntPtr window, int index);
        [DllImport("user32.dll")] internal static extern void keybd_event(byte key, byte scan, int flags, UIntPtr extra);
        [DllImport("user32.dll")] internal static extern int GetDpiForWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr window);
        [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr window, IntPtr dc);
        [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
        [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr value);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool UpdateLayeredWindow(IntPtr window, IntPtr screen, ref Point destination, ref Size size, IntPtr source, ref Point origin, int colorKey, ref Blend blend, int flags);

        internal static void DrawLayered(IntPtr window, Bitmap bitmap, System.Drawing.Point location)
        {
            IntPtr screen = GetDC(IntPtr.Zero);
            IntPtr memory = CreateCompatibleDC(screen);
            IntPtr nativeBitmap = bitmap.GetHbitmap(Color.FromArgb(0));
            IntPtr previous = SelectObject(memory, nativeBitmap);
            try
            {
                Point destination = new Point(location.X, location.Y);
                Point origin = new Point(0, 0);
                Size size = new Size(bitmap.Width, bitmap.Height);
                Blend blend = new Blend { Operation = 0, Flags = 0, Alpha = 255, Format = 1 };
                if (!UpdateLayeredWindow(window, screen, ref destination, ref size, memory, ref origin, 0, ref blend, 2)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }
            finally
            {
                SelectObject(memory, previous);
                DeleteObject(nativeBitmap);
                DeleteDC(memory);
                ReleaseDC(IntPtr.Zero, screen);
            }
        }
    }
}
