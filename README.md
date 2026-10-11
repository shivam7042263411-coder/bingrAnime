# BingrAnime — free anime discovery site

Catalog: **AniList** GraphQL (no key needed). Legal watch links only — no hosted/scraped video.

## Run locally
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy free (Cloudflare Pages)
1. Push this repo to GitHub (already done)
2. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → pick `bingrAnime`
3. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/`
4. Deploy → live at `https://bingranime.pages.dev`
5. Custom domain later: Pages → Custom domains → add `bingranime.one` (buy on Porkbun ~$12/yr, point NS to Cloudflare)

## Files
- `index.html` — shell + hero + rows + modal
- `styles.css` — dark theme
- `app.js` — AniList queries: trending / popular / top / search / detail
