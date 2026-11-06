// Extracted from lachydotmcg/capri-desktop commit eeee07edb497ce071d1cd56be6a935ddcc6987e5.
// See upstream LICENSE.md for required notices and terms.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace CapriDesktop
{
    internal static class Look
    {
        internal static readonly Color Panel = Color.FromArgb(9, 11, 15);
        internal static readonly Color Cyan = Color.FromArgb(58, 214, 235);
        internal static readonly Color Red = Color.FromArgb(232, 36, 64);
        internal static readonly Color Yellow = Color.FromArgb(244, 214, 70);
        internal static readonly Color Neon = Color.FromArgb(56, 176, 255);
        internal static readonly Color Ink = Color.FromArgb(232, 236, 240);
        internal static readonly Color Dim = Color.FromArgb(122, 128, 138);

        internal static readonly Color Pink = Color.FromArgb(255, 46, 136);
        private static readonly PrivateFontCollection fonts = new PrivateFontCollection();
        private static IntPtr fontMemory;
        private static readonly FontFamily embedded = Embedded("Capri.Font.Mono.ttf");
        private static Cursor pointer;

        [StructLayout(LayoutKind.Sequential)] private struct IconInfo { internal bool Icon; internal int X; internal int Y; internal IntPtr Mask; internal IntPtr Colour; }
        [DllImport("user32.dll")] private static extern bool GetIconInfo(IntPtr icon, ref IconInfo info);
        [DllImport("user32.dll")] private static extern IntPtr CreateIconIndirect(ref IconInfo info);
        [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr icon);
        [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr value);

        internal static Cursor Pointer
        {
            get
            {
                if (pointer != null) return pointer;
                float scale;
                using (Graphics screen = Graphics.FromHwnd(IntPtr.Zero)) scale = Math.Max(1f, screen.DpiX / 96f);
                int size = (int)Math.Round(32 * scale);
                using (Bitmap art = PointerArt(size))
                {
                    IntPtr icon = art.GetHicon();
                    IconInfo info = new IconInfo();
                    GetIconInfo(icon, ref info);
                    info.Icon = false;
                    info.X = (int)Math.Round(2 * scale);
                    info.Y = (int)Math.Round(2 * scale);
                    IntPtr handle = CreateIconIndirect(ref info);
                    DeleteObject(info.Mask);
                    DeleteObject(info.Colour);
                    DestroyIcon(icon);
                    pointer = handle == IntPtr.Zero ? Cursors.Hand : new Cursor(handle);
                }
                return pointer;
            }
        }

        // Her artist's cursor, with its tip where the old arrow's was, so her clicks land the same place.
        private static Bitmap ArtistPointer(int size)
        {
            using (System.IO.Stream stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("Capri.Cursor.png"))
            {
                if (stream == null) return null;
                using (Bitmap source = new Bitmap(stream))
                {
                    Bitmap art = new Bitmap(size, size, PixelFormat.Format32bppArgb);
                    float fit = size * 30f / 32 / Math.Max(source.Width, source.Height), inset = size * 2f / 32;
                    using (Graphics graphics = Graphics.FromImage(art))
                    {
                        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        graphics.DrawImage(source, inset, inset, source.Width * fit, source.Height * fit);
                    }
                    return art;
                }
            }
        }

        internal static Bitmap PointerArt(int size)
        {
            Bitmap artist = ArtistPointer(size);
            if (artist != null) return artist;
            float s = size / 32f;
            PointF[] arrow = { new PointF(2, 2), new PointF(2, 24), new PointF(8, 18.5f), new PointF(12, 27), new PointF(16, 25.2f), new PointF(12, 16.8f), new PointF(19.5f, 16.8f) };
            Bitmap art = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Bitmap whole = new Bitmap(size, size, PixelFormat.Format32bppArgb))
            {
                using (Graphics graphics = Graphics.FromImage(whole))
                {
                    graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    using (Brush cyan = new SolidBrush(Color.FromArgb(200, Cyan))) graphics.FillPolygon(cyan, Shift(arrow, 1.6f, 0.4f, s));
                    using (Brush red = new SolidBrush(Color.FromArgb(170, Red))) graphics.FillPolygon(red, Shift(arrow, -1.1f, -0.3f, s));
                    PointF[] body = Shift(arrow, 0, 0, s);
                    using (Brush pink = new SolidBrush(Pink)) graphics.FillPolygon(pink, body);
                    using (Pen edge = new Pen(Color.FromArgb(20, 6, 14), 1.3f * s)) { edge.LineJoin = LineJoin.Round; graphics.DrawPolygon(edge, body); }
                    using (Pen shine = new Pen(Color.FromArgb(150, 255, 214, 236), 1f * s)) graphics.DrawLine(shine, 3.6f * s, 5.5f * s, 3.6f * s, 17 * s);
                }
                using (Graphics graphics = Graphics.FromImage(art))
                {
                    int cut = (int)Math.Round(11 * s);
                    int band = Math.Max(2, (int)Math.Round(2.5f * s));
                    int slip = Math.Max(1, (int)Math.Round(2.5f * s));
                    graphics.DrawImage(whole, new Rectangle(0, 0, size, cut), new Rectangle(0, 0, size, cut), GraphicsUnit.Pixel);
                    graphics.DrawImage(whole, new Rectangle(slip, cut, size - slip, band), new Rectangle(0, cut, size - slip, band), GraphicsUnit.Pixel);
                    graphics.DrawImage(whole, new Rectangle(0, cut + band, size, size - cut - band), new Rectangle(0, cut + band, size, size - cut - band), GraphicsUnit.Pixel);
                }
            }
            return art;
        }

        private static PointF[] Shift(PointF[] points, float x, float y, float s)
        {
            PointF[] moved = new PointF[points.Length];
            for (int i = 0; i < points.Length; i++) moved[i] = new PointF((points[i].X + x) * s, (points[i].Y + y) * s);
            return moved;
        }

        [DllImport("gdi32.dll")] private static extern IntPtr AddFontMemResourceEx(IntPtr font, uint length, IntPtr reserved, ref uint count);
        [DllImport("gdi32.dll")] private static extern bool RemoveFontMemResourceEx(IntPtr font);

        private static FontFamily Embedded(string name)
        {
            IntPtr memory = IntPtr.Zero, resource = IntPtr.Zero;
            try
            {
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
                {
                    if (stream == null) return null;
                    byte[] data = new byte[stream.Length];
                    int read = 0;
                    while (read < data.Length)
                    {
                        int took = stream.Read(data, read, data.Length - read);
                        if (took == 0) return null;
                        read += took;
                    }
                    memory = Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data, 0, memory, data.Length);
                    uint count = 0;
                    resource = AddFontMemResourceEx(memory, (uint)data.Length, IntPtr.Zero, ref count);
                    if (resource == IntPtr.Zero || count == 0) return null;
                    fonts.AddMemoryFont(memory, data.Length);
                    if (fonts.Families.Length == 0) return null;
                    fontMemory = memory;
                    return fonts.Families[0];
                }
            }
            catch (ArgumentException) { return null; }
            catch (ExternalException) { return null; }
            catch (IOException) { return null; }
            finally
            {
                if (memory != IntPtr.Zero && memory != fontMemory)
                {
                    if (resource != IntPtr.Zero) RemoveFontMemResourceEx(resource);
                    Marshal.FreeCoTaskMem(memory);
                }
            }
        }

        private const string Extras = "ıŁłŒœŠšŸŽžƒ–—‘’‚“”„†‡•…‰‹›€™";

        internal static bool Drawable(string text)
        {
            foreach (char c in text ?? "") if (c > 0xFF && Extras.IndexOf(c) < 0) return false;
            return true;
        }

        internal static Font Mono(float size, FontStyle style, GraphicsUnit unit = GraphicsUnit.Pixel, string text = null)
        {
            if (embedded != null && Drawable(text)) return new Font(embedded, size, embedded.IsStyleAvailable(style) ? style : FontStyle.Regular, unit);
            return FallbackMono(size, style, unit);
        }

        internal static Font FallbackMono(float size, FontStyle style, GraphicsUnit unit)
        {
            foreach (string family in new[] { "Cascadia Mono", "Consolas", "Courier New" })
            {
                Font font = new Font(family, size, style, unit);
                if (font.Name == family) return font;
                font.Dispose();
            }
            return new Font(FontFamily.GenericMonospace, size, style, unit);
        }

        internal static GraphicsPath Rounded(RectangleF box, float radius)
        {
            GraphicsPath path = new GraphicsPath();
            float d = radius * 2;
            path.AddArc(box.Left, box.Top, d, d, 180, 90);
            path.AddArc(box.Right - d, box.Top, d, d, 270, 90);
            path.AddArc(box.Right - d, box.Bottom - d, d, d, 0, 90);
            path.AddArc(box.Left, box.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        // True when the text has Burmese in it.
        internal static bool Burmese(string text)
        {
            foreach (char c in text ?? "") if (Myanmar(c)) return true;
            return false;
        }

        private static bool Myanmar(char c) { return (c >= 0x1000 && c <= 0x109F) || (c >= 0xA9E0 && c <= 0xA9FF) || (c >= 0xAA60 && c <= 0xAA7F); }

        // Her mono font has no stand-in for Burmese, so GDI+ would draw nothing there. Burmese draws in Myanmar Text instead,
        // on the same baseline as the rest of the line, which stays in her font.
        internal static Font Myanmar(Font font)
        {
            foreach (string family in new[] { "Myanmar Text", "Segoe UI" })
            {
                Font found = new Font(family, font.Size, font.Style, font.Unit);
                if (found.Name == family) return found;
                found.Dispose();
            }
            return new Font(FontFamily.GenericSansSerif, font.Size, font.Style, font.Unit);
        }

        // Draws a line like DrawString does, with any Burmese in Myanmar Text. Returns where a Burmese line ends, or x for
        // any other line, which draws exactly as before.
        internal static float Draw(Graphics graphics, string text, Font font, Brush brush, float x, float y)
        {
            if (!Burmese(text)) { graphics.DrawString(text, font, brush, x, y, StringFormat.GenericTypographic); return x; }
            using (Font burmese = Myanmar(font))
            {
                float lift = Ascent(burmese) - Ascent(font);
                foreach (string piece in Pieces(text))
                {
                    Font used = Myanmar(piece[0]) ? burmese : font;
                    graphics.DrawString(piece, used, brush, x, used == font ? y : y - lift, StringFormat.GenericTypographic);
                    x += graphics.MeasureString(piece, used, PointF.Empty, Spaced).Width;
                }
            }
            return x;
        }

        // The text in turns of Burmese and everything else.
        private static List<string> Pieces(string text)
        {
            List<string> pieces = new List<string>();
            int start = 0;
            for (int i = 1; i <= text.Length; i++)
                if (i == text.Length || Myanmar(text[i]) != Myanmar(text[start])) { pieces.Add(text.Substring(start, i - start)); start = i; }
            return pieces;
        }

        private static float Ascent(Font font) { return font.Size * font.FontFamily.GetCellAscent(font.Style) / font.FontFamily.GetEmHeight(font.Style); }
        // Measures a line with its trailing spaces, for the caret after Thai and Indian scripts, whose letters don't keep to her columns.
        internal static readonly StringFormat Spaced = Trailing();

        private static StringFormat Trailing()
        {
            StringFormat format = (StringFormat)StringFormat.GenericTypographic.Clone();
            format.FormatFlags |= StringFormatFlags.MeasureTrailingSpaces;
            return format;
        }

    }

    internal class Overlay : Form
    {
        internal bool ClickThrough;
        internal bool OwnsImage = true;
        private Bitmap shown;
        internal bool Above = true;

        internal Overlay(string name)
        {
            Text = name;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            AutoScaleMode = AutoScaleMode.None;
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams value = base.CreateParams;
                value.ExStyle |= 0x00080000 | 0x00000080 | 0x08000000 | (Above ? 0x00000008 : 0) | (ClickThrough ? 0x20 : 0);
                return value;
            }
        }

        internal Bitmap Image { get { return shown; } }

        internal void Present(Bitmap image, Point at)
        {
            Rectangle target = new Rectangle(at, image.Size);
            if (Bounds != target) Bounds = target;
            if (!Visible) Show();
            Native.DrawLayered(Handle, image, at);
            Bitmap old = shown;
            shown = image;
            if (OwnsImage && old != null && old != image) old.Dispose();
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x0084 && shown != null)
            {
                long value = message.LParam.ToInt64();
                Point point = PointToClient(new Point((short)(value & 65535), (short)((value >> 16) & 65535)));
                if (point.X < 0 || point.Y < 0 || point.X >= shown.Width || point.Y >= shown.Height || shown.GetPixel(point.X, point.Y).A < 12)
                {
                    message.Result = new IntPtr(-1);
                    return;
                }
            }
            base.WndProc(ref message);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && shown != null) { if (OwnsImage) shown.Dispose(); shown = null; }
            base.Dispose(disposing);
        }
    }
}
