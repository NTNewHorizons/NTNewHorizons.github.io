(function () {
  var burger  = document.getElementById('navBurger');
  var menu    = document.getElementById('mobileMenu');
  var overlay = document.getElementById('mobileOverlay');
  if (!burger || !menu || !overlay) return;

  function open() {
    menu.classList.add('open');
    overlay.classList.add('open');
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    menu.classList.remove('open');
    overlay.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', function () {
    burger.classList.contains('open') ? close() : open();
  });
  overlay.addEventListener('click', close);
  menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
