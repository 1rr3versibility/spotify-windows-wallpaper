using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace CapriDesktop
{
    internal sealed class SpicetifyBridge : IDisposable
    {
        internal const int Port = 43822;
        private const string SpotifyOrigin = "https://xpui.app.spotify.com";
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };

        private readonly string token;
        private readonly object sendGate = new object();
        private readonly ConcurrentDictionary<int, TaskCompletionSource<string>> waiting = new ConcurrentDictionary<int, TaskCompletionSource<string>>();
        private readonly List<TcpListener> listeners = new List<TcpListener>();
        private volatile bool stopping;
        private NetworkStream active;
        private int sequence;
        private string state;
        private DateTime stateAt = DateTime.MinValue;

        internal event Action StateChanged;

        internal SpicetifyBridge(string settingsFolder)
        {
            string file = Path.Combine(settingsFolder, "spicetify-token.txt");
            if (File.Exists(file)) token = File.ReadAllText(file).Trim();
            if (string.IsNullOrEmpty(token) || token.Length != 32)
            {
                var bytes = new byte[16];
                using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
                token = BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
                Directory.CreateDirectory(settingsFolder);
                File.WriteAllText(file, token);
            }
        }

        internal string Token { get { return token; } }
        internal bool Connected { get { return active != null; } }
        internal string Version { get; private set; }
        internal string[] Definitions { get; private set; }

        internal string State
        {
            get { return state; }
        }

        internal double StateAgeMs { get { return (DateTime.UtcNow - stateAt).TotalMilliseconds; } }

        internal void Remember(string fresh)
        {
            if (string.IsNullOrEmpty(fresh)) return;
            state = fresh;
            stateAt = DateTime.UtcNow;
        }

        internal void Start()
        {
            if (listeners.Count > 0) return;
            foreach (IPAddress address in new[] { IPAddress.Loopback, IPAddress.IPv6Loopback })
            {
                var listener = new TcpListener(address, Port);
                try { listener.Start(); }
                catch (SocketException error)
                {
                    Journal.Write("Мост Spicetify: порт " + Port + " на " + address, error);
                    continue;
                }
                listeners.Add(listener);
                var acceptor = new Thread(() => Accept(listener)) { IsBackground = true, Name = "Spicetify bridge " + address };
                acceptor.Start();
            }
        }

        public void Dispose()
        {
            stopping = true;
            foreach (TcpListener listener in listeners) try { listener.Stop(); } catch (SocketException) { }
            NetworkStream stream = active;
            if (stream != null) stream.Dispose();
            foreach (var pair in waiting) pair.Value.TrySetException(new ObjectDisposedException("SpicetifyBridge"));
        }

        internal Task<string> Call(string op, Dictionary<string, object> args, int timeoutMs)
        {
            NetworkStream stream = active;
            var result = new TaskCompletionSource<string>();
            if (stream == null)
            {
                result.SetException(new InvalidOperationException("Расширение Spicetify не подключено."));
                return result.Task;
            }
            int id = Interlocked.Increment(ref sequence);
            waiting[id] = result;
            string message = Json.Serialize(new Dictionary<string, object> { { "type", "call" }, { "id", id }, { "op", op }, { "args", args ?? new Dictionary<string, object>() } });
            try { SendText(stream, message); }
            catch (Exception error)
            {
                TaskCompletionSource<string> gone;
                waiting.TryRemove(id, out gone);
                result.TrySetException(error);
                return result.Task;
            }
            var cancel = new Timer(delegate
            {
                TaskCompletionSource<string> late;
                if (waiting.TryRemove(id, out late)) late.TrySetException(new TimeoutException("Spotify не ответил на «" + op + "» за " + timeoutMs / 1000 + " с."));
            }, null, timeoutMs, Timeout.Infinite);
            result.Task.ContinueWith(delegate { cancel.Dispose(); });
            return result.Task;
        }

        internal string CallSync(string op, Dictionary<string, object> args, int timeoutMs = 8000)
        {
            Task<string> task = Call(op, args, timeoutMs);
            try { return task.Result; }
            catch (AggregateException error) { throw error.GetBaseException(); }
        }

        private void Accept(TcpListener listener)
        {
            while (!stopping)
            {
                TcpClient client;
                try { client = listener.AcceptTcpClient(); }
                catch (SocketException) { if (stopping) return; continue; }
                catch (ObjectDisposedException) { return; }
                var worker = new Thread(() => Serve(client)) { IsBackground = true, Name = "Spicetify connection" };
                worker.Start();
            }
        }

        private void Serve(TcpClient client)
        {
            using (client)
            {
                NetworkStream stream = client.GetStream();
                try
                {
                    if (!Handshake(stream)) return;
                    while (!stopping)
                    {
                        string text = ReadText(stream);
                        if (text == null) break;
                        Handle(stream, text);
                    }
                }
                catch (IOException) { }
                catch (ObjectDisposedException) { }
                catch (Exception error) { Journal.Write("Мост Spicetify", error); }
                finally
                {
                    if (active == stream)
                    {
                        active = null;
                        foreach (var pair in waiting)
                        {
                            TaskCompletionSource<string> dropped;
                            if (waiting.TryRemove(pair.Key, out dropped)) dropped.TrySetException(new IOException("Spotify отключился."));
                        }
                        Action changed = StateChanged;
                        if (changed != null) changed();
                    }
                }
            }
        }

        private bool Handshake(NetworkStream stream)
        {
            stream.ReadTimeout = 5000;
            var head = new StringBuilder();
            var one = new byte[1];
            while (head.Length < 8192)
            {
                if (stream.Read(one, 0, 1) != 1) return false;
                head.Append((char)one[0]);
                if (head.Length >= 4 && head.ToString(head.Length - 4, 4) == "\r\n\r\n") break;
            }
            string[] lines = head.ToString().Split(new[] { "\r\n" }, StringSplitOptions.RemoveEmptyEntries);
            if (lines.Length == 0) return false;
            string[] request = lines[0].Split(' ');
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 1; i < lines.Length; i++)
            {
                int colon = lines[i].IndexOf(':');
                if (colon > 0) headers[lines[i].Substring(0, colon).Trim()] = lines[i].Substring(colon + 1).Trim();
            }
            string origin, key;
            headers.TryGetValue("Origin", out origin);
            headers.TryGetValue("Sec-WebSocket-Key", out key);
            string target = request.Length > 1 ? request[1] : "";
            bool allowed = request.Length > 1 && request[0] == "GET" && target == "/talia?t=" + token &&
                origin != null && (origin == SpotifyOrigin || origin.EndsWith(".spotify.com", StringComparison.Ordinal) && origin.StartsWith("https://", StringComparison.Ordinal)) && !string.IsNullOrEmpty(key);
            if (!allowed)
            {
                byte[] refuse = Encoding.ASCII.GetBytes("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                stream.Write(refuse, 0, refuse.Length);
                Journal.Write("Мост Spicetify", new UnauthorizedAccessException("Отклонено подключение: origin «" + origin + "», путь " + (target.StartsWith("/talia") ? "/talia (токен не совпал)" : target)));
                return false;
            }
            string accept;
            using (var sha = SHA1.Create()) accept = Convert.ToBase64String(sha.ComputeHash(Encoding.ASCII.GetBytes(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
            byte[] reply = Encoding.ASCII.GetBytes("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
            stream.Write(reply, 0, reply.Length);
            stream.ReadTimeout = Timeout.Infinite;
            NetworkStream previous = active;
            active = stream;
            if (previous != null && previous != stream) previous.Dispose();
            return true;
        }

        private void Handle(NetworkStream stream, string text)
        {
            Dictionary<string, object> message;
            try { message = Json.Deserialize<Dictionary<string, object>>(text); }
            catch (ArgumentException) { return; }
            object type;
            message.TryGetValue("type", out type);
            switch (type as string)
            {
                case "hello":
                    {
                        object version, defs;
                        message.TryGetValue("version", out version);
                        message.TryGetValue("definitions", out defs);
                        Version = version as string;
                        var names = new List<string>();
                        var list = defs as System.Collections.ArrayList;
                        if (list != null) foreach (object name in list) if (name is string) names.Add((string)name);
                        Definitions = names.ToArray();
                        break;
                    }
                case "state":
                    {
                        object body;
                        message.TryGetValue("state", out body);
                        state = body == null ? null : Json.Serialize(body);
                        stateAt = DateTime.UtcNow;
                        Action changed = StateChanged;
                        if (changed != null) changed();
                        break;
                    }
                case "reply":
                    {
                        object id, ok, data, error;
                        message.TryGetValue("id", out id);
                        message.TryGetValue("ok", out ok);
                        message.TryGetValue("data", out data);
                        message.TryGetValue("error", out error);
                        int number = id is int ? (int)id : Convert.ToInt32(id);
                        TaskCompletionSource<string> pending;
                        if (!waiting.TryRemove(number, out pending)) return;
                        if (ok is bool && (bool)ok) pending.TrySetResult(data == null ? "null" : Json.Serialize(data));
                        else pending.TrySetException(new InvalidOperationException("Spotify: " + (error as string ?? "ошибка")));
                        break;
                    }
                case "ping":
                    SendText(stream, "{\"type\":\"pong\"}");
                    break;
            }
        }

        private static string ReadText(NetworkStream stream)
        {
            var message = new MemoryStream();
            while (true)
            {
                int b0 = stream.ReadByte(), b1 = stream.ReadByte();
                if (b0 < 0 || b1 < 0) return null;
                bool final = (b0 & 0x80) != 0;
                int opcode = b0 & 0x0F;
                bool masked = (b1 & 0x80) != 0;
                long length = b1 & 0x7F;
                if (length == 126)
                {
                    byte[] two = ReadExact(stream, 2);
                    length = (two[0] << 8) | two[1];
                }
                else if (length == 127)
                {
                    byte[] big = ReadExact(stream, 8);
                    length = 0;
                    for (int i = 0; i < 8; i++) length = (length << 8) | big[i];
                }
                if (length > 64 * 1024 * 1024) throw new IOException("Слишком большое сообщение от Spotify.");
                byte[] mask = masked ? ReadExact(stream, 4) : null;
                byte[] payload = ReadExact(stream, (int)length);
                if (mask != null) for (int i = 0; i < payload.Length; i++) payload[i] ^= mask[i % 4];
                if (opcode == 8) return null;
                if (opcode == 9) continue;
                if (opcode == 10) continue;
                message.Write(payload, 0, payload.Length);
                if (final) return Encoding.UTF8.GetString(message.ToArray());
            }
        }

        private static byte[] ReadExact(NetworkStream stream, int count)
        {
            var buffer = new byte[count];
            int read = 0;
            while (read < count)
            {
                int took = stream.Read(buffer, read, count - read);
                if (took <= 0) throw new IOException("Соединение со Spotify закрыто.");
                read += took;
            }
            return buffer;
        }

        private void SendText(NetworkStream stream, string text)
        {
            byte[] payload = Encoding.UTF8.GetBytes(text);
            var frame = new MemoryStream();
            frame.WriteByte(0x81);
            if (payload.Length < 126) frame.WriteByte((byte)payload.Length);
            else if (payload.Length <= 0xFFFF)
            {
                frame.WriteByte(126);
                frame.WriteByte((byte)(payload.Length >> 8));
                frame.WriteByte((byte)payload.Length);
            }
            else
            {
                frame.WriteByte(127);
                for (int i = 7; i >= 0; i--) frame.WriteByte((byte)((long)payload.Length >> (8 * i)));
            }
            frame.Write(payload, 0, payload.Length);
            byte[] bytes = frame.ToArray();
            lock (sendGate) stream.Write(bytes, 0, bytes.Length);
        }
    }
}
