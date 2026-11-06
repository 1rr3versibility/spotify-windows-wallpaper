// Talia · Spotify bridge: gives the Talia desktop player the Spotify app's own player and library, with no Web API quota.
(function TaliaBridge() {
  const TOKEN = "__TALIA_TOKEN__";
  const URL = "ws://localhost:43822/talia?t=" + TOKEN;
  const DJ = "spotify:playlist:37i9dQZF1EYkqdzj48dyYq";

  if (!window.Spicetify || !Spicetify.Player || !Spicetify.Platform || !Spicetify.Player.data && !Spicetify.Player.origin) {
    setTimeout(TaliaBridge, 400);
    return;
  }

  let socket = null;
  let retry = 1000;
  let lastSent = 0;

  const image = (url) => {
    if (!url) return null;
    if (url.startsWith("spotify:image:")) return "https://i.scdn.co/image/" + url.slice("spotify:image:".length);
    if (url.startsWith("spotify:mosaic:")) return "https://mosaic.scdn.co/640/" + url.slice("spotify:mosaic:".length).split(":").join("");
    return url;
  };
  const images = (list) => (list || []).map((i) => ({ url: image(i.url), width: i.width || (i.label === "xlarge" ? 640 : i.label === "large" ? 640 : i.label === "standard" ? 300 : i.label === "small" ? 64 : null) })).filter((i) => i.url);
  const sources = (holder) => images((holder && (holder.sources || holder.items && holder.items[0] && holder.items[0].sources)) || []);
  const idOf = (uri) => (uri || "").split(":").pop();
  const artistsOf = (list) => (list || []).map((a) => {
    const uri = a.uri || (a.profile && a.profile.uri) || "";
    return { id: idOf(uri), uri, name: a.name || (a.profile && a.profile.name) || "" };
  });

  const canvasCache = new Map();
  function canvasOf(item) {
    const meta = item.metadata || {};
    const direct = meta["canvas.url"];
    if (direct && /\.mp4|video/i.test(meta["canvas.type"] || direct)) return direct;
    if (canvasCache.has(item.uri)) return canvasCache.get(item.uri);
    canvasCache.set(item.uri, null);
    if (Spicetify.GraphQL && Spicetify.GraphQL.Definitions && Spicetify.GraphQL.Definitions.canvas && item.uri && item.uri.startsWith("spotify:track:")) {
      Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.canvas, { trackUri: item.uri, uri: item.uri }).then((reply) => {
        const c = reply && reply.data && reply.data.trackUnion && reply.data.trackUnion.canvas;
        const url = c && (c.url || (c.video && c.video.url));
        if (url) { canvasCache.set(item.uri, url); pushState(); }
      }).catch(() => {});
    }
    return null;
  }

  function trackFromPlayer(item) {
    if (!item) return null;
    const meta = item.metadata || {};
    const albumImages = images(item.album && item.album.images);
    if (!albumImages.length && meta.image_xlarge_url) albumImages.push({ url: image(meta.image_xlarge_url), width: 640 });
    return {
      type: item.type === "episode" || item.mediaType === "video" && item.type === "episode" ? "episode" : "track",
      uri: item.uri,
      id: idOf(item.uri),
      name: item.name || meta.title || "",
      duration_ms: (item.duration && item.duration.milliseconds) || Number(meta.duration) || Spicetify.Player.getDuration(),
      artists: artistsOf(item.artists).length ? artistsOf(item.artists) : [{ id: idOf(meta.artist_uri), uri: meta.artist_uri, name: meta.artist_name || "" }],
      album: { name: (item.album && item.album.name) || meta.album_title || "", uri: (item.album && item.album.uri) || meta.album_uri || "", images: albumImages },
      images: albumImages,
      canvas: canvasOf(item),
    };
  }

  function playerState() {
    const data = Spicetify.Player.data || (Spicetify.Platform.PlayerAPI && Spicetify.Platform.PlayerAPI._state);
    if (!data || !data.item) return { is_playing: false, item: null, progress_ms: 0, device: { volume_percent: Math.round(Spicetify.Player.getVolume() * 100) } };
    const repeat = Spicetify.Player.getRepeat();
    return {
      is_playing: !data.isPaused,
      progress_ms: Spicetify.Player.getProgress(),
      shuffle_state: Spicetify.Player.getShuffle(),
      repeat_state: repeat === 2 ? "track" : repeat === 1 ? "context" : "off",
      device: { volume_percent: Math.round(Spicetify.Player.getVolume() * 100), name: "Spotify", type: "Computer" },
      context: data.context && data.context.uri ? { uri: data.context.uri } : null,
      item: trackFromPlayer(data.item),
      liked: Spicetify.Player.getHeart(),
    };
  }

  function send(object) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(object));
  }

  function pushState() {
    lastSent = Date.now();
    send({ type: "state", state: playerState() });
  }

  function connect() {
    try { socket = new WebSocket(URL); } catch (error) { schedule(); return; }
    socket.onopen = () => {
      retry = 1000;
      let names = [];
      try { names = Object.keys(Spicetify.GraphQL && Spicetify.GraphQL.Definitions || {}); } catch (error) {}
      send({ type: "hello", version: Spicetify.Config && Spicetify.Config.version || "", definitions: names });
      pushState();
    };
    socket.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (message.type === "call") handle(message.id, message.op, message.args || {});
    };
    socket.onclose = schedule;
    socket.onerror = () => {};
  }

  function schedule() {
    socket = null;
    setTimeout(connect, retry);
    retry = Math.min(retry * 2, 15000);
  }

  async function graph(name, variables) {
    const definition = Spicetify.GraphQL.Definitions[name];
    if (!definition) throw new Error("GraphQL query " + name + " is not available in this Spotify version");
    const reply = await Spicetify.GraphQL.Request(definition, variables);
    if (reply.errors && reply.errors.length && !reply.data) throw new Error(reply.errors[0].message);
    return reply.data;
  }

  function firstDefinition(names) {
    for (const name of names) if (Spicetify.GraphQL.Definitions[name]) return name;
    return null;
  }

  function trackFromGraph(t, album) {
    if (!t) return null;
    const data = t.data || t;
    const albumData = data.albumOfTrack || album || {};
    const albumImages = sources(albumData.coverArt) ;
    return {
      type: "track",
      uri: data.uri,
      id: idOf(data.uri),
      name: data.name,
      duration_ms: (data.duration && data.duration.totalMilliseconds) || (data.trackDuration && data.trackDuration.totalMilliseconds) || 0,
      artists: artistsOf(data.artists && data.artists.items),
      album: { name: albumData.name || "", uri: albumData.uri || "", images: albumImages },
    };
  }

  function trackFromPlatform(t) {
    if (!t) return null;
    return {
      type: "track",
      uri: t.uri,
      id: idOf(t.uri),
      name: t.name,
      duration_ms: (t.duration && t.duration.milliseconds) || 0,
      artists: artistsOf(t.artists),
      album: { name: t.album && t.album.name || "", uri: t.album && t.album.uri || "", images: images(t.album && t.album.images) },
    };
  }

  function playlistCard(p) {
    if (!p) return null;
    return {
      id: idOf(p.uri),
      uri: p.uri,
      name: p.name,
      images: images(p.images),
      owner: { id: p.owner && (p.owner.username || p.owner.id) || "", display_name: p.owner && (p.owner.displayName || p.owner.name) || "" },
      items: { total: p.totalLength != null ? p.totalLength : p.length },
    };
  }

  function flattenRootlist(items, out) {
    for (const item of items || []) {
      if (item.type === "folder") flattenRootlist(item.items, out);
      else if (item.type === "playlist") out.push(playlistCard(item));
    }
    return out;
  }

  async function playContext(context, trackUri) {
    const api = Spicetify.Platform.PlayerAPI;
    if (context && trackUri) return api.play({ uri: context }, {}, { skipTo: { uri: trackUri } });
    if (context) return api.play({ uri: context }, {}, {});
    if (trackUri) return Spicetify.Player.playUri(trackUri);
    return Spicetify.Player.play();
  }

  function username() {
    const p = Spicetify.Platform;
    return p.username || (p.UserAPI && p.UserAPI._product_state && p.UserAPI._product_state.username) || (p.Session && p.Session.username) || null;
  }

  const ops = {
    async state() { return playerState(); },
    async play(a) { await playContext(a.context, a.uri || (a.uris && a.uris[0])); return {}; },
    async pause() { Spicetify.Player.pause(); return {}; },
    async resume() { Spicetify.Player.play(); return {}; },
    async next() { Spicetify.Player.next(); return {}; },
    async previous() { Spicetify.Player.back(); return {}; },
    async seek(a) { Spicetify.Player.seek(Number(a.ms) || 0); return {}; },
    async volume(a) { Spicetify.Player.setVolume(Math.max(0, Math.min(100, Number(a.percent) || 0)) / 100); return {}; },
    async shuffle(a) { Spicetify.Player.setShuffle(!!a.on); return {}; },
    async repeat(a) { Spicetify.Player.setRepeat(a.mode === "track" ? 2 : a.mode === "context" ? 1 : 0); return {}; },
    async dj() { await Spicetify.Player.playUri(DJ); return {}; },
    async "liked-play"(a) {
      const user = username();
      const context = user ? "spotify:user:" + user + ":collection" : "spotify:collection:tracks";
      await playContext(context, a.uri);
      return {};
    },
    async contains(a) {
      const reply = await Spicetify.Platform.LibraryAPI.contains(a.uri);
      return Array.isArray(reply) ? reply : [!!reply];
    },
    async like(a) { await Spicetify.Platform.LibraryAPI.add({ uris: [a.uri] }); pushState(); return {}; },
    async unlike(a) { await Spicetify.Platform.LibraryAPI.remove({ uris: [a.uri] }); pushState(); return {}; },
    async enqueue(a) { await Spicetify.addToQueue([{ uri: a.uri }]); return {}; },
    async queue() {
      const q = Spicetify.Platform.PlayerAPI._queue && Spicetify.Platform.PlayerAPI._queue._queueState;
      const now = playerState().item;
      const entries = q ? [...(q.queued || []), ...(q.nextUp || [])] : [];
      const queue = entries.slice(0, 40).map((e) => trackFromPlayer(e.contextTrack ? { uri: e.contextTrack.uri, name: e.contextTrack.metadata && e.contextTrack.metadata.title, metadata: e.contextTrack.metadata || {}, album: {}, artists: [] } : e)).filter(Boolean);
      return { currently_playing: now, queue };
    },
    async playlists(a) {
      const contents = await Spicetify.Platform.RootlistAPI.getContents();
      const all = flattenRootlist(contents.items, []).filter(Boolean);
      const offset = Number(a.offset) || 0;
      return { items: all.slice(offset, offset + 50), next: offset + 50 < all.length ? "more" : null, total: all.length };
    },
    async playlist(a) {
      const offset = Number(a.offset) || 0;
      const reply = await Spicetify.Platform.PlaylistAPI.getContents("spotify:playlist:" + a.id, { offset, limit: 50 });
      const items = (reply.items || []).map((t) => ({ item: trackFromPlatform(t) }));
      const total = reply.totalLength != null ? reply.totalLength : reply.total != null ? reply.total : reply.totalCount;
      return { items, next: total != null ? (offset + items.length < total ? "more" : null) : (items.length === 50 ? "more" : null), total };
    },
    async liked(a) {
      const offset = Number(a.offset) || 0;
      const reply = await Spicetify.Platform.LibraryAPI.getTracks({ offset, limit: 50 });
      const items = (reply.items || []).map((t) => ({ track: trackFromPlatform(t) }));
      const total = reply.totalLength || reply.total || reply.totalCount || null;
      return { items, next: total ? (offset + items.length < total ? "more" : null) : (items.length === 50 ? "more" : null), total };
    },
    async mixes() {
      const name = firstDefinition(["home", "homeSection", "feedBaselineLookup"]);
      if (!name) return { items: [], historyClosed: false };
      const data = await graph(name, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, sp_t: "", facet: "", sectionItemsLimit: 20, homeEndUserIntegration: "INTEGRATION_WEB_PLAYER" });
      const found = [];
      const seen = new Map();
      const walk = (node, depth) => {
        if (!node || depth > 14 || found.length >= 60) return;
        if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
        if (typeof node !== "object") return;
        const data = node.data || node;
        if (data && typeof data.uri === "string" && data.uri.startsWith("spotify:playlist:37i9dQZF1") && data.uri !== DJ) {
          let entry = seen.get(data.uri);
          if (!entry) { entry = { uri: data.uri, name: null, art: null, artists: [], description: "", owner: "" }; seen.set(data.uri, entry); found.push(entry); }
          if (!entry.name && data.name) entry.name = data.name;
          if (!entry.art) { const pic = sources(data.images)[0]; if (pic) entry.art = pic.url; }
          if (!entry.description && data.description) entry.description = String(data.description).replace(/<[^>]+>/g, "");
          const owner = data.ownerV2 && data.ownerV2.data;
          if (!entry.owner && owner && owner.name) entry.owner = owner.name;
        }
        for (const key in node) if (node[key] && typeof node[key] === "object") walk(node[key], depth + 1);
      };
      walk(data, 0);
      const personal = (m) => /^spotify:playlist:37i9dQZF1[EF]/.test(m.uri) ? 0 : 1;
      const named = found.filter((m) => m.name).sort((a, b) => personal(a) - personal(b));
      return { items: named.slice(0, 40), historyClosed: false };
    },
    async search(a) {
      const name = firstDefinition(["searchDesktop", "searchModalResults"]);
      if (!name) throw new Error("search query is not available");
      const wide = name === "searchModalResults";
      const data = await graph(name, { searchTerm: a.q, offset: Number(a.offset) || 0, limit: wide ? 30 : 10, numberOfTopResults: wide ? 30 : 5, includeAudiobooks: false, includeArtistHasConcertsField: false, includePreReleases: false, includeLocalConcertsField: false, includeAuthors: false });
      const s = data.searchV2 || data.search || {};
      if (!s.tracksV2 && s.topResultsV2) {
        const out = { tracks: { items: [], next: null }, artists: { items: [] }, albums: { items: [] }, playlists: { items: [] } };
        for (const entry of s.topResultsV2.itemsV2 || []) {
          const item = entry.item || entry;
          const d = item.data || {};
          const kind = d.__typename || item.__typename || "";
          if (kind === "Track") out.tracks.items.push(trackFromGraph(d));
          else if (kind === "Artist") out.artists.items.push({ id: idOf(d.uri), uri: d.uri, name: d.profile && d.profile.name, images: sources(d.visuals && d.visuals.avatarImage), genres: [] });
          else if (kind === "Album") out.albums.items.push({ id: idOf(d.uri), uri: d.uri, name: d.name, album_type: (d.type || "album").toLowerCase(), release_date: d.date && String(d.date.year || ""), artists: artistsOf(d.artists && d.artists.items), images: sources(d.coverArt) });
          else if (kind === "Playlist") out.playlists.items.push({ id: idOf(d.uri), uri: d.uri, name: d.name, images: sources(d.images), owner: { display_name: d.ownerV2 && d.ownerV2.data && d.ownerV2.data.name || "" } });
        }
        out.tracks.items = out.tracks.items.filter((t) => t && t.uri);
        return out;
      }
      const list = (x) => (x && x.items) || [];
      const tracks = list(s.tracksV2).map((e) => trackFromGraph(e.item || e)).filter(Boolean);
      const artists = list(s.artists).map((e) => { const d = e.data || e; return { id: idOf(d.uri), uri: d.uri, name: d.profile && d.profile.name, images: sources(d.visuals && d.visuals.avatarImage), genres: [] }; }).filter((x) => x.uri);
      const albums = list(s.albumsV2 || s.albums).map((e) => { const d = e.data || e; return { id: idOf(d.uri), uri: d.uri, name: d.name, album_type: (d.type || "album").toLowerCase(), release_date: d.date && String(d.date.year || ""), artists: artistsOf(d.artists && d.artists.items), images: sources(d.coverArt) }; }).filter((x) => x.uri);
      const playlists = list(s.playlists).map((e) => { const d = e.data || e; return { id: idOf(d.uri), uri: d.uri, name: d.name, images: sources(d.images), owner: { display_name: d.ownerV2 && d.ownerV2.data && d.ownerV2.data.name || "" } }; }).filter((x) => x.uri);
      const more = (x) => x && x.totalCount > (Number(a.offset) || 0) + 10 ? "more" : null;
      return { tracks: { items: tracks, next: more(s.tracksV2) }, artists: { items: artists }, albums: { items: albums }, playlists: { items: playlists } };
    },
    async "search-tracks"(a) {
      const reply = await ops.search(a);
      return { tracks: reply.tracks };
    },
    async artist(a) {
      const uri = "spotify:artist:" + a.id;
      const data = await graph("queryArtistOverview", { uri, locale: Spicetify.Locale ? Spicetify.Locale.getLocale() : "", includePrerelease: false });
      const u = data.artistUnion || {};
      const d = u.discography || {};
      const release = (r) => { const x = r.releases ? r.releases.items[0] : r; return x && { id: idOf(x.uri), uri: x.uri, name: x.name, album_type: (x.type || "album").toLowerCase(), release_date: x.date && String(x.date.year || ""), images: sources(x.coverArt) }; };
      return {
        id: a.id, uri, name: u.profile && u.profile.name,
        images: sources(u.visuals && u.visuals.avatarImage),
        genres: [],
        listeners: u.stats && u.stats.monthlyListeners,
        top: ((d.topTracks && d.topTracks.items) || []).map((e) => trackFromGraph(e.track)).filter(Boolean),
        related: ((u.relatedContent && u.relatedContent.relatedArtists && u.relatedContent.relatedArtists.items) || []).map((x) => ({ id: idOf(x.uri), uri: x.uri, name: x.profile && x.profile.name, images: sources(x.visuals && x.visuals.avatarImage) })),
        releases: [...((d.albums && d.albums.items) || []), ...((d.singles && d.singles.items) || []), ...((d.compilations && d.compilations.items) || [])].map(release).filter(Boolean),
      };
    },
    async "artist-albums"(a) {
      const artist = await ops.artist(a);
      return { items: artist.releases, next: null };
    },
    async album(a) {
      const uri = "spotify:album:" + a.id;
      const data = await graph("getAlbum", { uri, locale: Spicetify.Locale ? Spicetify.Locale.getLocale() : "", offset: 0, limit: 50 });
      const u = data.albumUnion || {};
      const albumRef = { name: u.name, uri, coverArt: u.coverArt };
      const items = ((u.tracksV2 || u.tracks || {}).items || []).map((e) => trackFromGraph(e.track, albumRef)).filter(Boolean);
      return {
        id: a.id, uri, name: u.name, album_type: (u.type || "album").toLowerCase(),
        release_date: u.date && u.date.isoString ? u.date.isoString.slice(0, 10) : "",
        artists: artistsOf(u.artists && u.artists.items),
        images: sources(u.coverArt),
        tracks: { total: (u.tracksV2 || u.tracks || {}).totalCount || items.length, items, next: null },
      };
    },
    async meta() {
      const data = Spicetify.Player.data || {};
      return { metadata: data.item && data.item.metadata || null, uri: data.item && data.item.uri };
    },
    async raw(a) {
      return graph(a.name, a.variables || {});
    },
  };

  async function handle(id, op, args) {
    const run = ops[op];
    if (!run) { send({ type: "reply", id, ok: false, error: "unknown op " + op }); return; }
    try {
      const data = await run(args);
      send({ type: "reply", id, ok: true, data: data === undefined ? null : data });
    } catch (error) {
      send({ type: "reply", id, ok: false, error: String(error && error.message || error) });
    }
  }

  Spicetify.Player.addEventListener("songchange", pushState);
  Spicetify.Player.addEventListener("onplaypause", pushState);
  Spicetify.Player.addEventListener("onprogress", () => { if (Date.now() - lastSent > 5000) pushState(); });
  if (Spicetify.Platform.LibraryAPI && Spicetify.Platform.LibraryAPI.getEvents) {
    try { Spicetify.Platform.LibraryAPI.getEvents().addListener("update", () => setTimeout(pushState, 150)); } catch (error) {}
  }
  setInterval(() => send({ type: "ping" }), 20000);
  connect();
})();
