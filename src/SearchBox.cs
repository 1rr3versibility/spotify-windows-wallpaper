using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace CapriDesktop
{
    internal sealed class SearchBox : Form
    {
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, IntPtr process);
        [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint from, uint to, bool attach);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);

        private readonly TextBox input = new TextBox();
        private readonly Timer settle = new Timer { Interval = 350 };
        private readonly Action<string> changed;
        private readonly Action closed;
        private bool done;

        internal SearchBox(Rectangle place, string text, Action<string> changed, Action closed)
        {
            this.changed = changed;
            this.closed = closed;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(28, 29, 40);
            Bounds = place;
            Padding = new Padding(Math.Max(10, place.Height / 3), 0, Math.Max(10, place.Height / 3), 0);
            input.BorderStyle = BorderStyle.None;
            input.BackColor = BackColor;
            input.ForeColor = Color.FromArgb(247, 242, 250);
            float size = Math.Max(10f, place.Height * .34f);
            input.Font = Skin.Capri ? Look.Mono(size, FontStyle.Regular, GraphicsUnit.Pixel) : new Font("Segoe UI", size, FontStyle.Regular, GraphicsUnit.Pixel);
            input.Text = text ?? "";
            input.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(input);
            Layout += delegate { input.SetBounds(Padding.Left, (ClientSize.Height - input.PreferredHeight) / 2, ClientSize.Width - Padding.Horizontal, input.PreferredHeight); };
            input.TextChanged += delegate { settle.Stop(); settle.Start(); };
            settle.Tick += delegate { settle.Stop(); changed(input.Text.Trim()); };
            input.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; settle.Stop(); changed(input.Text.Trim()); Finish(); }
                else if (e.KeyCode == Keys.Escape) { e.SuppressKeyPress = true; Finish(); }
            };
            Deactivate += delegate { Finish(); };
            using (var path = new System.Drawing.Drawing2D.GraphicsPath())
            {
                int r = place.Height;
                path.AddArc(0, 0, r, r, 90, 180);
                path.AddArc(place.Width - r, 0, r, r, 270, 180);
                path.CloseFigure();
                Region = new Region(path);
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            IntPtr front = GetForegroundWindow();
            uint frontThread = front == IntPtr.Zero ? 0 : GetWindowThreadProcessId(front, IntPtr.Zero), mine = GetCurrentThreadId();
            bool attached = frontThread != 0 && frontThread != mine && AttachThreadInput(mine, frontThread, true);
            try
            {
                BringWindowToTop(Handle);
                SetForegroundWindow(Handle);
                Activate();
            }
            finally { if (attached) AttachThreadInput(mine, frontThread, false); }
            input.Focus();
            input.SelectionStart = input.Text.Length;
        }

        private void Finish()
        {
            if (done) return;
            done = true;
            settle.Stop();
            closed();
            BeginInvoke((Action)Close);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) settle.Dispose();
            base.Dispose(disposing);
        }
    }
}
