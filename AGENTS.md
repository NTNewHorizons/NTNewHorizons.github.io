# AGENTS.md — NTNewHorizons.github.io

## What this repo is

The public website for the **Nuclear Tech: New Horizons** Minecraft modpack.  
Node.js/Express server with EJS templating. No build tooling, no linter, no formatter, no typechecker, no test suite.

## Commands

```sh
npm start                                # node server.js (port 3000)
pm2 start server.js --name ntnewHorizons # PM2 daemon
pm2 restart ntnewHorizons                # restart PM2 instance
node scripts/add-admin.js                # interactive CLI: add/update blog admin (bcrypt cost 12)
```

## Architecture

| Layer | Details |
|---|---|
| `server.js` | Express on port 3000. EJS views in `views/`. Blog routes mounted at `/blog`. Static files via `express.static`. `trust proxy` set for nginx. |
| `views/partials/header.ejs` | Shared nav + hamburger menu (favicon button, spin on click, left-side menu with page-section links). Pass `currentPage` for active highlight. Hide-on-scroll-down JS built in. |
| `views/partials/footer.ejs` | Shared footer + cookie banner (joke: Accept → Wikipedia/Cookie, Decline → Wikipedia/Diabetes). Pass `scripts: ['...']` array. |
| `views/*.ejs` | Page templates: `index`, `about`, `guide`, `download`, `404`. All `<%- include('partials/header', { currentPage }) %>` / `<%- include('partials/footer', { scripts }) %>`. |
| `styles/shared-styles.css` | Global CSS (nav, cards, buttons, scroll-reveal, cookie banner, hamburger menu). Page-specific styles in `styles/{page}-styles.css`. |
| `scripts/*.js` | Client-side JS per page (no bundler). |
| `resources/` | **Gitignored.** Static assets: favicon, screenshots, video, blog uploads. |

### Hamburger menu

The favicon (top-left) opens a left-slide menu. Each page passes section links via `currentPage` → header builds the menu:
- **index**: `#home`, `#features`, `#screenshots`, `#teaser`, `#progression`, `#pulse`, `#download`, `#support`, `#community`
- **guide**: `#community`, `#requirements`, `#install`, `#launchers`, `#faq`
- **about**: `#ch1`–`#ch5` (chapter anchors)
- **other pages**: fallback main-nav links

## Blog subsystem (`blog/router.js`, 1450 lines)

- **Not an EJS app** — has its own `page(title, body)` HTML shell and `topNav(req)` navigation. Blog CSS is a template string (`BLOG_CSS`) embedded in `router.js`, not in `styles/`.
- Routes at `/blog/*`. JSON flat-file storage in `blog-data/`:
  - `posts.json` — **tracked in git** (published blog posts)
  - `admins.json`, `users.json`, `comments.json` — **gitignored** (credentials, auth data)
- Session: `express-session`, 1-day cookie, `httpOnly`, `secure: false` (set `true` if TLS terminates in Express). `SESSION_SECRET` env var required; has dev fallback in `server.js:31`.
- Admin panel at `/blog/admin`. Auth via email + bcrypt password. First admin created with `scripts/add-admin.js`.
- Image uploads via `multer` (included in deps); stored to `resources/blog-uploads/`. 8 MB limit, image types only.
- `blog-data/` is blocked from direct access (`server.js:46`).
- Blog has its own sticky top-nav with login/register links — separate from the EJS header.

## Routes

```
GET  /, /index        → views/index.ejs
GET  /about           → views/about.ejs
GET  /download        → views/download.ejs
GET  /guide           → views/guide.ejs
GET  /blog/*          → blog/router.js (own HTML shell)
GET  /<static file>   → express.static (also serves .html files without extension)
GET  404              → views/404.ejs (embedded CSS, not in styles/)
```

## Easter eggs & quirks

- Cookie banner "Privacy Policy" link triggers a rickroll animation (inline JS in `views/index.ejs`, `views/download.ejs`)
- `views/about.ejs` `<meta name="author">` has a base64-encoded message
- `42_4C_??.html` — standalone static puzzle page (no EJS, no header)
- `guess_what.jpg` — uncommitted file in root (likely an easter egg)
- `blog.db` — orphan SQLite file, not used by the app (JSON flat-file only)

## Deployment

Production runs under PM2 via `deploy.sh`:
```
git pull --ff-only origin main → npm install --omit=dev → pm2 restart ntnewHorizons
```
No CI/CD pipeline. Deploy path on server is `/home/bufka/site`.

## Multiplayer servers

Listed in `servers.json` — served on the website for community server discovery.
