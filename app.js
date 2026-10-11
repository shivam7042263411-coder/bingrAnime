/* BingrAnime — fresh UI reimagined from Pid24/anime-hub (MIT) patterns.
   Own implementation, AniList catalog only. No watch-player / scraper code. */
const API = "https://graphql.anilist.co";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || "").replace(/</g, "&lt;");
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "");

async function gql(query, variables = {}) {
  const r = await fetch(API, { method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error("AniList " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

const LIST = `query ($page:Int,$perPage:Int,$sort:[MediaSort]) {
  Page(page:$page, perPage:$perPage) {
    media(type:ANIME, sort:$sort, isAdult:false) {
      id title{romaji english} coverImage{large} bannerImage
      averageScore seasonYear episodes format status genres description(asHtml:false)
      siteUrl trailer{id site} } } }`;

const PROVIDERS = [
  ["Crunchyroll", "https://www.crunchyroll.com"],
  ["HIDIVE", "https://www.hidive.com"],
  ["Netflix Anime", "https://www.netflix.com/browse/genre/7424"],
  ["Hulu Anime", "https://www.hulu.com/genre/anime"],
  ["Muse Asia", "https://www.youtube.com/@MuseAsia"],
  ["Ani-One", "https://www.youtube.com/@AniOneAsia"],
];

let spotItems = [], spotIdx = 0, spotTimer;
function showSpot(i) {
  spotIdx = (i + spotItems.length) % spotItems.length;
  const m = spotItems[spotIdx];
  const title = m.title.english || m.title.romaji;
  $("spot-bg").style.backgroundImage = `url('${m.bannerImage || m.coverImage.large}')`;
  $("spot-kicker").textContent = `#${spotIdx + 1} Spotlight • ★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}`;
  $("spot-title").textContent = title;
  $("spot-meta").innerHTML = `<span class="score">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}</span><span><b>${m.seasonYear || ""}</b></span><span>${m.episodes ? m.episodes + " EP" : ""}</span><span>${esc(m.format || "")}</span><span>${esc(m.status || "")}</span>`;
  $("spot-tags").innerHTML = (m.genres || []).slice(0, 4).map((g) => `<span>${esc(g)}</span>`).join("");
  $("spot-desc").textContent = strip(m.description).slice(0, 220) + "…";
  $("spot-info").onclick = () => openDetail(m.id);
  const tb = $("spot-trailer-btn");
  if (m.trailer && m.trailer.site === "youtube" && m.trailer.id) {
    tb.style.display = "";
    tb.onclick = () => openDetail(m.id, true);
  } else tb.style.display = "none";
  document.querySelectorAll(".spot-dots i").forEach((d, k) => d.classList.toggle("on", k === spotIdx));
}
function spotAuto() { clearInterval(spotTimer); spotTimer = setInterval(() => showSpot(spotIdx + 1), 7000); }

const pct = (m) => `<span class="badge">${m.averageScore ? m.averageScore + "%" : "NEW"}</span>`;
const card = (m) => { const t = m.title.english || m.title.romaji;
  return `<div class="card" data-id="${m.id}"><div style="position:relative"><img loading="lazy" src="${m.coverImage.large}" alt="${esc(t)}" />${pct(m)}<div class="shade"></div></div>` +
  `<div class="t">${esc(t)}</div><div class="s">${m.seasonYear || "—"} • ${esc(m.format || "TV")}</div></div>`; };
function bindCards(root) { root.querySelectorAll("[data-id]").forEach((c) =>
  c.addEventListener("click", () => openDetail(+c.dataset.id))); }

// local library (My List + recents), browser only
const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const isListed = (id) => store.get("ba_mylist", []).some((x) => x.id === id);
function toggleList(item) {
  let l = store.get("ba_mylist", []);
  l = l.some((x) => x.id === item.id) ? l.filter((x) => x.id !== item.id)
    : [{ ...item, at: Date.now() }, ...l].slice(0, 24);
  store.set("ba_mylist", l);
}
const mini = (m) => `<div class="card" data-id="${m.id}"><div style="position:relative"><img loading="lazy" src="${m.cover}" alt="" /></div><div class="t">${esc(m.title)}</div><div class="s">★ ${m.score ? (m.score / 10).toFixed(1) : "–"}</div></div>`;
function renderLists() {
  const l = store.get("ba_mylist", []);
  $("mylist-wrap").classList.toggle("hidden", !l.length);
  if (l.length) { $("row-mylist").innerHTML = l.map(mini).join(""); bindCards($("row-mylist")); }
}

async function load() {
  $("provider-chips").innerHTML = PROVIDERS.map(([n, u]) =>
    `<a href="${u}" target="_blank" rel="noopener">${esc(n)} →</a>`).join("");
  const [trend, pop, top] = await Promise.all([
    gql(LIST, { page: 1, perPage: 8, sort: ["TRENDING_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["POPULARITY_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["SCORE_DESC"] }),
  ]);
  spotItems = trend.Page.media.filter((m) => m.bannerImage).concat(trend.Page.media).slice(0, 7);
  $("spot-dots").innerHTML = spotItems.map(() => "<i></i>").join("");
  document.querySelectorAll(".spot-dots i").forEach((d, k) => d.onclick = () => { showSpot(k); spotAuto(); });
  showSpot(0); spotAuto();
  $("spot-prev").onclick = () => { showSpot(spotIdx - 1); spotAuto(); };
  $("spot-next").onclick = () => { showSpot(spotIdx + 1); spotAuto(); };
  $("row-trending").innerHTML = trend.Page.media.map(card).join("");
  $("row-popular").innerHTML = pop.Page.media.map(card).join("");
  $("row-top").innerHTML = top.Page.media.map(card).join("");
  ["row-trending", "row-popular", "row-top"].forEach((id) => bindCards($(id)));
  try {
    const sq = `query { Page(page:1, perPage:12){ airingSchedules(notYetAired:true, sort:[TIME]) {
      airingAt episode media{ id title{romaji english} coverImage{large} bannerImage } } } }`;
    const sd = await gql(sq);
    $("row-schedule").innerHTML = sd.Page.airingSchedules.map((a) => {
      const m = a.media, t = m.title.english || m.title.romaji;
      const when = new Date(a.airingAt * 1000).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
      return `<div class="card" data-id="${m.id}"><div style="position:relative"><img loading="lazy" src="${m.bannerImage || m.coverImage.large}" alt="" /><span class="ep">EP ${a.episode}</span><div class="shade"></div></div><div class="t">${esc(t)}</div><div class="s">${esc(when)}</div></div>`;
    }).join("");
    bindCards($("row-schedule"));
  } catch { $("row-schedule").textContent = "Schedule unavailable"; }
  renderLists();
}

async function openDetail(id, jumpTrailer = false) {
  const d = $("detail");
  d.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("detail-title").textContent = "Loading…";
  $("trailer-card").classList.add("hidden");
  $("recs-card").classList.add("hidden");
  const q = `query ($id:Int){ Media(id:$id, type:ANIME){
    title{romaji english} coverImage{large} bannerImage averageScore seasonYear
    episodes format status genres description(asHtml:false) siteUrl
    trailer{id site} externalLinks{site url} studios{nodes{name}}
    recommendations(page:1, perPage:8, sort:[RATING_DESC]){ nodes{ mediaRecommendation{
      id title{romaji english} coverImage{large} averageScore seasonYear format } } } } }`;
  try {
    const r = await gql(q, { id });
    const m = r.Media, title = m.title.english || m.title.romaji;
    $("detail-bg").style.backgroundImage = `url('${m.bannerImage || m.coverImage.large}')`;
    $("detail-poster").src = m.coverImage.large;
    $("detail-title").textContent = title;
    $("detail-meta").innerHTML = `<span class="score">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"} (${m.averageScore || "–"}%)</span><span><b>${m.seasonYear || ""}</b></span><span>${m.episodes ? m.episodes + " EP" : ""}</span><span>${esc(m.format || "")}</span><span>${esc(m.status || "")}</span>`;
    $("detail-tags").innerHTML = (m.genres || []).slice(0, 6).map((g) => `<span>${esc(g)}</span>`).join("") +
      (m.studios?.nodes || []).slice(0, 2).map((s) => `<span>${esc(s.name)}</span>`).join("");
    $("detail-desc").textContent = strip(m.description).slice(0, 700);
    $("detail-links").innerHTML = `<a href="${m.siteUrl}" target="_blank" rel="noopener">AniList →</a>` +
      (m.externalLinks || []).slice(0, 6).map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${esc(l.site)} →</a>`).join("") +
      `<a href="#" id="mylist-toggle">${isListed(id) ? "✓ In My List" : "+ My List"}</a>`;
    $("mylist-toggle").onclick = (e) => { e.preventDefault();
      toggleList({ id, title, cover: m.coverImage.large, score: m.averageScore });
      e.target.textContent = isListed(id) ? "✓ In My List" : "+ My List"; renderLists(); };
    if (m.trailer && m.trailer.site === "youtube" && m.trailer.id) {
      $("trailer-card").classList.remove("hidden");
      $("detail-trailer").innerHTML = `<iframe src="https://www.youtube.com/embed/${m.trailer.id}?rel=0" allow="encrypted-media; picture-in-picture" allowfullscreen title="Trailer"></iframe>`;
    }
    const recs = (m.recommendations?.nodes || []).map((n) => n.mediaRecommendation).filter(Boolean);
    if (recs.length) {
      $("recs-card").classList.remove("hidden");
      $("detail-recs").innerHTML = recs.map(card).join("");
      bindCards($("detail-recs"));
    }
    let l = store.get("ba_recent", []).filter((x) => x.id !== id);
    store.set("ba_recent", [{ id, title, cover: m.coverImage.large, score: m.averageScore }, ...l].slice(0, 12));
    location.hash = "/anime/" + id;
    if (jumpTrailer) $("trailer-card").scrollIntoView();
  } catch (e) { $("detail-title").textContent = "Failed: " + e.message; }
}
function closeDetail() { $("detail").classList.add("hidden"); document.body.style.overflow = ""; history.replaceState(null, "", location.pathname); }
$("detail-back").onclick = closeDetail;

// header scroll + mobile menu + nav highlight
addEventListener("scroll", () => $("header").classList.toggle("scrolled", scrollY > 60), { passive: true });
$("menu-btn").onclick = () => $("mobile-sheet").classList.toggle("hidden");
document.querySelectorAll("#mobile-sheet a").forEach((a) => a.onclick = () => $("mobile-sheet").classList.add("hidden"));

// search
let t;
$("search").addEventListener("input", (e) => {
  clearTimeout(t);
  const q = e.target.value.trim();
  if (!q) { $("results").classList.add("hidden"); return; }
  t = setTimeout(async () => {
    const query = `query ($s:String){ Page(page:1, perPage:8){ media(search:$s, type:ANIME, isAdult:false){ id title{romaji english} coverImage{large} seasonYear } } }`;
    try {
      const d = await gql(query, { s: q });
      $("results").innerHTML = d.Page.media.map((m) =>
        `<div class="hit" data-id="${m.id}"><img src="${m.coverImage.large}" /><div><div>${esc(m.title.english || m.title.romaji)}</div><div style="color:#888;font-size:12px">${m.seasonYear || ""}</div></div></div>`).join("") || "No results";
      $("results").classList.remove("hidden");
      $("results").querySelectorAll(".hit[data-id]").forEach((h) =>
        h.addEventListener("click", () => { $("results").classList.add("hidden"); openDetail(+h.dataset.id); }));
    } catch {}
  }, 350);
});

if (location.hash.startsWith("#/anime/")) {
  const id = +location.hash.split("/")[2];
  if (id) load().then(() => openDetail(id));
} else {
  load().catch((e) => { $("spot-title").textContent = "Failed: " + e.message; });
}
