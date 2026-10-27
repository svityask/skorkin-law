(function () {
  const CFG = window.ADMIN_CONFIG;
  const API = `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/`;
  const CONTENT_PATH = CFG.root + 'content.json';
  const TOKEN_KEY = 'lawyer-admin-token';

  // Подписи разделов и полей
  const SECTIONS = {
    brand: 'Имя и контакты', hero: 'Первый экран', stats: 'Цифры', practice: 'Практика',
    about: 'Обо мне', band: 'Цитата с портретом', cases: 'Типичные ситуации', approach: 'Подход', recognition: 'Принципы',
    contact: 'Контакты', footer: 'Подвал', meta: 'SEO'
  };
  const LABELS = {
    title: 'Заголовок', description: 'Описание', name: 'Имя', monogram: 'Монограмма (2 буквы)',
    tagline: 'Подпись под именем', phone: 'Телефон', email: 'Email', eyebrow: 'Надзаголовок',
    lead: 'Вводный текст', cta_primary: 'Кнопка (основная)', cta_secondary: 'Ссылка (вторая)',
    photo: 'Фотография', seal: 'Текст печати по кругу', author: 'Подпись', telegram: 'Telegram (ник без @)', whatsapp: 'WhatsApp (номер)', photo_caption: 'Подпись к фото', value: 'Значение', label: 'Подпись',
    items: 'Элементы', text: 'Текст', quote: 'Цитата', paragraphs: 'Абзацы', credentials: 'Образование и вехи',
    year: 'Год', note: 'Примечание', area: 'Категория', result: 'Результат', steps: 'Шаги',
    address: 'Адрес (пусто — строка скрыта)', hours: 'Часы работы', card_title: 'Заголовок карточки связи', call_button: 'Кнопка «Позвонить»', mail_button: 'Кнопка «Написать»', card_note: 'Примечание под кнопками', disclaimer: 'Дисклеймер'
  };
  const LONG = new Set(['lead', 'text', 'quote', 'description', 'disclaimer', 'paragraphs', 'note']);

  let token = '';
  let content = null;
  let sha = null;
  let current = 'brand';
  let dirty = false;

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
    kids.flat().forEach((k) => n.append(k));
    return n;
  };

  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

  async function gh(path, opts = {}) {
    const res = await fetch(API + path + (opts.method ? '' : `?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`), {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(opts.headers || {}) }
    });
    if (!res.ok) {
      const err = new Error((await res.json().catch(() => ({}))).message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fileSha(path) {
    try { return (await gh(path)).sha; } catch (e) { if (e.status === 404) return undefined; throw e; }
  }

  function toast(msg, bad) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (bad ? ' toast--bad' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  function setDirty(v) {
    dirty = v;
    $('save').disabled = !v;
    $('status').textContent = v ? 'Есть неопубликованные изменения' : 'Все изменения опубликованы';
  }

  // ---------- Вход ----------
  async function login(t) {
    token = t;
    const file = await gh(CONTENT_PATH);
    sha = file.sha;
    content = JSON.parse(b64decode(file.content));
    try { localStorage.setItem(TOKEN_KEY, t); } catch (_) {}
    $('login').hidden = true;
    $('app').hidden = false;
    buildNav();
    show(current);
    setDirty(false);
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').textContent = '';
    try { await login($('token').value.trim()); }
    catch (err) { $('login-error').textContent = 'Не удалось войти: ' + err.message; }
  });

  $('logout').addEventListener('click', () => {
    if (dirty && !confirm('Есть неопубликованные изменения. Выйти?')) return;
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    location.reload();
  });

  // ---------- Навигация ----------
  function buildNav() {
    const nav = $('side-nav');
    nav.innerHTML = '';
    Object.keys(content).sort((a, b) => order(a) - order(b)).forEach((key) => {
      nav.append(el('button', { class: 'side__link', 'data-key': key, onclick: () => show(key) }, SECTIONS[key] || key));
    });
  }
  const order = (k) => { const i = Object.keys(SECTIONS).indexOf(k); return i < 0 ? 99 : i; };

  function show(key) {
    current = key;
    document.querySelectorAll('.side__link').forEach((b) => b.classList.toggle('is-active', b.dataset.key === key));
    $('section-title').textContent = SECTIONS[key] || key;
    const editor = $('editor');
    editor.innerHTML = '';
    editor.append(field(content, key, key, true));
  }

  // ---------- Редактор ----------
  // Рисует поле для parent[key]; изменения пишутся прямо в объект content
  function field(parent, key, name, root) {
    const value = parent[key];
    const label = LABELS[name] || name;

    if (name === 'photo') return photoField(parent, key);

    if (Array.isArray(value)) return arrayField(value, name, label);

    if (value && typeof value === 'object') {
      const box = el('div', { class: root ? 'group group--root' : 'group' });
      Object.keys(value).forEach((k) => box.append(field(value, k, k)));
      return box;
    }

    const long = LONG.has(name) || String(value).length > 90;
    const input = long ? el('textarea', { rows: 4 }) : el('input', { type: 'text' });
    input.value = value ?? '';
    input.addEventListener('input', () => { parent[key] = input.value; setDirty(true); });
    return el('label', { class: 'field' }, el('span', {}, label), input);
  }

  function arrayField(arr, name, label) {
    const wrap = el('div', { class: 'list' });
    const head = el('div', { class: 'list__head' }, el('h3', {}, label));
    const body = el('div', { class: 'list__body' });
    const childName = name === 'paragraphs' ? 'paragraphs' : 'item';

    const redraw = () => {
      body.innerHTML = '';
      arr.forEach((_, i) => {
        const card = el('div', { class: 'card' });
        const tools = el('div', { class: 'card__tools' },
          el('span', { class: 'card__num' }, String(i + 1).padStart(2, '0')),
          el('button', { class: 'icon', title: 'Выше', onclick: () => move(i, -1) }, '↑'),
          el('button', { class: 'icon', title: 'Ниже', onclick: () => move(i, 1) }, '↓'),
          el('button', { class: 'icon icon--bad', title: 'Удалить', onclick: () => remove(i) }, '✕'));
        card.append(tools);
        if (arr[i] && typeof arr[i] === 'object') {
          Object.keys(arr[i]).forEach((k) => card.append(field(arr[i], k, k)));
        } else {
          card.append(field(arr, i, childName === 'item' ? 'text' : childName));
        }
        body.append(card);
      });
    };
    const move = (i, d) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      setDirty(true); redraw();
    };
    const remove = (i) => {
      if (!confirm('Удалить элемент?')) return;
      arr.splice(i, 1); setDirty(true); redraw();
    };
    const add = () => {
      const sample = arr[0];
      const blank = sample && typeof sample === 'object'
        ? Object.fromEntries(Object.keys(sample).map((k) => [k, ''])) : '';
      arr.push(blank); setDirty(true); redraw();
    };

    head.append(el('button', { class: 'btn btn--small', onclick: add }, '+ Добавить'));
    redraw();
    wrap.append(head, body);
    return wrap;
  }

  function photoField(parent, key) {
    const preview = el('img', { class: 'photo__img', alt: '' });
    const setPreview = () => { preview.src = '../' + parent[key]; };
    preview.onerror = () => { preview.removeAttribute('src'); };
    setPreview();
    const input = el('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        $('status').textContent = 'Загрузка фото…';
        const data = await resize(file, 1600);
        // Перезаписываем тот же файл, на который ссылается поле (portrait.jpg, portrait-close.jpg…)
        const rel = String(parent[key] || 'assets/photo.jpg').split('?')[0];
        const PHOTO_PATH = CFG.root + rel;
        await gh(PHOTO_PATH, {
          method: 'PUT',
          body: JSON.stringify({ message: 'Обновить фото на сайте', content: data, branch: CFG.branch, sha: await fileSha(PHOTO_PATH) })
        });
        parent[key] = rel + '?v=' + Date.now();
        preview.src = 'data:image/jpeg;base64,' + data;
        setDirty(true);
        toast('Фото загружено. Нажмите «Опубликовать», чтобы сохранить ссылку.');
      } catch (err) { toast('Ошибка загрузки фото: ' + err.message, true); setDirty(dirty); }
    });
    return el('div', { class: 'field photo' },
      el('span', {}, LABELS.photo),
      el('div', { class: 'photo__row' }, preview,
        el('div', {}, el('label', { class: 'btn btn--ghost btn--small' }, 'Выбрать файл', input),
          el('p', { class: 'muted small' }, 'Вертикальное фото 4:5, от 1200 px по высоте. Будет сжато автоматически.'))));
  }

  function resize(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.88).split(',')[1]);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- Сохранение ----------
  $('save').addEventListener('click', async () => {
    $('save').disabled = true;
    $('status').textContent = 'Публикация…';
    try {
      const res = await gh(CONTENT_PATH, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Обновить контент сайта: ${SECTIONS[current] || current}`,
          content: b64encode(JSON.stringify(content, null, 2) + '\n'),
          sha, branch: CFG.branch
        })
      });
      sha = res.content.sha;
      setDirty(false);
      toast('Опубликовано. Изменения появятся на сайте через 1–2 минуты.');
    } catch (err) {
      setDirty(true);
      toast(err.status === 409 ? 'Файл изменён в другом месте — обновите страницу.' : 'Ошибка: ' + err.message, true);
    }
  });

  $('download').addEventListener('click', () => {
    const a = el('a', { download: 'content.json', href: URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })) });
    a.click();
  });

  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Автовход по сохранённому ключу
  let saved = '';
  try { saved = localStorage.getItem(TOKEN_KEY) || ''; } catch (_) {}
  if (saved) login(saved).catch(() => { $('login-error').textContent = 'Сохранённый ключ недействителен — войдите заново.'; });
})();
