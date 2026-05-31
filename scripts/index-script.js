// Set footer year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Scroll reveal
const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger children if container
        const children = entry.target.querySelectorAll('.reveal-child');
        if (children.length) {
          children.forEach((child, idx) => {
            setTimeout(() => child.classList.add('visible'), idx * 80);
          });
        }
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Animated stat counters
function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1400;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

// Typing effect for hero subtitle
const subtitleEl = document.getElementById('heroSubtitle');
if (subtitleEl) {
  const text = subtitleEl.dataset.text;
  subtitleEl.textContent = '';
  subtitleEl.style.borderRight = '2px solid var(--orange)';

  let i = 0;
  const typeInterval = setInterval(() => {
    subtitleEl.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(typeInterval);
      setTimeout(() => { subtitleEl.style.borderRight = 'none'; }, 800);
    }
  }, 22);
}

// ═══ Screenshot Slider ═══
(function () {
  const DURATION      = 5000; // ms per slide
  const SLIDE_TIME_MS = 550;  // must match CSS transition duration

  const sliderEl     = document.getElementById('screenshotSlider');
  const viewport     = document.getElementById('sliderViewport');
  const infoCard     = document.getElementById('sliderInfoCard');
  const infoTitle    = document.getElementById('sliderInfoTitle');
  const infoDesc     = document.getElementById('sliderInfoDesc');
  const dotsWrap     = document.getElementById('sliderDots');
  const counterEl    = document.getElementById('sliderCounter');
  const prevBtn      = document.getElementById('sliderPrev');
  const nextBtn      = document.getElementById('sliderNext');
  const progressFill = document.getElementById('sliderProgressFill');

  if (!sliderEl) return;

  let slides    = [];
  let current   = 0;
  let autoTimer = null;
  let paused    = false;
  let busy      = false; // block overlapping transitions
  let track     = null;

  // ── Parse both JSON formats ──
  function parse(data) {
    if (Array.isArray(data)) return data;
    return Object.entries(data).map(([title, v]) => ({
      title,
      desc: v.desc || '',
      file: v.file || ''
    }));
  }

  // ── Build DOM once data is ready ──
  function build(screenshots) {
    viewport.innerHTML = '';
    dotsWrap.innerHTML = '';
    slides = screenshots;

    // Create sliding track
    track = document.createElement('div');
    track.className = 'slider-track';

    screenshots.forEach((s, i) => {
      const slide = document.createElement('div');
      slide.className = 'slider-slide';

      const img = document.createElement('img');
      img.src       = 'resources/screenshots/' + s.file;
      img.alt       = s.title || 'Screenshot ' + (i + 1);
      img.loading   = i === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      slide.appendChild(img);
      track.appendChild(slide);

      // Dot
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to screenshot ' + (i + 1) + (s.title ? ': ' + s.title : ''));
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    viewport.appendChild(track);
    updateTrack(0, false);
    updateMeta(0);
    startAuto();
  }

  // ── Move track (instant or animated) ──
  function updateTrack(idx, animate) {
    if (!track) return;
    track.style.transition = animate
      ? `transform ${SLIDE_TIME_MS}ms cubic-bezier(0.77,0,0.175,1)`
      : 'none';
    track.style.transform = `translateX(-${idx * 100}%)`;
  }

  // ── Update info card, dots, counter ──
  function updateMeta(idx) {
    const s = slides[idx];

    // Flicker card out, update text, flicker back in
    infoCard.classList.add('transitioning');
    setTimeout(() => {
      infoTitle.textContent = s.title || '';
      infoDesc.textContent  = s.desc  || '';
      infoCard.classList.remove('transitioning');
    }, 200);

    // Counter
    if (counterEl) counterEl.textContent = (idx + 1) + ' / ' + slides.length;

    // Dots
    dotsWrap.querySelectorAll('.slider-dot').forEach((el, i) =>
      el.classList.toggle('active', i === idx));
  }

  // ── Navigate to a specific slide ──
  function goTo(idx, keepAuto) {
    if (busy || slides.length < 2) return;
    const target = ((idx % slides.length) + slides.length) % slides.length;
    if (target === current) return;

    busy = true;
    current = target;

    updateTrack(current, true);
    updateMeta(current);

    setTimeout(() => { busy = false; }, SLIDE_TIME_MS);
    if (!keepAuto) restartAuto();
  }

  // ── Auto-advance with glowing progress bar ──
  function startAuto() {
    clearTimeout(autoTimer);

    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    void progressFill.offsetWidth; // force reflow

    progressFill.style.transition = `width ${DURATION}ms linear`;
    progressFill.style.width = '100%';

    autoTimer = setTimeout(() => {
      goTo(current + 1, true);
      startAuto();
    }, DURATION);
  }

  function restartAuto() {
    if (!paused) startAuto();
  }

  // ── Pause on hover (freeze progress bar at current position) ──
  sliderEl.addEventListener('mouseenter', () => {
    paused = true;
    clearTimeout(autoTimer);
    const pct = (
      parseFloat(getComputedStyle(progressFill).width) /
      parseFloat(getComputedStyle(progressFill.parentElement).width) * 100
    ).toFixed(2);
    progressFill.style.transition = 'none';
    progressFill.style.width = pct + '%';
  });

  sliderEl.addEventListener('mouseleave', () => {
    paused = false;
    restartAuto();
  });

  // ── Arrow buttons ──
  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  // ── Keyboard (when slider is focused) ──
  sliderEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
  });

  // ── Touch / swipe (horizontal only, won't fight page scroll) ──
  let touchStartX = 0;
  let touchStartY = 0;
  sliderEl.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  sliderEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goTo(current + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  // ── Drag to slide (mouse) ──
  let dragStartX  = 0;
  let isDragging  = false;

  sliderEl.addEventListener('mousedown', e => {
    dragStartX = e.clientX;
    isDragging = true;
  });

  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
  });

  // ── Fetch list.json and initialise ──
  fetch('resources/screenshots/list.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      const items = parse(data);
      if (!items.length) throw new Error('empty list');
      build(items);
    })
    .catch(err => {
      console.warn('[Slider] Could not load screenshots:', err);
      viewport.innerHTML = `
        <div class="slider-error">
          <i class="fas fa-image"></i>
          No screenshots found.<br>
          <span style="opacity:0.55;">
            Add PNG files to <code>resources/screenshots/</code>
            and list them in <code>resources/screenshots/list.json</code>.
          </span>
        </div>`;
    });

// ─── Video: click-to-load (privacy-friendly) ─────────
(function () {
  const thumb = document.getElementById('videoThumb');
  const frame = document.getElementById('videoFrame');
  if (!thumb || !frame) return;

  thumb.addEventListener('click', function () {
    const iframe = document.createElement('iframe');
    iframe.id = 'trailerPlayer';
    // youtube-nocookie.com = no tracking cookies before user clicks
    iframe.src =
      'https://www.youtube-nocookie.com/embed/2cSn1n4V_x8' +
      '?autoplay=1&rel=0&color=white&modestbranding=1&enablejsapi=1';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; ' +
      'gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    thumb.remove();
  });

  // Load YouTube IFrame API, then set volume to 25%
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  var firstScript = document.getElementsByTagName('script')[0];
  firstScript.parentNode.insertBefore(tag, firstScript);

  var player;
  window.onYouTubeIframeAPIReady = function () {
    var el = document.getElementById('trailerPlayer');
    if (!el) {
      // Poll until the iframe exists
      var wait = setInterval(function () {
        el = document.getElementById('trailerPlayer');
        if (el) {
          clearInterval(wait);
          player = new YT.Player('trailerPlayer', { events: { 'onReady': function (e) { e.target.setVolume(25); } } });
        }
      }, 200);
    } else {
      player = new YT.Player('trailerPlayer', { events: { 'onReady': function (e) { e.target.setVolume(25); } } });
    }
  };
})();


  // ─── Tech progression scroll-snap sync ───────────────
  (function () {
    const container = document.getElementById('techStages');
    const bar = document.getElementById('techProgressBar');
    if (!container || !bar) return;

    const stages = container.querySelectorAll('.tech-stage');
    const dots = [];

    stages.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'tech-progress-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to stage ' + (i + 1));
      dot.addEventListener('click', function () {
        const target = container.children[i];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
      bar.appendChild(dot);
      dots.push(dot);
    });

    function syncDots() {
      if (stages.length === 0) return;
      let activeIdx = 0;
      let minDist = Infinity;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      stages.forEach((stage, i) => {
        const rect = stage.getBoundingClientRect();
        const stageCenter = rect.left + rect.width / 2;
        const dist = Math.abs(stageCenter - containerCenter);
        if (dist < minDist) {
          minDist = dist;
          activeIdx = i;
        }
      });

      dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIdx));
    }

    container.addEventListener('scroll', syncDots, { passive: true });
    syncDots();
  })();

  // ─── Project Activity (GitHub API) ───────────────────
(function () {
  const dot     = document.getElementById('activityDot');
  const label   = document.getElementById('activityLabel');
  const elCommit  = document.getElementById('act-commit');
  const elRelease = document.getElementById('act-release');
  const elPRs     = document.getElementById('act-prs');
  const elStars   = document.getElementById('act-stars');

  if (!dot) return;

  const REPO    = 'NTNewHorizons/NTNH';
  const HEADERS = { 'Accept': 'application/vnd.github.v3+json' };

  function timeAgo(isoDate) {
    if (!isoDate) return '—';
    const days = Math.floor((Date.now() - new Date(isoDate)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)  return days + 'd ago';
    if (days < 30) return Math.floor(days / 7) + 'w ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  Promise.all([
    fetch(`https://api.github.com/repos/${REPO}`,                         { headers: HEADERS }).then(r => r.json()),
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`,      { headers: HEADERS }).then(r => r.json()),
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=1`,     { headers: HEADERS }).then(r => r.json()),
    fetch(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`, { headers: HEADERS }).then(r => r.json()),
  ]).then(([repo, commits, releases, openPRs]) => {

    const lastCommitDate = commits[0]?.commit?.author?.date;
    const daysSince = Math.floor((Date.now() - new Date(lastCommitDate)) / 86400000);

    // Colour the health dot
    if (daysSince < 7) {
      dot.className = 'activity-dot';               // green (default)
      label.textContent = 'Active Development';
    } else if (daysSince < 30) {
      dot.className = 'activity-dot dot-yellow';
      label.textContent = 'Recently Updated';
    } else {
      dot.className = 'activity-dot dot-red';
      label.textContent = 'Slow Period';
    }

    elCommit.textContent  = timeAgo(lastCommitDate);
    elRelease.textContent = releases[0]?.tag_name ?? '—';
    elPRs.textContent     = Array.isArray(openPRs) ? openPRs.length : '—';
    elStars.textContent   = typeof repo.stargazers_count === 'number'
      ? repo.stargazers_count.toLocaleString()
      : '—';

  }).catch(() => {
    // Fail silently — the bar just stays in its placeholder state
    label.textContent = 'GitHub';
    if (dot) dot.style.display = 'none';
  });
})();
})();
