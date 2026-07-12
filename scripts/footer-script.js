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
