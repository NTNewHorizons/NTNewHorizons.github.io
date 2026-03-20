// Set footer year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// ─── Scroll reveal ───
const revealObs = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
);
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ─── Install method tabs ───
const tabs   = document.querySelectorAll('.dl-tab');
const panels = document.querySelectorAll('.method-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const panel = document.getElementById('tab-' + target);
    if (panel) panel.classList.add('active');
  });
});

// ─── FAQ accordion ───
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // Close all open items
    document.querySelectorAll('.faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    // Open the clicked item if it was previously closed
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});
