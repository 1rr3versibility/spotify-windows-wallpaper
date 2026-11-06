using System;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace CapriDesktop
{
    internal static class Skin
    {
        internal static bool Capri;

        internal static Color Pink { get { return Capri ? Look.Pink : TaliaSkin.Pink; } }
        internal static Color Cyan { get { return Capri ? Look.Cyan : TaliaSkin.Cyan; } }
        internal static Color Ink { get { return Capri ? Look.Ink : TaliaSkin.Ink; } }
        internal static Color Dim { get { return Capri ? Look.Dim : TaliaSkin.Dim; } }
        internal static Color Red { get { return Capri ? Look.Red : TaliaSkin.Red; } }
        internal static bool ShowsCover { get { return !Capri; } }

        internal static Font Title(float s, string text)
        {
            return Capri ? Look.Mono(13.5f * s, FontStyle.Regular, GraphicsUnit.Pixel, text)
                : new Font("Segoe UI", 14.5f * s, FontStyle.Bold, GraphicsUnit.Pixel);
        }

        internal static Font Small(float s, string text)
        {
            return Capri ? Look.Mono(11 * s, FontStyle.Regular, GraphicsUnit.Pixel, text)
                : new Font("Segoe UI", 11 * s, FontStyle.Regular, GraphicsUnit.Pixel);
        }

        internal static void Plate(Graphics graphics, GraphicsPath path, float s, double now, Color[] palette, float w, float h)
        {
            if (!Capri)
            {
                TaliaSkin.Plate(graphics, path, s, now, palette);
                return;
            }
            PointF from = new PointF(-1, 0), to = new PointF(w + 1, 0);
            using (LinearGradientBrush haze = new LinearGradientBrush(from, to, Color.FromArgb(30, Look.Pink), Color.FromArgb(30, Look.Cyan)))
            using (Pen wide = new Pen(haze, 14 * s)) graphics.DrawPath(wide, path);
            using (LinearGradientBrush haze = new LinearGradientBrush(from, to, Color.FromArgb(70, Look.Pink), Color.FromArgb(70, Look.Cyan)))
            using (Pen near = new Pen(haze, 6 * s)) graphics.DrawPath(near, path);
            using (Brush fill = new SolidBrush(Color.FromArgb(250, 5, 6, 9))) graphics.FillPath(fill, path);
            graphics.SetClip(path);
            using (Pen scan = new Pen(Color.FromArgb(9, 255, 255, 255), Math.Max(1, s)))
                for (float row = 0; row < h; row += 3 * s) graphics.DrawLine(scan, 0, row, w, row);
            graphics.ResetClip();
            using (LinearGradientBrush ink = new LinearGradientBrush(from, to, Look.Pink, Look.Cyan))
            using (Pen edge = new Pen(ink, 1.6f * s)) graphics.DrawPath(edge, path);
        }

        internal static void Tears(Graphics graphics, float s, float w, float h)
        {
            if (!Capri) return;
            using (Brush cyan = new SolidBrush(Color.FromArgb(210, Look.Cyan))) graphics.FillRectangle(cyan, w * 0.64f, -3 * s, 28 * s, 1.6f * s);
            using (Brush pink = new SolidBrush(Color.FromArgb(210, Look.Pink))) graphics.FillRectangle(pink, w * 0.18f, h + 1.4f * s, 18 * s, 1.6f * s);
        }

        internal static void TitleShadow(Graphics graphics, string shown, Font big, float x, float y, float s)
        {
            if (!Capri) return;
            using (Brush pink = new SolidBrush(Color.FromArgb(140, Look.Pink))) Look.Draw(graphics, shown, big, pink, x - 1.1f * s, y);
            using (Brush cyan = new SolidBrush(Color.FromArgb(140, Look.Cyan))) Look.Draw(graphics, shown, big, cyan, x + 1.1f * s, y);
        }
    }
}
