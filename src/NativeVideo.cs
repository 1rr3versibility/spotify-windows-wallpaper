using System;
using System.Runtime.InteropServices;

namespace CapriDesktop
{
    internal static class ComCall
    {
        internal delegate int QueryInterfaceFn(IntPtr self, ref Guid iid, out IntPtr result);
        internal delegate uint ReleaseFn(IntPtr self);

        internal static T Method<T>(IntPtr instance, int index) where T : class
        {
            IntPtr table = Marshal.ReadIntPtr(instance);
            return (T)(object)Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(table, index * IntPtr.Size), typeof(T));
        }

        internal static void Check(int hr, string what)
        {
            if (hr < 0) throw new InvalidOperationException(what + " вернул 0x" + hr.ToString("X8"));
        }

        internal static void Release(IntPtr instance)
        {
            if (instance != IntPtr.Zero) Method<ReleaseFn>(instance, 2)(instance);
        }

        internal static IntPtr Query(IntPtr instance, Guid iid, string what)
        {
            IntPtr result;
            Check(Method<QueryInterfaceFn>(instance, 0)(instance, ref iid, out result), what);
            return result;
        }
    }

    [ComImport, Guid("fee7c112-e776-42b5-9bbf-0048524e2bd5"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMFMediaEngineNotify
    {
        [PreserveSig] int EventNotify(uint eventCode, IntPtr param1, uint param2);
    }

    internal sealed class NativeVideo : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct SwapChainDesc1
        {
            public uint Width, Height;
            public int Format, Stereo;
            public uint SampleCount, SampleQuality, BufferUsage, BufferCount;
            public int Scaling, SwapEffect, AlphaMode;
            public uint Flags;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Rect { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        private struct Argb { public byte Blue, Green, Red, Alpha; }

        [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
        private sealed class Notify : IMFMediaEngineNotify
        {
            private readonly NativeVideo owner;
            internal Notify(NativeVideo owner) { this.owner = owner; }
            public int EventNotify(uint eventCode, IntPtr param1, uint param2)
            {
                try { owner.OnEvent(eventCode, param1.ToInt64(), param2); }
                catch (Exception error) { Journal.Write("Видеообложка: событие движка", error); }
                return 0;
            }
        }

        [DllImport("mfplat.dll")] private static extern int MFStartup(uint version, uint flags);
        [DllImport("mfplat.dll")] private static extern int MFShutdown();
        [DllImport("mfplat.dll")] private static extern int MFCreateAttributes(out IntPtr attributes, uint size);
        [DllImport("mfplat.dll")] private static extern int MFCreateDXGIDeviceManager(out uint token, out IntPtr manager);
        [DllImport("ole32.dll")] private static extern int CoCreateInstance(ref Guid clsid, IntPtr outer, uint context, ref Guid iid, out IntPtr result);

        private delegate int SetUnknownFn(IntPtr self, ref Guid key, IntPtr value);
        private delegate int SetUint32Fn(IntPtr self, ref Guid key, uint value);
        private delegate int ResetDeviceFn(IntPtr self, IntPtr device, uint token);
        private delegate int CreateEngineFn(IntPtr self, uint flags, IntPtr attributes, out IntPtr engine);
        private delegate int SetSourceFn(IntPtr self, IntPtr url);
        private delegate int NoArgFn(IntPtr self);
        private delegate int SetBoolFn(IntPtr self, int value);
        private delegate int GetSizeFn(IntPtr self, out uint width, out uint height);
        private delegate int TransferFn(IntPtr self, IntPtr surface, IntPtr source, ref Rect target, ref Argb border);
        private delegate int TickFn(IntPtr self, out long time);
        private delegate int CreateSwapChainFn(IntPtr self, IntPtr device, ref SwapChainDesc1 desc, IntPtr restrict, out IntPtr swapChain);
        private delegate int GetBufferFn(IntPtr self, uint index, ref Guid iid, out IntPtr surface);
        private delegate int PresentFn(IntPtr self, uint sync, uint flags);
        private delegate int GetOutFn(IntPtr self, out IntPtr result);
        private delegate int SetPointerFn(IntPtr self, IntPtr value);
        private delegate int SetFloatFn(IntPtr self, float value);
        private delegate int AddVisualFn(IntPtr self, IntPtr visual, int above, IntPtr reference);

        private static readonly Guid ClassFactoryClsid = new Guid("b44392da-499b-446b-a4cb-005fead0e6d5");
        private static readonly Guid ClassFactoryIid = new Guid("4d645ace-26aa-4688-9be1-df3516990b93");
        private static readonly Guid CallbackKey = new Guid("c60381b8-83a4-41f8-a3d0-de05076849a9");
        private static readonly Guid DxgiManagerKey = new Guid("065702da-1094-486d-8617-ee7cc4ee4648");
        private static readonly Guid OutputFormatKey = new Guid("5066893c-8cf9-42bc-8b8a-472212e52726");
        private static readonly Guid NotifyIid = new Guid("fee7c112-e776-42b5-9bbf-0048524e2bd5");
        private static readonly Guid Texture2DId = new Guid("6f15aaf2-d208-4e89-9ab4-489535d34f9c");

        private readonly IntPtr device, factory, composition, visual;
        private readonly Action<string, int, int> shown;
        private readonly Action<string, string> failed;
        private readonly Notify notify;
        private IntPtr manager, engine, clip, swapChain, backBuffer;
        private bool started, visible, presented;
        private string source, requested;
        private int videoWidth, videoHeight;
        private volatile int metaWidth, metaHeight;
        private volatile string metaFor, errorFor, errorText;
        private float lastX = float.NaN, lastY, lastW, lastH, lastR;
        private bool engineRunning;

        internal NativeVideo(IntPtr device, IntPtr factory, IntPtr composition, IntPtr parent, Action<string, int, int> shown, Action<string, string> failed)
        {
            this.device = device;
            this.factory = factory;
            this.composition = composition;
            this.shown = shown;
            this.failed = failed;
            notify = new Notify(this);
            IntPtr created;
            ComCall.Check(ComCall.Method<GetOutFn>(composition, 7)(composition, out created), "CreateVisual (видео)");
            visual = created;
            ComCall.Check(ComCall.Method<AddVisualFn>(parent, 16)(parent, visual, 0, IntPtr.Zero), "AddVisual (видео)");
            ComCall.Check(ComCall.Method<GetOutFn>(composition, 24)(composition, out clip), "CreateRectangleClip");
            ComCall.Check(ComCall.Method<SetPointerFn>(visual, 13)(visual, clip), "SetClipObject");
        }

        private void Start()
        {
            if (started) return;
            started = true;
            ComCall.Check(MFStartup(0x00020070, 0), "MFStartup");
            uint token;
            ComCall.Check(MFCreateDXGIDeviceManager(out token, out manager), "MFCreateDXGIDeviceManager");
            ComCall.Check(ComCall.Method<ResetDeviceFn>(manager, 7)(manager, device, token), "ResetDevice");
            IntPtr attributes;
            ComCall.Check(MFCreateAttributes(out attributes, 3), "MFCreateAttributes");
            IntPtr callback = Marshal.GetComInterfaceForObject(notify, typeof(IMFMediaEngineNotify));
            IntPtr classFactory = IntPtr.Zero;
            try
            {
                Guid key = CallbackKey;
                ComCall.Check(ComCall.Method<SetUnknownFn>(attributes, 27)(attributes, ref key, callback), "SetUnknown(callback)");
                key = DxgiManagerKey;
                ComCall.Check(ComCall.Method<SetUnknownFn>(attributes, 27)(attributes, ref key, manager), "SetUnknown(dxgi)");
                key = OutputFormatKey;
                ComCall.Check(ComCall.Method<SetUint32Fn>(attributes, 21)(attributes, ref key, 87), "SetUINT32(format)");
                Guid clsid = ClassFactoryClsid, iid = ClassFactoryIid;
                ComCall.Check(CoCreateInstance(ref clsid, IntPtr.Zero, 1, ref iid, out classFactory), "CoCreateInstance(MFMediaEngineClassFactory)");
                ComCall.Check(ComCall.Method<CreateEngineFn>(classFactory, 3)(classFactory, 0x4, attributes, out engine), "CreateInstance(MediaEngine)");
            }
            finally
            {
                ComCall.Release(classFactory);
                ComCall.Release(attributes);
                Marshal.Release(callback);
            }
            ComCall.Check(ComCall.Method<SetBoolFn>(engine, 35)(engine, 1), "SetMuted");
            ComCall.Check(ComCall.Method<SetBoolFn>(engine, 31)(engine, 1), "SetLoop");
            ComCall.Check(ComCall.Method<SetBoolFn>(engine, 29)(engine, 1), "SetAutoPlay");
        }

        private void OnEvent(uint code, long param1, uint param2)
        {
            string current = requested;
            if (code == 10 && engine != IntPtr.Zero)
            {
                uint w, h;
                if (ComCall.Method<GetSizeFn>(engine, 40)(engine, out w, out h) >= 0 && w > 0 && h > 0)
                {
                    metaWidth = (int)w;
                    metaHeight = (int)h;
                    metaFor = current;
                }
            }
            else if (code == 5)
            {
                errorText = "ошибка движка " + param1 + ", HRESULT 0x" + param2.ToString("X8");
                errorFor = current;
            }
        }

        internal bool Update(string url, float x, float y, float w, float h, float radius, bool paused)
        {
            bool commit = false;
            if (url != requested)
            {
                requested = url;
                presented = false;
                commit |= Hide();
                if (url == null)
                {
                    if (engineRunning) { ComCall.Method<NoArgFn>(engine, 33)(engine); engineRunning = false; }
                }
                else
                {
                    try
                    {
                        Start();
                        IntPtr bstr = Marshal.StringToBSTR(url);
                        try { ComCall.Check(ComCall.Method<SetSourceFn>(engine, 6)(engine, bstr), "SetSource"); }
                        finally { Marshal.FreeBSTR(bstr); }
                        ComCall.Check(ComCall.Method<NoArgFn>(engine, 32)(engine), "Play");
                        engineRunning = true;
                        source = url;
                    }
                    catch (Exception error)
                    {
                        Journal.Write("Видеообложка через Media Foundation", error);
                        failed(url, error.Message);
                        source = null;
                    }
                }
            }
            if (requested == null || source != requested) return commit;

            string broken = errorFor;
            if (broken != null && broken == requested)
            {
                errorFor = null;
                Journal.Write("Видеообложка через Media Foundation", new InvalidOperationException(errorText + " для " + requested));
                failed(requested, errorText);
                source = null;
                return commit | Hide();
            }

            if (metaFor == requested && (metaWidth != videoWidth || metaHeight != videoHeight || swapChain == IntPtr.Zero))
            {
                videoWidth = metaWidth;
                videoHeight = metaHeight;
                CreateSwapChain();
                lastX = float.NaN;
            }
            if (swapChain == IntPtr.Zero) return commit;

            if (paused != !engineRunning)
            {
                ComCall.Method<NoArgFn>(engine, paused ? 33 : 32)(engine);
                engineRunning = !paused;
            }

            bool place = w >= 2f && h >= 2f;
            if (!place) return commit | Hide();

            long time;
            if (ComCall.Method<TickFn>(engine, 44)(engine, out time) == 0)
            {
                var target = new Rect { Right = videoWidth, Bottom = videoHeight };
                var border = new Argb { Alpha = 255 };
                if (ComCall.Method<TransferFn>(engine, 43)(engine, backBuffer, IntPtr.Zero, ref target, ref border) >= 0)
                {
                    ComCall.Method<PresentFn>(swapChain, 8)(swapChain, 0, 0);
                    if (!presented)
                    {
                        presented = true;
                        shown(requested, videoWidth, videoHeight);
                    }
                }
            }
            if (!presented) return commit;

            if (!visible)
            {
                ComCall.Check(ComCall.Method<SetPointerFn>(visual, 15)(visual, swapChain), "SetContent (видео)");
                visible = true;
                commit = true;
            }
            if (x != lastX || y != lastY || w != lastW || h != lastH || radius != lastR)
            {
                lastX = x; lastY = y; lastW = w; lastH = h; lastR = radius;
                float sx = w / videoWidth, sy = h / videoHeight;
                var matrix = new float[] { sx, 0f, 0f, sy, x, y };
                var held = GCHandle.Alloc(matrix, GCHandleType.Pinned);
                try { ComCall.Check(ComCall.Method<SetPointerFn>(visual, 8)(visual, held.AddrOfPinnedObject()), "SetTransform (видео)"); }
                finally { held.Free(); }
                var setFloat = new Func<int, float, int>((index, value) => ComCall.Method<SetFloatFn>(clip, index)(clip, value));
                setFloat(4, 0f); setFloat(6, 0f); setFloat(8, videoWidth); setFloat(10, videoHeight);
                float rx = radius / sx, ry = radius / sy;
                for (int i = 12; i <= 26; i += 4) { setFloat(i, rx); setFloat(i + 2, ry); }
                commit = true;
            }
            return commit;
        }

        private bool Hide()
        {
            if (!visible) return false;
            ComCall.Method<SetPointerFn>(visual, 15)(visual, IntPtr.Zero);
            visible = false;
            return true;
        }

        private void CreateSwapChain()
        {
            Hide();
            ComCall.Release(backBuffer);
            ComCall.Release(swapChain);
            backBuffer = swapChain = IntPtr.Zero;
            var desc = new SwapChainDesc1
            {
                Width = (uint)videoWidth, Height = (uint)videoHeight, Format = 87, SampleCount = 1, BufferUsage = 0x20, BufferCount = 2,
                Scaling = 0, SwapEffect = 3, AlphaMode = 3
            };
            ComCall.Check(ComCall.Method<CreateSwapChainFn>(factory, 24)(factory, device, ref desc, IntPtr.Zero, out swapChain), "CreateSwapChainForComposition (видео)");
            Guid id = Texture2DId;
            ComCall.Check(ComCall.Method<GetBufferFn>(swapChain, 9)(swapChain, 0, ref id, out backBuffer), "GetBuffer (видео)");
        }

        public void Dispose()
        {
            if (engine != IntPtr.Zero)
            {
                ComCall.Method<NoArgFn>(engine, 42)(engine);
                ComCall.Release(engine);
                engine = IntPtr.Zero;
            }
            ComCall.Release(backBuffer);
            ComCall.Release(swapChain);
            ComCall.Release(clip);
            ComCall.Release(visual);
            ComCall.Release(manager);
            if (started) MFShutdown();
        }
    }
}
