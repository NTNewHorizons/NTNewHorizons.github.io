'use strict';

const express = require('express');
const path    = require('path');
const session = require('express-session');

const app  = express();
const PORT = 3000;

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
