// Set footer year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Configure marked
marked.setOptions({ breaks: true, gfm: true, smartypants: true });

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function buildReleaseCard(release) {
  const card = document.createElement('article');
  card.className = 'release-card reveal';

  const isPreRelease = release.prerelease;
  const tagHtml = isPreRelease
    ? '<span class="tag tag-purple">Pre-release</span>'
    : '<span class="tag tag-green">Stable</span>';
  const draftHtml = release.draft
    ? '<span class="tag tag-amber">Draft</span>'
    : '';

  const bodyHtml = release.body
    ? marked.parse(release.body)
    : '<p style="color:var(--text-muted)">No release notes provided.</p>';

  const assetsHtml = release.assets?.length
    ? release.assets.map(a => `
        <a href="${a.browser_download_url}" target="_blank" rel="noopener noreferrer" class="asset-item">
          <i class="fas fa-file-arrow-down"></i>
          <span class="asset-name" title="${a.name}">${a.name}</span>
          <span class="asset-size">${formatBytes(a.size)}</span>
        </a>
      `).join('')
    : '<p style="color:var(--text-muted);font-size:0.82rem">No assets attached.</p>';

  const srcBtns = [
    release.zipball_url
      ? `<a href="${release.zipball_url}" target="_blank" rel="noopener noreferrer" class="release-btn release-btn-blue"><i class="fas fa-file-zipper"></i> Zip</a>`
      : '',
    release.tarball_url
      ? `<a href="${release.tarball_url}" target="_blank" rel="noopener noreferrer" class="release-btn release-btn-blue"><i class="fas fa-file-archive"></i> Tar.gz</a>`
      : ''
  ].join('');

  card.innerHTML = `
    <div class="release-header">
      <span class="release-name">${release.name || release.tag_name}</span>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${tagHtml}${draftHtml}</div>
    </div>
    <p class="release-meta">
      <i class="fas fa-calendar-alt" style="margin-right:0.4rem;color:var(--orange)"></i>
      Published ${formatDate(release.published_at)}
      &nbsp;·&nbsp;
      <i class="fas fa-tag" style="margin-right:0.4rem;color:var(--orange)"></i>
      ${release.tag_name}
    </p>
    <div class="release-body markdown-body">${bodyHtml}</div>
    <div class="assets-section" style="margin-bottom:1.25rem;">
      <h4><i class="fas fa-cube" style="margin-right:0.5rem;color:var(--orange)"></i>Assets</h4>
      <div class="assets-grid">${assetsHtml}</div>
    </div>
    <div class="release-actions">
      <a href="${release.html_url}" target="_blank" rel="noopener noreferrer" class="release-btn release-btn-ghost">
        <i class="fab fa-github"></i> View on GitHub
      </a>
      ${srcBtns}
    </div>
  `;

  return card;
}

async function fetchReleases() {
  const container = document.getElementById('releasesContainer');
  const loading   = document.getElementById('loadingState');
  const error     = document.getElementById('errorState');

  try {
    loading.style.display = 'block';
    error.style.display   = 'none';

    // Fetch via server-side proxy to avoid GitHub API rate limits
    const res = await fetch('/api/github/releases');
    if (!res.ok) throw new Error(`Releases API error ${res.status}`);
    const releases = await res.json();

    // Filter out pre-releases and drafts
    const stableReleases = releases.filter(r => !r.prerelease && !r.draft);

    // Always sort by published_at descending so the newest release is first,
    // regardless of the order GitHub returns them
    stableReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    loading.style.display = 'none';

    if (!stableReleases.length) {
      container.innerHTML = '<p class="state-center" style="display:block"><i class="fas fa-inbox"></i>No stable releases found.</p>';
      return;
    }

    stableReleases.forEach(r => container.appendChild(buildReleaseCard(r)));

    // Trigger reveal animations
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    document.querySelectorAll('.release-card.reveal').forEach(c => observer.observe(c));

  } catch (err) {
    console.error(err);
    loading.style.display = 'none';
    error.style.display   = 'block';
  }
}

document.addEventListener('DOMContentLoaded', fetchReleases);
