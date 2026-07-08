# Auth.md - NTNewHorizons

This auth.md describes how AI agents can register and authenticate with the **Nuclear Tech: New Horizons** website.

## Agent Audience

- Read public pages (no auth required)
- Register for a blog user account
- Manage blog content via the admin panel

## Public Access

| Resource | URL |
|---|---|
| Homepage | `/` |
| Download | `/download` |
| Guide | `/guide` |
| About | `/about` |
| Blog (read) | `/blog/*` |

## Registration

Agents register blog accounts via the following endpoints.

| Step | Endpoint | Method | Description |
|---|---|---|---|
| Register | `/blog/register` | GET + POST | Create account (email, password, nickname) |
| Login | `/blog/login` | GET + POST | Authenticate, receive session cookie |
| Logout | `/blog/user/logout` | POST | Destroy session |

After successful login, the agent holds an `express-session` cookie (`connect.sid`, httpOnly, 24-hour expiry).

## Supported Methods

| Method | Detail |
|---|---|
| Identity type | email (verified_email assertion) |
| Credential type | password (bcryptjs-hashed) |
| Auth scheme | session cookie (`connect.sid`, httpOnly) |
| AS metadata | `/.well-known/oauth-authorization-server` |
| PR metadata | `/.well-known/oauth-protected-resource` |

## Revocation

Session revocation is available via the admin panel or by posting to `/blog/user/logout`. Contact the site admin on Discord for manual revocation.

## Well-Known Endpoints

| Endpoint | Description |
|---|---|
| `/.well-known/oauth-authorization-server` | Authorization server metadata with `agent_auth` block |
| `/.well-known/oauth-protected-resource` | Protected resource metadata |
| `/.well-known/openid-configuration` | OIDC discovery (placeholder) |

## Contact

<https://discord.gg/wtNVzeE5QB>
