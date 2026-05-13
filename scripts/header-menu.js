document.addEventListener('DOMContentLoaded', function () {
  const burger = document.querySelector('.nav-burger-btn');
  const menu = document.getElementById('navMenu');
  if (!burger || !menu) return;

  const closeMenu = () => {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };

  burger.addEventListener('click', function (event) {
    event.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(isOpen));
    menu.setAttribute('aria-hidden', String(!isOpen));
    burger.classList.add('spin');
    setTimeout(() => burger.classList.remove('spin'), 520);
  });

  menu.addEventListener('click', function (event) {
    const link = event.target.closest('a');
    if (link) {
      closeMenu();
    }
  });

  document.addEventListener('click', function (event) {
    if (!menu.contains(event.target) && !burger.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
});
