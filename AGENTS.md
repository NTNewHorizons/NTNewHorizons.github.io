# AGENTS.md - NTNewHorizons.github.io

Public website for **Nuclear Tech: New Horizons** Minecraft modpack.  
Node.js/Express 5 + EJS. **No build, lint, typecheck, test, or format tooling.** No opencode config files exist.

## Commands

```sh
npm start                              # node server.js (port 3000)
pm2 restart ntnewHorizons              # production restart
node scripts/add-admin.js              # interactive; password visible; restart server after
node scripts/add-dns-aid.js             # prints DNS-AID SVCB/HTTPS records for zone publish
npm test                                # just echoes "Error: no test specified" - no real tests
```

## Architecture

| Layer | Notes |
|---|---|
| `server.js` | Express 5 on port 3000. `trust proxy` for nginx. Blog mounted at `/blog`. Static from project root via `express.static` - dotfiles excluded, `.html` extension optional. |
| `views/*.ejs` | Main pages use `partials/header.ejs` + `partials/footer.ejs`. **Exception:** `views/privacy-policy.ejs` and `views/terms-of-service.ejs` are standalone (no partials, load `shared-styles.css` directly). |
| `views/404.ejs` | Uses partials but has an inline particle script **after** `</html>` (footer already closed the doc). Known quirk. |
| `styles/` | `shared-styles.css` global; `{page}-styles.css` per page. Blog CSS lives **in `blog/router.js`** as the `BLOG_CSS` template string - not in `styles/`. |
| `scripts/` | Per-page JS plus `webmcp.js` (loaded on every EJS page via footer). No bundler. |
| `resources/` | **Gitignored.** Favicon, screenshots, video, blog uploads. |
| `blog-data/` | JSON flat files; blocked from static access at server.js:96-98. |

## Routes

| Path | Handler |
|---|---|
| `/`, `/index` | `views/index.ejs` |
| `/about`, `/download`, `/guide` | EJS per page |
| `/privacy-policy`, `/terms-of-service` | Standalone EJS (no partials) |
| `/blog/*` | `blog/router.js` - **raw HTML generation, NOT EJS** |
| `/api/moddex/reviews` | Proxy → ModDex API (paginates all pages). Requires `MODDEX_API_KEY`. |
| `/.well-known/*` | JSON metadata routes in `server.js`. All placeholder/mock - no real OAuth. |
| `/auth.md` | Static file (agent registration docs on site root). |
| `/42_4C_??.html` | Standalone static puzzle page (no EJS, no header). |
| `/<file>` | `express.static` fallback (dotfiles excluded). |
| 404 | `views/404.ejs` |

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes (dev fallback) | Dev fallback: `'ntnh-blog-change-this-secret-in-prod'` |
| `MODDEX_API_KEY` | Yes | Bearer token for ModDex API (reviews proxy) |

## Blog subsystem (`blog/router.js`, ~1681 lines)

- **NOT EJS** - generates raw HTML via `page(title, body, ogMeta)` and `topNav(req)` helpers. All blog CSS is a template string (`BLOG_CSS`) embedded in `router.js`.
- **Session** - shares `express-session` with main Express app.
- **Storage** - JSON flat files in `blog-data/`:
  - `posts.json` - **tracked in git** (published posts)
  - `admins.json`, `users.json`, `comments.json` - **gitignored**
- Image uploads via `multer` (optional - degrades gracefully if not installed): 8 MB limit, image MIME only, stored in `resources/blog-uploads/`.
- Blog posts are Markdown, rendered via `marked`.
- Auth: email + bcryptjs. Admin panel at `/blog/admin`. Email verification via Resend (optional, falls back to auto-login).

## Agent discovery features

All wired in `server.js`:

- **Link headers** (RFC 8288) on every response.
- **Markdown for Agents** middleware - if `Accept: text/markdown` wins, `res.render` output converts via `turndown`.
- **`.well-known/` endpoints** - api-catalog (RFC 9727), agent-card (A2A), agent-skills index, MCP server card, OIDC config, OAuth AS (RFC 8414), OAuth PR (RFC 9728). **All placeholder metadata** - the site does not have real OAuth.
- **`robots.txt`** - includes `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.
- **`auth.md`** - at site root, documents registration endpoint and credential use for agents.
- **WebMCP** - `scripts/webmcp.js` calls `navigator.modelContext.provideContext()` with navigate/search/guide/discord tools. Included on every EJS page.

## Gotchas

- **Cookie banner "Decline" redirects to Wikipedia "Cookie" page** - but only for real human clicks (`event.isTrusted`). DuckDuckGo/adblocker auto-clicks bypass the redirect and silently dismiss the banner.
- `views/about.ejs` `<meta name="author">` contains a base64-encoded message.
- `blog.db` - orphan SQLite file, unused (JSON only).
- `README.md` is intentionally crude - not a documentation gap.
- `add-admin.js` password is visible during input; server restart required.
- Express session cookie: `secure: false` (TLS terminated at nginx), `httpOnly: true`, 1-day expiry.

## Deployment

Production under PM2 via `deploy.sh`:
```
git pull --ff-only origin main → npm install --omit=dev → pm2 restart ntnewHorizons
```
Deploy path: `/home/bufka/site`. **No CI/CD.**

## Multiplayer servers

Listed in `servers.json` - displayed on the website for community server discovery.
