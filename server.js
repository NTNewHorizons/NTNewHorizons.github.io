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
    '</.well-known/agent-card.json>; rel="http://a2a-protocol.org/rel/agent-card"',
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
// ──────────────────────────────────────────────────────────
// MODDEX REVIEWS PROXY  (server-side to keep API key hidden)
// ──────────────────────────────────────────────────────────

app.get('/api/moddex/reviews', async (req, res) => {
  try {
    const token = process.env.MODDEX_API_KEY || '';

    if (!token) {
      return res.status(500).json({ error: 'MODDEX_API_KEY not configured' });
    }

    const allReviews = [];
    let page = 1;
    let lastPage = 1;

    do {
      const url = new URL('https://moddex.gg/api/v1/projects/ntnewhorizons/reviews');
      url.searchParams.set('page', page);
      url.searchParams.set('per_page', 50);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'NTNewHorizons-website/1.0 (review-proxy)',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`ModDex API ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json();

      if (data.data) allReviews.push(...data.data);
      if (data.meta) lastPage = data.meta.last_page;
      page++;
    } while (page <= lastPage);

    res.json({ data: allReviews });
  } catch (err) {
    console.error('ModDex proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch reviews' });
  }
});

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
app.get('/privacy-policy',  (req, res) => res.render('privacy-policy',  { currentPage: 'privacy-policy' }));
app.get('/terms-of-service',(req, res) => res.render('terms-of-service',{ currentPage: 'terms-of-service' }));

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
// WELL-KNOWN — A2A Agent Card (Agent-to-Agent Discovery)
// ──────────────────────────────────────────────────────────

app.get('/.well-known/agent-card.json', (req, res) => {
  res.type('application/a2a+json').json({
    name: 'NTNewHorizons',
    description: 'The public website for the Nuclear Tech: New Horizons Minecraft modpack. Provides modpack downloads, getting-started guide, blog, story, and community server discovery.',
    supportedInterfaces: [
      {
        url: 'https://ntnewhorizons.com/.well-known/agent-skills/index.json',
        protocolBinding: 'HTTP+JSON',
        protocolVersion: '1.0'
      }
    ],
    provider: {
      organization: 'NTNewHorizons Community',
      url: 'https://github.com/NTNewHorizons'
    },
    version: '1.0.0',
    documentationUrl: 'https://ntnewhorizons.com/guide',
    capabilities: {
      streaming: false,
      pushNotifications: false
    },
    securitySchemes: {},
    security: [],
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'modpack-guide',
        name: 'Modpack Guidance',
        description: 'Provides installation instructions, getting-started guide, and answers about the NT:NH modpack progression.',
        tags: ['minecraft', 'modpack', 'guide', 'ntnh'],
        examples: ['How do I install NTNH?', 'What are the tech tiers?'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain']
      },
      {
        id: 'modpack-download',
        name: 'Download Information',
        description: 'Provides download links and availability for the NT:NH modpack client and server files.',
        tags: ['download', 'release', 'client', 'server'],
        examples: ['Where can I download the latest release?'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain']
      },
      {
        id: 'blog',
        name: 'Blog Reading',
        description: 'Reads and summarizes blog posts about NT:NH development progress.',
        tags: ['blog', 'news', 'development'],
        examples: ['What are the latest blog posts?'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain']
      },
      {
        id: 'community-servers',
        name: 'Community Servers',
        description: 'Lists official community multiplayer servers for NT:NH.',
        tags: ['servers', 'multiplayer', 'community'],
        examples: ['What multiplayer servers are available?'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain', 'application/json']
      }
    ]
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
    bearer_methods_supported: ['header']
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
