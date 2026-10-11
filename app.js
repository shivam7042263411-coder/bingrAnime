const API = "https://graphql.anilist.co";
const $ = (id) => document.getElementById(id);

async function gql(query, variables = {}) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error("AniList " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

const LIST = `
query ($page:Int,$perPage:Int,$sort:[MediaSort]) {
  Page(page:$page, perPage:$perPage) {
    media(type:ANIME, sort:$sort, isAdult:false) {
      id title{romaji english} coverImage{large} bannerImage
      averageScore seasonYear episodes format status
      genres description(asHtml:false) siteUrl
    }
  }
}`;

const card = (m) => `
  <div class="card" data-id="${m.id}">
    <img loading="lazy" src="${m.coverImage.large}" alt="" />
    <div class="t">${(m.title.english || m.title.romaji || "").replace(/</g, "&lt;")}</div>
    <div class="s">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"} ${m.seasonYear ? "• " + m.seasonYear : ""}</div>
  </div>`;

function bindCards(root) {
  root.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("click", () => openDetail(+c.dataset.id))
  );
}

async function loadRows() {
  const [tr, pop, top] = await Promise.all([
    gql(LIST, { page: 1, perPage: 12, sort: ["TRENDING_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["POPULARITY_DESC"] }),
    gql(LIST, { page: 1, perPage: 12, sort: ["SCORE_DESC"] }),
  ]);
  $("row-trending").innerHTML = tr.Page.media.map(card).join("");
  $("row-popular").innerHTML = pop.Page.media.map(card).join("");
  $("row-top").innerHTML = top.Page.media.map(card).join("");
  [$("row-trending"), $("row-popular"), $("row-top")].forEach(bindCards);

  const h = tr.Page.media.find((m) => m.bannerImage) || tr.Page.media[0];
  document.querySelector(".hero-bg").style.backgroundImage = `url('${h.bannerImage || h.coverImage.large}')`;
  $("hero-title").textContent = h.title.english || h.title.romaji;
  $("hero-meta").innerHTML = `<span>★ ${h.averageScore ? (h.averageScore / 10).toFixed(1) : "–"}</span><span>${h.seasonYear || ""}</span><span>${(h.genres || []).slice(0, 3).join(" • ")}</span>`;
  $("hero-desc").textContent = (h.description || "").replace(/<[^>]+>/g, "").slice(0, 220) + "…";
  $("hero-anilist").href = h.siteUrl;
  $("hero-info").onclick = () => openDetail(h.id);
}

async function openDetail(id) {
  $("modal").classList.remove("hidden");
  $("modal-body").textContent = "Loading…";
  const q = `query ($id:Int){ Media(id:$id, type:ANIME){
    title{romaji english} coverImage{large} bannerImage averageScore
    seasonYear episodes format status genres description(asHtml:false)
    siteUrl trailer{id site thumbnail} externalLinks{site url} studios{nodes{name}} } }`;
  try {
    const d = await gql(q, { id });
    const m = d.Media;
    const title = m.title.english || m.title.romaji;
    const desc = (m.description || "").replace(/<[^>]+>/g, "").slice(0, 600);
    $("modal-body").innerHTML = `
      ${m.bannerImage ? `<img class="mbanner" src="${m.bannerImage}" />` : ""}
      <div class="mbody">
        <h2>${title.replace(/</g, "&lt;")}</h2>
        <div class="meta"><span>★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : "–"}</span><span>${m.seasonYear || ""}</span><span>${m.episodes ? m.episodes + " eps" : ""}</span><span>${m.format || ""}</span></div>
        <p>${desc.replace(/</g, "&lt;")}…</p>
        <div class="meta"><span>${(m.genres || []).join(" • ")}</span></div>
        <div class="links">
          <a href="${m.siteUrl}" target="_blank" rel="noopener">AniList page →</a>
          ${(m.externalLinks || []).slice(0, 6).map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${String(l.site).replace(/</g, "")} →</a>`).join("")}
          ${m.trailer && m.trailer.site === "youtube" ? `<a href="https://www.youtube.com/watch?v=${m.trailer.id}" target="_blank" rel="noopener">Trailer →</a>` : ""}
        </div>
      </div>`;
  } catch (e) {
    $("modal-body").textContent = "Failed: " + e.message;
  }
}
$("close").onclick = () => $("modal").classList.add("hidden");
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); });

let t;
$("search").addEventListener("input", (e) => {
  clearTimeout(t);
  const q = e.target.value.trim();
  if (!q) { $("results").classList.add("hidden"); return; }
  t = setTimeout(async () => {
    const query = `query ($s:String){ Page(page:1, perPage:8){ media(search:$s, type:ANIME, isAdult:false){ id title{romaji english} coverImage{large} seasonYear averageScore } } }`;
    try {
      const d = await gql(query, { s: q });
      $("results").innerHTML = d.Page.media.map((m) =>
        `<div class="hit" data-id="${m.id}"><img src="${m.coverImage.large}" /><div><div>${(m.title.english || m.title.romaji || "").replace(/</g, "&lt;")}</div><div style="color:#888;font-size:12px">${m.seasonYear || ""}</div></div></div>`
      ).join("") || "<div class='hit'>No results</div>";
      $("results").classList.remove("hidden");
      $("results").querySelectorAll(".hit[data-id]").forEach((h) =>
        h.addEventListener("click", () => { $("results").classList.add("hidden"); openDetail(+h.dataset.id); }));
    } catch {}
  }, 350);
});

loadRows().catch((e) => { $("hero-title").textContent = "Failed to load AniList: " + e.message; });
