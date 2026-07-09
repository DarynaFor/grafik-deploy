/* Milena · Спринт 1 — вход, карточки сотрудников, специальности, журнал.
   Данные — через store.js (демо: localStorage · прод: Supabase).
   Все пользовательские строки при выводе проходят esc() — без исключений. */
import { makeStore, lineLabel } from './store.js';

const store = makeStore();
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── иконки ── */
const I = (p, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  users: I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 20),
  tag: I('<path d="M3 11.6V5a2 2 0 0 1 2-2h6.6a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.6Z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>', 20),
  journal: I('<path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-2.5-1.6-2 1.6-2-1.6-2 1.6-2-1.6L5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M9 8h6M9 12h6"/>', 20),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.8-3.8"/>', 16),
  plus: I('<path d="M12 5v14M5 12h14"/>', 16),
  check: I('<path d="M20 6 9 17l-5-5"/>', 16),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 16),
  lock: I('<rect x="3.5" y="11" width="17" height="10.5" rx="2.5"/><path d="M7.5 11V7a4.5 4.5 0 0 1 9 0v4"/>', 15),
  out: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', 17),
  chevL: I('<path d="m15 18-6-6 6-6"/>', 16),
  chevR: I('<path d="m9 18 6-6-6-6"/>', 16),
  chevD: I('<path d="m6 9 6 6 6-6"/>', 16),
  minus: I('<path d="M5 12h14"/>', 15),
  coin: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 16.5V7.5h3a2.6 2.6 0 0 1 0 5.2H9.5M8.5 14h4.5"/>', 20),
  cal: I('<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>', 20),
  sun: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>', 18),
  moon: I('<path d="M20.5 13.2A8 8 0 1 1 10.8 3.5a6.2 6.2 0 0 0 9.7 9.7Z"/>', 18),
};
function applyIcons(root) { (root || document).querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ICONS[e.dataset.ic] || ''; }); }

/* тема: тёмная/светлая. По умолчанию — как в системе; ручной выбор запоминается на устройстве.
   Начальный data-theme ставит инлайн-скрипт в <head> (до отрисовки — без мигания). */
const THEME_KEY = 'milena-theme';
const curTheme = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
function paintThemeBtn() { const b = $('themeBtn'); if (b) { b.innerHTML = curTheme() === 'light' ? ICONS.moon : ICONS.sun; b.title = curTheme() === 'light' ? 'Тёмная тема' : 'Светлая тема'; } }
function toggleTheme() { const next = curTheme() === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem(THEME_KEY, next); } catch (e) {} paintThemeBtn(); }

const palette = ['#CDE9D6', '#D3E2F7', '#F6DAC9', '#E6DEF9', '#FBEAC6', '#CFEBE6', '#F7D6DA', '#E3E9D0'];
// цвет отделения (категория специальности) — свой оттенок для точки-маркера, стабильно по позиции
const DEPT_COLORS = ['#5AB0E6', '#5FC08A', '#E0A24F', '#C77FD8', '#EA7B7B', '#5FC4B4', '#B9A24A', '#8A93E0'];
// пастельные версии — для фона аватарок (тёмный текст поверх), отделение считывается по цвету
const DEPT_TINTS = ['#CFE7F6', '#D2EDDD', '#F5E2C6', '#EDD7F2', '#F8D9D9', '#CFEDE7', '#E8E2C3', '#DADEF5'];
const deptCats = () => [...new Set([...specialties.map(s => s.category), 'Прочие'])];
const catIdx = cat => Math.max(0, deptCats().indexOf(cat));
const catColor = cat => DEPT_COLORS[catIdx(cat) % DEPT_COLORS.length];
const catTint = cat => DEPT_TINTS[catIdx(cat) % DEPT_TINTS.length];
const initials = f => String(f || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const PAY_KINDS = [['оклад', 'Оклад'], ['сутки', 'Сутки'], ['12ч', '12ч день / ночь'], ['почасово', 'Почасово'], ['процент', 'Процент']];
const fmtDT = iso => { const d = new Date(iso); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };

/* Надёжный разбор денежной суммы. Пробелы = разделитель тысяч. «50.000»/«50,000»
   (ровно 3 цифры после точки/запятой) = тысячи → 50000. Одна запятая = десятичный.
   Требует ПОЛНОГО совпадения формата — иначе кидает, а не обрезает молча (это payroll).
   Пусто → null (вызывающий сам решает, обязательно ли поле). Потолок под numeric(12,2). */
function parseNum(raw, opts) {
  const field = (opts && opts.field) || 'значение', thousands = !!(opts && opts.thousands);
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  if (thousands && /^\d{1,3}[.,]\d{3}$/.test(s)) s = s.replace(/[.,]/, '');
  else s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Проверьте ' + field + ': только цифры (напр. 50000 или 50000.50)');
  const v = parseFloat(s);
  if (v > 9999999.99) throw new Error('Слишком большая сумма (' + field + ')');
  return v;
}

let specialties = [], employees = [], curScreen = 'employees';

/* ── вход ── */
function renderLogin() {
  const body = $('loginBody'), foot = $('loginFoot');
  if (store.mode === 'demo') {
    $('loginSub').textContent = 'Демо-режим: данные хранятся только в этом браузере.';
    body.innerHTML = `<div class="demo-badge">${ICONS.lock} демо · без сервера</div><div style="height:14px"></div>` +
      store.demoUsers().map(u => `<button class="userbtn" data-uid="${esc(u.id)}"><span class="emp-ava" style="width:40px;height:40px;border-radius:13px;background:${palette[u.id.length % palette.length]}">${esc(initials(u.name))}</span><b>${esc(u.name)}</b><span class="role">${u.role === 'owner' ? 'владелец' : 'оператор'}</span></button>`).join('');
    body.querySelectorAll('.userbtn').forEach(b => b.onclick = async () => { try { await store.loginDemo(b.dataset.uid); await enter(); } catch (e) { toast('Не удалось войти: ' + (e.message || e), true); } });
    foot.innerHTML = 'После подключения базы здесь будет вход по почте и паролю. <button id="resetDemo" style="color:var(--ink-2);text-decoration:underline">Сбросить демо-данные</button>';
    const rd = $('resetDemo'); if (rd) rd.onclick = () => { store.resetDemo(); toast('Демо-данные сброшены'); };
  } else {
    body.innerHTML = `<label class="flbl">Почта</label><input class="input" id="lgEmail" type="email" autocomplete="username">
      <label class="flbl">Пароль</label><input class="input" id="lgPass" type="password" autocomplete="current-password">
      <div style="height:16px"></div><button class="btn btn-primary" id="lgGo" style="width:100%;justify-content:center">Войти</button>
      <div class="small" id="lgErr" style="color:var(--red);margin-top:10px"></div>`;
    const go = async () => {
      $('lgErr').textContent = '';
      try { await store.login($('lgEmail').value.trim(), $('lgPass').value); await enter(); }
      catch (e) { $('lgErr').textContent = 'Не получилось войти: ' + e.message; }
    };
    $('lgGo').onclick = go;
    $('lgPass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    foot.textContent = 'Доступ выдаёт владелец. Забыли пароль — напишите владельцу.';
  }
}

/* ── каркас после входа ── */
const NAV = [
  { s: 'employees', i: 'users', l: 'Сотрудники', staffOnly: true },
  { s: 'schedule', i: 'cal', l: 'График', staffOnly: true },
  { s: 'rates', i: 'coin', l: 'Ставки', ownerOnly: true },
  { s: 'specialties', i: 'tag', l: 'Специальности', staffOnly: true },
  { s: 'journal', i: 'journal', l: 'Журнал', ownerOnly: true },
];
function isOwner() { return store.me()?.role === 'owner'; }
function navItems() { return NAV.filter(n => (!n.ownerOnly || isOwner()) && (!n.staffOnly || isStaff())); }
function renderNav() {
  $('sideNav').innerHTML = navItems().map(n => `<button class="nav-item${n.s === curScreen ? ' active' : ''}" data-s="${n.s}"><span class="ic">${ICONS[n.i]}</span>${n.l}</button>`).join('');
  $('mobileNav').innerHTML = navItems().map(n => `<button data-s="${n.s}" class="${n.s === curScreen ? 'active' : ''}"><span>${ICONS[n.i]}</span>${n.l}</button>`).join('');
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go(b.dataset.s));
}
function go(screen) {
  curScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  $('s-' + screen).classList.add('show');
  renderNav();
  document.querySelector('.main').scrollTop = 0;
}
const ROLE_LABELS = { owner: 'владелец', operator: 'оператор', cashier1: 'касса · Бух 1', cashier2: 'карта / 1С · Бух 2' };
const isStaff = () => ['owner', 'operator'].includes(store.me()?.role);   // кто работает с карточками
// График ведёт оператор (Алёна) с переданных головами отделений листов. Владелец (Милена) — только просмотр.
// Позже добавим роли голов отделений — они будут вносить свой отдел; тогда сюда добавится их роль.
const canEditSchedule = () => store.me()?.role === 'operator';
async function enter() {
  const me = store.me(); if (!me) return;
  document.body.classList.add('authed');
  $('whoName').textContent = me.name;
  $('whoRole').textContent = ROLE_LABELS[me.role] || me.role;
  $('whoRole').className = 'rolepill ' + me.role;
  $('modeTag').textContent = store.mode === 'demo' ? 'демо · этот браузер' : 'спринт 1';
  // Кассиры (Бух 1/2): их раздел (касса / карта-1С) — следующий спринт. Показываем понятную заглушку.
  if (!isStaff()) {
    renderNav();
    $('soonIc').innerHTML = ICONS.lock ? `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M3 11h18M8 3.5V7"/></svg>` : '';
    const cash = me.role === 'cashier1';
    $('soonTitle').textContent = cash ? 'Касса — выдача наличных' : 'Карта / 1С — авансы и сверка';
    $('soonText').innerHTML = (cash
      ? 'Здесь будет выдача наличных по одному: сумма + СМС-подтверждение сотрудника, частичные выдачи, журнал.'
      : 'Здесь будут авансы на карту и сверка с 1С.')
      + `<br><br><span style="color:var(--ink-3)">Этот раздел — следующий спринт. Пока в приложении готовы карточки сотрудников (для владельца и Алёны). Демо кассы можно посмотреть в прототипе.</span>`;
    go('soon');
    return;
  }
  $('addEmpBtn').style.display = isOwner() ? '' : 'none';
  $('roNote').innerHTML = isOwner() ? '' : `<div class="readonly-note">${ICONS.lock} Карточки, телефоны и ставки заводит и меняет владелец — у вас просмотр.</div>`;
  await refresh();
  go('employees');
}
// Кастомный дропдаун «в нашем стиле»: нативный <select> нельзя стилизовать — попап с
// опциями рисует ОС (белый, чужой теме). host — div.cselect; opts — [{v,label}]; onPick(v).
function makeDropdown(host, opts, cur, onPick) {
  const curLabel = (opts.find(o => o.v === cur) || opts[0]).label;
  host.classList.add('cselect');
  host.dataset.value = cur;
  host.innerHTML = `<button class="cselect-trigger" type="button"><span class="cselect-label">${esc(curLabel)}</span>${ICONS.chevD}</button>
    <div class="cselect-panel" role="listbox">${opts.map(o => `<div class="cselect-opt${o.v === cur ? ' sel' : ''}" role="option" data-v="${esc(o.v)}">${esc(o.label)}</div>`).join('')}</div>`;
  host.querySelector('.cselect-trigger').onclick = e => {
    e.stopPropagation();
    const willOpen = !host.classList.contains('open');
    document.querySelectorAll('.cselect.open').forEach(d => d.classList.remove('open'));
    host.classList.toggle('open', willOpen);
  };
  host.querySelectorAll('.cselect-opt').forEach(o => o.onclick = () => {
    host.dataset.value = o.dataset.v;
    host.querySelector('.cselect-label').textContent = o.textContent;
    host.querySelectorAll('.cselect-opt').forEach(x => x.classList.toggle('sel', x === o));
    host.classList.remove('open');
    onPick(o.dataset.v);
  });
}
document.addEventListener('click', () => document.querySelectorAll('.cselect.open').forEach(d => d.classList.remove('open')));

// Наполняем дропдауны «Отделение» при загрузке данных (не в рендерах — чтобы не пересобирать
// на каждый ввод). Выбор сразу перерисовывает через onPick (drawSchedule/renderEmployees).
function fillCatSelects() {
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  const opts = [{ v: '', label: 'Все отделения' }, ...cats.map(c => ({ v: c, label: c }))];
  const wire = (id, onPick) => { const el = $(id); if (el) makeDropdown(el, opts, el.dataset.value || '', onPick); };
  wire('empCat', () => renderEmployees($('empSearch').value || ''));
  wire('schedCat', () => drawSchedule());
}
async function refresh() {
  [specialties, employees] = await Promise.all([store.listSpecialties(), store.listEmployees()]);
  fillCatSelects();
  renderEmployees($('empSearch').value || '');
  renderSpecs();
  renderSchedule();
  if (isOwner()) { renderRates($('rateSearch')?.value || ''); renderJournal(); }
}

/* ── сотрудники ── */
const specName = id => specialties.find(s => s.id === id)?.name || '—';
const specCat = id => specialties.find(s => s.id === id)?.category || 'Прочие';
function activeLines(e) { return (e.lines || []).filter(l => !l.valid_to).sort((a, b) => (a.line_type === 'основной' ? 0 : 1) - (b.line_type === 'основной' ? 0 : 1)); }
// Пробелы карточки: чего не хватает, чтобы человек был готов к расчёту/выдаче.
const FIO_SENTINEL = '⚠ уточнить фамилию';   // маркер неполного ФИО, лежит в position импортированных карточек
function cardGaps(e) {
  const fio = String(e.fio || '').trim();
  const digits = String(e.phone || '').replace(/\D/g, '');
  return {
    // пробел по СОДЕРЖИМОМУ: нужна фамилия+имя (>=2 слова). sentinel — доп. сигнал по импортированным.
    fio: e.position === FIO_SENTINEL || fio.split(/\s+/).filter(Boolean).length < 2,
    rate: !(e.lines || []).some(l => !l.valid_to && l.line_type === 'основной'),
    phone: digits.length < 11,   // +7XXXXXXXXXX — заодно отсекает буквы/мусор
    spec: !e.specialty_id,
  };
}
const isIncomplete = e => { const g = cardGaps(e); return g.fio || g.rate || g.phone || g.spec; };
function renderEmployees(filter = '') {
  const f = filter.toLowerCase();
  const all = employees.filter(e => e.status !== 'archived');
  // Панель заполненности + фильтр «только неполные» — владельцу (он заполняет).
  if (isOwner()) {
    const cnt = { rate: 0, phone: 0, spec: 0, fio: 0 };
    all.forEach(e => { const g = cardGaps(e); if (g.rate) cnt.rate++; if (g.phone) cnt.phone++; if (g.spec) cnt.spec++; if (g.fio) cnt.fio++; });
    const done = all.filter(e => !isIncomplete(e)).length;
    const onlyInc = $('empList').dataset.onlyInc === '1';
    const chip = (n, label) => n ? `<span class="gap-chip">${n} ${label}</span>` : '';
    $('roNote').innerHTML = `<div class="fill-stat"><span class="fs-count"><b>${done}</b> из <b>${all.length}</b> заполнены</span>
      <span class="gap-chips">${chip(cnt.rate, 'без ставки')}${chip(cnt.phone, 'без телефона')}${chip(cnt.spec, 'без спец.')}${chip(cnt.fio, 'без фамилии')}</span>
      <label class="rt-toggle"><input type="checkbox" id="empOnlyInc" ${onlyInc ? 'checked' : ''}> только неполные</label></div>`;
    $('empOnlyInc').onchange = ev => { $('empList').dataset.onlyInc = ev.target.checked ? '1' : ''; renderEmployees($('empSearch').value || ''); };
  }
  const onlyInc = isOwner() && $('empList').dataset.onlyInc === '1';
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  const catF = $('empCat')?.dataset.value || '';   // дропдаун заполняет fillCatSelects при загрузке
  let html = '', idx = 0;
  for (const cat of cats) {
    if (catF && cat !== catF) continue;
    let list = all.filter(e => specCat(e.specialty_id) === cat && e.fio.toLowerCase().includes(f));
    if (onlyInc) list = list.filter(isIncomplete);
    if (!list.length) continue;
    html += `<div class="group-label"><span class="caps"><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${list.length}</span><span class="line"></span></div>`;
    for (const e of list) {
      const pays = activeLines(e).map(l => `<span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${esc(lineLabel(l))}</span>`).join(' ') || '<span class="pill k">строк начисления нет</span>';
      const g = cardGaps(e);
      const gap = isOwner() && isIncomplete(e) ? `<span class="gap-dot" title="Не хватает">⚠ ${[g.rate && 'ставка', g.phone && 'телефон', g.spec && 'спец.', g.fio && 'фамилия'].filter(Boolean).join(', ')}</span>` : '';
      html += `<div class="emp-row${isOwner() && isIncomplete(e) ? ' incomplete' : ''}" data-id="${e.id}"><div class="emp-ava" style="background:${catTint(cat)}">${esc(initials(e.fio))}</div><div class="emp-name">${esc(e.fio)}${gap}<div class="sub">${esc(specName(e.specialty_id))}</div></div><div class="emp-pay">${pays}</div><div class="chev">${ICONS.chevR}</div></div>`;
    }
  }
  $('empList').innerHTML = html || `<div class="empty">${filter || onlyInc ? 'Никого не найдено' : 'Пока нет сотрудников.' + (isOwner() ? '<br><span class="small">Нажмите «Карточка», чтобы создать первую.</span>' : '')}</div>`;
  applyIcons($('empList'));
  $('empList').querySelectorAll('.emp-row').forEach(r => r.onclick = () => openCard(+r.dataset.id));
}
function openCard(id) {
  const e = employees.find(x => x.id === id); if (!e) return;
  const lines = activeLines(e).map(l => `<div class="line-row"><span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${l.line_type === 'основной' ? 'Основной' : 'Совмест.'}</span><div style="font-weight:700">${esc(lineLabel(l))}</div><span class="lv muted small">с ${esc(l.valid_from || '—')}</span></div>`).join('') || '<div class="empty" style="padding:20px">Строк начисления нет</div>';
  const oldLines = (e.lines || []).filter(l => l.valid_to).map(l => `<div class="line-row" style="opacity:.55"><span class="pill k">закрыта ${esc(l.valid_to)}</span><div>${esc(lineLabel(l))}</div></div>`).join('');
  $('cardBody').innerHTML = `
    <div class="card cardpad" style="margin-bottom:16px"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="emp-ava" style="width:64px;height:64px;border-radius:20px;font-size:20px;background:${palette[id % palette.length]}">${esc(initials(e.fio))}</div>
      <div style="flex:1;min-width:200px"><h1 style="font-size:23px;font-weight:700">${esc(e.fio)}</h1><p class="muted" style="margin-top:2px">${esc(specName(e.specialty_id))}</p></div>
      ${isOwner() ? `<button class="btn btn-ghost btn-sm" id="editEmpBtn">${ICONS.edit}Редактировать</button>` : `<span class="tag">${ICONS.lock} правит владелец</span>`}
    </div></div>
    <div class="grid2">
      <div class="card cardpad"><div class="caps" style="margin-bottom:12px">Строки начисления</div>${lines}${oldLines ? `<div class="caps" style="margin:16px 0 6px">История ставок</div>${oldLines}` : ''}</div>
      <div class="card cardpad">
        <div class="field"><span class="caps">Должность</span><span class="val">${esc(e.position === FIO_SENTINEL ? '—' : (e.position || '—'))}</span></div>
        <div class="field"><span class="caps">Телефон (для СМС)</span><span class="val num">${esc(e.phone || '—')}</span></div>
        <div class="field"><span class="caps">Статус</span><span class="val">${e.status === 'active' ? 'активен' : 'архив'}</span></div>
        <div class="field" style="margin:0"><span class="caps">Карточка создана</span><span class="val small">${esc(fmtDT(e.created_at))}</span></div>
      </div>
    </div>`;
  applyIcons($('cardBody'));
  const eb = $('editEmpBtn'); if (eb) eb.onclick = () => employeeForm(e);
  go('card');
}

/* ── форма карточки (владелец) ── */
function lineBlockHtml(l) {
  const keep = l && l.id ? `data-keep="${l.id}"` : '';
  const kind = l?.pay_kind || 'оклад';
  const opts = PAY_KINDS.map(k => `<option value="${k[0]}" ${kind === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('');
  return `<div class="lineblk" ${keep}>
    <button class="linedel" title="Убрать строку">${ICONS.minus}</button>
    <div class="seg lb-type" style="max-width:290px"><button type="button" class="${(!l || l.line_type === 'основной') ? 'on' : ''}">Основной</button><button type="button" class="${l?.line_type === 'совместитель' ? 'on' : ''}">Совместитель</button></div>
    <div class="frow" style="margin-top:11px">
      <div><label class="flbl" style="margin-top:0">Вид оплаты</label><select class="input lb-pay">${opts}</select></div>
      <div class="lb-fields"></div>
    </div>
  </div>`;
}
function renderLineFields(blk, l) {
  const kind = blk.querySelector('.lb-pay').value, box = blk.querySelector('.lb-fields');
  if (kind === 'процент') box.innerHTML = `<label class="flbl" style="margin-top:0">Процент %</label><input class="input lb-percent" inputmode="decimal" value="${l?.percent ?? ''}" placeholder="напр. 35">`;
  else if (kind === '12ч') box.innerHTML = `<div class="frow"><div><label class="flbl" style="margin-top:0">День ₽</label><input class="input lb-amount" inputmode="numeric" value="${l?.amount ?? ''}" placeholder="2500"></div><div><label class="flbl" style="margin-top:0">Ночь ₽</label><input class="input lb-night" inputmode="numeric" value="${l?.amount_night ?? ''}" placeholder="3000"></div></div>`;
  else box.innerHTML = `<label class="flbl" style="margin-top:0">Ставка ₽ ${kind === 'оклад' ? '/мес' : kind === 'сутки' ? '/смена' : '/час'}</label><input class="input lb-amount" inputmode="numeric" value="${l?.amount ?? ''}" placeholder="напр. 50 000">`;
}
function wireLineBlock(blk, l) {
  renderLineFields(blk, l);
  blk.querySelector('.lb-pay').onchange = () => { blk.removeAttribute('data-keep'); renderLineFields(blk); };
  blk.querySelectorAll('.lb-type button').forEach(b => b.onclick = () => { blk.removeAttribute('data-keep'); blk.querySelectorAll('.lb-type button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  blk.querySelectorAll('.lb-fields input, .lb-amount, .lb-night, .lb-percent').forEach(i => i.oninput = () => blk.removeAttribute('data-keep'));
  blk.querySelector('.lb-fields').addEventListener('input', () => blk.removeAttribute('data-keep'));
  blk.querySelector('.linedel').onclick = () => { blk.remove(); };
}
function collectLines(box) {
  const out = [];
  for (const blk of box.querySelectorAll('.lineblk')) {
    const keep = blk.getAttribute('data-keep');
    if (keep) { out.push({ _keep: +keep }); continue; }
    const line_type = blk.querySelector('.lb-type button.on').textContent.trim() === 'Основной' ? 'основной' : 'совместитель';
    const pay_kind = blk.querySelector('.lb-pay').value;
    const val = (sel, o) => { const el = blk.querySelector(sel); return el ? parseNum(el.value, o) : null; };
    const l = { line_type, pay_kind, amount: val('.lb-amount', { thousands: true, field: 'ставку' }), amount_night: val('.lb-night', { thousands: true, field: 'ночную ставку' }), percent: val('.lb-percent', { field: 'процент' }) };
    if (pay_kind === 'процент') {
      if (l.percent == null) throw new Error('Укажите процент в строке начисления');
      if (l.percent < 0 || l.percent > 100) throw new Error('Процент должен быть от 0 до 100');
    } else {
      if (l.amount == null) throw new Error('Укажите ставку в каждой строке начисления');
      if (l.amount < 0) throw new Error('Ставка не может быть отрицательной');
      if (pay_kind === '12ч' && l.amount_night == null) throw new Error('Для «12ч» укажите и дневную, и ночную ставку');
      if (l.amount_night != null && l.amount_night < 0) throw new Error('Ночная ставка не может быть отрицательной');
    }
    out.push(l);
  }
  if (!out.length) throw new Error('Нужна хотя бы одна строка начисления');
  if (out.filter(l => !l._keep && l.line_type === 'основной').length > 1) throw new Error('Основная строка может быть только одна — лишние сделайте «Совместитель»');
  return out;
}
function employeeForm(e) {
  const so = specialties.map(s => `<option value="${s.id}" ${e?.specialty_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  showModal(`<h3>${e ? 'Редактировать карточку' : 'Новая карточка'}</h3><div class="msub">${ICONS.lock} ФИО, телефон и ставки заводит владелец — изменения попадут в журнал</div>
    <label class="flbl">ФИО</label><input class="input" id="mFio" value="${esc(e?.fio || '')}" placeholder="Фамилия Имя Отчество">
    <div class="frow"><div><label class="flbl">Специальность</label><select class="input" id="mSpec">${so}</select></div>
    <div><label class="flbl">Должность</label><input class="input" id="mPos" value="${esc(e?.position === FIO_SENTINEL ? '' : (e?.position || ''))}" placeholder="напр. Заведующий"></div></div>
    <label class="flbl">Телефон (для СМС)</label><input class="input" id="mPhone" type="tel" inputmode="tel" value="${esc(e?.phone || '')}" placeholder="+7 …">
    <label class="flbl">Строки начисления</label><div id="mLines"></div>
    <button class="btn btn-ghost btn-sm" id="mAddLine">${ICONS.plus}Ещё строка</button>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button><button class="btn btn-primary btn-sm" id="mSave">${ICONS.check}${e ? 'Сохранить' : 'Создать карточку'}</button></div>`);
  $('modalBox').dataset.guard = '1';   // карточку не закрывать случайным кликом по фону / Escape — потеря ввода
  const box = $('mLines');
  const init = e ? activeLines(e) : [null];
  (init.length ? init : [null]).forEach(l => { box.insertAdjacentHTML('beforeend', lineBlockHtml(l)); wireLineBlock(box.lastElementChild, l); });
  $('mAddLine').onclick = () => { box.insertAdjacentHTML('beforeend', lineBlockHtml(null)); wireLineBlock(box.lastElementChild, null); };
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return; btn.disabled = true;   // защита от двойного клика
    try {
      const fio = $('mFio').value.trim(); if (!fio) { $('mFio').focus(); btn.disabled = false; return; }
      const patch = { fio, position: $('mPos').value.trim(), phone: $('mPhone').value.trim(), specialty_id: +$('mSpec').value || null };
      const lines = collectLines(box);
      if (e) { await store.updateEmployee(e.id, patch, lines); toast(ICONS.check + 'Карточка обновлена — изменения в журнале'); }
      else { await store.createEmployee({ ...patch, lines }); toast(ICONS.check + 'Карточка создана: ' + esc(fio.split(' ')[0])); }
      closeModal(); await refresh(); if (e) openCard(e.id);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

/* ── специальности ── */
function renderSpecs() {
  $('specList').innerHTML = specialties.map(s => `<div class="line-row"><div style="font-weight:700">${esc(s.name)}</div><span class="tag" style="margin-left:auto">${esc(s.category)}</span></div>`).join('') || '<div class="empty">Справочник пуст</div>';
}
function specForm() {
  const cats = [...new Set(specialties.map(s => s.category))];
  showModal(`<h3>Новая специальность</h3><div class="msub">Добавится в справочник и группировку</div>
    <label class="flbl">Название</label><input class="input" id="mSn" placeholder="напр. Невролог">
    <label class="flbl">Категория</label><input class="input" id="mSc" list="catlist" placeholder="Врачи / Средний персонал / своя…"><datalist id="catlist">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button><button class="btn btn-primary btn-sm" id="mSave">${ICONS.plus}Добавить</button></div>`);
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const n = $('mSn').value.trim(); if (!n) { $('mSn').focus(); return; }
    btn.disabled = true;
    try { await store.addSpecialty(n, $('mSc').value.trim() || 'Прочие'); closeModal(); await refresh(); toast(ICONS.check + 'Добавлено: ' + esc(n)); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

/* ── график: сетка месяц × сотрудники (operator + owner) ── */
const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
let curPeriod = null, scheduleRows = [], shiftKinds = [];
const nowPeriod = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); };
const periodLabel = p => { const [y, m] = p.split('-').map(Number); return MONTHS_RU[m] + ' ' + y; };
const daysInMonth = p => { const [y, m] = p.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const cellDate = day => curPeriod + '-' + String(day).padStart(2, '0');
const cellOf = (empId, day) => scheduleRows.find(s => s.employee_id === empId && s.work_date === cellDate(day));
function shiftMonth(delta) { let [y, m] = curPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } curPeriod = y + '-' + String(m).padStart(2, '0'); renderSchedule(); }
function cellText(c) {
  if (!c || !c.plan_kind) return '';
  const k = shiftKinds.find(x => x.code === c.plan_kind), short = k ? (k.short || k.label) : c.plan_kind;
  if (c.plan_kind === 'off' || c.plan_kind === 'absent') return short;
  return c.plan_start ? String(c.plan_start).slice(0, 5) : short;
}
// renderSchedule — грузит данные месяца из сети, затем рисует. drawSchedule — только рисует
// из уже загруженных scheduleRows + текущих фильтров (мгновенно, без сети → без гонок/мерцания).
async function renderSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  if (!curPeriod) curPeriod = nowPeriod();
  [scheduleRows, shiftKinds] = await Promise.all([store.listSchedule(curPeriod), store.listShiftKinds()]);
  drawSchedule();
}
function drawSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  if ($('mLabel')) $('mLabel').textContent = periodLabel(curPeriod);
  const nd = daysInMonth(curPeriod);
  const editable = canEditSchedule();
  const todayD = (nowPeriod() === curPeriod) ? new Date().getDate() : 0;
  const active = employees.filter(e => e.status !== 'archived');
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];

  // фильтры (селекты заполняет fillCatSelects при загрузке данных — здесь только читаем)
  const f = ($('schedSearch')?.value || '').toLowerCase().trim();
  const catF = $('schedCat')?.dataset.value || '';

  // режим: оператор правит, владелец смотрит
  if ($('schedSub')) $('schedSub').textContent = editable ? 'Клик по клетке — тип смены + время начала. Ночные через полночь = фикс за смену.' : 'Просмотр: график ведёт оператор с листов голов отделений.';
  if ($('schedNote')) $('schedNote').innerHTML = editable ? '' : `<div class="readonly-note">${ICONS.lock} График заполняет оператор (Алёна) по листам, которые головы отделений согласовали со своими сотрудниками. У вас — просмотр отмеченного.</div>`;

  // покрытие месяца: у скольких проставлен хоть один плановый день + всего смен
  const withShift = new Set(scheduleRows.filter(s => s.plan_kind).map(s => s.employee_id));
  const shifts = scheduleRows.filter(s => s.plan_kind).length;
  if ($('schedStat')) {
    const pct = active.length ? Math.round(withShift.size / active.length * 100) : 0;
    $('schedStat').innerHTML = `<span class="fs-count"><b>${withShift.size}</b> из <b>${active.length}</b> с графиком</span><span class="cov-bar" title="${pct}% заполнено"><span class="cov-fill" style="width:${pct}%"></span></span><span class="gap-chips"><span class="gap-chip">${shifts} смен</span></span>`;
  }

  let head = '<div class="gr-corner">Сотрудник</div>';
  for (let d = 1; d <= nd; d++) head += `<div class="gr-day${d === todayD ? ' today' : ''}">${d}</div>`;
  let rows = '', shown = 0;
  for (const cat of cats) {
    if (catF && cat !== catF) continue;
    const list = active.filter(e => specCat(e.specialty_id) === cat && e.fio.toLowerCase().includes(f));
    if (!list.length) continue;
    rows += `<div class="gr-group"><span><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${list.length}</span></div>`;
    for (const e of list) {
      shown++;
      rows += `<div class="gr-name" title="${esc(e.fio)}" style="box-shadow:inset 3px 0 0 ${catColor(cat)}">${esc(e.fio)}</div>`;
      for (let d = 1; d <= nd; d++) {
        const c = cellOf(e.id, d);
        rows += `<div class="gr-cell${c && c.plan_kind ? ' filled k-' + esc(c.plan_kind) : ''}${d === todayD ? ' today' : ''}${editable ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}">${esc(cellText(c))}</div>`;
      }
    }
  }
  const grid = $('scheduleGrid');
  grid.style.gridTemplateColumns = `150px repeat(${nd}, minmax(44px, 1fr))`;
  grid.innerHTML = shown ? head + rows : `<div class="empty" style="padding:40px">${active.length ? 'Никого не найдено' : 'Нет сотрудников'}</div>`;
  if (editable) grid.querySelectorAll('.gr-cell').forEach(cell => cell.onclick = () => scheduleCellPopup(+cell.dataset.emp, +cell.dataset.day));
}
function scheduleCellPopup(empId, day) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day);
  const opts = shiftKinds.map(k => `<option value="${k.code}" ${c && c.plan_kind === k.code ? 'selected' : ''}>${esc(k.label)}</option>`).join('');
  showModal(`<h3>${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3><div class="msub">${day} ${esc(periodLabel(curPeriod))} · смена = тип + время начала</div>
    <label class="flbl">Тип смены</label><select class="input" id="scKind"><option value="">— пусто —</option>${opts}</select>
    <label class="flbl">Время начала</label><input class="input" id="scStart" type="time" value="${c && c.plan_start ? esc(String(c.plan_start).slice(0, 5)) : ''}">
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="scClear">Очистить</button><button class="btn btn-primary btn-sm" id="scSave">${ICONS.check}Сохранить</button></div>`);
  $('scSave').onclick = async () => {
    const btn = $('scSave'); if (btn.disabled) return; btn.disabled = true;
    try { await store.setScheduleCell(empId, date, { plan_kind: $('scKind').value || null, plan_start: $('scStart').value || null, fact: null }); closeModal(); await renderSchedule(); toast(ICONS.check + 'Сохранено'); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('scClear').onclick = async () => {
    try { await store.setScheduleCell(empId, date, { plan_kind: null, plan_start: null, fact: null }); closeModal(); await renderSchedule(); toast('Очищено'); }
    catch (err) { toast(err.message || err, true); }
  };
}

/* ── ставки: массовый ввод (владелец) ── */
const RT_KINDS = [['оклад', 'Оклад'], ['сутки', 'Сутки'], ['почасово', 'Почасово'], ['12ч', '12ч'], ['процент', 'Процент']];
const primaryLine = e => activeLines(e).find(l => l.line_type === 'основной');
function rtFields(kind, l) {
  const has = l && l.pay_kind === kind;
  if (kind === 'процент') return `<input class="input rt-a" inputmode="decimal" value="${has ? (l.percent ?? '') : ''}" placeholder="%">`;
  if (kind === '12ч') return `<input class="input rt-a" inputmode="numeric" value="${has ? (l.amount ?? '') : ''}" placeholder="день ₽"><input class="input rt-b" inputmode="numeric" value="${has ? (l.amount_night ?? '') : ''}" placeholder="ночь ₽">`;
  return `<input class="input rt-a" inputmode="numeric" value="${has ? (l.amount ?? '') : ''}" placeholder="сумма ₽">`;
}
function rtRow(e) {
  const l = primaryLine(e), kind = l?.pay_kind || 'оклад';
  const opts = RT_KINDS.map(k => `<option value="${k[0]}" ${kind === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('');
  const cur = l ? `<span class="pill o">${esc(lineLabel(l))}</span>` : `<span class="pill k">нет ставки</span>`;
  return `<div class="rate-row" data-id="${e.id}">
    <div class="rate-name">${esc(e.fio)}<div class="sub">${esc(specName(e.specialty_id))} · ${cur}</div></div>
    <div class="rate-edit"><select class="input rt-kind">${opts}</select><span class="rt-fields">${rtFields(kind, l)}</span><button class="btn btn-primary btn-sm rt-save" title="Сохранить">${ICONS.check}</button></div>
  </div>`;
}
function rtCollect(row) {
  const kind = row.querySelector('.rt-kind').value;
  const val = (sel, o) => { const el = row.querySelector(sel); return el ? parseNum(el.value, o) : null; };
  const line = { pay_kind: kind, amount: null, amount_night: null, percent: null };
  if (kind === 'процент') {
    line.percent = val('.rt-a', { field: 'процент' });
    if (line.percent == null) throw new Error('Укажите процент');
    if (line.percent < 0 || line.percent > 100) throw new Error('Процент должен быть 0–100');
  } else {
    line.amount = val('.rt-a', { thousands: true, field: 'сумму' });
    if (line.amount == null) throw new Error('Укажите сумму');
    if (line.amount <= 0) throw new Error('Ставка должна быть больше 0');
    if (kind === '12ч') {
      line.amount_night = val('.rt-b', { thousands: true, field: 'ночную ставку' });
      if (line.amount_night == null) throw new Error('Для «12ч» укажите и день, и ночь');
      if (line.amount_night <= 0) throw new Error('Ночная ставка должна быть больше 0');
    }
  }
  return line;
}
function renderRates(filter = '') {
  if (!isOwner()) { $('ratesList').innerHTML = ''; $('ratesTools').innerHTML = ''; return; }
  const f = filter.toLowerCase();
  const active = employees.filter(e => e.status !== 'archived');
  const withRate = active.filter(primaryLine).length, without = active.length - withRate;
  const onlyEmpty = $('ratesTools').dataset.onlyEmpty === '1';
  $('ratesTools').innerHTML = `<div class="rates-stat card cardpad"><span><b>${withRate}</b> из <b>${active.length}</b> со ставкой · <b style="color:${without ? 'var(--red)' : 'var(--green)'}">${without}</b> без ставки</span>
    <label class="rt-toggle"><input type="checkbox" id="rtOnlyEmpty" ${onlyEmpty ? 'checked' : ''}> только без ставки</label></div>`;
  $('rtOnlyEmpty').onchange = ev => { $('ratesTools').dataset.onlyEmpty = ev.target.checked ? '1' : ''; renderRates($('rateSearch').value || ''); };
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  let html = '';
  for (const cat of cats) {
    let list = active.filter(e => specCat(e.specialty_id) === cat && e.fio.toLowerCase().includes(f));
    if (onlyEmpty) list = list.filter(e => !primaryLine(e));
    if (!list.length) continue;
    html += `<div class="group-label"><span class="caps">${esc(cat)} · ${list.length}</span><span class="line"></span></div>` + list.map(rtRow).join('');
  }
  $('ratesList').innerHTML = html || `<div class="empty">${onlyEmpty ? 'Всем в фильтре ставки проставлены 🎉' : 'Никого не найдено'}</div>`;
  applyIcons($('ratesList'));
  $('ratesList').querySelectorAll('.rate-row').forEach(row => {
    row.querySelector('.rt-kind').onchange = () => { row.querySelector('.rt-fields').innerHTML = rtFields(row.querySelector('.rt-kind').value, null); };
    row.querySelector('.rt-save').onclick = async () => {
      const btn = row.querySelector('.rt-save'); if (btn.disabled) return; btn.disabled = true;
      try {
        const line = rtCollect(row);
        // Сохраняем незавершённый ввод в ДРУГИХ строках, чтобы refresh их не стёр.
        const drafts = {};
        $('ratesList').querySelectorAll('.rate-row').forEach(r => {
          if (+r.dataset.id === +row.dataset.id) return;
          const a = r.querySelector('.rt-a'), b = r.querySelector('.rt-b'), k = r.querySelector('.rt-kind');
          if ((a && a.value) || (b && b.value)) drafts[r.dataset.id] = { kind: k.value, a: a ? a.value : '', b: b ? b.value : '' };
        });
        await store.setPrimaryRate(+row.dataset.id, line);
        await refresh();
        for (const id in drafts) {
          const r = $('ratesList').querySelector('.rate-row[data-id="' + id + '"]'); if (!r) continue;
          const k = r.querySelector('.rt-kind'); if (k) { k.value = drafts[id].kind; k.dispatchEvent(new Event('change')); }
          const a = r.querySelector('.rt-a'), b = r.querySelector('.rt-b');
          if (a) a.value = drafts[id].a; if (b) b.value = drafts[id].b;
        }
        toast(ICONS.check + 'Ставка сохранена');
      } catch (err) { btn.disabled = false; toast(err.message || err, true); }
    };
  });
}

/* ── журнал ── */
const J_ENTITY = { employee: 'Карточка', rate_line: 'Ставка', specialty: 'Специальность', app_user: 'Пользователь' };
const J_FIELD = { fio: 'ФИО', position: 'должность', phone: 'телефон', status: 'статус', specialty: 'специальность', specialty_id: 'специальность', 'новая строка': 'новая строка', 'закрыта': 'строка закрыта', 'ставка добавлена': 'ставка добавлена', 'ставка закрыта': 'ставка закрыта' };
async function renderJournal() {
  const rows = await store.listJournal();
  $('journalList').innerHTML = rows.length ? rows.map(j => {
    let what;
    if (j.action === 'created') what = `${J_ENTITY[j.entity] || esc(j.entity)} создана: <b>${esc(j.new_value || '')}</b>`;
    else what = `${J_ENTITY[j.entity] || esc(j.entity)} · ${J_FIELD[j.field] || esc(j.field || '')}: ${j.old_value ? `<s>${esc(j.old_value)}</s> → ` : ''}<b>${esc(j.new_value || '—')}</b>`;
    return `<div class="jrow"><div style="flex:1"><div>${what}</div><div class="who">${esc(j.actor)}</div></div><div class="jt">${esc(fmtDT(j.at))}</div></div>`;
  }).join('') : `<div class="empty">Журнал пуст — появится после первых изменений</div>`;
}

/* ── модалка / тост ── */
function showModal(html) { $('modalBox').innerHTML = html; $('modalOv').classList.add('show'); applyIcons($('modalBox')); const f = $('modalBox').querySelector('input'); if (f) setTimeout(() => f.focus(), 60); }
function closeModal() { $('modalOv').classList.remove('show'); delete $('modalBox').dataset.guard; }
/* Ошибки выводим как текст (без innerHTML) — в них попадают сообщения БД/сети;
   успех может содержать доверенную иконку из ICONS. */
function toast(msg, isErr) {
  const t = $('toast');
  if (isErr) t.textContent = String(msg); else t.innerHTML = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── init ── */
$('modalOv').onclick = e => { if (e.target.id === 'modalOv' && !$('modalBox').dataset.guard) closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modalBox').dataset.guard) closeModal(); });
$('empSearch').oninput = e => renderEmployees(e.target.value);
{ const rs = $('rateSearch'); if (rs) rs.oninput = e => renderRates(e.target.value); }
{ const mp = $('mPrev'), mn = $('mNext'); if (mp) mp.onclick = () => shiftMonth(-1); if (mn) mn.onclick = () => shiftMonth(1); }
{ const ss = $('schedSearch'); if (ss) ss.oninput = () => drawSchedule(); }
// выбор отделения (empCat/schedCat) обрабатывает makeDropdown → onPick, отдельное onchange не нужно
{ const tb = $('themeBtn'); if (tb) tb.onclick = toggleTheme; paintThemeBtn(); }
$('addEmpBtn').onclick = () => employeeForm(null);
$('addSpecBtn').onclick = specForm;
$('backBtn').onclick = () => go('employees');
$('logoutBtn').innerHTML = ICONS.out;
$('logoutBtn').onclick = async () => { await store.logout(); document.body.classList.remove('authed'); renderLogin(); };
applyIcons();

(async () => {
  // Форму показываем сразу — не ждём полной инициализации базы. Иначе, если getUser
  // (проверка сессии) зависает, карточка остаётся пустой. Клиент Supabase создаётся
  // быстро (до getUser), поэтому вход по паролю работает даже при зависшем getUser.
  renderLogin();
  try {
    await Promise.race([
      store.init(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('база не ответила за 8 сек')), 8000)),
    ]);
    if (store.me()) await enter();  // если уже была сессия — входим; иначе форма уже показана
  } catch (e) {
    console.error('[init]', e);
    const libFail = /библиотек|supabase\.js|is not defined|undefined/i.test(String(e.message || e));
    toast(libFail ? 'Не удалось подключиться к базе — обновите страницу (Cmd/Ctrl+R).' : 'База отвечает медленно (' + String(e.message || e) + '). Вход по паролю должен работать.', true);
  }
})();
