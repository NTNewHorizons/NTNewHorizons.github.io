(function() {
  var btn = document.getElementById('hamburgerToggle');
  var menu = document.getElementById('hamburgerMenu');
  var overlay = document.getElementById('hamburgerOverlay');
  if (!btn || !menu || !overlay) return;

  function open() {
    menu.classList.add('open');
    overlay.classList.add('open');
    btn.classList.add('spinning');
    btn.setAttribute('aria-expanded', 'true');
    setTimeout(function() { btn.classList.remove('spinning'); }, 600);
  }

  function close() {
    menu.classList.remove('open');
    overlay.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    if (menu.classList.contains('open')) {
      close();
    } else {
      open();
    }
  });

  overlay.addEventListener('click', close);

  menu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', close);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) close();
  });

  var navBar = document.querySelector('.nav-bar');
  var lastScroll = 0;
  var scrollThreshold = 10;
  if (navBar) {
    window.addEventListener('scroll', function() {
      var currentScroll = window.pageYOffset;
      var delta = currentScroll - lastScroll;

      if (currentScroll <= 0) {
        navBar.classList.remove('nav-hidden');
        lastScroll = currentScroll;
        return;
      }

      if (Math.abs(delta) < scrollThreshold) return;

      if (delta > 0) {
        navBar.classList.add('nav-hidden');
      } else {
        navBar.classList.remove('nav-hidden');
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }
})();
