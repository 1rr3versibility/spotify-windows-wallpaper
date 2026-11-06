using System;
using System.Runtime.InteropServices;
using System.Text;

namespace CapriDesktop
{
    internal sealed class FxPipeline : IDisposable
    {
        internal const int ConstantFloats = 48;
        private const uint CompileFlags = 1u << 15;

        [StructLayout(LayoutKind.Sequential)]
        private struct BufferDesc
        {
            public uint ByteWidth;
            public int Usage;
            public uint BindFlags, CpuAccessFlags, MiscFlags, StructureByteStride;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Viewport { public float X, Y, Width, Height, MinDepth, MaxDepth; }

        [DllImport("d3dcompiler_47.dll")]
        private static extern int D3DCompile(byte[] source, IntPtr size, [MarshalAs(UnmanagedType.LPStr)] string name, IntPtr defines, IntPtr include,
            [MarshalAs(UnmanagedType.LPStr)] string entry, [MarshalAs(UnmanagedType.LPStr)] string target, uint flags1, uint flags2, out IntPtr code, out IntPtr errors);

        private delegate IntPtr BlobFn(IntPtr self);
        private delegate int CreateShaderFn(IntPtr self, IntPtr code, IntPtr size, IntPtr linkage, out IntPtr shader);
        private delegate int CreateBufferFn(IntPtr self, ref BufferDesc desc, IntPtr initial, out IntPtr buffer);
        private delegate void SetShaderFn(IntPtr self, IntPtr shader, IntPtr instances, uint count);
        private delegate void SetBuffersFn(IntPtr self, uint start, uint count, ref IntPtr buffers);
        private delegate void SetTopologyFn(IntPtr self, int topology);
        private delegate void SetTargetsFn(IntPtr self, uint count, ref IntPtr views, IntPtr depth);
        private delegate void SetViewportsFn(IntPtr self, uint count, ref Viewport viewport);
        private delegate void UpdateFn(IntPtr self, IntPtr resource, uint subresource, IntPtr box, IntPtr data, uint rowPitch, uint depthPitch);
        private delegate void DrawFn(IntPtr self, uint count, uint start);

        private readonly IntPtr device, context;
        private readonly IntPtr vertex, constants;
        private readonly SetShaderFn setVs, setPs;
        private readonly SetBuffersFn setBuffers;
        private readonly SetTopologyFn setTopology;
        private readonly SetTargetsFn setTargets;
        private readonly SetViewportsFn setViewports;
        private readonly UpdateFn update;
        private readonly DrawFn draw;
        private readonly float[] data = new float[ConstantFloats];
        private readonly GCHandle pin;

        internal FxPipeline(IntPtr device, IntPtr context)
        {
            this.device = device;
            this.context = context;
            IntPtr code = Compile(FxShaders.Vertex, "VS", "vs_5_0");
            try { ComCall.Check(ComCall.Method<CreateShaderFn>(device, 12)(device, Pointer(code), Size(code), IntPtr.Zero, out vertex), "CreateVertexShader"); }
            finally { ComCall.Release(code); }
            var desc = new BufferDesc { ByteWidth = ConstantFloats * 4, Usage = 0, BindFlags = 4 };
            ComCall.Check(ComCall.Method<CreateBufferFn>(device, 3)(device, ref desc, IntPtr.Zero, out constants), "CreateBuffer");
            setVs = ComCall.Method<SetShaderFn>(context, 11);
            setPs = ComCall.Method<SetShaderFn>(context, 9);
            setBuffers = ComCall.Method<SetBuffersFn>(context, 16);
            setTopology = ComCall.Method<SetTopologyFn>(context, 24);
            setTargets = ComCall.Method<SetTargetsFn>(context, 33);
            setViewports = ComCall.Method<SetViewportsFn>(context, 44);
            update = ComCall.Method<UpdateFn>(context, 48);
            draw = ComCall.Method<DrawFn>(context, 13);
            pin = GCHandle.Alloc(data, GCHandleType.Pinned);
        }

        internal float[] Constants { get { return data; } }

        internal static IntPtr Compile(string source, string entry, string profile)
        {
            byte[] bytes = Encoding.ASCII.GetBytes(source);
            IntPtr code, errors;
            int hr = D3DCompile(bytes, (IntPtr)bytes.Length, "talia-fx", IntPtr.Zero, IntPtr.Zero, entry, profile, CompileFlags, 0, out code, out errors);
            string log = errors == IntPtr.Zero ? "" : Marshal.PtrToStringAnsi(Pointer(errors));
            ComCall.Release(errors);
            if (hr < 0) throw new InvalidOperationException(entry + " не собрался: " + (log ?? "").Trim());
            return code;
        }

        internal IntPtr CreatePixel(string hlsl)
        {
            IntPtr code = Compile(hlsl, "PS", "ps_5_0");
            try
            {
                IntPtr shader;
                ComCall.Check(ComCall.Method<CreateShaderFn>(device, 15)(device, Pointer(code), Size(code), IntPtr.Zero, out shader), "CreatePixelShader");
                return shader;
            }
            finally { ComCall.Release(code); }
        }

        internal void Draw(IntPtr view, int width, int height, IntPtr pixel)
        {
            update(context, constants, 0, IntPtr.Zero, pin.AddrOfPinnedObject(), 0, 0);
            IntPtr target = view;
            setTargets(context, 1, ref target, IntPtr.Zero);
            var viewport = new Viewport { Width = width, Height = height, MaxDepth = 1f };
            setViewports(context, 1, ref viewport);
            setTopology(context, 4);
            setVs(context, vertex, IntPtr.Zero, 0);
            setPs(context, pixel, IntPtr.Zero, 0);
            IntPtr buffer = constants;
            setBuffers(context, 0, 1, ref buffer);
            draw(context, 3, 0);
        }

        internal static void Fill(float[] d, int width, int height, float time, float fade, float star, float accent, float accentGain, float dark, float[] colors, float[] center, float[] hits, float[] audio, float[] beats)
        {
            Array.Clear(d, 0, d.Length);
            d[0] = width; d[1] = height; d[2] = time; d[3] = fade;
            d[4] = star; d[5] = accent; d[6] = accentGain; d[7] = dark;
            Array.Copy(colors, 0, d, 8, 3); Array.Copy(colors, 3, d, 12, 3); Array.Copy(colors, 6, d, 16, 3);
            Array.Copy(center, 0, d, 20, 3);
            Array.Copy(hits, 0, d, 24, 3);
            Array.Copy(audio, 0, d, 28, 4);
            Array.Copy(beats, 0, d, 32, 16);
        }

        private static IntPtr Pointer(IntPtr blob) { return ComCall.Method<BlobFn>(blob, 3)(blob); }
        private static IntPtr Size(IntPtr blob) { return ComCall.Method<BlobFn>(blob, 4)(blob); }

        public void Dispose()
        {
            if (pin.IsAllocated) pin.Free();
            ComCall.Release(constants);
            ComCall.Release(vertex);
        }
    }

    internal sealed class FxOffscreen : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct Texture2DDesc
        {
            public uint Width, Height, MipLevels, ArraySize;
            public int Format;
            public uint SampleCount, SampleQuality;
            public int Usage;
            public uint BindFlags, CpuAccessFlags, MiscFlags;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Mapped { public IntPtr Data; public uint RowPitch, DepthPitch; }

        [DllImport("d3d11.dll")]
        private static extern int D3D11CreateDevice(IntPtr adapter, int driverType, IntPtr software, uint flags, IntPtr levels, uint levelCount, uint sdkVersion, out IntPtr device, out int level, out IntPtr context);

        private delegate int CreateTextureFn(IntPtr self, ref Texture2DDesc desc, IntPtr initial, out IntPtr texture);
        private delegate int CreateViewFn(IntPtr self, IntPtr resource, IntPtr desc, out IntPtr view);
        private delegate void CopyFn(IntPtr self, IntPtr target, IntPtr source);
        private delegate int MapFn(IntPtr self, IntPtr resource, uint subresource, int type, uint flags, out Mapped mapped);
        private delegate void UnmapFn(IntPtr self, IntPtr resource, uint subresource);

        internal readonly int Width, Height;
        private readonly IntPtr device, context, target, view, staging;
        internal readonly FxPipeline Pipeline;

        internal FxOffscreen(int width, int height)
        {
            Width = width;
            Height = height;
            int level;
            ComCall.Check(D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, 0x20, IntPtr.Zero, 0, 7, out device, out level, out context), "D3D11CreateDevice");
            var desc = new Texture2DDesc { Width = (uint)width, Height = (uint)height, MipLevels = 1, ArraySize = 1, Format = 87, SampleCount = 1, Usage = 0, BindFlags = 0x20 };
            ComCall.Check(ComCall.Method<CreateTextureFn>(device, 5)(device, ref desc, IntPtr.Zero, out target), "CreateTexture2D");
            ComCall.Check(ComCall.Method<CreateViewFn>(device, 9)(device, target, IntPtr.Zero, out view), "CreateRenderTargetView");
            desc.Usage = 3; desc.BindFlags = 0; desc.CpuAccessFlags = 0x20000;
            ComCall.Check(ComCall.Method<CreateTextureFn>(device, 5)(device, ref desc, IntPtr.Zero, out staging), "CreateTexture2D (staging)");
            Pipeline = new FxPipeline(device, context);
        }

        internal void Draw(IntPtr pixel) { Pipeline.Draw(view, Width, Height, pixel); }

        internal byte[] Read()
        {
            ComCall.Method<CopyFn>(context, 47)(context, staging, target);
            Mapped mapped;
            ComCall.Check(ComCall.Method<MapFn>(context, 14)(context, staging, 0, 1, 0, out mapped), "Map");
            try
            {
                var pixels = new byte[Width * Height * 4];
                for (int y = 0; y < Height; y++) Marshal.Copy(mapped.Data + (int)(y * mapped.RowPitch), pixels, y * Width * 4, Width * 4);
                return pixels;
            }
            finally { ComCall.Method<UnmapFn>(context, 15)(context, staging, 0); }
        }

        public void Dispose()
        {
            Pipeline.Dispose();
            ComCall.Release(staging);
            ComCall.Release(view);
            ComCall.Release(target);
            ComCall.Release(context);
            ComCall.Release(device);
        }
    }
}
