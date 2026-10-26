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

    $('stats').innerHTML = c.stats.map((s) =>
      `<div class="stat reveal"><div class="stat__value">${esc(s.value)}</div><div class="stat__label">${esc(s.label)}</div></div>`).join('');

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

    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = `Имя: ${f.get('name')}\nКонтакт: ${f.get('contact')}\n\n${f.get('message')}`;
      location.href = `mailto:${c.brand.email}?subject=${encodeURIComponent('Запрос на консультацию')}&body=${encodeURIComponent(body)}`;
    });

    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  $('burger').addEventListener('click', () => $('nav').classList.toggle('is-open'));
  $('nav').addEventListener('click', (e) => { if (e.target.tagName === 'A') $('nav').classList.remove('is-open'); });

  fetch('content.json?v=' + Date.now())
    .then((r) => r.json())
    .then(render)
    .catch((err) => console.error('Не удалось загрузить content.json', err));
})();
