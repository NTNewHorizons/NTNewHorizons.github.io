(function () {
  const field = document.getElementById('particleField');
  if (!field) return;
  const colors = ['var(--orange)', 'var(--red)', 'var(--yellow)', 'rgba(255,80,0,0.6)'];

  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left               = Math.random() * 100 + 'vw';
    p.style.width              = (Math.random() * 3 + 1.5) + 'px';
    p.style.height             = p.style.width;
    p.style.background         = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration  = (Math.random() * 14 + 8) + 's';
    p.style.animationDelay     = (Math.random() * -20) + 's';
    field.appendChild(p);
  }
})();
