using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace CapriDesktop
{
    internal sealed class AudioPulse : IDisposable
    {
        internal struct Beat
        {
            internal float Bass, Mid, High, Level;
            internal bool Hit;
        }

        private const int Size = 1024;
        private const int FrameMs = 33;
        private const int LoopbackFlag = 0x00020000;
        private const int DeviceInvalidated = unchecked((int)0x88890004);

        private readonly Action<Beat> listener;
        private readonly float[] ring = new float[Size];
        private readonly float[] window = new float[Size];
        private readonly float[] re = new float[Size], im = new float[Size];
        private Thread worker;
        private volatile bool stopping;
        private int written, sampleRate = 48000;
        private float bassPeak = 1e-4f, midPeak = 1e-4f, highPeak = 1e-4f, levelPeak = 1e-4f, bassAverage, lastBass;
        private float bassOut, midOut, highOut, levelOut;
        private DateTime lastHit = DateTime.MinValue;

        internal AudioPulse(Action<Beat> listener)
        {
            this.listener = listener;
            for (int i = 0; i < Size; i++) window[i] = (float)(0.5 - 0.5 * Math.Cos(2 * Math.PI * i / (Size - 1)));
        }

        internal void Start()
        {
            if (worker != null) return;
            worker = new Thread(Run) { IsBackground = true, Name = "Audio pulse" };
            worker.SetApartmentState(ApartmentState.MTA);
            worker.Start();
        }

        public void Dispose()
        {
            stopping = true;
            Thread running = worker;
            if (running != null && running != Thread.CurrentThread) running.Join(1500);
        }

        private void Run()
        {
            while (!stopping)
            {
                try { Capture(); }
                catch (Exception error)
                {
                    if (stopping) return;
                    var com = error as COMException;
                    if (com == null || com.ErrorCode != DeviceInvalidated) Journal.Write("Звук для пульсации обоев", error);
                    Silence();
                    Thread.Sleep(2000);
                }
            }
        }

        private void Capture()
        {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice device;
            Check(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
            string deviceId;
            Check(device.GetId(out deviceId));
            Guid clientId = typeof(IAudioClient).GUID;
            object activated;
            Check(device.Activate(ref clientId, 23, IntPtr.Zero, out activated));
            var client = (IAudioClient)activated;
            IntPtr format;
            Check(client.GetMixFormat(out format));
            int channels, bits;
            bool isFloat;
            try
            {
                int tag = Marshal.ReadInt16(format, 0) & 0xFFFF;
                channels = Marshal.ReadInt16(format, 2);
                bits = Marshal.ReadInt16(format, 14);
                sampleRate = Marshal.ReadInt32(format, 4);
                isFloat = tag == 3 || (tag == 0xFFFE && Marshal.ReadInt32(format, 24) == 3);
                Check(client.Initialize(0, LoopbackFlag, 2000000, 0, format, IntPtr.Zero));
            }
            finally { Marshal.FreeCoTaskMem(format); }
            if (!(isFloat && bits == 32) && !(!isFloat && bits == 16))
                throw new NotSupportedException("Формат звука системы не поддержан: " + bits + " бит" + (isFloat ? " float" : ""));

            Guid captureId = typeof(IAudioCaptureClient).GUID;
            object service;
            Check(client.GetService(ref captureId, out service));
            var capture = (IAudioCaptureClient)service;
            Check(client.Start());
            try
            {
                DateTime nextFrame = DateTime.UtcNow, nextDeviceCheck = DateTime.UtcNow.AddSeconds(3);
                while (!stopping)
                {
                    int packet;
                    Check(capture.GetNextPacketSize(out packet));
                    while (packet > 0)
                    {
                        IntPtr data;
                        int frames, flags;
                        long position, counter;
                        Check(capture.GetBuffer(out data, out frames, out flags, out position, out counter));
                        Take(data, frames, channels, isFloat, (flags & 2) != 0);
                        Check(capture.ReleaseBuffer(frames));
                        Check(capture.GetNextPacketSize(out packet));
                    }
                    DateTime now = DateTime.UtcNow;
                    if (now >= nextFrame)
                    {
                        nextFrame = now.AddMilliseconds(FrameMs);
                        Analyse(now);
                    }
                    if (now >= nextDeviceCheck)
                    {
                        nextDeviceCheck = now.AddSeconds(3);
                        IMMDevice current;
                        string currentId;
                        if (enumerator.GetDefaultAudioEndpoint(0, 1, out current) == 0 && current.GetId(out currentId) == 0 && currentId != deviceId) return;
                    }
                    Thread.Sleep(8);
                }
            }
            finally
            {
                client.Stop();
                Marshal.ReleaseComObject(capture);
                Marshal.ReleaseComObject(client);
                Marshal.ReleaseComObject(device);
                Marshal.ReleaseComObject(enumerator);
            }
        }

        private void Take(IntPtr data, int frames, int channels, bool isFloat, bool silent)
        {
            for (int f = 0; f < frames; f++)
            {
                float sum = 0;
                if (!silent)
                    for (int c = 0; c < channels; c++)
                        sum += isFloat
                            ? BitConverter.ToSingle(BitConverter.GetBytes(Marshal.ReadInt32(data, (f * channels + c) * 4)), 0)
                            : Marshal.ReadInt16(data, (f * channels + c) * 2) / 32768f;
                ring[written] = sum / channels;
                written = (written + 1) % Size;
            }
        }

        private void Analyse(DateTime now)
        {
            for (int i = 0; i < Size; i++)
            {
                re[i] = ring[(written + i) % Size] * window[i];
                im[i] = 0;
            }
            Fft(re, im);
            float binHz = (float)sampleRate / Size;
            float bass = Band(30, 150, binHz), mid = Band(150, 2000, binHz), high = Band(2000, 12000, binHz);
            float level = bass * .5f + mid * .35f + high * .15f;

            bassPeak = Math.Max(bass, bassPeak * .9985f);
            midPeak = Math.Max(mid, midPeak * .9985f);
            highPeak = Math.Max(high, highPeak * .9985f);
            levelPeak = Math.Max(level, levelPeak * .9985f);
            bool quiet = level < 2e-4f;
            float b = quiet ? 0 : bass / bassPeak, m = quiet ? 0 : mid / midPeak, h = quiet ? 0 : high / highPeak, l = quiet ? 0 : level / levelPeak;

            bassOut = Smooth(bassOut, b, .55f, .12f);
            midOut = Smooth(midOut, m, .4f, .1f);
            highOut = Smooth(highOut, h, .45f, .12f);
            levelOut = Smooth(levelOut, l, .3f, .05f);

            bool hit = false;
            float rise = b - lastBass;
            if (!quiet && b > .55f && b > bassAverage * 1.3f && rise > .12f && (now - lastHit).TotalMilliseconds > 280)
            {
                hit = true;
                lastHit = now;
            }
            bassAverage = bassAverage * .93f + b * .07f;
            lastBass = b;
            listener(new Beat { Bass = bassOut, Mid = midOut, High = highOut, Level = levelOut, Hit = hit });
        }

        private void Silence()
        {
            bassOut = midOut = highOut = levelOut = 0;
            listener(new Beat());
        }

        private static float Smooth(float current, float target, float attack, float release)
        {
            return current + (target - current) * (target > current ? attack : release);
        }

        private float Band(float fromHz, float toHz, float binHz)
        {
            int from = Math.Max(1, (int)(fromHz / binHz)), to = Math.Min(Size / 2 - 1, (int)(toHz / binHz));
            double sum = 0;
            for (int i = from; i <= to; i++) sum += re[i] * re[i] + im[i] * im[i];
            return (float)Math.Sqrt(sum / (to - from + 1)) / Size;
        }

        private static void Fft(float[] real, float[] imag)
        {
            int n = real.Length;
            for (int i = 1, j = 0; i < n; i++)
            {
                int bit = n >> 1;
                for (; (j & bit) != 0; bit >>= 1) j ^= bit;
                j ^= bit;
                if (i < j)
                {
                    float t = real[i]; real[i] = real[j]; real[j] = t;
                    t = imag[i]; imag[i] = imag[j]; imag[j] = t;
                }
            }
            for (int length = 2; length <= n; length <<= 1)
            {
                double angle = -2 * Math.PI / length;
                float wr = (float)Math.Cos(angle), wi = (float)Math.Sin(angle);
                for (int i = 0; i < n; i += length)
                {
                    float cr = 1, ci = 0;
                    for (int k = 0; k < length / 2; k++)
                    {
                        int a = i + k, b = a + length / 2;
                        float tr = real[b] * cr - imag[b] * ci, ti = real[b] * ci + imag[b] * cr;
                        real[b] = real[a] - tr; imag[b] = imag[a] - ti;
                        real[a] += tr; imag[a] += ti;
                        float next = cr * wr - ci * wi;
                        ci = cr * wi + ci * wr;
                        cr = next;
                    }
                }
            }
        }

        private static void Check(int result)
        {
            if (result < 0) Marshal.ThrowExceptionForHR(result);
        }

        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        private class MMDeviceEnumerator { }

        [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
            [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        }

        [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            [PreserveSig] int Activate(ref Guid iid, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
            [PreserveSig] int OpenPropertyStore(int access, out IntPtr store);
            [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        }

        [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioClient
        {
            [PreserveSig] int Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr session);
            [PreserveSig] int GetBufferSize(out int frames);
            [PreserveSig] int GetStreamLatency(out long latency);
            [PreserveSig] int GetCurrentPadding(out int frames);
            [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
            [PreserveSig] int GetMixFormat(out IntPtr format);
            [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
            [PreserveSig] int Start();
            [PreserveSig] int Stop();
            [PreserveSig] int Reset();
            [PreserveSig] int SetEventHandle(IntPtr handle);
            [PreserveSig] int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
        }

        [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioCaptureClient
        {
            [PreserveSig] int GetBuffer(out IntPtr data, out int frames, out int flags, out long position, out long counter);
            [PreserveSig] int ReleaseBuffer(int frames);
            [PreserveSig] int GetNextPacketSize(out int frames);
        }
    }
}
