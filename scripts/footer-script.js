(function () {
  const banner  = document.getElementById('cookieBanner');
  if (localStorage.getItem('cookiesAccepted')) { if (banner) banner.remove(); return; }
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
    window.location.href = 'https://en.wikipedia.org/wiki/Cookie';
    dismiss();
  });
})();

document.getElementById('currentYear').textContent = new Date().getFullYear();
