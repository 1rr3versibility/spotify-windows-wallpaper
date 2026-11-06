using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace CapriDesktop
{
    internal static class TaliaSkin
    {
        internal static readonly Color Pink = Color.FromArgb(255, 154, 187);
        internal static readonly Color Cyan = Color.FromArgb(134, 221, 234);
        internal static readonly Color Ink = Color.FromArgb(247, 242, 250);
        internal static readonly Color Dim = Color.FromArgb(169, 175, 192);
        internal static readonly Color Red = Color.FromArgb(255, 102, 121);
        private static readonly Color Graphite = Color.FromArgb(19, 21, 33);
        private static readonly Color Violet = Color.FromArgb(132, 107, 190);

        internal static void Plate(Graphics g, GraphicsPath shape, float s, double now, Color[] palette)
        {
            RectangleF b = shape.GetBounds();
            Color first = palette != null && palette.Length > 0 ? palette[0] : Pink;
            Color second = palette != null && palette.Length > 1 ? palette[1] : Cyan;
            Color warm = Mix(first, Pink, .22);
            Color cool = Mix(second, Violet, .23);
            float phase = (float)(Math.Sin(now * .28) * .5 + .5);

            using (Pen diffuse = new Pen(Color.FromArgb(12, Violet), 18 * s)) g.DrawPath(diffuse, shape);
            using (Pen near = new Pen(Color.FromArgb(25, Mix(Violet, cool, .35)), 8 * s)) g.DrawPath(near, shape);
            using (Brush fill = new SolidBrush(Color.FromArgb(252, Graphite))) g.FillPath(fill, shape);

            GraphicsState saved = g.Save();
            try
            {
                g.SetClip(shape, CombineMode.Intersect);
                Glow(g, b.Left + b.Width * (.25f + .23f * phase), b.Top + b.Height * .08f,
                    b.Width * .64f, b.Height * .88f, warm, 42);
                Glow(g, b.Left + b.Width * (.8f - .16f * phase), b.Top + b.Height * .90f,
                    b.Width * .56f, b.Height * .88f, cool, 36);

                using (Pen trim = new Pen(Color.FromArgb(140, warm), 1.1f * s))
                    g.DrawLines(trim, new[] { new PointF(b.Left + 17 * s, b.Top + 7 * s), new PointF(b.Left + 22 * s, b.Top + 3.5f * s), new PointF(b.Left + 55 * s, b.Top + 3.5f * s) });
                using (Pen trim = new Pen(Color.FromArgb(115, cool), 1.1f * s))
                    g.DrawLines(trim, new[] { new PointF(b.Right - 46 * s, b.Bottom - 4 * s), new PointF(b.Right - 23 * s, b.Bottom - 4 * s), new PointF(b.Right - 17 * s, b.Bottom - 8 * s) });
            }
            finally { g.Restore(saved); }

            using (LinearGradientBrush edge = new LinearGradientBrush(b,
                Color.FromArgb(173, Mix(warm, Ink, .23)), Color.FromArgb(149, Mix(cool, Dim, .33)), LinearGradientMode.ForwardDiagonal))
            using (Pen line = new Pen(edge, Math.Max(1f, s))) g.DrawPath(line, shape);
        }

        private static void Glow(Graphics g, float x, float y, float rx, float ry, Color tint, int alpha)
        {
            using (GraphicsPath ellipse = new GraphicsPath())
            {
                ellipse.AddEllipse(x - rx, y - ry, 2 * rx, 2 * ry);
                using (PathGradientBrush brush = new PathGradientBrush(ellipse))
                {
                    brush.CenterPoint = new PointF(x, y);
                    brush.CenterColor = Color.FromArgb(alpha, tint);
                    brush.SurroundColors = new[] { Color.FromArgb(0, tint) };
                    g.FillPath(brush, ellipse);
                }
            }
        }

        internal static Color[] Palette(Image artwork)
        {
            if (artwork == null) return new[] { Pink, Cyan };
            try
            {
                const int size = 24;
                Swatch[] bins = new Swatch[512];
                using (Bitmap sample = new Bitmap(size, size, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(sample))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBilinear;
                        g.DrawImage(artwork, new Rectangle(0, 0, size, size));
                    }
                    for (int y = 0; y < size; y++)
                        for (int x = 0; x < size; x++)
                        {
                            Color color = sample.GetPixel(x, y);
                            if (color.A < 120) continue;
                            int bin = (color.R >> 5) * 64 + (color.G >> 5) * 8 + (color.B >> 5);
                            bins[bin].Add(color);
                        }
                }

                Color primary = Pick(bins, Color.Empty);
                if (primary.IsEmpty) return new[] { Pink, Cyan };
                Color secondary = Pick(bins, primary);
                if (secondary.IsEmpty) secondary = Mix(primary, Violet, .62);
                return new[] { primary, secondary };
            }
            catch (ArgumentException) { return new[] { Pink, Cyan }; }
            catch (ExternalException) { return new[] { Pink, Cyan }; }
        }

        private struct Swatch
        {
            internal int Count, Red, Green, Blue;
            internal void Add(Color c) { Count++; Red += c.R; Green += c.G; Blue += c.B; }
            internal Color Average { get { return Color.FromArgb(Red / Count, Green / Count, Blue / Count); } }
        }

        private static Color Pick(Swatch[] bins, Color exclude)
        {
            Color best = Color.Empty;
            double score = 0;
            foreach (Swatch swatch in bins)
            {
                if (swatch.Count < 3) continue;
                Color c = swatch.Average;
                if (!exclude.IsEmpty && Distance(c, exclude) < 84) continue;
                double saturation = c.GetSaturation(), value = Math.Max(c.R, Math.Max(c.G, c.B)) / 255.0;
                double rank = swatch.Count * (.18 + .82 * saturation) * (.13 + .87 * value);
                if (rank <= score) continue;
                best = c;
                score = rank;
            }
            return best;
        }

        private static double Distance(Color a, Color b)
        {
            int r = a.R - b.R, g = a.G - b.G, blue = a.B - b.B;
            return Math.Sqrt(r * r + g * g + blue * blue);
        }

        internal static Color Mix(Color a, Color b, double amount)
        {
            return Color.FromArgb((int)Math.Round(a.R + (b.R - a.R) * amount),
                (int)Math.Round(a.G + (b.G - a.G) * amount), (int)Math.Round(a.B + (b.B - a.B) * amount));
        }

        internal static void Cover(Graphics g, Image artwork, RectangleF bounds, float s)
        {
            if (bounds.Width <= 0 || bounds.Height <= 0) return;
            float radius = Math.Min(6 * s, Math.Min(bounds.Width, bounds.Height) / 2);
            float curve = radius * 2;
            using (GraphicsPath tile = new GraphicsPath())
            {
                tile.AddArc(bounds.Left, bounds.Top, curve, curve, 180, 90);
                tile.AddArc(bounds.Right - curve, bounds.Top, curve, curve, 270, 90);
                tile.AddArc(bounds.Right - curve, bounds.Bottom - curve, curve, curve, 0, 90);
                tile.AddArc(bounds.Left, bounds.Bottom - curve, curve, curve, 90, 90);
                tile.CloseFigure();
                GraphicsState saved = g.Save();
                try
                {
                    g.SetClip(tile, CombineMode.Intersect);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    if (artwork == null) Crest(g, bounds, s);
                    else
                    {
                        float fit = Math.Max(bounds.Width / artwork.Width, bounds.Height / artwork.Height);
                        float w = artwork.Width * fit, h = artwork.Height * fit;
                        g.DrawImage(artwork, new RectangleF(bounds.Left + (bounds.Width - w) / 2,
                            bounds.Top + (bounds.Height - h) / 2, w, h));
                    }
                }
                finally { g.Restore(saved); }
                using (Pen edge = new Pen(Color.FromArgb(44, Color.White), Math.Max(1f, s))) g.DrawPath(edge, tile);
            }
        }

        private static void Crest(Graphics g, RectangleF bounds, float s)
        {
            using (var background = new LinearGradientBrush(bounds, Color.FromArgb(78, 42, 68), Graphite, 65f))
                g.FillRectangle(background, bounds);
            float x = bounds.Left + bounds.Width / 2, y = bounds.Top + bounds.Height / 2;
            using (var crest = new Pen(Pink, 1.45f * s))
            {
                crest.LineJoin = LineJoin.Round;
                g.DrawLines(crest, new[] { new PointF(x - 10 * s, y + 7 * s), new PointF(x - 6 * s, y - 10 * s),
                    new PointF(x, y - 4 * s), new PointF(x + 5 * s, y - 10 * s), new PointF(x + 10 * s, y + 7 * s) });
            }
            using (var eye = new SolidBrush(Cyan)) g.FillEllipse(eye, x - 1.8f * s, y + 3 * s, 3.6f * s, 3.6f * s);
        }
    }
}
