# Newsbox

A personal news aggregator — cricket-first sports, India, Trending, AI & Tech,
Business, US, and Ohio — built to run on your iPhone at **$0/month**, for
your own use only.

This is a **PWA** (Progressive Web App): a website built to install and
behave like a native app. No App Store, no Mac, no Xcode. Everything below
is done from Safari on your iPhone.

---

## 1. What you're setting up, in plain terms

Two free pieces, both from companies' free tiers, no credit card needed:

1. **GitHub Pages** — hosts the app's files at a free URL.
2. **Cloudflare Worker** — a small relay that lets the app fetch RSS feeds.
   (Browsers block a webpage from directly fetching another company's raw
   feed — a security rule called CORS. The Worker sits in between, allowed
   to fetch on the app's behalf, then hands the data back.)

Total setup time: **~25–30 minutes**, once.

---

## 2. Preview it right now (before any setup)

1. Open `index.html` in this folder — but for a full test, finish step 3
   first (GitHub Pages), then in the app go to **Settings → Load sample
   data (preview only)**. This fills every section with demo articles so
   you can see the full UI immediately, before RSS is wired up.

---

## 3. Deploy the app files (GitHub Pages) — from your iPhone

1. Go to **github.com**, tap **Sign up**, create a free account.
2. Tap the **+** → **New repository**. Name it `newsbox`. Set it to
   **Private** (keeps it for your eyes only) or Public — either works for
   GitHub Pages. Tap **Create repository**.
   - Note: Pages on a **Private** repo requires a free GitHub account tier
     check — if Pages isn't available on Private for your account, switch
     visibility to Public. Nothing sensitive is in this code (no API keys
     are stored in it).
3. Tap **Add file → Upload files**.
4. From the Files app, select **every file and folder** in this project
   (`index.html`, `manifest.json`, `service-worker.js`, `css/`, `js/`,
   `icons/`) and upload them, preserving the folder structure. (GitHub's
   uploader keeps folder structure if you drag a folder; on iPhone Safari,
   uploading folder-by-folder — first everything in `css/` into a `css`
   path, etc. — is the reliable way. The GitHub app can also do this.)
5. Commit the upload.
6. Go to the repo's **Settings → Pages**. Under "Build and deployment",
   set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**.
   Save.
7. Wait ~1 minute, then refresh. GitHub shows your live URL, something like:
   `https://yourusername.github.io/newsbox/`

Keep that URL — you'll open it on your iPhone in step 5.

---

## 4. Set up the free RSS proxy (Cloudflare Worker)

1. Go to **dash.cloudflare.com**, sign up free.
2. In the sidebar, tap **Workers & Pages → Create → Create Worker**.
3. Give it any name (e.g. `newsbox-proxy`), tap **Deploy** (it deploys a
   placeholder first).
4. Tap **Edit code**. Delete everything in the editor, then paste in the
   full contents of `cloudflare-worker.js` from this project.
5. Tap **Deploy**.
6. Copy the Worker's URL, shown at the top — looks like:
   `https://newsbox-proxy.yourname.workers.dev`

Free tier covers 100,000 requests/day. Newsbox uses roughly 20–40/day —
you will not come close to any limit or charge.

---

## 5. Install on your iPhone

1. Open Safari, go to your GitHub Pages URL from step 3.
2. Tap the **Share** icon → **Add to Home Screen** → **Add**.
3. Open the new **Newsbox** icon from your Home Screen (not Safari — the
   installed version is the one that behaves like an app and supports
   offline caching).
4. Go to **Settings (⚙) → Data source** and paste in your Cloudflare
   Worker URL from step 4. Tap **Save**.
5. Pull down on the Home screen to refresh — your real feeds load.

Done. Total ongoing cost: **$0**.

---

## 6. Updating the app later

Edit files in your GitHub repo (GitHub's web/app editor works fine) and
commit — GitHub Pages redeploys automatically within a minute or two.
Reopen the Home Screen app and pull-to-refresh.

---

## Project structure

```
newsbox/
├── index.html              App shell — all views render into #viewRoot
├── manifest.json            PWA metadata (name, icon, colors)
├── service-worker.js        Offline caching of the app shell
├── cloudflare-worker.js      CORS proxy — deploy separately to Cloudflare
├── css/
│   └── style.css            Design tokens, light/dark themes, all layout
├── js/
│   ├── db.js                 IndexedDB — all local storage
│   ├── feeds.js               RSS source list + fetch/parse logic
│   ├── trending.js            Google Trends + Reddit hot → trending topics
│   ├── briefing.js            Daily Briefing generator (~5 min read cap)
│   ├── sample-data.js         Demo articles for preview/testing
│   └── app.js                 Router, view rendering, all interactions
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Data model (IndexedDB — all on your device, nothing sent anywhere)

**`articles`** — one row per headline
`id, title, link, source, category, subcategory, pubDate, summary, content, imageUrl, read, bookmarked, savedOffline, fetchedAt`

**`settings`** — single row, app preferences
`theme, proxyUrl, categoryOrder, favoriteTopics, favoriteSources, fontSize, quietStart, quietEnd, notif{breaking,trending,cricket,dailyBriefing}, xListUrl`

**`xaccounts`** — your followed X handles for the launcher tab
`id (handle), handle, category`

**`history`** — reading log, powers the Dashboard
`id, articleId, readAt, timeSpentSec`

## How each requirement was implemented

| Requirement | Where |
|---|---|
| Categories (Sports/India/Trending/AI/Business/US/Ohio) | `feeds.js` source config, one bottom-nav + side-menu route each |
| Cricket-first sports | `FEED_SOURCES.sports` lists cricket sources first; sports tab defaults to showing them at the top |
| Trending topics + "why trending" | `trending.js` — Google Trends daily RSS (traffic + related news) + Reddit hot posts (upvotes/comments shown as the reason) |
| X Feed | `renderXFeed()` in `app.js` — locally stored handles, one-tap launch to X app/site. Built as a placeholder module so a real API integration can drop in later without touching the UI layer |
| Daily Briefing, <5 min | `briefing.js` — pulls top N per category, trims to a 200 wpm / 5-minute budget |
| Personalization | `settings` store: favorite topics/sources, category order, reading history |
| Search | `DB.search()` — full-text over cached title/summary/category |
| Notifications | Browser Notification API, toggles in Settings, quiet hours fields. iOS only delivers these reliably for installed Home Screen apps, and timing isn't guaranteed the way native push is — noted in-app |
| Reader mode / font size / share / offline | `openArticle()` — adjustable font size, native share sheet, article content cached locally by default |
| Dashboard | `renderDashboard()` — today's read count, top category, saved count, trending count, time spent |
| Offline caching | `service-worker.js` caches the app shell; `IndexedDB` caches all fetched articles so Home/Sports/etc. render even with no connection |
| Zero cost | GitHub Pages (free) + Cloudflare Workers free tier (100k req/day) + free RSS/Reddit/Trends sources, no paid API keys anywhere |

## Known limitations (so nothing surprises you)

- **X posts aren't embedded.** X's free API no longer allows reading posts;
  Nitter (the old free workaround) is dead too. The X Feed tab is a
  curated launcher instead — your handles, one tap to open them in the X
  app. The code is modular (`renderXFeed()` is self-contained) so a paid
  or future API can be wired in later without a redesign.
- **iOS notifications aren't as reliable as native.** They work for
  installed Home Screen apps on iOS 16.4+, but Apple doesn't guarantee
  timing the way it does for App Store apps.
- **"Offline saved" articles store the fetched summary/content**, not a
  full mirrored copy of the original page — this keeps things fast and
  avoids republishing full copyrighted articles; the "Original" link
  always opens the source.
- Some publishers change or retire RSS URLs occasionally. If a source in
  the ticker or a category goes quiet, check whether its feed URL in
  `feeds.js` still resolves and swap it — a five-minute fix.
