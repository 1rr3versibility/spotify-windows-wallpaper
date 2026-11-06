using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Windows.Forms;

namespace CapriDesktop
{
    internal sealed class Dancer : IDisposable
    {
        internal static readonly string[] Dances = { "01-jump", "02-paws", "03-turn", "04-hands" };
        private static readonly HashSet<string> Reserved = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "sit", "sit-arrive", "sit-leave", "sit-music", "walk", "arrive", "leave" };
        private const double FigureShare = .30;
        private const double SeatShare = .62;
        private const double DropSeconds = 1.1;
        private const double ReturnSeconds = 1.0;
        private const double WalkPerSecond = .5;
        private const int MaxLoops = 10;

        private enum Phase { Sit, SitLeave, Arrive, Walk, Dance, Leave, SitArrive, Away }

        private readonly string directory;
        private readonly SpriteWindow window = new SpriteWindow();
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private readonly Random random = new Random();
        private readonly Dictionary<string, Clip> clips = new Dictionary<string, Clip>();
        private readonly HashSet<string> unavailable = new HashSet<string>();
        private readonly Dictionary<string, List<string>> discovered = new Dictionary<string, List<string>>();
        private readonly Dictionary<Bitmap, Bitmap>[] scaled = { new Dictionary<Bitmap, Bitmap>(), new Dictionary<Bitmap, Bitmap>() };
        private Size scaledFor;
        private string scene, dance;
        private bool active, facingLeft;
        private Phase phase = Phase.Sit;
        private double phaseStarted, danceEnds, lastNow;
        private double walkX, targetX;
        private PointF anchor, origin;
        private Bitmap lastFrame, frozen, retired, transient;
        private bool lastMirror;
        private Size lastSize;

        internal Dancer(string assetsDirectory)
        {
            directory = Path.Combine(assetsDirectory, "characters");
        }

        internal Rectangle SurfaceBounds { get { return window.Visible ? window.Bounds : Rectangle.Empty; } }
        internal Bitmap SurfaceImage { get { return window.Visible ? window.Image : null; } }
        internal IntPtr SurfaceHandle { get { return window.IsHandleCreated ? window.Handle : IntPtr.Zero; } }
        internal string CurrentDance { get { return dance; } }
        internal string State { get { return phase.ToString(); } }
        internal int? SeatHipX { get; private set; }
        internal int SeatWidth { get; private set; }
        internal bool Offstage { get; set; }

        internal bool HasAssets(string character, string requested)
        {
            character = CharacterId(character);
            return Seat(character) != null && GetClip(character, DanceId(requested)) != null;
        }

        internal void Update(Rectangle playerPlate, bool playing, string character, string requested, bool enabled)
        {
            SeatHipX = null;
            if (!enabled || playerPlate.Width <= 0 || playerPlate.Height <= 0)
            {
                Hide();
                return;
            }

            character = CharacterId(character);
            Clip seat = Seat(character);
            if (seat == null)
            {
                Hide();
                return;
            }

            Screen screen = Screen.FromRectangle(playerPlate);
            Rectangle area = screen.WorkingArea;
            double now = clock.Elapsed.TotalSeconds;
            double dt = Math.Max(0, Math.Min(.1, now - lastNow));
            lastNow = now;
            string nextScene = character + "/" + screen.DeviceName + "/" + (requested ?? "random");
            if (!active || scene != nextScene)
            {
                active = true;
                scene = nextScene;
                phase = playing && !Offstage ? Phase.Dance : Phase.Sit;
                phaseStarted = now;
                dance = null;
                anchor = PointF.Empty;
            }
            if (requested != null) dance = DanceId(requested);
            if (dance == null) PickDance(character, now);
            Clip performance = GetClip(character, dance);
            if (performance == null)
            {
                Hide();
                return;
            }

            Clip walk = GetClip(character, "walk"), arrive = GetClip(character, "arrive"), leave = GetClip(character, "leave");
            Clip sitArrive = GetClip(character, "sit-arrive"), sitLeave = GetClip(character, "sit-leave");
            int figure = Offstage ? Math.Max(48, (int)(playerPlate.Height * 1.5)) : Math.Max(48, (int)(area.Height * FigureShare));
            double unit = Unit(character, figure);

            Size seatSize;
            PointF seatOffset;
            PointF perch = Perch(area, playerPlate, seat, figure, unit, character == "capri", out seatSize, out seatOffset);
            float floor = area.Bottom - 2;
            Size standSize = StandSize(performance, figure, unit);
            double minX = area.Left + standSize.Width * .5, maxX = area.Right - standSize.Width * .5;

            Step(playing, now, character, requested, perch, floor, minX, maxX, sitLeave, arrive, leave, sitArrive, figure, dt, walk);
            if (phase == Phase.Away)
            {
                if (window.Visible) window.Hide();
                return;
            }

            Clip clip;
            double clock0 = phaseStarted;
            bool once = false;
            switch (phase)
            {
                case Phase.Sit: clip = playing && Offstage ? GetClip(character, "sit-music") ?? seat : seat; break;
                case Phase.SitLeave: clip = sitLeave; once = true; break;
                case Phase.SitArrive: clip = sitArrive; once = true; break;
                case Phase.Arrive: clip = arrive ?? performance; once = arrive != null; break;
                case Phase.Leave: clip = leave; once = true; break;
                case Phase.Walk: clip = walk ?? performance; break;
                default: clip = GetClip(character, dance) ?? performance; break;
            }

            Bitmap frame;
            Size size;
            PointF offset;
            bool mirror = facingLeft && (phase == Phase.Walk || phase == Phase.Dance || phase == Phase.Arrive || phase == Phase.Leave);
            if (clip == null)
            {
                frame = frozen ?? performance.First;
                size = standSize;
                offset = StandOffset(performance, size);
            }
            else
            {
                double ms = (now - clock0) * 1000;
                frame = once ? clip.FrameOnce(ms) : clip.FrameAt(ms);
                bool sitting = phase == Phase.Sit || phase == Phase.SitLeave || phase == Phase.SitArrive;
                if (sitting && clip.Anchor != null)
                {
                    size = Scale(clip.Size, unit);
                    offset = new PointF((float)(clip.Anchor.X * unit), (float)(clip.Anchor.Y * unit));
                }
                else if (sitting)
                {
                    size = seatSize;
                    offset = seatOffset;
                }
                else
                {
                    size = StandSize(clip, figure, unit);
                    offset = StandOffset(clip, size);
                }
            }
            if (mirror) offset = new PointF(size.Width - offset.X, offset.Y);
            if (phase == Phase.Sit)
            {
                SeatHipX = (int)perch.X;
                SeatWidth = size.Width;
            }
            if ((phase == Phase.Walk || phase == Phase.Dance) && frozen != null && frame != frozen)
            {
                frozen.Dispose();
                frozen = null;
            }
            Point at = Offstage ? new Point((int)Math.Round(anchor.X - offset.X), (int)Math.Round(anchor.Y - offset.Y)) : Place(area, size, anchor, offset);
            Present(frame, size, at, mirror, clip == null || !clip.Lazy);
        }

        private void Step(bool playing, double now, string character, string requested, PointF perch, float floor, double minX, double maxX,
            Clip sitLeave, Clip arrive, Clip leave, Clip sitArrive, int figure, double dt, Clip walk)
        {
            bool atPerch = phase == Phase.Sit || phase == Phase.SitArrive || phase == Phase.SitLeave;
            if (Offstage)
            {
                if (phase != Phase.Sit && phase != Phase.SitArrive) Enter(sitArrive != null ? Phase.SitArrive : Phase.Sit, now);
                else if (phase == Phase.SitArrive && (sitArrive == null || (now - phaseStarted) * 1000 >= sitArrive.Length)) Enter(Phase.Sit, now);
                facingLeft = false;
                anchor = perch;
                return;
            }
            if (anchor.IsEmpty)
            {
                walkX = Clamp(perch.X, minX, maxX);
                anchor = atPerch ? perch : new PointF((float)walkX, floor);
            }
            if (playing && (phase == Phase.Sit || phase == Phase.SitArrive))
            {
                walkX = Clamp(perch.X, minX, maxX);
                Enter(sitLeave != null ? Phase.SitLeave : Offstage ? Phase.Away : Phase.Arrive, now);
                origin = anchor;
            }
            else if (playing && Offstage && (phase == Phase.Arrive || phase == Phase.Walk || phase == Phase.Dance || phase == Phase.Leave))
            {
                Enter(Phase.Away, now);
            }
            else if (playing && !Offstage && phase == Phase.Away)
            {
                walkX = Clamp(perch.X, minX, maxX);
                origin = perch;
                Enter(Phase.Arrive, now);
            }
            else if (!playing && phase == Phase.Away)
            {
                Enter(sitArrive != null ? Phase.SitArrive : Phase.Sit, now);
            }
            else if (playing && phase == Phase.Leave)
            {
                Enter(Phase.Arrive, now);
                origin = anchor;
            }
            else if (!playing && (phase == Phase.Walk || phase == Phase.Dance || phase == Phase.Arrive))
            {
                if (frozen != null) frozen.Dispose();
                frozen = lastFrame == null ? null : new Bitmap(lastFrame);
                Enter(Phase.Leave, now);
                origin = anchor;
            }
            else if (!playing && phase == Phase.SitLeave)
            {
                Enter(Phase.SitArrive, now);
            }

            double elapsed = now - phaseStarted;
            switch (phase)
            {
                case Phase.Sit:
                    anchor = perch;
                    break;
                case Phase.SitLeave:
                    anchor = perch;
                    if (sitLeave == null || elapsed * 1000 >= sitLeave.Length) Enter(Offstage ? Phase.Away : Phase.Arrive, now);
                    break;
                case Phase.Arrive:
                    if (arrive != null)
                    {
                        anchor = new PointF((float)walkX, floor);
                        if (elapsed * 1000 >= arrive.Length) StartDance(character, requested, now);
                    }
                    else
                    {
                        PointF start = origin.IsEmpty ? perch : origin;
                        anchor = Lerp(start, new PointF((float)walkX, floor), Ease(Math.Min(1, elapsed / DropSeconds)));
                        if (elapsed >= DropSeconds) StartDance(character, requested, now);
                    }
                    break;
                case Phase.Dance:
                    walkX = Clamp(walkX, minX, maxX);
                    anchor = new PointF((float)walkX, floor);
                    if (requested == null && now >= danceEnds) StartWalk(minX, maxX, now);
                    break;
                case Phase.Walk:
                    {
                        double step = figure * WalkPerSecond * dt;
                        double gap = targetX - walkX;
                        facingLeft = gap < 0;
                        if (Math.Abs(gap) <= step)
                        {
                            walkX = targetX;
                            if (requested == null) PickDance(character, now);
                            StartDance(character, requested, now);
                        }
                        else walkX += Math.Sign(gap) * step;
                        anchor = new PointF((float)Clamp(walkX, minX, maxX), floor);
                    }
                    break;
                case Phase.Leave:
                    if (leave != null)
                    {
                        if (elapsed * 1000 >= leave.Length) Enter(sitArrive != null ? Phase.SitArrive : Phase.Sit, now);
                    }
                    else
                    {
                        anchor = Lerp(origin, perch, Ease(Math.Min(1, elapsed / ReturnSeconds)));
                        if (elapsed >= ReturnSeconds) Enter(sitArrive != null ? Phase.SitArrive : Phase.Sit, now);
                    }
                    break;
                case Phase.Away:
                    anchor = perch;
                    break;
                case Phase.SitArrive:
                    anchor = perch;
                    if (sitArrive == null || elapsed * 1000 >= sitArrive.Length) Enter(Phase.Sit, now);
                    break;
            }
        }

        private void Enter(Phase next, double now)
        {
            phase = next;
            phaseStarted = now;
        }

        private void StartDance(string character, string requested, double now)
        {
            Enter(Phase.Dance, now);
            Clip clip = GetClip(character, dance);
            int loops = requested == null ? random.Next(1, MaxLoops + 1) : 1;
            danceEnds = clip == null ? now + 3 : now + clip.Length / 1000.0 * loops;
        }

        private void StartWalk(double minX, double maxX, double now)
        {
            double span = maxX - minX;
            double next = minX + random.NextDouble() * span;
            if (Math.Abs(next - walkX) < span * .2) next = walkX < minX + span / 2 ? walkX + span * .35 : walkX - span * .35;
            targetX = Clamp(next, minX, maxX);
            Enter(Phase.Walk, now);
        }

        private void PickDance(string character, double now)
        {
            var choices = new List<string>();
            foreach (string id in Discover(character)) if (id != dance && GetClip(character, id) != null) choices.Add(id);
            if (choices.Count == 0) choices.Add(dance ?? Dances[0]);
            dance = choices[random.Next(choices.Count)];
        }

        private double Unit(string character, int figure)
        {
            Clip reference = GetClip(character, "walk");
            if (reference == null || reference.Anchor == null)
                foreach (string id in Discover(character))
                {
                    Clip candidate = GetClip(character, id);
                    if (candidate != null && candidate.Anchor != null) { reference = candidate; break; }
                }
            return reference == null || reference.Anchor == null ? 0 : (double)figure / reference.Figure;
        }

        private static Size StandSize(Clip clip, int figure, double unit)
        {
            return Scale(clip.Size, clip.Anchor != null && unit > 0 ? unit : (double)figure / clip.Figure);
        }

        private static PointF StandOffset(Clip clip, Size size)
        {
            if (clip.Anchor == null) return new PointF(size.Width * .5f, size.Height);
            return new PointF((float)(clip.Anchor.X / clip.Size.Width * size.Width), (float)(clip.Anchor.Y / clip.Size.Height * size.Height));
        }

        private Clip Seat(string character)
        {
            return GetClip(character, "sit") ?? GetClip(character, "seat");
        }

        private void Present(Bitmap frame, Size size, Point at, bool mirror, bool cache)
        {
            if (lastFrame == frame && lastSize == size && lastMirror == mirror && window.Visible)
            {
                if (window.Location != at) window.Location = at;
                window.Raise();
                return;
            }
            if (scaledFor != size)
            {
                if (retired != null) retired.Dispose();
                retired = null;
                foreach (Dictionary<Bitmap, Bitmap> side in scaled)
                {
                    foreach (Bitmap old in side.Values)
                    {
                        if (old == window.Image) retired = old;
                        else old.Dispose();
                    }
                    side.Clear();
                }
                scaledFor = size;
            }
            Dictionary<Bitmap, Bitmap> store = scaled[mirror ? 1 : 0];
            Bitmap image;
            if (!cache || !store.TryGetValue(frame, out image))
            {
                image = new Bitmap(size.Width, size.Height, PixelFormat.Format32bppPArgb);
                using (Graphics graphics = Graphics.FromImage(image))
                {
                    graphics.CompositingMode = CompositingMode.SourceCopy;
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    if (mirror)
                    {
                        graphics.TranslateTransform(size.Width, 0);
                        graphics.ScaleTransform(-1, 1);
                    }
                    graphics.DrawImage(frame, new Rectangle(Point.Empty, size), 0, 0, frame.Width, frame.Height, GraphicsUnit.Pixel);
                }
                if (cache) store.Add(frame, image);
            }
            if (transient != null && transient != image) transient.Dispose();
            transient = cache ? null : image;
            window.Show(image, at);
            window.Raise();
            lastFrame = frame;
            lastSize = size;
            lastMirror = mirror;
        }

        private void Hide()
        {
            if (window.Visible) window.Hide();
            active = false;
            anchor = PointF.Empty;
        }

        internal static Point Place(Rectangle area, Size size, PointF anchor, PointF offset)
        {
            int left = (int)Math.Round(anchor.X - offset.X);
            int top = (int)Math.Round(anchor.Y - offset.Y);
            return new Point(Math.Max(area.Left, Math.Min(area.Right - size.Width, left)),
                Math.Max(area.Top, Math.Min(area.Bottom - size.Height, top)));
        }

        private static PointF Perch(Rectangle area, Rectangle plate, Clip seat, int figure, double unit, bool capri,
            out Size size, out PointF offset)
        {
            float x, y;
            if (seat.Anchor != null && unit > 0)
            {
                size = Scale(seat.Size, unit);
                x = (float)(seat.Anchor.X / seat.Size.Width);
                y = (float)(seat.Anchor.Y / seat.Size.Height);
            }
            else
            {
                x = capri ? .29f : .35f;
                y = capri ? .73f : .61f;
                int height = Math.Max(1, (int)(figure * SeatShare * seat.Size.Height / seat.Figure));
                size = FitSize(seat.Size, height, area.Width);
            }
            offset = new PointF(size.Width * x, size.Height * y);
            return new PointF(plate.Left + plate.Width * .72f, plate.Top + 2);
        }

        private static Size FitSize(Size source, int height, int maxWidth)
        {
            double scale = Math.Min((double)height / source.Height, (double)maxWidth / source.Width);
            return Scale(source, scale);
        }

        private static Size Scale(Size source, double scale)
        {
            return new Size(Math.Max(1, (int)Math.Round(source.Width * scale)), Math.Max(1, (int)Math.Round(source.Height * scale)));
        }

        private static double Clamp(double value, double min, double max) { return max < min ? min : Math.Max(min, Math.Min(max, value)); }

        private static double Ease(double progress) { return progress * progress * (3 - 2 * progress); }

        private static string CharacterId(string value) { return value == "capri" ? "capri" : "talia"; }

        private static string DanceId(string value) { return string.IsNullOrEmpty(value) || value != Path.GetFileName(value) ? Dances[0] : value; }

        private static PointF Lerp(PointF a, PointF b, double progress)
        {
            return new PointF((float)(a.X + (b.X - a.X) * progress), (float)(a.Y + (b.Y - a.Y) * progress));
        }

        private IEnumerable<string> Discover(string character)
        {
            List<string> found;
            if (discovered.TryGetValue(character, out found)) return found;
            found = new List<string>();
            try
            {
                foreach (string folder in Directory.GetDirectories(Path.Combine(directory, character)))
                {
                    string name = Path.GetFileName(folder);
                    if (!Reserved.Contains(name) && File.Exists(Path.Combine(folder, "frames.tsv"))) found.Add(name);
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            found.Sort(StringComparer.Ordinal);
            discovered[character] = found;
            return found;
        }

        private Clip GetClip(string character, string id)
        {
            string key = character + "/" + id;
            Clip clip;
            if (clips.TryGetValue(key, out clip)) return clip;
            if (unavailable.Contains(key)) return null;
            string folder = Path.Combine(directory, character);
            bool exists = id == "seat" ? File.Exists(Path.Combine(folder, "seat.png")) : File.Exists(Path.Combine(folder, id, "frames.tsv"));
            if (!exists)
            {
                unavailable.Add(key);
                return null;
            }
            try
            {
                clip = Clip.Load(folder, id);
                clips.Add(key, clip);
                return clip;
            }
            catch (IOException error) { Trace.WriteLine("Animation " + key + ": " + error.Message); }
            catch (ArgumentException error) { Trace.WriteLine("Animation " + key + ": " + error.Message); }
            unavailable.Add(key);
            return null;
        }

        public void Dispose()
        {
            window.Dispose();
            foreach (Dictionary<Bitmap, Bitmap> side in scaled)
            {
                foreach (Bitmap image in side.Values) image.Dispose();
                side.Clear();
            }
            if (retired != null) retired.Dispose();
            retired = null;
            if (transient != null) transient.Dispose();
            if (frozen != null) frozen.Dispose();
            foreach (Clip clip in clips.Values) clip.Dispose();
            clips.Clear();
        }

        private sealed class SpriteWindow : Overlay
        {
            internal SpriteWindow() : base("Companion animation") { ClickThrough = true; OwnsImage = false; }

            internal void Show(Bitmap image, Point at) { Present(image, at); }

            internal void Raise()
            {
                if (IsHandleCreated) Native.SetWindowPos(Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
            }

            protected override void WndProc(ref Message message)
            {
                if (message.Msg == 0x0084)
                {
                    message.Result = new IntPtr(-1);
                    return;
                }
                base.WndProc(ref message);
            }
        }

        internal sealed class Mark
        {
            internal string Kind;
            internal double X, Y;
        }

        private sealed class Clip : IDisposable
        {
            private const int EagerLimit = 40;
            private readonly List<string> order = new List<string>();
            private readonly List<int> ends = new List<int>();
            private readonly Dictionary<string, Bitmap> images = new Dictionary<string, Bitmap>();
            private readonly Dictionary<string, byte[]> packed = new Dictionary<string, byte[]>();
            private Bitmap first, current;
            private string currentKey;
            internal int Length;
            internal int Figure = 1;
            internal bool Lazy;
            internal Size Size;
            internal Mark Anchor;
            internal Bitmap First { get { return first; } }

            internal static Clip Load(string folder, string id)
            {
                var clip = new Clip();
                try
                {
                    var entries = new List<KeyValuePair<string, int>>();
                    if (id == "seat") entries.Add(new KeyValuePair<string, int>(Path.Combine(folder, "seat.png"), 1000));
                    else
                    {
                        folder = Path.Combine(folder, id);
                        foreach (string line in File.ReadLines(Path.Combine(folder, "frames.tsv")))
                        {
                            if (line.Length == 0) continue;
                            string[] parts = line.Split('\t');
                            int delay;
                            if (parts.Length != 2 || !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out delay)
                                || delay < 1 || parts[1] != Path.GetFileName(parts[1])) throw new IOException("Invalid frame manifest.");
                            entries.Add(new KeyValuePair<string, int>(Path.Combine(folder, parts[1]), delay));
                        }
                        clip.Anchor = ReadAnchor(Path.Combine(folder, "anchor.txt"));
                    }
                    if (entries.Count == 0) throw new IOException("Empty animation.");
                    var unique = new HashSet<string>();
                    foreach (var entry in entries) unique.Add(entry.Key);
                    clip.Lazy = unique.Count > EagerLimit;
                    foreach (var entry in entries) clip.Add(entry.Key, entry.Value);
                    clip.Measure(id != "seat" && !clip.Lazy && clip.Anchor == null);
                    return clip;
                }
                catch { clip.Dispose(); throw; }
            }

            private static Mark ReadAnchor(string path)
            {
                if (!File.Exists(path)) return null;
                string[] parts = File.ReadAllText(path).Trim().Split(' ');
                double x, y;
                if (parts.Length != 3 || (parts[0] != "hip" && parts[0] != "feet")
                    || !double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out x)
                    || !double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out y))
                    throw new IOException("Invalid anchor file " + path);
                return new Mark { Kind = parts[0], X = x, Y = y };
            }

            private void Add(string path, int delay)
            {
                if (Lazy)
                {
                    if (!packed.ContainsKey(path)) packed.Add(path, File.ReadAllBytes(path));
                }
                else if (!images.ContainsKey(path))
                {
                    using (var original = new Bitmap(path)) images.Add(path, new Bitmap(original));
                }
                order.Add(path);
                Length += delay;
                ends.Add(Length);
            }

            private Bitmap Decode(string key)
            {
                using (var stream = new MemoryStream(packed[key]))
                using (var original = new Bitmap(stream)) return new Bitmap(original);
            }

            private void Measure(bool crop)
            {
                var heights = new List<int>();
                Rectangle union = Rectangle.Empty;
                var keys = Lazy ? new List<string>(packed.Keys) : new List<string>(images.Keys);
                int step = Lazy ? Math.Max(1, keys.Count / 12) : 1;
                for (int i = 0; i < keys.Count; i += step)
                {
                    Bitmap bitmap = Lazy ? Decode(keys[i]) : images[keys[i]];
                    try
                    {
                        Rectangle box = Opaque(bitmap);
                        if (box.IsEmpty) continue;
                        union = union.IsEmpty ? box : Rectangle.Union(union, box);
                        heights.Add(box.Height);
                    }
                    finally { if (Lazy) bitmap.Dispose(); }
                }
                if (heights.Count == 0) throw new IOException("Animation has no visible pixels.");
                heights.Sort();
                Figure = Math.Max(1, heights[Math.Min(heights.Count - 1, (int)(heights.Count * .85))]);
                if (crop)
                {
                    foreach (string key in keys)
                    {
                        Bitmap source = images[key];
                        images[key] = source.Clone(union, PixelFormat.Format32bppArgb);
                        source.Dispose();
                    }
                }
                first = Lazy ? Decode(order[0]) : images[order[0]];
                Size = first.Size;
            }

            private static Rectangle Opaque(Bitmap bitmap)
            {
                var whole = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
                BitmapData data = bitmap.LockBits(whole, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                try
                {
                    int stride = data.Stride, width = bitmap.Width, height = bitmap.Height;
                    var row = new byte[stride];
                    int left = width, right = -1, top = height, bottom = -1;
                    for (int y = 0; y < height; y++)
                    {
                        System.Runtime.InteropServices.Marshal.Copy(data.Scan0 + y * stride, row, 0, stride);
                        for (int x = 0; x < width; x++)
                        {
                            if (row[x * 4 + 3] <= 40) continue;
                            if (x < left) left = x;
                            if (x > right) right = x;
                            if (y < top) top = y;
                            bottom = y;
                        }
                    }
                    return right < 0 ? Rectangle.Empty : Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
                }
                finally { bitmap.UnlockBits(data); }
            }

            internal Bitmap FrameAt(double milliseconds)
            {
                return Frame(Index(milliseconds % Length));
            }

            internal Bitmap FrameOnce(double milliseconds)
            {
                return Frame(milliseconds >= Length ? ends.Count - 1 : Index(Math.Max(0, milliseconds)));
            }

            private int Index(double within)
            {
                for (int i = 0; i < ends.Count; i++) if (within < ends[i]) return i;
                return ends.Count - 1;
            }

            private Bitmap Frame(int index)
            {
                string key = order[index];
                if (!Lazy) return images[key];
                if (key == order[0]) return first;
                if (key != currentKey)
                {
                    if (current != null) current.Dispose();
                    current = Decode(key);
                    currentKey = key;
                }
                return current;
            }

            public void Dispose()
            {
                foreach (Bitmap bitmap in images.Values) bitmap.Dispose();
                images.Clear();
                if (Lazy && first != null) first.Dispose();
                if (current != null) current.Dispose();
                first = current = null;
            }
        }
    }
}
