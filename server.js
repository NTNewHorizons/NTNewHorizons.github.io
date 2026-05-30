'use strict';

const express = require('express');
const path    = require('path');
const session = require('express-session');

const TurndownService = require('turndown');

const app  = express();
const PORT = 3000;

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// ──────────────────────────────────────────────────────────
// VIEW ENGINE — EJS with shared partials
// ──────────────────────────────────────────────────────────

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ──────────────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────────────

// Trust the nginx reverse proxy (needed for req.ip / X-Forwarded-For)
app.set('trust proxy', 1);

// Body parsers
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

// Session (used for admin auth + flash messages)
// SESSION_SECRET should be set in environment; a fallback is provided for dev.
app.use(session({
  secret:            process.env.SESSION_SECRET || 'ntnh-blog-change-this-secret-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,          // set to true if you ever terminate TLS in Express itself
    httpOnly: true,
    maxAge:   24 * 60 * 60 * 1000 // 1 day
  }
}));

// ──────────────────────────────────────────────────────────
// AGENT DISCOVERY — Link headers (RFC 8288)
// ──────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.set('Link', [
    '</.well-known/api-catalog>; rel="api-catalog"',
    '</.well-known/agent-skills/index.json>; rel="http://agentskills.io/rel/skills-index"',
    '</.well-known/mcp/server-card.json>; rel="http://modelcontextprotocol.io/rel/server-card"',
    '</auth.md>; rel="http://workos.com/auth-md"',
    '</sitemap.xml>; rel="sitemap"',
    '</.well-known/oauth-protected-resource>; rel="http://oauth.net/rel/protected-resource"',
  ].join(', '));
  next();
});

// ──────────────────────────────────────────────────────────
// AGENT DISCOVERY — Markdown for Agents (Accept: text/markdown)
// ──────────────────────────────────────────────────────────

app.use((req, res, next) => {
  const accepts = req.accepts(['text/html', 'text/markdown']);
  if (accepts === 'text/markdown') {
    const originalRender = res.render.bind(res);
    res.render = function (view, options, done) {
      if (!done) {
        done = (err, html) => {
          if (err) return res.status(500).send(err);
          res.set('Content-Type', 'text/markdown');
          res.set('X-Markdown-Tokens', 'turndown');
          res.send(turndown.turndown(html));
        };
      }
      return originalRender(view, options, done);
    };
  }
  next();
});

// ──────────────────────────────────────────────────────────
// SECURITY - block direct access to data / source directories
// ──────────────────────────────────────────────────────────

// Prevent blog-data JSON files from being served as static files
app.use('/blog-data', (req, res) => {
  res.status(403).render('404', { currentPage: '404' });
});

// ──────────────────────────────────────────────────────────
// BLOG ROUTES  (must come before express.static)
// ──────────────────────────────────────────────────────────

const blogRouter = require('./blog/router');
app.use('/blog', blogRouter);

// ──────────────────────────────────────────────────────────
// PAGE ROUTES  (EJS templates with shared header/footer)
// ──────────────────────────────────────────────────────────

app.get('/',        (req, res) => res.render('index',    { currentPage: 'index' }));
app.get('/index',   (req, res) => res.render('index',    { currentPage: 'index' }));
app.get('/about',   (req, res) => res.render('about',    { currentPage: 'about' }));
app.get('/download',(req, res) => res.render('download', { currentPage: 'download' }));
app.get('/guide',   (req, res) => res.render('guide',    { currentPage: 'guide' }));

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — API Catalog (RFC 9727)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/api-catalog', (req, res) => {
  res.type('application/linkset+json').json({
    linkset: [
      {
        anchor: 'https://ntnewhorizons.com/',
        'service-desc': [
          { href: 'https://github.com/NTNewHorizons', type: 'text/html' }
        ],
        'service-doc': [
          { href: 'https://ntnewhorizons.com/guide', type: 'text/html' },
          { href: 'https://ntnewhorizons.com/about', type: 'text/html' }
        ],
        status: [
          { href: 'https://github.com/NTNewHorizons/NTNH/commits', type: 'text/html' }
        ]
      },
      {
        anchor: 'https://ntnewhorizons.com/blog',
        'service-doc': [
          { href: 'https://ntnewhorizons.com/blog', type: 'text/html' }
        ]
      }
    ]
  });
});

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — Agent Skills Discovery Index
// ──────────────────────────────────────────────────────────

app.get('/.well-known/agent-skills/index.json', (req, res) => {
  res.type('application/json').json({
    $schema: 'https://agentskills.io/schemas/skills-index.json',
    skills: [
      {
        name: 'ntnewhorizons-navigate',
        type: 'action',
        description: 'Navigate pages on the NTNewHorizons website',
        url: 'https://ntnewhorizons.com/',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      {
        name: 'ntnewhorizons-blog',
        type: 'action',
        description: 'Read blog posts on NTNewHorizons',
        url: 'https://ntnewhorizons.com/blog',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ]
  });
});

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — MCP Server Card (SEP-1649)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/mcp/server-card.json', (req, res) => {
  res.type('application/json').json({
    serverInfo: {
      name: 'NTNewHorizons',
      version: '1.0.0'
    },
    transport: {
      type: 'http',
      endpoint: 'https://ntnewhorizons.com'
    },
    capabilities: {
      resources: {},
      prompts: {},
      tools: {}
    }
  });
});

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — OIDC Discovery (OpenID Connect)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/openid-configuration', (req, res) => {
  res.type('application/json').json({
    issuer: 'https://ntnewhorizons.com',
    authorization_endpoint: 'https://ntnewhorizons.com/blog/login',
    token_endpoint: '',
    jwks_uri: '',
    scopes_supported: [],
    response_types_supported: [],
    grant_types_supported: [],
    subject_types_supported: [],
    id_token_signing_alg_values_supported: [],
    claims_supported: []
  });
});

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — OAuth Authorization Server (RFC 8414)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.type('application/json').json({
    issuer: 'https://ntnewhorizons.com',
    authorization_endpoint: 'https://ntnewhorizons.com/blog/login',
    token_endpoint: '',
    jwks_uri: '',
    scopes_supported: [],
    response_types_supported: [],
    grant_types_supported: [],
    code_challenge_methods_supported: [],
    token_endpoint_auth_methods_supported: [],
    agent_auth: {
      register_uri: 'https://ntnewhorizons.com/blog/register',
      identity_types: ['email'],
      credential_types: ['password'],
      claim_revocation_url: ''
    }
  });
});

// ──────────────────────────────────────────────────────────
// WELL-KNOWN — OAuth Protected Resource (RFC 9728)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.type('application/json').json({
    resource: 'https://ntnewhorizons.com',
    authorization_servers: [
      'https://ntnewhorizons.com'
    ],
    scopes_supported: [],
    bearer_methods_supported: []
  });
});

// ──────────────────────────────────────────────────────────
// STATIC FILE SERVER  (CSS, JS, resources, old HTML fallback)
// ──────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname), {
  extensions: ['html']   // allows /about instead of /about.html
}));

// ──────────────────────────────────────────────────────────
// 404 FALLBACK
// ──────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).render('404', { currentPage: '404' });
});

// ──────────────────────────────────────────────────────────
// START
// ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Site running at http://localhost:${PORT}`);
});
