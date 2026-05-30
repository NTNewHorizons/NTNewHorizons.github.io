# Auth.md — NTNewHorizons Agent Registration

## Status

This site currently uses **session-based authentication** for its admin blog panel at `/blog/login`.
OAuth 2.0 / OpenID Connect endpoints listed in `/.well-known/` are **placeholders** for a future
agent authentication system and are not yet functional.

## Agent Access

| Endpoint | Access | Auth Required |
|---|---|---|
| `/` ` /about` `/download` `/guide` | Public | No |
| `/blog/*` (read) | Public | No |
| `/blog/admin` | Admin panel | Session (email + password) |
| `/blog/login` | Login form | — |
| `/blog/register` | Registration | — |

## Plans

We intend to add OAuth 2.0 support in a future update so that AI agents can programmatically
authenticate. When available, the `/blog/admin` API will accept bearer tokens issued by the
authorization server advertised at `/.well-known/oauth-authorization-server`.

## Contact

For questions about agent access or automation, join our Discord:
<https://discord.gg/wtNVzeE5QB>
