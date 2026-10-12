/* kylegreen.design — small, dependency-free interactions */
(function () {
  const root = document.documentElement;
  root.classList.add('js');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Normalize doodle path lengths so CSS dash animation works without measuring */
  document.querySelectorAll('.doodle .dl').forEach(p => p.setAttribute('pathLength', '1'));

  /* Year */
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* Scroll reveals */
  const targets = document.querySelectorAll('.rule--draw, .timeline, .principle, .tile, .sketch__art');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    targets.forEach(t => io.observe(t));
  } else {
    targets.forEach(t => t.classList.add('is-in'));
  }

  /* Nav: hide on scroll down, show on scroll up; switch to paper style past the hero */
  const nav = document.getElementById('nav');
  const hero = document.querySelector('.hero');
  let lastY = window.scrollY, ticking = false;

  function onScroll() {
    const yNow = window.scrollY;
    const heroBottom = hero ? hero.offsetTop + hero.offsetHeight - 80 : 0;
    nav.classList.toggle('is-paper', yNow > heroBottom);
    if (yNow > lastY && yNow > 160) nav.classList.add('is-hidden');
    else nav.classList.remove('is-hidden');
    lastY = yNow;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* Active section link */
  const links = Array.from(document.querySelectorAll('.nav__links a'));
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    sections.forEach(s => so.observe(s));
  }
})();

/* Carousels (phones): swipe indicator with counter + dots, mirrors the Figma "2/4" pattern */
(function () {
  const mq = window.matchMedia('(max-width: 820px)');
  document.querySelectorAll('[data-carousel]').forEach(track => {
    const items = Array.from(track.children);
    if (items.length < 2) return;
    const ind = document.createElement('div');
    ind.className = 'carousel-indicator';
    ind.setAttribute('aria-label', (track.dataset.carousel || 'Carousel') + ' position');
    const count = document.createElement('span'); count.className = 'carousel-indicator__count';
    const dots = document.createElement('div'); dots.className = 'carousel-indicator__dots';
    // visual order can differ from DOM order (timeline runs newest-first on phones)
    const ordered = () => items.filter(el => el.nodeType === 1).slice().sort((a, b) => a.offsetLeft - b.offsetLeft);
    const btns = items.map(() => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'carousel-indicator__dot';
      dots.appendChild(b); return b;
    });
    ind.appendChild(count); ind.appendChild(dots); ind.appendChild(document.createElement('span'));
    track.insertAdjacentElement('afterend', ind);

    function update() {
      if (!mq.matches) return;
      const list = ordered();
      const x = track.scrollLeft;
      const base = list[0].offsetLeft;
      let idx = 0, best = Infinity;
      list.forEach((el, i) => { const d = Math.abs(el.offsetLeft - base - x); if (d < best) { best = d; idx = i; } });
      btns.forEach((b, i) => { b.classList.toggle('is-active', i === idx); b.setAttribute('aria-label', 'Go to ' + (i + 1) + ' of ' + list.length); });
      count.textContent = (idx + 1) + '/' + list.length;
    }
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const el = ordered()[i];
      track.scrollTo({ left: el.offsetLeft - ordered()[0].offsetLeft, behavior: 'smooth' });
    }));
    let raf = false;
    track.addEventListener('scroll', () => { if (!raf) { raf = true; requestAnimationFrame(() => { update(); raf = false; }); } }, { passive: true });
    window.addEventListener('resize', update);
    // data-carousel-start="end" opens on the last card (the career timeline opens on today)
    if (track.dataset.carouselStart === 'end' && mq.matches) track.scrollLeft = track.scrollWidth;
    update();
  });
})();

/* Experience timeline: opens on today; the DeLorean rides the track as you scroll back in time */
(function () {
  const track = document.querySelector('.timeline');
  if (!track) return;
  const wrap = track.parentElement;
  const car = wrap.querySelector('.timeline__car');
  const hint = wrap.querySelector('.timeline__hint');
  const items = Array.from(track.querySelectorAll('.timeline__item'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let touched = false;

  /* Open on the present */
  const toToday = () => { if (!touched) track.scrollLeft = track.scrollWidth; };
  toToday();

  const markTouched = () => { touched = true; if (hint) hint.classList.add('is-gone'); };
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev => track.addEventListener(ev, markTouched, { passive: true }));

  /* Mouse drag (trackpads and touch scroll natively) */
  let drag = null;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft };
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) track.classList.add('is-dragging');
    track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => { drag = null; track.classList.remove('is-dragging'); };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  /* The car */
  if (!car) return;
  const img = car.querySelector('img');
  if (img) img.addEventListener('error', () => car.remove()); // no image yet? the timeline still works
  const dotX = i => items[i].offsetLeft + 6; // centre of the 12px dot, in track coordinates
  let last = track.scrollLeft, trail = 0, raf = 0;

  function place() {
    raf = 0;
    const x = track.scrollLeft;
    const max = Math.max(1, track.scrollWidth - track.clientWidth);
    const p = Math.min(1, Math.max(0, x / max));
    const along = dotX(0) + (dotX(items.length - 1) - dotX(0)) * p; // 0 = 2001, 1 = today
    car.style.transform = 'translate3d(' + (track.offsetLeft + along - x - 12).toFixed(1) + 'px,0,0)';

    let idx = 0, best = Infinity;
    items.forEach((el, i) => { const d = Math.abs(dotX(i) - along); if (d < best) { best = d; idx = i; } });
    items.forEach((el, i) => el.classList.toggle('is-here', i === idx));

    const dx = x - last; last = x;
    if (Math.abs(dx) > 0.5) car.classList.toggle('is-forward', dx > 0); // faces the way you're travelling
    if (!reduce) {
      trail = Math.min(1, Math.max(trail * 0.9, Math.abs(dx) / 24));
      car.style.setProperty('--trail', trail < 0.02 ? '0' : trail.toFixed(3));
      if (trail >= 0.02) raf = requestAnimationFrame(place); // let the flames die down
    }
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
  track.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('load', () => { toToday(); last = track.scrollLeft; place(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { toToday(); last = track.scrollLeft; place(); });
  place();
})();
