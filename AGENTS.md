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
| `styles/` | `shared-styles.css` global; `{page}-styles.css` per page. Blog CSS lives **in `blog/render.js`** as the `BLOG_CSS` template string - not in `styles/`. |
| `scripts/` | Per-page JS plus `webmcp.js` (loaded on every EJS page via footer). No bundler. |
| `resources/` | **Gitignored.** Favicon, screenshots, video, blog uploads. |
| `blog-data/` | JSON flat files; blocked from static access at server.js:96-98. |

## Routes

| Path | Handler |
|---|---|
| `/`, `/index` | `views/index.ejs` |
| `/about`, `/download`, `/guide` | EJS per page |
| `/privacy-policy`, `/terms-of-service` | Standalone EJS (no partials) |
| `/blog/*` | `blog/router.js` - thin assembler mounting `blog/routes/*`. **Raw HTML generation, NOT EJS** |
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

## Blog subsystem (`blog/`, ~1687 lines split across modules)

**NOT EJS** - generates raw HTML. Split into focused modules for readability:

| File | Contents |
|---|---|
| `router.js` | Thin assembler: mounts the four `routes/*` sub-routers + catch-all 404. |
| `routes/public.js` | Blog index, post pages, add/delete comments. |
| `routes/auth.js` | Register, login, logout, email verification, resend. |
| `routes/profile.js` | Profile page, nickname change (7-day cooldown), password change. |
| `routes/admin.js` | Admin login, dashboard (posts+users tabs), post editor (Markdown toolbar, live preview, cover/image upload), delete post/user. |
| `render.js` | `page(title, body, ogMeta)` shell, `topNav(req)` nav bar, `blogImageEl`, `flashHtml`, and the full `BLOG_CSS` template string. |
| `helpers.js` | escape/slug/flash utils, session helpers (`isAdmin`/`isUser`/`getCurrentUser`), email+nickname validation, Resend email sender, nickname cooldown, `sortPosts` (pinned-first). |
| `data.js` | JSON flat-file storage layer: `readData(file)` / `writeData(file, data)` over `blog-data/`. |
| `uploads.js` | multer setup (optional - degrades gracefully if not installed): 8 MB limit, image MIME only, stored in `resources/blog-uploads/`. |
| `markdown.js` | Single place where `marked` is configured (`gfm`, `breaks`). |

Other notes:
- **Session** - shares `express-session` with main Express app.
- **Storage** - JSON flat files in `blog-data/`:
  - `posts.json` - **tracked in git** (published posts)
  - `admins.json`, `users.json`, `comments.json` - **gitignored**
- Blog posts are Markdown, rendered via `marked`.
- Auth: email + bcryptjs. Admin panel at `/blog/admin`. Email verification via Resend (optional; without Resend, accounts are stored unverified and an admin must activate them - no auto-login).

## Security hardening (2026-08-18)

- **nginx** (`/etc/nginx/sites-enabled/ntnewhorizons`) adds: CSP (default-src 'self'; allows cdn.jsdelivr.net scripts, cdnjs/fonts.googleapis styles, fonts.gstatic, YouTube embeds), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS (max-age=31536000, no includeSubDomains), `Referrer-Policy: strict-origin-when-cross-origin`.
- **NODE_ENV=production** in `ecosystem.config.js` + `deploy.sh` (`NODE_ENV=production pm2 restart ... --update-env`) — flips session cookie to `secure`, disables Express dev stack traces.
- `server.js` blocks root files from static serving: `server.js`, `package.json`, `package-lock.json`, `ecosystem.config.js`, `deploy.sh`, `TODO.md` (404). `auth.md`, `AGENTS.md`, `README.md` stay public (agent-facing).
- Blog uploads: **SVG is rejected** (stored-XSS vector), and file content is validated against magic bytes (`isRealImage` in `blog/routes/admin.js`).
- `app.disable('x-powered-by')` in server.js.
- No CSRF tokens (none installed); relied on `sameSite: 'lax'` cookie. In-app rate limiting: none (fail2ban `ntnh-login` jail covers blog login at nginx).

## Agent discovery features

All wired in `server.js`:

- **Link headers** (RFC 8288) on every response.
- **Markdown for Agents** middleware - if `Accept: text/markdown` wins, `res.render` output converts via `turndown`.
- **`.well-known/` endpoints** - api-catalog (RFC 9727), agent-card (A2A), agent-skills index, MCP server card, OIDC config, OAuth AS (RFC 8414), OAuth PR (RFC 9728). **All placeholder metadata** - the site does not have real OAuth.
- **`robots.txt`** - includes `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.
- **`auth.md`** - at site root, documents registration endpoint and credential use for agents.
- **WebMCP** - `scripts/webmcp.js` calls `navigator.modelContext.provideContext()` with navigate/search/guide/discord tools. Included on every EJS page.

## Gotchas

- **Joke cookie banner on non-blog pages** - Accept redirects to Wikipedia Cookie page, Decline redirects to Wikipedia Diabetes page. Close/X dismisses without redirect. The site uses no tracking cookies (only a strictly necessary session cookie on the blog).
- `views/about.ejs` `<meta name="author">` contains a base64-encoded message.
- `blog.db` - orphan SQLite file, unused (JSON only).
- `README.md` is intentionally crude - not a documentation gap.
- `add-admin.js` password is visible during input; server restart required.
- Express session cookie: `secure: true` (when `NODE_ENV=production`), `httpOnly: true`, `sameSite: 'lax'`, 1-day expiry.

## Deployment

Production under PM2 via `deploy.sh`:
```
git pull --ff-only origin main → npm install --omit=dev → pm2 restart ntnewHorizons
```
Deploy path: `/home/bufka/site`. **No CI/CD.**

## Multiplayer servers

Listed in `servers.json` - displayed on the website for community server discovery.
