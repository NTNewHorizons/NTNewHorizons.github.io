# AGENTS.md — NTNewHorizons.github.io

## What this repo is

The public website for the **Nuclear Tech: New Horizons** Minecraft modpack.
Node.js/Express 5 server with EJS templating. No build/lint/typecheck/test tooling.

## Commands

```sh
npm start                                # node server.js (port 3000)
pm2 start server.js --name ntnewHorizons
pm2 restart ntnewHorizons
node scripts/add-admin.js                # interactive CLI; password visible during input; restart server after
node scripts/add-dns-aid.js               # prints DNS-AID SVCB/HTTPS records to publish in zone
```

## Architecture

| Layer | Details |
|---|---|
| `server.js` | Express 5 on port 3000. `trust proxy` set for nginx. EJS views in `views/`. Blog mounted at `/blog`. Static files via `express.static` from project root (also serves `.html` without extension). Static does **not** serve dotfiles — all `/.well-known/` paths are explicit routes in `server.js`. |
| `views/partials/header.ejs` | Shared nav + hamburger menu. Pass `currentPage` for section link logic. |
| `views/partials/footer.ejs` | Shared footer + cookie banner. Pass `scripts: ['...']` array to load per-page JS (no bundler). |
| `styles/` | `shared-styles.css` global, `{page}-styles.css` per page. |
| `scripts/` | Per-page JS plus `webmcp.js` (loaded on every page via footer scripts array). |
| `resources/` | **Gitignored.** Favicon, screenshots, video, blog uploads. |

## Routes

```
GET  /, /index              → views/index.ejs
GET  /about                 → views/about.ejs
GET  /download              → views/download.ejs
GET  /guide                 → views/guide.ejs
GET  /blog/*                → blog/router.js (own HTML shell — NOT EJS)
GET  /auth.md               → static file (agent registration info)
GET  /.well-known/*         → JSON routes in server.js (api-catalog, agent-card, agent-skills/index,
                               mcp/server-card, openid-configuration, oauth-authorization-server,
                               oauth-protected-resource)
GET  /<static file>         → express.static (dotfiles excluded)
GET  404                    → views/404.ejs (embedded CSS, no partials)
```

## Blog subsystem (`blog/router.js`, ~1460 lines)

- **Not EJS** — generates raw HTML via `page(title, body, ogMeta)` and `topNav(req)`. Blog CSS is a template string (`BLOG_CSS`) embedded in `router.js`, not in `styles/`.
- Routes at `/blog/*`. JSON flat-file storage in `blog-data/`:
  - `posts.json` — **tracked in git** (published posts)
  - `admins.json`, `users.json`, `comments.json` — **gitignored**
- Blog posts are Markdown; rendered via `marked`. Admin panel at `/blog/admin`. Auth via email + bcryptjs.
- Image uploads: `multer`, 8 MB, image MIME only, stored in `resources/blog-uploads/`.
- `blog-data/` blocked from direct access (`server.js:92`).
- Session: `express-session`, 1-day cookie, `httpOnly`, `secure: false`. `SESSION_SECRET` env var required (dev fallback in `server.js:38`).

## Agent discovery features

Wired into `server.js` as middleware and explicit routes:

- **Link headers** (RFC 8288) — every response gets a `Link` header pointing to api-catalog, agent-card, agent-skills index, MCP server card, auth.md, sitemap, OAuth protected resource.
- **Markdown for Agents** — if `Accept: text/markdown` wins content negotiation, `res.render` output is piped through `turndown` and served as `Content-Type: text/markdown` with `X-Markdown-Tokens: turndown`.
- **`.well-known/` endpoints** — api-catalog (RFC 9727), agent-card (A2A), agent-skills index, MCP server card, OIDC config, OAuth authorization server (RFC 8414), OAuth protected resource (RFC 9728). All are placeholder/mock metadata — the site does not yet have real OAuth.
- **robots.txt** — includes `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.
- **auth.md** — at site root, documents registration endpoint, supported methods, and credential use for agents.
- **WebMCP** — `scripts/webmcp.js` calls `navigator.modelContext.provideContext()` with navigate/search/guide/discord tools. Included on every EJS page via footer scripts array.

## Quirks

- Cookie banner "Privacy Policy" link triggers a rickroll animation (inline JS in `views/index.ejs` and `views/download.ejs` catches any `a[href*="privacy-policy"]` click — don't add real privacy-policy links without thinking).
- `views/about.ejs` `<meta name="author">` has a base64-encoded message.
- `42_4C_??.html` — standalone static puzzle page (no EJS, no header).
- `blog.db` — orphan SQLite file, unused (JSON flat-file only).
- `README.md` is intentionally crude, not a documentation gap.
- `add-admin.js` password is visible during input; server restart required afterward.

## Deployment

Production runs under PM2 via `deploy.sh`:
```
git pull --ff-only origin main → npm install --omit=dev → pm2 restart ntnewHorizons
```
Deploy path: `/home/bufka/site`. No CI/CD.

## Multiplayer servers

Listed in `servers.json` — served on the website for community server discovery.
