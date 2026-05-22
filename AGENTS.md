# AGENTS.md — NTNewHorizons.github.io

## What this repo is

The public website for the **Nuclear Tech: New Horizons** Minecraft modpack.  
A Node.js/Express server (`server.js:8`) using EJS templates with shared partials, plus a blog subsystem.

No build tooling, no linter, no formatter, no typechecker, no test suite. `npm test` is a placeholder.

## Key commands

```sh
npm start                                        # node server.js (port 3000)
pm2 start server.js --name ntnewHorizons         # launch as PM2 daemon
pm2 restart ntnewHorizons                        # restart the PM2 instance
```

## Architecture

| Entrypoint | Purpose |
|---|---|
| `server.js` | Express app, port 3000. EJS templating with shared partials (`views/partials/`). Page routes render EJS views. `express.static` serves static assets. |
| `views/partials/header.ejs` | **Shared nav bar** — included by every page. Home, Features, Downloads, Guide, Blog, Status, Story links + 7 social icons. Pass `currentPage` for active highlight. |
| `views/partials/footer.ejs` | **Shared footer + cookie banner** — included by every page. Pass `scripts: ['...']` array for page-specific JS files. |
| `views/*.ejs` | Page templates; use `<%- include('partials/header', { currentPage }) %>` / `<%- include('partials/footer', { scripts }) %>`. |
| `blog/router.js` | Blog routes mounted at `/blog`. JSON flat-file storage in `blog-data/`. Admin panel, user auth, comments, markdown rendering |
| `deploy.sh` | PM2-based deploy: `git pull --ff-only origin main`, `npm install --omit=dev`, `pm2 restart ntnewHorizons` |

## Data layer (blog)

JSON files in `blog-data/` (no database):
- `posts.json` — published blog posts
- `admins.json`, `users.json`, `comments.json` — gitignored (contain credentials/auth data)

Session: `express-session`, 1-day cookie, `httpOnly`, `secure: false` by default (set `true` if TLS terminates in Express).  
`SESSION_SECRET` env var required; has a dev fallback in `server.js:31`.

Admin credentials are stored as bcrypt hashes in `admins.json`. First admin must be created manually or via an admin creation script.

## File layout

```
├── blog/router.js         # Blog Express router (600+ lines, inline CSS)
├── scripts/               # 5 client-side JS files (no bundler)
├── styles/                # 5 CSS files
├── resources/             # Static assets (favicon, video, screenshots)
├── views/                 # EJS page templates + shared partials
│   ├── partials/header.ejs
│   ├── partials/footer.ejs
│   ├── index.ejs / about.ejs / download.ejs / guide.ejs / 404.ejs
└── 42_4C_??.html           # Puzzle/easter egg page (static, no shared header)
```

## Important quirks

- **No build step** — edit EJS/CSS/JS directly, refresh browser (EJS templates are compiled at runtime)
- **Blog CSS is embedded in `blog/router.js`** as a template string (`BLOG_CSS`), not in `styles/`
- `express.static` still serves static files (CSS, JS, images, resources); page routes are handled by EJS
- `/blog-data/` is blocked from direct access (`server.js:46`)
- Image uploads require `multer` (included in package.json); stored to `resources/blog-uploads/`
- `Cookie` banner links "Accept" to Wikipedia/Cookie and "Decline" to Wikipedia/Diabetes (intentional joke)
- Privacy policy link triggers a rickroll animation (easter egg in `views/index.ejs` and `views/download.ejs`)
- `views/about.ejs` `<meta name="author">` contains a base64-encoded message
- "42_4C_??.html" is a puzzle/easter egg page

## Deployment

Production runs under PM2 on the server (`deploy.sh`). The deploy flow: `git pull --ff-only origin main` → `npm install --omit=dev` → `pm2 restart ntnewHorizons`.  
No CI/CD pipeline in this repo.

## Multiplayer servers

Listed in `servers.json` — served on the website for users to find the NT:NH community servers.
