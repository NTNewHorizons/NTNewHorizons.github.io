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
