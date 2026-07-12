document.getElementById('currentYear').textContent = new Date().getFullYear();

(function () {
  const banner = document.getElementById('jokeBanner');
  const dismissed = localStorage.getItem('jokeBannerDismissed');
  if (dismissed || !banner) { if (banner) banner.remove(); return; }
  const dismiss = () => {
    banner.classList.add('hiding');
    banner.addEventListener('animationend', () => banner.remove(), { once: true });
    localStorage.setItem('jokeBannerDismissed', 'true');
  };
  document.getElementById('jokeBannerClose').addEventListener('click', dismiss);
  document.getElementById('jokeAccept').addEventListener('click', () => {
    window.open('https://en.wikipedia.org/wiki/Cookie', '_blank');
  });
  document.getElementById('jokeDecline').addEventListener('click', () => {
    window.open('https://en.wikipedia.org/wiki/Diabetes', '_blank');
  });
})();

(function () {
  const bar = document.getElementById('announcementBar');
  if (!bar || localStorage.getItem('ostAnnouncementDismissed')) return;
  const closeBtn = document.getElementById('announcementClose');
  if (!closeBtn) return;
  closeBtn.addEventListener('click', () => {
    bar.classList.add('hiding');
    bar.addEventListener('animationend', () => bar.remove(), { once: true });
    localStorage.setItem('ostAnnouncementDismissed', 'true');
  });
})();
