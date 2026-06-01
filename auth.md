# Auth.md - NTNewHorizons

This site is the public website for the **Nuclear Tech: New Horizons** Minecraft modpack.
AI agents can access public content freely. The blog admin panel requires registration.

## Agent Audience

This auth.md is for AI agents that want to:
- Read public pages (no auth needed)
- Register for a blog user account
- Manage blog content via the admin panel

## Public Access (No Auth Required)

| Resource | URL |
|---|---|
| Homepage | `/` |
| Download | `/download` |
| Guide | `/guide` |
| About | `/about` |
| Blog (read) | `/blog/*` |

## Registration

Human users can register a blog account at:

| Endpoint | Method | Description |
|---|---|---|
| `/blog/register` | GET + POST | Registration form (email, password, username) |

After registration the user logs in at `/blog/login` and receives a session cookie.

## Supported Methods

- **Identity type:** email
- **Credential type:** password (bcryptjs-hashed)
- **Auth scheme:** session cookie (`express-session`, httpOnly, 1-day expiry)
- **OAuth 2.0 / OIDC:** Not yet available. The `/.well-known/` metadata endpoints are placeholders for future implementation.

## Session Details

| Property | Value |
|---|---|
| Cookie | `connect.sid` |
| httpOnly | true |
| secure | false (terminated at nginx) |
| maxAge | 24 hours |

## Contact

<https://discord.gg/wtNVzeE5QB>
