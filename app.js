import { makeStore, lineLabel, sameRate, backdateNeedsOk } from './store.js?v=271';
const $ = id => document.getElementById(id);
{
  let послано = 0;
  const версия = () => (document.querySelector('script[src*="app.js?v="]')
    ?.getAttribute('src').match(/v=(\d+)/) || [])[1] || '?';
  const записать = (kind, message, stack, мс) => {
    if (послано >= 10) return;
    послано++;
    try { store?.logError?.(kind, String(message || '').slice(0, 500),
                            String(stack || '').slice(0, 2000),
                            typeof curScreen === 'string' ? curScreen : null, версия(), мс); }
    catch (e) {   }
  };
  let сказано = 0, сказаноКогда = 0;
  const сказать = () => {
    const t = Date.now();
    if (сказано >= 3 || t - сказаноКогда < 4000) return;
    сказано++; сказаноКогда = t;
    try { toast('Не получилось. Повторите — если снова, скажите Дарине', true); } catch (e) {}
  };
  window.addEventListener('error', e => {
    if (!e.message) return;
    записать('error', e.message, e.error?.stack || (e.filename + ':' + e.lineno));
    сказать();
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    записать('promise', r?.message || String(r), r?.stack);
    сказать();
  });
  const ПОРОГ_МС = 5000;
  const виделиДолгим = new Set();
  window.замерить = (действие, мс, ошибка) => {
    if (действие === 'logError') return;
    if (ошибка) {
      const текст = String(ошибка?.message || ошибка || '');
      if (/fetch|network|timeout|aborted|соедин/i.test(текст))
        записать('netfail', действие + ': ' + текст.slice(0, 120), null, мс);
      return;
    }
    if (мс < ПОРОГ_МС || виделиДолгим.has(действие)) return;
    виделиДолгим.add(действие);
    записать('slow', действие, null, мс);
  };
  window.addEventListener('load', () => setTimeout(() => {
    try {
      const n = performance.getEntriesByType('navigation')[0];
      const мс = n && n.loadEventEnd > 0 ? n.loadEventEnd : 0;
      if (мс > 10000) записать('load', 'страница поднималась', null, мс);
    } catch (e) {}
  }, 1500));
}
const NET_SHOW_AFTER = 450;
const NET_SLOW_AFTER = 4000;
let netPending = 0, netStarted = 0, netTimers = [];
function netPaint(text, cls) {
  const b = $('netBar'); if (!b) return;
  b.className = 'netbar show' + (cls ? ' ' + cls : '');
  b.innerHTML = (cls === 'off' ? '' : '<span class="btn-spin"></span>') + esc(text);
}
function netHide() { const b = $('netBar'); if (b && !b.classList.contains('off')) b.className = 'netbar'; }
function netClearTimers() { netTimers.forEach(clearTimeout); netTimers = []; }
const naEkraneVhoda = () => {
  const s = $('loginStage');
  return !!s && s.offsetParent !== null;
};
function netStart(действие) {
  if (naEkraneVhoda()) return false;
  if (++netPending > 1) return true;
  netStarted = Date.now();
  netClearTimers();
  const первое = ЧИТАЮЩИЕ.test(действие || '') ? 'Загружаем…' : 'Сохраняем…';
  netTimers.push(setTimeout(() => netPaint(первое), NET_SHOW_AFTER));
  netTimers.push(setTimeout(() => netPaint('Медленный интернет — ждём ответа базы', 'slow'), NET_SLOW_AFTER));
  netTimers.push(setTimeout(() => netPaint('Всё ещё пытаемся. Не закрывайте программу', 'slow'), 15000));
  return true;
}
function netEnd() {
  if (--netPending > 0) return;
  netPending = 0;
  netClearTimers();
  netHide();
}
const ЧИТАЮЩИЕ = /^(list|get|ping)/;
const ПАУЗЫ_ПОВТОРА = [1000, 2000, 4000, 8000, 15000, 15000];
function стоитПовторить(e) {
  const t = String(e?.message || e?.error_description || e || '');
  return /statement timeout|canceling statement|Failed to fetch|NetworkError|network|fetch|timeout|aborted|502|503|504|Gateway|Service Unavailable/i.test(t);
}
async function повторяяЧтение(имя, первый, ещёРаз) {
  if (!ЧИТАЮЩИЕ.test(имя)) return первый;
  const начало = performance.now();
  let попытка = 0, ответ = первый;
  for (;;) {
    try {
      const r = await ответ;
      if (попытка) window.замерить?.(имя + ' (получилось с ' + (попытка + 1) + '-й попытки)',
                                     performance.now() - начало, null);
      return r;
    } catch (e) {
      if (попытка >= ПАУЗЫ_ПОВТОРА.length || !стоитПовторить(e)) throw e;
      const пауза = ПАУЗЫ_ПОВТОРА[попытка++];
      netClearTimers();
      netPaint('База не успевает. Пробуем ещё раз (' + попытка + ')', 'slow');
      await new Promise(r => setTimeout(r, пауза));
      ответ = ещёРаз();
    }
  }
}
function withNetIndicator(s) {
  const cache = new Map();
  return new Proxy(s, {
    get(t, prop) {
      const v = t[prop];
      if (typeof v !== 'function' || prop.startsWith('_')) return typeof v === 'function' ? v.bind(t) : v;
      if (!cache.has(prop)) cache.set(prop, (...args) => {
        const out = v.apply(t, args);
        if (!out || typeof out.then !== 'function') return out;
        const считаем = netStart(prop);
          const начало = performance.now();
          return повторяяЧтение(prop, out, () => v.apply(t, args)).then(
            r => { window.замерить?.(prop, performance.now() - начало, null); return r; },
            e => { window.замерить?.(prop, performance.now() - начало, e); throw e; },
          ).finally(() => { if (считаем) netEnd(); });
      });
      return cache.get(prop);
    },
  });
}
const store = withNetIndicator(makeStore());
function netOffline() {
  const b = $('netBar'); if (!b) return;
  b.className = 'netbar show off';
  b.textContent = 'Нет интернета — изменения не сохраняются';
}
window.addEventListener('offline', netOffline);
window.addEventListener('online', () => { const b = $('netBar'); if (b) b.className = 'netbar'; if (netPending) netPaint('Сохраняем…'); });
if (navigator.onLine === false) setTimeout(netOffline, 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  card: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M7 14h5M7 16.5h3"/>', 20),
  chart: I('<path d="M4 4v15.5a.5.5 0 0 0 .5.5H20"/><path d="M8 15l3.5-4 3 2.5L20 8"/>', 20),
  alert: I('<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4M12 17.2v.1"/>', 20),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>', 20),
  cal: I('<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>', 20),
  sun: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>', 18),
  moon: I('<path d="M20.5 13.2A8 8 0 1 1 10.8 3.5a6.2 6.2 0 0 0 9.7 9.7Z"/>', 18),
  upload: I('<path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M12 4v11M8 8l4-4 4 4"/>', 20),
};
function applyIcons(root) { (root || document).querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ICONS[e.dataset.ic] || ''; }); }
const THEME_KEY = 'milena-theme';
const curTheme = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
function paintThemeBtn() { const b = $('themeBtn'); if (b) { b.innerHTML = curTheme() === 'light' ? ICONS.moon : ICONS.sun; b.title = curTheme() === 'light' ? 'Тёмная тема' : 'Светлая тема'; } }
function toggleTheme() { const next = curTheme() === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem(THEME_KEY, next); } catch (e) {} paintThemeBtn(); }
const palette = ['#CDE9D6', '#D3E2F7', '#F6DAC9', '#E6DEF9', '#FBEAC6', '#CFEBE6', '#F7D6DA', '#E3E9D0'];
const hashStr = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const catHue = cat => hashStr(cat) % 360;
const catShift = cat => hashStr('~' + cat) % 12;
const catColor = cat => `hsl(${catHue(cat)}, 56%, ${50 + catShift(cat)}%)`;
const catTint = cat => `hsl(${catHue(cat)}, 58%, ${85 + (catShift(cat) >> 1)}%)`;
const initials = f => String(f || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const PAY_KINDS = [['оклад', 'Оклад'], ['фикс', 'Фикс/мес'], ['сутки', 'Сутки'], ['12ч', '12ч день / ночь'], ['почасово', 'Почасово'], ['процент', 'Процент'], ['сдельно', 'Сдельно (сумма за месяц)']];
const payKindLabel = k => (PAY_KINDS.find(p => p[0] === k) || [k, k])[1];
const fmtDT = iso => { const d = new Date(iso); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
const fmtDTY = iso => { const d = new Date(iso); return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
const fmt = n => Number(n || 0).toLocaleString('ru-RU');
function parseNum(raw, opts) {
  const field = (opts && opts.field) || 'значение', thousands = !!(opts && opts.thousands);
  const max = (opts && opts.max) || 9999999.99;
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  if (thousands && /^\d{1,3}[.,]\d{3}$/.test(s)) s = s.replace(/[.,]/, '');
  else s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Проверьте ' + field + ': только цифры (напр. 50000 или 50000.50)');
  const v = parseFloat(s);
  if (v > max) throw new Error('Слишком большая сумма (' + field + ')');
  return v;
}
let specialties = [], employees = [], curScreen = 'employees';
const AZ_KEY = 'milena-sort-az';
let sortAZ = false;
try { sortAZ = localStorage.getItem(AZ_KEY) === '1'; } catch (e) {}
const byFio = (a, b) => String(a.fio || '').trim().localeCompare(String(b.fio || '').trim(), 'ru');
function setSortAZ(on) {
  sortAZ = !!on;
  try { localStorage.setItem(AZ_KEY, sortAZ ? '1' : ''); } catch (e) {}
  const a = $('payAZ'), b = $('schedAZ');
  if (a) a.checked = sortAZ;
  if (b) b.checked = sortAZ;
  drawPayroll($('payrollSearch')?.value || '');
  drawSchedule();
}
function renderLogin() {
  const body = $('loginBody'), foot = $('loginFoot');
  if (store.mode === 'demo') {
    $('loginSub').textContent = 'Демо-режим: данные хранятся только в этом браузере.';
    body.innerHTML = `<div class="demo-badge">${ICONS.lock} демо · без сервера</div><div style="height:14px"></div>` +
      store.demoUsers().map(u => `<button class="userbtn" data-uid="${esc(u.id)}"><span class="emp-ava" style="width:40px;height:40px;border-radius:13px;background:${palette[u.id.length % palette.length]}">${esc(initials(u.name))}</span><b>${esc(u.name)}</b><span class="role">${esc(ROLE_LABELS[u.role] || u.role)}</span></button>`).join('');
    body.querySelectorAll('.userbtn').forEach(b => b.onclick = async () => { try { await store.loginDemo(b.dataset.uid); await enter(); } catch (e) { toast('Не удалось войти: ' + (e.message || e), true); } });
    foot.innerHTML = 'После подключения базы здесь будет вход по почте и паролю. <button id="resetDemo" style="color:var(--ink-2);text-decoration:underline">Сбросить демо-данные</button>';
    const rd = $('resetDemo'); if (rd) rd.onclick = () => { store.resetDemo(); toast('Демо-данные сброшены'); };
  } else {
    body.innerHTML = `<form id="lgForm" method="post" action="" novalidate>
      <label class="flbl" for="lgEmail">Почта</label><input class="input" id="lgEmail" name="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next">
      <label class="flbl" for="lgPass">Пароль</label><input class="input" id="lgPass" name="password" type="password" autocomplete="current-password" enterkeyhint="go">
      <div style="height:16px"></div><button class="btn btn-primary" id="lgGo" type="submit" style="width:100%;justify-content:center">Войти</button>
      <div class="small" id="lgErr" style="color:var(--red-d);margin-top:10px"></div>
    </form>`;
    const go = async () => {
      const btn = $('lgGo');
      if (btn.disabled) return;
      btn.disabled = true; btn.innerHTML = '<span class="btn-spin"></span>Входим…';
      $('lgErr').textContent = '';
      try { await store.login($('lgEmail').value.trim(), $('lgPass').value); await enter(); }
      catch (e) { $('lgErr').textContent = 'Не получилось войти: ' + e.message; btn.disabled = false; btn.innerHTML = 'Войти'; }
    };
    $('lgForm').addEventListener('submit', e => {
      e.preventDefault();
      const err = $('lgErr'); err.textContent = '';
      if (!$('lgEmail').value.trim()) { err.textContent = 'Введите почту'; return $('lgEmail').focus(); }
      if (!$('lgPass').value) { err.textContent = 'Введите пароль'; return $('lgPass').focus(); }
      go();
    });
    foot.textContent = 'Доступ выдаёт владелец. Забыли пароль — напишите владельцу.';
  }
}
const NAV = [
  { s: 'overview', i: 'chart', l: 'Обзор', ownerOnly: true },
  { s: 'payroll', i: 'coin', l: 'Расчёт', show: () => worksWithPayroll() },
  { s: 'schedule', i: 'cal', l: 'График', show: () => worksWithPayroll() },
  { s: 'vacation', i: 'cal', l: 'Отпуска' },
  { s: 'journal', i: 'journal', l: 'Журнал', ownerOnly: true },
  { s: 'specialties', i: 'tag', l: 'Отделения', staffOnly: true },
  { s: 'rules', i: 'tag', l: 'Правила', staffOnly: true },
  { s: 'import', i: 'upload', l: 'Импорт', show: () => canImport() },
  { s: 'archive', i: 'users', l: 'Архив', ownerOnly: true },
  { s: 'gaps', i: 'alert', l: 'Пробелы', staffOnly: true },
  { s: 'employees', i: 'users', l: 'Сотрудники', show: () => worksWithPayroll() },
  { s: 'patients', i: 'card', l: 'Оплаты пациентов', staffOnly: true },
];
function isOwner() { return store.me()?.role === 'owner'; }
function navItems() { return NAV.filter(n => (!n.ownerOnly || isOwner()) && (!n.staffOnly || isStaff()) && (!n.show || n.show())); }
const IMPORT_KIND_META = {
  otpusk:      { label: 'Отпускные на карту',  hint: 'реестр отпускных (ТКБ) — деньги уже у человека, в «к выдаче» не идут' },
  otpusk_cash: { label: 'Отпускные наличными', hint: 'отпускные, которые выдаём из кассы — идут в «к выдаче»' },
  otpusk_nach: { label: 'Отпускные начислено', hint: 'НЕ выплата: сколько начислили. Справочно — ни в «к выдаче», ни в остаток не входит' },
  card_avans:  { label: 'Аванс на карту',      hint: 'реестр аванса (ТКБ), официальная часть' },
  bolnich:     { label: 'Больничные на карту', hint: 'больничные, перечисленные на карту — официальная часть' },
  card_rasch:  { label: 'ЗП на карту',         hint: 'ежемесячная зарплата на карту по 1С' },
  card_uvol:   { label: 'Расчёт на карту',     hint: 'окончательный расчёт при увольнении' },
  cash_avans:  { label: 'Аванс наличными',     hint: 'выданный наличными аванс' },
  cash:        { label: 'Наличные',            hint: 'выданные наличными' },
  premia:      { label: 'Премия',              hint: 'разовая премия, попадёт в журнал' },
};
const IMPORT_KINDS_BY_ROLE = {
  owner:    ['otpusk', 'otpusk_cash', 'otpusk_nach', 'card_avans', 'card_rasch', 'card_uvol', 'cash_avans', 'cash', 'premia'],
  operator: ['otpusk', 'otpusk_cash', 'otpusk_nach', 'cash_avans', 'cash'],
  ceo:      ['otpusk', 'otpusk_cash', 'otpusk_nach', 'card_avans', 'card_rasch', 'card_uvol', 'cash_avans', 'cash', 'premia'],
  cashier1: ['card_avans', 'card_rasch', 'card_uvol', 'bolnich', 'otpusk', 'otpusk_nach'],
};
const IMPORT_SIBLINGS = { otpusk: ['otpusk_cash'], otpusk_cash: ['otpusk'] };
function importKinds() { return IMPORT_KINDS_BY_ROLE[store.me()?.role] || []; }
function canImport() { return importKinds().length > 0; }
function zapomnitArhivnyeDolgi(rows) {
  archMoney = new Map((rows || []).filter(r => r.flag_archived && +r.delta_kop)
    .map(r => [r.employee_id, +r.delta_kop]));
  renderNav();
}
function navBadge(s) {
  if (s !== 'archive' || !archMoney.size) return '';
  const dolg = [...archMoney.values()].filter(v => v > 0).length;
  const pere = archMoney.size - dolg;
  const title = [dolg && `${dolg} с невыплаченным`, pere && `${pere} с переплатой`].filter(Boolean).join(', ');
  return `<span class="nav-badge${dolg ? '' : ' neg'}" title="${esc(title)}">${archMoney.size}</span>`;
}
function renderNav() {
  $('sideNav').innerHTML = navItems().map(n => `<button class="nav-item${n.s === curScreen ? ' active' : ''}" data-s="${n.s}"><span class="ic">${ICONS[n.i] || ''}</span>${n.l}${navBadge(n.s)}</button>`).join('');
  $('mobileNav').innerHTML = navItems().map(n => `<button data-s="${n.s}" class="${n.s === curScreen ? 'active' : ''}"><span>${ICONS[n.i] || ''}</span>${n.l}${navBadge(n.s)}</button>`).join('');
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go(b.dataset.s));
  const act = $('mobileNav').querySelector('button.active');
  if (act && act.scrollIntoView) { try { act.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
}
function go(screen, replace) {
  if (curScreen && curScreen !== screen && !replace) navStack++;
  curScreen = screen;
  const movedMonth = adoptPeriod(screen);
  if (screen === 'overview') renderOverview();
  if (screen === 'gaps') renderGaps();
  if (screen === 'vacation') renderVacation();
  if (screen === 'archive') renderArchive();
  if (screen === 'payroll') renderPayroll($('payrollSearch')?.value || '');
  if (typeof syncTopBack === 'function') syncTopBack();
  if (screen === 'patients') renderPatients();
  if (screen === 'import') renderImport();
  if (screen === 'rules') renderRules();
  if (screen === 'schedule' && movedMonth) renderSchedule();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  $('s-' + screen).classList.add('show');
  if (screen === 'payroll') stickFooterRows($('payrollTable'));
  if (screen === 'schedule') centerToday();
  compactHeads();
  document.querySelectorAll('.screen.show .sched-tools').forEach(wireFilterToggle);
  document.querySelectorAll('.screen.show .page-head .right').forEach(r => {
    if (r.querySelector('.cselect, .rt-toggle')) wireFilterToggle(r);
  });
  renderNav();
  document.querySelector('.main').scrollTop = 0;
  syncHash(!firstNav && !replace);
  firstNav = false;
  presencePing();
}
const ROUTES = [
  { s: 'overview',    slug: 'obzor',        arg: 'period' },
  { s: 'employees',   slug: 'sotrudniki' },
  { s: 'card',        slug: 'kartochka',    arg: 'id' },
  { s: 'gaps',        slug: 'probely',      arg: 'period' },
  { s: 'vacation',    slug: 'otpuska',      arg: 'period' },
  { s: 'archive',     slug: 'arhiv' },
  { s: 'schedule',    slug: 'grafik',       arg: 'period' },
  { s: 'payroll',     slug: 'raschet',      arg: 'period' },
  { s: 'rates',       slug: 'stavki' },
  { s: 'patients',    slug: 'patsienty',    arg: 'period' },
  { s: 'import',      slug: 'import' },
  { s: 'specialties', slug: 'specialnosti' },
  { s: 'rules', slug: 'pravila' },
  { s: 'journal',     slug: 'zhurnal' },
  { s: 'soon',        slug: 'skoro' },
];
const PERIOD_OF = {
  gaps:     { get: () => gapsPeriod, set: v => { gapsPeriod = v; workPeriod = v; } },
  vacation: { get: () => vacPeriod,  set: v => { vacPeriod = v; workPeriod = v; } },
  schedule: { get: () => curPeriod, set: v => { curPeriod = v; workPeriod = v; } },
  payroll:  { get: () => payPeriod, set: v => { payPeriod = v; workPeriod = v; } },
  patients: { get: () => patPeriod, set: v => { patPeriod = v; workPeriod = v; } },
  overview: { get: () => ovPeriod,  set: v => { ovPeriod = v; workPeriod = v; } },
  card:     { get: () => payPeriod, set: v => { payPeriod = v; workPeriod = v; } },
};
let workPeriod = null;
function adoptPeriod(screen) {
  const p = PERIOD_OF[screen];
  if (!p || !workPeriod || p.get() === workPeriod) return false;
  p.set(workPeriod);
  return true;
}
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
let firstNav = true;
let restoredSession = false;
function parseHash() {
  const raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];
  if (!raw) return null;
  const [slug, arg] = raw.split('/');
  let name; try { name = decodeURIComponent(slug || ''); } catch (e) { return null; }
  const r = ROUTES.find(x => x.slug === name);
  if (!r) return null;
  const t = { s: r.s };
  if (r.arg === 'id') {
    if (!/^[1-9]\d*$/.test(arg || '')) return null;
    t.id = Number(arg);
  }
  if (r.arg === 'period' && PERIOD_RE.test(arg || '')) t.period = clampPeriod(arg);
  return t;
}
function allowedScreen(s) {
  if (s === 'card') return worksWithPayroll();
  if (s === 'rates') return isOwner();
  if (s === 'soon') return !worksWithPayroll();
  return navItems().some(n => n.s === s);
}
function hashFor(screen) {
  const r = ROUTES.find(x => x.s === screen);
  if (!r) return '';
  if (r.arg === 'id') { const id = $('cardBody').dataset.emp; return id ? `#/${r.slug}/${id}` : ''; }
  if (r.arg === 'period') { const p = PERIOD_OF[screen]?.get(); return p ? `#/${r.slug}/${p}` : `#/${r.slug}`; }
  return `#/${r.slug}`;
}
const histSafe = fn => { try { fn(); } catch (e) { console.warn('history:', e); } };
const clearHash = () => histSafe(() => history.replaceState(navState(), '', location.href.split('#')[0]));
const SID_KEY = 'milena-nav-sid';
function navSid() {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) { s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(SID_KEY, s); }
    return s;
  } catch (e) { return 'nosid'; }
}
const navState = () => ({ own: 1, sid: navSid() });
function syncHash(push) {
  if (!store.me()) return;
  const h = hashFor(curScreen);
  if (!h) return;
  if (h === location.hash) { if (history.state?.sid !== navSid()) histSafe(() => history.replaceState(navState(), '', h)); return; }
  if (push) location.hash = h;
  histSafe(() => history.replaceState(navState(), '', h));
}
function applyHash() {
  if (!store.me()) {
    if (history.state?.own && location.hash) clearHash();
    return;
  }
  if (history.state?.own && history.state.sid !== navSid()) return syncHash(false);
  if (modalOpen()) {
    if (guardedModal()) { toast('Сначала завершите или отмените форму'); syncHash(true); return; }
  }
  const t = parseHash();
  if (!t || !allowedScreen(t.s)) return syncHash(false);
  const per = PERIOD_OF[t.s];
  const changedPeriod = !!(t.period && per && per.get() !== t.period);
  const sameCard = t.s !== 'card' || Number($('cardBody').dataset.emp) === t.id;
  if (t.s === curScreen && !changedPeriod && sameCard) return syncHash(false);
  if (modalOpen()) { closeModal(); closeModal2(); }
  if (changedPeriod) per.set(t.period);
  if (t.s === 'card') {
    if (!openCard(t.id, true)) { toast('Такой карточки нет', true); go('employees', true); }
    return;
  }
  go(t.s, true);
  if (t.s === 'schedule' && changedPeriod) renderSchedule();
}
window.addEventListener('hashchange', applyHash);
const PRESENCE_EVERY = 30000;
let presence = { screen: null, period: null, editing: null };
let presenceTimer = null, presenceRows = [];
function presencePing() {
  if (!store.me() || document.visibilityState !== 'visible') return;
  presence.screen = curScreen;
  presence.period = PERIOD_OF[curScreen] ? PERIOD_OF[curScreen].get() : workPeriod;
  store.ping(presence);
}
function setEditing(key) {
  if (presence.editing === (key || null)) return;
  presence.editing = key || null;
  presencePing();
  if (key) warnCoEdit(key);
}
async function warnCoEdit(key) {
  await loadPresence();
  if (presence.editing !== key || !modalOpen()) return;
  const box = $('modalOv2').classList.contains('show') ? $('modalBox2') : $('modalBox');
  box.querySelector('.co-edit')?.remove();
  const кто = othersEditing(key).map(p => p.display_name).filter(Boolean);
  if (!кто.length) return;
  const first = box.querySelector('h3');
  const html = `<div class="co-edit">${ICONS.alert || '⚠'}<span>Здесь же сейчас: <b>${esc(кто.join(', '))}</b> — кто сохранит последним, затрёт чужую правку</span></div>`;
  if (first) first.insertAdjacentHTML('afterend', html); else box.insertAdjacentHTML('afterbegin', html);
  applyIcons(box);
  clearTimeout(warnCoEdit._t);
  warnCoEdit._t = setTimeout(() => { if (presence.editing === key) warnCoEdit(key); }, 10000);
}
function presenceStart() {
  clearInterval(presenceTimer);
  presenceTimer = setInterval(() => { presencePing(); presenceRefreshUi(); }, PRESENCE_EVERY);
  presencePing(); presenceRefreshUi();
}
function presenceRefreshUi() {
  if (!store.me()) return;
  if (isOwner()) { if (curScreen === 'overview') drawPresenceBlock(); }
  else drawPresenceTop();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') presenceStart();
  else clearInterval(presenceTimer);
});
function othersEditing(key) {
  const me = store.me()?.id;
  return presenceRows.filter(p => p.editing === key && p.user_id !== me
    && p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000);
}
async function loadPresence() {
  try { presenceRows = await store.listPresence(); } catch (e) { presenceRows = []; }
  return presenceRows;
}
const ROLE_LABELS = { owner: 'владелец', operator: 'оператор', cashier1: 'бухгалтер', cashier2: 'карта / 1С · Бух 2', ceo: 'директор' };
const isStaff = () => ['owner', 'operator', 'ceo'].includes(store.me()?.role);
const canPayOut = () => ['owner', 'operator', 'ceo'].includes(store.me()?.role);
const canEditSchedule = () => ['operator', 'owner', 'ceo'].includes(store.me()?.role);
const canEditCards   = () => ['owner', 'ceo', 'operator', 'cashier1'].includes(store.me()?.role);
const canCreateCards = () => ['owner', 'ceo', 'cashier1'].includes(store.me()?.role);
const canEditRates   = () => ['owner', 'ceo'].includes(store.me()?.role);
const canSetFinalSum = () => ['owner', 'ceo'].includes(store.me()?.role);
const isBuh = () => store.me()?.role === 'cashier1';
const canEditEstimate = () => ['owner', 'ceo', 'operator'].includes(store.me()?.role);
const worksWithPayroll = () => isStaff() || isBuh();
async function enter() {
  const me = store.me(); if (!me) return;
  document.body.classList.add('authed');
  $('whoName').textContent = me.name;
  $('whoRole').textContent = ROLE_LABELS[me.role] || me.role;
  $('whoRole').className = 'rolepill ' + me.role;
  const md = $('modeTag');
  md.textContent = store.mode === 'demo' ? 'демо · этот браузер' : '';
  md.hidden = store.mode !== 'demo';
  if (!worksWithPayroll()) {
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
  $('addEmpBtn').style.display = canCreateCards() ? '' : 'none';
  $('roNote').innerHTML =
    canEditRates() ? ''
    : canCreateCards() ? `<div class="readonly-note">${ICONS.lock} Карточки можно заводить и править. Ставку уже заведённого человека и норму часов меняет владелец.</div>`
    : canEditCards() ? `<div class="readonly-note">${ICONS.lock} Карточку можно править и отправлять в архив. Заводить новые и менять ставки — у владельца.</div>`
    : `<div class="readonly-note">${ICONS.lock} Карточки только для просмотра.</div>`;
  const t = parseHash();
  const stale = !restoredSession && !!history.state?.own;
  const target = t && !stale && allowedScreen(t.s) ? t : null;
  if (target?.period && PERIOD_OF[target.s]) PERIOD_OF[target.s].set(target.period);
  await refresh();
  presenceStart();
  if (target?.s === 'card') {
    if (openCard(target.id)) return;
    toast('Такой карточки нет', true);
    return go('employees');
  }
  if (target) return go(target.s);
  go(isOwner() ? 'overview' : 'employees');
}
function makeDropdown(host, opts, cur, onPick) {
  const curOpt = opts.find(o => !o.head && o.v === cur) || opts.find(o => !o.head) || opts[0];
  const curLabel = curOpt.label;
  host.classList.add('cselect');
  host.dataset.value = curOpt.v;
  host.innerHTML = `<button class="cselect-trigger" type="button"><span class="cselect-label">${esc(curLabel)}</span>${ICONS.chevD}</button>
    <div class="cselect-panel" role="listbox">${opts.map(o => o.head
      ? `<div class="cselect-head">${esc(o.label)}</div>`
      : `<div class="cselect-opt${o.v === cur ? ' sel' : ''}${o.cls ? ' ' + o.cls : ''}" role="option" data-v="${esc(o.v)}">${esc(o.label)}</div>`).join('')}</div>`;
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
function fillCatSelects() {
  const opts = [{ v: '', label: 'Все отделения' },
    ...deptsFlat().map(c => ({ v: c, label: c, cls: deptParent(c) ? 'lvl2' : (c === NO_DEPT ? 'lvl0 muted' : 'lvl0') }))];
  const wire = (id, onPick) => { const el = $(id); if (el) makeDropdown(el, opts, el.dataset.value || '', onPick); };
  wire('empCat', () => renderEmployees($('empSearch').value || ''));
  wire('schedCat', () => drawSchedule());
  wire('payrollCat', () => drawPayroll($('payrollSearch')?.value || ''));
  if ($('payOnlyZero')) $('payOnlyZero').onchange = () => drawPayroll($('payrollSearch')?.value || '');
  ['payAZ', 'schedAZ'].forEach(id => { const el = $(id); if (el) { el.checked = sortAZ; el.onchange = () => setSortAZ(el.checked); } });
}
async function refresh() {
  const [sp, em, co] = await Promise.all([store.listSpecialties(), store.listEmployees(),
    store.listCategoryOrder().catch(e => { console.warn('listCategoryOrder:', e); return []; })]);
  specialties = sp; employees = em;
  setDepts(co || []);
  fillCatSelects();
  renderEmployees($('empSearch').value || '');
  renderSpecs();
  renderSchedule();
  if (isOwner()) { renderRates($('rateSearch')?.value || ''); renderJournal(); }
}
const specName = id => specialties.find(s => s.id === id)?.name || '—';
const specCat = id => specialties.find(s => s.id === id)?.category || 'Прочие';
const NO_DEPT = 'Не распределены';
const empCat = e => e?.dept || NO_DEPT;
const inCat = (e, cat) => { const c = empCat(e); return c === cat || deptParent(c) === cat; };
function personHead(e, sub, title = '') {
  const spec = e ? specName(e.specialty_id) : '—';
  const card = e && e.id && allowedScreen('card')
    ? `<button class="btn btn-ghost btn-sm ph-card" data-emp="${e.id}" title="Открыть карточку: ставка, телефон, специальность">Карточка →</button>` : '';
  return `<div class="ph-head"><h3>${title ? esc(title) + ' · ' : ''}${esc((e && e.fio) || '')}</h3>${card}</div>
    ${spec !== '—' ? `<div class="msub">${esc(spec)}</div>` : ''}
    ${sub ? `<div class="msub">${sub}</div>` : ''}`;
}
function activeLines(e) { return (e.lines || []).filter(l => !l.valid_to).sort((a, b) => (a.line_type === 'основной' ? 0 : 1) - (b.line_type === 'основной' ? 0 : 1)); }
const PHONE_OK = /^79\d{9}$/;
function normPhone(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/[^0-9+() .-]/.test(s)) return s;
  const d = s.replace(/[^0-9]/g, '');
  if (!d) return s;
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) return '7' + d.slice(1);
  if (d.length === 10 && d[0] === '9') return '7' + d;
  return d;
}
const fmtPhone = p => PHONE_OK.test(String(p ?? '')) ? `+7 ${String(p).slice(1,4)} ${String(p).slice(4,7)}-${String(p).slice(7,9)}-${String(p).slice(9)}` : String(p ?? '');
const FIO_SENTINEL = '⚠ уточнить фамилию';
function cardGaps(e) {
  const fio = String(e.fio || '').trim();
  return {
    fio: e.position === FIO_SENTINEL || fio.split(/\s+/).filter(Boolean).length < 2,
    rate: (isOwner() || !e.hidden_salary)
      && !(e.lines || []).some(l => !l.valid_to || l.valid_to >= mskTodayISO()),
    phone: !PHONE_OK.test(normPhone(e.phone)),
    spec: !e.specialty_id,
    dept: !e.dept,
  };
}
const isIncomplete = e => { const g = cardGaps(e); return g.fio || g.rate || g.phone || g.spec || g.dept; };
function renderEmployees(filter = '') {
  const f = filter.toLowerCase();
  const all = employees.filter(e => e.status !== 'archived');
  if (isOwner()) {
    const cnt = { rate: 0, phone: 0, spec: 0, fio: 0, dept: 0 };
    all.forEach(e => { const g = cardGaps(e); if (g.rate) cnt.rate++; if (g.phone) cnt.phone++; if (g.spec) cnt.spec++; if (g.fio) cnt.fio++; if (g.dept) cnt.dept++; });
    const done = all.filter(e => !isIncomplete(e)).length;
    const onlyInc = $('empList').dataset.onlyInc === '1';
    if ($('empList').dataset.gap && !cnt[$('empList').dataset.gap]) $('empList').dataset.gap = '';
    const gapF = $('empList').dataset.gap || '';
    const chip = (n, key, label) => n ? `<button class="gap-chip${gapF === key ? ' on' : ''}" data-gap="${key}">${n} ${label}</button>` : '';
    $('roNote').innerHTML = `<div class="fill-stat"><span class="fs-count"><b>${done}</b> из <b>${all.length}</b> заполнены</span>
      <span class="gap-chips">${chip(cnt.dept, 'dept', 'без отделения')}${chip(cnt.rate, 'rate', 'без ставки')}${chip(cnt.phone, 'phone', 'без телефона')}${chip(cnt.spec, 'spec', 'без спец.')}${chip(cnt.fio, 'fio', 'без фамилии')}</span>
      <label class="rt-toggle"><input type="checkbox" id="empOnlyInc" ${onlyInc ? 'checked' : ''}> только неполные</label></div>`;
    $('empOnlyInc').onchange = ev => { $('empList').dataset.onlyInc = ev.target.checked ? '1' : ''; if (ev.target.checked) $('empList').dataset.gap = ''; renderEmployees($('empSearch').value || ''); };
    $('roNote').querySelectorAll('.gap-chip').forEach(b => b.onclick = () => {
      $('empList').dataset.gap = ($('empList').dataset.gap === b.dataset.gap) ? '' : b.dataset.gap;
      $('empList').dataset.onlyInc = '';
      renderEmployees($('empSearch').value || '');
    });
  }
  const onlyInc = isOwner() && $('empList').dataset.onlyInc === '1';
  const gapF = isOwner() ? ($('empList').dataset.gap || '') : '';
  const cats = deptsFlat();
  const catF = $('empCat')?.dataset.value || '';
  const arch = canEditCards() ? employees.filter(e => e.status === 'archived' && !e.hidden_at && String(e.fio || '').toLowerCase().includes(f)) : [];
  const showArch = $('empList').dataset.showArch === '1';
  const archN = arch.filter(e => archMoney.get(e.id)).length;
  let html = arch.length ? `<div style="margin:0 0 10px"><button class="btn btn-ghost btn-sm" id="archToggle">${showArch ? 'Скрыть архив' : 'Архив · ' + arch.length}</button>${
    archN ? `<span class="mini-chip" style="margin-left:8px">${archN} с деньгами</span>` : ''}</div>` : '';
  let shownList = all.filter(e => String(e.fio || "").toLowerCase().includes(f));
  if (gapF) shownList = shownList.filter(e => cardGaps(e)[gapF]);
  else if (onlyInc) shownList = shownList.filter(isIncomplete);
  const byDept = new Map();
  for (const e of shownList) {
    const c = empCat(e);
    if (!byDept.has(c)) byDept.set(c, []);
    byDept.get(c).push(e);
  }
  for (const cat of cats) {
    if (catF && !(cat === catF || deptParent(cat) === catF)) continue;
    const kids = deptKids(cat);
    const list = byDept.get(cat) || [];
    if (!deptParent(cat)) {
      const total = list.length + kids.reduce((s, k) => s + (byDept.get(k) || []).length, 0);
      if (!total) continue;
      html += `<div class="group-head"><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${total}</div>`;
    }
    if (!list.length) continue;
    if (deptParent(cat) || kids.length) {
      const label = deptParent(cat) ? cat : cat + ' · без блока';
      html += `<div class="group-label${deptParent(cat) ? ' sub' : ''}"><span class="caps"><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(label)} · ${list.length}</span><span class="line"></span></div>`;
    }
    for (const e of list) {
      const pays = activeLines(e).map(l => `<span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${esc(lineLabel(l))}</span>`).join(' ') || '<span class="pill k">строк начисления нет</span>';
      const g = cardGaps(e);
      const gap = isOwner() && isIncomplete(e) ? `<span class="gap-dot" title="Не хватает">⚠ ${[g.dept && 'отделение', g.rate && 'ставка', g.phone && 'телефон', g.spec && 'спец.', g.fio && 'фамилия'].filter(Boolean).join(', ')}</span>` : '';
      html += `<div class="emp-row${isOwner() && isIncomplete(e) ? ' incomplete' : ''}" data-id="${e.id}"><div class="emp-ava" style="background:${catTint(cat)}">${esc(initials(e.fio))}</div><div class="emp-name">${esc(e.fio)}${gap}<div class="sub">${esc(specName(e.specialty_id))}</div></div><div class="emp-pay">${pays}</div><div class="chev">${ICONS.chevR}</div></div>`;
    }
  }
  if (showArch && arch.length) {
    html += `<div class="group-label"><span class="caps">В архиве · ${arch.length}</span><span class="line"></span></div>`;
    for (const e of arch) {
      const d = archMoney.get(e.id) || 0;
      const pay = d ? `<span class="pill ${d > 0 ? 'o' : 'k'}">${d > 0 ? 'должны' : 'переплата'} ${rub(Math.abs(d))} ₽</span>` : '';
      html += `<div class="emp-row" data-id="${e.id}" style="opacity:${d ? 1 : .55}"><div class="emp-ava" style="background:var(--fill-2)">${esc(initials(e.fio))}</div><div class="emp-name">${esc(e.fio)}<div class="sub">в архиве · ${esc(specName(e.specialty_id))}</div></div><div class="emp-pay">${pay}</div><div class="chev">${ICONS.chevR}</div></div>`;
    }
  }
  $('empList').innerHTML = html || `<div class="empty">${all.length ? 'Никого не найдено' : 'Пока нет сотрудников.' + (isOwner() ? '<br><span class="small">Нажмите «Карточка», чтобы создать первую.</span>' : '')}</div>`;
  applyIcons($('empList'));
  const at = $('archToggle'); if (at) at.onclick = () => { $('empList').dataset.showArch = showArch ? '' : '1'; renderEmployees($('empSearch').value || ''); };
  $('empList').querySelectorAll('.emp-row').forEach(r => r.onclick = () => openCard(+r.dataset.id));
}
function partialMonthNote(e) {
  const per = payPeriod || nowPeriod();
  const [y, m] = per.split('-').map(Number);
  const first = per + '-01';
  const last = per + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
  const parts = [];
  if (e.hired_on && e.hired_on > first && e.hired_on <= last) parts.push('принят ' + dm(e.hired_on));
  if (e.left_on && e.left_on >= first && e.left_on < last) parts.push('уволен ' + dm(e.left_on));
  if (!parts.length) return '';
  return `<div class="card cardpad ov-warn" style="margin-top:16px;border-left:3px solid var(--amber)">`
    + `<b>Неполный месяц ${esc(periodLabel(per))}:</b> ${esc(parts.join(', '))}. `
    + `Оклад считается по своим плановым дням — проверьте сумму вручную (точная пропорция появится позже).</div>`;
}
async function loadCardPanel(id) {
  const box = $('cardPanel'); if (!box || !worksWithPayroll()) return;
  const per = payPeriod || nowPeriod();
  box.innerHTML = `<div class="card cardpad" style="margin-top:16px"><span class="muted small">загружаем расчёт…</span></div>`;
  let r, lines, norms, sched;
  try {
    [r, lines, norms, sched] = await Promise.all([
      store.getPayrollRow(id, per),
      store.listPayrollLines(per).catch(() => []),
      store.listMonthNorms(per).catch(() => []),
      store.listSchedule(per).catch(() => []),
    ]);
  } catch (e) { box.innerHTML = ''; return; }
  if (+$('cardBody').dataset.emp !== id) return;
  if (!r) { box.innerHTML = ''; return; }
  let oNotes = {};
  if (r.nach_other_kop || r.uderz_other_kop || r.pay_other_kop) {
    try { oNotes = otherNotes(await store.listMoneyEvents(id, per)); }
    catch (e) { console.warn('listMoneyEvents:', e); }
  }
  const my = linesForRow(r, (lines || []).filter(l => l.employee_id === id));
  const emp0 = employees.find(x => x.id === id);
  const p1 = per + '-01', pNext = nextPeriodStart(per);
  const pctLine = ((emp0 && emp0.lines) || []).find(l => l.pay_kind === 'процент'
    && l.valid_from < pNext && (!l.valid_to || l.valid_to > p1));
  let curRev = 0;
  if (pctLine) { try { curRev = await store.getDoctorRevenue(id, per); } catch (e) {} }
  if (+$('cardBody').dataset.emp !== id) return;
  const nrm = (norms || []).find(n => n.employee_id === id);
  const nh = nrm && nrm.hours != null ? parseFloat(nrm.hours) : null;
  const canEdit = isStaff();
  const days = daysInMonth(per);
  const mine = (sched || []).filter(c => c.employee_id === id);
  const byDate = new Map(mine.map(c => [String(c.work_date), c]));
  const todayISO = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  let strip = '';
  for (let d = 1; d <= days; d++) {
    const iso = per + '-' + String(d).padStart(2, '0');
    const c = byDate.get(iso) || null;
    const past = iso < todayISO;
    strip += `<div class="cp-day${c ? '' : ' empty'}${iso === todayISO ? ' today' : ''}" data-day="${d}" title="${d} ${esc(periodLabel(per))}">`
           + `<i>${d}</i>${schedCellInner(c, past)}</div>`;
  }
  const breakdown = my.length
    ? my.map(l => { const f = rateFormula(l, r, nh, emp0);
        return `<div class="me-row me-calc"><span class="muted">${esc(payKindLabel(l.kind))}${l.sub ? ' · ' + esc(l.sub) : ''}${l.isPct ? '' : ` · ${l.worked} из ${l.planned}`}${
          f ? `<i class="me-f">${esc(f)}</i>` : ''}</span><b>${rub(l.money_kop)} ₽</b></div>`; }).join('')
    : `<div class="me-row"><span class="muted">${r.flag_manual_salary ? 'Сумма вписана вручную — расчёт по графику не применялся' : 'Начислений за месяц нет'}</span></div>`;
  box.innerHTML = `<div class="card cardpad" style="margin-top:16px">
    <div class="cp-head">
      <div class="caps">Расчёт и график</div>
      <div class="month-nav"><button class="mn-btn" id="cpPrev" aria-label="Пред. месяц">‹</button>
        <span>${esc(periodLabel(per))}</span>
        <button class="mn-btn" id="cpNext" aria-label="След. месяц">›</button></div>
    </div>
    <div class="msub" style="margin:-4px 0 10px">${nh != null ? `норма ${fmtH(nh)} · факт ${fmtH(Number(r.fact_hours) || 0)}` : `норма ${r.norm_days} дн · факт ${r.fact_days} дн`}</div>
    ${payrollFlags(r) || ''}
    <div class="cp-strip">${strip}</div>
    ${pctLine && canEdit ? `<div class="cp-rev">
      <label class="flbl" style="margin-top:12px">Выручка за месяц · ЗП = ${esc(String(pctLine.percent))}% от неё</label>
      <div class="me-add">
        <input class="input" id="cpRev" placeholder="выручка ₽" autocomplete="off" inputmode="numeric" value="${curRev ? fmt(Math.round(curRev / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="cpRevSave">${ICONS.check}Сохранить</button>
      </div></div>` : ''}
    <div class="rc-diff" style="margin-top:14px">
      <div class="me-cap">Заработано</div>
      ${breakdown}
      <div class="me-row me-sum${canEdit ? ' me-tap' : ''}"${canEdit ? ' id="cpSalary" title="Задать итоговую зарплату вручную"' : ''}><span>Зарплата${r.flag_manual_salary ? ' · <b class="jact">вручную</b>' : ''}</span><b>${rub(r.salary_kop)} ₽</b>${canEdit ? `<span class="me-pen">✎</span>` : ''}</div>
      ${payRow('Премия', r.premia_kop, 'premia', canEdit)}
      ${payRow('Отпускные начислено', r.otpusk_nach_kop, 'otpusk_nach', canEdit)}
      ${payRow('Больничные начислено', r.bolnich_nach_kop, 'bolnich_nach', canEdit)}
      ${payRow('Своё начисление', r.nach_other_kop, 'nach_other', canEdit, oNotes.nach_other)}
      <div class="me-row me-sum me-earned"><span>Всего заработано</span><b class="money">${rub(earned(r))} ₽</b></div>
      ${markedRow(r)}
      ${forecastRow(r)}
      ${cardBlock(r) ? '<div class="me-cap">На карту</div>' : ''}
      ${payRow('Аванс на карту', r.card_avans_kop, 'card_avans', canEdit)}
      ${payRow('ЗП на карту', r.card_rasch_kop, 'card_rasch', canEdit)}
      ${payRow('Расчёт на карту (увольнение)', r.card_uvol_kop, 'card_uvol', canEdit)}
      ${payRow('Отпускные на карту', r.otpusk_kop, 'otpusk', canEdit)}
      ${payRow('Больничные на карту', r.bolnich_kop, 'bolnich', canEdit)}
      ${payRow('Удержание', r.uderz_other_kop, 'uderz_other', canEdit, oNotes.uderz_other)}
      ${payRow('Прочая выплата', r.pay_other_kop, 'pay_other', canEdit, oNotes.pay_other)}
      ${cardBlock(r) ? `<div class="me-row me-sum me-card"><span>Всего перечислено</span><b class="money">${rub(cardBlock(r))} ₽</b></div>` : ''}
      ${(r.cash_kop || r.cash_avans_kop || r.otpusk_cash_kop) ? '<div class="me-cap">Дополнительные поступления</div>' : ''}
      ${payRow('Аванс наличными', r.cash_avans_kop, 'cash_avans', canEdit)}
      ${payRow('Наличными', r.cash_kop, 'cash', canEdit)}
      ${payRow('Отпускные наличными', r.otpusk_cash_kop, 'otpusk_cash', canEdit)}
      ${handBlock(r) ? `<div class="me-row me-sum me-hand"><span>Всего дополнительно</span><b class="money">${rub(handBlock(r))} ₽</b></div>` : ''}
      ${r.carry_kop || canEdit ? `<div class="me-row me-sum cp-carry${canEdit ? ' me-tap' : ''}"${canEdit ? ' title="Изменить или убрать перенос"' : ''}>
        <span class="muted">С прошлого месяца</span><b class="money${(r.carry_kop || 0) < 0 ? ' neg' : ''}">${r.carry_kop ? rub(r.carry_kop) + ' ₽' : '—'}</b>
        ${canEdit ? '<span class="me-pen">\u270E</span>' : ''}</div>` : ''}
      <div class="me-row me-sum"><span>Осталось выдать</span><b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)} ₽</b></div>
    </div>
    ${canEdit ? `<div class="me-jump"><button class="btn btn-ghost btn-sm" id="cpAdd">${ICONS.plus || '+'}Внести деньги</button></div>` : ''}
  </div>`;
  applyIcons(box);
  const redraw = () => loadCardPanel(id);
  box.querySelectorAll('.me-row.me-tap[data-kind]').forEach(el => el.onclick = () => editPayout(id, per, el.dataset.kind, redraw));
  box.querySelectorAll('.cp-carry.me-tap').forEach(el => el.onclick = () => editCarry(id, per, redraw, r));
  if ($('cpSalary')) $('cpSalary').onclick = () => editSalary(id, per, r, redraw);
  if ($('cpAdd')) $('cpAdd').onclick = () => { payrollDialog(id); };
  if ($('cpRevSave')) $('cpRevSave').onclick = async () => {
    const btn = $('cpRevSave'); if (btn.disabled) return;
    let rev;
    try { rev = parseNum($('cpRev').value, { thousands: true, field: 'выручку', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (rev == null || rev < 0) { toast('Укажите выручку (0 — убрать)', true); return; }
    btn.disabled = true;
    try {
      const res = await store.setDoctorRevenue(id, per, Math.round(rev * 100));
      toast(ICONS.check + (res ? 'Выручка внесена — зарплата пересчитана' : 'Без изменений'));
      redraw();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  if ($('cpRev')) $('cpRev').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('cpRevSave').click(); } };
  $('cpPrev').onclick = () => { shiftCardMonth(-1, id); };
  $('cpNext').onclick = () => { shiftCardMonth(1, id); };
  box.querySelectorAll('.cp-day').forEach(el => el.onclick = () => {
    if (!['owner', 'operator', 'ceo'].includes(store.me()?.role)) return;
    curPeriod = per; scheduleRows = sched || [];
    const d = +el.dataset.day, iso = per + '-' + String(d).padStart(2, '0');
    (iso < todayISO ? scheduleFactPopup : scheduleCellPopup)(id, d);
  });
}
function shiftCardMonth(delta, id) {
  let [y, m] = (payPeriod || nowPeriod()).split('-').map(Number);
  m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
  payPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = payPeriod;
  loadCardMoney(id); loadCardPanel(id);
}
let cardFrom = null;
function focusOn(screen, empId) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const key = String(e.fio || '').split(' ')[0];
  cardFrom = curScreen;
  closeModal();
  if (screen === 'schedule') { const i = $('schedSearch'); if (i) i.value = key; }
  if (screen === 'payroll')  { const i = $('payrollSearch'); if (i) i.value = key; }
  if (screen === 'employees'){ const i = $('empSearch'); if (i) i.value = key; }
  go(screen);
  if (screen === 'schedule') renderSchedule();
  if (screen === 'employees') renderEmployees(key);
}
const dmy = d => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '';
const dayBefore = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
function linePeriod(l) {
  if (!l.valid_to) return `с ${dmy(l.valid_from)}`;
  if (l.valid_to === l.valid_from) return `заведена ${dmy(l.valid_from)}, не действовала ни дня`;
  return `${dmy(l.valid_from)} — ${dmy(dayBefore(l.valid_to))}`;
}
function openCard(id, replace) {
  const e = employees.find(x => x.id === id); if (!e) return false;
  const lines = activeLines(e).map(l => `<div class="line-row"><span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${l.line_type === 'основной' ? 'Основной' : 'Совмест.'}</span><span class="line-when">${esc(linePeriod(l))}</span><div style="font-weight:700">${esc(lineLabel(l))}</div><span class="lv muted small">с ${esc(l.valid_from || '—')}</span></div>`).join('') || '<div class="empty" style="padding:20px">Строк начисления нет</div>';
  const oldLines = (e.lines || []).filter(l => l.valid_to).map(l => `<div class="line-row" style="opacity:.55">
    <span class="pill k">${l.valid_to === l.valid_from ? 'аннулирована' : 'закрыта'}</span>
    <span class="line-when">${esc(linePeriod(l))}</span><div>${esc(lineLabel(l))}</div></div>`).join('');
  $('cardBody').innerHTML = `
    <div class="card cardpad" style="margin-bottom:16px"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="emp-ava" style="width:64px;height:64px;border-radius:20px;font-size:20px;background:${palette[id % palette.length]}">${esc(initials(e.fio))}</div>
      <div style="flex:1;min-width:200px"><h1 style="font-size:23px;font-weight:700">${esc(e.fio)}</h1><p class="muted" style="margin-top:2px">${esc(specName(e.specialty_id))}</p></div>
      <div id="cardMoney" class="card-money"></div>
      ${isStaff() ? `<button class="btn btn-ghost btn-sm" id="cardToPay">Расчёт</button><button class="btn btn-ghost btn-sm" id="cardToSched">График</button>` : ''}
      <!-- «История» — тот же журнал, сразу отфильтрованный по этому человеку.
           Дарина 14.08: «і в історії розрахунків окремої людини видно ж буде ці
           зміни? чому була одна сума а потім змінилась?» Данные для ответа были
           всегда (каждая запись журнала несёт employee_id), не хватало дороги:
           такая кнопка стояла только на «Архиве». -->
      ${isOwner() ? `<button class="btn btn-ghost btn-sm" id="cardHist" title="Кто и когда менял этого человека — ставки, график, деньги, переносы">История</button>` : ''}
      ${canEditCards() ? `<button class="btn btn-ghost btn-sm" id="editEmpBtn">${ICONS.edit}Редактировать</button><button class="btn btn-ghost btn-sm" id="archiveEmpBtn">${e.status === 'active' ? 'В архив' : 'Из архива'}</button>` : `<span class="tag">${ICONS.lock} правит владелец</span>`}
    </div></div>
    <div class="grid2">
      <div class="card cardpad"><div class="caps" style="margin-bottom:12px">Строки начисления</div>${lines}${oldLines ? `<div class="caps" style="margin:16px 0 6px">История ставок</div>${oldLines}` : ''}</div>
      <div class="card cardpad">
        <div class="field"><span class="caps">Отделение</span><span class="val">${e.dept ? esc(catLabel(e.dept)) : '<span class="muted">не указано</span>'}</span></div>
        <div class="field"><span class="caps">Специальность</span><span class="val">${esc(specName(e.specialty_id))}</span></div>
        <div class="field"><span class="caps">Вторая работа</span><span class="val">${e.specialty_id_2 ? esc(specName(e.specialty_id_2)) : '<span class="muted">—</span>'}</span></div>
        <div class="field"><span class="caps">Должность</span><span class="val">${esc(e.position === FIO_SENTINEL ? '—' : (e.position || '—'))}</span></div>
        <div class="field"><span class="caps">Телефон (для СМС)</span><span class="val num">${esc(fmtPhone(e.phone) || '—')}</span></div>
        <div class="field"><span class="caps">Принят / уволен</span><span class="val small">${e.hired_on || e.left_on ? esc(dm(e.hired_on) || '—') + ' — ' + esc(dm(e.left_on) || '…') : '—'}</span></div>
        <div class="field"><span class="caps">Статус</span><span class="val">${e.left_on ? 'уволен' : (e.status === 'active' ? 'работает' : 'в архиве')}</span></div>
        <div class="field" style="margin:0"><span class="caps">Карточка создана</span><span class="val small">${esc(fmtDT(e.created_at))}</span></div>
      </div>
    </div>${partialMonthNote(e)}
    <div id="cardPanel"></div>
    <div class="card cardpad" style="margin-top:16px">
      <div class="caps" style="margin-bottom:10px">Комментарии</div>
      <div id="cardNotes"><span class="muted small">загружаем…</span></div>
      ${
        store.me()?.role ? `<div class="me-add" style="margin-top:12px">
        <input class="input" id="noteInput" placeholder="добавить заметку к карточке…" autocomplete="off" maxlength="4000">
        <button class="btn btn-primary btn-sm" id="noteAdd">${ICONS.plus}Добавить</button>
      </div>` : ''}
    </div>`;
  { const h = $('cardHist');
    if (h) h.onclick = () => { jWho = (String(e.fio || '').split(' ')[0] || '').trim(); jAct = jFrom = jTo = jActor = ''; journalFilter = 'all'; go('journal'); renderJournal(true); }; }
  $('cardBody').dataset.emp = id;
  applyIcons($('cardBody'));
  const eb = $('editEmpBtn'); if (eb) eb.onclick = () => employeeForm(e);
  const ab = $('archiveEmpBtn'); if (ab) ab.onclick = () => toggleArchive(e);
  const cp = $('cardToPay'); if (cp) cp.onclick = () => { focusOn('payroll', id); setTimeout(() => payrollDialog(id), 350); };
  const cs2 = $('cardToSched'); if (cs2) cs2.onclick = () => focusOn('schedule', id);
  go('card', replace);
  loadCardMoney(id);
  loadCardPanel(id);
  loadCardNotes(id);
  return true;
}
async function loadCardNotes(id) {
  const box = $('cardNotes'); if (!box) return;
  try {
    const notes = await store.listNotes(id);
    if (+$('cardBody').dataset.emp !== id) return;
    box.innerHTML = notes.length
      ? notes.map(n => `<div class="pm-ev"><span>${esc(n.text)}</span><span class="muted small">${esc(n.author_name || '—')} · ${esc(fmtDT(n.created_at))}</span></div>`).join('')
      : '<span class="muted small">Заметок пока нет</span>';
  } catch (e) { box.innerHTML = `<span class="muted small">${esc(e.message || e)}</span>`; }
  const inp = $('noteInput'), add = $('noteAdd');
  if (add && inp) {
    inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); add.click(); } };
    add.onclick = async () => {
      const text = inp.value.trim(); if (!text) return;
      add.disabled = true;
      try { await store.addNote(id, text); inp.value = ''; await loadCardNotes(id); }
      catch (e) { toast(e.message || e, true); } finally { add.disabled = false; }
    };
  }
}
async function loadCardMoney(id) {
  const box = $('cardMoney'); if (!box || !worksWithPayroll()) return;
  const per = payPeriod || nowPeriod();
  try {
    const r = await store.getPayrollRow(id, per);
    if (!r || +$('cardBody').dataset.emp !== id) return;
    const dolzhno = deltaFromBlocks(r);
    box.innerHTML = `<div class="cm-pay"><span class="caps">Осталось выдать · ${esc(periodLabel(per))}</span>
        <b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)} ₽</b></div>
      <div class="cm-chips">
        <span class="mini-chip">Начислено${r.flag_manual_salary ? ' (вручную)' : ''}: <b>${rub(earned(r))} ₽</b></span>
        ${waitingMark(r) ? `<span class="mini-chip warn" title="Дни в графике есть, но факт по ним не отмечен — в выдачу эти деньги пока не идут">− ждёт отметок: <b>${rub(waitingMark(r))} ₽</b></span>` : ''}
        ${cardBlock(r) ? `<span class="mini-chip">− на карту: <b>${rub(cardBlock(r))} ₽</b></span>` : ''}
        ${handBlock(r) ? `<span class="mini-chip">− наличными: <b>${rub(handBlock(r))} ₽</b></span>` : ''}
        ${r.carry_kop ? `<span class="mini-chip">${(r.carry_kop || 0) < 0 ? '−' : '+'} с прошлого месяца: <b>${rub(Math.abs(r.carry_kop))} ₽</b></span>` : ''}
        ${
''}
        ${r.to_pay_kop ? `<span class="mini-chip cm-apart">записано в кассу: <b>${rub(r.to_pay_kop)} ₽</b></span>` : ''}
        ${r.flag_no_rate && !payNotByShift(id, per)
          ? '<span class="mini-chip warn">вид смены без ставки</span>' : ''}
        ${
''}
        ${dolzhno !== (r.delta_kop || 0)
          ? `<span class="mini-chip warn" title="Блоки дают ${rub(dolzhno)} ₽, а расчёт — ${rub(r.delta_kop)} ₽. Появился вид денег, которого нет в блоках карточки.">чипы не сходятся: ${rub(dolzhno - (r.delta_kop || 0))} ₽</span>` : ''}
      </div>`;
  } catch (err) { box.innerHTML = ''; }
}
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
  else if (kind === 'сдельно') box.innerHTML = `<label class="flbl" style="margin-top:0">Сумма</label><div class="msub" style="margin-top:6px">Вписывается каждый месяц на экране «Расчёт» → «Финальная сумма вручную». Здесь ставка не нужна.</div>`;
  else if (kind === '12ч') box.innerHTML = `<div class="frow"><div><label class="flbl" style="margin-top:0">День ₽</label><input class="input lb-amount" inputmode="numeric" value="${l?.amount ?? ''}" placeholder="2500"></div><div><label class="flbl" style="margin-top:0">Ночь ₽</label><input class="input lb-night" inputmode="numeric" value="${l?.amount_night ?? ''}" placeholder="3000"></div></div>`;
  else box.innerHTML = `<label class="flbl" style="margin-top:0">Ставка ₽ ${(kind === 'оклад' || kind === 'фикс') ? '/мес' : kind === 'сутки' ? '/смена' : '/час'}</label><input class="input lb-amount" inputmode="numeric" value="${l?.amount ?? ''}" placeholder="напр. 50 000">`;
}
function wireLineBlock(blk, l) {
  renderLineFields(blk, l);
  blk.querySelector('.lb-pay').onchange = () => { blk.removeAttribute('data-keep'); renderLineFields(blk); };
  blk.querySelectorAll('.lb-type button').forEach(b => b.onclick = () => { blk.removeAttribute('data-keep'); blk.querySelectorAll('.lb-type button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  blk.querySelectorAll('.lb-fields input, .lb-amount, .lb-night, .lb-percent').forEach(i => i.oninput = () => blk.removeAttribute('data-keep'));
  blk.querySelector('.lb-fields').addEventListener('input', () => blk.removeAttribute('data-keep'));
  blk.querySelector('.linedel').onclick = () => { blk.remove(); };
}
const RATE_CONFIRM = 1000000;
const RATE_ABSURD  = 100000000;
function checkRate(l) {
  if (l.pay_kind === 'процент') {
    if (l.percent == null) throw new Error('Укажите процент');
    if (l.percent <= 0 || l.percent > 100) throw new Error('Процент должен быть больше 0 и не больше 100');
    return l;
  }
  if (l.pay_kind === 'сдельно') { l.amount = null; l.amount_night = null; l.percent = null; return l; }
  if (l.amount == null) throw new Error('Укажите сумму ставки');
  if (l.amount <= 0) throw new Error('Ставка должна быть больше 0');
  if (l.pay_kind === '12ч') {
    if (l.amount_night == null) throw new Error('Для «12ч» укажите и дневную, и ночную ставку');
    if (l.amount_night <= 0) throw new Error('Ночная ставка должна быть больше 0');
  }
  l._needsConfirm = (l.amount > RATE_CONFIRM) || (l.amount_night != null && l.amount_night > RATE_CONFIRM);
  return l;
}
function bigAmounts(lines) {
  const out = [];
  for (const l of lines || []) {
    if (l._keep || l.pay_kind === 'процент') continue;
    if (l.amount != null && l.amount > RATE_CONFIRM) out.push(l.amount);
    if (l.amount_night != null && l.amount_night > RATE_CONFIRM) out.push(l.amount_night);
  }
  return out;
}
function confirmBigAmounts(amounts) {
  return new Promise(resolve => {
    const list = amounts.map(a => `<b>${fmt(a)} ₽</b>`).join(', ');
    showModal2(`<h3>Проверьте сумму</h3><div class="msub">Крупная сумма — это точно не опечатка?</div>
      <div class="rc-diff"><div>Вводите: ${list}</div></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="baNo">Исправить</button>
        <button class="btn btn-primary btn-sm" id="baYes">${ICONS.check}Да, всё верно</button></div>`);
    modalOnClose2 = () => resolve(false);
    $('baNo').onclick = () => { resolve(false); closeModal2(); };
    $('baYes').onclick = () => { resolve(true); closeModal2(); };
  });
}
function confirmPhone(norm) {
  return new Promise(resolve => {
    showModal2(`<h3>Проверьте номер</h3><div class="msub">Дописали код страны — вдруг потерялась цифра?</div>
      <div class="rc-diff"><div>Сохраним как <b>${esc(fmtPhone(norm))}</b></div></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="phNo">Исправить</button>
        <button class="btn btn-primary btn-sm" id="phYes">${ICONS.check}Да, верно</button></div>`);
    modalOnClose2 = () => resolve(false);
    $('phNo').onclick = () => { resolve(false); closeModal2(); };
    $('phYes').onclick = () => { resolve(true); closeModal2(); };
  });
}
const MONEY_MAX_KOP = 100000000;
const MONEY_BIG_KOP = 30000000;
const MAX_IMPORT_ROWS = 500;
const importState = { kind: null, period: null, rows: [], parsed: false, existing: new Set(), loading: false, truncated: false, fileName: null };
function importCanInclude(r) { return !!(r.chosenId && r.amount_kop != null && r.amount_kop <= MONEY_MAX_KOP && !r.dup); }
function fioNorm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^a-zа-я-]+/gi, ' ').replace(/\s+/g, ' ').trim();
}
function simRatio(a, b) {
  a = a || ''; b = b || ''; if (a === b) return 1; if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function givenConfident(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aInit = a.length <= 1, bInit = b.length <= 1;
  return (aInit || bInit) && a[0] === b[0];
}
function matchEmp(raw, emps) {
  const q = fioNorm(raw);
  if (!q) return { status: 'empty' };
  const pool = emps.filter(e => e.status !== 'archived');
  const src = pool.length ? pool : emps;
  const exact = src.filter(e => fioNorm(e.fio) === q);
  if (exact.length === 1) return { status: 'ok', emp: exact[0] };
  if (exact.length > 1) return { status: 'many', cands: exact };
  const qs = q.split(' '); const surname = qs[0], given = qs[1] || '';
  const bySur = src.filter(e => fioNorm(e.fio).split(' ')[0] === surname);
  if (bySur.length === 1) {
    const gOk = givenConfident(given, fioNorm(bySur[0].fio).split(' ')[1] || '');
    return { status: gOk ? 'ok' : 'weak', emp: bySur[0] };
  }
  if (bySur.length > 1) {
    const byFull = bySur.filter(e => (fioNorm(e.fio).split(' ')[1] || '') === given);
    if (byFull.length === 1) return { status: 'ok', emp: byFull[0] };
    if (given.length <= 1 && given) {
      const byInit = bySur.filter(e => { const g = fioNorm(e.fio).split(' ')[1] || ''; return g[0] === given[0]; });
      if (byInit.length === 1) return { status: 'ok', emp: byInit[0] };
    }
    return { status: 'many', cands: bySur };
  }
  let best = null;
  for (const e of src) {
    const s = simRatio(surname, fioNorm(e.fio).split(' ')[0]);
    if (!best || s > best.s) best = { emp: e, s };
  }
  if (best && best.s >= 0.82) return { status: 'fuzzy', emp: best.emp, score: best.s };
  return { status: 'new' };
}
function parseAmountKop(s) {
  let t = String(s || '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const commas = (t.match(/,/g) || []).length, dots = (t.match(/\./g) || []).length;
  if (commas > 1) return null;
  if (commas === 1) {
    const i = t.indexOf(','), intp = t.slice(0, i), frac = t.slice(i + 1);
    if (frac.length < 1 || frac.length > 2) return null;
    if (intp.includes('.') && !/^\d{1,3}(\.\d{3})*$/.test(intp)) return null;
    t = intp.replace(/\./g, '') + '.' + frac;
  } else if (dots >= 1) {
    const last = t.slice(t.lastIndexOf('.') + 1);
    if (dots >= 2 || last.length === 3) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return null;
      t = t.replace(/\./g, '');
    } else if (last.length > 2) return null;
  }
  const v = parseFloat(t);
  return isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}
function splitImportLine(line) {
  let cells = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}|\s*\|\s*/);
  cells = cells.map(c => c.trim()).filter(Boolean);
  if (cells.length < 2) {
    const m = line.trim().match(/^(.*?[а-яё])\s+([\d][\d\s.,]*)$/i);
    if (m) return { fio: m[1].trim(), amount: m[2].trim() };
    return { fio: line.trim(), amount: '' };
  }
  let fioCell = cells[0], bestC = -1;
  for (const c of cells) { const n = (c.match(/[а-яё]/gi) || []).length; if (n > bestC) { bestC = n; fioCell = c; } }
  let amount = '', bestScore = -1;
  for (const c of cells) {
    if (c === fioCell || parseAmountKop(c) == null) continue;
    const norm = c.replace(/\s/g, ' ');
    const score = (/,\d{1,2}$/.test(norm) ? 2 : 0) + (/\d[ .]\d{3}(\D|$)/.test(norm) ? 1 : 0);
    if (score >= bestScore) { bestScore = score; amount = c; }
  }
  return { fio: fioCell, amount };
}
const IMPORT_SLUZHEBNYE = /^(итого|итог|всего|сумма|ведомость|фио|фамилия|сотрудник|списком|расшифровка|период|список|организация|единица|код|общество|генеральный|главный|бухгалтер|директор|руководитель|исполнитель|подпись|должность|приложение|получател)/;
function isImportHeaderFio(syroe) {
  const syro = String(syroe || '').trim();
  const fn = fioNorm(syro);
  if (!fn || !/[а-яё]{2}/i.test(fn)) return true;
  if (/[\d:"«»№%]/.test(syro)) return true;
  const slov = fn.split(' ').filter(Boolean);
  if (slov.length < 2 || slov.length > 5) return true;
  return IMPORT_SLUZHEBNYE.test(fn);
}
function buildImportRow(fio, amount_kop, rawAmount, struck) {
  const match = matchEmp(fio, employees);
  const over = amount_kop != null && amount_kop > MONEY_MAX_KOP;
  const autoOk = match.status === 'ok' && amount_kop != null && !over && !struck;
  return { raw: fio, rawAmount: rawAmount || '', amount_kop, over, struck: !!struck, match,
    chosenId: match.emp?.id || null, autoOk, include: autoOk, dup: false, userSet: false };
}
function parseImport() {
  const ta = $('impPaste'); const text = ta ? ta.value : '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  importState.truncated = false;
  importState.fileName = null;
  for (const line of lines) {
    if (rows.length >= MAX_IMPORT_ROWS) { importState.truncated = true; break; }
    const { fio, amount } = splitImportLine(line);
    if (isImportHeaderFio(fio)) continue;
    rows.push(buildImportRow(fio, parseAmountKop(amount), amount, false));
  }
  importState.rows = rows; importState.parsed = true;
}
async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function unzipXlsx(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  const lo = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= lo; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('файл не похож на .xlsx (нет ZIP)');
  const cdCount = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const want = /^xl\/(sharedStrings|styles|workbook)\.xml$|^xl\/_rels\/workbook\.xml\.rels$|^xl\/worksheets\/[^/]+\.xml$/;
  const out = {};
  for (let n = 0; n < cdCount && p + 46 <= buf.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (want.test(name) && lho + 30 <= buf.length) {
      if (uncompSize > 40 * 1024 * 1024) throw new Error('слишком большой лист в файле');
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.subarray(start, start + compSize);
      out[name] = method === 0 ? comp : await inflateRaw(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function xlsxDoc(bytes) { return bytes ? new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml') : null; }
function xlsxSharedStrings(doc) {
  if (!doc) return [];
  return [...doc.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
}
function xlsxStruckStyles(doc) {
  const struck = new Set(); if (!doc) return struck;
  const struckFonts = new Set();
  const fonts = doc.getElementsByTagName('fonts')[0];
  const vklyucheno = el => {
    const v = (el.getAttribute('val') ?? el.getAttribute('value') ?? '').trim().toLowerCase();
    return v === '' || v === '1' || v === 'true' || v === 'on';
  };
  if (fonts) [...fonts.children].forEach((f, i) => {
    if (f.tagName !== 'font') return;
    const s = f.getElementsByTagName('strike');
    if (s.length && [...s].some(vklyucheno)) struckFonts.add(i);
  });
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfs) [...cellXfs.children].forEach((xf, i) => { if (xf.tagName === 'xf' && struckFonts.has(+(xf.getAttribute('fontId') || 0))) struck.add(i); });
  return struck;
}
const XLSX_DATE_BUILTIN = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function xlsxDateStyles(doc) {
  const dateStyles = new Set(); if (!doc) return dateStyles;
  const fmtIsDate = {};
  for (const nf of doc.getElementsByTagName('numFmt')) {
    const id = +(nf.getAttribute('numFmtId') || -1);
    const code = (nf.getAttribute('formatCode') || '').toLowerCase()
      .replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    fmtIsDate[id] = /[yd]/.test(code) || /h/.test(code) || (/m/.test(code) && /[:/.\-]/.test(code));
  }
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfs) [...cellXfs.children].forEach((xf, i) => {
    if (xf.tagName !== 'xf') return;
    const id = +(xf.getAttribute('numFmtId') || 0);
    if (XLSX_DATE_BUILTIN.has(id) || fmtIsDate[id]) dateStyles.add(i);
  });
  return dateStyles;
}
function xlsxColIndex(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return 0; let n = 0; for (const ch of m[1]) { n = n * 26 + (ch.charCodeAt(0) - 64); if (n > 16384) return 16383; } return n - 1; }
function xlsxSheetRows(doc, shared, struckStyles, dateStyles) {
  const rows = []; if (!doc) return rows;
  for (const row of doc.getElementsByTagName('row')) {
    const cells = [];
    for (const c of row.getElementsByTagName('c')) {
      const col = xlsxColIndex(c.getAttribute('r'));
      const t = c.getAttribute('t'), s = +(c.getAttribute('s') || 0);
      const vEl = c.getElementsByTagName('v')[0];
      let value = '', num = null;
      if (t === 's') value = shared[+(vEl ? vEl.textContent : -1)] || '';
      else if (t === 'inlineStr' || t === 'str') value = ((c.getElementsByTagName('t')[0] || vEl) || {}).textContent || '';
      else { value = vEl ? vEl.textContent : ''; if (value !== '' && isFinite(+value)) num = +value; }
      cells[col] = { value: String(value).trim(), num, struck: struckStyles.has(s), date: num != null && dateStyles.has(s) };
    }
    rows.push(cells);
  }
  return rows;
}
function cellAmountKop(c) {
  if (!c || c.date) return null;
  if (c.num != null) return c.num > 0 ? Math.round(c.num * 100) : null;
  return parseAmountKop(c.value);
}
const XLSX_AMOUNT_HDR = /сумма|выдач|выдать|начислен|оклад|аванс|отпускн|зарплат|премия|к.выдаче/i;
function xlsxAmountColumn(grid) {
  for (const cells of grid.slice(0, 6)) {
    for (let ci = 0; ci < cells.length; ci++) {
      const c = cells[ci];
      if (c && c.num == null && XLSX_AMOUNT_HDR.test(c.value)) return { col: ci, header: cells };
    }
  }
  return { col: -1, header: null };
}
function xlsxGridToRows(grid) {
  const out = [];
  importState.truncated = false;
  const { col: amountCol, header: headerCells } = xlsxAmountColumn(grid);
  for (const cells of grid) {
    if (cells === headerCells) continue;
    if (out.length >= MAX_IMPORT_ROWS) { importState.truncated = true; break; }
    let fioCell = null, bestC = -1;
    for (const c of cells) { if (!c) continue; const k = (c.value.match(/[а-яё]/gi) || []).length; if (k > bestC) { bestC = k; fioCell = c; } }
    if (!fioCell || isImportHeaderFio(fioCell.value)) continue;
    let amountCell = null;
    if (amountCol >= 0 && cells[amountCol] && cells[amountCol] !== fioCell && cellAmountKop(cells[amountCol]) != null)
      amountCell = cells[amountCol];
    if (!amountCell) {
      let bestScore = -1;
      for (const c of cells) {
        if (!c || c === fioCell || cellAmountKop(c) == null) continue;
        const norm = c.value.replace(/\s/g, ' ');
        const score = (c.num != null ? 1 : 0)
          + (c.num != null && !Number.isInteger(c.num) ? 2 : 0)
          + (/,\d{1,2}$/.test(norm) ? 2 : 0) + (/\d[ .]\d{3}(\D|$)/.test(norm) ? 1 : 0);
        if (score >= bestScore) { bestScore = score; amountCell = c; }
      }
    }
    const rawAmount = amountCell ? (amountCell.num != null ? String(amountCell.num) : amountCell.value) : '';
    out.push(buildImportRow(fioCell.value, cellAmountKop(amountCell), rawAmount, fioCell.struck));
  }
  return out;
}
function xlsxFirstSheetPath(parts) {
  const wsKeys = Object.keys(parts).filter(k => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort();
  if (wsKeys.length <= 1) return wsKeys[0];
  try {
    const wb = xlsxDoc(parts['xl/workbook.xml']);
    const rels = xlsxDoc(parts['xl/_rels/workbook.xml.rels']);
    const sheet1 = wb && wb.getElementsByTagName('sheet')[0];
    const rid = sheet1 && (sheet1.getAttribute('r:id') || sheet1.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    if (rid && rels) for (const rel of rels.getElementsByTagName('Relationship')) {
      if (rel.getAttribute('Id') !== rid) continue;
      let target = (rel.getAttribute('Target') || '').replace(/^\//, '');
      if (!target.startsWith('xl/')) target = 'xl/' + target;
      if (parts[target]) return target;
    }
  } catch (e) {   }
  return parts['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : wsKeys[0];
}
async function importFromFile(file) {
  if (!file) return;
  importState.rows = []; importState.parsed = false; importState.truncated = false; importState.fileName = file.name || null; renderImportPreview();
  if (file.size > 6 * 1024 * 1024) { toast('Файл больше 6 МБ — вставьте список текстом', true); return; }
  const name = (file.name || '').toLowerCase();
  try {
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      const text = await file.text();
      const ta = $('impPaste');
      if (ta) ta.value = text.replace(/\r/g, '').split('\n').map(l => l.includes('\t') ? l : l.replace(/;/g, '\t')).join('\n');
      parseImport();
    } else {
      if (typeof DecompressionStream === 'undefined') throw new Error('этот браузер не читает .xlsx — вставьте текстом');
      const buf = new Uint8Array(await file.arrayBuffer());
      const parts = await unzipXlsx(buf);
      const shared = xlsxSharedStrings(xlsxDoc(parts['xl/sharedStrings.xml']));
      const stylesDoc = xlsxDoc(parts['xl/styles.xml']);
      const struckStyles = xlsxStruckStyles(stylesDoc);
      const dateStyles = xlsxDateStyles(stylesDoc);
      const sheetName = xlsxFirstSheetPath(parts);
      if (!sheetName) throw new Error('в файле нет листа');
      const grid = xlsxSheetRows(xlsxDoc(parts[sheetName]), shared, struckStyles, dateStyles);
      importState.rows = xlsxGridToRows(grid);
      importState.parsed = true;
    }
    await importLoadExisting();
    renderImportPreview();
    const struckN = importState.rows.filter(r => r.struck).length;
    toast(`Разобрано строк: ${importState.rows.length}${struckN ? ` · зачёркнутых (уволены): ${struckN}` : ''}`);
  } catch (e) {
    importState.rows = []; importState.parsed = false; renderImportPreview();
    toast('Не удалось прочитать файл: ' + (e.message || 'ошибка'), true);
  }
}
async function importLoadExisting() {
  importState.existing = new Set();
  try { importState.existing = await store.existingMoneyIds(importState.period, importState.kind); }
  catch (e) {   }
  importState.sibling = new Set(); importState.siblingKind = null;
  for (const sk of (IMPORT_SIBLINGS[importState.kind] || [])) {
    try {
      const s = await store.existingMoneyIds(importState.period, sk);
      if (s.size) { importState.siblingKind = sk; s.forEach(id => importState.sibling.add(id)); }
    } catch (e) {   }
  }
  for (const r of importState.rows) {
    r.dup = !!(r.chosenId && importState.existing.has(r.chosenId));
    r.include = importCanInclude(r) && (r.userSet ? r.include : r.autoOk);
  }
}
function importEmpOptions(selId) {
  const act = employees.filter(e => e.status !== 'archived').slice()
    .sort((a, b) => fioNorm(a.fio) < fioNorm(b.fio) ? -1 : 1);
  return '<option value="">— не сопоставлять —</option>' +
    act.map(e => `<option value="${e.id}"${e.id === selId ? ' selected' : ''}>${esc(e.fio)}</option>`).join('');
}
function renderImport() {
  const kinds = importKinds();
  if (!canImport()) { $('importBody').innerHTML = '<div class="card cardpad muted">Импорт недоступен для вашей роли.</div>'; return; }
  if (!importState.kind || !kinds.includes(importState.kind)) importState.kind = kinds[0];
  if (!importState.period) { const d = new Date(); importState.period = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  const meta = IMPORT_KIND_META[importState.kind] || {};
  $('importBody').innerHTML = `
    <div class="card cardpad imp-setup">
      <div class="imp-field">
        <label>Что вносим</label>
        <div class="imp-kinds">${kinds.map(k => `<button class="imp-kind${k === importState.kind ? ' on' : ''}" data-ik="${k}">${esc(IMPORT_KIND_META[k]?.label || k)}</button>`).join('')}</div>
        <div class="imp-hint">${esc(meta.hint || '')}</div>
      </div>
      <div class="imp-field imp-month">
        <label>За месяц</label>
        <button class="input monthpick" id="impMonth" type="button" aria-haspopup="true">${esc(periodLabel(importState.period))}</button>
        <div class="mp-pop" id="impMonthPop" hidden></div>
      </div>
      <div class="imp-field">
        <label>Список из документа — вставьте текстом или загрузите файл</label>
        <textarea id="impPaste" rows="6" spellcheck="false" placeholder="Вставьте из Excel или наберите. Например:
Иванова Мария Петровна&#9;77 520,00
Петров Сергей Иванович&#9;56 626,28"></textarea>
      </div>
      <div class="imp-actions">
        <button class="btn btn-primary" id="impParse">Разобрать</button>
        <label class="btn btn-ghost imp-filebtn" for="impFile"><span data-ic="upload"></span>Файл .xlsx</label>
        <input type="file" id="impFile" accept=".xlsx,.csv" hidden>
        <span class="muted small">Ничего не запишется, пока вы не подтвердите. Зачёркнутых (уволены) в файле не включаем по умолчанию.</span>
      </div>
    </div>
    <div id="impPreview"></div>`;
  $('importBody').querySelectorAll('[data-ik]').forEach(b => b.onclick = () => {
    importState.kind = b.dataset.ik; importState.parsed = false; importState.rows = []; renderImport();
  });
  monthPicker($('impMonth'), $('impMonthPop'), importState.period, per => {
    importState.period = per;
    $('impMonth').textContent = periodLabel(per);
    if (importState.parsed) importLoadExisting().then(renderImportPreview);
  });
  $('impParse').onclick = async () => { parseImport(); await importLoadExisting(); renderImportPreview(); };
  $('impFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; importFromFile(f); };
  applyIcons($('importBody'));
  if (importState.parsed) renderImportPreview();
}
function renderImportPreview() {
  const box = $('impPreview'); if (!box) return;
  if (!importState.parsed) { box.innerHTML = ''; return; }
  const rows = importState.rows;
  if (!rows.length) { box.innerHTML = '<div class="card cardpad muted">Не нашлось ни одной строки с ФИО и суммой. Проверьте, что вставлены строки вида «Фамилия Имя Отчество ⟶ сумма».</div>'; return; }
  const STLABEL = { ok: ['Сопоставлен', 'ok'], weak: ['Проверьте имя', 'warn'], fuzzy: ['Похоже на опечатку', 'warn'], many: ['Несколько совпадений', 'warn'], new: ['Не найден', 'bad'], empty: ['Пусто', 'bad'] };
  const loading = importState.loading;
  const incl = rows.filter(r => r.include && importCanInclude(r));
  const total = incl.reduce((s, r) => s + r.amount_kop, 0);
  const dupCount = rows.filter(r => r.dup).length;
  const noAmount = rows.filter(r => r.amount_kop == null).length;
  const overCount = rows.filter(r => r.over).length;
  const trs = rows.map((r, i) => {
    const [lbl, cls] = STLABEL[r.match.status] || ['—', 'bad'];
    const canCheck = importCanInclude(r);
    const fixed = r.match.status === 'ok' && !r.dup && !r.over;
    const nameCell = fixed
      ? `<b>${esc(r.match.emp.fio)}</b>`
      : `<select data-ri="${i}" class="imp-sel"${loading ? ' disabled' : ''}>${importEmpOptions(r.chosenId)}</select>`;
    const big = r.amount_kop != null && !r.over && r.amount_kop > MONEY_BIG_KOP;
    const amt = r.over
      ? `${rub(r.amount_kop)} ₽<div class="imp-nomoney">больше 1 млн — нельзя</div>`
      : r.amount_kop != null
        ? `${rub(r.amount_kop)} ₽${big ? ' <span class="imp-tag">крупная</span>' : ''}<div class="imp-src">${esc(r.rawAmount || '')}</div>`
        : '<span class="imp-nomoney">нет суммы</span>';
    const tags = (r.dup ? ' <span class="imp-tag">уже внесено</span>' : '') + (r.struck ? ' <span class="imp-tag imp-fired">уволен</span>' : '');
    return `<tr class="${r.include && canCheck ? '' : 'imp-off'}${r.dup ? ' imp-dup' : ''}">
      <td class="imp-ck"><input type="checkbox" data-ci="${i}"${r.include && canCheck ? ' checked' : ''}${(!canCheck || loading) ? ' disabled' : ''}></td>
      <td class="imp-raw">${esc(r.raw)}${tags}</td>
      <td>${nameCell}</td>
      <td class="num">${amt}</td>
      <td><span class="imp-pill ${cls}">${esc(lbl)}</span></td>
    </tr>`;
  }).join('');
  const notes = [];
  if (dupCount) notes.push(`${dupCount} уже внесено`);
  const struckN = rows.filter(r => r.struck).length;
  if (struckN) notes.push(`${struckN} уволены (зачёркнуты)`);
  if (noAmount) notes.push(`${noAmount} без суммы`);
  if (overCount) notes.push(`${overCount} свыше лимита`);
  notes.push(`${rows.length} строк всего`);
  box.innerHTML = `
    <div class="card imp-preview">
      ${importState.truncated ? `<div class="imp-warn">Показаны первые ${MAX_IMPORT_ROWS} строк — остальное не разобрано. Загрузите частями.</div>` : ''}
      <div class="imp-sum">
        <div class="imp-sum-main"><b>${incl.length}</b> к загрузке · <b>${rub(total)} ₽</b></div>
        <div class="muted small">${notes.join(' · ')}</div>
        <button class="btn btn-primary btn-sm" id="impLoad"${(incl.length && !loading) ? '' : ' disabled'}>${loading ? 'Загрузка…' : 'Загрузить' + (incl.length ? ' ' + incl.length : '')}</button>
      </div>
      <div class="imp-tablewrap"><table class="imp-table">
        <thead><tr><th></th><th>Из ведомости</th><th>Сотрудник в базе</th><th class="num">Сумма</th><th>Статус</th></tr></thead>
        <tbody>${trs}</tbody>
      </table></div>
    </div>`;
  box.querySelectorAll('[data-ci]').forEach(c => c.onchange = () => { const r = importState.rows[+c.dataset.ci]; r.include = c.checked; r.userSet = true; renderImportPreview(); });
  box.querySelectorAll('[data-ri]').forEach(sel => sel.onchange = () => {
    const r = importState.rows[+sel.dataset.ri];
    r.chosenId = sel.value ? +sel.value : null;
    r.userSet = true;
    r.dup = !!(r.chosenId && importState.existing.has(r.chosenId));
    r.include = importCanInclude(r);
    renderImportPreview();
  });
  const lb = $('impLoad'); if (lb) lb.onclick = doImportLoad;
}
function confirmImportLoad(kindLabel, period, count, total, warn) {
  return new Promise(resolve => {
    showModal(`<h3>Загрузить «${esc(kindLabel)}»?</h3>
      <div class="msub">За ${esc(period)} · записи попадут в журнал, их увидит владелец</div>
      <div class="rc-diff"><div><b>${count}</b> чел · <b>${fmt(Math.round(total / 100))} ₽</b></div></div>
      ${warn ? `<div class="imp-warn">${esc(warn).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="msub" style="margin-top:8px">Отменить запись можно только сторно. Продолжить?</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="ilNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="ilYes">${ICONS.check}Загрузить</button></div>`);
    $('modalBox').dataset.guard = '1';
    modalOnClose = () => resolve(false);
    $('ilNo').onclick = () => { resolve(false); closeModal(); };
    $('ilYes').onclick = () => { resolve(true); closeModal(); };
  });
}
async function doImportLoad() {
  if (importState.loading) return;
  const incl = importState.rows.filter(r => r.include && importCanInclude(r));
  if (!incl.length) return;
  const cnt = new Map();
  for (const r of incl) cnt.set(r.chosenId, (cnt.get(r.chosenId) || 0) + 1);
  const extra = [...cnt.values()].reduce((s, c) => s + (c - 1), 0);
  const total = incl.reduce((s, r) => s + r.amount_kop, 0);
  const meta = IMPORT_KIND_META[importState.kind];
  const bigList = incl.filter(r => r.amount_kop > MONEY_BIG_KOP);
  const warns = [];
  if (extra) warns.push(`Один и тот же человек в списке несколько раз (${extra} ${extra === 1 ? 'лишняя строка' : 'лишних строк'}) — база запишет ТОЛЬКО ПЕРВУЮ, остальные пропустит как дубль. Если суммы разные и нужны обе — внесите вторую вручную в «Расчёте».`);
  const sibN = incl.filter(r => importState.sibling?.has(r.chosenId)).length;
  if (sibN) warns.push(`У ${sibN} чел. за этот месяц уже внесено «${IMPORT_KIND_META[importState.siblingKind].label}». Если это тот же документ — отпускные удвоятся, и сверка (Δ) этого НЕ покажет: обе графы в неё не входят.`);
  if (bigList.length) warns.push('Крупные суммы: ' + bigList.slice(0, 6).map(r => {
    const e = employees.find(x => x.id === r.chosenId); return `${e ? e.fio.split(' ')[0] : '?'} ${rub(r.amount_kop)} ₽`;
  }).join(', ') + (bigList.length > 6 ? '…' : '') + ' — проверьте, не опечатка ли.');
  if (!(await confirmImportLoad(meta.label, importState.period, incl.length, total, warns.join('\n')))) return;
  importState.loading = true;
  try {
    renderImportPreview();
    await importLoadExisting();
    const send = incl.filter(r => r.include && importCanInclude(r));
    if (!send.length) {
      importState.loading = false; renderImportPreview();
      toast('Все выбранные строки уже внесены', true);
      return;
    }
    const items = send.map(r => ({ employee_id: r.chosenId, amount_kop: r.amount_kop }));
    const res = await store.importMoneyBatch(importState.period, importState.kind, items, importState.fileName);
    const ins = res.inserted_count ?? (res.inserted ? res.inserted.length : 0);
    const insSum = (res.inserted || []).reduce((s, x) => s + (x.amount_kop || 0), 0);
    const skipped = res.skipped_count ?? 0;
    const unmatched = (res.unmatched || []).length;
    let msg = `Загружено ${ins} · ${rub(insSum)} ₽`;
    if (skipped) msg += ` · пропущено (уже внесено): ${skipped}`;
    if (unmatched) msg += ` · не сопоставлено: ${unmatched}`;
    toast(msg, unmatched > 0);
    const doneIds = new Set([...(res.inserted || []), ...(res.skipped || [])].map(x => x.employee_id));
    importState.rows = importState.rows.filter(r => !(doneIds.has(r.chosenId) && r.include));
    importState.parsed = importState.rows.length > 0;
    importState.loading = false;
    await importLoadExisting();
    renderImport();
  } catch (e) {
    importState.loading = false;
    renderImportPreview();
    toast(e.message || 'Не удалось загрузить', true);
  }
}
function collectLines(box) {
  const out = [];
  for (const blk of box.querySelectorAll('.lineblk')) {
    const keep = blk.getAttribute('data-keep');
    if (keep) {
      const t = blk.querySelector('.lb-type button.on');
      out.push({ _keep: +keep, line_type: t && t.textContent.trim() === 'Основной' ? 'основной' : 'совместитель' });
      continue;
    }
    const line_type = blk.querySelector('.lb-type button.on').textContent.trim() === 'Основной' ? 'основной' : 'совместитель';
    const pay_kind = blk.querySelector('.lb-pay').value;
    const val = (sel, o) => { const el = blk.querySelector(sel); return el ? parseNum(el.value, o) : null; };
    const l = { line_type, pay_kind, amount: val('.lb-amount', { thousands: true, field: 'ставку', max: RATE_ABSURD }), amount_night: val('.lb-night', { thousands: true, field: 'ночную ставку', max: RATE_ABSURD }), percent: val('.lb-percent', { field: 'процент' }) };
    checkRate(l);
    out.push(l);
  }
  if (!out.length) throw new Error('Нужна хотя бы одна строка начисления');
  if (out.filter(l => l.line_type === 'основной').length > 1) throw new Error('Основная строка может быть только одна — лишние сделайте «Совместитель»');
  return out;
}
function toggleArchive(e) {
  const toArch = e.status === 'active';
  showModal2(`<h3>${toArch ? 'В архив' : 'Вернуть из архива'}?</h3>
    <div class="msub">${esc(e.fio)}</div>
    <div class="rc-warn">${toArch
      ? 'Уйдёт из списка сотрудников и из «Расчёта» — ему перестанет что-либо начисляться. История сохранится, можно вернуть.'
      : 'Снова станет активным и попадёт в расчёт.'}</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="arNo">Отмена</button><button class="btn btn-primary btn-sm" id="arYes">${toArch ? 'В архив' : 'Вернуть'}</button></div>`);
  $('arNo').onclick = closeModal2;
  $('arYes').onclick = async () => {
    const b = $('arYes'); if (b.disabled) return; b.disabled = true;
    try {
      await store.updateEmployee(e.id, { status: toArch ? 'archived' : 'active' });
      closeModal2(); await refresh();
      toast(ICONS.check + (toArch ? 'В архиве' : 'Возвращён'));
      toArch ? go('employees') : openCard(e.id);
    } catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
}
function employeeForm(e) {
  setEditing(e ? 'card:' + e.id : 'card:new');
  const so = specialties.map(s => `<option value="${s.id}" ${e?.specialty_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const so2 = `<option value="">— нет —</option>` +
    specialties.map(s => `<option value="${s.id}" ${e?.specialty_id_2 === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  showModal(`<h3>${e ? 'Редактировать карточку' : 'Новая карточка'}</h3><div class="msub">${ICONS.lock} ФИО, телефон и ставки заводит владелец — изменения попадут в журнал</div>
    <label class="flbl">ФИО</label><input class="input" id="mFio" value="${esc(e?.fio || '')}" placeholder="Фамилия Имя Отчество">
    <div class="frow"><div><label class="flbl">Специальность</label>
      <div class="sp-pick"><select class="input" id="mSpec">${so}</select>
        <button class="btn btn-ghost btn-sm" id="mSpecNew" type="button" title="Завести новую специальность">${ICONS.plus}</button></div></div>
    <div><label class="flbl">Должность</label><input class="input" id="mPos" value="${esc(e?.position === FIO_SENTINEL ? '' : (e?.position || ''))}" placeholder="напр. Заведующий"></div></div>
    <!-- Отделение — на человеке, а не на специальности (миграция 123). Иначе
         психиатра-основного и психиатра-совместителя было бы не развести: у них
         одна специальность на двоих. Меняют владелец и директор — это они и
         распределяют людей; остальным поле видно, но заперто. -->
    <label class="flbl">Отделение</label>
    <select class="input" id="mDept"${canPickDept() ? '' : ' disabled'}>
      <option value="">— не указано —</option>
      ${deptsFlat(false).map(c => `<option value="${esc(c)}"${e?.dept === c ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}
    </select>
    <div class="msub" style="margin-top:-4px">${canPickDept()
      ? 'По отделению группируются график, ведомость и отпуска, и к нему привязано правило нормы часов. Смена отделения попадёт в журнал.'
      : 'Отделение меняют владелец и директор.'}</div>
    <!-- Милена 06.08: «Бухгалтер записан врачом. Я полезла редактировать, а там нет
         возможности добавить название». Справочник правился ТОЛЬКО на отдельном
         экране «Отделения» — то есть посреди правки карточки надо было уйти,
         завести, вернуться и начать заново. Заводим прямо здесь, без вложенного
         окна: модалка тут уже открыта, вторая поверх неё стёрла бы первую. -->
    <div class="sp-new" id="mSpecNewBox" hidden>
      <input class="input" id="mSpecName" placeholder="название, напр. Бухгалтер">
      <select class="input" id="mSpecCat">${deptsFlat(false).map(c => `<option value="${esc(c)}"${c === 'Прочие' ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select>
      <button class="btn btn-primary btn-sm" id="mSpecAdd" type="button">Добавить</button>
    </div>
    <label class="flbl">Вторая работа</label><select class="input" id="mSpec2">${so2}</select>
    <div class="msub" style="margin-top:-4px">Заполните, если человек работает у нас на ДВУХ работах — дежурит по ночам или совмещает вторую должность. В «Графике» появится вторая строка: свои смены, свои часы, отдельная оплата по ставке-совместителю.</div>
    <label class="flbl">Телефон (для СМС)</label><input class="input" id="mPhone" type="tel" inputmode="tel" value="${esc(fmtPhone(e?.phone) || '')}" placeholder="+7 921 554-12-31">
    <div class="frow"><div><label class="flbl">Принят</label><input class="input" id="mHired" type="date" value="${esc(e?.hired_on || '')}"></div>
    <div><label class="flbl">Уволен</label><input class="input" id="mLeft" type="date" value="${esc(e?.left_on || '')}"></div></div>
    <div class="msub" style="margin-top:-4px">Даты нужны, чтобы точно видеть неполный месяц. На расчёт оклада пока не влияют.</div>
    <label class="flbl">Строки начисления</label><div id="mLines"></div>
    <button class="btn btn-ghost btn-sm" id="mAddLine">${ICONS.plus}Ещё строка</button>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button><button class="btn btn-primary btn-sm" id="mSave">${ICONS.check}${e ? 'Сохранить' : 'Создать карточку'}</button></div>`);
  $('modalBox').dataset.guard = '1';
  const box = $('mLines');
  const init = e ? activeLines(e) : [null];
  (init.length ? init : [null]).forEach(l => { box.insertAdjacentHTML('beforeend', lineBlockHtml(l)); wireLineBlock(box.lastElementChild, l); });
  $('mAddLine').onclick = () => { box.insertAdjacentHTML('beforeend', lineBlockHtml(null)); wireLineBlock(box.lastElementChild, null); };
  $('mSpecNew').onclick = () => {
    const b = $('mSpecNewBox'); b.hidden = !b.hidden;
    if (!b.hidden) $('mSpecName').focus();
  };
  $('mSpecAdd').onclick = async () => {
    const btn = $('mSpecAdd'); if (btn.disabled) return;
    const name = $('mSpecName').value.trim();
    if (!name) { $('mSpecName').focus(); return; }
    btn.disabled = true;
    try {
      const sp = await store.addSpecialty(name, $('mSpecCat').value.trim() || 'Прочие');
      specialties.push(sp);
      for (const id of ['mSpec', 'mSpec2']) {
        const sel = $(id); if (!sel) continue;
        sel.insertAdjacentHTML('beforeend', `<option value="${sp.id}">${esc(sp.name)}</option>`);
      }
      $('mSpec').value = String(sp.id);
      $('mSpecNewBox').hidden = true; $('mSpecName').value = ''; $('mSpecCat').value = 'Прочие';
      fillCatSelects();
      toast(ICONS.check + 'Добавлено: ' + esc(name));
    } catch (err) { toast(err.message || err, true); }
    finally { btn.disabled = false; }
  };
  if (!e && canPickDept()) {
    $('mSpec').onchange = () => {
      const c = specCat(+$('mSpec').value);
      if (!$('mDept').value && deptOf.has(c)) $('mDept').value = c;
    };
  }
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return; btn.disabled = true;
    try {
      const fio = $('mFio').value.trim(); if (!fio) { $('mFio').focus(); btn.disabled = false; return; }
      const phoneRaw = $('mPhone').value.trim(), phoneNorm = normPhone(phoneRaw);
      if (phoneRaw && !PHONE_OK.test(phoneNorm)) {
        $('mPhone').focus(); btn.disabled = false;
        toast('Телефон: нужен российский мобильный, например +7 921 554-12-31', true); return;
      }
      if (phoneRaw.replace(/[^0-9]/g, '').length === 10 && !(await confirmPhone(phoneNorm))) { btn.disabled = false; return; }
      const hired_on = $('mHired').value || null, left_on = $('mLeft').value || null;
      if (hired_on && left_on && left_on < hired_on) {
        $('mLeft').focus(); btn.disabled = false;
        toast('Дата увольнения не может быть раньше даты приёма', true); return;
      }
      const patch = { fio, position: $('mPos').value.trim(), phone: phoneNorm || null,
        specialty_id: +$('mSpec').value || null, specialty_id_2: +$('mSpec2').value || null, hired_on, left_on };
      const deptSel = $('mDept');
      if (!e?.dept || [...deptSel.options].some(o => o.value === e.dept)) {
        patch.dept = deptSel.value || null;
      }
      const lines = collectLines(box);
      const big = bigAmounts(lines);
      if (big.length && !(await confirmBigAmounts(big))) { btn.disabled = false; return; }
      const fresh = (lines || []).filter(l => !l._keep);
      const removed = e ? activeLines(e).length - (lines || []).filter(l => l._keep).length : 0;
      const ratesTouched = fresh.length > 0 || removed > 0;
      let vfrom = null;
      if (ratesTouched) {
        vfrom = await rateStartDialog(fresh, removed);
        if (!vfrom) { btn.disabled = false; return; }
      }
      if (e) { await store.updateEmployee(e.id, patch, ratesTouched ? lines : null, vfrom); toast(ICONS.check + 'Карточка обновлена — изменения в журнале'); }
      else { await store.createEmployee({ ...patch, lines, valid_from: vfrom }); toast(ICONS.check + 'Карточка создана: ' + esc(fio.split(' ')[0])); }
      closeModal(); await refresh(); if (e) openCard(e.id);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
function canEditSpecs() { return ['owner', 'ceo'].includes(store.me()?.role); }
function canPickDept() { return ['owner', 'ceo'].includes(store.me()?.role); }
function canEditCarry() { return ['owner', 'ceo'].includes(store.me()?.role); }
let depts = [];
let catOrder = new Map();
let deptOf = new Map();
function setDepts(rows) {
  depts = [...(rows || [])].sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999)
    || String(a.category).localeCompare(String(b.category), 'ru'));
  catOrder = new Map(depts.map(r => [r.category, r.sort]));
  deptOf = new Map(depts.map(r => [r.category, r]));
}
function deptParent(c) { return deptOf.get(c)?.parent || null; }
function deptKids(c) { return depts.filter(r => r.parent === c).map(r => r.category); }
function catSort(c) { return catOrder.has(c) ? catOrder.get(c) : 9999; }
function catsOrdered(list) {
  return [...new Set(list)].sort((a, b) => catSort(a) - catSort(b) || a.localeCompare(b, 'ru'));
}
const catLabel = c => deptParent(c) ? deptParent(c) + ' · ' + c : c;
function deptsFlat(withEmpty = true) {
  const out = [];
  for (const r of depts) {
    if (r.parent) continue;
    out.push(r.category);
    for (const k of deptKids(r.category)) out.push(k);
  }
  const add = c => { if (c && !out.includes(c)) out.push(c); };
  for (const e of employees) add(e?.dept);
  for (const s of specialties) add(s?.category);
  if (withEmpty) add(NO_DEPT);
  return out;
}
function renderSpecs() {
  const ed = canEditSpecs();
  const cats = deptsFlat(false);
  const cnt = id => employees.filter(e => e.status !== 'archived' && e.specialty_id === id).length;
  const people = c => employees.filter(e => e.status !== 'archived' && empCat(e) === c).length;
  const arrow = (dir, kind, key, off) => `<button class="sp-mv" data-mv="${kind}" data-key="${esc(String(key))}" data-d="${dir}"${off ? ' disabled' : ''} title="${dir < 0 ? 'Выше' : 'Ниже'}" type="button">${dir < 0 ? '↑' : '↓'}</button>`;
  $('specList').innerHTML = cats.map(c => {
    const sibs = depts.filter(r => (r.parent || null) === deptParent(c)).map(r => r.category);
    const si = sibs.indexOf(c);
    const kids = deptKids(c);
    const mySpecs = specialties.filter(s => s.category === c)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, 'ru'));
    const n = people(c);
    return `<div class="sp-cat${deptParent(c) ? ' sp-sub' : ''}">
        <span class="sp-cat-name${ed ? ' sp-cat-tap' : ''}"${ed ? ` data-cat="${esc(c)}" title="Переименовать отделение"` : ''}>${esc(c)}${ed ? ` <span class="me-pen">${ICONS.pencil || '✎'}</span>` : ''}</span>
        <span class="muted small">${n ? n + ' чел' : (kids.length ? kids.length + ' ' + plural(kids.length, 'блок', 'блока', 'блоков') : '—')}</span>
        ${ed ? `<span class="sp-mvs">${arrow(-1, 'cat', c, si <= 0)}${arrow(1, 'cat', c, si === sibs.length - 1)}</span>` : ''}
      </div>` +
      mySpecs.map((s, i) => `<div class="line-row sp-row${ed ? ' sp-tap' : ''}"${ed ? ` data-spec="${s.id}" title="Переименовать или перенести в другое отделение"` : ''}>
        <div class="sp-name">${esc(s.name)}</div>
        ${cnt(s.id) ? `<span class="muted small sp-cnt">${cnt(s.id)} чел</span>` : ''}
        ${ed ? `<span class="me-pen sp-pen">${ICONS.pencil || '✎'}</span>
        <span class="sp-mvs">${arrow(-1, 'spec', s.id, i === 0)}${arrow(1, 'spec', s.id, i === mySpecs.length - 1)}</span>` : ''}</div>`).join('');
  }).join('') || '<div class="empty">Справочник пуст</div>';
  applyIcons($('specList'));
  if (!ed) return;
  $('specList').querySelectorAll('.sp-tap[data-spec]').forEach(el => {
    el.onclick = () => specForm(specialties.find(s => s.id === +el.dataset.spec));
  });
  $('specList').querySelectorAll('.sp-cat-tap[data-cat]').forEach(el => {
    el.onclick = e => { e.stopPropagation(); catForm(el.dataset.cat); };
  });
  $('specList').querySelectorAll('.sp-mv').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    if (b.disabled) return;
    b.disabled = true;
    try { await moveSpec(b.dataset.mv, b.dataset.key, +b.dataset.d); }
    catch (err) { toast(err.message || err, true); b.disabled = false; }
  });
}
function catForm(cat) {
  const mySpecs = specialties.filter(s => s.category === cat);
  const nPeople = employees.filter(e => e.status !== 'archived' && empCat(e) === cat).length;
  const nKids = deptKids(cat).length;
  const others = deptsFlat(false).filter(c => c !== cat);
  showModal(`<h3>Отделение</h3>
    <div class="msub">Переедет вместе с новым названием всё, что на него ссылается:
      <b>${nPeople} чел</b>${nKids ? `, ${nKids} ${plural(nKids, 'блок', 'блока', 'блоков')} внутри` : ''}, норма часов и суммы за смену.
      ${mySpecs.length ? 'Специальности справочника (' + mySpecs.length + '): ' + mySpecs.map(s => esc(s.name)).join(', ') : 'Своих специальностей в справочнике нет.'}</div>
    <label class="flbl">Название</label><input class="input" id="mCn" value="${esc(cat)}">
    <div class="msub" id="mCnWarn" style="margin-top:8px"></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="mSave">${ICONS.check}Сохранить</button></div>`);
  const inp = $('mCn');
  const warn = () => {
    const v = inp.value.trim();
    const box = $('mCnWarn');
    if (v && v === NO_DEPT) {
      box.innerHTML = `<div class="rc-warn">${ICONS.lock} «${esc(NO_DEPT)}» — служебное название, так отделение назвать нельзя.</div>`;
    } else if (v && others.includes(v)) {
      box.innerHTML = `<div class="rc-warn">${ICONS.lock} Отделение <b>${esc(v)}</b> уже есть — они <b>объединятся</b> в одно.</div>`;
    } else if (v && others.some(c => c.toLowerCase() === v.toLowerCase())) {
      box.innerHTML = `<div class="rc-warn">${ICONS.lock} Уже есть отделение <b>${esc(others.find(c => c.toLowerCase() === v.toLowerCase()))}</b> — отличается только регистром. Появится <b>второе</b>, на экране их будет не различить.</div>`;
    } else box.innerHTML = '';
  };
  inp.oninput = warn; warn();
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const v = inp.value.trim(); if (!v) { inp.focus(); return; }
    if (v === cat) { closeModal(); return; }
    if (v === NO_DEPT) { inp.focus(); warn(); return; }
    btn.disabled = true;
    try { const n = await store.renameCategory(cat, v); closeModal(); toast(ICONS.check + `Отделение «${esc(v)}» · ${n} чел`); await refresh(); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
async function moveSpec(kind, key, dir) {
  const moved = (arr, i) => {
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return null;
    const out = arr.slice(); [out[i], out[j]] = [out[j], out[i]]; return out;
  };
  if (kind === 'cat') {
    const parent = deptParent(key);
    const sibs = depts.filter(r => (r.parent || null) === parent).map(r => r.category);
    const out = moved(sibs, sibs.indexOf(key));
    if (!out) return;
    const tops = parent === null ? out : depts.filter(r => !r.parent).map(r => r.category);
    const order = [];
    for (const g of tops) {
      order.push(g);
      for (const k of (parent === g ? out : deptKids(g))) order.push(k);
    }
    await store.setCategoryOrder(order.map((c, i) => ({ category: c, sort: (i + 1) * 10, parent: deptParent(c) })));
  } else {
    const s = specialties.find(x => x.id === +key);
    if (!s) return;
    const mySpecs = specialties.filter(x => x.category === s.category)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, 'ru'));
    const out = moved(mySpecs, mySpecs.indexOf(s));
    if (!out) return;
    await store.setSpecialtySort(out.map((x, i) => ({ id: x.id, sort: i })));
  }
  await refresh();
}
function deptForm() {
  const tops = depts.filter(r => !r.parent && r.category !== 'Прочие').map(r => r.category);
  showModal(`<h3>Новое отделение</h3>
    <div class="msub">Отделение верхнего уровня — или блок внутри уже существующего, как «Совместители» внутри «Врачей».</div>
    <label class="flbl">Название</label><input class="input" id="mDn" placeholder="напр. Дежуранты" maxlength="60">
    <label class="flbl">Внутри какого отделения</label>
    <select class="input" id="mDp"><option value="">— само по себе, верхний уровень —</option>
      ${tops.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
    <div class="msub" id="mDnWarn" style="margin-top:8px"></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="mSave">${ICONS.plus}Добавить</button></div>`);
  const inp = $('mDn');
  const warn = () => {
    const v = inp.value.trim();
    $('mDnWarn').innerHTML = (v && deptOf.has(v))
      ? `<div class="rc-warn">${ICONS.lock} Отделение <b>${esc(v)}</b> уже есть.</div>` : '';
  };
  inp.oninput = warn;
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const v = inp.value.trim(); if (!v) { inp.focus(); return; }
    if (deptOf.has(v)) { inp.focus(); warn(); return; }
    if (v === NO_DEPT) { inp.focus(); $('mDnWarn').innerHTML = `<div class="rc-warn">${ICONS.lock} «${esc(NO_DEPT)}» — служебное название, так отделение назвать нельзя.</div>`; return; }
    btn.disabled = true;
    try {
      const parent = $('mDp').value || null;
      const order = [];
      for (const g of depts.filter(r => !r.parent).map(r => r.category)) {
        order.push(g);
        for (const k of deptKids(g)) order.push(k);
        if (parent === g) order.push(v);
      }
      if (!parent) order.push(v);
      await store.setCategoryOrder(order.map((c, i) => ({ category: c, sort: (i + 1) * 10, parent: c === v ? parent : deptParent(c) })));
      closeModal(); toast(ICONS.check + 'Отделение добавлено: ' + esc(v)); await refresh();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
function specForm(s) {
  const cats = deptsFlat(false);
  const used = s ? employees.filter(e => e.status !== 'archived' && e.specialty_id === s.id).length : 0;
  showModal(`<h3>${s ? 'Специальность' : 'Новая специальность'}</h3>
    <div class="msub">${s ? 'Название и отделение поменяются у всех, кому она стоит' + (used ? ` — сейчас это ${used} чел` : '') + '. Изменение попадёт в журнал.'
                        : 'Добавится в справочник и группировку'}</div>
    <label class="flbl">Название</label><input class="input" id="mSn" placeholder="напр. Невролог" value="${esc(s?.name || '')}">
    <!-- Отделение выбираем из справочника, а не вписываем от руки. Раньше поле
         было текстовым, и опечатка молча заводила новое отделение-двойник. Теперь
         отделение — строка справочника, на которую ссылаются люди и правила; новые
         заводят там же, на экране «Отделения». -->
    <label class="flbl">Отделение специальности</label>
    <select class="input" id="mSc">${cats.map(c => `<option value="${esc(c)}"${(s?.category || 'Прочие') === c ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select>
    <div class="msub" style="margin-top:-4px">Это только группировка справочника. Отделение самого человека стоит в его карточке — у одной специальности люди могут быть в разных отделениях.</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button><button class="btn btn-primary btn-sm" id="mSave">${s ? ICONS.check + 'Сохранить' : ICONS.plus + 'Добавить'}</button></div>`);
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const n = $('mSn').value.trim(); if (!n) { $('mSn').focus(); return; }
    const c = $('mSc').value.trim() || 'Прочие';
    if (s && n === s.name && c === s.category) { closeModal(); return; }
    btn.disabled = true;
    try {
      if (s) { await store.updateSpecialty(s.id, n, c); toast(ICONS.check + 'Сохранено: ' + esc(n)); }
      else   { await store.addSpecialty(n, c);          toast(ICONS.check + 'Добавлено: ' + esc(n)); }
      closeModal(); refresh();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
let curPeriod = null, schedShown = null, scheduleRows = [], shiftKinds = [], schedSeq = 0;
const mskNow = () => new Date(Date.now() + 3 * 3600e3);
const mskTodayISO = () => mskNow().toISOString().slice(0, 10);
const nowPeriod = () => { const n = mskNow(); return n.getUTCFullYear() + '-' + String(n.getUTCMonth() + 1).padStart(2, '0'); };
const FIRST_PERIOD = '2026-07';
const clampPeriod = p => (p && p < FIRST_PERIOD) ? FIRST_PERIOD : p;
function paintMonthNav() {
  for (const [prevId, get] of [['mPrev', () => curPeriod], ['pPrev', () => payPeriod],
                               ['oPrev', () => ovPeriod], ['gPrev', () => gapsPeriod],
                               ['qPrev', () => patPeriod], ['cpPrev', () => payPeriod]]) {
    const b = $(prevId); if (!b) continue;
    const at = (get() || nowPeriod()) <= FIRST_PERIOD;
    b.disabled = at;
    b.title = at ? 'Раньше июля 2026 учёт не вёлся' : 'Пред. месяц';
  }
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
const dm = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '')); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : String(d || ''); };
const periodLabel = p => { const [y, m] = p.split('-').map(Number); return MONTHS_RU[m] + ' ' + y; };
function monthPicker(btn, pop, initial, onPick) {
  let cur = initial, year = +initial.split('-')[0];
  const close = () => { pop.hidden = true; document.removeEventListener('click', away, true); };
  const away = e => { if (!pop.contains(e.target) && e.target !== btn) close(); };
  const draw = () => {
    pop.innerHTML = `<div class="mp-year">
        <button class="mn-btn" type="button" data-y="-1" aria-label="Год назад">‹</button>
        <b>${year}</b>
        <button class="mn-btn" type="button" data-y="1" aria-label="Год вперёд">›</button>
      </div>
      <div class="mp-grid">${MONTHS_RU.slice(1).map((n, i) => {
        const per = year + '-' + String(i + 1).padStart(2, '0');
        return `<button class="mp-m${per === cur ? ' on' : ''}" type="button" data-p="${per}">${esc(n)}</button>`;
      }).join('')}</div>`;
    pop.querySelectorAll('[data-y]').forEach(b => b.onclick = () => { year += +b.dataset.y; draw(); });
    pop.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cur = b.dataset.p; close(); onPick(cur); });
  };
  btn.onclick = () => {
    if (!pop.hidden) return close();
    year = +cur.split('-')[0];
    draw(); pop.hidden = false;
    document.addEventListener('click', away, true);
  };
}
const daysInMonth = p => { const [y, m] = p.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const nextPeriodStart = p => { let [y, m] = p.split('-').map(Number); if (++m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0') + '-01'; };
const prevPeriodOf = p => { let [y, m] = p.split('-').map(Number); if (--m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
const cellDate = day => curPeriod + '-' + String(day).padStart(2, '0');
const kindByHours = h => {
  const has = c => shiftKinds.some(k => k.code === c);
  if (h != null && h >= 20 && has('day24')) return 'day24';
  if (h != null && h >= 11 && has('day12')) return 'day12';
  return has('day') ? 'day' : (shiftKinds.find(k => !isRest(k.code) && k.code !== 'custom')?.code || null);
};
const cellOf = (empId, day, pos = 'main') => scheduleRows.find(s => s.employee_id === empId && s.work_date === cellDate(day) && (s.position || 'main') === pos);
const RF_HOLIDAYS = {
  '01-01': 'Новый год', '01-02': 'Новогодние каникулы', '01-03': 'Новогодние каникулы',
  '01-04': 'Новогодние каникулы', '01-05': 'Новогодние каникулы', '01-06': 'Новогодние каникулы',
  '01-07': 'Рождество Христово', '01-08': 'Новогодние каникулы',
  '02-23': 'День защитника Отечества', '03-08': 'Международный женский день',
  '05-01': 'Праздник Весны и Труда', '05-09': 'День Победы',
  '06-12': 'День России', '11-04': 'День народного единства',
};
function dayMark(day) {
  const [y, m] = curPeriod.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return { weekend: wd === 0 || wd === 6, hol: RF_HOLIDAYS[curPeriod.slice(5) + '-' + String(day).padStart(2, '0')] || '' };
}
let payPeriod = null;
function shiftPayMonth(delta) { let [y, m] = payPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } payPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = payPeriod; syncHash(false); }
function shiftMonth(delta) { let [y, m] = curPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } curPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = curPeriod; syncHash(false); renderSchedule(); }
const SHORT_KIND = { 'отпуск': 'Отп', 'отпуск_бз': 'Б/с', off: 'В', absent: '—' };
const kindsFor = (e, cur) => shiftKinds.filter(k => !k.dept || k.dept === empCat(e) || k.code === cur);
const REST_KINDS = ['off', 'absent', 'отпуск', 'отпуск_бз'];
const VAC_KINDS = ['отпуск', 'отпуск_бз'];
const isVac = k => VAC_KINDS.includes(k);
const isRest = k => REST_KINDS.includes(k);
const MONTHS_GEN = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const monthGenitive = period => MONTHS_GEN[+String(period || '').slice(5, 7)] || '';
function cellText(c) {
  if (!c || !c.plan_kind) return '';
  const k = shiftKinds.find(x => x.code === c.plan_kind), short = k ? (k.short || k.label) : c.plan_kind;
  if (isRest(c.plan_kind)) return SHORT_KIND[c.plan_kind] || short;
  const hh = t => t ? String(t).slice(0, 5).replace(/:00$/, '').replace(/^0(\d)/, '$1') : '';
  const s = hh(c.plan_start), e = hh(c.plan_end);
  if (s && e) return s + '–' + e;
  return s || short;
}
const fmtH = n => (Math.round(n * 10) / 10) + 'ч';
function planHoursOf(c) {
  if (!c || !c.plan_kind || isRest(c.plan_kind)) return 0;
  if (c.plan_start && c.plan_end) {
    const t = x => { const [h, m] = String(x).split(':').map(Number); return h + (m || 0) / 60; };
    let d = t(c.plan_end) - t(c.plan_start); if (d <= 0) d += 24; return d;
  }
  const k = shiftKinds.find(x => x.code === c.plan_kind); return k && k.hours ? +k.hours : 0;
}
function factHoursOf(c) {
  if (!c) return 0;
  const fx = c.fact ?? null;
  if (fx === 'x') return 0;
  if (c.fact_start && c.fact_end) {
    const m = t => +String(t).slice(0, 2) * 60 + +String(t).slice(3, 5);
    return (((m(c.fact_end) - m(c.fact_start)) + 1440) % 1440) / 60;
  }
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx))) return parseFloat(fx);
  return planHoursOf(c);
}
function pastDay(day) {
  const np = nowPeriod();
  if (curPeriod < np) return true;
  if (curPeriod > np) return false;
  return day < mskNow().getUTCDate();
}
function factClass(c) {
  const p = c && c.plan_kind, fx = c ? (c.fact ?? null) : null;
  if (fx === 'x') return ' f-miss';
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx)))
    return Math.abs(parseFloat(fx) - planHoursOf(c)) > 0.05 ? ' f-dev' : ' f-ok';
  if (p && !isRest(p)) return ' f-plan';
  return ' f-rest';
}
const SAN_AMOUNTS = [230000, 320000, 370000, 450000, 505000];
function isAmountCell(e, pos) {
  if (!e) return false;
  const san = id => /санитар/i.test(specName(id));
  if (pos === 'second') return san(e.specialty_id_2);
  if (!san(e.specialty_id)) return false;
  return !activeLines(e).some(l => l.pay_kind === 'оклад');
}
const rubShort = kop => (kop / 100).toLocaleString('ru-RU');
function paintAmountCell(empId, day, pos, kop) {
  const sel = `.gr-cell[data-emp="${empId}"][data-day="${day}"]` +
    (pos === 'second' ? '[data-pos="second"]' : ':not([data-pos="second"])');
  const el = document.querySelector(sel);
  if (!el) return;
  el.innerHTML = schedCellInner({ ...(cellOf(empId, day, pos) || {}), amount_kop: kop || null },
                                pastDay(day), pos);
}
function cacheCell(empId, date, pos, row) {
  const i = (scheduleRows || []).findIndex(s => s.employee_id === empId
    && s.work_date === date && (s.position || 'main') === (pos || 'main'));
  if (!row) { if (i >= 0) scheduleRows.splice(i, 1); return; }
  if (i >= 0) scheduleRows[i] = { ...scheduleRows[i], ...row };
  else scheduleRows.push({ position: 'main', ...row });
}
function cacheAmount(empId, day, pos, kop) {
  const d = cellDate(day);
  const i = (scheduleRows || []).findIndex(s => s.employee_id === empId
    && s.work_date === d && (s.position || 'main') === pos);
  if (i >= 0) {
    const row = scheduleRows[i];
    if (kop == null && !row.plan_kind && (row.fact ?? null) === null) scheduleRows.splice(i, 1);
    else scheduleRows[i] = { ...row, amount_kop: kop };
  } else if (kop != null) {
    scheduleRows.push({ employee_id: empId, work_date: d, position: pos, amount_kop: kop, plan_kind: null, fact: null });
  }
}
function amountTotals(empId, pos) {
  let cnt = 0, kop = 0;
  for (const r of scheduleRows || []) {
    if (r.employee_id !== empId || (r.position || 'main') !== pos) continue;
    if (!r.amount_kop || String(r.work_date).slice(0, 7) !== curPeriod) continue;
    cnt++; kop += r.amount_kop;
  }
  return { cnt, kop };
}
function amountTail(empId, pos) {
  const t = amountTotals(empId, pos);
  return `<div class="gr-sum s-cnt" data-tot="${empId}|${pos}|cnt">${t.cnt}</div>`
    + `<div class="gr-sum s-delta"></div>`
    + `<div class="gr-sum s-norm"><span class="muted">—</span></div>`
    + `<div class="gr-sum s-fact amt-tot" data-tot="${empId}|${pos}|kop" title="сумма за месяц">${t.cnt ? esc(rubShort(t.kop)) : '—'}</div>`;
}
function repaintAmountTotals(empId, pos) {
  const t = amountTotals(empId, pos);
  const c = document.querySelector(`[data-tot="${empId}|${pos}|cnt"]`);
  const k = document.querySelector(`[data-tot="${empId}|${pos}|kop"]`);
  if (c) c.textContent = t.cnt;
  if (k) k.textContent = t.cnt ? rubShort(t.kop) : '—';
}
async function cycleAmountCell(empId, day, pos) {
  const cur = (scheduleRows || []).find(s => s.employee_id === empId
    && s.work_date === cellDate(day) && (s.position || 'main') === pos);
  const was = cur?.amount_kop ?? null;
  const at = SAN_AMOUNTS.indexOf(was);
  const next = at < 0 ? SAN_AMOUNTS[0] : (at + 1 < SAN_AMOUNTS.length ? SAN_AMOUNTS[at + 1] : null);
  const bare = !cur || (!cur.plan_kind && (cur.fact ?? null) === null);
  const patch = next == null && bare
    ? { plan_kind: null, plan_start: null, fact: null, amount_kop: null }
    : { amount_kop: next };
  cacheAmount(empId, day, pos, next); paintAmountCell(empId, day, pos, next);
  repaintAmountTotals(empId, pos);
  try {
    await store.setScheduleCell(empId, cellDate(day), patch, pos);
  } catch (err) {
    cacheAmount(empId, day, pos, was); paintAmountCell(empId, day, pos, was);
    repaintAmountTotals(empId, pos);
    toast('Не сохранилось: ' + (err.message || err), true);
  }
}
function amountCellPopup(e, day, pos) {
  const cur = (scheduleRows || []).find(s => s.employee_id === e.id
    && s.work_date === cellDate(day) && (s.position || 'main') === pos);
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · оплата за смену`)}
    <label class="flbl">Сумма за смену</label>
    <input class="input" id="saVal" inputmode="numeric" autocomplete="off"
      value="${cur?.amount_kop ? rubShort(cur.amount_kop) : ''}" placeholder="напр. 3 200">
    <div class="msub" style="margin-top:8px">Ходовые: ${SAN_AMOUNTS.map(a =>
      `<button class="btn btn-ghost btn-sm sa-quick" data-kop="${a}">${rubShort(a)}</button>`).join(' ')}</div>
    <div class="msub" style="margin-top:8px">Часы у такой смены не считаются — платим ровно эту сумму.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="saNo">Отмена</button>
      ${cur?.amount_kop ? `<button class="btn btn-ghost btn-sm" id="saClear">Убрать</button>` : ''}
      <button class="btn btn-primary btn-sm" id="saOk">${ICONS.check}Сохранить</button></div>`);
  const bare = !cur || (!cur.plan_kind && (cur.fact ?? null) === null);
  const save = async kop => {
    const patch = kop == null && bare
      ? { plan_kind: null, plan_start: null, fact: null, amount_kop: null }
      : { amount_kop: kop };
    try { await store.setScheduleCell(e.id, cellDate(day), patch, pos);
      cacheAmount(e.id, day, pos, kop); paintAmountCell(e.id, day, pos, kop);
      repaintAmountTotals(e.id, pos);
      closeModal(); }
    catch (err) { toast(err.message || err, true); }
  };
  $('saNo').onclick = closeModal;
  document.querySelectorAll('.sa-quick').forEach(b => b.onclick = () => save(+b.dataset.kop));
  if (cur?.amount_kop) $('saClear').onclick = () => save(null);
  $('saVal').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('saOk').click(); } };
  $('saOk').onclick = () => {
    let v;
    try { v = parseNum($('saVal').value, { thousands: true, field: 'сумму', max: 100000 }); }
    catch (err) { toast(err.message || err, true); return; }
    if (!v) { toast('Укажите сумму', true); return; }
    save(Math.round(v * 100));
  };
}
const SECOND_LETTER = { night12: 'Н', day24: 'С', absent: '—' };
const KIND_TO_RATE = { day24: 'сутки', day12: '12ч', night12: '12ч', day: 'оклад', custom: 'почасово' };
const RATE_NOMINALS = [12, 24];
function kindMismatch(c) {
  if (!c || !c.plan_kind || isRest(c.plan_kind)) return false;
  if (!['сутки', '12ч'].includes(KIND_TO_RATE[c.plan_kind])) return false;
  if (!(c.plan_start && c.plan_end)) return false;
  const k = shiftKinds.find(x => x.code === c.plan_kind);
  const nom = k && k.hours != null ? +k.hours : null;
  const h = planHoursOf(c);
  if (!nom || !h) return false;
  const best = RATE_NOMINALS.reduce((a, x) => Math.abs(h - x) < Math.abs(h - a) ? x : a);
  return Math.abs(h - nom) > Math.abs(h - best) + 0.05;
}
function kindByTime(st, en) {
  const h = planHoursOf({ plan_kind: 'day', plan_start: st, plan_end: en });
  const noch = String(en) <= String(st);
  const est = c => shiftKinds.some(k => k.code === c);
  if (h >= 20 && est('day24')) return 'day24';
  if (h >= 11 && noch && est('night12')) return 'night12';
  if (h >= 11 && est('day12')) return 'day12';
  return kindByHours(h);
}
function kindLine(c) {
  if (!c || !c.plan_kind || isRest(c.plan_kind)) return '';
  if (!(c.plan_start && c.plan_end)) return '';
  if (!['сутки', '12ч'].includes(KIND_TO_RATE[c.plan_kind])) return '';
  if (c.plan_kind === kindByTime(c.plan_start, c.plan_end)) return '';
  const k = shiftKinds.find(x => x.code === c.plan_kind);
  return `<span class="kv${kindMismatch(c) ? ' bad' : ''}">${esc(k ? (k.label || c.plan_kind) : c.plan_kind)}</span>`;
}
function schedCellInner(c, past, pos = 'main') {
  const p = c && c.plan_kind, fx = c ? (c.fact ?? null) : null;
  if (c && c.amount_kop) {
    const marked = past && fx !== null && fx !== '';
    if (fx === 'x') return `<span class="amt-v amt-miss">${esc(rubShort(c.amount_kop))}</span>${
      past ? '<span class="cell-pen" title="Изменить смену">✎</span>' : ''}`;
    return `<span class="amt-v${marked ? ' amt-ok' : ' amt-plan'}">${esc(rubShort(c.amount_kop))}</span>${
      past ? '<span class="cell-pen" title="Изменить смену">✎</span>' : ''}`;
  }
  if (!p && fx === null) {
    return past ? '<span class="cell-pen" title="Задать смену">\u270E</span>' : '';
  }
  if (pos === 'second') {
    const L = SECOND_LETTER[p] || (p ? cellText(c) : '');
    return `<span class="iv mini sec-l${p === 'absent' ? ' miss' : ''}">${esc(L)}</span>`;
  }
  const planTxt = cellText(c);
  const kv = kindLine(c);
  if (!past) return `<span class="iv mini">${esc(planTxt)}</span>${kv}`;
  const isWork = p && !isRest(p);
  const noPlan = !p;
  const chip = esc(p ? planTxt : 'вне гр.');
  const pen = '<span class="cell-pen" title="Изменить смену">\u270E</span>';
  if (fx === 'x') return `<span class="iv mini${noPlan ? ' nop' : ''}">${chip}</span><span class="fh miss">—</span>${kv}${pen}`;
  if (c && c.fact_start && c.fact_end) {
    const hh = t => String(t).slice(0, 5).replace(/:00$/, '').replace(/^0(\d)/, '$1');
    const fh = factHoursOf(c), dev = Math.abs(fh - planHoursOf(c)) > 0.05;
    return `<span class="iv mini${noPlan ? ' nop' : ''}">${chip}</span>`
      + `<span class="fh ${dev ? 'dev' : 'ok'}">${esc(hh(c.fact_start))}–${esc(hh(c.fact_end))}</span>${kv}`;
  }
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx))) {
    const n = parseFloat(fx), dev = Math.abs(n - planHoursOf(c)) > 0.05;
    return `<span class="iv mini${noPlan ? ' nop' : ''}">${chip}</span><span class="fh ${dev ? 'dev' : 'ok'}">${fmtH(n)}</span>${kv}${pen}`;
  }
  if (isWork) return `<span class="iv mini">${esc(planTxt)}</span><span class="fh ok">${fmtH(planHoursOf(c))}</span>${kv}${pen}`;
  return `<span class="iv mini faint">${esc(planTxt)}</span>`;
}
let closedDays = new Set();
let monthNorms = new Map();
let rulePresets = [], ruleNorms = [], rulesSeq = 0;
async function renderRules() {
  if (!isStaff()) { $('ruleNorms').innerHTML = ''; $('rulePresets').innerHTML = ''; return; }
  const seq = ++rulesSeq;
  $('ruleNorms').innerHTML = '<div class="empty">Загружаем…</div>';
  $('rulePresets').innerHTML = '';
  let p, n;
  try { [p, n] = await Promise.all([store.listShiftPresets(), store.listDeptRules()]); }
  catch (e) { if (seq === rulesSeq) $('ruleNorms').innerHTML = `<div class="empty">${esc(e.message || e)}</div>`; return; }
  if (seq !== rulesSeq) return;
  rulePresets = p || []; ruleNorms = n || [];
  drawRules();
}
const normLabel = r => r?.fixed_hours ? fmt(+r.fixed_hours) + ' ч в месяц'
  : r?.week_hours ? fmt(+r.week_hours) + '-часовая неделя' : '—';
function presetTerm(x) {
  if (!x.valid_from && !x.valid_to) return 'всегда';
  if (!x.valid_to) return 'с ' + dmy(x.valid_from);
  if (!x.valid_from) return 'по ' + dmy(x.valid_to);
  return dmy(x.valid_from) + ' — ' + dmy(x.valid_to);
}
const presetLive = x => !x.valid_to || x.valid_to >= (workPeriod || nowPeriod()) + '-01';
function drawRules() {
  const canEdit = isOwner() || store.me()?.role === 'ceo';
  const peopleIn = c => employees.filter(e => e.status === 'active' && empCat(e) === c).length;
  const cats = catsOrdered([
    ...deptsFlat(false).filter(c => !deptKids(c).length || peopleIn(c)),
    ...ruleNorms.map(r => r.category)]);
  const normRows = cats.map(c => {
    const r = ruleNorms.find(x => x.category === c);
    const people = peopleIn(c);
    return `<div class="rl-row${canEdit ? ' rl-tap' : ''}" data-norm="${esc(c)}">
      <span class="rl-name"><i class="cat-dot" style="background:${catColor(c)}"></i>${esc(catLabel(c))}
        <span class="muted small"> · ${people} чел</span></span>
      <b class="${r ? '' : 'muted'}">${esc(normLabel(r))}</b>
      ${canEdit ? '<span class="me-pen">\u270E</span>' : ''}</div>`;
  }).join('');
  $('ruleNorms').innerHTML = `<div class="me-cap">Норма часов по отделению</div>
    <div class="msub" style="margin-bottom:10px">На норму делится оклад: <b>оклад ÷ норма × отработанные часы</b>.
      Правило действует только там, где человеку не задано своё — личные настройки оно не трогает.</div>
    ${normRows || '<div class="empty">Отделений нет</div>'}`;
  const byCat = {};
  for (const x of rulePresets) (byCat[x.category || 'Всем'] ||= []).push(x);
  const presetBlocks = Object.keys(byCat).sort((a, b) => catSort(a) - catSort(b) || a.localeCompare(b, 'ru'))
    .map(c => `<div class="rl-cap">${esc(c)}</div>` + byCat[c].map(x => `
      <div class="rl-row${canEdit ? ' rl-tap' : ''}${presetLive(x) ? '' : ' rl-old'}" data-preset="${x.id}">
        <span class="rl-name">${esc(x.label)}<span class="muted small"> · ${esc(x.code)} · ${esc(presetTerm(x))}</span></span>
        <b class="money">${rub(x.amount_kop)} ₽</b>
        ${canEdit ? '<span class="me-pen">\u270E</span>' : ''}</div>`).join('')).join('');
  $('rulePresets').innerHTML = `<div class="me-cap">Суммы за смену</div>
    <div class="msub" style="margin-bottom:10px">Подставляются кликом по клетке графика тем, кому платят за выход, а не за часы.
      В клетке остаётся само число — правка варианта <b>не меняет</b> уже проставленные дни.</div>
    ${presetBlocks || '<div class="empty">Вариантов пока нет</div>'}
    ${canEdit ? '<div class="me-jump"><button class="btn btn-ghost btn-sm" id="rlAdd">+ Добавить вариант</button></div>' : ''}`;
  if (!canEdit) return;
  $('ruleNorms').querySelectorAll('[data-norm]').forEach(el => { el.onclick = () => deptNormDialog(el.dataset.norm); });
  $('rulePresets').querySelectorAll('[data-preset]').forEach(el => {
    el.onclick = () => presetDialog(rulePresets.find(x => x.id === +el.dataset.preset));
  });
  const add = $('rlAdd'); if (add) add.onclick = () => presetDialog(null);
}
async function deptNormDialog(cat) {
  const cur = ruleNorms.find(x => x.category === cat);
  const kind = cur?.fixed_hours ? 'fixed' : cur?.week_hours ? 'week' : '';
  const who = employees.filter(e => e.status === 'active' && empCat(e) === cat);
  const touched = who.filter(e => !e.week_hours).length;
  showModal(`<h3>Норма · ${esc(cat)}</h3>
    <div class="msub">${who.length} чел в отделении${touched < who.length
      ? ` · правило коснётся ${touched}, у остальных задано своё` : ''}</div>
    <label class="flbl" style="margin-top:12px">Как считать</label>
    <select class="input" id="nmKind">
      <option value=""${kind ? '' : ' selected'}>Правила нет — считать по личным настройкам</option>
      <option value="week"${kind === 'week' ? ' selected' : ''}>Тип недели — норму даёт производственный календарь</option>
      <option value="fixed"${kind === 'fixed' ? ' selected' : ''}>Жёстко часов в месяц</option>
    </select>
    <div id="nmValWrap" style="margin-top:10px"></div>
    <div class="msub" style="margin-top:10px">На норму делится оклад. Личные настройки людей это правило не переписывает —
      оно срабатывает только там, где у человека своего ничего не задано.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="nmNo">Отмена</button>
      <button class="btn btn-primary btn-sm" id="nmOk">${ICONS.check}Сохранить</button></div>`);
  const paint = () => {
    const k = $('nmKind').value;
    $('nmValWrap').innerHTML = !k ? ''
      : k === 'week'
        ? `<label class="flbl">Часов в неделю</label>
           <input class="input" id="nmVal" inputmode="decimal" autocomplete="off" value="${cur?.week_hours ? fmt(+cur.week_hours) : '40'}" placeholder="40 / 36 / 24">`
        : `<label class="flbl">Часов в месяц</label>
           <input class="input" id="nmVal" inputmode="decimal" autocomplete="off" value="${cur?.fixed_hours ? fmt(+cur.fixed_hours) : '180'}" placeholder="180">`;
  };
  paint(); $('nmKind').onchange = paint;
  $('nmNo').onclick = closeModal;
  $('nmOk').onclick = async () => {
    const k = $('nmKind').value;
    try {
      if (!k) { await store.deleteDeptRule(cat); }
      else {
        let v; try { v = parseNum($('nmVal').value, { field: 'норму' }); }
        catch (err) { toast(err.message, true); return; }
        if (!v || v <= 0 || v > (k === 'week' ? 80 : 400)) { toast('Проверьте число часов', true); return; }
        await store.saveDeptRule({ category: cat, week_hours: k === 'week' ? v : null, fixed_hours: k === 'fixed' ? v : null });
      }
      closeModal(); toast(ICONS.check + 'Сохранено'); await renderRules();
    } catch (e) { toast(e.message || e, true); }
  };
}
function presetDelConfirm(x) {
  return new Promise(resolve => {
    showModal2(`<h3>Убрать вариант?</h3>
      <div class="msub">${esc(x.label)} · ${rub(x.amount_kop)} ₽</div>
      <div class="msub" style="margin-top:8px">Уже проставленные в графике суммы <b>останутся</b> —
        в клетке лежит само число, а не ссылка на вариант. Пропадёт только подсказка при вводе.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="pdNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="pdYes">Убрать</button></div>`, () => resolve(false));
    $('pdNo').onclick = () => { resolve(false); closeModal2(); };
    $('pdYes').onclick = () => { resolve(true); closeModal2(); };
  });
}
async function presetDialog(x) {
  const cats = [...deptsFlat(false)];
  if (x?.category && !cats.includes(x.category)) cats.push(x.category);
  showModal(`<h3>${x ? 'Вариант оплаты' : 'Новый вариант'}</h3>
    ${x ? `<div class="msub">${esc(x.code)} · сейчас <b>${rub(x.amount_kop)} ₽</b> · ${esc(presetTerm(x))}</div>` : ''}
    <label class="flbl" style="margin-top:12px">Короткий код</label>
    <input class="input" id="psCode" autocomplete="off" maxlength="40" value="${esc(x?.code || '')}" placeholder="СанАм12">
    <label class="flbl" style="margin-top:10px">Название по-человечески</label>
    <input class="input" id="psLabel" autocomplete="off" maxlength="120" value="${esc(x?.label || '')}" placeholder="Санитарка амбулаторно, 12 ч">
    <label class="flbl" style="margin-top:10px">Сумма за смену, ₽</label>
    <input class="input" id="psAmt" inputmode="numeric" autocomplete="off" value="${x ? rub(x.amount_kop) : ''}" placeholder="3200">
    <label class="flbl" style="margin-top:10px">Отделение</label>
    <select class="input" id="psCat">
      <option value="">Предлагать всем</option>
      ${cats.map(c => `<option value="${esc(c)}"${x?.category === c ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}
    </select>
    <label class="flbl" style="margin-top:10px">Действует с (пусто — всегда)</label>
    <input class="input" id="psFrom" type="date" value="${x?.valid_from || ''}">
    <div class="msub" style="margin-top:8px">Если сумму меняют с какого-то месяца — поставьте дату, а прежний вариант
      оставьте: прошлые месяцы должны подсказывать своё число.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="psNo">Отмена</button>
      ${x && isOwner() ? '<button class="btn btn-ghost btn-sm" id="psDel">Удалить</button>' : ''}
      <button class="btn btn-primary btn-sm" id="psOk">${ICONS.check}Сохранить</button></div>`);
  $('psNo').onclick = closeModal;
  const del = $('psDel');
  if (del) del.onclick = async () => {
    if (!await presetDelConfirm(x)) return;
    try { await store.deleteShiftPreset(x.id); closeModal(); toast(ICONS.check + 'Убрано'); await renderRules(); }
    catch (e) { toast(e.message || e, true); }
  };
  $('psOk').onclick = async () => {
    const code = $('psCode').value.trim(), label = $('psLabel').value.trim();
    if (!code || !label) { toast('Заполните код и название', true); return; }
    let v; try { v = parseNum($('psAmt').value, { thousands: true, field: 'сумму' }); }
    catch (err) { toast(err.message, true); return; }
    if (!v || v <= 0 || v > 1000000) { toast('Проверьте сумму', true); return; }
    const row = { code, label, amount_kop: Math.round(v * 100),
      category: $('psCat').value || null, valid_from: $('psFrom').value || null };
    if (x) row.id = x.id;
    try { await store.saveShiftPreset(row); closeModal(); toast(ICONS.check + 'Сохранено'); await renderRules(); }
    catch (e) { toast(e.message || e, true); }
  };
}
async function renderSchedule() {
  if (!worksWithPayroll() || !$('scheduleGrid')) return;
  if (!curPeriod) curPeriod = nowPeriod();
  if (schedShown !== curPeriod) { $('scheduleGrid').innerHTML = '<div class="empty">Загружаем график…</div>'; if ($('mLabel')) $('mLabel').textContent = periodLabel(curPeriod); }
  const seq = ++schedSeq;
  try {
    const [rows, kinds, closed, norms] = await Promise.all([store.listSchedule(curPeriod), store.listShiftKinds(), store.listClosedDays(curPeriod),
      store.listMonthNorms(curPeriod).catch(e => { console.warn('listMonthNorms:', e); return []; })]);
    if (seq !== schedSeq) return;
    scheduleRows = rows; shiftKinds = kinds; closedDays = new Set(closed);
    monthNorms = new Map((norms || []).map(n => [n.employee_id, n]));
    schedShown = curPeriod;
    drawSchedule();
  } catch (e) {
    if (seq !== schedSeq) return;
    toast('Не удалось загрузить график: ' + (e.message || e), true);
    if (schedShown && schedShown !== curPeriod) { curPeriod = schedShown; workPeriod = curPeriod; drawSchedule(); syncHash(false); }
  }
}
function drawSchedule() {
  paintMonthNav();
  if (!worksWithPayroll() || !$('scheduleGrid')) return;
  if (!schedShown || schedShown !== curPeriod) return;
  if ($('mLabel')) $('mLabel').textContent = periodLabel(curPeriod);
  const nd = daysInMonth(curPeriod);
  const editable = canEditSchedule();
  const meRole = store.me()?.role;
  const isClosed = d => closedDays.has(cellDate(d));
  const anyEdit = ['operator', 'owner', 'ceo'].includes(meRole);
  const canEditDay = d => ['owner', 'operator', 'ceo'].includes(meRole) && !isClosed(d);
  const canEditNorm = ['owner', 'ceo'].includes(meRole);
  const todayD = (nowPeriod() === curPeriod) ? mskNow().getUTCDate() : 0;
  const active = employees.filter(e => e.status !== 'archived');
  const cats = deptsFlat();
  const f = ($('schedSearch')?.value || '').toLowerCase().trim();
  const catF = $('schedCat')?.dataset.value || '';
  if ($('schedSub')) {
    $('schedSub').innerHTML = editable
      ? hint('<b>Отмечайте выходы кликом по клетке.</b><br><b>Прошедший день:</b> клик — вышел по плану, ещё клик — не вышел.<br><b>Карандаш</b> в углу клетки — изменить время смены.<br><b>Клик по имени</b> — шаблон на месяц.<br><b>Клик по номеру дня</b> сверху — закрыть день или весь период с начала месяца.')
      : hint('План серым, факт цветом. Расхождения факта с планом видны справа и в шапке таблицы.');
    wireHints($('schedSub'));
  }
  wireFilterToggle($('s-schedule').querySelector('.sched-tools'));
  if ($('schedNote')) {
    $('schedNote').innerHTML = editable ? '' : `<div class="readonly-note">${ICONS.lock} График ведёт оператор (Алёна). У вас — просмотр.</div>`;
  }
  const byKey = new Map(scheduleRows.map(s => [s.employee_id + '|' + s.work_date + '|' + (s.position || 'main'), s]));
  const cget = (id, d, pos = 'main') => byKey.get(id + '|' + cellDate(d) + '|' + pos) || null;
  let head = '<div class="gr-corner">Сотрудник</div>';
  for (let d = 1; d <= nd; d++) {
    const { weekend, hol } = dayMark(d);
    const mk = hol ? ' gr-hol' : (weekend ? ' gr-wknd' : '');
    const hint = isClosed(d) ? 'День закрыт — клик' : (anyEdit ? 'Закрыть день' : '');
    const title = hol ? (hint ? hol + ' · ' + hint : hol) : hint;
    head += `<div class="gr-day${d === todayD ? ' today' : ''}${isClosed(d) ? ' dlock' : ''}${mk}${anyEdit ? ' tapday' : ''}" data-day="${d}" title="${esc(title)}">${d}${hol ? '<i class="holdot"></i>' : ''}${isClosed(d) ? `<i class="dlockmark">${ICONS.lock}</i>`
        : (anyEdit ? `<i class="dlockmark dlockhint">${ICONS.lock}</i>` : '')}</div>`;
  }
  head += '<div class="gr-day sum s-cnt">Смен</div><div class="gr-day sum s-delta" title="факт − норма (у кого норма задана); иначе факт − план смен за прошедшие дни">Δ</div><div class="gr-day sum s-norm" title="норма часов в месяц — задаётся вручную">Норма</div><div class="gr-day sum s-fact">Факт</div>';
  let rows = '', shown = 0;
  const seq = [];
  for (const cat of cats) {
    if (catF && !(cat === catF || deptParent(cat) === catF)) continue;
    const list = active.filter(e => empCat(e) === cat && String(e.fio || "").toLowerCase().includes(f));
    for (const e of list) seq.push([e, cat]);
  }
  if (sortAZ) seq.sort((a, b) => byFio(a[0], b[0]));
  const inCatCount = c => seq.filter(x => x[1] === c).length;
  {
    let curCat = null;
    for (const [e, cat] of seq) {
      if (!sortAZ && cat !== curCat) {
        curCat = cat;
        rows += `<div class="gr-group"><span><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(catLabel(cat))} · ${inCatCount(cat)}</span></div>`;
      }
      shown++;
      const sp = e.specialty_id ? specName(e.specialty_id) : '';
      rows += `<div class="gr-name${editable ? ' tap' : ''}" data-emp="${e.id}" title="${editable ? 'Шаблон на месяц: ' : ''}${esc(e.fio)}${sp ? ' · ' + esc(sp) : ''}" style="box-shadow:inset 3px 0 0 ${catColor(cat)}"><span class="gr-who"><span class="gr-fio">${esc(e.fio)}</span>${sp ? `<span class="gr-spec">${esc(sp)}</span>` : ''}</span></div>`;
      let planPast = 0, factPast = 0, cnt = 0;
      const amtRow = isAmountCell(e, 'main');
      for (let d = 1; d <= nd; d++) {
        const c = cget(e.id, d), pst = pastDay(d);
        const empty = !(c && (c.plan_kind || (c.fact ?? null) !== null));
        if (pst) { planPast += planHoursOf(c); const fh = factHoursOf(c); factPast += fh; if (fh > 0) cnt++; }
        const bg = pst ? (empty ? '' : factClass(c)) : (empty ? '' : ' fut');
        const noKind = !!(c && !c.plan_kind && c.fact != null && c.fact !== '' && c.fact !== 'x');
        const kmix = kindMismatch(c);
        const addable = empty && canEditDay(d) && (pst || d === todayD);
        rows += `<div class="gr-cell sc2${bg}${amtRow ? ' amt' : ''}${kmix ? ' kmix' : ''}${c && c.plan_kind === 'отпуск' ? ' k-vac' : ''}${c && c.plan_kind === 'отпуск_бз' ? ' k-vacu' : ''}${addable ? ' addable' : ''}${noKind ? ' no-kind' : ''}${isClosed(d) ? ' dclosed' : ''}${d === todayD ? ' today' : ''}${canEditDay(d) ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}">${schedCellInner(c, pst)}</div>`;
      }
      const nrm = monthNorms.get(e.id), nh = nrm && nrm.hours != null ? parseFloat(nrm.hours) : null;
      const delta = nh != null ? factPast - nh : factPast - planPast;
      const ds = Math.abs(delta) < 0.05 ? '0' : (delta > 0 ? '+' : '−') + fmtH(Math.abs(delta));
      const nMan = !!(nrm && nrm.is_manual);
      const nCal = nrm && nrm.calendar_hours != null ? parseFloat(nrm.calendar_hours) : null;
      const nTitle = nh == null ? 'Норма не задана: нет ни типа рабочей недели, ни своего числа. Клик — задать'
        : !nMan ? 'Норма по производственному календарю РФ. Клик — изменить'
        : nCal != null ? `Норма задана вручную (по календарю ${fmtH(nCal)}). Клик — изменить`
        : 'Норма задана вручную: сменный график, календарь для него нормы не даёт. Клик — изменить';
      if (amtRow) {
        rows += amountTail(e.id, 'main');
      } else
      rows += `<div class="gr-sum s-cnt">${cnt}</div><div class="gr-sum s-delta ${delta < -0.05 ? 'neg' : delta > 0.05 ? 'pos' : ''}" title="${nh != null ? `факт ${fmtH(factPast)} − норма ${fmtH(nh)}` : `факт ${fmtH(factPast)} − план смен ${fmtH(planPast)} (норма не задана)`}">${ds}</div><div class="gr-sum s-norm${nMan ? ' n-man' : ''}${canEditNorm ? ' tap' : ''}" data-emp="${e.id}" title="${esc(canEditNorm ? nTitle : nTitle.replace(/\. Клик.*$/, ''))}">${nh == null ? '<span class="muted">—</span>' : fmtH(nh)}</div><div class="gr-sum s-fact">${fmtH(factPast)}</div>`;
      if (e.specialty_id_2) {
        rows += `<div class="gr-name gr-second" data-emp="${e.id}" data-pos="second" title="${esc(specName(e.specialty_id_2))} — вторая работа · клик по клетке листает Н (ночь) → С (сутки) → «не вышел» → пусто · правая кнопка (на телефоне долгое нажатие) — обычный диалог со сменами и часами">`
          + `<span class="sec-tag">${ICONS.moon}</span>${esc(specName(e.specialty_id_2))}</div>`;
        let dCnt = 0, dFact = 0;
        const amtRow2 = isAmountCell(e, 'second');
        for (let d = 1; d <= nd; d++) {
          const c = cget(e.id, d, 'second'), pst = pastDay(d);
          const empty = !(c && (c.plan_kind || (c.fact ?? null) !== null));
          if (pst) { const fh = factHoursOf(c); dFact += fh; if (fh > 0) dCnt++; }
          const bg = pst ? (empty ? '' : factClass(c)) : (empty ? '' : ' fut');
          const noKind = !!(c && !c.plan_kind && c.fact != null && c.fact !== '' && c.fact !== 'x');
          rows += `<div class="gr-cell sc2 sec${noKind ? ' no-kind' : ''}${kindMismatch(c) ? ' kmix' : ''}${amtRow2 ? ' amt' : ''}${bg}${isClosed(d) ? ' dclosed' : ''}${d === todayD ? ' today' : ''}${canEditDay(d) ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}" data-pos="second">${schedCellInner(c, pst, 'second')}</div>`;
        }
        rows += amtRow2 ? amountTail(e.id, 'second')
          : `<div class="gr-sum s-cnt">${dCnt}</div><div class="gr-sum s-delta"></div><div class="gr-sum s-norm"><span class="muted">—</span></div><div class="gr-sum s-fact">${fmtH(dFact)}</div>`;
      }
    }
  }
  const grid = $('scheduleGrid');
  const wrap = grid.closest('.gridwrap'), keepL = wrap ? wrap.scrollLeft : 0, keepT = wrap ? wrap.scrollTop : 0;
  grid.style.gridTemplateColumns = `var(--gr-name-w, 190px) repeat(${nd}, minmax(44px, 1fr)) repeat(4, var(--gr-sum-w, 50px))`;
  grid.innerHTML = shown ? head + rows : `<div class="empty" style="padding:40px">${active.length ? 'Никого не найдено' : 'Нет сотрудников'}</div>`;
  if (wrap) { wrap.scrollLeft = keepL; wrap.scrollTop = keepT; }
  centerToday();
  if (anyEdit) {
    grid.querySelectorAll('.gr-cell').forEach(cell => cell.onclick = () => {
      const emp = +cell.dataset.emp, d = +cell.dataset.day;
      if (!canEditDay(d)) return;
      const pos = cell.dataset.pos || 'main';
      const who = employees.find(x => x.id === emp);
      const proshel = pastDay(d);
      if (isAmountCell(who, pos)) {
        const ca = cellOf(emp, d, pos);
        if (!proshel || !ca || !ca.amount_kop) { cycleAmountCell(emp, d, pos); return; }
        return cycleFactCell(emp, d, pos);
      }
      if (pos === 'second') {
        const cs = cellOf(emp, d, 'second');
        if (proshel && cs && cs.plan_kind && !isRest(cs.plan_kind)) return cycleFactCell(emp, d, 'second');
        cycleSecondCell(emp, d); return;
      }
      if (!pastDay(d)) return scheduleCellPopup(emp, d);
      const cc = cellOf(emp, d, pos);
      if (cc && cc.plan_kind && !isRest(cc.plan_kind)) return cycleFactCell(emp, d, pos);
      scheduleFactPopup(emp, d, pos);
    });
    grid.querySelectorAll('.cell-pen').forEach(pen => {
      pen.onclick = ev => {
        ev.stopPropagation();
        const cell = pen.closest('.gr-cell');
        const emp = +cell.dataset.emp, d = +cell.dataset.day;
        if (!canEditDay(d)) return;
        const p2 = cell.dataset.pos || 'main';
        const who = employees.find(x => x.id === emp);
        if (isAmountCell(who, p2)) { amountCellPopup(who, d, p2); return; }
        scheduleCellPopup(emp, d, p2);
      };
    });
    grid.querySelectorAll('.gr-cell').forEach(cell => {
      const open = ev => {
        ev.preventDefault();
        const emp = +cell.dataset.emp, d = +cell.dataset.day;
        if (!canEditDay(d)) return;
        const p2 = cell.dataset.pos || 'main';
        const who = employees.find(x => x.id === emp);
        if (isAmountCell(who, p2)) { amountCellPopup(who, d, p2); return; }
        pastDay(d) ? scheduleFactPopup(emp, d, p2) : scheduleCellPopup(emp, d, p2);
      };
      cell.oncontextmenu = open;
      let t = null;
      cell.addEventListener('touchstart', ev => { t = setTimeout(() => { t = null; open(ev); }, 500); }, { passive: true });
      const cancel = () => { if (t) { clearTimeout(t); t = null; } };
      cell.addEventListener('touchend', cancel);
      cell.addEventListener('touchmove', cancel);
    });
    grid.querySelectorAll('.gr-day.tapday').forEach(h => h.onclick = () => scheduleDayDialog(+h.dataset.day));
  }
  if (editable) grid.querySelectorAll('.gr-name.tap').forEach(n => n.onclick = () => scheduleTemplateDialog(+n.dataset.emp));
  if (canEditNorm) grid.querySelectorAll('.s-norm.tap').forEach(n => n.onclick = () => normDialog(+n.dataset.emp));
}
async function cycleFactCell(empId, day, pos = 'main') {
  const c = cellOf(empId, day, pos);
  const cur = c ? (c.fact ?? null) : null;
  const next = cur === null ? String(planHoursOf(c)) : (cur !== 'x' ? 'x' : null);
  const date = cellDate(day);
  const sel = `.gr-cell[data-emp="${empId}"][data-day="${day}"]` + (pos === 'second' ? '.sec' : ':not(.sec)');
  const cell = $('scheduleGrid')?.querySelector(sel);
  const before = cell ? cell.innerHTML : null;
  if (cell) cell.innerHTML = schedCellInner({ ...(c || {}), fact: next }, true, pos);
  try {
    const saved = await store.setScheduleFact(empId, date, next, pos);
    cacheCell(empId, date, pos, saved); drawSchedule();
  } catch (err) {
    if (cell && before !== null) cell.innerHTML = before;
    toast(err.message || err, true);
  }
}
const SECOND_CYCLE = [
  { kind: 'night12', start: '18:00', label: 'ночь' },
  { kind: 'day24',   start: '08:00', label: 'сутки' },
  { kind: 'absent',  start: null,    label: 'не вышел' },
  { kind: null,      start: null,    label: 'пусто' },
];
async function cycleSecondCell(empId, day) {
  const cur = (scheduleRows || []).find(s => s.employee_id === empId
    && s.work_date === cellDate(day) && (s.position || 'main') === 'second');
  const at = SECOND_CYCLE.findIndex(x => x.kind === (cur?.plan_kind ?? null));
  const next = SECOND_CYCLE[(at + 1) % SECOND_CYCLE.length];
  try {
    const d2 = cellDate(day);
    const saved = await store.setScheduleCell(empId, d2,
      { plan_kind: next.kind, plan_start: next.start, plan_end: null, fact: null }, 'second');
    cacheCell(empId, d2, 'second', saved); drawSchedule();
  } catch (err) { toast(err.message || err, true); }
}
const WEEK_KINDS = [['', 'Сменный график (нормы нет)'], ['40', '40 часов'], ['36', '36 часов'], ['24', '24 часа']];
function normDialog(empId) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const n = monthNorms.get(empId) || {};
  const cal = n.calendar_hours == null ? null : parseFloat(n.calendar_hours);
  const man = n.is_manual ? parseFloat(n.hours) : null;
  const wk = e.week_hours == null ? '' : String(parseFloat(e.week_hours));
  const opts = WEEK_KINDS.map(k => `<option value="${k[0]}" ${wk === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('');
  showModal(`<h3>Норма часов</h3>
    <div class="msub">${esc(e.fio)} · ${esc(periodLabel(curPeriod))}</div>
    <label class="flbl">Рабочая неделя</label>
    <select class="input" id="nhWeek">${opts}</select>
    <div class="msub" style="margin-top:6px">Норму каждого месяца по этому типу недели берём из производственного календаря РФ — вручную проставлять не нужно.</div>
    <label class="flbl">Норма с ${esc(monthGenitive(curPeriod))} и дальше${hint(
      'Число действует с этого месяца и ДАЛЬШЕ — пока его не изменят. Как ставка: завели один раз, и оно живёт. Чтобы вернуться к календарной норме, нажмите «Вернуть календарную» — это тоже запишется месяцем, с которого действует.')}</label>
    <input class="input" id="nhVal" inputmode="decimal" value="${man == null ? '' : esc(String(man))}" placeholder="${cal == null ? 'по календарю нормы нет' : 'по календарю ' + esc(String(cal))}" autocomplete="off">
    ${
''}
    <div class="msub" style="margin-top:6px">${cal == null
        ? 'Сменный график — календарь нормы не даёт. Впишите своё число (например 180 = 15 смен × 12 ч) или выберите неделю выше.'
        : `Пусто — берём календарные <b>${esc(fmtH(cal))}</b>. Своё число нужно для исключений: приняли или уволили в середине месяца, длинный больничный.`}
      <b>Норма делит оклад:</b> зарплата за месяц = оклад ÷ норма × отработанные часы. Меньше норма — дороже час. Изменение попадёт в журнал.</div>
    ${
''}
    <div id="nhPrev" class="mnote" style="margin-top:10px"></div>
    <div class="modal-foot">
      ${man != null ? `<button class="btn btn-ghost btn-sm" id="nhReset">Вернуть календарную</button>` : ''}
      <button class="btn btn-ghost btn-sm" id="nhCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="nhSave">${ICONS.check}Сохранить</button></div>`);
  const paintNorm = () => {
    const box = $('nhPrev'); if (!box) return;
    const okl = (e.lines || []).find(l => l.pay_kind === 'оклад'
      && (!l.valid_to || l.valid_to > curPeriod + '-01'));
    if (!okl || okl.amount == null) {
      box.innerHTML = '<span class="muted small">У человека нет оклада — норма на его деньги не влияет.</span>';
      return;
    }
    let v = null;
    try { v = parseNum($('nhVal').value, { field: 'норму' }); } catch (err) { v = NaN; }
    const nrm = v == null ? cal : v;
    const ch = Math.round((scheduleRows || [])
      .filter(x => x.employee_id === empId && (x.position || 'main') === 'main'
        && x.fact != null && x.fact !== ''
        && pastDay(+String(x.work_date).slice(8, 10)))
      .reduce((sum, x) => sum + factHoursOf(x), 0) * 10) / 10;
    if (nrm == null || isNaN(nrm) || nrm <= 0) {
      box.innerHTML = '<span class="muted small">Впишите число — покажу, сколько выйдет.</span>';
      return;
    }
    const summa = Math.round(Number(okl.amount) * ch / nrm);
    const dikoe = cal != null && (nrm > cal * 2 || nrm < cal / 2);
    box.innerHTML = `<b>${fmt(Math.round(Number(okl.amount)))} ₽ ÷ ${fmtH(nrm)} × ${fmtH(ch)} отработано = `
      + `<span class="money${dikoe ? ' neg' : ''}">${fmt(summa)} ₽</span></b>`
      + (dikoe ? `<br><span class="small">Это ${nrm > cal ? 'вдвое больше' : 'вдвое меньше'} календарной нормы (${fmtH(cal)}). Проверьте число.</span>`
               : (v == null && cal != null ? '<br><span class="muted small">по календарю</span>' : ''));
  };
  paintNorm();
  $('nhVal').oninput = paintNorm;
  $('nhCancel').onclick = closeModal;
  $('nhVal').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('nhSave').click(); } };
  const redraw = async () => { await renderSchedule(); };
  if (man != null) $('nhReset').onclick = async () => {
    const b = $('nhReset'); if (b.disabled) return; b.disabled = true;
    try { await store.clearMonthNorm(empId, curPeriod); closeModal(); await redraw(); toast(ICONS.check + 'Вернули норму по календарю'); }
    catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
  $('nhSave').onclick = async () => {
    const btn = $('nhSave'); if (btn.disabled) return;
    let v;
    try { v = parseNum($('nhVal').value, { field: 'норму (часов в месяц)' }); }
    catch (err) { toast(err.message, true); return; }
    if (v != null && (v <= 0 || v > 744)) { toast('Норма — больше 0 и не больше 744 часов в месяц', true); return; }
    const newWk = $('nhWeek').value === '' ? null : parseFloat($('nhWeek').value);
    const oldWk = e.week_hours == null ? null : parseFloat(e.week_hours);
    btn.disabled = true;
    try {
      if (newWk !== oldWk) await store.updateEmployee(empId, { week_hours: newWk });
      if (v !== man) {
        if (v == null) await store.clearMonthNorm(empId, curPeriod);
        else await store.setMonthNorm(empId, curPeriod, v);
      }
      closeModal();
      if (newWk !== oldWk) await refresh();
      else await redraw();
      toast(ICONS.check + (v == null
        ? `С ${monthGenitive(curPeriod)} — по календарю`
        : `Норма ${fmtH(v)} с ${monthGenitive(curPeriod)} и дальше`));
    } catch (err) {
      btn.disabled = false;
      toast(err.message || err, true);
    }
  };
}
async function zakrytyeIz(dates) {
  const mesyacy = [...new Set(dates.map(d => String(d).slice(0, 7)))];
  const zakrytye = new Set();
  for (const m of mesyacy) {
    try { for (const d of await store.listClosedDays(m)) zakrytye.add(d); }
    catch {   }
  }
  return dates.filter(d => zakrytye.has(d));
}
const denSlovami = ds => ds.length === 1 ? `день ${ds[0].slice(8)}.${ds[0].slice(5, 7)}` : `дней: ${ds.length}`;
function unmarkedIn(from, to) {
  const today = mskTodayISO();
  const days = new Set(), people = new Set();
  for (const c of (scheduleRows || [])) {
    const d = c.work_date;
    if (!d || d < from || d > to || d > today) continue;
    if (!c.plan_kind || isRest(c.plan_kind)) continue;
    if (c.fact != null && c.fact !== '') continue;
    days.add(d + '|' + c.employee_id);
    people.add(c.employee_id);
  }
  return { days: days.size, people: people.size };
}
function unmarkedWarn(from, to) {
  const u = unmarkedIn(from, to);
  if (!u.days) return '';
  return `<div class="mwarn">${ICONS.alert}<span>Не отмечено <b>${u.days} ${plural(u.days, 'выход', 'выхода', 'выходов')}</b>
    у ${u.people} ${plural(u.people, 'человека', 'человек', 'человек')}. После закрытия отметить их будет нельзя,
    и эти дни не попадут в «Осталось выдать» — сначала отметьте выходы, потом закрывайте.</span></div>`;
}
function scheduleDayDialog(day) {
  const date = cellDate(day), closed = closedDays.has(date), meRole = store.me()?.role;
  const label = day + ' ' + periodLabel(curPeriod);
  const mozhetOtkryt = ['owner', 'ceo'].includes(meRole);
  if (!closed) {
    const zavtra = new Date(mskNow().getTime() + 864e5).toISOString().slice(0, 10);
    const budushchee = date > zavtra;
    const mFrom = curPeriod + '-01';
    const warnDay = budushchee ? '' : unmarkedWarn(date, date);
    const warnTo  = budushchee ? '' : unmarkedWarn(mFrom, date);
    showModal(`<h3>Закрыть день ${esc(label)}?</h3>
      <div class="msub">${budushchee
        ? 'Этот день ещё не наступил — закрывать нечего, план по нему может смениться.'
        : 'После закрытия день блокируется для <b>всех</b>, включая владельца. Чтобы исправить — день надо будет открыть, и это отметится в журнале красным.'}</div>
      ${warnTo || warnDay}
      ${budushchee ? '' : `<div class="mnote">${ICONS.lock} <b>Закрыть день</b> — только ${day} ${monthGenitive(curPeriod)}.
        <b>Закрыть по ${day}-е</b> — весь период с 1-го по ${day} ${monthGenitive(curPeriod)} сразу.</div>`}
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Отмена</button>${budushchee ? '' : `<button class="btn btn-primary btn-sm" id="dClose">${ICONS.lock}Закрыть день</button><button class="btn btn-primary btn-sm" id="dCloseTo">${ICONS.lock}Закрыть по ${day}-е</button>`}</div>`);
    if ($('dClose')) $('dClose').onclick = async () => { const b = $('dClose'); if (b.disabled) return; b.disabled = true; try { await store.closeDay(date); closeModal(); toast(ICONS.check + 'День ' + day + ' закрыт'); renderSchedule(); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    if ($('dCloseTo')) $('dCloseTo').onclick = async () => {
      const b = $('dCloseTo'); if (b.disabled) return; b.disabled = true;
      try {
        const n = await store.closePeriod(curPeriod + '-01', date);
        closeModal();
        toast(ICONS.check + (n ? `Закрыто дней: ${n}` : 'Все эти дни уже были закрыты'));
        renderSchedule();
      } catch (e) { b.disabled = false; toast(e.message || e, true); }
    };
    $('dCancel').onclick = closeModal;
  } else {
    showModal(`<h3>${ICONS.lock} День ${esc(label)} закрыт</h3>
      <div class="msub">Правки заблокированы для всех. ${mozhetOtkryt
        ? 'Чтобы исправить — откройте день; в журнале останется красная запись, кто и когда его закрывал.'
        : 'Открыть может Милена или директор. Позже открытие будет по СМС-коду.'}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Закрыть</button>${mozhetOtkryt ? `<button class="btn btn-primary btn-sm" id="dOpen">Открыть день</button><button class="btn btn-primary btn-sm" id="dOpenTo">Открыть по ${day}-е</button>` : ''}</div>`);
    if ($('dOpen')) $('dOpen').onclick = async () => { const b = $('dOpen'); if (b.disabled) return; b.disabled = true; try { await store.reopenDay(date); closeModal(); toast('День ' + day + ' открыт'); renderSchedule(); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    if ($('dOpenTo')) $('dOpenTo').onclick = async () => {
      const b = $('dOpenTo'); if (b.disabled) return; b.disabled = true;
      try {
        const n = await store.openPeriod(curPeriod + '-01', date);
        closeModal();
        toast(n ? `Открыто дней: ${n}` : 'Открывать было нечего');
        renderSchedule();
      } catch (e) { b.disabled = false; toast(e.message || e, true); }
    };
    $('dCancel').onclick = closeModal;
  }
}
const SMENNYE_KINDS = ['сутки', '12ч', 'почасово'];
function shiftPaysBySum(e) {
  if (!e) return false;
  return activeLines(e).some(l => SMENNYE_KINDS.includes(l.pay_kind));
}
function scheduleCellPopup(empId, day, pos = 'main') {
  setEditing('sched:' + empId + ':' + cellDate(day));
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day, pos);
  const opts = kindsFor(e, c?.plan_kind).filter(k => k.code !== 'custom').map(k => `<option value="${k.code}" ${c && c.plan_kind === k.code ? 'selected' : ''}>${esc(k.label)}</option>`).join('');
  const HH = t => t ? String(t).slice(0, 5) : '';
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · смена = тип + время «с… до…»`)}
    <label class="flbl">Тип смены</label><select class="input" id="scKind"><option value="">— пусто —</option>${opts}</select>
    <label class="flbl" style="margin-top:10px">Время работы</label>
    <div class="sc-range">
      <input class="input" id="scStart" type="time" value="${esc(HH(c?.plan_start))}">
      <span class="sc-dash">—</span>
      <input class="input" id="scEnd" type="time" value="${esc(HH(c?.plan_end))}">
      <b class="sc-hours" id="scHours"></b>
    </div>
    <div class="sc-quick" id="scQuick">${
      [['08:00', '20:00'], ['09:00', '21:00'], ['11:00', '19:00'],
       ['08:00', '16:00'], ['10:00', '18:00'], ['09:00', '17:00']]
        .map(([a, b]) => `<button class="sc-q" data-a="${a}" data-b="${b}">${a.slice(0, 2)}–${b.slice(0, 2)}</button>`).join('')}</div>
    ${shiftPaysBySum(e) ? `
    <label class="flbl" style="margin-top:10px">Своя сумма за этот день${hint(
      'Обычно не нужна: за смену платит ставка. Впишите, только если день оплачивается ИНАЧЕ — например, вышли на половину смены. Пусто — платит ставка.')}</label>
    <div class="me-add">
      <input class="input" id="scAmt" placeholder="сумма ₽" autocomplete="off" inputmode="numeric"
             value="${c && c.amount_kop ? fmt(Math.round(c.amount_kop / 100)) : ''}">
      ${c && c.amount_kop ? `<button class="btn btn-ghost btn-sm" id="scAmtClear">Убрать сумму</button>` : ''}
    </div>` : ''}
    <div class="msub sc-warn" id="scWarn" style="display:none"></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="scVac">Отпуск…</button><button class="btn btn-ghost btn-sm" id="scClear">Очистить</button><button class="btn btn-primary btn-sm" id="scSave">${ICONS.check}Сохранить</button></div>`);
  const mins = t => { const [h, m] = (t || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
  const hoursBetween = (a, b) => { const x = mins(a), y = mins(b); return (x == null || y == null) ? null : (((y - x) + 1440) % 1440) / 60; };
  const paintHours = () => {
    const st = $('scStart').value, en = $('scEnd').value, w = $('scWarn');
    const a = mins(st), b = mins(en);
    $('scHours').textContent = (a == null || b == null) ? '' : fmtH(Math.round((((b - a) + 1440) % 1440) / 6) / 10);
    const sm = +(st.split(':')[1] || 0);
    if (st && !en && sm >= 10 && sm <= 23) {
      w.innerHTML = `Похоже, это <b>с ${esc(st.slice(0, 2))} до ${String(sm).padStart(2, '0')}</b>, а записано «${esc(st)}» —
        то есть ${esc(st.slice(0, 2))} часов ${sm} минут.
        <button class="btn btn-ghost btn-sm" id="scFix" style="margin-left:6px">Исправить</button>`;
      w.style.display = '';
      $('scFix').onclick = () => {
        $('scStart').value = st.slice(0, 2) + ':00';
        $('scEnd').value = String(sm).padStart(2, '0') + ':00';
        paintHours();
      };
    } else w.style.display = 'none';
  };
  paintHours();
  $('scStart').oninput = paintHours; $('scEnd').oninput = paintHours;
  $('scQuick').querySelectorAll('.sc-q').forEach(b => {
    b.onclick = () => {
      $('scStart').value = b.dataset.a; $('scEnd').value = b.dataset.b;
      if (!$('scKind').value) $('scKind').value = kindByHours(hoursBetween(b.dataset.a, b.dataset.b));
      paintHours();
    };
  });
  $('scVac').onclick = () => vacationDialog(empId, day);
  $('scSave').onclick = async () => {
    const btn = $('scSave'); if (btn.disabled) return; btn.disabled = true;
    let kind = $('scKind').value || null;
    if (!kind && $('scStart').value) kind = kindByHours(hoursBetween($('scStart').value, $('scEnd').value));
    if (kind && $('scStart').value && $('scEnd').value) {
      const proba = { plan_kind: kind, plan_start: $('scStart').value, plan_end: $('scEnd').value };
      if (kindMismatch(proba)) {
        const h = planHoursOf(proba);
        const nado = shiftKinds.find(k => k.code === kindByTime($('scStart').value, $('scEnd').value));
        const est = shiftKinds.find(k => k.code === kind);
        btn.disabled = false;
        return toast(`«${est ? est.label : kind}» — это ${est && est.hours != null ? fmtH(+est.hours) : '?'}, `
          + `а с ${$('scStart').value} до ${$('scEnd').value} выходит ${fmtH(h)}. `
          + (nado ? `Поставьте «${nado.label}» — или исправьте время.` : 'Исправьте вид смены или время.'), true);
      }
    }
    const cell = { plan_kind: kind, plan_start: kind ? ($('scStart').value || null) : null,
                   plan_end: kind ? ($('scEnd').value || null) : null, fact: null };
    if ($('scAmt')) {
      const raw = $('scAmt').value.trim();
      if (!raw) cell.amount_kop = null;
      else {
        try { cell.amount_kop = Math.round(parseNum(raw, { thousands: true, field: 'сумму', max: RATE_ABSURD }) * 100); }
        catch (e) { btn.disabled = false; return toast(e.message || e, true); }
      }
    }
    try {
      const saved = await store.setScheduleCell(empId, date, cell, pos);
      cacheCell(empId, date, pos, saved); closeModal(); toast(ICONS.check + 'Сохранено'); drawSchedule();
    }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('scClear').onclick = async () => {
    try {
      const saved = await store.setScheduleCell(empId, date, { plan_kind: null, plan_start: null, plan_end: null, fact: null }, pos);
      cacheCell(empId, date, pos, saved); closeModal(); toast('Очищено'); drawSchedule();
    }
    catch (err) { toast(err.message || err, true); }
  };
}
function rangePicker(startISO, onPick) {
  let from = startISO || null, to = null;
  let [vy, vm] = (from || mskTodayISO()).split('-').map(Number);
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const el = document.createElement('div');
  el.className = 'rp';
  function draw() {
    const first = new Date(Date.UTC(vy, vm - 1, 1));
    const shift = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
    let cells = '';
    for (let i = 0; i < shift; i++) cells += '<span class="rp-d rp-out"></span>';
    for (let d = 1; d <= days; d++) {
      const v = iso(vy, vm, d);
      const isFrom = v === from, isTo = v === to;
      const inside = from && to && v > from && v < to;
      const wknd = [0, 6].includes(new Date(Date.UTC(vy, vm - 1, d)).getUTCDay());
      cells += `<button type="button" class="rp-d${isFrom ? ' rp-a' : ''}${isTo ? ' rp-b' : ''}`
        + `${inside ? ' rp-in' : ''}${wknd ? ' rp-w' : ''}" data-v="${v}">${d}</button>`;
    }
    const label = new Date(Date.UTC(vy, vm - 1, 1))
      .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    el.innerHTML = `<div class="rp-head">
        <button type="button" class="rp-nav" data-go="-1">‹</button>
        <span class="rp-m">${esc(label)}</span>
        <button type="button" class="rp-nav" data-go="1">›</button></div>
      <div class="rp-wd">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="rp-grid">${cells}</div>
      <div class="rp-sum">${sumText()}</div>`;
    el.querySelectorAll('.rp-nav').forEach(b => b.onclick = () => {
      vm += +b.dataset.go;
      if (vm < 1) { vm = 12; vy--; } else if (vm > 12) { vm = 1; vy++; }
      draw();
    });
    el.querySelectorAll('.rp-d[data-v]').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (!from || to || v < from) { from = v; to = null; } else { to = v; }
      draw();
      if (onPick) onPick(get());
    });
  }
  function count() {
    if (!from) return 0;
    const a = new Date(from + 'T00:00:00Z'), b = new Date((to || from) + 'T00:00:00Z');
    return Math.round((b - a) / 86400000) + 1;
  }
  function sumText() {
    if (!from) return 'Выберите первый день';
    const n = count();
    if (!to) return `<b>${dmy(from)}</b> — выберите последний день`;
    if (n > 90) return '<span class="rc-warn">Больше 90 дней — проверьте даты</span>';
    return `<b>${dmy(from)} — ${dmy(to)}</b> · ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  }
  function get() {
    if (!from) return null;
    const out = [];
    for (let dt = new Date(from + 'T00:00:00Z'); ; dt.setUTCDate(dt.getUTCDate() + 1)) {
      const v = dt.toISOString().slice(0, 10);
      out.push(v);
      if (v === (to || from)) break;
      if (out.length > 90) return 'many';
    }
    return out;
  }
  draw();
  return { el, get };
}
function vacationDialog(empId, startDay) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const startDate = cellDate(startDay);
  showModal(`${personHead(e, 'выберите период в календаре', 'Отпуск')}
    <label class="flbl">Какой отпуск</label>
    <select class="input" id="vacKind">
      <option value="отпуск">Оплачиваемый — отпускные вносятся отдельной суммой</option>
      <option value="отпуск_бз">Без сохранения — денег за эти дни нет</option>
    </select>
    <div id="vacCal" style="margin-top:12px"></div>
    <div class="msub" style="margin-top:10px">Зарплата за дни отпуска не начисляется в обоих случаях —
      разница в отпускных: за оплачиваемый их вносят отдельно, за «без сохранения» нет.</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="vacCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="vacSave">${ICONS.check}Отметить отпуск</button></div>`);
  const pick = rangePicker(startDate);
  $('vacCal').appendChild(pick.el);
  $('vacCancel').onclick = closeModal;
  $('vacSave').onclick = async () => {
    const btn = $('vacSave'); if (btn.disabled) return;
    const picked = pick.get();
    if (!picked) return toast('Выберите период в календаре', true);
    if (picked === 'many') return toast('Слишком длинный период (макс 90 дней)', true);
    const vk = $('vacKind').value || 'отпуск';
    const days = picked;
    btn.disabled = true;
    try {
      const zakr = await zakrytyeIz(days);
      if (zakr.length) { btn.disabled = false; toast(`Закрыт ${denSlovami(zakr)} — сначала откройте, отпуск не отмечен`, true); return; }
      for (const d of days) await store.setScheduleCell(empId, d, { plan_kind: vk, plan_start: null, plan_end: null, fact: null });
      closeModal(); toast(ICONS.check + `Отпуск отмечен · ${days.length} дн`); renderSchedule();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); renderSchedule(); }
  };
}
function scheduleFactPopup(empId, day, pos = 'main') {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day, pos);
  const p = c && c.plan_kind, isWork = p && !isRest(p);
  const cur = c ? (c.fact ?? null) : null;
  const planLine = (p ? `план: <b>${esc(cellText(c))}</b>${isWork ? ' · ' + fmtH(planHoursOf(c)) : ''}` : 'плана нет')
    + ` <button class="lnk-inline" id="fcEditPlan">изменить</button>`;
  const now = cur === 'x' ? 'не вышел' : (cur != null && cur !== '' ? fmtH(parseFloat(cur)) : (isWork ? 'по плану' : '—'));
  const hVal = (cur != null && cur !== '' && cur !== 'x') ? esc(String(cur)) : '';
  const workKinds = kindsFor(e, c?.plan_kind).filter(k => !isRest(k.code) && k.code !== 'custom');
  const kindOpts = workKinds.map(k => `<option value="${k.code}">${esc(k.label)}</option>`).join('');
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · факт · ${planLine}`)}
    <div class="fact-opts">
      ${isWork ? `<button class="btn btn-ghost fact-btn" data-f="plan">${ICONS.check}Вышел по плану · ${fmtH(planHoursOf(c))}</button>` : ''}
      ${isWork ? `<button class="btn btn-ghost fact-btn fact-miss" data-f="x">— Не вышел</button>` : ''}
      ${!isWork ? `<label class="flbl">Вышел на замену — добавить смену</label>
      <div class="frow" style="align-items:flex-end">
        <div style="flex:1"><select class="input" id="fKind"><option value="">— тип смены (подставим по часам) —</option>${kindOpts}</select></div>
        <input class="input" id="fKindStart" type="time" style="max-width:116px" title="время начала (необязательно)">
        <button class="btn btn-primary btn-sm" id="fKindSave">${ICONS.check}Смена</button>
      </div>
      <div class="msub" style="margin:-2px 0 8px">Заменяющий отработал смену → оплата по его ставке за этот тип. Или впишите часы (почасово):</div>` : ''}
      <div class="frow" style="align-items:flex-end">
        <div style="flex:1"><label class="flbl">Свои часы${isWork ? '' : ' (почасово)'}</label>
          <input class="input" id="fH" type="number" min="0" max="24" step="0.5" placeholder="напр. 6" value="${hVal}"></div>
        <button class="btn btn-primary btn-sm" id="fSave">${ICONS.check}ОК</button>
      </div>
      <label class="flbl" style="margin-top:10px">…или фактическое время</label>
      <div class="sc-range">
        <input class="input" id="fFrom" type="time" value="${esc((c?.fact_start || '').slice(0, 5))}">
        <span class="sc-dash">—</span>
        <input class="input" id="fTo" type="time" value="${esc((c?.fact_end || '').slice(0, 5))}">
        <b class="sc-hours" id="fRangeH"></b>
        <button class="btn btn-primary btn-sm" id="fRangeSave">${ICONS.check}ОК</button>
      </div>
      <div class="msub" style="margin-top:6px">Когда вышли не как в плане: часы посчитаются сами, а план останется как назначен.</div>
    </div>
    <div class="modal-foot"><span class="msub">сейчас: <b>${now}</b></span><button class="btn btn-ghost btn-sm" id="fVac">Отпуск…</button><button class="btn btn-ghost btn-sm" id="fClear">Сбросить</button></div>`);
  { const b = $('fcEditPlan'); if (b) b.onclick = () => { closeModal(); scheduleCellPopup(empId, day, pos); }; }
  $('fVac').onclick = () => vacationDialog(empId, day);
  const apply = async fact => {
    try {
      const saved = await store.setScheduleFact(empId, date, fact, pos);
      cacheCell(empId, date, pos, saved); closeModal(); toast(ICONS.check + 'Факт отмечен'); drawSchedule();
    }
    catch (err) { toast(err.message || err, true); }
  };
  $('modalBox').querySelectorAll('.fact-btn').forEach(b => b.onclick = () => apply(b.dataset.f === 'plan' ? null : b.dataset.f));
  $('fSave').onclick = async () => {
    let v = parseFloat($('fH').value);
    if (isNaN(v) || v < 0 || v > 24) return toast('Часы 0–24', true);
    v = Math.round(v * 2) / 2;
    if (p) return apply(String(v));
    const kind = $('fKind')?.value || kindByHours(v);
    const btn = $('fSave'); if (btn.disabled) return; btn.disabled = true;
    try {
      const saved = await store.setScheduleCell(empId, date,
        { plan_kind: kind, plan_start: $('fKindStart')?.value || null, plan_end: null, fact: String(v) }, pos);
      cacheCell(empId, date, pos, saved); closeModal(); toast(ICONS.check + 'Отмечено'); drawSchedule();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  const kb = $('fKindSave');
  if (kb) kb.onclick = async () => {
    const kind = $('fKind').value; if (!kind) return toast('Выберите тип смены', true);
    if (kb.disabled) return; kb.disabled = true;
    try {
      const saved = await store.setScheduleCell(empId, date,
        { plan_kind: kind, plan_start: $('fKindStart').value || null, plan_end: null, fact: null }, pos);
      cacheCell(empId, date, pos, saved); closeModal(); toast(ICONS.check + 'Смена добавлена'); drawSchedule();
    }
    catch (err) { kb.disabled = false; toast(err.message || err, true); }
  };
  { const rb = $('fRangeSave');
    const rangeH = () => {
      const a = $('fFrom').value, b = $('fTo').value;
      if (!a || !b) return null;
      return ((((+b.slice(0, 2) * 60 + +b.slice(3, 5)) - (+a.slice(0, 2) * 60 + +a.slice(3, 5))) + 1440) % 1440) / 60;
    };
    const paintRange = () => { const h = rangeH(); $('fRangeH').textContent = h == null ? '' : fmtH(h); };
    paintRange(); $('fFrom').oninput = paintRange; $('fTo').oninput = paintRange;
    if (rb) rb.onclick = async () => {
      const h = rangeH();
      if (h == null) return toast('Укажите время выхода и ухода', true);
      if (rb.disabled) return; rb.disabled = true;
      const patch = { fact_start: $('fFrom').value, fact_end: $('fTo').value, fact: null };
      if (!p) { patch.plan_kind = kindByHours(h); patch.plan_start = null; patch.plan_end = null; }
      try {
        const saved = await store.setScheduleCell(empId, date, patch, pos);
        cacheCell(empId, date, pos, saved); closeModal();
        toast(ICONS.check + 'Отмечено · ' + fmtH(h)); drawSchedule();
      } catch (err) { rb.disabled = false; toast(err.message || err, true); }
    };
  }
  $('fClear').onclick = () => apply(null);
}
function scheduleRetroDialog(empId, day) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day);
  const p = c && c.plan_kind, isWork = p && !isRest(p);
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · день закрыт`)}
    <div class="lockmsg">${ICONS.lock} Исправление закрытого дня — по коду из СМС на ваш телефон. Правка уйдёт владельцу в «замечания».</div>
    <label class="flbl">Новый факт</label>
    <div class="fact-opts">
      ${isWork ? `<button class="btn btn-ghost fact-btn" data-f="null">${ICONS.check}Вышел по плану · ${fmtH(planHoursOf(c))}</button>` : ''}
      ${isWork ? `<button class="btn btn-ghost fact-btn fact-miss" data-f="x">— Не вышел</button>` : ''}
      <div class="frow" style="align-items:flex-end"><div style="flex:1"><label class="flbl">Свои часы</label><input class="input" id="rH" type="number" min="0" max="24" step="0.5" placeholder="напр. 6"></div><button class="btn btn-ghost btn-sm" id="rHpick">Выбрать</button></div>
    </div>
    <div class="msub" id="rPick" style="min-height:18px"></div>
    <div class="modal-foot"><button class="btn btn-primary btn-sm" id="rReq" disabled>${ICONS.check}Получить код по СМС</button></div>`);
  let chosen, chosenLabel;
  const pick = (v, label) => { chosen = v; chosenLabel = label; $('rPick').textContent = 'выбрано: ' + label; $('rReq').disabled = false; };
  $('modalBox').querySelectorAll('.fact-btn').forEach(b => b.onclick = () => pick(b.dataset.f === 'null' ? null : 'x', b.textContent.trim()));
  $('rHpick').onclick = () => { let v = parseFloat($('rH').value); if (isNaN(v) || v < 0 || v > 24) return toast('Часы 0–24', true); v = Math.round(v * 2) / 2; pick(String(v), v + 'ч'); };
  $('rReq').onclick = async () => {
    const btn = $('rReq'); if (btn.disabled) return; btn.disabled = true;
    try { const res = await store.requestRetroEdit(date, empId, 'fact', { new_fact: chosen }); retroConfirmPhase(res.id, res.demoCode, chosenLabel); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
function retroConfirmPhase(requestId, demoCode, label) {
  const RUS = { wrong_code: 'Неверный код', expired: 'Код истёк — запросите заново', locked: 'Слишком много попыток — запросите новый код', already_done: 'Уже обработано', forbidden: 'Нет прав', not_found: 'Заявка не найдена' };
  showModal(`<h3>Код подтверждения</h3>
    <div class="msub">${demoCode ? `<b>ДЕМО:</b> код <b>${esc(demoCode)}</b> (в проде придёт по СМС)` : 'Код отправлен на ваш телефон по СМС.'} · правка: ${esc(label || '')}</div>
    <label class="flbl">Код из СМС</label><input class="input" id="rCode" inputmode="numeric" maxlength="6" placeholder="6 цифр" autocomplete="off">
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="rCancel">Отмена</button><button class="btn btn-primary btn-sm" id="rConf">${ICONS.check}Подтвердить</button></div>`);
  $('modalBox').dataset.guard = '1';
  $('rCancel').onclick = () => closeModal();
  $('rConf').onclick = async () => {
    const btn = $('rConf'); if (btn.disabled) return; btn.disabled = true;
    try {
      const st = await store.confirmRetroEdit(requestId, $('rCode').value.trim());
      if (st === 'ok') { closeModal(); toast(ICONS.check + 'Исправлено · владелец уведомлён'); renderSchedule(); }
      else { btn.disabled = false; toast(RUS[st] || st, true); }
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
function templateDays(pattern, period, anchor) {
  const nd = daysInMonth(period), [y, m] = period.split('-').map(Number);
  const cycles = { '2/2': [1, 1, 0, 0], '3/3': [1, 1, 1, 0, 0, 0], 'sutki3': [1, 0, 0, 0] };
  const out = [];
  for (let d = 1; d <= nd; d++) {
    let work;
    if (pattern === '5/2') { const wd = new Date(y, m - 1, d).getDay(); work = wd >= 1 && wd <= 5; }
    else if (pattern === 'every') work = true;
    else { const cyc = cycles[pattern] || [1]; work = cyc[((d - anchor) % cyc.length + cyc.length) % cyc.length] === 1; }
    out.push({ day: d, work });
  }
  return out;
}
function confirmClearMonth(e, cells, facts, sums) {
  return new Promise(resolve => {
    const bits = [`${cells} ${plural(cells, 'день', 'дня', 'дней')} графика`];
    if (facts) bits.push(`<b>${facts} ${plural(facts, 'отметка', 'отметки', 'отметок')} факта</b>`);
    if (sums) bits.push(`<b>${sums} ${plural(sums, 'сумма', 'суммы', 'сумм')} за смену</b>`);
    showModal2(`<h3>Очистить ${esc(periodLabel(curPeriod))}?</h3>
      <div class="msub">${esc(e.fio)}</div>
      <div class="msub sc-warn">Исчезнет: ${bits.join(', ')}. Вернуть будет нечем — только вводить заново.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="cmNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="cmYes">Очистить</button></div>`, () => resolve(false));
    $('cmNo').onclick = () => { resolve(false); closeModal2(); };
    $('cmYes').onclick = () => { resolve(true); closeModal2(); };
  });
}
function scheduleTemplateDialog(empId) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const nd = daysInMonth(curPeriod);
  const pastN = (() => { let n = 0; for (let d = 1; d <= nd; d++) if (cellDate(d) < mskTodayISO()) n++; return n; })();
  const kinds = kindsFor(e).filter(k => !isRest(k.code) && k.code !== 'custom');
  const kopts = kinds.map(k => `<option value="${k.code}"${k.code === 'day' ? ' selected' : ''}>${esc(k.label)}</option>`).join('');
  const pats = [['5/2', '5/2 — Пн-Пт работа, Сб-Вс выходные'], ['2/2', '2/2 — два через два'], ['3/3', '3/3 — три через три'], ['sutki3', 'Сутки/3 — сутки, потом 3 выходных'], ['every', 'Каждый день одинаково']];
  showModal(`${personHead(e, `Заполнить весь ${esc(periodLabel(curPeriod))} по шаблону · потом можно поправить руками`)}
    <label class="flbl">Шаблон</label><select class="input" id="tpPat">${pats.map(p => `<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select>
    <div class="frow"><div><label class="flbl">Тип смены</label><select class="input" id="tpKind">${kopts}</select></div>
      <div><label class="flbl">Время работы</label>
        <div class="sc-range"><input class="input" id="tpStart" type="time" value="08:00">
          <span class="sc-dash">—</span><input class="input" id="tpEnd" type="time" value="20:00"></div></div></div>
    <label class="flbl">С какого дня начать <span style="color:var(--ink-3)">(для 2/2, 3/3, сутки)</span></label>
    <input class="input" id="tpAnchor" type="number" min="1" max="${nd}" value="1">
    ${pastN ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="tpPast">
      <span>Заполнить и прошедшие дни (${pastN})</span></label>
      <div class="msub sc-warn">Прошедший день с планом и без отметки факта считается <b>отработанным</b> —
        за него начислится зарплата. Поэтому по умолчанию трогаем сегодня и дальше.</div>` : ''}
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="tpClear">Очистить месяц</button><button class="btn btn-primary btn-sm" id="tpFill">${ICONS.check}Заполнить</button></div>`);
  $('tpFill').onclick = async () => {
    const btn = $('tpFill'); if (btn.disabled) return; btn.disabled = true;
    const pat = $('tpPat').value, kind = $('tpKind').value;
    const start = $('tpStart').value || null, end = $('tpEnd').value || null;
    const anchor = Math.min(nd, Math.max(1, +$('tpAnchor').value || 1));
    const withPast = $('tpPast')?.checked;
    const cells = templateDays(pat, curPeriod, anchor)
      .filter(x => withPast || cellDate(x.day) >= mskTodayISO())
      .map(x => ({
        employee_id: empId, work_date: cellDate(x.day),
        plan_kind: x.work ? kind : 'off',
        plan_start: x.work ? start : null,
        plan_end: x.work ? end : null,
      }));
    const doZakrytyh = cells.length;
    const cells2 = cells.filter(c => !closedDays.has(c.work_date));
    const propushcheno = doZakrytyh - cells2.length;
    if (!cells2.length) {
      btn.disabled = false;
      toast(propushcheno ? 'Все эти дни закрыты — сначала их надо открыть' : 'Все дни месяца уже прошли — отметьте галочку ниже', true);
      return;
    }
    try {
      await store.setScheduleBulk(cells2); closeModal();
      toast(ICONS.check + (propushcheno ? `Заполнено. Закрытые дни (${propushcheno}) пропущены` : 'Заполнено по шаблону'));
      renderSchedule();
    }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('tpClear').onclick = async () => {
    const mine = scheduleRows.filter(r => r.employee_id === empId
      && String(r.work_date).slice(0, 7) === curPeriod && (r.position || 'main') === 'main');
    if (!mine.length) { toast('В этом месяце у человека ничего не проставлено'); return; }
    const facts = mine.filter(r => r.fact != null && r.fact !== '').length;
    const sums = mine.filter(r => r.amount_kop).length;
    if (!await confirmClearMonth(e, mine.length, facts, sums)) return;
    const btn = $('tpClear'); if (btn.disabled) return; btn.disabled = true;
    try {
      const n = await store.clearScheduleMonth(empId, curPeriod);
      const ostalos = mine.length - n;
      closeModal();
      toast(ostalos > 0 ? `Очищено дней: ${n}. Закрытых не тронули: ${ostalos}` : 'Месяц очищен');
      renderSchedule();
    }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
const RT_KINDS = [['оклад', 'Оклад'], ['сутки', 'Сутки'], ['почасово', 'Почасово'], ['12ч', '12ч'], ['процент', 'Процент']];
const primaryLine = e => activeLines(e).find(l => l.line_type === 'основной');
function rtFields(kind, l) {
  const has = l && l.pay_kind === kind;
  if (kind === 'процент') return `<input class="input rt-a" inputmode="decimal" value="${has ? (l.percent ?? '') : ''}" placeholder="%">`;
  if (kind === '12ч') return `<input class="input rt-a" inputmode="numeric" value="${has ? (l.amount ?? '') : ''}" placeholder="день ₽"><input class="input rt-b" inputmode="numeric" value="${has ? (l.amount_night ?? '') : ''}" placeholder="ночь ₽">`;
  if (kind === 'сдельно') return `<span class="muted small">сумму вписывают на «Расчёте»</span>`;
  return `<input class="input rt-a" inputmode="numeric" value="${has ? (l.amount ?? '') : ''}" placeholder="сумма ₽">`;
}
function rtRow(e) {
  const l = primaryLine(e), kind = l?.pay_kind || 'оклад';
  const kinds = RT_KINDS.some(k => k[0] === kind) ? RT_KINDS : [[kind, payKindLabel(kind)], ...RT_KINDS];
  const opts = kinds.map(k => `<option value="${k[0]}" ${kind === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('');
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
  if (kind === 'процент') line.percent = val('.rt-a', { field: 'процент' });
  else {
    line.amount = val('.rt-a', { thousands: true, field: 'сумму', max: RATE_ABSURD });
    if (kind === '12ч') line.amount_night = val('.rt-b', { thousands: true, field: 'ночную ставку', max: RATE_ABSURD });
  }
  return checkRate(line);
}
const RU_MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const monthStartMSK = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 8) + '01';
const openPeriod = () => [workPeriod, payPeriod, curPeriod, ovPeriod]
  .find(p => /^\d{4}-\d{2}$/.test(p || '')) || null;
const rateStartDefault = () => { const p = openPeriod(); return p ? p + '-01' : monthStartMSK(); };
function rateBounds() {
  const t = new Date(Date.now() + 3 * 3600e3);
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), d = t.getUTCDate();
  const iso = dt => dt.toISOString().slice(0, 10);
  return { min: iso(new Date(Date.UTC(y, m - 1, 1))), max: iso(new Date(Date.UTC(y, m + 3, d))) };
}
function rateBackWarn(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || d >= monthStartMSK()) return '';
  const warn = `<div class="rc-warn">${ICONS.lock} Это <b>задним числом</b>: месяц уже посчитан,
       по нему могли быть выплаты. Суммы пересчитаются.</div>`;
  return backdateNeedsOk(d)
    ? warn + `<label class="rc-ok"><input type="checkbox" id="rbOk">
       <span>Да, ставлю дату <b>задним числом</b> осознанно — правка попадёт в журнал с моим именем</span></label>`
    : warn;
}
function backdateBlocked(d) {
  if (!backdateNeedsOk(d) || $('rbOk')?.checked) return false;
  toast('Отметьте, что ставите дату задним числом осознанно', true);
  return true;
}
function rateStartWarn(d) {
  const open = openPeriod();
  if (!open || !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return '';
  const [y, m] = open.split('-').map(Number);
  return d.slice(0, 7) > open
    ? `<div class="rc-warn">${ICONS.lock} За <b>${RU_MONTHS[m - 1]} ${y}</b> по этой ставке
       <b>не начислится ничего</b> — она начинает действовать позже.</div>`
    : '';
}
function ratePreviewText(d) {
  const [y, m, day] = String(d).split('-').map(Number);
  if (!y || !m || !day) return '';
  const mn = `${RU_MONTHS[m - 1]} ${y}`;
  return day === 1
    ? `Весь <b>${mn}</b> — по новой ставке.`
    : `<b>${mn}</b> поделится: 1–${day - 1} числа по старой ставке, ${day}-е и дальше — по новой.`;
}
function rateStartDialog(fresh, removed = 0) {
  return new Promise(resolve => {
    const def = rateStartDefault();
    const list = fresh.length
      ? fresh.map(l => `<div><b>${esc(lineLabel(l))}</b></div>`).join('')
      : `<div class="muted">убрано строк: <b>${removed}</b></div>`;
    showModal2(`<h3>${fresh.length ? 'С какого месяца действует ставка?' : 'С какого месяца ставка не действует?'}</h3>
      <div class="rc-diff">${list}</div>
      <label class="flbl">Действует с</label>
      <input class="input" type="date" id="rsFrom" value="${def}" min="${rateBounds().min}" max="${rateBounds().max}">
      <div class="msub" id="rsPrev"></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="rsNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="rsYes">${ICONS.check}Сохранить</button></div>`);
    const inp = $('rsFrom');
    const draw = () => { $('rsPrev').innerHTML = ratePreviewText(inp.value) + rateStartWarn(inp.value) + rateBackWarn(inp.value); };
    draw(); inp.oninput = draw;
    modalOnClose2 = () => resolve(null);
    $('rsNo').onclick = () => { resolve(null); closeModal2(); };
    $('rsYes').onclick = () => {
      const b = rateBounds();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) { toast('Укажите дату', true); return; }
      if (inp.value < b.min) { toast('Слишком далеко в прошлом: те месяцы уже посчитаны и выплачены', true); return; }
      if (inp.value > b.max) { toast('Слишком далеко в будущем — проверьте год', true); return; }
      if (backdateBlocked(inp.value)) return;
      resolve(inp.value); closeModal2();
    };
  });
}
function rateChangeDialog(emp, oldLine, newLine) {
  return new Promise(resolve => {
    const def = rateStartDefault();
    const kindChanged = oldLine.pay_kind !== newLine.pay_kind;
    const warn = kindChanged
      ? `<div class="rc-warn">${ICONS.lock} <b>${esc(payKindLabel(oldLine.pay_kind))}</b> перестанет начисляться —
         останется только <b>${esc(payKindLabel(newLine.pay_kind))}</b>.
         ${oldLine.pay_kind === 'процент'
            ? 'Если сменная ставка нужна <b>вдобавок</b> к проценту — заведите её в карточке как «Совместитель», а эту смену отмените.'
            : 'Если нужны обе — вторую заведите в карточке как «Совместитель».'}</div>`
      : '';
    showModal(`<h3>Смена ставки</h3><div class="msub">${esc(emp.fio)} — изменение попадёт в журнал</div>
      <div class="rc-diff">
        <div><span class="muted small">было</span> <s>${esc(lineLabel(oldLine))}</s></div>
        <div><span class="muted small">станет</span> <b>${esc(lineLabel(newLine))}</b></div>
      </div>
      ${warn}
      <label class="flbl">Действует с</label>
      <input class="input" type="date" id="rcFrom" value="${def}" min="${rateBounds().min}" max="${rateBounds().max}">
      <div class="msub" id="rcPrev" style="margin-top:8px">${ratePreviewText(def)}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="rcNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="rcYes">${ICONS.check}Применить</button></div>`);
    $('modalBox').dataset.guard = '1';
    const inp = $('rcFrom');
    const drawRc = () => { $('rcPrev').innerHTML = ratePreviewText(inp.value) + rateStartWarn(inp.value) + rateBackWarn(inp.value); };
    inp.oninput = drawRc; drawRc();
    modalOnClose = () => resolve(null);
    $('rcNo').onclick = () => { resolve(null); closeModal(); };
    $('rcYes').onclick = () => {
      const b = rateBounds();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) { toast('Укажите дату', true); return; }
      if (inp.value < b.min) { toast('Слишком далеко в прошлом: те месяцы уже посчитаны и выплачены', true); return; }
      if (inp.value > b.max) { toast('Слишком далеко в будущем — проверьте год', true); return; }
      if (backdateBlocked(inp.value)) return;
      resolve(inp.value); closeModal();
    };
  });
}
function renderRates(filter = '') {
  if (!isOwner()) { $('ratesList').innerHTML = ''; $('ratesTools').innerHTML = ''; return; }
  const f = filter.toLowerCase();
  const active = employees.filter(e => e.status !== 'archived');
  const withRate = active.filter(primaryLine).length, without = active.length - withRate;
  const onlyEmpty = $('ratesTools').dataset.onlyEmpty === '1';
  $('ratesTools').innerHTML = `<div class="rates-stat card cardpad"><span><b>${withRate}</b> из <b>${active.length}</b> со ставкой · <b style="color:${without ? 'var(--red-d)' : 'var(--green)'}">${without}</b> без ставки</span>
    <label class="rt-toggle"><input type="checkbox" id="rtOnlyEmpty" ${onlyEmpty ? 'checked' : ''}> только без ставки</label></div>`;
  $('rtOnlyEmpty').onchange = ev => { $('ratesTools').dataset.onlyEmpty = ev.target.checked ? '1' : ''; renderRates($('rateSearch').value || ''); };
  const cats = deptsFlat();
  let html = '';
  for (const cat of cats) {
    let list = active.filter(e => empCat(e) === cat && String(e.fio || "").toLowerCase().includes(f));
    if (onlyEmpty) list = list.filter(e => !primaryLine(e));
    if (!list.length) continue;
    html += `<div class="group-label"><span class="caps">${esc(catLabel(cat))} · ${list.length}</span><span class="line"></span></div>` + list.map(rtRow).join('');
  }
  $('ratesList').innerHTML = html || `<div class="empty">${onlyEmpty ? 'Всем в фильтре ставки проставлены 🎉' : 'Никого не найдено'}</div>`;
  applyIcons($('ratesList'));
  $('ratesList').querySelectorAll('.rate-row').forEach(row => {
    row.querySelector('.rt-kind').onchange = () => { row.querySelector('.rt-fields').innerHTML = rtFields(row.querySelector('.rt-kind').value, null); };
    row.querySelector('.rt-save').onclick = async () => {
      const btn = row.querySelector('.rt-save'); if (btn.disabled) return; btn.disabled = true;
      try {
        const line = rtCollect(row);
        if (line._needsConfirm && !(await confirmBigAmounts(bigAmounts([line])))) { btn.disabled = false; return; }
        const drafts = {};
        $('ratesList').querySelectorAll('.rate-row').forEach(r => {
          if (+r.dataset.id === +row.dataset.id) return;
          const a = r.querySelector('.rt-a'), b = r.querySelector('.rt-b'), k = r.querySelector('.rt-kind');
          if ((a && a.value) || (b && b.value)) drafts[r.dataset.id] = { kind: k.value, a: a ? a.value : '', b: b ? b.value : '' };
        });
        const emp = employees.find(x => x.id === +row.dataset.id);
        const old = emp && primaryLine(emp);
        let vfrom;
        if (old && !sameRate(old, line)) {
          vfrom = await rateChangeDialog(emp, old, { ...line, line_type: 'основной' });
          if (vfrom === null) { btn.disabled = false; return; }
        }
        await store.setPrimaryRate(+row.dataset.id, line, vfrom);
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
const J_ENTITY = { employee: 'Карточка', rate_line: 'Ставка', specialty: 'Специальность', app_user: 'Пользователь',
  money_line: 'Деньги', patient_payment: 'Оплата пациента', calc_rule: 'Правило расчёта',
  schedule: 'График', closed_day: 'День', day: 'День', import_batch: 'Импорт',
  salary_override: 'Финальная сумма', employee_month_norm: 'Норма часов',
  doctor_month_revenue: 'Выручка врача', payout: 'Выдача наличных',
  category_order: 'Отделение', dept_rule: 'Норма отделения', shift_preset: 'Сумма за смену' };
const jSpecName = id => {
  const sp = specialties.find(x => x.id === id);
  return sp ? `${sp.name} (${sp.category})` : `№${id}`;
};
const J_FIELD = { fio: 'ФИО', position: 'должность', phone: 'телефон', status: 'статус', specialty: 'специальность', specialty_id: 'специальность', norm_hours: 'норма часов', week_hours: 'рабочая неделя', hired_on: 'принят', left_on: 'уволен', dept: 'отделение', 'новая строка': 'новая строка', 'закрыта': 'строка закрыта', 'ставка добавлена': 'ставка добавлена', 'ставка закрыта': 'ставка закрыта' };
const J_ACTION = { 'сторно': 'СТОРНО', 'правило расчёта': 'ПРАВИЛО РАСЧЁТА' };
const otherSum = r => (r.nach_other_kop || 0) - (r.uderz_other_kop || 0) - (r.pay_other_kop || 0);
const hasOther = r => !!((r.nach_other_kop || 0) || (r.uderz_other_kop || 0) || (r.pay_other_kop || 0));
function otherCell(r) {
  const v = otherSum(r);
  if (!hasOther(r)) return '<span class="muted">—</span>';
  return `<b class="money${v < 0 ? ' neg' : ''}">${rub(v)}</b><span class="oth-q" title="Показать, на что">?</span>`;
}
const cardTotal = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0)
  + (r.otpusk_kop || 0) + (r.bolnich_kop || 0);
const handBlock = r => (r.cash_avans_kop || 0) + (r.cash_kop || 0) + (r.otpusk_cash_kop || 0);
const cardBlock = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0)
  + (r.card_uvol_kop || 0) + (r.otpusk_kop || 0) + (r.bolnich_kop || 0)
  + (r.uderz_other_kop || 0) + (r.pay_other_kop || 0);
function rateFormula(l, r, nh, emp) {
  const rate = (emp?.lines || []).find(x => !x.valid_to && x.pay_kind === l.kind);
  const amt  = rate && rate.amount != null ? Number(rate.amount) : null;
  const fh   = Number(r.fact_hours) || 0;
  if (l.kind === 'оклад') {
    if (amt == null || !nh) return '';
    return `${fmt(amt)} × ${fmtH(fh)} ÷ ${fmtH(nh)}`;
  }
  if (l.kind === 'процент') {
    const p = rate && rate.percent != null ? Number(rate.percent) : null;
    return p == null ? '' : `${p}% от выручки`;
  }
  if (l.kind === 'фикс') return 'фиксированная сумма за месяц';
  if (amt != null && l.worked) return `${fmt(amt)} × ${l.worked} см`;
  return '';
}
function deltaAs(r, salaryKop) {
  const base = r.fact_required ? (+r.salary_marked_kop || 0) : (+r.salary_kop || 0);
  return (+r.delta_kop || 0) + ((+salaryKop || 0) - base);
}
function deltaCell(r, salaryKop) {
  const v = deltaAs(r, salaryKop);
  if (v === (+r.delta_kop || 0)) return '<span class="muted">—</span>';
  return `<b class="money${v < 0 ? ' neg' : ''}">${rub(v)}</b>`;
}
function prevMonthForecast(rows, prev, marked) {
  const prevSal = new Map((prev?.all || []).map(p => [p.employee_id, p.salary_kop || 0]));
  const noSched = id => !(marked instanceof Set ? marked.has(id) : false);
  const who = rows.filter(r => noSched(r.employee_id) &&
    r.status === 'active' && !r.flag_archived
    && !(r.salary_plan_kop || 0) && !(r.salary_kop || 0) && prevSal.get(r.employee_id) > 0);
  return { who, sum: who.reduce((a, r) => a + prevSal.get(r.employee_id), 0), period: prev?.prev || null };
}
function forecastRow(r) {
  const fin = +r.salary_plan_kop || 0;
  if (!fin || fin <= (+r.salary_kop || 0)) return '';
  return `<div class="me-row me-forecast"><span class="muted">К концу месяца, если доработает по графику</span><b>${rub(fin)} ₽</b></div>`;
}
function markedRow(r) {
  const mk = +r.salary_marked_kop, plan = +r.salary_kop || 0;
  if (!r.fact_required) return '';
  if (r.salary_marked_kop == null) return '';
  if (mk >= plan) return '';
  const wait = plan - mk;
  return `<div class="me-row me-sum me-marked"><span>Подтверждено фактом</span>
      <b class="money">${rub(mk)} ₽</b></div>
    <div class="me-row"><span class="muted small">Ещё ${rub(wait)} ₽ ждут отметок в графике —
      в «Осталось выдать» они пока не входят.</span></div>`;
}
const earned = r => (r.salary_kop || 0) + (r.premia_kop || 0)
  + (r.otpusk_nach_kop || 0) + (r.bolnich_nach_kop || 0)
  + (r.nach_other_kop || 0);
const waitingMark = r => (r.fact_required && r.salary_marked_kop != null)
  ? Math.max(0, (+r.salary_kop || 0) - (+r.salary_marked_kop || 0)) : 0;
const deltaFromBlocks = r => earned(r) - waitingMark(r) - cardBlock(r) - handBlock(r) + (+r.carry_kop || 0);
const MONEY_KINDS = [
  ['cash', 'Наличные'], ['cash_avans', 'Аванс наличными'], ['otpusk_cash', 'Отпускные наличными'],
  ['premia', 'Премия'],
  ['card_avans', 'Аванс на карту'], ['card_rasch', 'ЗП на карту'],
  ['otpusk', 'Отпускные на карту'], ['card_uvol', 'Расчёт на карту (увольнение)'],
  ['otpusk_nach', 'Отпускные начислено (не выплата)'],
  ['bolnich_nach', 'Больничные начислено (не выплата)'],
  ['bolnich', 'Больничные на карту'],
  ['nach_other', 'Своё начисление (+)'],
  ['uderz_other', 'Удержание (−)'],
  ['pay_other', 'Прочая выплата (алименты, займ…)'],
];
const moneyKindLabel = k => (MONEY_KINDS.find(x => x[0] === k) || [k, k])[1];
const MONEY_GROUPS = [
  ['Заработано — увеличивает к выдаче', ['premia', 'otpusk_nach', 'bolnich_nach', 'nach_other']],
  ['На карту и удержания — уменьшает',  ['card_avans', 'card_rasch', 'card_uvol', 'otpusk', 'bolnich', 'uderz_other', 'pay_other']],
  ['Наличными — уменьшает',             ['cash_avans', 'cash', 'otpusk_cash']],
];
function moneyKindOpts(role) {
  const allow = new Map(moneyKindsFor(role));
  const out = [];
  for (const [title, keys] of MONEY_GROUPS) {
    const mine = keys.filter(k => allow.has(k));
    if (!mine.length) continue;
    out.push({ head: true, label: title, v: '' });
    for (const k of mine) out.push({ v: k, label: allow.get(k) });
  }
  return out;
}
const BUH_KINDS = ['card_avans', 'card_rasch', 'card_uvol', 'bolnich', 'otpusk', 'otpusk_nach'];
function moneyKindsFor(role) {
  if (role === 'owner' || role === 'ceo') return MONEY_KINDS;
  if (role === 'operator') return MONEY_KINDS.filter(k => k[0] !== 'premia');
  if (role === 'cashier1') return MONEY_KINDS.filter(k => BUH_KINDS.includes(k[0]));
  return [];
}
const rub = kop => fmt(Math.round((kop || 0) / 100));
const recorded = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0) + (r.card_uvol_kop || 0) + (r.cash_kop || 0) + (r.cash_avans_kop || 0);
let payrollRows = [], payrollLines = [], payrollSeq = 0, payrollShown = null;
let archMoney = new Map();
let payrollPrev = null, payrollCarryNotes = new Map();
let payrollMarked = [];
let payrollNorms = new Map();
async function renderPayroll(filter = '') {
  if (!worksWithPayroll()) { $('payrollTable').innerHTML = ''; return; }
  if (!payPeriod) payPeriod = nowPeriod();
  $('pLabel').textContent = periodLabel(payPeriod);
  if ($('paySub') && !$('paySub').dataset.done) {
    $('paySub').dataset.done = '1';
    $('paySub').innerHTML = hint('Зарплата, аванс, наличные и сколько осталось выдать — всё из проставленных смен.<br><b>Клик по строке</b> — разбивка по человеку и ввод сумм.');
    wireHints($('paySub'));
  }
  wireFilterToggle($('s-payroll').querySelector('.sched-tools'));
  const seq = ++payrollSeq;
  const wrap = document.querySelector('#s-payroll .gridwrap');
  const keepTop = wrap ? wrap.scrollTop : 0, keepLeft = wrap ? wrap.scrollLeft : 0;
  const sameMonth = payrollShown === payPeriod;
  const prevShown = payrollShown;
  if (!sameMonth) $('payrollTable').innerHTML = '<div class="empty">Загружаем расчёт…</div>';
  let rows, lines;
  let norms = [], marked = [];
  let prevRem = null, carries = [];
  try { [rows, lines, norms, marked, prevRem, carries] = await Promise.all([store.listPayroll(payPeriod), store.listPayrollLines(payPeriod),
    store.listMonthNorms(payPeriod).catch(e => { console.warn('listMonthNorms:', e); return []; }),
    store.listMonthMarked(payPeriod).catch(e => { console.warn('listMonthMarked:', e); return []; }),
    store.listPrevRemainder(payPeriod).catch(e => { console.warn('listPrevRemainder:', e); return null; }),
    store.listCarries(payPeriod).catch(e => { console.warn('listCarries:', e); return []; })]); }
  catch (e) {
    if (seq !== payrollSeq) return;
    if (prevShown && prevShown !== payPeriod) {
      payPeriod = prevShown; workPeriod = payPeriod;
      $('pLabel').textContent = periodLabel(payPeriod);
      syncHash(false);
      toast('Не удалось загрузить: ' + (e.message || e), true);
      drawPayroll(filter);
    } else $('payrollTable').innerHTML = `<div class="empty">Не удалось загрузить: ${esc(e.message || e)}</div>`;
    return;
  }
  if (seq !== payrollSeq) return;
  payrollShown = payPeriod;
  payrollMarked = marked || [];
  payrollRows = rows; payrollLines = lines;
  zapomnitArhivnyeDolgi(rows);
  payrollNorms = new Map((norms || []).map(n => [n.employee_id, n]));
  payrollPrev = prevRem;
  payrollCarryNotes = new Map((carries || []).map(c => [c.employee_id, c.note]));
  drawPayroll(filter);
  if (wrap) { wrap.scrollTop = keepTop; wrap.scrollLeft = keepLeft; }
}
function linesFor(r) { return linesForRow(r, payrollLines.filter(l => l.employee_id === r.employee_id)); }
function linesForRow(r, raw) {
  const out = raw.map(l => l.kind === 'оклад' ? { ...l, money_kop: r.oklad_kop } : l);
  const has = k => raw.some(l => l.kind === k);
  if ((r.percent_kop || r.pct_rate != null) && !has('процент'))
    out.push({ kind: 'процент', planned: null, worked: null, money_kop: r.percent_kop, isPct: true });
  if (r.fix_kop && !has('фикс'))
    out.push({ kind: 'фикс', planned: null, worked: null, money_kop: r.fix_kop, isPct: true });
  return out;
}
function drawPayroll(filter = '') {
  paintMonthNav();
  if (!payrollShown || payrollShown !== payPeriod) return;
  const f = (filter || '').toLowerCase();
  const cat = $('payrollCat')?.dataset.value || '';
  const onlyZero = $('payOnlyZero')?.checked;
  const rows = payrollRows.filter(r => (r.fio || '').toLowerCase().includes(f)
    && (!cat || inCat(employees.find(e => e.id === r.employee_id), cat))
    && (!onlyZero || (r.salary_kop || 0) === 0));
  if (!rows.length) {
    $('payrollTable').innerHTML = `<div class="empty">${onlyZero && payrollRows.length ? 'Всем за месяц что-то начислено 🎉'
      : payrollRows.length ? 'Никого не найдено' : 'За ' + esc(periodLabel(payPeriod)) + ' данных нет'}</div>`;
    return;
  }
  const buhNote = isBuh()
    ? `<div class="readonly-note" style="margin-bottom:12px">${ICONS.lock} Вы видите расчёт целиком — включая наличные,
        чтобы не переплатить на карту. Вносить и править можете только выплаты <b>на карту</b>:
        аванс, расчёт, отпускные, больничные. Каждая правка идёт в журнал.</div>`
    : '';
  const head = `<thead><tr>
    <th class="pw-name">Сотрудник</th><th>Начисление</th><th class="num">Норма</th><th class="num">Факт</th><th class="num">Сумма</th>
    <th class="num sep">Зарплата</th><th class="num pw-earned">Всего заработано</th><th class="num">Аванс на карту</th><th class="num">ЗП на карту</th><th class="num pw-cardtot">Всего на карту</th><th class="num pw-carry">С прошлого мес.</th><th class="num pw-byplan" title="Сколько пришлось бы выдать, если бы все дни по графику зачлись как отработанные. Для сравнения — платить по этой сумме нельзя">По плану</th><th class="num pw-pay">Осталось выдать</th><th class="num pw-fcast" title="Сколько выйдет к концу месяца: подтверждённые выходы + оставшиеся дни по графику">К концу месяца</th><th class="num">Расчёт на карту</th><th class="num">Аванс нал.</th><th class="num">Наличка</th>
    <th class="num">Отпуск. начисл.</th><th class="num">Отпуск. карта</th><th class="num">Отпуск. нал.</th><th class="num">Премия</th><th class="num">Больн. начисл.</th><th class="num" title="Нестандартное: свои начисления, удержания и выплаты. Нажмите на число — покажет, на что именно">Прочее</th><th class="num">Больн. карта</th></tr></thead>`;
  const catOf = r => empCat(employees.find(e => e.id === r.employee_id));
  if (sortAZ) rows.sort(byFio);
  else rows.sort((a, b) => catSort(catOf(a)) - catSort(catOf(b))
    || catOf(a).localeCompare(catOf(b)) || (a.fio || '').localeCompare(b.fio || ''));
  let body = '', curCat = null;
  for (const r of rows) {
    const cat = catOf(r);
    if (!sortAZ && cat !== curCat) {
      curCat = cat;
      const myCat = rows.filter(x => catOf(x) === cat);
      const catDelta = myCat.reduce((s, x) => s + (x.delta_kop || 0), 0);
      body += `<tr class="pw-group" style="--cat:${catColor(cat)}"><td colspan="24"><span>${esc(catLabel(cat))} · ${myCat.length} чел · осталось выдать <b class="money${catDelta < 0 ? ' neg' : ''}">${rub(catDelta)} ₽</b></span></td></tr>`;
    }
    const my = linesFor(r);
    const flags = payrollFlags(r);
    const n = Math.max(1, my.length);
    const right = `
      <td class="num sep fin"><b>${rub(r.salary_kop)}</b></td>
      <td class="num fin pw-earned"><b>${rub(earned(r))}</b></td>
      <td class="num fin">${rub(r.card_avans_kop)}</td>
      <td class="num fin">${rub(r.card_rasch_kop)}</td>
      <td class="num fin pw-cardtot"><b>${rub(cardTotal(r))}</b></td>
      <td class="num fin pw-carry${canEditCarry() ? ' pw-tap' : ''}" data-carry="${r.employee_id}"${canEditCarry() ? ' title="Изменить или убрать перенос"' : ''}>${
        r.carry_kop ? `<b class="money${r.carry_kop < 0 ? ' neg' : ''}">${rub(r.carry_kop)}</b>` : '<span class="muted">—</span>'}</td>
      <td class="num fin pw-byplan">${deltaCell(r, r.salary_kop)}</td>
      <td class="num pw-pay fin"><b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)}</b></td>
      <td class="num fin pw-fcast">${deltaCell(r, r.salary_plan_kop)}</td>
      <td class="num fin">${rub(r.card_uvol_kop)}</td>
      <td class="num fin">${rub(r.cash_avans_kop)}</td>
      <td class="num fin">${rub(r.cash_kop)}</td>
      <td class="num fin">${rub(r.otpusk_nach_kop)}</td>
      <td class="num fin">${rub(r.otpusk_kop)}</td>
      <td class="num fin">${rub(r.otpusk_cash_kop)}</td>
      <td class="num fin">${rub(r.premia_kop)}</td>
      <td class="num fin">${rub(r.bolnich_nach_kop)}</td>
      <td class="num fin pw-other${hasOther(r) ? ' pw-tap' : ''}" data-oth="${r.employee_id}"${hasOther(r) ? ' title="Показать, на что"' : ''}>${otherCell(r)}</td>
      <td class="num fin">${rub(r.bolnich_kop)}</td>
`;
    if (!my.length) {
      body += `<tr class="pw-row" data-id="${r.employee_id}"><td class="pw-name"><span class="pw-fio">${esc(r.fio)}</span>${flags}</td>
        <td colspan="4" class="muted small">${r.flag_no_rate && !payNotByShift(r.employee_id, payPeriod)
          ? 'вид смены не связан со ставкой' : 'нет начислений за месяц'}</td>${right}</tr>`;
      continue;
    }
    my.forEach((l, i) => {
      body += `<tr class="pw-row${i ? ' pw-sub' : ''}" data-id="${r.employee_id}">
        ${i === 0 ? `<td class="pw-name" rowspan="${n}"><span class="pw-fio">${esc(r.fio)}</span>${flags}</td>` : ''}
        <td>${esc(payKindLabel(l.kind))}${l.sub ? ' · ' + esc(l.sub) : ''}</td>
        <td class="num">${l.planned ?? '—'}</td><td class="num">${l.worked ?? '—'}</td>
        <td class="num fin">${rub(l.money_kop)}</td>
        ${i === 0 ? right.replace(/<td class="num/g, `<td rowspan="${n}" class="num`) : ''}</tr>`;
    });
  }
  const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const toGive   = rows.reduce((s, r) => s + Math.max(0, r.delta_kop || 0), 0);
  const overpaid = rows.reduce((s, r) => s + Math.min(0, r.delta_kop || 0), 0);
  const sumToGive = f => rows.reduce((s, r) => s + Math.max(0, f(r) || 0), 0);
  const colTotal = f => rows.some(r => f(r) !== (+r.delta_kop || 0))
    ? `<b>${rub(sumToGive(f))}</b>` : '<span class="muted">—</span>';
  const overpaidCnt = rows.filter(r => (r.delta_kop || 0) < 0).length;
  const total = `<tfoot><tr class="pw-total"><td class="pw-name">ИТОГО</td><td></td>
    <td></td><td></td><td></td>
    <td class="num sep fin"><b>${rub(sum('salary_kop'))}</b></td>
    <td class="num fin pw-earned"><b>${rub(rows.reduce((s2, r) => s2 + earned(r), 0))}</b></td>
    <td class="num fin">${rub(sum('card_avans_kop'))}</td><td class="num fin">${rub(sum('card_rasch_kop'))}</td>
    <td class="num fin pw-cardtot"><b>${rub(sum('card_rasch_kop') + sum('card_avans_kop') + sum('otpusk_kop') + sum('bolnich_kop'))}</b></td>
    <td class="num fin pw-carry"><b class="money${sum('carry_kop') < 0 ? ' neg' : ''}">${sum('carry_kop') ? rub(sum('carry_kop')) : '—'}</b></td>
    <td class="num fin pw-byplan">${colTotal(r => deltaAs(r, r.salary_kop))}</td>
    <td class="num pw-pay fin"><b class="money">${rub(toGive)}</b></td>
    <td class="num fin pw-fcast">${colTotal(r => deltaAs(r, r.salary_plan_kop))}</td>
    <td class="num fin">${rub(sum('card_uvol_kop'))}</td>
    <td class="num fin">${rub(sum('cash_avans_kop'))}</td><td class="num fin">${rub(sum('cash_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_nach_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_kop'))}</td><td class="num fin">${rub(sum('otpusk_cash_kop'))}</td><td class="num fin">${rub(sum('premia_kop'))}</td>
    <td class="num fin">${rub(sum('bolnich_nach_kop'))}</td>
    <td class="num fin">${rub(sum('nach_other_kop') - sum('uderz_other_kop') - sum('pay_other_kop'))}</td>
    <td class="num fin">${rub(sum('bolnich_kop'))}</td>
</tr>
    <tr class="pw-total pw-accrued"><td class="pw-name">Всего начислено</td>
      <td colspan="8" class="muted small">зарплата ${rub(sum('salary_kop'))}${
        sum('premia_kop') ? ' + премии ' + rub(sum('premia_kop')) : ''}${
        sum('otpusk_nach_kop') ? ' + отпускные ' + rub(sum('otpusk_nach_kop')) : ''}${
        sum('bolnich_nach_kop') ? ' + больничные ' + rub(sum('bolnich_nach_kop')) : ''}${
        sum('nach_other_kop') ? ' + прочие начисления ' + rub(sum('nach_other_kop')) : ''}${
        sum('uderz_other_kop') ? ' − удержания ' + rub(sum('uderz_other_kop')) : ''}</td>
      <td class="num pw-cardtot"></td><td class="num pw-carry"></td>
      <td class="num pw-byplan"></td><td class="num pw-pay fin"><b class="money">${rub(sum('salary_kop') + sum('premia_kop') + sum('otpusk_nach_kop') + sum('bolnich_nach_kop') + sum('nach_other_kop') - sum('uderz_other_kop'))}</b></td><td class="num pw-fcast"></td>
      <td colspan="10"></td></tr>
    ${(() => {
      if (!rows.some(r => r.fact_required)) return '';
      const ids = new Set(rows.map(r => r.employee_id));
      const mk = (payrollMarked || []).filter(m => ids.has(m.employee_id));
      const past = mk.reduce((a, m) => a + (+m.past_hours || 0), 0);
      const done = mk.reduce((a, m) => a + (+m.marked_hours || 0), 0);
      const wait = mk.reduce((a, m) => a + (+m.unmarked_days || 0), 0);
      if (!past || !wait) return '';
      const plan = sum('salary_kop'), fakt = sum('salary_marked_kop');
      const hasMarked = rows.some(r => r.salary_marked_kop != null);
      const split = hasMarked && fakt !== plan
        ? `<span class="muted">всего по плану ${rub(plan)}</span> · всего фактически <b>${rub(fakt)}</b> · `
        : '';
      return `<tr class="pw-total pw-plan"><td class="pw-name">Подтверждено фактом</td>
        <td colspan="10" class="muted small">${split}отмечено ${fmtH(done)} из ${fmtH(past)} отработанных
          (${Math.round(done / past * 100)}%) · <b>${wait} ${plural(wait, 'день', 'дня', 'дней')}</b> ещё без отметки —
          они посчитаны по плану, в «Осталось выдать» не идут</td>
        <!-- В колонке — СУММА, а не процент: на телефоне подвал читается строками
             «подпись — число», и процент там выглядел как деньги. Процент ушёл в
             текст, к часам, из которых он и считается. -->
        <td class="num pw-byplan">${hasMarked ? `<span class="muted">${rub(plan)}</span>` : ''}</td>
        <td class="num pw-pay fin"><b class="money">${rub(hasMarked ? fakt : 0)}</b></td><td class="num pw-fcast"></td>
        <td colspan="10"></td></tr>`;
    })()}
    ${(() => {
      const done = sum('salary_marked_kop'), fin = sum('salary_plan_kop');
      const fc = prevMonthForecast(rows, payrollPrev, new Set((payrollMarked || []).map(m => m.employee_id)));
      const noSched = fc.who, fromPrev = fc.sum;
      if ((!fin || fin <= sum('salary_kop')) && !fromPrev) return '';
      const left = Math.max(0, fin - done);
      const byPlan = fin > sum('salary_kop')
        ? `по графикам <b>${rub(fin)}</b> (уже подтверждено ${rub(done)} + осталось отработать по плану ${rub(left)})`
        : `по графикам <b>${rub(fin)}</b>`;
      const prevPart = fromPrev
        ? ` · по прошлому месяцу <b>${rub(fromPrev)}</b> — ${noSched.length} ${plural(noSched.length, 'человек', 'человека', 'человек')} без графика (${
            esc(noSched.slice(0, 3).map(r => shortFio(r.fio)).join(', '))}${noSched.length > 3 ? ' и другие' : ''}), сумма взята за ${periodLabel(payrollPrev.prev).toLowerCase()}`
        : '';
      return `<tr class="pw-total pw-forecast"><td class="pw-name">Заработают за месяц</td>
        <td colspan="10" class="muted small">если доработают: ${byPlan}${prevPart}.
          Это прогноз, а не долг — в «Осталось выдать» идёт только подтверждённое${
            fromPrev ? '; заведите таким людям график, и догадка сменится расчётом' : ''}</td>
        <td class="num pw-byplan"></td><td class="num pw-pay fin"><b class="money">${rub(fin + fromPrev)}</b></td><td class="num pw-fcast"></td>
        <td colspan="10"></td></tr>`;
    })()}
    ${overpaid ? `<tr class="pw-total pw-over"><td class="pw-name">Переплата вперёд</td>
      <td colspan="10" class="muted small">выдано больше, чем начислено — эта сумма перейдёт на следующую оплату${overpaidCnt ? ` · ${overpaidCnt} чел` : ''}</td>
      <td class="num pw-byplan"></td><td class="num pw-pay fin"><b class="money neg">−${rub(Math.abs(overpaid))}</b></td><td class="num pw-fcast"></td>
      <td colspan="10"></td></tr>` : ''}</tfoot>`;
  $('payrollTable').innerHTML = buhNote + `<table class="pw">${head}<tbody>${body}</tbody>${total}</table>`;
  stickFooterRows($('payrollTable'));
  $('payrollTable').querySelectorAll('.pw-row').forEach(tr => {
    tr.onclick = () => payrollDialog(+tr.dataset.id);
  });
  {
    const cb = $('carryPrev');
    if (cb) {
      cb.hidden = !canEditCarry();
      const havePrev = payrollPrev && ((payrollPrev.all || []).length || (payrollPrev.rows || []).length);
      if (havePrev) {
        const st = carryState(payrollPrev.all || payrollPrev.rows, payrollCarryNotes);
        const n = st.stale.length + st.extra.length;
        cb.textContent = n ? `С прошлого месяца · ${n} ${plural(n, 'устарел', 'устарели', 'устарели')}` : 'С прошлого месяца';
        cb.classList.toggle('cp-stale', n > 0);
        cb.title = n ? 'Прошлый месяц поправили после переноса — суммы разошлись' : 'Перенести остатки прошлого месяца';
      } else {
        cb.textContent = 'С прошлого месяца';
        cb.classList.remove('cp-stale');
        cb.title = payrollPrev ? 'За прошлый месяц расчёта нет' : 'Прошлый месяц не загрузился — нажмите, чтобы проверить';
      }
      cb.onclick = () => carryFromPrev(payPeriod, () => renderPayroll($('payrollSearch')?.value || ''));
    }
  }
  $('payrollTable').querySelectorAll('.pw-other.pw-tap[data-oth]').forEach(td => {
    td.onclick = async e => { e.stopPropagation(); await otherDetails(+td.dataset.oth); };
  });
  $('payrollTable').querySelectorAll('.pw-carry.pw-tap[data-carry]').forEach(td => {
    td.onclick = e => { e.stopPropagation(); editCarry(+td.dataset.carry, payPeriod, () => renderPayroll($('payrollSearch')?.value || '')); };
  });
}
function payNotByShift(employee_id, period) {
  const e = employees.find(x => x.id === employee_id);
  if (!e || !e.lines || !period) return false;
  const p1 = period + '-01', pn = nextPeriodStart(period);
  const live = e.lines.filter(l => l.valid_from < pn && (!l.valid_to || l.valid_to > p1));
  if (live.some(l => ['сутки', '12ч', 'почасово'].includes(l.pay_kind))) return false;
  return live.some(l => ['сдельно', 'оклад', 'фикс'].includes(l.pay_kind));
}
function payrollFlags(r) {
  const f = [];
  if (r.flag_manual_salary) f.push(['сумма вручную', 'info']);
  if (!r.flag_manual_salary) {
    if (r.flag_money_without_calc) f.push(['деньги без расчёта', 'red']);
    if (r.flag_no_rate && !payNotByShift(r.employee_id, payPeriod)) f.push(['вид смены без ставки', 'red']);
    if (r.flag_oklad_no_days)  f.push(['оклад без дней', 'red']);
    if (r.flag_rate_gap)       f.push(['ставка не на все дни', 'amber']);
    if (r.flag_no_patient_data)f.push(['нет оплат пациентов', 'amber']);
    if (r.flag_pct_no_rate)    f.push(['оплата без процента', 'amber']);
    if (r.flag_partial_month)  f.push(['неполный месяц', 'amber']);
    if (r.flag_fallback)       f.push(['запасная ставка', 'amber']);
    if (r.flag_ambiguous)      f.push(['две одинаковые ставки', 'amber']);
  }
  if (r.flag_archived)       f.push(['в архиве', 'amber']);
  return f.length ? `<span class="pw-flags">${f.map(([t, c]) => `<span class="pw-flag ${c}">${t}</span>`).join('')}</span>` : '';
}
function confirmStorno(row) {
  return new Promise(resolve => {
    showModal2(`<h3>Сторнировать запись?</h3>
      <div class="msub">${esc(row.kind_label || moneyKindLabel(row.kind))} · ${rub(row.amount_kop)} ₽ · ${esc(row.entered_by_name || '—')}</div>
      <div class="rc-warn">Запись не удаляется. Появится встречная на <b>−${rub(row.amount_kop)} ₽</b>,
        и обе останутся видны владельцу в журнале. Это правильный способ исправить ошибку.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="stNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="stYes">${ICONS.check}Сторнировать</button></div>`);
    modalOnClose2 = () => resolve(false);
    $('stNo').onclick = () => { resolve(false); closeModal2(); };
    $('stYes').onclick = () => { resolve(true); closeModal2(); };
  });
}
function confirmGive(fio, kop, per, осталось) {
  const вперёд = kop - (осталось || 0);
  return new Promise(resolve => {
    showModal2(`<h3>Выдать наличными на руки?</h3>
      <div class="msub">${esc(fio)} · ${esc(periodLabel(per))}</div>
      <div class="rc-warn">К выдаче <b>${rub(kop)} ₽</b>. СМС-кода нет — подтверждаете вы.
        Запись сразу уйдёт владельцу в журнал: кому, сколько и когда.
        ${вперёд > 0 ? `<br><br><b>Это выдача вперёд.</b> ${вперёд >= 100
            ? `На <b>${rub(вперёд)} ₽</b> больше, чем человек заработал на этот момент.`
            : 'Чуть больше, чем человек заработал на этот момент.'}
          Так можно — но владелец увидит запись красной, поэтому лучше сказать, за что.` : ''}</div>
      ${вперёд > 0 ? `<input class="input" id="gvWhy" autocomplete="off" maxlength="200" style="margin-top:10px;width:100%"
        placeholder="за что (необязательно): напр. «вперёд, перед отпуском»">` : ''}
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="gvNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="gvYes">${ICONS.check}Выдал</button></div>`);
    modalOnClose2 = () => resolve(null);
    $('gvNo').onclick = () => { resolve(null); closeModal2(); };
    $('gvYes').onclick = () => { const v = $('gvWhy')?.value || ''; resolve(v); closeModal2(); };
  });
}
function confirmUnpay(fio, kop) {
  return new Promise(resolve => {
    showModal2(`<h3>Отменить выдачу?</h3>
      <div class="msub">${esc(fio)} · ${rub(kop)} ₽</div>
      <div class="rc-warn">Запись не удаляется. Рядом встанет встречная на <b>−${rub(kop)} ₽</b>,
        и обе останутся видны владельцу в журнале.</div>
      <input class="input" id="upWhy" placeholder="причина (необязательно): напр. «ошиблась суммой»"
        autocomplete="off" maxlength="200" style="margin-top:10px;width:100%">
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="upNo">Назад</button>
        <button class="btn btn-primary btn-sm" id="upYes">${ICONS.check}Отменить выдачу</button></div>`);
    modalOnClose2 = () => resolve(null);
    $('upNo').onclick = () => { resolve(null); closeModal2(); };
    $('upYes').onclick = () => { const v = $('upWhy').value || ''; resolve(v); closeModal2(); };
  });
}
function payRow(label, kop, kind, canEdit, note) {
  if (!kop) return '';
  const can = canEdit && kind && moneyKindsFor(store.me()?.role).some(k => k[0] === kind);
  return `<div class="me-row${can ? ' me-tap' : ''}"${can ? ` data-kind="${kind}" title="Изменить или убрать"` : ''}>`
       + `<span class="muted">${esc(label)}${note ? ` · <b class="pr-note">${esc(note)}</b>` : ''}</span><b>${rub(kop)} ₽</b>`
       + (can ? `<span class="me-pen">${ICONS.pencil || '✎'}</span>` : '')
       + `</div>`;
}
function otherNotes(events) {
  const m = {};
  for (const e of events || []) {
    if (!['nach_other', 'uderz_other', 'pay_other'].includes(e.kind)) continue;
    if (e.reverses_id || !e.note) continue;
    (m[e.kind] = m[e.kind] || []).push(e.note);
  }
  Object.keys(m).forEach(k => { m[k] = [...new Set(m[k])].join(', '); });
  return m;
}
function liveOf(ev, kind) {
  const dead = new Set(ev.filter(x => x.reverses_id).map(x => x.reverses_id));
  return ev.filter(x => !x.reverses_id && !dead.has(x.id) && (!kind || x.kind === kind));
}
async function editPayout(empId, per, kind, onDone) {
  let ev;
  try { ev = await store.listMoneyEvents(empId, per); }
  catch (e) { toast(e.message || e, true); return; }
  const live = liveOf(ev, kind);
  const cur = live.reduce((s, x) => s + x.amount_kop, 0);
  if (!live.length) { toast('Записей этого вида за месяц нет', true); return; }
  const named = ['nach_other', 'uderz_other', 'pay_other'].includes(kind);
  const curNote = live.length === 1 ? (live[0].note || '') : '';
  showModal2(`<h3>${esc(moneyKindLabel(kind))}</h3>
    <div class="msub">${esc(periodLabel(per))} · сейчас <b>${rub(cur)} ₽</b> ${live.length > 1 ? `(${live.length} записей)` : ''}</div>
    <label class="flbl">Новая сумма</label>
    <input class="input" id="epVal" inputmode="numeric" autocomplete="off" value="${rub(cur)}">
    ${named ? `<label class="flbl" style="margin-top:10px">На что — название</label>
      <input class="input" id="epNote" autocomplete="off" maxlength="120" value="${esc(curNote)}" placeholder="Алименты · займ · доплата за ЭСТ…">
      ${live.length > 1 ? '<div class="msub" style="margin-top:6px">Записей несколько — они сложатся в одну с этим названием.</div>' : ''}` : ''}
    <div class="msub" style="margin-top:8px">Запишем разницу: прежние записи уйдут встречными на минус, новая сумма — отдельной строкой.
      В истории останется видно, кто вносил и кто менял. «Осталось выдать» пересчитается само.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="epNo">Отмена</button>
      <button class="btn btn-ghost btn-sm" id="epClear">Убрать совсем</button>
      <button class="btn btn-primary btn-sm" id="epOk">${ICONS.check}Сохранить</button></div>`);
  $('epNo').onclick = closeModal2;
  $('epVal').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('epOk').click(); } };
  const apply = async (newKop) => {
    try {
      for (const row of live) await store.reverseMoneyLine(row);
      const note = (named && ($('epNote')?.value || '').trim()) || 'исправление суммы';
      if (newKop > 0) await store.addMoneyLine({ employee_id: empId, period: per, kind, amount_kop: newKop, note });
      closeModal2();
      toast(ICONS.check + (newKop > 0 ? 'Стало ' + rub(newKop) + ' ₽' : 'Убрано · ' + rub(cur) + ' ₽'));
      if (onDone) await onDone();
    } catch (err) { toast(err.message || err, true); }
  };
  $('epClear').onclick = () => apply(0);
  $('epOk').onclick = async () => {
    let v;
    try { v = parseNum($('epVal').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (v == null || v < 0) { toast('Укажите сумму (0 — убрать совсем)', true); return; }
    const kop = Math.round(v * 100);
    if (kop === cur) { closeModal2(); return; }
    if (v > RATE_CONFIRM && !(await confirmBigAmounts([v]))) return;
    await apply(kop);
  };
}
async function undoAllPayouts(empId, per, onDone) {
  let ev;
  try { ev = await store.listMoneyEvents(empId, per); }
  catch (e) { toast(e.message || e, true); return; }
  const allowed = new Set(moneyKindsFor(store.me()?.role).map(k => k[0]));
  const live = liveOf(ev).filter(x => allowed.has(x.kind));
  if (!live.length) { toast('Убирать нечего', true); return; }
  const sum = live.reduce((s, x) => s + x.amount_kop, 0);
  const byKind = [...new Set(live.map(x => x.kind))]
    .map(k => `${esc(moneyKindLabel(k))} — ${rub(live.filter(x => x.kind === k).reduce((s, x) => s + x.amount_kop, 0))} ₽`).join('<br>');
  const ok = await new Promise(resolve => {
    showModal2(`<h3>Убрать ВСЕ выплаты за месяц?</h3>
      <div class="msub">${esc(periodLabel(per))} · ${live.length} записей на <b>${rub(sum)} ₽</b></div>
      <div class="rc-diff"><div class="small">${byKind}</div></div>
      <div class="rc-warn">Все эти суммы станут <b>0 ₽</b>. Записи не стираются — рядом появятся
        встречные на минус, в истории видно, кто вносил и кто убрал.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="uaNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="uaYes">${ICONS.check}Убрать всё</button></div>`);
    modalOnClose2 = () => resolve(false);
    $('uaNo').onclick = () => { resolve(false); closeModal2(); };
    $('uaYes').onclick = () => { resolve(true); closeModal2(); };
  });
  if (!ok) return;
  try {
    for (const row of live) await store.reverseMoneyLine(row);
    toast(ICONS.check + 'Убрано ' + live.length + ' записей · ' + rub(sum) + ' ₽');
    if (onDone) await onDone();
  } catch (err) { toast(err.message || err, true); }
}
const CARRY_AUTO = /^(остаток за |пересчитан:)/;
const isAutoCarry = note => CARRY_AUTO.test(String(note || ''));
function carryState(prevAll, notes) {
  const note = id => (notes instanceof Map ? notes.get(id) : null);
  const prev = new Map((prevAll || []).map(x => [x.employee_id, x]));
  const fresh = [], stale = [], extra = [];
  const manual = [], manualSeen = new Set();
  const addManual = x => { if (!manualSeen.has(x.employee_id)) { manualSeen.add(x.employee_id); manual.push(x); } };
  for (const x of (prevAll || [])) {
    const row = payrollRows.find(p => p.employee_id === x.employee_id);
    const cur = row?.carry_kop || 0;
    if (x.delta_kop < 0 && !cur) fresh.push({ ...x, was: 0 });
    else if (cur && cur !== x.delta_kop) {
      if (!isAutoCarry(note(x.employee_id)) || cur > 0) addManual({ ...x, was: cur, note: note(x.employee_id) || '' });
      else if (x.delta_kop < 0) stale.push({ ...x, was: cur });
    }
  }
  for (const p of payrollRows) {
    if (!p.carry_kop) continue;
    const x = prev.get(p.employee_id);
    if (!x || x.delta_kop < 0) continue;
    if (!isAutoCarry(note(p.employee_id)) || p.carry_kop > 0) addManual({ employee_id: p.employee_id, fio: p.fio, delta_kop: x.delta_kop, was: p.carry_kop, note: note(p.employee_id) || '' });
    else extra.push({ employee_id: p.employee_id, fio: p.fio, delta_kop: 0, was: p.carry_kop });
  }
  return { fresh, stale, extra, manual };
}
async function carryFromPrev(per, onDone) {
  if (payrollShown !== per) { toast('Дождитесь, пока месяц загрузится', true); return; }
  let r;
  try { r = await store.listPrevRemainder(per); }
  catch (e) { toast(e.message || e, true); return; }
  if (!(r.all || []).length && !(r.rows || []).length) {
    toast(`За ${periodLabel(r.prev)} в системе нет расчёта — сверять не с чем`); return;
  }
  const { fresh, stale, extra, manual } = carryState(r.all || r.rows, payrollCarryNotes);
  const sum = fresh.reduce((a, x) => a + x.delta_kop, 0);
  if (!r.rows.length && !stale.length && !extra.length) { toast(`За ${periodLabel(r.prev)} переплат нет — переносить нечего`); return; }
  if (!fresh.length && !stale.length && !extra.length && !manual.length) { toast('Все переносы за этот месяц уже проставлены и совпадают'); return; }
  const row = (fio, txt, cls, sub) => `<div class="me-row"><span class="muted">${esc(fio)}${
    sub ? `<br><span class="small" style="opacity:.7">${esc(sub)}</span>` : ''}</span><b class="money${cls}">${txt}</b></div>`;
  const block = (title, arr, fn) => arr.length
    ? `<div class="me-cap" style="margin-top:10px">${title} · ${arr.length}${
        title !== 'Не трогаем' ? ` · <b>${rub(arr.reduce((a, x) => a + (x.delta_kop - x.was), 0))} ₽</b> к «Осталось выдать»` : ''}</div>`
      + arr.map(fn).join('') : '';
  const changes = fresh.length + stale.length + extra.length;
  showModal2(`<h3>Перенос остатков за ${esc(periodLabel(r.prev))}</h3>
    <div class="msub">${fresh.length ? `Новых: <b>${fresh.length}</b> на ${rub(Math.abs(sum))} ₽. ` : ''}${
      stale.length ? `<b class="money neg">Устарели: ${stale.length}</b> — прошлый месяц поправили после переноса. ` : ''}${
      extra.length ? `<b class="money neg">Лишних: ${extra.length}</b> — человек больше не в минусе. ` : ''}${
      manual.length ? `Ручных: <b>${manual.length}</b> — их не трогаем. ` : ''}</div>
    <div class="rc-diff" style="max-height:300px;overflow:auto">
      ${block('Поставить', fresh, x => row(x.fio, rub(x.delta_kop) + ' ₽', ' neg'))}
      ${block('Обновить', stale, x => row(x.fio, `${rub(x.was)} → ${rub(x.delta_kop)} ₽`, ' neg'))}
      ${block('Снять', extra, x => row(x.fio, `${rub(x.was)} → —`, ''))}
      ${block('Не трогаем', manual, x => row(x.fio, `${rub(x.was)} ₽`, x.was > 0 ? '' : ' neg',
          x.was > 0 ? 'плюс — это долг клиники человеку' : (x.note ? 'поставлено вручную: ' + x.note : 'поставлено вручную')))}
    </div>
    ${manual.length ? `<div class="msub" style="margin-top:8px">Ручные переносы пересчёт <b>не трогает</b>: это чьё-то решение, а не снимок. Если такой перенос устарел — поправьте его в клетке «С прошлого месяца».</div>` : ''}
    <div class="msub" style="margin-top:8px">Правка и снятие уже учтённого переноса пишутся в журнал <b>красным</b>.</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="cpNo">Отмена</button>
      ${changes ? `<button class="btn btn-primary btn-sm" id="cpYes">${ICONS.check}Применить · ${changes}</button>` : ''}</div>`);
  modalOnClose2 = () => {};
  $('cpNo').onclick = closeModal2;
  if (!$('cpYes')) return;
  $('cpYes').onclick = async () => {
    const b = $('cpYes'); if (b.disabled) return; b.disabled = true;
    b.textContent = 'Применяю…';
    let done = 0;
    const total = fresh.length + stale.length + extra.length;
    try {
      for (const x of fresh) {
        await store.setCarry(x.employee_id, per, x.delta_kop, `остаток за ${periodLabel(r.prev)}`);
        done++;
      }
      for (const x of stale) {
        await store.setCarry(x.employee_id, per, x.delta_kop, `пересчитан: ${periodLabel(r.prev)} изменился`);
        done++;
      }
      for (const x of extra) {
        await store.setCarry(x.employee_id, per, null);
        done++;
      }
      closeModal2(); toast(ICONS.check + `Готово: ${done} из ${total}`);
    } catch (err) {
      closeModal2();
      toast(`Успели ${done} из ${total}, дальше ошибка: ${err.message || err}`, true);
    }
    if (onDone) { try { await onDone(); } catch (e) { console.warn('перерисовка после переноса:', e); } }
  };
}
async function otherDetails(empId) {
  const per = payPeriod || nowPeriod();
  const KINDS = { nach_other: ['Своё начисление', 1], uderz_other: ['Удержание', -1], pay_other: ['Прочая выплата', -1] };
  let ev = [];
  try { ev = await store.listMoneyEvents(empId, per); }
  catch (e) { toast(e.message || e, true); return; }
  const live = liveOf(ev || []).filter(x => KINDS[x.kind]);
  const emp = employees.find(x => x.id === empId);
  if (!live.length) {
    showModal(`<h3>Прочее</h3><div class="msub">${esc(emp?.fio || '')} · ${esc(periodLabel(per))}</div>
      <div class="msub" style="margin-top:10px">Здесь пусто. Добавить можно в окне человека — «Внести деньги».</div>
      <div class="modal-foot"><button class="btn btn-primary btn-sm" id="odOk">Понятно</button></div>`);
    $('odOk').onclick = closeModal; return;
  }
  const rows = live.map(x => {
    const [label, sign] = KINDS[x.kind];
    return `<div class="me-row"><span class="muted">${esc(x.note || label)}</span>
      <b class="money${sign < 0 ? ' neg' : ''}">${sign < 0 ? '−' : '+'}${rub(x.amount_kop)} ₽</b></div>`;
  }).join('');
  const total = live.reduce((a, x) => a + KINDS[x.kind][1] * x.amount_kop, 0);
  showModal(`<h3>Прочее</h3><div class="msub">${esc(emp?.fio || '')} · ${esc(periodLabel(per))}</div>
    <div class="rc-diff" style="margin-top:10px">${rows}</div>
    <div class="me-row me-sum" style="margin-top:6px"><span>Итого</span>
      <b class="money${total < 0 ? ' neg' : ''}">${rub(total)} ₽</b></div>
    <div class="msub" style="margin-top:8px">Названия задаются при вводе — в окне человека, «Внести деньги».</div>
    <div class="modal-foot"><button class="btn btn-primary btn-sm" id="odOk">Закрыть</button></div>`);
  $('odOk').onclick = closeModal;
}
async function editCarry(empId, per, onDone, row) {
  const src = row || payrollRows.find(x => x.employee_id === empId) || {};
  const fio = src.fio || '';
  const cur = src.carry_kop || 0;
  const over = cur < 0;
  const curNote = (payrollCarryNotes instanceof Map ? payrollCarryNotes.get(empId) : null) || '';
  showModal2(`<h3>С прошлого месяца</h3>
    <div class="msub">${esc(fio)} · ${esc(periodLabel(per))}${cur ? ` · сейчас <b>${rubShort(cur)} ₽</b>` : ''}</div>
    <label class="flbl">Переплатили в прошлом месяце</label>
    <!-- ⚠ Копейки показываем и сохраняем. Раньше поле округляло до целых рублей:
         открыл клетку, ничего не менял, нажал «Сохранить» — и −19 589,47 ₽
         превращалось в −19 589,00. Перенос сразу расходился с прошлым месяцем на
         47 копеек, кнопка загоралась «1 устарел», а каждый пересчёт писал в
         журнал КРАСНУЮ строку. То есть сигнал, ради которого всё и сделано,
         забивался копейками. -->
    <input class="input" id="ecVal" inputmode="decimal" autocomplete="off" value="${cur ? rubShort(Math.abs(cur)) : ''}" placeholder="напр. 19 589,47">
    <!-- Причину подставляем существующую — но ТОЛЬКО ручную. Автоподпись
         («остаток за Июль 2026», «пересчитан: …») в поле не кладём намеренно:
         иначе человек правит сумму руками, подпись едет следом, и пересчёт
         считает эту правку СВОЕЙ — на следующем нажатии вернёт расчётное число
         поверх решения человека. Поправил руками — значит запись стала ручной,
         и подпись должна это отражать. Прежняя подпись видна подсказкой, чтобы
         было понятно, откуда сумма взялась. -->
    <input class="input" id="ecNote" placeholder="${isAutoCarry(curNote) ? 'причина — впишите, если правите сумму сами' : 'причина (необязательно)'}" autocomplete="off" style="margin-top:8px" value="${isAutoCarry(curNote) ? '' : esc(curNote || '')}">
    ${isAutoCarry(curNote) ? `<div class="msub" style="margin-top:4px">Сейчас стоит автоматически: «${esc(curNote)}». Сохраните — и перенос станет ручным: пересчёт его больше не тронет.</div>` : ''}
    <div class="msub" style="margin-top:8px">Эта сумма <b>вычтется</b> из «Осталось выдать» за месяц.
      Если переплата больше начисления, остаток снова уйдёт в минус и перейдёт дальше.
      Каждое изменение видно владельцу в журнале.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="ecNo">Отмена</button>
      ${cur ? `<button class="btn btn-ghost btn-sm" id="ecClear">Убрать</button>` : ''}
      <button class="btn btn-primary btn-sm" id="ecOk">${ICONS.check}Сохранить</button></div>`);
  modalOnClose2 = () => {};
  $('ecNo').onclick = closeModal2;
  $('ecVal').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('ecOk').click(); } };
  if (cur) $('ecClear').onclick = async () => {
    const b = $('ecClear'); if (b.disabled) return; b.disabled = true;
    try { await store.setCarry(empId, per, null); closeModal2();
      toast(ICONS.check + 'Перенос убран'); if (onDone) await onDone(); }
    catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
  $('ecOk').onclick = async () => {
    const b = $('ecOk'); if (b.disabled) return;
    let v;
    try { v = parseNum($('ecVal').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message || err, true); return; }
    if (!v) { toast('Укажите сумму переплаты', true); return; }
    b.disabled = true;
    try {
      const kop = -Math.round(v * 100), note = $('ecNote').value.trim() || null;
      if (kop === cur && (note || '') === (curNote || '')) { closeModal2(); return; }
      await store.setCarry(empId, per, kop, note);
      closeModal2(); toast(ICONS.check + 'Перенос записан'); if (onDone) await onDone();
    } catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
}
async function editSalary(empId, per, r, onDone) {
  const calc = (r.salary_kop || 0) / 100;
  let cur = null;
  try { cur = await store.getSalaryOverride(empId, per); } catch (e) {}
  showModal2(`<h3>Зарплата за месяц</h3>
    <div class="msub">${esc(periodLabel(per))} · сейчас <b>${rub(r.salary_kop)} ₽</b>${cur ? ' · задана вручную' : ' · посчитано по графику'}</div>
    <label class="flbl">Итоговая зарплата</label>
    <input class="input" id="esVal" inputmode="numeric" autocomplete="off" value="${fmt(Math.round(calc))}">
    <input class="input" id="esNote" placeholder="причина (необязательно): напр. «по ведомости, без графика»" autocomplete="off" style="margin-top:8px">
    <div class="msub" style="margin-top:8px">Своя сумма ЗАМЕНЯЕТ расчёт по графику — «осталось выдать» пересчитается от неё.
      Изменение видно владельцу в журнале и в «Требует внимания».</div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" id="esNo">Отмена</button>
      ${cur ? `<button class="btn btn-ghost btn-sm" id="esClear">Вернуть расчёт</button>` : ''}
      <button class="btn btn-primary btn-sm" id="esOk">${ICONS.check}Сохранить</button></div>`);
  $('esNo').onclick = closeModal2;
  $('esVal').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('esOk').click(); } };
  if (cur) $('esClear').onclick = async () => {
    const b = $('esClear'); if (b.disabled) return; b.disabled = true;
    try { await store.setSalaryOverride(empId, per, null); closeModal2();
      toast(ICONS.check + 'Вернулся расчёт по графику'); if (onDone) await onDone(); }
    catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
  $('esOk').onclick = async () => {
    const b = $('esOk'); if (b.disabled) return;
    let v;
    try { v = parseNum($('esVal').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (v == null || v <= 0) { toast('Укажите сумму больше 0 (или «Вернуть расчёт»)', true); return; }
    if (v > RATE_CONFIRM && !(await confirmBigAmounts([v]))) return;
    b.disabled = true;
    try {
      await store.setSalaryOverride(empId, per, Math.round(v * 100), $('esNote').value.trim() || null);
      closeModal2(); toast(ICONS.check + 'Зарплата ' + fmt(Math.round(v)) + ' ₽');
      if (onDone) await onDone();
    } catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
}
let hintSeq = 0;
function hint(text) {
  const id = 'hint' + (++hintSeq);
  return `<span class="hintbox"><button type="button" class="hintbtn" data-hint="${id}"
    aria-expanded="false" aria-label="Подробнее">?</button></span>
    <div class="hinttext" id="${id}" hidden>${text}</div>`;
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('.hintbtn');
  if (!b) return;
  const box = document.getElementById(b.dataset.hint); if (!box) return;
  const open = box.hidden;
  box.hidden = !open;
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
});
function wireHints() {}
function compactHeads() {
  document.querySelectorAll('.page-head p').forEach(p => {
    if (p.dataset.compact) return;
    p.dataset.compact = '1';
    const txt = p.innerHTML.trim();
    if (!txt || p.querySelector('.hintbtn')) return;
    p.innerHTML = hint(txt);
    wireHints(p);
  });
}
function wireFilterToggle(tools) {
  if (!tools || tools.querySelector('.filt-btn')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'filt-btn';
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'Фильтры');
  b.innerHTML = ICONS.tag + '<span>Фильтры</span>' + ICONS.chevD;
  b.onclick = () => {
    const open = tools.classList.toggle('filt-open');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    tools.dataset.filtOpen = open ? '1' : '0';
  };
  const chips = tools.querySelector('.jf-chips');
  if (chips && chips.nextSibling) tools.insertBefore(b, chips.nextSibling);
  else if (chips) tools.appendChild(b);
  else tools.insertBefore(b, tools.firstChild);
  if (tools.dataset.filtOpen === '1') tools.classList.add('filt-open');
}
async function payrollDialog(empId) {
  const r = payrollRows.find(x => x.employee_id === empId); if (!r) return;
  const per = payPeriod;
  const my = linesFor(r);
  const canEdit = worksWithPayroll();
  const emp = employees.find(e => e.id === empId);
  const inPeriod = l => l.valid_from < nextPeriodStart(per) && (!l.valid_to || l.valid_to > per + '-01');
  const periodLines = (emp && emp.lines ? emp.lines : []).filter(inPeriod);
  const pctLine = periodLines.find(l => l.pay_kind === 'процент');
  const piece = periodLines.some(l => l.pay_kind === 'сдельно');
  let oNotes = {};
  if (r.nach_other_kop || r.uderz_other_kop || r.pay_other_kop) {
    try { oNotes = otherNotes(await store.listMoneyEvents(empId, per)); }
    catch (e) { console.warn('listMoneyEvents:', e); }
  }
  let curRev = 0, sboyChteniya = [];
  if (pctLine && canEdit) {
    try { curRev = await store.getDoctorRevenue(empId, per); }
    catch (e) { sboyChteniya.push('выручку'); console.warn('getDoctorRevenue:', e); }
  }
  let curEst = null;
  if (canEditEstimate()) {
    try {
      curEst = (await store.listEstimates(per)).filter(x => x.employee_id === empId)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] || null;
    } catch (e) { console.warn('listEstimates:', e); }
  }
  let curOverride = null;
  let sboyOverride = false;
  if (canEdit) {
    try { curOverride = await store.getSalaryOverride(empId, per); }
    catch (e) { sboyOverride = true; sboyChteniya.push('заданную вручную сумму'); console.warn('getSalaryOverride:', e); }
  }
  if (payPeriod !== per || curScreen !== 'payroll') return;
  setEditing('payroll:' + empId + ':' + per);
  const _nrm = payrollNorms.get(empId);
  const nh = _nrm && _nrm.hours != null ? parseFloat(_nrm.hours) : null;
  const breakdown = my.length
    ? my.map(l => { const f = rateFormula(l, r, nh, emp);
        return `<div class="me-row me-calc"><span class="muted">${esc(payKindLabel(l.kind))}${l.sub ? ' · ' + esc(l.sub) : ''}${l.isPct ? '' : ` · ${l.worked} из ${l.planned}`}${
          f ? `<i class="me-f">${esc(f)}</i>` : ''}</span><b>${rub(l.money_kop)} ₽</b></div>`; }).join('')
    : `<div class="me-row"><span class="muted">${
        r.flag_manual_salary ? 'Сумма вписана вручную — расчёт по графику не применялся'
        : piece ? 'Сдельно — сумму за месяц вписывают ниже'
        : r.flag_no_rate && !payNotByShift(r.employee_id, payPeriod)
          ? 'Вид смены из графика не связан ни с одной ставкой — такой день оплачен нулём'
          : 'Начислений за месяц нет'
      }</span>${r.flag_manual_salary || piece ? '' : '<b>0 ₽</b>'}</div>`;
  const pct = '';
  const estBase = r.fact_required ? (+r.salary_marked_kop || 0) : (+r.salary_kop || 0);
  const estEarnedKop = !curEst ? null
    : curEst.kind === 'выручка'
      ? (pctLine ? Math.round(curEst.amount_kop * (+pctLine.percent || 0) / 100) : null)
      : curEst.amount_kop;
  showModal(`${personHead({ fio: r.fio, specialty_id: emp?.specialty_id },
      `${esc(periodLabel(per))} · ${(() => {
        const fh = Number(r.fact_hours) || 0;
        return nh != null ? `норма ${fmtH(nh)} · факт ${fmtH(fh)}`
                          : `норма ${r.norm_days} дн · факт ${r.fact_days} дн`;
      })()}`)}
    ${sboyChteniya.length ? `<div class="mwarn">${ICONS.alert} Не удалось прочитать ${esc(sboyChteniya.join(' и '))} —
      поле ниже может выглядеть пустым, хотя значение задано. Закройте окно и откройте заново;
      если повторится, не вписывайте своё — скажите Дарине.</div>` : ''}
    <div class="rc-diff">
      <div class="me-cap">Заработано</div>
      ${breakdown}${pct}
      <div class="me-row me-sum${canEdit ? ' me-tap' : ''}"${canEdit ? ' id="pmSalaryRow" title="Задать итоговую зарплату вручную"' : ''}><span>Зарплата${r.flag_manual_salary ? ' · <b class="jact">вручную</b>' : ''}</span><b>${rub(r.salary_kop)} ₽</b>${canEdit ? `<span class="me-pen">${ICONS.pencil || '✎'}</span>` : ''}</div>
      ${payRow('Премия', r.premia_kop, 'premia', canEdit)}
      ${payRow('Отпускные начислено', r.otpusk_nach_kop, 'otpusk_nach', canEdit)}
      ${payRow('Больничные начислено', r.bolnich_nach_kop, 'bolnich_nach', canEdit)}
      ${payRow('Своё начисление', r.nach_other_kop, 'nach_other', canEdit, oNotes.nach_other)}
      <div class="me-row me-sum me-earned"><span>Всего заработано</span><b class="money">${rub(earned(r))} ₽</b></div>
      ${markedRow(r)}
      ${forecastRow(r)}
      ${cardBlock(r) ? '<div class="me-cap">На карту</div>' : ''}
      ${payRow('Аванс на карту', r.card_avans_kop, 'card_avans', canEdit)}
      ${payRow('ЗП на карту', r.card_rasch_kop, 'card_rasch', canEdit)}
      ${payRow('Расчёт на карту (увольнение)', r.card_uvol_kop, 'card_uvol', canEdit)}
      ${payRow('Отпускные на карту', r.otpusk_kop, 'otpusk', canEdit)}
      ${payRow('Больничные на карту', r.bolnich_kop, 'bolnich', canEdit)}
      ${payRow('Удержание', r.uderz_other_kop, 'uderz_other', canEdit, oNotes.uderz_other)}
      ${payRow('Прочая выплата', r.pay_other_kop, 'pay_other', canEdit, oNotes.pay_other)}
      ${cardBlock(r) ? `<div class="me-row me-sum me-card"><span>Всего перечислено</span><b class="money">${rub(cardBlock(r))} ₽</b></div>` : ''}
      ${(r.cash_kop || r.cash_avans_kop || r.otpusk_cash_kop) ? '<div class="me-cap">Дополнительные поступления</div>' : ''}
      ${payRow('Аванс наличными', r.cash_avans_kop, 'cash_avans', canEdit)}
      ${payRow('Наличными', r.cash_kop, 'cash', canEdit)}
      ${payRow('Отпускные наличными', r.otpusk_cash_kop, 'otpusk_cash', canEdit)}
      ${handBlock(r) ? `<div class="me-row me-sum me-hand"><span>Всего дополнительно</span><b class="money">${rub(handBlock(r))} ₽</b></div>` : ''}
      ${r.carry_kop || canEdit ? `<div class="me-row me-sum cp-carry${canEdit ? ' me-tap' : ''}"${canEdit ? ' title="Изменить или убрать перенос"' : ''}>
        <span class="muted">С прошлого месяца</span><b class="money${(r.carry_kop || 0) < 0 ? ' neg' : ''}">${r.carry_kop ? rub(r.carry_kop) + ' ₽' : '—'}</b>
        ${canEdit ? '<span class="me-pen">\u270E</span>' : ''}</div>` : ''}
      ${
''}
      <div class="me-row me-sum"><span>Осталось выдать${hint(
        `${r.fact_required && r.salary_marked_kop != null && +r.salary_marked_kop < (+r.salary_kop || 0) ? '<b>Подтверждено фактом</b>' : '<b>Заработано</b>'} − <b>на карту</b> − <b>дополнительные поступления</b> + перенос с прошлого месяца. Столько ещё раздать наличными.<br>Начисленные отпускные и больничные <b>входят</b> в заработок, а выплаченные — вычитаются: если начислили и выплатили поровну, на разницу они не влияют. Удержания (алименты и прочее) стоят в блоке «На карту» — они тоже уменьшают выдачу.`
      )}</span><b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)} ₽</b></div>
      ${r.to_pay_kop ? `<div class="me-row"><span class="muted small">Записано в кассу наличными (Бух 1)</span><span class="small">${rub(r.to_pay_kop)} ₽</span></div>` : ''}</div>

    ${
      canEditEstimate() && !estBase ? `
      <label class="flbl">Примерно наработано${curEst ? ` · внесено ${esc(fmtDT(curEst.updated_at))}` : ''}${hint(
        'Программа не видит, сколько человек наработал: нет отметок в графике или не внесена выручка. Впишите примерную сумму — рядом покажем, каким будет остаток с учётом уже выданного аванса. На расчёт это не влияет, каждая правка видна владельцу в журнале.')}</label>
      <div class="me-add">
        ${pctLine ? `<div class="cselect pm-kind" id="pmEstKind"></div>` : ''}
        <input class="input" id="pmEst" placeholder="примерно ₽" autocomplete="off" inputmode="numeric"
               value="${curEst ? fmt(Math.round(curEst.amount_kop / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmEstSave">${ICONS.check}${curEst ? 'Изменить' : 'Записать'}</button>
        ${curEst ? `<button class="btn btn-ghost btn-sm" id="pmEstClear">Убрать</button>` : ''}
      </div>
      ${curEst ? (() => {
        if (estEarnedKop == null) return `<div class="me-row"><span class="muted small">
          Это выручка, а процент в карточке не заведён — пересчитать её в заработок не из чего.
          Впишите «Заработок», если сумма уже посчитана.</span></div>`;
        const bud = deltaAs(r, estEarnedKop);
        return `${curEst.kind === 'выручка' ? `<div class="me-row"><span class="muted small">
            ${fmt(Math.round(curEst.amount_kop / 100))} ₽ выручки · ${esc(String(pctLine.percent))}% =
            <b>${rub(estEarnedKop)} ₽</b> заработка</span></div>` : ''}
          <div class="me-row me-sum"><span>С учётом этой суммы осталось</span>
          <b class="money${bud < 0 ? ' neg' : ''}">${rub(bud)} ₽</b></div>
          <div class="msub">${bud < 0
            ? 'Аванса выдано больше — переплата перейдёт на следующую оплату.'
            : 'Переплаты нет: выдано меньше, чем наработано.'}</div>`;
      })() : ''}` : ''}
    ${pctLine && canEdit ? `<label class="flbl">Выручка за месяц · ЗП = ${esc(String(pctLine.percent))}% от неё${hint(
        'Оплаты пациентов пока вносятся неполно, поэтому сумму называют здесь. От неё и считается зарплата. Изменение выручки видит владелец — в журнале.')}</label>
      <div class="me-add">
        <input class="input" id="pmRev" placeholder="выручка ₽" autocomplete="off" inputmode="numeric" value="${curRev ? fmt(Math.round(curRev / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmRevSave">${ICONS.check}Сохранить</button>
      </div>
      ` : ''}
    ${canSetFinalSum() ? `<label class="flbl">${piece ? 'Сумма за месяц · сдельно' : 'Финальная сумма вручную'}${r.flag_manual_salary ? ' · <span class="jact">задана</span>' : ''}${hint(
        `${piece ? 'У этого человека вид оплаты «сдельно» — сумму за месяц называют готовым числом, это штатный путь, а не исключение. ' : 'Для людей без графика: '}Итоговая зарплата за месяц одной суммой. Заменяет расчёт → «осталось» = эта сумма − выданное на карту/наличными. Причина и каждое изменение видны владельцу — в журнале и в «Требует внимания».`
      )}</label>
      <div class="me-add">
        <input class="input" id="pmFinal" placeholder="итоговая зарплата ₽" autocomplete="off" inputmode="numeric" value="${curOverride ? fmt(Math.round(curOverride / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmFinalSave"${sboyOverride ? ' disabled title="Сумма не прочиталась — сохранять вслепую нельзя"' : ''}>${ICONS.check}${r.flag_manual_salary ? 'Изменить' : 'Задать'}</button>
        ${r.flag_manual_salary ? `<button class="btn btn-ghost btn-sm" id="pmFinalClear">Убрать</button>` : ''}
      </div>
      <input class="input" id="pmFinalNote" placeholder="причина (необязательно): напр. «по ведомости, без графика»" autocomplete="off" style="margin-top:8px;width:100%">
      ` : ''}
    ${canEdit ? `<label class="flbl">Внести деньги${hint(
        `Записи не правятся — ошибку исправляют сторно: обе записи, ошибочная и встречная, остаются видны владельцу, и видно, что именно поправили.${store.me()?.role === 'operator' ? ' Премию вносит владелец.' : ''}`
      )}</label>
      <div class="me-add">
        <div class="cselect pm-kind" id="pmKind"></div>
        <input class="input" id="pmSum" placeholder="сумма ₽" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="pmAdd">${ICONS.plus}Внести</button>
      </div>` : ''}
    ${canEdit && recorded(r) ? `<div class="me-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" id="pmUndoAll">Убрать все выплаты за месяц</button>${hint('Если начислили лишнего всем скопом — уберёт все выплаты этого человека за месяц. Каждая снятая запись остаётся в журнале.')}</div>` : ''}
    <div class="me-jump">
      <button class="btn btn-ghost btn-sm" id="pmToCard">${ICONS.user || ''}Карточка</button>
      <button class="btn btn-ghost btn-sm" id="pmToSched">${ICONS.calendar || ''}График</button>
    </div>
    ${canPayOut() ? `<label class="flbl" style="margin-top:12px">Выдача наличных на руки${hint(
        'Подтверждаете вы — СМС-кода нет. Запись сразу уходит владельцу в журнал: кому, сколько и когда. Ошиблись — «Отменить»: запись останется, рядом встанет минусовая.')}</label>
      <div id="pmPay" class="pm-pay"><span class="muted small">загружаем…</span></div>` : ''}
    <label class="flbl" style="margin-top:12px">Кто внёс и когда</label>
    <div id="pmHist" class="pm-hist"><span class="muted small">загружаем…</span></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="pmClose">Закрыть</button></div>`);
  $('modalBox').dataset.guard = '1';
  const reopen = async () => { await renderPayroll($('payrollSearch')?.value || ''); closeModal(); payrollDialog(empId); };
  $('modalBox').querySelectorAll('.me-row.me-tap[data-kind]').forEach(el => el.onclick = () => editPayout(empId, per, el.dataset.kind, reopen));
  $('modalBox').querySelectorAll('.cp-carry.me-tap').forEach(el => el.onclick = () => editCarry(empId, per, reopen, r));
  if ($('pmSalaryRow')) $('pmSalaryRow').onclick = () => editSalary(empId, per, r, reopen);
  { const kb = $('pmKind');
    if (kb) { const o = moneyKindOpts(store.me()?.role);
      makeDropdown(kb, o, (o.find(x => !x.head) || {}).v || '', () => {}); } }
  { const kb = $('pmEstKind');
    if (kb) {
      const opts = [{ v: 'заработок', label: 'Заработок' }, { v: 'выручка', label: 'Выручка' }];
      makeDropdown(kb, opts, curEst ? curEst.kind : 'выручка', () => {});
    } }
  if ($('pmEstSave')) $('pmEstSave').onclick = async () => {
    const b = $('pmEstSave'); if (b.disabled) return;
    let val;
    try { val = parseNum($('pmEst').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (e) { return toast(e.message || e, true); }
    const kind = $('pmEstKind') ? $('pmEstKind').dataset.value : 'заработок';
    b.disabled = true;
    try {
      await store.saveEstimate(empId, per, kind, Math.round(val * 100));
      if (curEst && curEst.kind !== kind) {
        try { await store.delEstimate(empId, per, curEst.kind); } catch (e) { console.warn('delEstimate:', e); }
      }
      toast(ICONS.check + 'Записано');
      closeModal(); payrollDialog(empId);
    } catch (e) { b.disabled = false; toast(e.message || e, true); }
  };
  if ($('pmEst')) $('pmEst').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pmEstSave').click(); } };
  if ($('pmEstClear')) $('pmEstClear').onclick = async () => {
    const b = $('pmEstClear'); if (b.disabled) return;
    b.disabled = true;
    try {
      await store.delEstimate(empId, per, curEst.kind);
      toast(ICONS.check + 'Убрано');
      closeModal(); payrollDialog(empId);
    } catch (e) { b.disabled = false; toast(e.message || e, true); }
  };
  if ($('pmUndoAll')) $('pmUndoAll').onclick = () => undoAllPayouts(empId, per, reopen);
  if ($('pmToCard')) $('pmToCard').onclick = () => focusOn('employees', empId) || openCard(empId);
  if ($('pmToSched')) $('pmToSched').onclick = () => focusOn('schedule', empId);
  $('pmClose').onclick = closeModal;
  $('modalBox').dataset.pmEmp = String(empId);
  const моё = () => $('pmPay') && $('modalBox').dataset.pmEmp === String(empId)
    && $('modalOv').classList.contains('show');
  const loadPay = async () => {
    if (!моё()) return;
    try {
      const list = await store.listPayouts(empId, per);
      if (!моё()) return;
      const дано = list.reduce((s, p) => s + (p.amount_kop || 0), 0);
      const назначено = r.delta_kop || 0;
      const осталось = назначено - дано;
      const отменено = new Set(list.filter(p => p.reverses_id).map(p => p.reverses_id));
      const строки = list.filter(p => !p.reverses_id).map(p => {
        const мёртвая = отменено.has(p.id);
        return `<div class="pm-ev${мёртвая ? ' pm-dead' : ''}">
          <span><b>${rub(p.amount_kop)} ₽</b>${p.is_self_payout ? ' <b class="jact">себе</b>' : ''}
            ${мёртвая ? '' : `<button class="btn btn-ghost btn-sm pm-unpay" data-id="${p.id}">Отменить</button>`}</span>
          <span class="muted small">${esc(fmtDT(p.confirmed_at))}${p.note ? ' · ' + esc(p.note) : ''}${мёртвая ? ' · отменено' : ''}</span>
        </div>`;
      }).join('');
      $('pmPay').innerHTML =
        `<div class="me-row"><span class="muted">Осталось выдать за месяц</span><b class="money${назначено < 0 ? ' neg' : ''}">${rub(назначено)} ₽</b></div>
         <div class="me-row"><span class="muted">Уже выдано на руки</span><b class="money">${rub(дано)} ₽</b></div>
         <div class="me-row me-sum"><span>К выдаче сейчас</span><b class="money${осталось < 0 ? ' neg' : ''}">${rub(осталось)} ₽</b></div>
         <div class="me-add" style="margin-top:8px">
           <input class="input" id="pmPaySum" placeholder="сумма ₽" autocomplete="off" inputmode="numeric"
             value="${осталось >= 100 ? fmt(Math.floor(осталось / 100)) : ''}">
           <button class="btn btn-primary btn-sm" id="pmPayGive">${ICONS.check}Выдал</button>
         </div>
         ${
''}
         ${строки || '<span class="muted small">Наличными на руки пока не выдавали</span>'}`;
      $('pmPaySum').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pmPayGive').click(); } };
      $('pmPayGive').onclick = async () => {
        const b = $('pmPayGive'); if (b.disabled) return;
        let руб;
        try { руб = parseNum($('pmPaySum').value, { field: 'сумму выдачи', thousands: true, max: RATE_ABSURD }); }
        catch (err) { return toast(err.message, true); }
        if (руб == null || руб <= 0) return toast('Укажите сумму больше 0', true);
        if (руб > RATE_CONFIRM && !(await confirmBigAmounts([руб]))) return;
        const kop = Math.round(руб * 100);
        const заЧто = await confirmGive(r.fio, kop, per, осталось);
        if (заЧто === null) return;
        b.disabled = true;
        try {
          await store.payoutGive(empId, per, kop, заЧто);
          toast(ICONS.check + 'Выдано ' + rub(kop) + ' ₽');
        } catch (e) { toast(e.message || e, true); }
        finally {
          await loadPay();
          if ($('pmPayGive')) $('pmPayGive').disabled = false;
        }
      };
      $('pmPay').querySelectorAll('.pm-unpay').forEach(b => b.onclick = async () => {
        const p = list.find(x => x.id === +b.dataset.id); if (!p) return;
        const причина = await confirmUnpay(r.fio, p.amount_kop);
        if (причина === null) return;
        b.disabled = true;
        try { await store.payoutReverse(p.id, причина); toast('Выдача отменена'); }
        catch (e) { toast(e.message || e, true); }
        finally { await loadPay(); }
      });
    } catch (e) {
      if (моё()) $('pmPay').innerHTML = `<span class="muted small">Не удалось загрузить выдачи: ${esc(e.message || e)}</span>`;
    }
  };
  loadPay();
  const loadHist = async () => {
    try {
      const ev = await store.listMoneyEvents(empId, per);
      const reversed = new Set(ev.filter(e => e.reverses_id).map(e => e.reverses_id));
      $('pmHist').innerHTML = ev.length ? ev.map(e => {
        const isStorno = !!e.reverses_id, isDead = reversed.has(e.id);
        const canRev = canEdit && !isStorno && !isDead;
        return `<div class="pm-ev${isDead ? ' pm-dead' : ''}${isStorno ? ' pm-storno' : ''}">
          <span>${isStorno ? '<b class="jact">СТОРНО</b> ' : ''}${esc(e.kind_label || moneyKindLabel(e.kind))}
            <b>${rub(e.amount_kop)} ₽</b>
            ${canRev ? `<button class="btn btn-ghost btn-sm pm-rev" data-id="${e.id}">Сторнировать</button>` : ''}</span>
          <span class="muted small">${esc(e.entered_by_name || '—')} · ${esc(fmtDT(e.created_at))}
            · ${e.is_import ? 'из импорта' + (e.import_file ? ': ' + esc(e.import_file) : '') : 'вручную'}${e.note ? ' · ' + esc(e.note) : ''}
            ${isDead ? ' · исправлено сторно' : ''}</span>
        </div>`;
      }).join('') : '<span class="muted small">Записей пока нет</span>';
      $('pmHist').querySelectorAll('.pm-rev').forEach(b => b.onclick = async () => {
        const row = ev.find(x => x.id === +b.dataset.id); if (!row) return;
        if (!(await confirmStorno(row))) return;
        b.disabled = true;
        try {
          await store.reverseMoneyLine(row);
          await renderPayroll($('payrollSearch')?.value || '');
          toast(ICONS.check + 'Сторно внесено — обе записи видны в журнале');
          closeModal(); payrollDialog(empId);
        } catch (err) { b.disabled = false; toast(err.message || err, true); }
      });
    } catch (e) { $('pmHist').innerHTML = `<span class="muted small">${esc(e.message || e)}</span>`; }
  };
  loadHist();
  if (canEdit) $('pmSum').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pmAdd').click(); } };
  if (canEdit) $('pmAdd').onclick = async () => {
    const btn = $('pmAdd'); if (btn.disabled) return;
    let sum;
    try { sum = parseNum($('pmSum').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (sum == null || sum <= 0) { toast('Укажите сумму больше 0', true); return; }
    if (sum > RATE_CONFIRM && !(await confirmBigAmounts([sum]))) return;
    btn.disabled = true;
    try {
      await store.addMoneyLine({ employee_id: empId, period: per,
        kind: $('pmKind').dataset.value, amount_kop: Math.round(sum * 100) });
      $('pmSum').value = '';
      await renderPayroll($('payrollSearch')?.value || '');
      const fresh = payrollRows.find(x => x.employee_id === empId);
      if (fresh) toast(ICONS.check + 'Внесено · к выдаче ' + rub(fresh.to_pay_kop) + ' ₽');
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  if (pctLine && canEdit) $('pmRevSave').onclick = async () => {
    const btn = $('pmRevSave'); if (btn.disabled) return;
    let rev;
    try { rev = parseNum($('pmRev').value, { thousands: true, field: 'выручку', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (rev == null || rev < 0) { toast('Укажите выручку (0 — убрать)', true); return; }
    btn.disabled = true;
    try {
      const res = await store.setDoctorRevenue(empId, per, Math.round(rev * 100));
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + (res ? 'Выручка внесена — зарплата пересчитана' : 'Без изменений'));
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  if (canSetFinalSum()) $('pmFinal').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pmFinalSave').click(); } };
  if (canSetFinalSum()) $('pmFinalSave').onclick = async () => {
    const btn = $('pmFinalSave'); if (btn.disabled) return;
    let val;
    try { val = parseNum($('pmFinal').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (val == null || val <= 0) { toast('Укажите сумму больше 0 (или «Убрать»)', true); return; }
    if (val > RATE_CONFIRM && !(await confirmBigAmounts([val]))) return;
    btn.disabled = true;
    try {
      const note = $('pmFinalNote')?.value.trim() || null;
      await store.setSalaryOverride(empId, per, Math.round(val * 100), note);
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + 'Финальная сумма задана — «осталось» пересчитано');
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  if (canSetFinalSum() && r.flag_manual_salary) $('pmFinalClear').onclick = async () => {
    const btn = $('pmFinalClear'); if (btn.disabled) return;
    btn.disabled = true;
    try {
      await store.setSalaryOverride(empId, per, null);
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + 'Финальная сумма убрана — вернулся расчёт по графику');
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
let ovPeriod = null, ovData = null, ovSeq = 0;
function shiftOvMonth(d) { if (!ovPeriod) ovPeriod = nowPeriod(); let [y, m] = ovPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } ovPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = ovPeriod; syncHash(false); renderOverview(); }
const OV_ALERTS = [
  { key: 'flag_money_without_calc', red: true, t: 'Деньги есть, а расчёта нет', d: 'выплата без начисления под ней' },
  { key: r => recorded(r) > 0 && Math.abs(r.delta_kop || 0) > 10000, red: true, t: 'Расхождение: начислено ≠ записано', d: 'записанные деньги не сходятся с расчётом' },
  { key: 'flag_manual_salary', red: false, t: 'Сумма задана вручную', d: 'зарплата вписана рукой, не из графика — сверьте с выданным' },
  { key: 'flag_no_data', red: false, t: 'График есть, а денег ноль', d: 'человек работал, но ничего не начислено' },
  { key: 'flag_oklad_no_days', red: false, t: 'Оклад есть, отработанных дней ноль', d: 'оклад не на что начислить' },
  { key: 'flag_pct_no_rate', red: false, t: 'Процент без ставки', d: 'оплаты пациентов есть, а ставки процента нет' },
  { key: r => r.flag_no_rate && !payNotByShift(r.employee_id, ovPeriod), red: true,
    t: 'Вид смены не связан со ставкой', d: 'такой день оплатится нулём — в карточке нет ставки под этот вид смены' },
  { key: 'flag_partial_month', red: false, t: 'Неполный месяц', d: 'приём или увольнение в середине месяца' },
];
async function renderOverview(reset = true) {
  if (!isOwner()) { $('overviewBody').innerHTML = ''; return; }
  if (!ovPeriod) ovPeriod = nowPeriod();
  const want = ovPeriod, seq = ++ovSeq;
  $('oLabel').textContent = periodLabel(want);
  let rows, remarks, payouts, prevRem, marked;
  try {
    [rows, remarks, payouts, prevRem, marked] = await Promise.all([
      store.listPayroll(want), store.listRedRemarks(6), store.listRecentPayouts(5, want),
      store.listPrevRemainder(want).catch(e => { console.warn('listPrevRemainder:', e); return null; }),
      store.listMonthMarked(want).catch(e => { console.warn('listMonthMarked:', e); return []; }),
    ]);
  } catch (e) { if (seq === ovSeq) { toast(e.message || e, true); ovPeriod = ovData?.period || want; workPeriod = ovPeriod; $('oLabel').textContent = periodLabel(ovPeriod); syncHash(false); } return; }
  if (seq !== ovSeq) return;
  ovData = { rows, remarks, payouts: payouts?.list || [], aheadCnt: payouts?.ahead || 0, period: want, prevRem, marked };
  zapomnitArhivnyeDolgi(rows);
  $('oLabel').textContent = periodLabel(want);
  drawOverview();
}
function drawOverview() {
  paintMonthNav();
  if (!ovData) return;
  const { rows, remarks, payouts, aheadCnt, prevRem } = ovData;
  const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const salary = sum('salary_kop');
  const toGive = rows.reduce((a, r) => a + Math.max(0, r.delta_kop || 0), 0);
  const overpaid = rows.reduce((a, r) => a + Math.min(0, r.delta_kop || 0), 0);
  const overCnt = rows.filter(r => (r.delta_kop || 0) < 0).length;
  const card = sum('card_rasch_kop') + sum('card_avans_kop') + sum('otpusk_kop') + sum('bolnich_kop');
  const uvol = sum('card_uvol_kop');
  const paid = sum('paid_kop');
  const premia = sum('premia_kop'), otpNach = sum('otpusk_nach_kop'), bol = sum('bolnich_nach_kop');
  const othNach = sum('nach_other_kop'), othUderz = sum('uderz_other_kop'), othPay = sum('pay_other_kop');
  const accrued = salary + premia + otpNach + bol + othNach - othUderz;
  const marked = sum('salary_marked_kop');
  const forecast = sum('salary_plan_kop');
  const hasMarked = rows.some(r => r.salary_marked_kop != null) && rows.some(r => r.fact_required);
  const waiting = Math.max(0, salary - marked);
  const carry = sum('carry_kop');
  const cash = sum('cash_kop') + sum('cash_avans_kop') + sum('otpusk_cash_kop');
  const people = rows.filter(r => r.status === 'active').length;
  const ovFcast = prevMonthForecast(rows, prevRem, new Set((ovData.marked || []).map(m => m.employee_id)));
  const metric = (l, v, cls, gc) => `<div class="ov-metric${cls ? ' ' + cls : ''}"${gc ? ` style="--gc:${gc}"` : ''}><div class="l">${l}</div><div class="v">${v}</div></div>`;
  const line = (l, v, cls) => `<div class="ov-line${cls ? ' ' + cls : ''}"><span>${l}</span><b>${v}</b></div>`;
  const hero = `<div class="ov-hero"><div class="l">Осталось выдать · ${esc(periodLabel(ovData.period))}</div>`
    + `<div class="v big">${rub(toGive)} <small>₽</small></div>`
    + (overpaid ? `<div class="ov-over">Переплата вперёд: <b>−${rub(Math.abs(overpaid))} ₽</b>`
        + `<span class="muted small"> · ${overCnt} чел · выдано больше начисленного, перейдёт на следующую оплату</span></div>` : '')
    + `<div class="ov-break">`
      + line('Начислено сейчас', rub(accrued) + ' ₽', 'sum')
      + line('· зарплата по графику', rub(salary) + ' ₽', 'sub')
      + (hasMarked && waiting ? line('из них подтверждено фактом', rub(marked) + ' ₽', 'sub sub2 ov-marked') : '')
      + (hasMarked && waiting ? line('ждёт отметок — в выдачу не идёт', rub(waiting) + ' ₽', 'sub sub2 ov-waiting') : '')
      + (premia ? line('· премии', rub(premia) + ' ₽', 'sub') : '')
      + (otpNach ? line('· отпускные', rub(otpNach) + ' ₽', 'sub') : '')
      + (bol ? line('· больничные', rub(bol) + ' ₽', 'sub') : '')
        + (othNach ? line('· прочие начисления', rub(othNach) + ' ₽', 'sub') : '')
        + (othUderz ? line('· удержания', '−' + rub(othUderz) + ' ₽', 'sub') : '')
      + (carry ? line('С прошлого месяца', (carry < 0 ? '−' : '') + rub(Math.abs(carry)) + ' ₽', 'sub neg') : '')
      + (hasMarked && (forecast > salary || ovFcast.sum)
          ? line('К концу месяца', rub(forecast + (accrued - salary) + ovFcast.sum) + ' ₽', 'sum ov-fcast-line')
            + line('· зарплата по графикам', rub(forecast) + ' ₽', 'sub')
            + (accrued - salary ? line('· премии, отпускные и прочее', rub(accrued - salary) + ' ₽', 'sub') : '')
            + (ovFcast.sum ? line(`· прогноз по ${ovFcast.who.length} без графика`, rub(ovFcast.sum) + ' ₽', 'sub') : '')
          : '')
      + line('Выдано', rub(card + uvol + cash + othPay) + ' ₽', 'sum')
      + line('· на карту', rub(card) + ' ₽', 'sub')
      + (uvol ? line('· расчёт при увольнении', rub(uvol) + ' ₽', 'sub') : '')
      + (cash ? line('· наличными (записано в расчёте)', rub(cash) + ' ₽', 'sub') : '')
        + (othPay ? line('· прочие выплаты (алименты, займы)', rub(othPay) + ' ₽', 'sub') : '')
    + `</div></div>`;
  const bento = `<div class="ov-bento">`
    + metric('Начислено сейчас', rub(accrued) + ' ₽', '', 'rgba(139,123,232,.34)')
    + (hasMarked && (forecast > salary || ovFcast.sum)
        ? metric('К концу месяца', rub(forecast + (accrued - salary) + ovFcast.sum) + ' ₽', 'ov-fcast', 'rgba(139,123,232,.34)')
        : '')
    + metric('Выдано на карту', rub(card) + ' ₽', '', 'rgba(62,115,216,.34)')
    + metric('Выдано наличными', rub(cash) + ' ₽', '', 'rgba(31,165,101,.4)')
    + (paid ? metric('Проведено кассой', rub(paid) + ' ₽', '', 'rgba(31,165,101,.4)') : '')
    + metric('Сотрудников', fmt(people), '', 'rgba(224,153,42,.34)')
    + `</div>`
    + (hasMarked && ovFcast.sum ? `<div class="ov-fnote">Прогноз по ${ovFcast.who.length} ${plural(ovFcast.who.length, 'человеку', 'людям', 'людям')}
        без графика — их сумма за ${esc(periodLabel(ovFcast.period).toLowerCase())}, это догадка, а не расчёт.
        Заведите им график, и она сменится расчётом.</div>` : '');
  const flagAlerts = OV_ALERTS.map(a => {
    const test = typeof a.key === 'function' ? a.key : (r => r[a.key]);
    const n = rows.filter(test).length;
    return n ? `<button class="ov-alert${a.red ? ' red' : ''}" data-go="payroll"><span class="oa-ic">${a.red ? ICONS.alert : ICONS.info}</span><div><div class="oa-t">${esc(a.t)} · ${n}</div><div class="oa-d">${esc(a.d)}</div></div></button>` : '';
  }).filter(Boolean);
  const remarkAlerts = (remarks || []).slice(0, 4).map(j =>
    `<button class="ov-alert red" data-go="journal-red"><span class="oa-ic">${ICONS.alert}</span><div><div class="oa-t">${esc(J_FIELD[j.field] || j.field || 'запись')}${j.new_value ? ' · ' + esc(j.new_value) : ''}</div><div class="oa-d">${esc(j.actor || '')} · ${esc(fmtDT(j.at))}</div></div></button>`);
  const aheadAlert = aheadCnt
    ? `<button class="ov-alert red" data-go="journal-payout"><span class="oa-ic">${ICONS.alert}</span><div><div class="oa-t">Выдано вперёд · ${aheadCnt}</div><div class="oa-d">на руки отдали больше, чем человек заработал к тому дню — проверьте, что так и задумано</div></div></button>`
    : '';
  const alerts = [aheadAlert, ...flagAlerts, ...remarkAlerts].filter(Boolean);
  const attention = alerts.length
    ? alerts.join('')
    : `<div class="ov-alert ok"><span class="oa-ic">${ICONS.check}</span><div><div class="oa-t">Всё в порядке</div><div class="oa-d">крупных расхождений, переплат и пробелов не видно</div></div></div>`;
  const paysHtml = (payouts && payouts.length) ? payouts.map(p =>
    `<div class="jrow"><div class="oa-ic" style="color:var(--green)">${ICONS.check}</div><div style="flex:1"><div style="font-weight:700;font-size:13.5px">${esc(p.fio || '—')}${p.is_self_payout ? ' <span class="pd-rev">себе</span>' : ''}</div><div class="who">${p.code_sent_at ? 'подтверждено кодом' : 'выдано без кода'} · ${esc(fmtDT(p.confirmed_at))}</div></div><div class="fin" style="font-weight:700;color:var(--green-d)">${rub(p.amount_kop)} ₽</div></div>`).join('')
    : `<div class="jrow" style="border:none"><div style="flex:1;color:var(--ink-3);font-size:13px">Выдач ещё не было</div></div>`;
  $('overviewBody').innerHTML = hero + bento
    + `<div class="ov-sec">Требует внимания</div><div class="ov-alerts">${attention}</div>`
    + `<div class="ov-sec">Кто в программе</div><div class="card" id="ovPresence"><span class="muted small" style="padding:14px 18px;display:block">смотрим…</span></div>`
    + `<div class="ov-sec">Последние выдачи</div><div class="card">${paysHtml}</div>`
    + `<div class="note ov-note">${ICONS.lock}Все суммы — из неизменяемого журнала</div>`;
  drawPresenceBlock();
  $('overviewBody').querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    if (b.dataset.go === 'payroll' && ovPeriod) payPeriod = ovPeriod;
    if (b.dataset.go === 'journal-red') { journalFilter = 'red'; go('journal'); renderJournal(true); }
    else if (b.dataset.go === 'journal-payout') { journalFilter = 'payout'; go('journal'); renderJournal(true); }
    else go(b.dataset.go);
  });
}
let schedCenteredFor = null;
function centerToday() {
  const wrap = $('scheduleGrid') && $('scheduleGrid').closest('.gridwrap');
  if (!wrap || !wrap.clientWidth || schedCenteredFor === curPeriod) return;
  const den = wrap.querySelector('.gr-day.today');
  if (!den) return;
  schedCenteredFor = curPeriod;
  const imena = wrap.querySelector('.gr-corner');
  const zanyato = imena ? imena.getBoundingClientRect().width : 0;
  const vidno = wrap.clientWidth - zanyato;
  wrap.scrollLeft = Math.max(0, den.offsetLeft - zanyato - (vidno - den.offsetWidth) / 2);
}
function stickFooterRows(host) {
  if (!host) return;
  const rows = [...host.querySelectorAll('tfoot tr.pw-total')];
  if (!host.offsetParent && getComputedStyle(host).position !== 'fixed') return;
  if (window.matchMedia('(max-width:767px)').matches) {
    rows.forEach(r => { r.style.bottom = ''; });
    return;
  }
  let acc = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const h = rows[i].getBoundingClientRect().height;
    rows[i].style.bottom = acc + 'px';
    acc += h;
  }
}
let stickTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(stickTimer);
  stickTimer = setTimeout(() => stickFooterRows(document.getElementById('payrollTable')), 120);
});
const SCREEN_RU = { overview: 'Обзор', gaps: 'Пробелы', vacation: 'Отпуска', archive: 'Архив', employees: 'Сотрудники', card: 'Карточка',
  schedule: 'График', payroll: 'Расчёт', rates: 'Ставки', patients: 'Оплаты пациентов',
  import: 'Импорт', specialties: 'Отделения и специальности', journal: 'Журнал', soon: '—' };
function agoRu(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60);
  return h < 24 ? h + ' ч назад' : Math.floor(h / 24) + ' дн назад';
}
async function drawPresenceBlock() {
  const box = $('ovPresence'); if (!box) return;
  const rows = (await loadPresence()).filter(p => p.user_id !== store.me()?.id);
  if (!rows.length) { box.innerHTML = '<div class="jrow" style="border:none"><span class="muted small">Кроме вас сейчас никого</span></div>'; return; }
  rows.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || String(b.last_seen).localeCompare(String(a.last_seen)));
  box.innerHTML = rows.map(p => {
    const где = p.online && p.screen
      ? esc(SCREEN_RU[p.screen] || p.screen) + (p.period ? ' · ' + esc(periodLabel(String(p.period).slice(0, 7))) : '')
      : '';
    const правки = p.edits_hour > 0 ? `<span class="pill o">${p.edits_hour} правок за час</span>` : '';
    return `<div class="jrow"><div class="prs-dot${p.online ? ' on' : ''}"></div><div style="flex:1">
      <div style="font-weight:700">${esc(p.display_name || '—')} <span class="muted small">${esc(ROLE_LABELS[p.role] || p.role || '')}</span></div>
      <div class="who">${p.online ? 'в программе' + (где ? ' · ' + где : '') : esc(agoRu(p.last_seen))}</div>
      </div>${правки}</div>`;
  }).join('');
}
async function drawPresenceTop() {
  const el = $('presTop'); if (!el || isOwner()) return;
  const rows = (await loadPresence()).filter(p => p.user_id !== store.me()?.id && p.online);
  el.innerHTML = rows.length
    ? `<span class="prs-dot on"></span>${esc(rows.map(p => p.display_name).filter(Boolean).join(', '))}`
    : '';
}
let gapsPeriod = null, gapsData = null, gapsSeq = 0;
let vacPeriod = null, vacData = null, vacSeq = 0;
let vacKindF = '';
let arcRows = [], arcSeq = 0;
async function renderArchive() {
  if (!isOwner()) { $('arcBody').innerHTML = ''; return; }
  const seq = ++arcSeq;
  let emps, pay;
  try {
    [emps, pay] = await Promise.all([store.listEmployees(), store.listPayroll(payPeriod || nowPeriod())]);
  } catch (e) { if (seq === arcSeq) { $('arcBody').innerHTML = ''; toast(e.message || e, true); } return; }
  if (seq !== arcSeq) return;
  const money = new Map(pay.map(r => [r.employee_id, r]));
  zapomnitArhivnyeDolgi(pay);
  const arch = emps.filter(e => e.status === 'archived');
  let arcBy = new Map();
  try { arcBy = await store.listArchivedBy(arch.map(e => e.id)); }
  catch (e) { console.warn('журнал архивации не прочитался:', e.message || e); }
  if (seq !== arcSeq) return;
  arcRows = arch.map(e => {
    const r = money.get(e.id) || {};
    const a = arcBy.get(e.id);
    return { id: e.id, fio: e.fio || '—', spec: specName(e.specialty_id),
             hidden: !!e.hidden_at, byWho: a?.who || null, byAt: a?.at || null,
             left_on: e.left_on || null, delta: r.delta_kop || 0, salary: r.salary_kop || 0 };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.fio.localeCompare(b.fio, 'ru'));
  drawArchive();
}
function drawArchive() {
  const f = ($('arcSearch')?.value || '').trim().toLowerCase();
  const onlyMoney = !!$('arcOnlyMoney')?.checked;
  const showHidden = !!$('arcShowHidden')?.checked;
  const shown = arcRows.filter(x => showHidden || !x.hidden);
  const hiddenN = arcRows.filter(x => x.hidden).length;
  const list = shown.filter(x => (!f || x.fio.toLowerCase().includes(f)) && (!onlyMoney || x.delta));
  const withMoney = shown.filter(x => x.delta).length;
  const nDolg = shown.filter(x => x.delta > 0).length;
  const nPere = shown.filter(x => x.delta < 0).length;
  const noLeft = shown.filter(x => !x.left_on).length;
  const hiddenMoney = arcRows.filter(x => x.hidden && x.delta).length;
  $('arcStat').innerHTML = `<span class="mini-chip neutral">${shown.length} чел</span>`
    + (nDolg ? `<span class="mini-chip">не доплатили: ${nDolg}</span>` : '')
    + (nPere ? `<span class="mini-chip">переплата: ${nPere}</span>` : '')
    + (noLeft ? `<span class="mini-chip neutral">без даты увольнения: ${noLeft}</span>` : '')
    + (!showHidden && hiddenN ? `<span class="mini-chip neutral">убрано: ${hiddenN}${hiddenMoney ? `, из них с деньгами ${hiddenMoney}` : ''}</span>` : '');
  $('arcBody').innerHTML = list.length ? `<div class="gridwrap"><table class="pw arc"><thead><tr>
      <th class="pw-name">Сотрудник</th><th>Специальность</th><th>Дата увольнения</th>
      <th class="arc-by" title="Из журнала — он неизменяемый, эту подпись не переписать">Кто убрал в архив</th>
      <th class="num">Начислено</th><th class="num pw-pay">Осталось выдать</th><th></th></tr></thead><tbody>${
    list.map(x => `<tr class="arc-row${x.delta ? ' arc-money' : ''}">
      <td class="pw-name"><span class="pw-fio">${esc(x.fio)}</span>${
        x.delta ? `<span class="mini-chip">${x.delta > 0 ? 'не доплатили' : 'переплата'}</span>` : ''}</td>
      <td class="muted">${esc(x.spec)}</td>
      <td>${x.left_on ? esc(dmy(x.left_on)) : '<span class="muted">не проставлена</span>'}</td>
      <td class="arc-by">${x.byWho
        ? `${esc(x.byWho)}<span class="muted small"> · ${esc(fmtDTY(x.byAt))}</span>`
        : '<span class="muted">не записано</span>'}</td>
      <td class="num fin">${x.salary ? rub(x.salary) : '<span class="muted">—</span>'}</td>
      <td class="num pw-pay fin">${x.delta ? `<b class="money${x.delta < 0 ? ' neg' : ''}">${rub(x.delta)}</b>` : '<span class="muted">—</span>'}</td>
      <td class="num"><button class="btn btn-ghost btn-sm arc-back" data-id="${x.id}">Вернуть</button>
        <button class="btn btn-ghost btn-sm arc-hist" data-fio="${esc(x.fio)}">История</button>${
          isOwner() ? `<button class="btn btn-ghost btn-sm arc-hide" data-id="${x.id}" data-h="${x.hidden ? 1 : 0}"
            title="${x.hidden ? 'Вернуть в список архива' : 'Убрать из списка. Карточка и её история останутся'}"
            >${x.hidden ? 'Показать' : 'Убрать'}</button>` : ''}</td></tr>`).join('')
    }</tbody></table></div>`
    : `<div class="empty">${shown.length ? 'Никого не нашлось по этому условию.'
        : hiddenN ? `Все ${hiddenN} ${plural(hiddenN, 'карточка убрана', 'карточки убраны', 'карточек убраны')} из списка — поставьте «показать убранные».`
        : 'Архив пуст.'}</div>`;
  $('arcBody').querySelectorAll('.arc-hide').forEach(b => b.onclick = async () => {
    if (b.disabled) return;
    const x = list.find(y => y.id === +b.dataset.id) || { fio: '', delta: 0 };
    if (b.dataset.h !== '1' && !(await confirmHide(x))) return;
    b.disabled = true;
    try { await store.setEmployeeHidden(+b.dataset.id, b.dataset.h !== '1');
          toast(ICONS.check + (b.dataset.h === '1' ? 'Возвращено в список' : 'Убрано из списка'));
          await renderArchive(); }
    catch (err) { b.disabled = false; toast(err.message || err, true); }
  });
  $('arcBody').querySelectorAll('.arc-row .pw-name').forEach((td, i) =>
    td.onclick = () => openCard(list[i].id));
  $('arcBody').querySelectorAll('.arc-hist').forEach(b => b.onclick = () => {
    jWho = (b.dataset.fio.split(' ')[0] || '').trim(); jAct = jFrom = jTo = jActor = '';
    go('journal'); renderJournal(true);
  });
  $('arcBody').querySelectorAll('.arc-back').forEach(b => b.onclick = async () => {
    const x = list.find(y => y.id === +b.dataset.id); if (!x) return;
    if (!(await confirmBack(x))) return;
    b.disabled = true;
    try { await store.updateEmployee(x.id, x.hidden ? { status: 'active', hidden_at: null } : { status: 'active' });
      toast(ICONS.check + 'Вернули в активные'); await refresh(); await renderArchive(); }
    catch (e) { b.disabled = false; toast(e.message || e, true); }
  });
}
function confirmBack(x) {
  return new Promise(resolve => {
    showModal(`<h3>Вернуть в активные?</h3>
      <div class="msub">${esc(x.fio)}${x.delta ? ` · за ним остаётся <b>${rub(x.delta)} ₽</b>` : ''}</div>
      <div class="msub" style="margin-top:8px">Человек снова появится в списках и графике,
        и ему снова будет начисляться зарплата за отработанное.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="abNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="abYes">${ICONS.check}Вернуть</button></div>`);
    modalOnClose = () => resolve(false);
    $('abNo').onclick = () => { resolve(false); closeModal(); };
    $('abYes').onclick = () => { resolve(true); closeModal(); };
  });
}
function confirmHide(x) {
  return new Promise(resolve => {
    showModal(`<h3>Убрать из списка?</h3>
      <div class="msub">${esc(x.fio)}</div>
      <div class="msub" style="margin-top:8px">Карточка и вся её история останутся —
        она просто уйдёт из списка «Архив». Вернуть можно галочкой «показать убранные».</div>
      ${x.delta ? `<div class="msub sc-warn" style="margin-top:8px">За ним остаётся
        <b>${rub(x.delta)} ₽</b> — вопрос закроется из виду вместе с карточкой.</div>` : ''}
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="ahNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="ahYes">Убрать</button></div>`);
    modalOnClose = () => resolve(false);
    $('ahNo').onclick = () => { resolve(false); closeModal(); };
    $('ahYes').onclick = () => { resolve(true); closeModal(); };
  });
}
function vacSpans(dates) {
  const d = [...dates].sort();
  const out = [];
  for (const x of d) {
    const last = out[out.length - 1];
    if (last && new Date(x) - new Date(last[1]) === 86400000) last[1] = x;
    else out.push([x, x]);
  }
  return out;
}
const vacDM = s => String(s).slice(8, 10) + '.' + String(s).slice(5, 7);
const vacSpanLabel = sp => sp.map(([a, b]) => a === b ? vacDM(a) : `${vacDM(a)}–${vacDM(b)}`).join(', ');
function vacAddDialog(preId) {
  const act = employees.filter(e => e.status === 'active')
    .sort((a, b) => (a.fio || '').localeCompare(b.fio || '', 'ru'));
  const opts = act.map(e => `<option value="${e.id}" ${preId === e.id ? 'selected' : ''}>${esc(e.fio)}</option>`).join('');
  const first = (vacPeriod || nowPeriod()) + '-01';
  showModal(`<h3>Отметить отпуск</h3>
    <div class="msub">Зарплата за дни отпуска не начисляется в обоих случаях. Разница
      в отпускных: за оплачиваемый их вносят отдельной суммой, за «без сохранения» не вносят.</div>
    <label class="flbl">Сотрудник</label>
    <select class="input" id="vaWho">${opts}</select>
    <label class="flbl" style="margin-top:10px">Какой отпуск</label>
    <select class="input" id="vaKind">
      <option value="отпуск">Оплачиваемый — отпускные вносятся отдельной суммой</option>
      <option value="отпуск_бз">Без сохранения — денег за эти дни нет</option>
    </select>
    <label class="flbl" style="margin-top:10px">Период</label>
    <div id="vaCal"></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="vaNo">Отмена</button>
      <button class="btn btn-primary btn-sm" id="vaOk">${ICONS.check}Отметить</button></div>`);
  const pick = rangePicker(first);
  $('vaCal').appendChild(pick.el);
  const days = () => pick.get();
  $('vaNo').onclick = closeModal;
  $('vaOk').onclick = async () => {
    const b = $('vaOk'); if (b.disabled) return;
    const d = days();
    if (!d || d === 'many') { toast('Проверьте даты', true); return; }
    const id = +$('vaWho').value;
    b.disabled = true; b.textContent = 'Отмечаю…';
    try {
      const kind = $('vaKind').value || 'отпуск';
      const zakr = await zakrytyeIz(d);
      if (zakr.length) { b.disabled = false; b.textContent = 'Отметить'; toast(`Закрыт ${denSlovami(zakr)} — сначала откройте, отпуск не отмечен`, true); return; }
      for (const day of d) await store.setScheduleCell(id, day, { plan_kind: kind, plan_start: null, plan_end: null, fact: null });
      closeModal(); toast(ICONS.check + `Отпуск отмечен · ${d.length} дн`); await renderVacation();
    } catch (e) { b.disabled = false; b.textContent = 'Отметить'; toast(e.message || e, true); await renderVacation(); }
  };
}
async function renderVacation() {
  if (!store.me()?.role) { $('vacBody').innerHTML = ''; return; }
  if (!vacPeriod) vacPeriod = nowPeriod();
  const want = vacPeriod, seq = ++vacSeq;
  $('vLabel').textContent = periodLabel(want);
  let rows, emps, cells;
  try {
    [rows, emps, cells] = await Promise.all([
      store.listPayroll(want), store.listEmployees(), store.listSchedule(want),
    ]);
  } catch (e) {
    if (seq === vacSeq) { vacData = null; $('vacBody').innerHTML = ''; toast(e.message || e, true); }
    return;
  }
  if (seq !== vacSeq) return;
  const byEmp = new Map(), other = new Map();
  for (const c of (cells || [])) {
    if (c.plan_kind === 'отпуск' || c.plan_kind === 'отпуск_бз') {
      if (!byEmp.has(c.employee_id)) byEmp.set(c.employee_id, { paid: [], unpaid: [] });
      byEmp.get(c.employee_id)[c.plan_kind === 'отпуск' ? 'paid' : 'unpaid'].push(c.work_date);
    } else if (c.plan_kind === 'absent' || c.plan_kind === 'off') {
      const m = other.get(c.employee_id) || { absent: 0, off: 0 };
      m[c.plan_kind === 'absent' ? 'absent' : 'off']++;
      other.set(c.employee_id, m);
    }
  }
  vacData = { rows, emps, days: byEmp, other, period: want };
  drawVacation();
}
function drawVacation() {
  if (!vacData) return;
  const { rows, emps, days, other } = vacData;
  const f = ($('vacSearch')?.value || '').trim().toLowerCase();
  const flat = !!$('vacFlat')?.checked;
  const empOf = new Map(emps.map(e => [e.id, e]));
  const rowOf = new Map(rows.map(r => [r.employee_id, r]));
  const ids = new Set([...days.keys()]);
  for (const r of rows) if (r.otpusk_nach_kop || r.otpusk_kop || r.otpusk_cash_kop) ids.add(r.employee_id);
  const list = [...ids].map(id => {
    const e = empOf.get(id) || {}, r = rowOf.get(id) || {};
    const d0 = days.get(id);
    const dd = { paid: (d0 && d0.paid) || [], unpaid: (d0 && d0.unpaid) || [] };
    const dts = [...dd.paid, ...dd.unpaid];
    const nach = r.otpusk_nach_kop || 0, card = r.otpusk_kop || 0, cash = r.otpusk_cash_kop || 0;
    const o = (other && other.get(id)) || { absent: 0, off: 0 };
    return { id, fio: e.fio || r.fio || '—', cat: empCat(e), dts,
             spans: vacSpans(dd.paid), spansU: vacSpans(dd.unpaid),
             dpaid: dd.paid, dunpaid: dd.unpaid, nach, card, cash, paid: card + cash, other: o,
             noDays: dts.length === 0, noMoney: dts.length > 0 && !nach && !card && !cash };
  }).filter(x => !f || x.fio.toLowerCase().includes(f))
    .filter(x => !vacKindF
      || (vacKindF === 'отпуск' ? x.dpaid.length > 0 : x.dunpaid.length > 0))
    .sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));
  const sum = k => list.reduce((s, x) => s + x[k], 0);
  const tot = { days: list.reduce((s, x) => s + x.dts.length, 0),
                nach: sum('nach'), paid: sum('paid'),
                noDays: list.filter(x => x.noDays).length,
                noMoney: list.filter(x => x.noMoney).length };
  $('vacStat').innerHTML = `<span class="mini-chip neutral">${list.length} чел</span>`
    + `<span class="mini-chip neutral">${tot.days} дней</span>`
    + `<span class="mini-chip neutral">начислено ${rub(tot.nach)} ₽</span>`
    + `<span class="mini-chip neutral">выдано ${rub(tot.paid)} ₽</span>`
    + (tot.noDays ? `<span class="mini-chip">деньги без графика: ${tot.noDays}</span>` : '')
    + (tot.noMoney ? `<span class="mini-chip">график без денег: ${tot.noMoney}</span>` : '')
    + (isStaff() ? `<button class="btn btn-primary btn-sm" id="vacAdd" style="margin-left:8px">${ICONS.plus || '+'}Отметить отпуск</button>` : '');
  const row = x => `<tr class="vac-row${x.noDays ? ' vac-bad' : ''}${x.noMoney ? ' vac-warn' : ''}" data-id="${x.id}">
    <td class="pw-name"><span class="pw-fio">${esc(x.fio)}</span>${
      x.noDays ? '<span class="mini-chip warn">нет в графике</span>'
      : x.noMoney ? '<span class="mini-chip warn">нет отпускных</span>' : ''}</td>
    <td>${x.dts.length ? (
        (x.dpaid.length ? `<span class="vac-p">${esc(vacSpanLabel(x.spans))}</span>` : '')
        + (x.dpaid.length && x.dunpaid.length ? '<br>' : '')
        + (x.dunpaid.length ? `<span class="vac-u">${esc(vacSpanLabel(x.spansU))} · без сохранения</span>` : ''))
      : (x.other.absent || x.other.off
          ? `<span class="vac-hint">вместо отпуска стоит: ${[
              x.other.absent ? `<b>${x.other.absent} дн «Не вышел»</b>` : '',
              x.other.off ? `${x.other.off} дн «Выходной»` : ''].filter(Boolean).join(', ')}</span>`
          : '<span class="muted">—</span>')}</td>
    <td class="num">${x.dts.length
      ? (x.dunpaid.length ? `${x.dpaid.length}<span class="vac-u"> + ${x.dunpaid.length}</span>` : x.dts.length)
      : '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.nach ? rub(x.nach) : '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.card ? rub(x.card) : '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.cash ? rub(x.cash) : '<span class="muted">—</span>'}</td></tr>`;
  let body = '';
  if (flat) body = list.map(row).join('');
  else {
    const cats = catsOrdered(list.map(x => x.cat));
    for (const cat of cats) {
      const my = list.filter(x => x.cat === cat);
      body += `<tr class="pw-group" style="--cat:${catColor(cat)}"><td colspan="6"><span>${esc(catLabel(cat))} · ${my.length}</span></td></tr>`
        + my.map(row).join('');
    }
  }
  $('vacBody').innerHTML = list.length
    ? `<div class="gridwrap"><table class="pw vac"><thead><tr>
        <th class="pw-name">Сотрудник</th><th>Даты отпуска</th><th class="num">Дней</th>
        <th class="num">Начислено</th><th class="num">На карту</th><th class="num pw-pay">Наличными</th>
        </tr></thead><tbody>${body}</tbody>
        <tfoot><tr class="pw-total"><td class="pw-name">ИТОГО</td><td></td>
          <td class="num">${tot.days}</td><td class="num fin">${rub(tot.nach)}</td>
          <td class="num fin">${rub(sum('card'))}</td>
          <td class="num pw-pay fin">${rub(sum('cash'))}</td></tr></tfoot></table></div>
        <div class="note ov-note">${ICONS.info}Колонки «Осталось» здесь нет намеренно${hint(
          'Она считала «начислено минус выплачено» в пределах ОДНОГО месяца, а отпускные часто начисляют в одном месяце, а платят в другом. В августе начислено 0, выплачено 558 004 ₽ — и колонка показывала долг −558 004 ₽, которого нет. Ровно эту формулу раньше по той же причине убрали из окна человека. Долг по отпускным виден в «Расчёте», в строке «Осталось выдать»: начисленные отпускные входят в заработок, выплаченные вычитаются.')}</div>`
    : `<div class="empty">За ${esc(periodLabel(vacData.period))} отпусков нет — ни дней в графике, ни отпускных.</div>`;
  $('vacBody').querySelectorAll('.vac-row').forEach(tr => tr.onclick = () => openCard(+tr.dataset.id));
  { const b = $('vacAdd'); if (b) b.onclick = () => vacAddDialog(); }
  $('vacBody').querySelectorAll('.vac-hint').forEach(el => el.onclick = ev => {
    ev.stopPropagation();
    vacAddDialog(+el.closest('.vac-row').dataset.id);
  });
}
const shortFio = f => {
  const p = String(f || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '—';
  return p.length < 2 ? p[0] : p[0] + ' ' + p.slice(1).map(w => w[0].toUpperCase() + '.').join('');
};
function shiftGapsMonth(d) {
  if (!gapsPeriod) gapsPeriod = nowPeriod();
  let [y, m] = gapsPeriod.split('-').map(Number); m += d;
  if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
  gapsPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = gapsPeriod; syncHash(false); renderGaps();
}
const RATES_GO = () => (isOwner() ? 'rates' : 'employees');
const GAP_CHECKS = [
  { g: 0, t: 'Не заведена ставка', d: 'без ставки зарплата не считается вовсе', go: RATES_GO, test: e => cardGaps(e).rate },
  { g: 0, t: 'Ставка обрывается посреди месяца', d: 'часть дней не по чему считать', go: RATES_GO, test: (e, r) => !!r?.flag_rate_gap },
  { g: 0, t: 'Вид смены не связан со ставкой', d: 'день оплатится нулём — в карточке нет ставки под этот вид смены', go: RATES_GO,
    test: (e, r) => !!r?.flag_no_rate && !payNotByShift(e.id, gapsPeriod) },
  { g: 0, t: 'Отрицательная зарплата', d: 'начислено меньше нуля — так быть не должно', go: 'payroll', test: (e, r) => (r?.salary_kop || 0) < 0 },
  { g: 0, t: 'Деньги есть, а расчёта нет', d: 'выплата без начисления под ней', go: 'payroll', test: (e, r) => !!r?.flag_money_without_calc },
  { g: 0, t: 'Начислено ≠ записано', d: 'записанные деньги не сходятся с расчётом', go: 'payroll', test: (e, r) => !!r && recorded(r) > 0 && Math.abs(r.delta_kop || 0) > 10000 },
  { g: 1, t: 'Нет графика за месяц', d: 'ни одной клетки, график не заводили', go: 'schedule', test: (e, r, x) => !x.hasCell.has(e.id) },
  { g: 1, t: 'Оклад есть, отработанных дней ноль', d: 'оклад не на что начислить', go: 'schedule', test: (e, r, x) => !!r?.flag_oklad_no_days && x.hasCell.has(e.id) },
  { g: 1, t: 'Начислено ноль', d: 'рабочие дни в графике есть, а зарплаты нет', go: 'payroll', test: (e, r) => !!r?.flag_no_data },
  { g: 1, t: 'Процент без ставки', d: 'оплаты пациентов есть, а процента нет', go: RATES_GO, test: (e, r) => !!r?.flag_pct_no_rate },
  { g: 1, t: 'Нет оплат пациентов', d: 'процент считать не от чего', go: 'patients', test: (e, r) => !!r?.flag_no_patient_data },
  { g: 0, t: 'Нормы нет вовсе, а оклад есть', d: 'делить оклад не на что — сумма считается запасным способом, по дням', go: 'schedule',
    test: (e, r, x) => !x.normFail && hasOklad(e) && x.norm.get(e.id) == null },
  { g: 1, t: 'Норма изменилась с прошлого месяца', d: 'ручная норма была, теперь берётся календарная — проверьте, так ли задумано', go: 'schedule',
    test: (e, r, x) => !x.normFail && x.normPrevManual.has(e.id) && !x.normManual.has(e.id) },
];
const hasOklad = e => (e.lines || []).some(l => l.pay_kind === 'оклад'
  && l.valid_from < nextPeriodStart(gapsPeriod) && (!l.valid_to || l.valid_to > gapsPeriod + '-01'));
const CARD_CHECKS = [
  { t: 'Фамилия не уточнена', d: 'в карточке нет фамилии или стоит заглушка', test: e => cardGaps(e).fio },
  { t: 'Нет телефона', d: 'некуда отправить код подтверждения выдачи', test: e => cardGaps(e).phone },
  { t: 'Не указана специальность', d: 'человек выпадет из разрезов по специальностям', test: e => cardGaps(e).spec },
  { t: 'Не указано отделение', d: 'человек висит в «Не распределены» и не попадает ни в одну группу', test: e => cardGaps(e).dept },
];
async function renderGaps() {
  if (!isStaff()) { $('gapsBody').innerHTML = ''; return; }
  if (!gapsPeriod) gapsPeriod = nowPeriod();
  const want = gapsPeriod, seq = ++gapsSeq;
  $('gLabel').textContent = periodLabel(want);
  let rows, emps, cells, norms, normsPrev, cal;
  try {
    [rows, emps, cells, norms, normsPrev, cal] = await Promise.all([
      store.listPayroll(want), store.listEmployees(), store.listSchedule(want),
      store.listMonthNorms(want).catch(e => { console.warn('listMonthNorms:', e); return null; }),
      store.listMonthNorms(prevPeriodOf(want)).catch(() => null),
      store.calendarInfo().catch(() => null),
    ]);
  } catch (e) {
    if (seq === gapsSeq) { gapsData = null; $('gapsBody').innerHTML = ''; toast(e.message || e, true); }
    return;
  }
  if (seq !== gapsSeq) return;
  const hasCell = new Set();
  for (const c of (cells || [])) if (c.plan_kind || c.fact) hasCell.add(c.employee_id);
  const normFail = norms == null;
  const norm = new Map((norms || []).map(n => [n.employee_id, n.hours == null ? null : +n.hours]));
  const normManual = new Set((norms || []).filter(n => n.is_manual).map(n => n.employee_id));
  const normPrevManual = new Set(normsPrev == null ? [] : normsPrev.filter(n => n.is_manual).map(n => n.employee_id));
  gapsData = { rows, emps, period: want, hasCell, norm, normManual, normPrevManual, normFail, cal };
  $('gLabel').textContent = periodLabel(want);
  drawGaps();
}
function drawGaps() {
  paintMonthNav();
  if (!gapsData) return;
  const { rows, emps, hasCell, norm, normManual, normPrevManual, normFail, cal } = gapsData;
  const active = (emps || []).filter(e => e.status === 'active');
  const ctx = { hasCell, norm, normManual, normPrevManual, normFail };
  const byId = new Map(rows.map(r => [r.employee_id, r]));
  const found = GAP_CHECKS.map(c => ({ ...c, who: active.filter(e => c.test(e, byId.get(e.id), ctx)) })).filter(c => c.who.length);
  const cards = CARD_CHECKS.map(c => ({ ...c, who: active.filter(c.test) })).filter(c => c.who.length);
  const people = new Set();
  for (const c of [...found, ...cards]) for (const e of c.who) people.add(e.id);
  const total = people.size;
  const calWarn = (() => {
    if (!cal || !cal.last) return '';
    const cur = nowPeriod();
    const mesDo = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number);
                              return (y2 - y1) * 12 + (m2 - m1); };
    const zapas = mesDo(cur, cal.last);
    const skoro = (cal.estimates || []).filter(p => mesDo(cur, p) >= 0 && mesDo(cur, p) < 3);
    const box = (red, t, d) => `<div class="ov-alert${red ? ' red' : ''}"><span class="oa-ic">${red ? ICONS.alert : ICONS.info}</span>`
      + `<div><div class="oa-t">${esc(t)}</div><div class="oa-d">${d}</div></div></div>`;
    let out = '';
    if (zapas < 3) out += box(true, `Производственный календарь кончается ${esc(cal.last)}`,
      'Когда он кончится, у всех, кто живёт на типе недели, оклад посчитается запасным способом — по дням, а не по часам. Заводится он на год вперёд.');
    if (skoro.length) out += box(false, `Календарь посчитан, но не сверен · ${skoro.length} мес`,
      `${esc(skoro.join(', '))} — программа посчитала норму сама, по Трудовому кодексу. Переносы выходных устанавливает постановление на каждый год, поэтому эти месяцы стоит сверить с официальным календарём.`);
    return out ? `<div class="ov-sec">Календарь</div><div class="ov-alerts">${out}</div>` : '';
  })();
  if (!total) {
    $('gapsBody').innerHTML = `<div class="ov-alerts"><div class="ov-alert ok"><span class="oa-ic">${ICONS.check}</span>`
      + `<div><div class="oa-t">Пробелов нет</div><div class="oa-d">за ${esc(periodLabel(gapsData.period))} всё заполнено</div></div></div></div>`
      + calWarn;
    return;
  }
  const block = (c, red) => {
    const names = c.who.map(x => esc(shortFio(x.fio))).join(' · ');
    return `<button class="ov-alert${red ? ' red' : ''}" data-go="${esc(typeof c.go === 'function' ? c.go() : (c.go || ''))}">`
      + `<span class="oa-ic">${red ? ICONS.alert : ICONS.info}</span>`
      + `<div><div class="oa-t">${esc(c.t)} · ${c.who.length}</div>`
      + `<div class="oa-d">${esc(c.d)}</div>`
      + `<div class="oa-d gap-who">${names}</div></div></button>`;
  };
  const sec = (title, list, red) => list.length
    ? `<div class="ov-sec">${esc(title)}</div><div class="ov-alerts">${list.map(c => block(c, red)).join('')}</div>` : '';
  $('gapsBody').innerHTML =
    `<div class="ov-hero"><div class="l">Людей с пробелами · ${esc(periodLabel(gapsData.period))}</div>`
    + `<div class="v">${fmt(total)}</div>`
    + `<div class="ov-sub">из <b>${fmt(active.length)}</b> активных в штате</div></div>`
    + calWarn
    + sec('Мешает расчёту', found.filter(c => c.g === 0), true)
    + sec('Не хватает данных', found.filter(c => c.g === 1), false)
    + sec('Неполные карточки', cards, false)
    + `<div class="note ov-note">${ICONS.info}Нажмите на строку — откроется экран, где это заполняется</div>`;
  $('gapsBody').querySelectorAll('[data-go]').forEach(b => {
    if (b.dataset.go) b.onclick = () => go(b.dataset.go);
    else b.onclick = () => go('employees');
  });
}
let patPeriod = null, patRows = [], patLastId = null, patHasMore = false, patMonth = [], patShown = null, patSeq = 0;
function shiftPatMonth(d) { if (!patPeriod) patPeriod = nowPeriod(); let [y, m] = patPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } patPeriod = clampPeriod(y + '-' + String(m).padStart(2, '0')); workPeriod = patPeriod; syncHash(false); renderPatients(); }
async function renderPatients(reset = true) {
  if (!isStaff()) { $('patList').innerHTML = ''; return; }
  if (!patPeriod) patPeriod = nowPeriod();
  const want = patPeriod, seq = ++patSeq;
  const wantLast = reset ? null : patLastId;
  $('qLabel').textContent = periodLabel(want);
  let month, page;
  try {
    [month, page] = await Promise.all([
      reset ? store.listPatientMonth(want) : Promise.resolve(patMonth),
      store.listPatientEvents({ period: want, beforeId: wantLast }),
    ]);
  } catch (e) {
    if (seq !== patSeq) return;
    toast(e.message || e, true);
    patPeriod = patShown || want; workPeriod = patPeriod;
    $('qLabel').textContent = periodLabel(patPeriod);
    syncHash(false);
    return;
  }
  if (seq !== patSeq) return;
  patMonth = month;
  patRows = reset ? page.rows : patRows.concat(page.rows);
  patLastId = page.lastId ?? patLastId;
  patHasMore = page.hasMore;
  patShown = want;
  $('qLabel').textContent = periodLabel(want);
  drawPatients();
}
function emptyPatText(f, month) {
  if (f && month.length) {
    const n = month.reduce((s, m) => s + (m.visits || 0) + (m.reversed || 0), 0);
    return `<div class="empty">Оплаты этого врача есть (${fmt(n)}), но ещё не загружены<br><span class="small">нажмите «Показать ещё» ниже</span></div>`;
  }
  if (f) return '<div class="empty">Такого врача в этом месяце нет</div>';
  return `<div class="empty">За ${esc(periodLabel(patShown || patPeriod))} оплат нет.<br><span class="small">Они появятся после импорта таблицы оплат</span></div>`;
}
function drawPatients() {
  paintMonthNav();
  const f = ($('patSearch')?.value || '').toLowerCase().trim();
  const hit = s => !f || String(s || '').toLowerCase().includes(f);
  const month = patMonth.filter(m => hit(m.fio));
  const total = month.reduce((s, m) => s + (m.amount_kop || 0), 0);
  const visits = month.reduce((s, m) => s + (m.visits || 0), 0);
  const rev = month.reduce((s, m) => s + (m.reversed || 0), 0);
  $('patStat').innerHTML = `<span class="fs-count"><b>${fmt(visits)}</b> ${plural(visits, 'приём', 'приёма', 'приёмов')} · <b>${month.length}</b> ${plural(month.length, 'врач', 'врача', 'врачей')}</span>`
    + `<span class="gap-chips"><span class="mini-chip">всего <b>${rub(total)} ₽</b></span>${rev ? `<span class="mini-chip chip-dev">сторно: ${rev}</span>` : ''}</span>`;
  $('patByDoc').innerHTML = month.length ? `<div class="card pat-doc">${month.map(m =>
    `<div class="pd-row"><div class="pd-name">${esc(m.fio || '—')}</div>`
    + `<div class="pd-n">${fmt(m.visits)} ${plural(m.visits, 'приём', 'приёма', 'приёмов')}${m.reversed ? ` · <span class="pd-rev">сторно ${m.reversed}</span>` : ''}</div>`
    + `<div class="pd-sum fin">${rub(m.amount_kop)} ₽</div></div>`).join('')}</div>` : '';
  const rows = patRows.filter(p => hit(p.fio));
  const body = rows.length ? rows.map(p => {
    const st = !!p.reverses_id;
    return `<div class="jrow${st ? ' jred' : ''}"><div style="flex:1">`
      + `<div>${esc(dm(p.paid_on))}${p.paid_at ? ' · ' + esc(String(p.paid_at).slice(0, 5)) : ''} · <b>${esc(p.fio || '—')}</b>${st ? ' <b class="jact">СТОРНО</b>' : ''}</div>`
      + `<div class="who">${esc(p.service || 'без названия услуги')}${p.is_import ? ' · из импорта' : ' · внесено вручную'}</div></div>`
      + `<div class="jt fin"${st ? ' style="color:var(--red-d)"' : ''}>${rub(p.amount_kop)} ₽</div></div>`;
  }).join('') : emptyPatText(f, month);
  const more = patHasMore ? `<div class="jmore-wrap"><button class="btn btn-ghost btn-sm" id="pMore">Показать ещё</button></div>` : '';
  $('patList').innerHTML = body + more;
  const mb = $('pMore'); if (mb) mb.onclick = () => renderPatients(false);
}
const J_FILTERS = [['all', 'Все'], ['red', 'Красные'], ['money', 'Деньги'],
  ['payout', 'Выдачи'], ['premia', 'Премии'], ['schedule', 'График'], ['rate', 'Ставки']];
let journalFilter = 'all', journalRows = [], journalLastId = null, journalHasMore = false, journalBusy = false;
let jWho = '', jAct = '', jFrom = '', jTo = '', jActor = '';
let journalActors = null;
function rolePodpis(u) {
  const imya = String(u.display_name || '').trim();
  const rol = ROLE_LABELS[u.role] || u.role || '';
  if (!rol) return imya;
  const slova = t => String(t).toLowerCase().split(/[^0-9a-zа-яё]+/i).filter(Boolean);
  const vImeni = new Set(slova(imya));
  return slova(rol).every(w => vImeni.has(w)) ? imya : imya + ' · ' + rol;
}
const J_ACTS = [['', 'Любое действие'], ['add', 'Добавление'], ['edit', 'Изменение'], ['del', 'Удаление и сторно']];
function journalRowHtml(j) {
  let what;
  const act = J_ACTION[j.action] ? `<b class="jact">${esc(J_ACTION[j.action])}</b> · ` : '';
  const fld = String(j.field || '');
  const fldShort = !j.subject_fio ? fld
    : fld.startsWith(j.subject_fio + ' · ') ? fld.slice(j.subject_fio.length + 3)
    : fld.split(' · ' + j.subject_fio).join('');
  if (j.action === 'created' && j.entity === 'payout' && fldShort)
    what = `${esc(fldShort)}: <b>${esc(j.new_value || '')}</b>`;
  else if (j.action === 'created') what = `${J_ENTITY[j.entity] || esc(j.entity)} создана: <b>${esc(j.new_value || '')}</b>`;
  else {
    const vv = v => (['специальность', 'specialty', 'specialty_id'].includes(fldShort)
      && /^\d+$/.test(String(v || '').trim())) ? jSpecName(+v) : v;
    const ov = vv(j.old_value), nv = vv(j.new_value);
    what = `${act}${J_ENTITY[j.entity] || esc(j.entity)} · ${J_FIELD[fldShort] || esc(fldShort)}: ${ov ? `<s>${esc(ov)}</s> → ` : ''}<b>${esc(nv || '—')}</b>`;
  }
  const PERSONAL = ['schedule', 'money_line', 'rate_line', 'employee', 'employee_month_norm',
    'month_carry', 'salary_override', 'doctor_month_revenue', 'payout'];
  const кто = j.subject_fio ? esc(j.subject_fio)
    : (PERSONAL.includes(j.entity) ? '<span class="muted">сотрудник не определён</span>' : '');
  const когда = j.entity === 'schedule' && j.subject_date ? esc(dm(j.subject_date)) : '';
  const subj = кто || когда
    ? `<div class="jsubj">${кто}${кто && когда ? ' · ' : ''}${когда}</div>`
    : '';
  return `<div class="jrow${j.red ? ' jred' : ''}"><div style="flex:1">${subj}<div>${what}</div><div class="who">${esc(j.actor)}</div></div><div class="jt">${esc(fmtDT(j.at))}</div></div>`;
}
async function renderJournal(reset = true) {
  if (journalBusy) return; journalBusy = true;
  if (journalActors === null) {
    try { journalActors = await store.listAccounts(); } catch (e) { journalActors = []; }
  }
  if (reset) { journalRows = []; journalLastId = null; journalHasMore = false; }
  try {
    const res = await store.listJournal({ filter: journalFilter, beforeId: reset ? null : journalLastId,
      who: jWho, act: jAct, from: jFrom, to: jTo, actor: jActor });
    journalRows = reset ? res.rows : journalRows.concat(res.rows);
    journalLastId = res.lastId ?? journalLastId;
    journalHasMore = res.hasMore;
  } catch (e) { toast(e.message || e, true); }
  journalBusy = false;
  drawJournal();
}
function drawJournal() {
  const chips = J_FILTERS.map(([k, l]) => `<button class="jf-chip${journalFilter === k ? ' on' : ''}" data-jf="${k}">${esc(l)}</button>`).join('');
  const acts = J_ACTS.map(([k, l]) => `<option value="${k}" ${jAct === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const on = jWho || jAct || jFrom || jTo || jActor;
  $('journalTools').innerHTML = `<div class="jf-chips">${chips}</div>
    <div class="jf-row">
      <div class="search jf-who"><span data-ic="search"></span><input id="jWho" placeholder="Фамилия — чья правка или о ком" autocomplete="off" value="${esc(jWho)}"></div>
      <select class="input jf-sel" id="jAct">${acts}</select>
      ${(journalActors && journalActors.length > 1) ? `<select class="input jf-sel" id="jActor" title="Чьи правки показывать">
        <option value="">Кто угодно</option>
        ${journalActors.map(u => `<option value="${esc(String(u.id))}" ${jActor === String(u.id) ? 'selected' : ''}>${esc(rolePodpis(u))}</option>`).join('')}
      </select>` : ''}
      <label class="jf-date">с <input class="input" type="date" id="jFrom" value="${esc(jFrom)}"></label>
      <label class="jf-date">по <input class="input" type="date" id="jTo" value="${esc(jTo)}"></label>
      ${on ? '<button class="btn btn-ghost btn-sm" id="jClear">Сбросить</button>' : ''}
    </div>`;
  $('journalTools').querySelectorAll('.jf-chip').forEach(b => b.onclick = () => {
    if (b.dataset.jf === journalFilter) return;
    journalFilter = b.dataset.jf; renderJournal(true);
  });
  const body = journalRows.length ? journalRows.map(journalRowHtml).join('')
    : `<div class="empty">${journalFilter === 'all' ? 'Журнал пуст — появится после первых изменений' : 'В этой категории записей нет'}</div>`;
  const more = journalHasMore ? `<div class="jmore-wrap"><button class="btn btn-ghost btn-sm" id="jMore">Показать ещё</button></div>` : '';
  $('journalList').innerHTML = body + more;
  const mb = $('jMore'); if (mb) mb.onclick = () => renderJournal(false);
  { const w = $('jWho');
    if (w) { let t = null;
      w.oninput = () => { clearTimeout(t); t = setTimeout(() => { jWho = w.value.trim(); renderJournal(true); }, 400); };
      w.onkeydown = ev => { if (ev.key === 'Enter') { clearTimeout(t); jWho = w.value.trim(); renderJournal(true); } }; } }
  { const a = $('jAct'); if (a) a.onchange = () => { jAct = a.value; renderJournal(true); }; }
  { const u = $('jActor'); if (u) u.onchange = () => { jActor = u.value; renderJournal(true); }; }
  { const f = $('jFrom'); if (f) f.onchange = () => { jFrom = f.value; renderJournal(true); }; }
  { const t2 = $('jTo'); if (t2) t2.onchange = () => { jTo = t2.value; renderJournal(true); }; }
  { const c = $('jClear'); if (c) c.onclick = () => { jWho = jAct = jFrom = jTo = jActor = ''; renderJournal(true); }; }
  wireFilterToggle($('journalTools'));
}
const MODAL_X = '<div class="modal-xwrap"><button class="modal-x" type="button" aria-label="Закрыть">\u2715</button></div>';
let modalOnClose = null, modalOnClose2 = null;
function showModal(html, onClose) { modalOnClose = onClose || null; $('modalBox').innerHTML = MODAL_X + html; $('modalOv').classList.add('show'); applyIcons($('modalBox')); wireHints($('modalBox')); const f = $('modalBox').querySelector('input'); if (f) setTimeout(() => f.focus(), 60); }
function closeModal() { $('modalOv').classList.remove('show'); delete $('modalBox').dataset.guard;
  setEditing(null);
  const f = modalOnClose; modalOnClose = null; if (f) f(); }
const modalOpen = () => $('modalOv').classList.contains('show') || $('modalOv2').classList.contains('show');
const guardedModal = () => ($('modalOv').classList.contains('show') && !!$('modalBox').dataset.guard) || $('modalOv2').classList.contains('show');
function showModal2(html, onClose) { modalOnClose2 = onClose || null; $('modalBox2').innerHTML = MODAL_X + html; $('modalOv2').classList.add('show'); applyIcons($('modalBox2')); wireHints($('modalBox2')); }
function closeModal2() { $('modalOv2').classList.remove('show');
  const f = modalOnClose2; modalOnClose2 = null; if (f) f(); }
function toast(msg, isErr) {
  const t = $('toast');
  if (isErr) t.textContent = String(msg); else t.innerHTML = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
}
$('modalOv').onclick = e => { if (e.target.id === 'modalOv' && !$('modalBox').dataset.guard) closeModal(); };
$('modalBox').addEventListener('click', e => { if (e.target.closest('.modal-x')) closeModal(); });
$('modalBox').addEventListener('click', e => {
  const b = e.target.closest('.ph-card'); if (!b) return;
  const id = +b.dataset.emp;
  closeModal();
  go('employees'); openCard(id);
});
$('modalBox2').addEventListener('click', e => { if (e.target.closest('.modal-x')) closeModal2(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modalBox').dataset.guard) closeModal(); });
$('empSearch').oninput = e => renderEmployees(e.target.value);
{ const rs = $('rateSearch'); if (rs) rs.oninput = e => renderRates(e.target.value); }
{ const p = $('vPrev'), n = $('vNext');
  const shiftVac = d => { let [y, m] = (vacPeriod || nowPeriod()).split('-').map(Number); m += d;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    vacPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = vacPeriod; syncHash(false); renderVacation(); };
  if (p) p.onclick = () => shiftVac(-1);
  if (n) n.onclick = () => shiftVac(1); }
{ const vs = $('vacSearch'); if (vs) vs.oninput = () => drawVacation(); }
{ const vf = $('vacKindF');
  if (vf) vf.querySelectorAll('.seg-b').forEach(b => b.onclick = () => {
    vacKindF = b.dataset.vk || '';
    vf.querySelectorAll('.seg-b').forEach(x => x.classList.toggle('on', x === b));
    drawVacation();
  }); }
{ const as = $('arcSearch'); if (as) as.oninput = () => drawArchive(); }
{ const am = $('arcOnlyMoney'); if (am) am.onchange = () => drawArchive(); }
{ const ah = $('arcShowHidden'); if (ah) ah.onchange = () => drawArchive(); }
{ const vf = $('vacFlat'); if (vf) vf.onchange = () => drawVacation(); }
{ const mp = $('mPrev'), mn = $('mNext'); if (mp) mp.onclick = () => shiftMonth(-1); if (mn) mn.onclick = () => shiftMonth(1); }
{ const ss = $('schedSearch'); if (ss) ss.oninput = () => drawSchedule(); }
{ const ps = $('payrollSearch'); if (ps) ps.oninput = e => drawPayroll(e.target.value); }
{ const pp = $('pPrev'), pn = $('pNext');
  if (pp) pp.onclick = () => { shiftPayMonth(-1); renderPayroll($('payrollSearch')?.value || ''); };
  if (pn) pn.onclick = () => { shiftPayMonth(1); renderPayroll($('payrollSearch')?.value || ''); }; }
{ const op = $('oPrev'), on = $('oNext');
  if (op) op.onclick = () => shiftOvMonth(-1);
  if (on) on.onclick = () => shiftOvMonth(1); }
{ const gp = $('gPrev'), gn = $('gNext');
  if (gp) gp.onclick = () => shiftGapsMonth(-1);
  if (gn) gn.onclick = () => shiftGapsMonth(1); }
{ const qs = $('patSearch'); if (qs) qs.oninput = () => drawPatients(); }
{ const qp = $('qPrev'), qn = $('qNext');
  if (qp) qp.onclick = () => shiftPatMonth(-1);
  if (qn) qn.onclick = () => shiftPatMonth(1); }
{ const tb = $('themeBtn'); if (tb) tb.onclick = toggleTheme; paintThemeBtn(); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!localStorage.getItem(THEME_KEY)) paintThemeBtn(); }); } catch (e) {}
$('addEmpBtn').onclick = () => employeeForm(null);
$('addSpecBtn').onclick = () => specForm();
$('addDeptBtn').onclick = () => deptForm();
$('backBtn').onclick = () => { const to = cardFrom || 'employees'; cardFrom = null; go(to, true); };
function syncTopBack() {
  const b = $('topBack'); if (!b) return;
  b.hidden = (curScreen === 'overview');
}
let navStack = 0;
window.addEventListener('popstate', () => { navStack = Math.max(0, navStack - 1); syncTopBack(); });
$('topBack').onclick = () => { if (navStack > 0) history.back(); else go('overview'); };
$('topBack').innerHTML = ICONS.chevL || '‹';
$('logoutBtn').innerHTML = ICONS.out;
const DATA_PANES = ['overviewBody', 'gapsBody', 'payrollTable', 'payrollNote', 'scheduleGrid',
  'schedNote', 'empList', 'roNote', 'cardBody', 'ratesList', 'ratesTools', 'importBody',
  'patByDoc', 'journalTools'];
function clearDataPanes() {
  for (const id of DATA_PANES) { const el = $(id); if (el) el.innerHTML = ''; }
  ovData = null; gapsData = null;
  payrollShown = null; payrollRows = []; schedShown = null; scheduleRows = [];
  payrollSeq++; schedSeq++; ovSeq++; gapsSeq++; patSeq++;
}
$('logoutBtn').onclick = async () => {
  try { await store.logout(); }
  finally {
    document.body.classList.remove('authed');
    clearHash();
    try { sessionStorage.removeItem(SID_KEY); } catch (e) {}
    restoredSession = false;
    clearDataPanes();
    renderLogin();
    location.reload();
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !store.dayExpired()) return;
  if (modalOpen()) return;
  clearHash();
  document.body.classList.remove('authed');
  location.reload();
});
applyIcons();
(async () => {
  renderLogin();
  try {
    await Promise.race([
      store.init(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('база не ответила за 20 сек')), 20000)),
    ]);
    if (store.me()) { restoredSession = true; await enter(); }
  } catch (e) {
    console.error('[init]', e);
    const libFail = /библиотек|supabase\.js|is not defined|undefined/i.test(String(e.message || e));
    toast(libFail ? 'Не удалось подключиться к базе — обновите страницу (Cmd/Ctrl+R).' : 'База отвечает медленно (' + String(e.message || e) + '). Вход по паролю должен работать.', true);
  }
  if (!store.me() && history.state?.own && location.hash) {
    clearHash();
  }
})();
//# sourceMappingURL=app.js.map
