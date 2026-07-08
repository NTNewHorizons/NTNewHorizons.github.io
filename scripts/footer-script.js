(function () {
  const banner  = document.getElementById('cookieBanner');
  const dismissed = localStorage.getItem('cookiesAccepted') || localStorage.getItem('cookiesDismissed');
  if (dismissed) { if (banner) banner.remove(); return; }
  const dismiss = () => {
    if (!banner) return;
    banner.classList.add('hiding');
    banner.addEventListener('animationend', () => banner.remove(), { once: true });
  };
  const acceptBtn = document.getElementById('cookieAccept');
  const declineBtn = document.getElementById('cookieDecline');
  if (acceptBtn) acceptBtn.addEventListener('click', () => {
    localStorage.setItem('cookiesAccepted', 'true');
    dismiss();
  });
  if (declineBtn) declineBtn.addEventListener('click', () => {
    localStorage.setItem('cookiesDismissed', 'true');
    dismiss();
  });
})();

document.getElementById('currentYear').textContent = new Date().getFullYear();

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
