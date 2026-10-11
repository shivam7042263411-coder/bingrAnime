# BingrAnime — fresh UI reimagined from Pid24/anime-hub (MIT) patterns

Own static implementation (no build step). Catalog: **AniList** GraphQL, no key.
Legal links only — no watch-player / scraper code (anime-hub's consumet watch
routes were deliberately NOT ported).

## Run locally
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy (Cloudflare Worker / Pages, free)
- Static files: `index.html`, `styles.css`, `app.js` — no build command.
- Push to `main` → redeploy worker → hard-refresh.

## Credit
Layout/card/header patterns reimagined from https://github.com/Pid24/anime-hub (MIT).
