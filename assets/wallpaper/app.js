"use strict";

const $ = (id) => document.getElementById(id);
const bridge = window.chrome && window.chrome.webview ? window.chrome.webview : null;
const pending = new Map();
let sequence = 0;

if (bridge) {
  bridge.addEventListener("message", (event) => {
    const reply = event.data;
    if (reply && reply.pulse) return Pulse.feed(reply.pulse);
    if (reply && typeof reply.searchText === "string") return Search.run(reply.searchText);
    if (reply && reply.searchDone) return $("searchbar").classList.remove("typing");
    if (reply && reply.characterChanged) return refreshCharacter();
    if (reply && reply.wheel) return scrollAt(reply.wheel[0], reply.wheel[1], reply.wheel[2]);
    const waiter = pending.get(reply.id);
    if (!waiter) return;
    pending.delete(reply.id);
    if (reply.status === 0) waiter.reject(new Error(reply.error || "ошибка"));
    else if (reply.status === 401 && reply.error) waiter.resolve({ status: 401, data: null, error: reply.error });
    else waiter.resolve({ status: reply.status, data: parse(reply.body), retry: reply.retry });
  });
}

function parse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function call(op, args = {}) {
  if (!bridge) return Demo.call(op, args);
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    bridge.postMessage({ id, op, args });
  });
}

const state = {
  connected: false,
  playback: null,
  fetchedAt: 0,
  trackUri: null,
  liked: false,
  coverUrl: null,
  view: "now",
  playlistOffset: 0,
  playlistNext: false,
  openPlaylist: null,
  likedOffset: 0,
  likedNext: false,
  seeking: false,
};

function toast(text) {
  const box = $("toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 3200);
}

async function act(op, args, after) {
  try {
    const reply = await call(op, args);
    if (reply.status === 404) toast("Нет активного устройства: открой Spotify на компьютере");
    else if (reply.status === 403) toast("Spotify не разрешил это действие");
    else if (reply.status >= 400) toast("Spotify ответил " + reply.status);
    if (after) after(reply);
    setTimeout(refresh, 350);
    return reply;
  } catch (error) {
    toast(error.message);
    if (after) after(null);
    return null;
  }
}

function clock(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function image(list, size) {
  if (!list || !list.length) return "";
  const sorted = list.slice().sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 640) >= size) || sorted[sorted.length - 1]).url;
}

function names(artists) { return (artists || []).map((a) => a.name).join(", "); }

async function boot() {
  const status = await call("status");
  const info = status.data || {};
  document.body.dataset.character = info.character || "talia";
  $("brand-name").textContent = info.character === "capri" ? "CAPRI · SPOTIFY" : "Talia · Spotify";
  state.connected = !!info.connected;
  $("setup").hidden = state.connected;
  if (!info.configured) $("setup-text").textContent = "Spicetify не установлен. Поставь Talia через установщик или открой меню плеера ☰ → «Spicetify» → «Установить расширение в Spotify».";
  else if (!info.connected) $("setup-text").textContent = "Запусти Spotify. Если он запущен, а обои пустые, открой меню плеера ☰ → «Spicetify» → «Переприменить после обновления Spotify».";
  if (state.connected) { refresh(); Stage.load(); }
  setTimeout(boot, state.connected ? 30000 : 4000);
}

let polling = false;
let pollAfter = 0;
async function refresh() {
  if (!state.connected || polling || performance.now() < pollAfter) return;
  polling = true;
  let reply;
  try { reply = await call("state"); }
  catch (error) { toast("Spotify: " + error.message); polling = false; return; }
  polling = false;
  if (reply.status === 200 || reply.status === 204) {
    state.fetchedAt = performance.now();
    state.playback = reply.status === 200 ? reply.data : null;
    render();
  } else if (reply.status === 401) {
    state.connected = false;
    $("setup").hidden = false;
    boot();
  } else if (reply.status === 429) {
    const wait = reply.retry || 10;
    pollAfter = performance.now() + wait * 1000;
    toast("Spotify просит подождать " + wait + " с");
  } else {
    toast("Spotify ответил " + reply.status + " на запрос состояния");
  }
}

function render() {
  const p = state.playback;
  const item = p && p.item;
  const playing = !!(p && p.is_playing);
  $("play-icon").innerHTML = playing ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  $("shuffle").classList.toggle("on", !!(p && p.shuffle_state));
  const repeat = p ? p.repeat_state : "off";
  $("repeat").classList.toggle("on", repeat !== "off");
  $("repeat").classList.toggle("one", repeat === "track");
  if (p && p.device) {
    const v = p.device.volume_percent;
    $("volume-fill").style.width = (v || 0) + "%";
    $("volume-label").textContent = v == null ? "—" : v + "%";
  }
  if (!item) {
    $("title").textContent = "Spotify";
    $("artist").textContent = p ? "Ничего не играет" : "Открой Spotify и включи музыку";
    $("artist").dataset.key = "";
    $("album").textContent = "";
    $("mini-title").textContent = "—";
    $("mini-artist").textContent = "";
    $("eyebrow").textContent = "Сейчас играет";
    $("fill").style.width = "0%";
    $("knob").style.left = "0%";
    $("elapsed").textContent = "0:00";
    $("duration").textContent = "0:00";
    state.trackUri = null;
    state.likeKnown = false;
    setLiked(false);
    setCover("");
    return;
  }
  const isEpisode = item.type === "episode";
  const cover = image(isEpisode ? item.images : item.album && item.album.images, 600) || p.cover_data;
  $("title").textContent = item.name;
  if ($("artist").dataset.key !== item.uri) {
    $("artist").dataset.key = item.uri;
    if (isEpisode) $("artist").textContent = item.show && item.show.name || "";
    else linkArtists($("artist"), item.artists);
    linkArtists($("mini-artist"), isEpisode ? [] : item.artists, isEpisode ? $("artist").textContent : "");
    const album = $("album");
    album.textContent = isEpisode ? "" : (item.album ? item.album.name : "");
    album.classList.toggle("artist-link", !isEpisode && !!(item.album && item.album.uri));
    album.onclick = !isEpisode && item.album && item.album.uri ? () => openAlbum(item.album.uri.split(":").pop()) : null;
  }
  $("eyebrow").textContent = p.context && p.context.uri === "spotify:playlist:37i9dQZF1EYkqdzj48dyYq" ? "DJ" : (playing ? "Сейчас играет" : "На паузе");
  $("mini-title").textContent = item.name;

  setCover(cover);
  setCanvas(!isEpisode && item.canvas ? item.canvas : null);
  if (item.uri !== state.trackUri) {
    state.trackUri = item.uri;
    Fx.onTrack(item.uri);
    checkLiked();
    if (state.view === "queue") loadQueue();
  }
  tick();
}

function linkArtists(box, artists, fallback) {
  box.textContent = "";
  const list = (artists || []).filter((a) => a && a.name);
  if (!list.length) { box.textContent = fallback || ""; return; }
  list.forEach((artist, i) => {
    if (i) box.appendChild(document.createTextNode(", "));
    const link = document.createElement("span");
    link.textContent = artist.name;
    const id = artist.id || (artist.uri || "").split(":").pop();
    if (id) {
      link.className = "artist-link";
      link.onclick = (event) => { event.stopPropagation(); openArtist(id); };
    }
    box.appendChild(link);
  });
}

function tick() {
  const p = state.playback;
  if (!p || !p.item || state.seeking) return;
  const duration = p.item.duration_ms || 0;
  let at = p.progress_ms || 0;
  if (p.is_playing) at += performance.now() - state.fetchedAt;
  at = Math.min(at, duration);
  const share = duration ? at / duration : 0;
  $("fill").style.width = share * 100 + "%";
  $("knob").style.left = share * 100 + "%";
  $("elapsed").textContent = clock(at);
  $("duration").textContent = clock(duration);
}

let canvasSampler = 0;
function sampleCanvas() {
  const video = $("canvas");
  if (!video.classList.contains("on") || video.readyState < 2 || !video.videoWidth) return;
  try { applyPalette(palette(video)); }
  catch (error) { console.warn("canvas palette failed", error); clearInterval(canvasSampler); canvasSampler = 0; }
}

function setCanvas(url) {
  const video = $("canvas");
  if ((video.dataset.src || null) === (url || null)) return;
  video.dataset.src = url || "";
  video.classList.remove("on");
  video.parentElement.classList.remove("has-canvas");
  clearInterval(canvasSampler);
  canvasSampler = 0;
  if (!url) {
    video.removeAttribute("src");
    video.load();
    if (state.coverUrl) paint(state.coverUrl);
    return;
  }
  video.crossOrigin = "anonymous";
  video.onplaying = () => {
    if (video.dataset.src !== url) return;
    if (video.videoWidth && video.videoHeight) video.parentElement.style.setProperty("--ratio", (video.videoWidth / video.videoHeight).toFixed(4));
    video.parentElement.classList.add("has-canvas");
    video.classList.add("on");
    sampleCanvas();
    if (!canvasSampler) canvasSampler = setInterval(sampleCanvas, 1500);
  };
  video.onerror = () => {
    if (video.dataset.src !== url) return;
    if (video.crossOrigin) {
      console.warn("canvas video refused frame access, playing without palette", url);
      video.removeAttribute("crossorigin");
      video.src = url;
      video.play().catch(() => {});
      return;
    }
    console.warn("canvas video failed", url);
    video.classList.remove("on");
  };
  video.src = url;
  video.play().catch((error) => console.warn("canvas play blocked", error));
  setTimeout(() => {
    if (video.dataset.src !== url || video.classList.contains("on")) return;
    console.warn("canvas video stalled, retrying", url);
    video.load();
    video.play().catch(() => {});
  }, 12000);
}

function setCover(url) {
  if (!$("cover").onerror) {
    $("cover").onerror = () => {
      const spare = state.playback && state.playback.cover_data;
      if (!spare || $("cover").src === spare) return;
      state.coverUrl = spare;
      $("cover").src = spare;
      $("mini-cover").src = spare;
      paint(spare);
    };
  }
  if (url === state.coverUrl) return;
  state.coverUrl = url;
  $("cover").src = url || "";
  $("mini-cover").src = url || "";
  $("cover-empty").style.display = url ? "none" : "grid";
  if (url) paint(url);
}

function paint(url) {
  const probe = new Image();
  probe.crossOrigin = "anonymous";
  probe.onload = () => {
    if (url !== state.coverUrl) return;
    try { applyPalette(palette(probe)); }
    catch (error) { console.warn("palette from cover failed, using title hash", error); applyPalette(fromText(url)); }
  };
  probe.onerror = () => { if (url === state.coverUrl) { console.warn("cover blocked for palette", url); applyPalette(fromText(url)); } };
  probe.src = url;
}

function palette(img) {
  const size = 28;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, size, size);
  const pixels = g.getImageData(0, 0, size, size).data;
  const bins = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], gr = pixels[i + 1], b = pixels[i + 2];
    const key = (r >> 5) * 64 + (gr >> 5) * 8 + (b >> 5);
    const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += gr; bin.b += b;
    bins.set(key, bin);
  }
  const swatches = [...bins.values()].map((s) => {
    const c = [s.r / s.n, s.g / s.n, s.b / s.n];
    const max = Math.max(...c), min = Math.min(...c);
    const sat = max ? (max - min) / max : 0;
    return { c, score: s.n * (0.15 + sat) * (0.2 + max / 255) };
  }).sort((a, b) => b.score - a.score);
  const picked = [];
  for (const s of swatches) {
    if (picked.every((p) => distance(p, s.c) > 70)) picked.push(s.c);
    if (picked.length === 3) break;
  }
  while (picked.length < 3) picked.push(picked.length ? rotate(picked[0], picked.length * 60) : [255, 154, 187]);
  return picked.map(lift);
}

function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function lift(c) {
  const [h, s, l] = hsl(c);
  return rgb(h, Math.min(.68, s), Math.max(.28, Math.min(.42, l)));
}
function rotate(c, degrees) {
  const [h, s, l] = hsl(c);
  return rgb((h + degrees) % 360, s, l);
}
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function rgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round);
}
function fromText(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h = hash % 360;
  return [rgb(h, .7, .62), rgb((h + 70) % 360, .65, .58), rgb((h + 200) % 360, .5, .45)];
}
function applyPalette(colors) {
  const root = document.documentElement.style;
  colors.forEach((c, i) => root.setProperty("--c" + (i + 1), "rgb(" + c.join(" ") + ")"));
}

async function checkLiked() {
  const uri = state.trackUri;
  setLiked(false);
  state.likeKnown = false;
  if (!uri || !uri.startsWith("spotify:track:")) return;
  let reply;
  try { reply = await call("contains", { uri }); }
  catch (error) { toast("Не узнал, лайкнут ли трек: " + error.message); return; }
  if (uri !== state.trackUri) return;
  if (reply.status === 200 && Array.isArray(reply.data)) { state.likeKnown = true; setLiked(!!reply.data[0]); }
  else toast("Не узнал, лайкнут ли трек (" + reply.status + ")");
}

function setLiked(on) {
  state.liked = on;
  for (const id of ["like", "like-small"]) $(id).classList.toggle("on", on);
  $("like-label").textContent = on ? "В любимом" : "В любимое";
}

function toggleLike() {
  if (!state.trackUri) return;
  if (!state.likeKnown) return toast("Подожди: ещё не знаю, лайкнут ли трек");
  const next = !state.liked;
  setLiked(next);
  act(next ? "like" : "unlike", { uri: state.trackUri }, (reply) => { if (!reply || reply.status >= 400) setLiked(!next); });
}

function showView(name) {
  if (name !== "detail") { state.tab = name; Detail.stack = []; }
  state.view = name;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
  if (name === "playlists" && !state.openPlaylist) { if (!$("playlist-grid").children.length) loadPlaylists(true); else loadMixes(); }
  if (name === "liked" && !$("liked-tracks").children.length) loadLiked(true);
  if (name === "queue") loadQueue();
}

let playlistsBusy = false;
async function loadPlaylists(reset) {
  if (playlistsBusy) return;
  playlistsBusy = true;
  if (reset) { state.playlistOffset = 0; $("playlist-grid").innerHTML = ""; loadMixes(); }
  let reply;
  try { reply = await call("playlists", { offset: state.playlistOffset }); }
  catch (error) { toast("Плейлисты: " + error.message); return; }
  finally { playlistsBusy = false; }
  if (reply.status !== 200) return toast("Не удалось получить плейлисты (" + reply.status + ")");
  const page = reply.data;
  for (const list of page.items || []) {
    if (!list) continue;
    const card = document.createElement("button");
    card.className = "card";
    const art = image(list.images, 300);
    const total = (list.items || list.tracks || {}).total;
    card.innerHTML = (art ? '<img alt="">' : '<div class="ph"></div>') + '<div class="name"></div><div class="sub"></div>';
    if (art) card.querySelector("img").src = art;
    card.querySelector(".name").textContent = list.name;
    card.querySelector(".sub").textContent = total != null ? total + " треков" : (list.owner && list.owner.display_name) || "";
    card.onclick = () => openPlaylist(list);
    $("playlist-grid").appendChild(card);
  }
  if (!state.playlistOffset && !(page.items || []).length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Своих плейлистов в медиатеке нет. Здесь появятся плейлисты, которые ты создашь или сохранишь.";
    $("playlist-grid").appendChild(empty);
  }
  state.playlistOffset += (page.items || []).length;
  state.playlistNext = !!page.next;
  $("playlists-more").hidden = !state.playlistNext;
}

function mixCard(name, sub, cls, art, badge, play) {
  const card = document.createElement("button");
  card.className = "card mix " + cls;
  card.innerHTML = '<div class="cover-frame">' + (art ? '<img alt="">' : '<div class="ph"></div>') + '</div><div class="name"></div><div class="sub"></div>';
  if (art) card.querySelector("img").src = art;
  else if (badge) card.querySelector(".ph").textContent = badge;
  if (art && badge) { const b = document.createElement("span"); b.className = "badge"; b.textContent = badge; card.querySelector(".cover-frame").appendChild(b); }
  card.querySelector(".name").textContent = name;
  card.querySelector(".sub").textContent = sub;
  card.onclick = play;
  return card;
}

let mixesBusy = false;
async function loadMixes() {
  if (mixesBusy) return;
  mixesBusy = true;
  const grid = $("mix-grid");
  let reply;
  try { reply = await call("mixes"); }
  catch (error) { toast("Миксы: " + error.message); }
  finally { mixesBusy = false; }
  grid.innerHTML = "";
  grid.appendChild(mixCard("DJ", "Spotify подбирает и комментирует", "dj", "", "DJ", () => act("dj", {}, (r) => { if (r && r.status < 300) toast("Включаю DJ"); })));
  grid.appendChild(mixCard("Любимые треки", "Все лайкнутые подряд", "liked", "", "♥", () => act("liked-play", {})));
  if (!reply || reply.status !== 200 || !reply.data) return;
  for (const mix of reply.data.items || []) {
    const artists = (mix.artists || []).slice(0, 3).join(", ");
    const name = mix.name || (artists ? "Микс: " + artists.split(", ")[0] : "Микс Spotify");
    grid.appendChild(mixCard(name, artists, "", mix.art || mix.cover || "", mix.name ? "" : "МИКС", () => act("play", { context: mix.uri })));
  }
  if (!(reply.data.items || []).length) {
    const note = document.createElement("div");
    note.className = "empty";
    note.textContent = "Spotify пока не показал миксы на главной. Открой главную страницу в самом Spotify, и они появятся здесь.";
    grid.appendChild(note);
  }
}

async function openPlaylist(list, more) {
  if (!more) {
    state.openPlaylist = { list, offset: 0, busy: false };
    $("playlist-tracks").innerHTML = "";
  }
  const opened = state.openPlaylist;
  if (opened.busy) return;
  opened.busy = true;
  $("playlists-title").textContent = list.name;
  $("playlist-home").hidden = true;
  $("playlist-tracks").hidden = false;
  $("playlists-back").hidden = false;
  $("playlist-play").hidden = false;
  let reply;
  try { reply = await call("playlist", { id: list.id, offset: opened.offset }); }
  catch (error) { opened.busy = false; return toast("Плейлист: " + error.message); }
  opened.busy = false;
  if (state.openPlaylist !== opened) return;
  if (reply.status !== 200) {
    $("playlists-more").hidden = true;
    return toast(reply && reply.status === 403 ? "Spotify не показывает треки чужих плейлистов, но включить его можно" : "Не удалось открыть плейлист");
  }
  const page = reply.data;
  for (const entry of page.items || []) {
    const track = entry.item || entry.track;
    if (track) $("playlist-tracks").appendChild(row(track, () => act("play", { context: list.uri, uri: track.uri })));
  }
  opened.offset += (page.items || []).length;
  $("playlists-more").hidden = !page.next;
}

function closePlaylist() {
  state.openPlaylist = null;
  $("playlists-title").textContent = "Плейлисты";
  $("playlist-home").hidden = false;
  $("playlist-tracks").hidden = true;
  $("playlists-back").hidden = true;
  $("playlist-play").hidden = true;
  $("playlists-more").hidden = !state.playlistNext;
}

let likedBusy = false;
async function loadLiked(reset) {
  if (likedBusy) return;
  likedBusy = true;
  if (reset) { state.likedOffset = 0; $("liked-tracks").innerHTML = ""; }
  let reply;
  try { reply = await call("liked", { offset: state.likedOffset }); }
  catch (error) { toast("Любимое: " + error.message); return; }
  finally { likedBusy = false; }
  if (reply.status !== 200) return toast("Не удалось получить любимые треки (" + reply.status + ")");
  const page = reply.data;
  for (const entry of page.items || []) {
    const track = entry.track || entry.item;
    if (!track) continue;
    const r = row(track, () => act("liked-play", { uri: track.uri }), true);
    $("liked-tracks").appendChild(r);
  }
  state.likedOffset += (page.items || []).length;
  $("liked-more").hidden = !page.next;
}

async function loadQueue() {
  let reply;
  try { reply = await call("queue"); }
  catch (error) { return toast("Очередь: " + error.message); }
  const box = $("queue-tracks");
  box.innerHTML = "";
  if (reply.status !== 200 || !reply.data) return toast("Не удалось получить очередь (" + reply.status + ")");
  const now = reply.data.currently_playing;
  if (now) { const r = row(now, null); r.classList.add("current"); box.appendChild(r); }
  for (const track of reply.data.queue || []) box.appendChild(row(track, () => act("play", { uri: track.uri })));
}

function row(track, onPlay, likedRow) {
  const r = document.createElement("div");
  r.className = "row" + (track.uri === state.trackUri ? " current" : "");
  r.innerHTML = '<img alt=""><div class="t"></div><div class="a"></div><div class="d"></div><button class="like" title="Нравится"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.4-9.3C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.5 4.5 6.7-1.9 4.7-9.4 9.3-9.4 9.3z"/></svg></button>';
  const art = image(track.album && track.album.images, 64) || image(track.images, 64);
  if (art) r.querySelector("img").src = art;
  r.querySelector(".t").textContent = track.name;
  const by = r.querySelector(".a");
  if (track.artists && track.artists.length) {
    track.artists.forEach((artist, i) => {
      if (i) by.appendChild(document.createTextNode(", "));
      const link = document.createElement("span");
      link.textContent = artist.name;
      if (artist.id) {
        link.className = "artist-link";
        link.onclick = (event) => { event.stopPropagation(); openArtist(artist.id); };
      }
      by.appendChild(link);
    });
  } else by.textContent = (track.show && track.show.name) || "";
  r.querySelector(".d").textContent = track.duration_ms ? clock(track.duration_ms) : "";
  const heart = r.querySelector(".like");
  if (likedRow) heart.classList.add("on");
  heart.onclick = (event) => {
    event.stopPropagation();
    const on = !heart.classList.contains("on");
    heart.classList.toggle("on", on);
    act(on ? "like" : "unlike", { uri: track.uri }, (reply) => {
      if (!reply || reply.status >= 400) heart.classList.toggle("on", !on);
      else if (track.uri === state.trackUri) setLiked(on);
    });
  };
  if (onPlay) r.onclick = onPlay;
  return r;
}

function barPosition(bar, event) {
  const box = bar.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
}

function wire() {
  document.querySelectorAll(".tab").forEach((t) => { t.onclick = () => showView(t.dataset.view); });
  $("play").onclick = () => act(state.playback && state.playback.is_playing ? "pause" : "play", {});
  $("next").onclick = () => act("next");
  $("previous").onclick = () => act("previous");
  $("shuffle").onclick = () => act("shuffle", { on: !(state.playback && state.playback.shuffle_state) });
  $("repeat").onclick = () => {
    const now = state.playback ? state.playback.repeat_state : "off";
    act("repeat", { mode: now === "off" ? "context" : now === "context" ? "track" : "off" });
  };
  $("like").onclick = toggleLike;
  $("like-small").onclick = toggleLike;
  $("dj").onclick = () => act("dj", {}, (reply) => { if (reply && reply.status < 300) toast("Включаю DJ"); });
  $("liked-play").onclick = () => act("liked-play", {});
  $("searchbar").onclick = () => Search.open();
  $("detail-back").onclick = () => Detail.back();
  $("liked-more").onclick = () => loadLiked(false);
  $("playlists-more").onclick = () => state.openPlaylist ? openPlaylist(state.openPlaylist.list, true) : loadPlaylists(false);
  $("playlists-back").onclick = closePlaylist;
  $("playlist-play").onclick = () => state.openPlaylist && act("play", { context: state.openPlaylist.list.uri });
  $("seek").onclick = (event) => {
    const p = state.playback;
    if (!p || !p.item) return;
    const ms = Math.round(barPosition($("seek"), event) * p.item.duration_ms);
    p.progress_ms = ms;
    state.fetchedAt = performance.now();
    tick();
    act("seek", { ms });
  };
  $("volume").onclick = (event) => {
    const percent = Math.round(barPosition($("volume"), event) * 100);
    $("volume-fill").style.width = percent + "%";
    $("volume-label").textContent = percent + "%";
    act("volume", { percent });
  };
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

const Demo = {
  playing: true,
  liked: false,
  at: 74000,
  since: performance.now(),
  call(op, args) {
    const ok = (data) => Promise.resolve({ status: 200, data });
    const art = (seed) => "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(' + seed + ' 80% 62%)"/><stop offset="1" stop-color="hsl(' + (seed + 90) + ' 70% 35%)"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><circle cx="6.4" cy="4" r="2.2" fill="hsl(' + (seed + 30) + ' 90% 80%)" opacity=".85"/></svg>');
    const track = (i) => ({ uri: "spotify:track:demo" + i, type: "track", name: ["Night Transit", "After Hours", "Neon Rain", "Chrome Heart", "Edge of Night"][i % 5], artists: [{ name: ["Talia Yang", "North Light", "Lucy", "Rebecca"][i % 4] }], album: { name: "Demo", images: [{ url: art(i * 47), width: 600 }] }, duration_ms: 200000 + i * 7000 });
    if (op === "status") return ok({ configured: true, connected: true, character: new URLSearchParams(location.search).get("character") || "talia" });
    if (op === "state") {
      const at = this.at + (this.playing ? performance.now() - this.since : 0);
      return ok({ is_playing: this.playing, progress_ms: at, shuffle_state: false, repeat_state: "off", device: { volume_percent: 65 }, context: null, item: track(0) });
    }
    if (op === "pause" || op === "play") { this.at += this.playing ? performance.now() - this.since : 0; this.since = performance.now(); this.playing = op === "play"; return ok({}); }
    if (op === "contains") return ok([this.liked]);
    if (op === "like" || op === "unlike") { this.liked = op === "like"; return ok({}); }
    if (op === "playlists") return ok({ items: Array.from({ length: 12 }, (_, i) => ({ id: "p" + i, uri: "spotify:playlist:p" + i, name: ["Ночной город", "Edgerunners", "Для работы", "Chill", "Рок", "Синтвейв"][i % 6] + " " + (i + 1), images: [{ url: art(i * 33), width: 300 }], items: { total: 20 + i } })), next: null });
    if (op === "playlist" || op === "liked") return ok({ items: Array.from({ length: 14 }, (_, i) => ({ item: track(i), track: track(i) })), next: null });
    if (op === "search" || op === "search-tracks") return ok({
      tracks: { items: Array.from({ length: 6 }, (_, i) => Object.assign(track(i), { album: { uri: "spotify:album:demo", name: "Demo", images: [{ url: art(i * 47), width: 600 }] }, artists: [{ id: "a" + i, name: ["Talia Yang", "North Light", "Lucy"][i % 3] }] })), next: "x" },
      artists: { items: Array.from({ length: 4 }, (_, i) => ({ id: "a" + i, uri: "spotify:artist:a" + i, name: ["Talia Yang", "North Light", "Lucy", "Rebecca"][i], images: [{ url: art(i * 80), width: 300 }], genres: ["synthwave"] })) },
      albums: { items: Array.from({ length: 4 }, (_, i) => ({ id: "al" + i, uri: "spotify:album:al" + i, name: "Album " + i, album_type: "album", release_date: "2026-01-01", artists: [{ name: "Talia Yang" }], images: [{ url: art(i * 30), width: 300 }] })) },
      playlists: { items: [] },
    });
    if (op === "artist") return ok({ id: args.id, uri: "spotify:artist:" + args.id, name: "Talia Yang", genres: ["synthwave", "dark pop"], images: [{ url: art(80), width: 300 }] });
    if (op === "artist-albums") return ok({ items: Array.from({ length: 7 }, (_, i) => ({ id: "al" + i, name: "Release " + i, album_type: i < 3 ? "album" : "single", release_date: "202" + i + "-01-01", images: [{ url: art(i * 30), width: 300 }] })) });
    if (op === "album") return ok({ id: args.id, uri: "spotify:album:" + args.id, name: "Night Transit", album_type: "album", release_date: "2026-03-01", artists: [{ id: "a0", name: "Talia Yang" }], images: [{ url: art(30), width: 600 }], tracks: { total: 8, items: Array.from({ length: 8 }, (_, i) => Object.assign(track(i), { artists: [{ id: "a0", name: "Talia Yang" }] })), next: null } });

    if (op === "character") return ok({ character: "talia", dances: ["dance-hype", "dance-shuffle", "dance-hiphop"].map((id) => ({ id, frames: Array.from({ length: 87 }, (_, i) => "../characters/talia/" + id + "/" + String(i).padStart(3, "0") + ".png"), delays: Array(87).fill(42) })) });
    if (op === "mixes") return ok({ items: [{ uri: "spotify:playlist:37i9dQZF1E1", name: "Daily Mix 1", artists: ["Talia Yang", "Lucy"], art: art(200) }, { uri: "spotify:playlist:37i9dQZF1E2", artists: ["North Light"], cover: art(120) }], historyClosed: false });
    if (op === "queue") return ok({ currently_playing: track(0), queue: Array.from({ length: 8 }, (_, i) => track(i + 1)) });
    return ok({});
  },
};

function section(box, title) {
  const h = document.createElement("h3");
  h.className = "section";
  h.textContent = title;
  box.appendChild(h);
}

function card(item, sub, onClick, round) {
  const c = document.createElement("button");
  c.className = "card" + (round ? " round" : "");
  const art = image(item.images, 300);
  c.innerHTML = (art ? '<img alt="">' : '<div class="ph"></div>') + '<div class="name"></div><div class="sub"></div>';
  if (art) c.querySelector("img").src = art;
  c.querySelector(".name").textContent = item.name;
  c.querySelector(".sub").textContent = sub || "";
  c.onclick = onClick;
  return c;
}

function grid(box, items) {
  const g = document.createElement("div");
  g.className = "grid";
  items.forEach((i) => g.appendChild(i));
  box.appendChild(g);
  return g;
}

function trackList(box) {
  const t = document.createElement("div");
  t.className = "tracks";
  box.appendChild(t);
  return t;
}

function note(box, text) {
  const n = document.createElement("div");
  n.className = "empty";
  n.textContent = text;
  box.appendChild(n);
}

function year(album) { return (album.release_date || "").slice(0, 4); }
function kind(album) { return album.album_type === "single" ? "Сингл" : album.album_type === "compilation" ? "Сборник" : "Альбом"; }

const Search = {
  query: "",
  token: 0,
  trackOffset: 0,
  open() {
    const bar = $("searchbar");
    const box = bar.getBoundingClientRect();
    bar.classList.add("typing");
    if (!bridge) {
      const text = prompt("Поиск", this.query);
      bar.classList.remove("typing");
      if (text !== null) this.run(text.trim());
      return;
    }
    call("search-input", { x: box.left, y: box.top, w: box.width, h: box.height, scale: window.devicePixelRatio || 1, text: this.query })
      .catch(() => bar.classList.remove("typing"));
  },
  async run(query) {
    this.query = query;
    const label = $("search-text");
    label.textContent = query || "Что хочешь послушать?";
    label.classList.toggle("placeholder", !query);
    const box = $("search-results");
    const token = ++this.token;
    if (!query) { box.innerHTML = ""; return; }
    let reply;
    try { reply = await call("search", { q: query }); }
    catch (error) { return toast("Поиск: " + error.message); }
    if (token !== this.token) return;
    box.innerHTML = "";
    if (reply.status !== 200 || !reply.data) return note(box, "Spotify не ответил на поиск (" + reply.status + ")");
    const d = reply.data;
    const tracks = ((d.tracks && d.tracks.items) || []).filter(Boolean);
    const artists = ((d.artists && d.artists.items) || []).filter(Boolean);
    const albums = ((d.albums && d.albums.items) || []).filter(Boolean);
    const lists = ((d.playlists && d.playlists.items) || []).filter(Boolean);
    if (!tracks.length && !artists.length && !albums.length && !lists.length) return note(box, "Ничего не нашлось.");
    if (tracks.length) {
      section(box, "Треки");
      const list = trackList(box);
      tracks.forEach((t) => list.appendChild(row(t, () => act("play", { context: t.album.uri, uri: t.uri }))));
      this.trackOffset = tracks.length;
      if (d.tracks.next) {
        const more = document.createElement("button");
        more.className = "ghost more";
        more.textContent = "Ещё треки";
        more.onclick = () => this.moreTracks(list, more, token);
        box.appendChild(more);
      }
    }
    if (artists.length) {
      section(box, "Артисты");
      grid(box, artists.map((a) => card(a, (a.genres || []).slice(0, 2).join(", ") || "Артист", () => openArtist(a.id), true)));
    }
    if (albums.length) {
      section(box, "Альбомы и синглы");
      grid(box, albums.map((a) => card(a, [year(a), names(a.artists)].filter(Boolean).join(" · "), () => openAlbum(a.id))));
    }
    if (lists.length) {
      section(box, "Плейлисты");
      grid(box, lists.map((p) => card(p, p.owner && p.owner.display_name ? "Автор: " + p.owner.display_name : "",
        () => act("play", { context: p.uri }, (r) => { if (r && r.status < 300) toast("Включаю «" + p.name + "»"); }))));
    }
  },
  async moreTracks(list, button, token) {
    button.disabled = true;
    let reply;
    try { reply = await call("search-tracks", { q: this.query, offset: this.trackOffset }); }
    catch (error) { button.disabled = false; return toast("Поиск: " + error.message); }
    if (token !== this.token) return;
    button.disabled = false;
    if (reply.status !== 200 || !reply.data) return toast("Spotify ответил " + reply.status);
    const items = (reply.data.tracks.items || []).filter(Boolean);
    items.forEach((t) => list.appendChild(row(t, () => act("play", { context: t.album.uri, uri: t.uri }))));
    this.trackOffset += items.length;
    if (!reply.data.tracks.next || !items.length) button.remove();
  },
};

const Detail = {
  stack: [],
  token: 0,
  begin(entry) {
    const fresh = state.view !== "detail";
    showView("detail");
    if (fresh) this.stack = [];
    this.stack.push(entry);
    const body = $("detail-body");
    body.innerHTML = "";
    body.scrollTop = 0;
    return { body, token: ++this.token };
  },
  back() {
    this.stack.pop();
    const prev = this.stack.pop();
    if (!prev) return showView(state.tab || "now");
    if (prev.kind === "artist") openArtist(prev.id); else openAlbum(prev.id);
  },
};

function hero(body, item, kindLabel, info, round, playLabel, onPlay) {
  const h = document.createElement("div");
  h.className = "hero" + (round ? " artist" : "");
  h.innerHTML = '<img alt=""><div><div class="kind"></div><h2></h2><div class="info"></div><button class="ghost accent"></button></div>';
  const art = image(item.images, 300);
  if (art) h.querySelector("img").src = art;
  h.querySelector(".kind").textContent = kindLabel;
  h.querySelector("h2").textContent = item.name;
  if (typeof info === "string") h.querySelector(".info").textContent = info;
  else h.querySelector(".info").appendChild(info);
  const play = h.querySelector("button");
  play.textContent = playLabel;
  play.onclick = onPlay;
  body.appendChild(h);
}

async function openArtist(id) {
  const { body, token } = Detail.begin({ kind: "artist", id });
  let artist, albums;
  try { [artist, albums] = await Promise.all([call("artist", { id }), call("artist-albums", { id, limit: 10 })]); }
  catch (error) { return toast("Артист: " + error.message); }
  if (token !== Detail.token) return;
  if (artist.status !== 200 || !artist.data) return note(body, "Spotify не отдал артиста (" + artist.status + ")");
  const a = artist.data;
  const listeners = a.listeners ? Number(a.listeners).toLocaleString("ru-RU") + " слушателей за месяц" : (a.genres || []).slice(0, 4).join(", ");
  hero(body, a, "Артист", listeners, true, "Слушать артиста",
    () => act("play", { context: a.uri }, (r) => { if (r && r.status < 300) toast("Включаю " + a.name); }));
  if (a.top && a.top.length) {
    section(body, "Популярные треки");
    const list = trackList(body);
    a.top.slice(0, 10).forEach((t) => list.appendChild(row(t, () => act("play", { context: a.uri, uri: t.uri }))));
  }
  if (albums.status !== 200 || !albums.data) return note(body, "Дискографию Spotify не отдал (" + albums.status + ")");
  const items = (albums.data.items || []).filter(Boolean);
  let next = albums.data.next;
  for (let pages = 1; next && pages < 10; pages++) {
    let page;
    try { page = await call("artist-albums", { id, limit: 10, offset: items.length }); } catch (error) { break; }
    if (token !== Detail.token) return;
    if (page.status !== 200 || !page.data) break;
    const more = (page.data.items || []).filter(Boolean);
    if (!more.length) break;
    items.push(...more);
    next = page.data.next;
  }
  const full = items.filter((x) => x.album_type === "album");
  const singles = items.filter((x) => x.album_type !== "album");
  if (full.length) { section(body, "Альбомы"); grid(body, full.map((x) => card(x, year(x) + " · " + kind(x), () => openAlbum(x.id)))); }
  if (singles.length) { section(body, "Синглы и EP"); grid(body, singles.map((x) => card(x, year(x) + " · " + kind(x), () => openAlbum(x.id)))); }
  if (!items.length) note(body, "Релизов не нашлось.");
  if (a.related && a.related.length) {
    section(body, "Похожие артисты");
    grid(body, a.related.slice(0, 12).map((x) => card(x, "Артист", () => openArtist(x.id), true)));
  }
}

async function openAlbum(id) {
  const { body, token } = Detail.begin({ kind: "album", id });
  let reply;
  try { reply = await call("album", { id }); }
  catch (error) { return toast("Альбом: " + error.message); }
  if (token !== Detail.token) return;
  if (reply.status !== 200 || !reply.data) return note(body, "Spotify не отдал альбом (" + reply.status + ")");
  const album = reply.data;
  const info = document.createElement("span");
  (album.artists || []).forEach((artist, i) => {
    if (i) info.appendChild(document.createTextNode(", "));
    const link = document.createElement("span");
    link.className = "artist-link";
    link.style.cursor = "pointer";
    link.textContent = artist.name;
    link.onclick = () => openArtist(artist.id);
    info.appendChild(link);
  });
  const total = album.tracks ? album.tracks.total : 0;
  const word = total % 10 === 1 && total % 100 !== 11 ? "трек" : (total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 12 || total % 100 > 14)) ? "трека" : "треков";
  info.appendChild(document.createTextNode(" · " + year(album) + " · " + total + " " + word));
  hero(body, album, kind(album), info, false, "Слушать", () => act("play", { context: album.uri }));
  const list = trackList(body);
  const add = (items) => items.filter(Boolean).forEach((t) => {
    t.album = { images: album.images, uri: album.uri, name: album.name };
    list.appendChild(row(t, () => act("play", { context: album.uri, uri: t.uri })));
  });
  const first = album.tracks ? album.tracks.items || [] : [];
  add(first);
  let next = album.tracks && album.tracks.next, offset = first.length;
  while (next && token === Detail.token) {
    let page;
    try { page = await call("album-tracks", { id, offset }); } catch (error) { break; }
    if (page.status !== 200 || !page.data) break;
    const items = page.data.items || [];
    add(items);
    offset += items.length;
    next = page.data.next && items.length;
  }
}

function seeded(text) {
  let h = 2166136261;
  for (const ch of text || "") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Fx = {
  list: [],
  mode: "000-blobs",
  modeAt: 0,
  track: null,
  scale: 1,
  hits: [-100, -100, -100],
  beats: [-100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100],
  colors: [[1, .6, .73], [.52, .87, .92], [.52, .42, .75]],
  colorsAt: 0,
  center: [.38, .54, .2],
  centerAt: 0,
  gl: null,
  compiled: {},
  broken: {},
  setup() {
    this.list = fxModes();
    const canvas = $("fx");
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
    if (!gl) { console.warn("WebGL unavailable, background stays static"); return; }
    fxQuad(gl);
    this.gl = gl;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(innerWidth * dpr * this.scale));
      canvas.height = Math.max(1, Math.round(innerHeight * dpr * this.scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    addEventListener("resize", resize);
    resize();
  },
  program(id) {
    if (this.compiled[id]) return this.compiled[id];
    if (this.broken[id]) return null;
    const mode = this.list.find((m) => m.id === id);
    if (!mode) return null;
    try {
      this.compiled[id] = fxCompile(this.gl, mode.glsl);
      return this.compiled[id];
    } catch (error) {
      this.broken[id] = String(error.message || error);
      console.warn("background mode " + id + " failed to compile", this.broken[id]);
      return null;
    }
  },
  onTrack(uri) {
    if (!uri || uri === this.track || !this.list.length) return;
    this.track = uri;
    const next = this.list[Math.floor(seeded("fx|" + uri)() * this.list.length)].id;
    if (next !== this.mode) this.modeAt = performance.now();
    this.mode = next;
    document.body.dataset.fx = this.mode;
    this.release();
  },
  release() {
    if (!this.gl) return;
    for (const id of Object.keys(this.compiled)) {
      if (id === this.mode || id === "000-blobs") continue;
      this.gl.deleteProgram(this.compiled[id].program);
      delete this.compiled[id];
    }
  },
  onHit() {
    const now = Date.now() / 1000 % 10000;
    this.hits = [now, this.hits[0], this.hits[1]];
    this.beats = [now].concat(this.beats.slice(0, 15));
  },
  readColors(now) {
    if (now - this.colorsAt < 100) return;
    this.colorsAt = now;
    const style = getComputedStyle(document.documentElement);
    this.colors = ["--c1", "--c2", "--c3"].map((name, i) => {
      const m = style.getPropertyValue(name).match(/[\d.]+/g);
      return m && m.length >= 3 ? m.slice(0, 3).map((v) => Number(v) / 255) : this.colors[i];
    });
  },
  readCenter(now) {
    if (now - this.centerAt < 500) return;
    this.centerAt = now;
    const cover = $("cover");
    const box = cover && cover.offsetParent ? cover.getBoundingClientRect() : null;
    if (box && box.width) this.center = [(box.left + box.width / 2) / innerWidth, 1 - (box.top + box.height / 2) / innerHeight, box.width / 2 / innerHeight];
  },
  frame(n, now) {
    if (!this.gl) return;
    this.readColors(now);
    this.readCenter(now);
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    this.starClock = ((this.starClock || Date.now() / 1000 % 100000) + dt * (1 + n.level * 1.8)) % 100000;
    const compiled = this.program(this.mode) || this.program("000-blobs");
    if (!compiled) return;
    fxDraw(this.gl, compiled, {
      time: Date.now() / 1000 % 10000,
      fade: Math.min(1, (now - this.modeAt) / 1500),
      star: this.starClock,
      colors: this.colors,
      center: this.center,
      hits: this.hits,
      beats: this.beats,
      audio: [n.bass, n.mid, n.high, n.level],
    });
  },
};

const Stage = {
  height: 58,
  character: null,
  dances: [],
  shown: false,
  async load() {
    let reply;
    try { reply = await call("character"); }
    catch (error) { return console.warn("character load failed", error); }
    if (!reply || reply.status !== 200 || !reply.data) return;
    if (reply.data.character === this.character) return;
    this.character = reply.data.character;
    this.dances.forEach((d) => this.release(d));
    this.dances = (reply.data.dances || []).map((d) => ({ ...d, images: null, ready: false, total: d.delays.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.plan = null;
  },
  plan: null,
  at(uri, ms) {
    if (!this.plan || this.plan.uri !== uri || this.plan.count !== this.dances.length) this.plan = { uri, count: this.dances.length, rng: seeded("dance|" + uri), segments: [], end: 0 };
    const plan = this.plan;
    while (plan.end <= ms + 60000) {
      const last = plan.segments.length ? plan.segments[plan.segments.length - 1].dance : null;
      const choices = this.dances.length > 1 ? this.dances.filter((d) => d !== last) : this.dances;
      const dance = choices[Math.floor(plan.rng() * choices.length)];
      const loops = 1 + Math.floor(plan.rng() * 10);
      plan.segments.push({ dance, start: plan.end, length: dance.total * loops });
      plan.end += dance.total * loops;
    }
    let i = 0;
    while (i < plan.segments.length - 1 && ms >= plan.segments[i].start + plan.segments[i].length) i++;
    const segment = plan.segments[i];
    return { dance: segment.dance, offset: ms - segment.start, next: plan.segments[i + 1] && plan.segments[i + 1].dance };
  },
  prepare(dance) {
    if (!dance || dance.loading) return;
    const ticket = dance.loading = {};
    const originals = dance.frames.map((src) => { const img = new Image(); img.decoding = "async"; img.src = src; return img; });
    Promise.all(originals.map((img) => img.decode().catch(() => null))).then(async () => {
      if (dance.loading !== ticket) return;
      this.measure(dance, originals);
      const dpr = window.devicePixelRatio || 1;
      const scale = this.height / dance.figure;
      const bitmaps = await Promise.all(originals.map((img) => img.naturalWidth
        ? createImageBitmap(img, { resizeWidth: Math.max(1, Math.round(img.naturalWidth * scale * dpr)), resizeHeight: Math.max(1, Math.round(img.naturalHeight * scale * dpr)), resizeQuality: "high" }).catch(() => null)
        : null));
      if (dance.loading !== ticket) return bitmaps.forEach((b) => b && b.close());
      dance.images = bitmaps;
      dance.scale = scale;
      dance.dpr = dpr;
      dance.ready = true;
    });
  },
  release(dance) {
    if (!dance || !dance.loading) return;
    if (dance.images) dance.images.forEach((b) => b && b.close());
    dance.images = null;
    dance.loading = null;
    dance.ready = false;
  },
  measure(dance, images) {
    const probe = document.createElement("canvas");
    const g = probe.getContext("2d", { willReadFrequently: true });
    const first = images[0];
    const w = 160, k = w / first.naturalWidth, h = Math.max(1, Math.round(first.naturalHeight * k));
    probe.width = w; probe.height = h;
    let top = h, bottom = 0, left = w, right = 0;
    const samples = [0, .25, .5, .75].map((f) => images[Math.floor(f * (images.length - 1))]);
    for (const img of samples) {
      if (!img.naturalWidth) continue;
      g.clearRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] < 60) continue;
        if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x;
      }
    }
    if (bottom <= top) { top = 0; bottom = h; left = 0; right = w; }
    const anchor = dance.anchor && dance.anchor.kind === "feet" ? dance.anchor : null;
    dance.figure = (bottom - top + 1) / k;
    dance.feetY = anchor ? anchor.y : (bottom + 1) / k;
    dance.centerX = anchor ? anchor.x : ((left + right + 1) / 2) / k;
  },
  frame() {
    const canvas = $("stage-dancer");
    const p = state.playback;
    const playing = !!(p && p.is_playing && p.item);
    if (!playing || !this.dances.length) return this.show(false);
    const duration = p.item.duration_ms || 1;
    const position = Math.min(duration, (p.progress_ms || 0) + (performance.now() - state.fetchedAt));
    const share = position / duration;
    const slot = this.at(p.item.uri, position);
    const dance = slot.dance;
    for (const other of this.dances) if (other !== dance && other !== slot.next) this.release(other);
    this.prepare(dance);
    this.prepare(slot.next);
    if (!dance.ready) return this.show(false);
    let t = slot.offset % dance.total, index = 0;
    while (index < dance.delays.length - 1 && t >= dance.delays[index]) { t -= dance.delays[index]; index++; }
    const img = dance.images[index];
    if (!img) return;
    const scale = dance.scale, dpr = dance.dpr;
    const pw = img.width, ph = img.height;
    const cssW = pw / dpr, cssH = ph / dpr;
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.style.left = share * 100 + "%";
    canvas.style.marginLeft = -dance.centerX * scale + "px";
    canvas.style.bottom = "calc(50% - " + (cssH - dance.feetY * scale) + "px)";
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, pw, ph);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, pw, ph);
    this.show(true);
  },
  show(on) {
    if (on === this.shown) return;
    this.shown = on;
    $("stage-dancer").classList.toggle("on", on);
    $("knob").classList.toggle("away", on);
  },
};

function scrollAt(x, y, delta) {
  const dpr = window.devicePixelRatio || 1;
  let el = document.elementFromPoint(x / dpr, y / dpr);
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) break;
    el = el.parentElement;
  }
  if (!el || el === document.body) return;
  el.scrollBy({ top: -delta / 120 * 120, behavior: "smooth" });
}

function nearEnd(box) { return box.scrollTop + box.clientHeight >= box.scrollHeight - 300; }

function autoMore() {
  const pairs = [["liked-tracks", "liked-more"], ["playlist-tracks", "playlists-more"], ["playlist-home", "playlists-more"], ["search-results", null]];
  for (const [boxId, moreId] of pairs) {
    const box = $(boxId);
    if (!box) continue;
    box.addEventListener("scroll", () => {
      if (!nearEnd(box)) return;
      const more = moreId ? $(moreId) : box.querySelector(".ghost.more");
      if (more && !more.hidden && !more.disabled && more.offsetParent) more.click();
    }, { passive: true });
  }
}

async function refreshCharacter() {
  let status;
  try { status = await call("status"); }
  catch (error) { return toast("Персонаж: " + error.message); }
  const info = (status && status.data) || {};
  document.body.dataset.character = info.character || "talia";
  $("brand-name").textContent = info.character === "capri" ? "CAPRI · SPOTIFY" : "Talia · Spotify";
  Stage.load();
}

const Pulse = {
  target: { bass: 0, mid: 0, high: 0, level: 0 },
  now: { bass: 0, mid: 0, high: 0, level: 0 },
  phase: 0,
  lastFeed: 0,
  feed([bass, mid, high, level, hit]) {
    this.target = { bass, mid, high, level };
    this.lastFeed = performance.now();
    if (hit) this.hit();
  },
  hit() {
    Fx.onHit();
  },
  last: 0,
  frame() {
    requestAnimationFrame(() => this.frame());
    const clock = performance.now();
    if (clock - this.last < 1000 / 60 - 2) return;
    this.last = clock;
    if (clock - this.lastFeed > 600) this.target = { bass: 0, mid: 0, high: 0, level: 0 };
    const n = this.now, t = this.target;
    for (const key of ["bass", "mid", "high", "level"]) n[key] += (t[key] - n[key]) * (t[key] > n[key] ? .35 : .08);
    document.querySelector(".brand .pulse").style.scale = 1 + n.bass * .8;
    Fx.frame(n, clock);
    Stage.frame();
  },
};

if (!bridge) {
  let beatAt = 0;
  setInterval(() => {
    const t = performance.now() / 1000;
    const beat = (t % .5) < .05;
    const bass = Math.max(0, 1 - (t % .5) * 3.2);
    Pulse.feed([bass, .5 + .3 * Math.sin(t * 1.3), .4 + .4 * Math.sin(t * 3.1), .6 + .2 * Math.sin(t * .7), beat && t - beatAt > .4 ? (beatAt = t, 1) : 0]);
  }, 33);
}

wire();
autoMore();
Fx.setup();
boot();
requestAnimationFrame(() => Pulse.frame());
setInterval(tick, 250);
setInterval(refresh, 1500);
