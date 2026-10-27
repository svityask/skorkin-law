(function () {
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const $ = (id) => document.getElementById(id);

  function render(c) {
    document.title = c.meta.title;
    document.querySelector('meta[name="description"]').content = c.meta.description;

    document.querySelectorAll('[data-bind]').forEach((el) => { el.textContent = get(c, el.dataset.bind) ?? ''; });
    document.querySelectorAll('[data-bind-href]').forEach((el) => {
      const [scheme, path] = el.dataset.bindHref.split(':');
      const v = String(get(c, path) || '');
      el.href = scheme + ':' + (scheme === 'tel' ? v.replace(/[^\d+]/g, '') : v);
    });

    const img = $('portrait');
    if (c.hero.photo) {
      img.src = c.hero.photo;
      img.alt = c.hero.photo_caption || c.brand.name;
      img.onerror = () => img.remove();
    } else img.remove();

    // Надпись печати — SVG-картинка: каждая буква повёрнута атрибутом transform внутри SVG,
    // а вращается сам <img>. Так iOS Safari не сдвигает буквы с окружности.
    const chars = [...(c.hero.seal || '').toUpperCase()];
    const glyphs = chars.map((ch, i) =>
      `<text x="100" y="27" transform="rotate(${((360 / chars.length) * i).toFixed(2)} 100 100)">${esc(ch)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g font-family="Helvetica Neue, Arial, sans-serif" font-size="15" font-weight="500" fill="#0d1b2e" text-anchor="middle">${glyphs}</g></svg>`;
    $('seal-text').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

    const band = $('band-photo');
    if (c.band && c.band.photo) { band.src = c.band.photo; band.alt = c.band.author || ''; }
    else document.querySelector('.band').classList.add('band--nophoto');

    const links = [
      ['Telegram', c.brand.telegram && 'https://t.me/' + c.brand.telegram.replace(/^@|https?:\/\/t\.me\//g, '')],
      ['WhatsApp', c.brand.whatsapp && 'https://wa.me/' + c.brand.whatsapp.replace(/\D/g, '')]
    ].filter(([, href]) => href);
    $('messengers').innerHTML = links.map(([name, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${name}</a>`).join('');
    if (!links.length) document.querySelectorAll('.js-messengers').forEach((n) => n.remove());

    $('stats').innerHTML = c.stats.map((s) =>
      `<div class="stat reveal"><div class="stat__value" data-count="${esc(s.value)}">${esc(s.value)}</div><div class="stat__label">${esc(s.label)}</div></div>`).join('');

    $('practice-list').innerHTML = c.practice.items.map((p, i) =>
      `<article class="practice__item reveal"><span class="practice__num">${roman[i] || i + 1}.</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join('');

    $('about-text').innerHTML = c.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('');
    $('credentials').innerHTML = c.about.credentials.map((x) => `<li class="reveal"><b>${esc(x.year)}</b><span>${esc(x.text)}</span></li>`).join('');

    $('cases-list').innerHTML = c.cases.items.map((x) =>
      `<div class="case reveal"><span class="case__year">${esc(x.year)}</span><span class="case__area">${esc(x.area)}</span><span class="case__title">${esc(x.title)}</span><span class="case__result">${esc(x.result)}</span></div>`).join('');

    $('steps').innerHTML = c.approach.steps.map((s, i) =>
      `<div class="step reveal"><div class="step__num">0${i + 1}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('');

    $('recognition').innerHTML = c.recognition.items.map((r) => `<span>${esc(r)}</span>`).join('');

    $('year').textContent = new Date().getFullYear();

    if (!c.contact.address) document.querySelectorAll('.js-address').forEach((n) => n.remove());

    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      const num = en.target.querySelector('[data-count]');
      if (num) countUp(num);
      io.unobserve(en.target);
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  // Плавный счёт для цифр вида «25+»; текстовые значения («Сотни», «С 2009») не трогаем
  function countUp(node) {
    const m = node.dataset.count.match(/^()(\d+)(\D*)$/);
    if (!m || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = +m[2], t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.textContent = m[1] + Math.round(target * e) + m[3];
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const topbar = document.querySelector('.topbar');
  const onScroll = () => {
    topbar.classList.toggle('is-scrolled', scrollY > 40);
    document.body.classList.toggle('show-mbar', scrollY > 500);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  $('burger').addEventListener('click', () => $('nav').classList.toggle('is-open'));
  $('nav').addEventListener('click', (e) => { if (e.target.tagName === 'A') $('nav').classList.remove('is-open'); });

  fetch('content.json?v=' + Date.now())
    .then((r) => r.json())
    .then(render)
    .catch((err) => console.error('Не удалось загрузить content.json', err));
})();
