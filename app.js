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
      averageScore seasonYear episodes format genres description(asHtml:false) siteUrl
    }
  }
}`;

let heroItems = [], heroIdx = 0, heroTimer;

function showHero(i) {
  heroIdx = (i + heroItems.length) % heroItems.length;
  const m = heroItems[heroIdx];
  const title = m.title.english || m.title.romaji;
  $("hero-bg").style.backgroundImage = `url('${m.bannerImage || m.coverImage.large}')`;
  $("hero-kicker").textContent = `#${heroIdx + 1} Spotlight • ★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}`;
  $("hero-title").textContent = title;
  $("hero-meta").innerHTML = `<span class="score">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}</span><span><b>${m.seasonYear || ""}</b></span><span>${m.episodes ? m.episodes + " EP" : ""}</span><span>${esc(m.format || "")}</span>`;
  $("hero-tags").innerHTML = (m.genres || []).slice(0, 4).map((g) => `<span>${esc(g)}</span>`).join("");
  $("hero-desc").textContent = strip(m.description).slice(0, 240) + "…";
  $("hero-anilist").href = m.siteUrl;
  $("hero-info").onclick = () => openDetail(m.id);
  document.querySelectorAll(".hero-dots i").forEach((d, k) => d.classList.toggle("on", k === heroIdx));
}
function heroAuto() { clearInterval(heroTimer); heroTimer = setInterval(() => showHero(heroIdx + 1), 6000); }

const shelfCard = (m) => `<div class="card" data-id="${m.id}">
  <img loading="lazy" src="${m.coverImage.large}" alt="" />
  <div class="t">${esc(m.title.english || m.title.romaji)}</div>
  <div class="s">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}${m.seasonYear ? " • " + m.seasonYear : ""}</div></div>`;

function bindCards(root) {
  root.querySelectorAll("[data-id]").forEach((c) =>
    c.addEventListener("click", () => openDetail(+c.dataset.id)));
}

const STUDIOS = ["MAPPA", "Ufotable", "Kyoto Animation", "Wit Studio", "Bones", "Madhouse", "A-1 Pictures", "Trigger"];

async function load() {
  const [trend, cur, pop, top] = await Promise.all([
    gql(LIST, { page: 1, perPage: 10, sort: ["TRENDING_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["POPULARITY_DESC"] }),
    gql(LIST, { page: 2, perPage: 12, sort: ["POPULARITY_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["SCORE_DESC"] }),
  ]);
  // hero carousel
  heroItems = trend.Page.media.filter((m) => m.bannerImage).concat(trend.Page.media).slice(0, 7);
  $("hero-dots").innerHTML = heroItems.map(() => "<i></i>").join("");
  document.querySelectorAll(".hero-dots i").forEach((d, k) => d.onclick = () => { showHero(k); heroAuto(); });
  showHero(0); heroAuto();
  $("hero-prev").onclick = () => { showHero(heroIdx - 1); heroAuto(); };
  $("hero-next").onclick = () => { showHero(heroIdx + 1); heroAuto(); };
  // top 10 numbered
  $("row-trending").innerHTML = trend.Page.media.map((m, i) =>
    `<div class="t10" data-id="${m.id}"><div class="num">${i + 1}</div><img loading="lazy" src="${m.coverImage.large}" title="${esc(m.title.english || m.title.romaji)}" /></div>`).join("");
  $("row-new").innerHTML = cur.Page.media.map(shelfCard).join("");
  $("row-popular").innerHTML = pop.Page.media.map(shelfCard).join("");
  $("row-top").innerHTML = top.Page.media.map(shelfCard).join("");
  ["row-trending", "row-new", "row-popular", "row-top"].forEach((id) => bindCards($(id)));
  // simulcast calendar (AiringSchedule) — Crunchyroll-style
  try {
    const now = Math.floor(Date.now() / 1000);
    const sq = `query { Page(page:1, perPage:12){ airingSchedules(notYetAired:true, sort:[TIME]) {
      airingAt episode media{ id title{romaji english} coverImage{large} bannerImage siteUrl } } } }`;
    const sd = await gql(sq);
    $("row-schedule").innerHTML = sd.Page.airingSchedules.map((a) => {
      const m = a.media;
      const dt = new Date(a.airingAt * 1000);
      const when = dt.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
      return `<div class="card landscape" data-id="${m.id}"><span class="ep">EP ${a.episode}</span><img loading="lazy" src="${m.bannerImage || m.coverImage.large}" alt="" />` +
        `<div class="t">${esc(m.title.english || m.title.romaji)}</div>` +
        `<div class="s">${esc(when)}</div></div>`;
    }).join("");
    bindCards($("row-schedule"));
  } catch (e) { $("row-schedule").textContent = "Schedule unavailable"; }
  // studios
  $("studio-grid").innerHTML = STUDIOS.map((s) => `<div class="studio" data-s="${esc(s)}">${esc(s)}<small>tap to explore →</small></div>`).join("");
  document.querySelectorAll(".studio").forEach((el) =>
    el.addEventListener("click", () => studioSearch(el.dataset.s)));
}

async function studioSearch(name) {
  $("studio-results-wrap").classList.remove("hidden");
  $("studio-title").textContent = name;
  $("studio-results").innerHTML = "Loading…";
  const q = `query ($s:String){ Page(page:1, perPage:12){ media(search:$s, type:ANIME, isAdult:false){
    id title{romaji english} coverImage{large} averageScore seasonYear siteUrl } } }`;
  try {
    const d = await gql(q, { s: name });
    $("studio-results").innerHTML = d.Page.media.map(shelfCard).join("");
    bindCards($("studio-results"));
    document.getElementById("studio-results-wrap").scrollIntoView({ behavior: "smooth" });
  } catch (e) { $("studio-results").textContent = "Failed: " + e.message; }
}

async function openDetail(id) {
  const d = $("detail");
  d.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("detail-title").textContent = "Loading…";
  const q = `query ($id:Int){ Media(id:$id, type:ANIME){
    title{romaji english} coverImage{large} bannerImage averageScore seasonYear
    episodes format status genres description(asHtml:false) siteUrl
    trailer{id site} externalLinks{site url} studios{nodes{name}} } }`;
  try {
    const r = await gql(q, { id });
    const m = r.Media;
    const title = m.title.english || m.title.romaji;
    $("detail-bg").style.backgroundImage = `url('${m.bannerImage || m.coverImage.large}')`;
    $("detail-poster").src = m.coverImage.large;
    $("detail-title").textContent = title;
    $("detail-meta").innerHTML = `<span class="score">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}</span><span><b>${m.seasonYear || ""}</b></span><span>${m.episodes ? m.episodes + " EP" : ""}</span><span>${esc(m.format || "")}</span><span>${esc(m.status || "")}</span>`;
    $("detail-tags").innerHTML = (m.genres || []).map((g) => `<span>${esc(g)}</span>`).join("") +
      (m.studios?.nodes || []).slice(0, 2).map((s) => `<span>${esc(s.name)}</span>`).join("");
    $("detail-desc").textContent = strip(m.description).slice(0, 700);
    $("detail-links").innerHTML = `<a href="${m.siteUrl}" target="_blank" rel="noopener">AniList →</a>` +
      (m.externalLinks || []).slice(0, 6).map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${esc(l.site)} →</a>`).join("") +
      (m.trailer?.site === "youtube" ? `<a href="https://www.youtube.com/watch?v=${m.trailer.id}" target="_blank" rel="noopener">Trailer →</a>` : "") +
      `<a href="#" id="mylist-toggle">${isListed(id) ? "✓ In My List" : "+ My List"}</a>`;
    const tgl = $("mylist-toggle");
    if (tgl) tgl.onclick = (e) => { e.preventDefault(); toggleList({ id, title, cover: m.coverImage.large, score: m.averageScore, year: m.seasonYear }); tgl.textContent = isListed(id) ? "✓ In My List" : "+ My List"; renderLists(); };
    pushRecent({ id, title, cover: m.coverImage.large, score: m.averageScore, year: m.seasonYear });
    renderLists();
    location.hash = "/anime/" + id;
  } catch (e) { $("detail-title").textContent = "Failed: " + e.message; }
}
function closeDetail() { $("detail").classList.add("hidden"); document.body.style.overflow = ""; history.replaceState(null, "", location.pathname); }
$("detail-back").onclick = closeDetail;

// My List + Recently Viewed (browser localStorage, Nuvio-style library)
const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const isListed = (id) => store.get("ba_mylist", []).some((x) => x.id === id);
function toggleList(item) {
  let l = store.get("ba_mylist", []);
  l = l.some((x) => x.id === item.id) ? l.filter((x) => x.id !== item.id) : [{ ...item, at: Date.now() }, ...l].slice(0, 24);
  store.set("ba_mylist", l);
}
function pushRecent(item) {
  let r = store.get("ba_recent", []).filter((x) => x.id !== item.id);
  store.set("ba_recent", [{ ...item, at: Date.now() }, ...r].slice(0, 12));
}
const miniCard = (m) => `<div class="card" data-id="${m.id}"><img loading="lazy" src="${m.cover}" alt="" />` +
  `<div class="t">${esc(m.title)}</div><div class="s">★ ${m.score ? (m.score / 10).toFixed(1) : "–"}${m.year ? " • " + m.year : ""}</div></div>`;
function renderLists() {
  const l = store.get("ba_mylist", []), r = store.get("ba_recent", []);
  $("mylist-wrap").classList.toggle("hidden", !l.length);
  $("recent-wrap").classList.toggle("hidden", !r.length);
  $("row-mylist").innerHTML = l.map(miniCard).join("");
  $("row-recent").innerHTML = r.map(miniCard).join("");
  [$("row-mylist"), $("row-recent")].forEach(bindCards);
}
renderLists();
const _showHero = showHero;
showHero = function (i) {
  _showHero(i);
  const m = heroItems[heroIdx];
  if (m) $("hero-more").onclick = () => openDetail(m.id);
};

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

// deep link #/anime/123
if (location.hash.startsWith("#/anime/")) {
  const id = +location.hash.split("/")[2];
  if (id) load().then(() => openDetail(id));
} else {
  load().catch((e) => { $("hero-title").textContent = "Failed: " + e.message; });
}
