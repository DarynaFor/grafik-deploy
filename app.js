/* Milena · Спринт 1 — вход, карточки сотрудников, специальности, журнал.
   Данные — через store.js (демо: localStorage · прод: Supabase).
   Все пользовательские строки при выводе проходят esc() — без исключений. */
// Версия импорта ДОЛЖНА идти в ногу с app.js/styles.css (index.html). Отставание
// безопасно только пока сервер отдаёт по ETag-ревалидации; при immutable-кэше
// новый app.js спарился бы с замороженным старым store.js → поломка у постоянных
// пользователей. Правило записано в milena-safety: бампать при КАЖДОЙ правке store.js.
import { makeStore, lineLabel, sameRate } from './store.js?v=55';

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
  // квитанция об оплате приёма — свой значок, чтобы «Оплаты пациентов» не были
  // третьей монеткой подряд рядом с «Расчёт» и «Ставки»
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

/* тема: тёмная/светлая. По умолчанию — как в системе; ручной выбор запоминается на устройстве.
   Начальный data-theme ставит инлайн-скрипт в <head> (до отрисовки — без мигания). */
const THEME_KEY = 'milena-theme';
const curTheme = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
function paintThemeBtn() { const b = $('themeBtn'); if (b) { b.innerHTML = curTheme() === 'light' ? ICONS.moon : ICONS.sun; b.title = curTheme() === 'light' ? 'Тёмная тема' : 'Светлая тема'; } }
function toggleTheme() { const next = curTheme() === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem(THEME_KEY, next); } catch (e) {} paintThemeBtn(); }

const palette = ['#CDE9D6', '#D3E2F7', '#F6DAC9', '#E6DEF9', '#FBEAC6', '#CFEBE6', '#F7D6DA', '#E3E9D0'];
// Цвет отделения выводится из ЕГО НАЗВАНИЯ (хэш → оттенок HSL). Поэтому любое новое отделение
// само получает стабильный цвет, добавление/переименование не меняет цвета остальных, число
// отделений не ограничено. Точка/полоска — насыщенный тон (читается на обеих темах),
// аватарка — та же гамма пастелью (тёмный текст поверх).
const hashStr = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const catHue = cat => hashStr(cat) % 360;
// вторичный хэш разводит близкие оттенки по светлоте, чтобы два соседних отделения не сливались
const catShift = cat => hashStr('~' + cat) % 12;
const catColor = cat => `hsl(${catHue(cat)}, 56%, ${50 + catShift(cat)}%)`;   // точка/полоска: 50–61%
const catTint = cat => `hsl(${catHue(cat)}, 58%, ${85 + (catShift(cat) >> 1)}%)`;   // аватарка (пастель): 85–90%
const initials = f => String(f || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const PAY_KINDS = [['оклад', 'Оклад'], ['фикс', 'Фикс/мес'], ['сутки', 'Сутки'], ['12ч', '12ч день / ночь'], ['почасово', 'Почасово'], ['процент', 'Процент']];
const payKindLabel = k => (PAY_KINDS.find(p => p[0] === k) || [k, k])[1];
const fmtDT = iso => { const d = new Date(iso); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
const fmt = n => Number(n || 0).toLocaleString('ru-RU');            // 80000 → «80 000» (деньги, ставки)

/* Надёжный разбор денежной суммы. Пробелы = разделитель тысяч. «50.000»/«50,000»
   (ровно 3 цифры после точки/запятой) = тысячи → 50000. Одна запятая = десятичный.
   Требует ПОЛНОГО совпадения формата — иначе кидает, а не обрезает молча (это payroll).
   Пусто → null (вызывающий сам решает, обязательно ли поле). Потолок под numeric(12,2). */
function parseNum(raw, opts) {
  const field = (opts && opts.field) || 'значение', thousands = !!(opts && opts.thousands);
  // Потолок разбора. По умолчанию ~10 млн (общая защита), но для ставок его
  // поднимает opts.max: иначе parseNum рубил бы всё >10 млн ДО checkRate, и
  // полоса «принять с подтверждением» (1–100 млн) была бы недостижима, а сам
  // RATE_ABSURD — мёртвым кодом. Решение Дарины: высокую сумму принимаем с
  // подтверждением, а не запрещаем.
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
    // Настоящий <form> с submit — не косметика: связка ключей (iCloud Keychain) предлагает
    // «Сохранить пароль» и потом подставляет его именно на отправке формы. Вход сбрасывается
    // каждый день (LOGIN_DAY_KEY в store.js), поэтому автозаполнение здесь — это разница между
    // «открыла иконку и вошла в один тап» и «набирает пароль руками каждое утро».
    // method="post" — страховка: если обработчик почему-то не навесится, браузер уйдёт на POST
    // (405), но НЕ утащит почту с паролем в адресную строку и историю, как сделал бы GET.
    // novalidate обязателен: <form> включает встроенную проверку type="email", и она
    // срабатывает ДО нашего обработчика. Почта с кириллицей (милена@клиника.рф) вообще
    // не смогла бы войти — браузер молча блокировал бы отправку и ругался бы своим
    // текстом на своём языке. Без формы такой проверки не было — возвращаем как было.
    body.innerHTML = `<form id="lgForm" method="post" action="" novalidate>
      <label class="flbl" for="lgEmail">Почта</label><input class="input" id="lgEmail" name="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next">
      <label class="flbl" for="lgPass">Пароль</label><input class="input" id="lgPass" name="password" type="password" autocomplete="current-password" enterkeyhint="go">
      <div style="height:16px"></div><button class="btn btn-primary" id="lgGo" type="submit" style="width:100%;justify-content:center">Войти</button>
      <div class="small" id="lgErr" style="color:var(--red-d);margin-top:10px"></div>
    </form>`;
    const go = async () => {
      const btn = $('lgGo');
      if (btn.disabled) return;                                       // защита от повторных кликов (первый коннект медленный)
      btn.disabled = true; btn.innerHTML = '<span class="btn-spin"></span>Входим…';
      $('lgErr').textContent = '';
      try { await store.login($('lgEmail').value.trim(), $('lgPass').value); await enter(); }   // успех → enter() прячет экран входа
      catch (e) { $('lgErr').textContent = 'Не получилось войти: ' + e.message; btn.disabled = false; btn.innerHTML = 'Войти'; }
    };
    // submit ловит и клик по кнопке, и Enter в любом поле — отдельный onclick не нужен.
    // Пустое поле не дёргает сервер, но и не молчит: молчаливый перевод фокуса владелец
    // читает как «кнопка не работает» — пишем словами. И гасим прошлую ошибку, иначе
    // старая красная строка висит поверх новой попытки.
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

/* ── каркас после входа ── */
const NAV = [
  // Обзор — только владельцу и первым: с него Милена начинает, оттуда видит,
  // не залезая в экраны, всё ли в порядке. Остальные роли работают, а не смотрят.
  { s: 'overview', i: 'chart', l: 'Обзор', ownerOnly: true },
  { s: 'employees', i: 'users', l: 'Сотрудники', staffOnly: true },
  { s: 'schedule', i: 'cal', l: 'График', staffOnly: true },
  { s: 'payroll', i: 'coin', l: 'Расчёт', staffOnly: true },
  { s: 'rates', i: 'coin', l: 'Ставки', ownerOnly: true },
  // Только owner+operator: RLS на patient_payment (pp_sel) пускает именно их,
  // касса оплаты пациентов не видит — это не её участок.
  { s: 'patients', i: 'card', l: 'Оплаты пациентов', staffOnly: true },
  // Импорт ведомостей: каждый вносит СВОИ документы. Кто какой вид денег может
  // писать — заперто в RLS money_line (миграция 008); экран лишь показывает то,
  // что роль реально может внести, и то же проверит база. show: canImport.
  { s: 'import', i: 'upload', l: 'Импорт', show: () => canImport() },
  { s: 'specialties', i: 'tag', l: 'Специальности', staffOnly: true },
  { s: 'journal', i: 'journal', l: 'Журнал', ownerOnly: true },
];
function isOwner() { return store.me()?.role === 'owner'; }
function navItems() { return NAV.filter(n => (!n.ownerOnly || isOwner()) && (!n.staffOnly || isStaff()) && (!n.show || n.show())); }

// ── Импорт: какие виды денег доступны роли (зеркало RLS ml_ins, миграция 046) ──
// Алёна (operator) — отпускные (три вида) и наличные; владелец и СЕО — всё.
// Кассиров (cashier1/cashier2) в списке НЕТ вообще: экран импорта требует ростер
// сотрудников для сопоставления ФИО, а его им закрывает emp_select (024 §6) —
// подробнее в комментарии ниже. Премию, кроме владельца, вносит только СЕО.
const IMPORT_KIND_META = {
  otpusk:      { label: 'Отпускные на карту',  hint: 'реестр отпускных (ТКБ) — деньги уже у человека, в «к выдаче» не идут' },
  otpusk_cash: { label: 'Отпускные наличными', hint: 'отпускные, которые выдаём из кассы — идут в «к выдаче»' },
  otpusk_nach: { label: 'Отпускные начислено', hint: 'НЕ выплата: сколько начислили. Справочно — ни в «к выдаче», ни в остаток не входит' },
  card_avans:  { label: 'Аванс на карту',      hint: 'реестр аванса (ТКБ), официальная часть' },
  card_rasch:  { label: 'ЗП на карту',         hint: 'ежемесячная зарплата на карту по 1С' },
  card_uvol:   { label: 'Расчёт на карту',     hint: 'окончательный расчёт при увольнении' },
  cash_avans:  { label: 'Аванс наличными',     hint: 'выданный наличными аванс' },
  cash:        { label: 'Наличные',            hint: 'выданные наличными' },
  premia:      { label: 'Премия',              hint: 'разовая премия, попадёт в журнал' },
};
// ⚠ Только owner+operator: сопоставление ФИО идёт на КЛИЕНТЕ по всему ростеру,
// а читать employee (emp_select) могут лишь owner и operator. Бух (cashier1/2)
// не видит даже имён — это НАМЕРЕННАЯ граница (миграция 024: «Расширять
// emp_select НЕЛЬЗЯ»). Поэтому карту-реестр (аванс/1С) сейчас грузит владелец
// (у него есть и ростер, и право писать card_*). Когда появится логин Бух 2,
// его импорт карты сделаем через СЕРВЕРНЫЙ матч-RPC (SECURITY DEFINER вернёт
// employee_id по списку, не раскрывая ростер) — тогда добавится cashier2.
const IMPORT_KINDS_BY_ROLE = {
  owner:    ['otpusk', 'otpusk_cash', 'otpusk_nach', 'card_avans', 'card_rasch', 'card_uvol', 'cash_avans', 'cash', 'premia'],
  operator: ['otpusk', 'otpusk_cash', 'otpusk_nach', 'cash_avans', 'cash'],
  ceo:      ['otpusk', 'otpusk_cash', 'otpusk_nach', 'card_avans', 'card_rasch', 'card_uvol', 'cash_avans', 'cash', 'premia'],
};
// СИНОНИМИЧНЫЕ виды: один и тот же документ можно залить дважды под разными
// видами, и дедуп базы этого НЕ поймает — он ключуется по виду (migrations/046 §6).
// Для отпускных это опаснее всего: ОБЕ графы проходят мимо Δ, поэтому сверка
// владельца тоже промолчит, а «к выдаче» вырастет на всю сумму реестра, который
// банк УЖЕ перечислил. Запрещать нельзя — часть отпускных законно платят на карту,
// часть наличными одному и тому же человеку. Поэтому предупреждаем перед записью.
// Карточную пару сюда не берём: card_* входят в Δ, и задвоение там видно расхождением.
const IMPORT_SIBLINGS = { otpusk: ['otpusk_cash'], otpusk_cash: ['otpusk'] };
function importKinds() { return IMPORT_KINDS_BY_ROLE[store.me()?.role] || []; }
function canImport() { return importKinds().length > 0; }
function renderNav() {
  $('sideNav').innerHTML = navItems().map(n => `<button class="nav-item${n.s === curScreen ? ' active' : ''}" data-s="${n.s}"><span class="ic">${ICONS[n.i]}</span>${n.l}</button>`).join('');
  $('mobileNav').innerHTML = navItems().map(n => `<button data-s="${n.s}" class="${n.s === curScreen ? 'active' : ''}"><span>${ICONS[n.i]}</span>${n.l}</button>`).join('');
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go(b.dataset.s));
}
function go(screen) {
  curScreen = screen;
  if (screen === 'overview') renderOverview();
  if (screen === 'payroll') renderPayroll($('payrollSearch')?.value || '');
  // Грузим ВСЕГДА, как renderPayroll выше. Условие `patShown !== patPeriod` было
  // сломано дважды: при обоих null оно давало false и экран не открывался НИКОГДА;
  // а если бы открылся — Алёна заносит импорт, а Милена не может обновить, потому
  // что повторный заход в тот же месяц был бы no-op. Экран сверки с кэшем, который
  // не сбрасывается, отменяет сам себя.
  if (screen === 'patients') renderPatients();
  if (screen === 'import') renderImport();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  $('s-' + screen).classList.add('show');
  renderNav();
  document.querySelector('.main').scrollTop = 0;
}
const ROLE_LABELS = { owner: 'владелец', operator: 'оператор', cashier1: 'касса · Бух 1', cashier2: 'карта / 1С · Бух 2', ceo: 'директор' };
const isStaff = () => ['owner', 'operator', 'ceo'].includes(store.me()?.role);   // кто работает с карточками
// График ведёт оператор (Алёна) с переданных головами отделений листов. Владелец
// (Милена) тоже может править — чтобы протестировать и объяснить Алёне, а также
// поправить как надзор (решение Дарины 27.07: раньше владелец был только-просмотр).
// СЕО ведёт график в этом месяце (Алёна в отпуске); все его правки — в журнал Милене.
const canEditSchedule = () => ['operator', 'owner', 'ceo'].includes(store.me()?.role);
// Создание/правка карточек и ставок — владелец и СЕО (RLS emp_insert/update,
// rate_insert/update, reconcile = owner,ceo; миграция 035). У остальных — просмотр.
const canEditCards = () => ['owner', 'ceo'].includes(store.me()?.role);
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
  $('addEmpBtn').style.display = canEditCards() ? '' : 'none';
  $('roNote').innerHTML = canEditCards() ? '' : `<div class="readonly-note">${ICONS.lock} Карточки, телефоны и ставки заводит и меняет владелец — у вас просмотр.</div>`;
  await refresh();
  // Владелец начинает с обзора (он для него и создан), остальные — с рабочего экрана.
  go(isOwner() ? 'overview' : 'employees');
}
// Кастомный дропдаун «в нашем стиле»: нативный <select> нельзя стилизовать — попап с
// опциями рисует ОС (белый, чужой теме). host — div.cselect; opts — [{v,label}]; onPick(v).
function makeDropdown(host, opts, cur, onPick) {
  const curOpt = opts.find(o => o.v === cur) || opts[0];   // если сохранённого значения нет в опциях — дефолт (метка и value не разойдутся)
  const curLabel = curOpt.label;
  host.classList.add('cselect');
  host.dataset.value = curOpt.v;
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
  wire('payrollCat', () => drawPayroll($('payrollSearch')?.value || ''));
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
/* Телефон. Зеркало phone_norm() из migrations/023 — держать в согласии с базой.
   Расхождение здесь означает, что форма примет то, что база отвергнет; либо, что
   опаснее, пропустит то, что база превратит в ДРУГОЙ номер. В базе номер всегда
   лежит канонически (79XXXXXXXXX), человеку показываем красиво. */
const PHONE_OK = /^79\d{9}$/;
function normPhone(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/[^0-9+() .-]/.test(s)) return s;                                   // буквы, юникод-цифры → не наш формат
  const d = s.replace(/[^0-9]/g, '');
  if (!d) return s;
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) return '7' + d.slice(1);
  if (d.length === 10 && d[0] === '9') return '7' + d;                    // без кода страны, только мобильный
  return d;
}
const fmtPhone = p => PHONE_OK.test(String(p ?? '')) ? `+7 ${String(p).slice(1,4)} ${String(p).slice(4,7)}-${String(p).slice(7,9)}-${String(p).slice(9)}` : String(p ?? '');
// Пробелы карточки: чего не хватает, чтобы человек был готов к расчёту/выдаче.
const FIO_SENTINEL = '⚠ уточнить фамилию';   // маркер неполного ФИО, лежит в position импортированных карточек
function cardGaps(e) {
  const fio = String(e.fio || '').trim();
  return {
    // пробел по СОДЕРЖИМОМУ: нужна фамилия+имя (>=2 слова). sentinel — доп. сигнал по импортированным.
    fio: e.position === FIO_SENTINEL || fio.split(/\s+/).filter(Boolean).length < 2,
    rate: !(e.lines || []).some(l => !l.valid_to && l.line_type === 'основной'),
    // ТОТ ЖЕ инвариант, что CHECK в базе. Раньше стояло digits.length < 11 —
    // и «77921554123» (потерянная цифра, дописанная кодом страны) проходило,
    // значок пропадал, а СМС ушла бы чужому. См. migrations/023.
    phone: !PHONE_OK.test(normPhone(e.phone)),
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
    if ($('empList').dataset.gap && !cnt[$('empList').dataset.gap]) $('empList').dataset.gap = '';   // активный фильтр опустел → снять (иначе чип исчезнет и не отключить)
    const gapF = $('empList').dataset.gap || '';
    // чипы — фильтры: клик показывает только тех, у кого этот пробел; повторный клик снимает
    const chip = (n, key, label) => n ? `<button class="gap-chip${gapF === key ? ' on' : ''}" data-gap="${key}">${n} ${label}</button>` : '';
    $('roNote').innerHTML = `<div class="fill-stat"><span class="fs-count"><b>${done}</b> из <b>${all.length}</b> заполнены</span>
      <span class="gap-chips">${chip(cnt.rate, 'rate', 'без ставки')}${chip(cnt.phone, 'phone', 'без телефона')}${chip(cnt.spec, 'spec', 'без спец.')}${chip(cnt.fio, 'fio', 'без фамилии')}</span>
      <label class="rt-toggle"><input type="checkbox" id="empOnlyInc" ${onlyInc ? 'checked' : ''}> только неполные</label></div>`;
    $('empOnlyInc').onchange = ev => { $('empList').dataset.onlyInc = ev.target.checked ? '1' : ''; if (ev.target.checked) $('empList').dataset.gap = ''; renderEmployees($('empSearch').value || ''); };
    $('roNote').querySelectorAll('.gap-chip').forEach(b => b.onclick = () => {
      $('empList').dataset.gap = ($('empList').dataset.gap === b.dataset.gap) ? '' : b.dataset.gap;
      $('empList').dataset.onlyInc = '';   // фильтр по конкретному пробелу заменяет «только неполные»
      renderEmployees($('empSearch').value || '');
    });
  }
  const onlyInc = isOwner() && $('empList').dataset.onlyInc === '1';
  const gapF = isOwner() ? ($('empList').dataset.gap || '') : '';
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  const catF = $('empCat')?.dataset.value || '';   // дропдаун заполняет fillCatSelects при загрузке
  const arch = canEditCards() ? employees.filter(e => e.status === 'archived' && String(e.fio || '').toLowerCase().includes(f)) : [];   // архив показываем только тем, кто правит карточки
  const showArch = $('empList').dataset.showArch === '1';
  let html = arch.length ? `<div style="margin:0 0 10px"><button class="btn btn-ghost btn-sm" id="archToggle">${showArch ? 'Скрыть архив' : 'Архив · ' + arch.length}</button></div>` : '';
  for (const cat of cats) {
    if (catF && cat !== catF) continue;
    let list = all.filter(e => specCat(e.specialty_id) === cat && String(e.fio || "").toLowerCase().includes(f));
    if (gapF) list = list.filter(e => cardGaps(e)[gapF]);
    else if (onlyInc) list = list.filter(isIncomplete);
    if (!list.length) continue;
    html += `<div class="group-label"><span class="caps"><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${list.length}</span><span class="line"></span></div>`;
    for (const e of list) {
      const pays = activeLines(e).map(l => `<span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${esc(lineLabel(l))}</span>`).join(' ') || '<span class="pill k">строк начисления нет</span>';
      const g = cardGaps(e);
      const gap = isOwner() && isIncomplete(e) ? `<span class="gap-dot" title="Не хватает">⚠ ${[g.rate && 'ставка', g.phone && 'телефон', g.spec && 'спец.', g.fio && 'фамилия'].filter(Boolean).join(', ')}</span>` : '';
      html += `<div class="emp-row${isOwner() && isIncomplete(e) ? ' incomplete' : ''}" data-id="${e.id}"><div class="emp-ava" style="background:${catTint(cat)}">${esc(initials(e.fio))}</div><div class="emp-name">${esc(e.fio)}${gap}<div class="sub">${esc(specName(e.specialty_id))}</div></div><div class="emp-pay">${pays}</div><div class="chev">${ICONS.chevR}</div></div>`;
    }
  }
  if (showArch && arch.length) {
    html += `<div class="group-label"><span class="caps">В архиве · ${arch.length}</span><span class="line"></span></div>`;
    for (const e of arch) html += `<div class="emp-row" data-id="${e.id}" style="opacity:.55"><div class="emp-ava" style="background:var(--fill-2)">${esc(initials(e.fio))}</div><div class="emp-name">${esc(e.fio)}<div class="sub">в архиве · ${esc(specName(e.specialty_id))}</div></div><div class="emp-pay"></div><div class="chev">${ICONS.chevR}</div></div>`;
  }
  $('empList').innerHTML = html || `<div class="empty">${all.length ? 'Никого не найдено' : 'Пока нет сотрудников.' + (isOwner() ? '<br><span class="small">Нажмите «Карточка», чтобы создать первую.</span>' : '')}</div>`;
  applyIcons($('empList'));
  const at = $('archToggle'); if (at) at.onclick = () => { $('empList').dataset.showArch = showArch ? '' : '1'; renderEmployees($('empSearch').value || ''); };
  $('empList').querySelectorAll('.emp-row').forEach(r => r.onclick = () => openCard(+r.dataset.id));
}
// Точный признак неполного месяца — из дат приёма/увольнения, а не из эвристики
// «размах окладных дней < 60%». Показываем как ПРЕДУПРЕЖДЕНИЕ: расчёт оклада пока
// прежний (знаменатель = свои плановые дни → нанятый 20-го получит полный оклад
// за неполный месяц), поэтому владелец должен это видеть и обработать вручную,
// пока Милена не решит правило пропорции. Смотрим на ТЕКУЩИЙ период расчёта.
function partialMonthNote(e) {
  const per = payPeriod || nowPeriod();               // 'YYYY-MM'
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
function openCard(id) {
  const e = employees.find(x => x.id === id); if (!e) return;
  const lines = activeLines(e).map(l => `<div class="line-row"><span class="pill ${l.line_type === 'основной' ? 'o' : 's'}">${l.line_type === 'основной' ? 'Основной' : 'Совмест.'}</span><div style="font-weight:700">${esc(lineLabel(l))}</div><span class="lv muted small">с ${esc(l.valid_from || '—')}</span></div>`).join('') || '<div class="empty" style="padding:20px">Строк начисления нет</div>';
  const oldLines = (e.lines || []).filter(l => l.valid_to).map(l => `<div class="line-row" style="opacity:.55"><span class="pill k">закрыта ${esc(l.valid_to)}</span><div>${esc(lineLabel(l))}</div></div>`).join('');
  $('cardBody').innerHTML = `
    <div class="card cardpad" style="margin-bottom:16px"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="emp-ava" style="width:64px;height:64px;border-radius:20px;font-size:20px;background:${palette[id % palette.length]}">${esc(initials(e.fio))}</div>
      <div style="flex:1;min-width:200px"><h1 style="font-size:23px;font-weight:700">${esc(e.fio)}</h1><p class="muted" style="margin-top:2px">${esc(specName(e.specialty_id))}</p></div>
      <div id="cardMoney" class="card-money"></div>
      ${canEditCards() ? `<button class="btn btn-ghost btn-sm" id="editEmpBtn">${ICONS.edit}Редактировать</button><button class="btn btn-ghost btn-sm" id="archiveEmpBtn">${e.status === 'active' ? 'В архив' : 'Из архива'}</button>` : `<span class="tag">${ICONS.lock} правит владелец</span>`}
    </div></div>
    <div class="grid2">
      <div class="card cardpad"><div class="caps" style="margin-bottom:12px">Строки начисления</div>${lines}${oldLines ? `<div class="caps" style="margin:16px 0 6px">История ставок</div>${oldLines}` : ''}</div>
      <div class="card cardpad">
        <div class="field"><span class="caps">Специальность</span><span class="val">${esc(specName(e.specialty_id))}</span></div>
        <div class="field"><span class="caps">Должность</span><span class="val">${esc(e.position === FIO_SENTINEL ? '—' : (e.position || '—'))}</span></div>
        <div class="field"><span class="caps">Телефон (для СМС)</span><span class="val num">${esc(fmtPhone(e.phone) || '—')}</span></div>
        <div class="field"><span class="caps">Принят / уволен</span><span class="val small">${e.hired_on || e.left_on ? esc(dm(e.hired_on) || '—') + ' — ' + esc(dm(e.left_on) || '…') : '—'}</span></div>
        <div class="field"><span class="caps">Статус</span><span class="val">${e.status === 'active' ? 'активен' : 'архив'}</span></div>
        <div class="field" style="margin:0"><span class="caps">Карточка создана</span><span class="val small">${esc(fmtDT(e.created_at))}</span></div>
      </div>
    </div>${partialMonthNote(e)}
    <div class="card cardpad" style="margin-top:16px">
      <div class="caps" style="margin-bottom:10px">Комментарии</div>
      <div id="cardNotes"><span class="muted small">загружаем…</span></div>
      ${isStaff() ? `<div class="me-add" style="margin-top:12px">
        <input class="input" id="noteInput" placeholder="добавить заметку к карточке…" autocomplete="off" maxlength="4000">
        <button class="btn btn-primary btn-sm" id="noteAdd">${ICONS.plus}Добавить</button>
      </div>` : ''}
    </div>`;
  $('cardBody').dataset.emp = id;      // чья карточка сейчас открыта — чтобы
  applyIcons($('cardBody'));           // поздний ответ по деньгам не лёг в чужую
  const eb = $('editEmpBtn'); if (eb) eb.onclick = () => employeeForm(e);
  const ab = $('archiveEmpBtn'); if (ab) ab.onclick = () => toggleArchive(e);
  go('card');
  loadCardMoney(id);
  loadCardNotes(id);
}
// Лента заметок на карточке (миграция 037). Добавляют owner/operator/ceo/бухгалтер.
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

/* «К выдаче» в карточке (требование §1/§13). Цифры берём из того же
   v_month_total, что и экран «Расчёт» — чтобы карточка и ведомость никогда не
   показывали разное. Ошибку не выводим: деньги здесь — дополнение к карточке,
   а не её смысл; если не загрузились, карточка должна остаться рабочей. */
async function loadCardMoney(id) {
  const box = $('cardMoney'); if (!box || !isStaff()) return;
  const per = payPeriod || nowPeriod();
  try {
    const r = await store.getPayrollRow(id, per);
    if (!r || +$('cardBody').dataset.emp !== id) return;
    box.innerHTML = `<div class="cm-pay"><span class="caps">Осталось выдать · ${esc(periodLabel(per))}</span>
        <b class="money">${rub(r.delta_kop)} ₽</b></div>
      <div class="cm-chips">
        <span class="mini-chip">Начислено: <b>${rub(r.salary_kop)} ₽</b></span>
        ${cardTotal(r) ? `<span class="mini-chip">Карта: <b>${rub(cardTotal(r))} ₽</b></span>` : ''}
        ${r.cash_kop + r.cash_avans_kop ? `<span class="mini-chip">Наличными: <b>${rub(r.cash_kop + r.cash_avans_kop)} ₽</b></span>` : ''}
        ${/* ОТДЕЛЬНЫЙ чип, а не слагаемое в «Наличными»: тождество
              «Осталось выдать = Начислено − Карта − Наличными» должно оставаться
              верным. Без него карточка человека, весь месяц бывшего в отпуске,
              показывала СПЛОШНЫЕ НУЛИ (оклад за дни отпуска не начисляется — 044,
              значит Начислено 0 и Δ 0), пока касса должна ему все отпускные. */''}
        ${r.to_pay_kop ? `<span class="mini-chip">К выдаче наличными: <b>${rub(r.to_pay_kop)} ₽</b></span>` : ''}
        ${r.flag_no_rate ? '<span class="mini-chip warn">нет ставки</span>' : ''}
      </div>`;
  } catch (err) { box.innerHTML = ''; }
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
/* ЕДИНЫЙ контроль ставки для обоих путей ввода (карточка и экран «Ставки»).
   Раньше их было два, и они разошлись: карточка пропускала 0, «Ставки» — нет.
   Пределы (кроме верхнего, см. ниже) совпадают с CHECK'ами в migrations/010/015. */
// Порог НЕ запрета, а ПЕРЕСПРОСА. Решение Дарины: высокая сумма — это не всегда
// опечатка; если владелец подтверждает, что не опечатка — принимаем. Поэтому
// > RATE_CONFIRM checkRate не бракует, а помечает `needsConfirm`, и обработчик
// сохранения спрашивает «точно не опечатка?». В базе жёсткий предел поднят до
// абсурда (100 млн, migrations/015) — там только защита от мусора/переполнения.
const RATE_CONFIRM = 1000000;
const RATE_ABSURD  = 100000000;
function checkRate(l) {
  if (l.pay_kind === 'процент') {
    if (l.percent == null) throw new Error('Укажите процент');
    if (l.percent <= 0 || l.percent > 100) throw new Error('Процент должен быть больше 0 и не больше 100');
    return l;
  }
  if (l.amount == null) throw new Error('Укажите сумму ставки');
  if (l.amount <= 0) throw new Error('Ставка должна быть больше 0');
  // Верхнюю границу (абсурд, RATE_ABSURD=100 млн) держит parseNum через opts.max
  // ДО checkRate — здесь дублировать не нужно, иначе это недостижимый мёртвый код.
  if (l.pay_kind === '12ч') {
    if (l.amount_night == null) throw new Error('Для «12ч» укажите и дневную, и ночную ставку');
    if (l.amount_night <= 0) throw new Error('Ночная ставка должна быть больше 0');
  }
  // Высокая, но не абсурдная сумма → не ошибка, а повод переспросить.
  l._needsConfirm = (l.amount > RATE_CONFIRM) || (l.amount_night != null && l.amount_night > RATE_CONFIRM);
  return l;
}
// Собирает суммы строк, требующие подтверждения (для диалога перед сохранением).
function bigAmounts(lines) {
  const out = [];
  for (const l of lines || []) {
    if (l._keep || l.pay_kind === 'процент') continue;
    if (l.amount != null && l.amount > RATE_CONFIRM) out.push(l.amount);
    if (l.amount_night != null && l.amount_night > RATE_CONFIRM) out.push(l.amount_night);
  }
  return out;
}
// Диалог «точно не опечатка?» → Promise<boolean>. Показывается только когда есть
// суммы выше порога переспроса.
function confirmBigAmounts(amounts) {
  return new Promise(resolve => {
    const list = amounts.map(a => `<b>${fmt(a)} ₽</b>`).join(', ');
    // ВТОРОЙ слой (showModal2): диалог ложится ПОВЕРХ формы, а не затирает её —
    // иначе «Исправить» возвращал бы в пустоту, потеряв весь ввод карточки.
    showModal2(`<h3>Проверьте сумму</h3><div class="msub">Крупная ставка — это точно не опечатка?</div>
      <div class="rc-diff"><div>Вводите: ${list}</div></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="baNo">Исправить</button>
        <button class="btn btn-primary btn-sm" id="baYes">${ICONS.check}Да, всё верно</button></div>`);
    $('baNo').onclick = () => { closeModal2(); resolve(false); };
    $('baYes').onclick = () => { closeModal2(); resolve(true); };
  });
}

/* Десять цифр — единственный по-настоящему двусмысленный ввод: это «набрала без
   +7» или «потеряла цифру»? База различить не может (и оба варианта дают
   правильный по форме номер), поэтому спрашиваем здесь, показав, что получится.
   Цена ошибки — код на выдачу уходит чужому человеку, а карточка выглядит
   заполненной. */
function confirmPhone(norm) {
  return new Promise(resolve => {
    showModal2(`<h3>Проверьте номер</h3><div class="msub">Дописали код страны — вдруг потерялась цифра?</div>
      <div class="rc-diff"><div>Сохраним как <b>${esc(fmtPhone(norm))}</b></div></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="phNo">Исправить</button>
        <button class="btn btn-primary btn-sm" id="phYes">${ICONS.check}Да, верно</button></div>`);
    $('phNo').onclick = () => { closeModal2(); resolve(false); };
    $('phYes').onclick = () => { closeModal2(); resolve(true); };
  });
}

/* ══ Импорт ведомостей ═════════════════════════════════════════════════════
   Вставка списка из документа (ФИО + сумма) → сопоставление с карточками →
   предпросмотр (кого нашли / кого нет / что уже внесено) → человек подтверждает
   → запись в money_line ОДНИМ пакетом. До подтверждения ничего не пишется.
   Право писать вид денег заперто в RLS money_line (ml_ins, миграция 022): тут
   лишь то, что роль реально может внести, и то же проверит база. Прямая вставка
   всегда source='manual' — метка «из парсера» (source='import' + import_batch)
   зарезервирована за серверной процедурой (010 §8); её сделаем к .xlsx-загрузке.
   Файлом .xlsx — следующий шаг; пока вставка текста (быстрая польза).
   Сопоставление — якорь по фамилии; имя может быть в другом падеже/инициале. */
const MONEY_MAX_KOP = 100000000;   // потолок одной записи (money_line_sane_chk, 010): 1 000 000 ₽
const MONEY_BIG_KOP = 30000000;    // «крупная, переспросить» — 300 000 ₽ (ловим опечатку на порядок)
const MAX_IMPORT_ROWS = 500;       // защита от гигантской вставки: ведомость клиники ≤ ~150 строк
const importState = { kind: null, period: null, rows: [], parsed: false, existing: new Set(), loading: false, truncated: false, fileName: null };

// Может ли строка попасть в загрузку: есть человек, сумма в пределах, не дубль.
function importCanInclude(r) { return !!(r.chosenId && r.amount_kop != null && r.amount_kop <= MONEY_MAX_KOP && !r.dup); }

function fioNorm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^a-zа-я-]+/gi, ' ').replace(/\s+/g, ' ').trim();
}
// Левенштейн → доля совпадения 0..1 (ловим опечатку в фамилии).
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
// Уверенность по имени. Полное совпадение — да. Инициал против полного имени с
// той же буквы — да (в ведомости «Иванова М.П.»). Но ДВА РАЗНЫХ полных имени
// (Пётр против Павел) с одной буквы — НЕ уверенно: это разные люди, не опечатка.
function givenConfident(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aInit = a.length <= 1, bInit = b.length <= 1;
  return (aInit || bInit) && a[0] === b[0];
}
// Сопоставление ФИО из ведомости с карточкой. Якорь — фамилия (первое слово).
// Возвращаем не вердикт, а предложение со статусом; человек в предпросмотре решает.
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
    // Одна фамилия в базе, но имя совпало лишь по первой букве двух ПОЛНЫХ имён
    // → weak (в предпросмотре с выбором), НЕ ok. Иначе «Иванов Пётр» молча ушёл
    // бы деньгами «Иванову Павлу». (аудит H1)
    const gOk = givenConfident(given, fioNorm(bySur[0].fio).split(' ')[1] || '');
    return { status: gOk ? 'ok' : 'weak', emp: bySur[0] };
  }
  if (bySur.length > 1) {
    // Несколько однофамильцев: ok ТОЛЬКО если полное имя из ведомости уникально
    // совпало; либо (ввод — инициал) инициал уникально указал на одного. Иначе
    // many — пусть выберут руками, не угадываем по первой букве полного имени.
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
// Сумма из ведомости → копейки. СТРОГО: «77 520,00» (пробел-тысячи + запятая-
// копейки), «70.000» / «1.234.567» (точки — тысячи ПО 3), «300.00» (точка-копейки
// 1–2 знака), «150000». Всё прочее → null: дата «28.07.2026», минус, «1e5», номер
// с буквами, «1,234» — чтобы не залить чужой столбец под видом суммы. Разобранное
// показываем рублями рядом с исходником — промах видно (\s покрывает и nbsp).
function parseAmountKop(s) {
  let t = String(s || '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;                    // старт с цифры, только цифры/точки/запятые
  const commas = (t.match(/,/g) || []).length, dots = (t.match(/\./g) || []).length;
  if (commas > 1) return null;                                // «1,,2», «1,2,3»
  if (commas === 1) {
    const i = t.indexOf(','), intp = t.slice(0, i), frac = t.slice(i + 1);
    if (frac.length < 1 || frac.length > 2) return null;      // копейки 1–2 знака
    if (intp.includes('.') && !/^\d{1,3}(\.\d{3})*$/.test(intp)) return null;  // точки до запятой — тысячи по 3
    t = intp.replace(/\./g, '') + '.' + frac;
  } else if (dots >= 1) {
    const last = t.slice(t.lastIndexOf('.') + 1);
    if (dots >= 2 || last.length === 3) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return null;         // все точки — тысячи по 3; «28.07.2026» отсеивается
      t = t.replace(/\./g, '');
    } else if (last.length > 2) return null;                  // «12.3456» — не деньги
  }
  const v = parseFloat(t);
  return isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}
// Строка ведомости → { fio, amount }. Колонки: таб / 2+ пробела / «|». ФИО —
// ячейка с максимумом кириллицы; сумма — последняя ячейка, что парсится как деньги.
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
  // Сумма: среди денежных ячеек предпочитаем отформатированную как деньги
  // (копейки-запятая / разделитель тысяч), чтобы не схватить табельный номер или
  // короткое целое; при равном счёте — самую правую.
  let amount = '', bestScore = -1;
  for (const c of cells) {
    if (c === fioCell || parseAmountKop(c) == null) continue;
    const norm = c.replace(/\s/g, ' ');                          // nbsp → пробел для проверки формата
    const score = (/,\d{1,2}$/.test(norm) ? 2 : 0) + (/\d[ .]\d{3}(\D|$)/.test(norm) ? 1 : 0);
    if (score >= bestScore) { bestScore = score; amount = c; }
  }
  return { fio: fioCell, amount };
}
// Шапка/итог/не-ФИО? Общий фильтр для вставки и .xlsx.
function isImportHeaderFio(fn) {
  return !fn || !/[а-яё]{2}/i.test(fn) || /^(итого|итог|всего|сумма|ведомость|фио|сотрудник|списком|расшифровка|период|№)/.test(fn);
}
// Строка предпросмотра из ФИО + суммы (копейки) + пометки «уволен» (зачёркнут в
// файле). Общий вход для вставки и .xlsx. Автогалочка ТОЛЬКО у точного совпадения
// (ok) и не у уволенного: weak/fuzzy/уволен подставляем в выбор, но галочку
// человек ставит сам. (аудит H2)
function buildImportRow(fio, amount_kop, rawAmount, struck) {
  const match = matchEmp(fio, employees);
  const over = amount_kop != null && amount_kop > MONEY_MAX_KOP;      // > 1 млн — база не примет
  const autoOk = match.status === 'ok' && amount_kop != null && !over && !struck;
  return { raw: fio, rawAmount: rawAmount || '', amount_kop, over, struck: !!struck, match,
    chosenId: match.emp?.id || null, autoOk, include: autoOk, dup: false, userSet: false };
}
function parseImport() {
  const ta = $('impPaste'); const text = ta ? ta.value : '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  importState.truncated = false;
  importState.fileName = null;                                     // вставка — не файл (для провенанса)
  for (const line of lines) {
    if (rows.length >= MAX_IMPORT_ROWS) { importState.truncated = true; break; }   // защита от гигантской вставки
    const { fio, amount } = splitImportLine(line);
    if (isImportHeaderFio(fioNorm(fio))) continue;
    rows.push(buildImportRow(fio, parseAmountKop(amount), amount, false));
  }
  importState.rows = rows; importState.parsed = true;
}

/* ── Чтение .xlsx прямо в браузере, без внешних зависимостей ────────────────
   .xlsx = ZIP(XML). Распаковываем нативным DecompressionStream('deflate-raw'),
   читаем sharedStrings / styles / лист через DOMParser. Зачёркнутый шрифт
   (styles.xml <strike/>) → уволен. Суммы-числа берём КАК ЧИСЛО (без строковой
   неоднозначности), текст — строгим parseAmountKop. Идём по фактическим ячейкам
   <c>, а не по <dimension> — раздутый номинальный диапазон (баг экспортов 1С) не
   мешает. Файлом Бух пока не грузит (нет ростера) — это владелец/Алёна. */
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
    if (dv.getUint32(p, true) !== 0x02014b50) break;                 // central directory header
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);                   // защита от «zip-бомбы»/раздутого файла
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);                          // смещение локального заголовка
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (want.test(name) && lho + 30 <= buf.length) {
      if (uncompSize > 40 * 1024 * 1024) throw new Error('слишком большой лист в файле');   // от раздутого/битого .xlsx
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.subarray(start, start + compSize);
      out[name] = method === 0 ? comp : await inflateRaw(comp);      // 0=STORE, 8=DEFLATE
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
  if (fonts) [...fonts.children].forEach((f, i) => { if (f.tagName === 'font' && f.getElementsByTagName('strike').length) struckFonts.add(i); });
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfs) [...cellXfs.children].forEach((xf, i) => { if (xf.tagName === 'xf' && struckFonts.has(+(xf.getAttribute('fontId') || 0))) struck.add(i); });
  return struck;
}
// Стили с ДАТА/ВРЕМЯ форматом. В Excel дата — это ЧИСЛО (серия дней: 20.07.2026 =
// 46223), и без этой проверки колонка даты справа от суммы утекла бы «суммой»
// 46 223 ₽. Отличаем по numFmt: встроенные дата-ID + пользовательский код с y/d/h.
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
// Индекс столбца из «A1». Клэмп к максимуму Excel (XFD=16383): битый ref типа
// «ZZZZZZ1» дал бы индекс в сотни млн → разреженный массив на 3e8 → зависание
// цикла по дыркам (for..of их НЕ пропускает). (аудит H1)
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
// Ячейка → копейки. Число — напрямую (без строковой неоднозначности и float-шума),
// текст — строгим parseAmountKop. Дата-ячейка (число с дата-форматом) НЕ сумма.
function cellAmountKop(c) {
  if (!c || c.date) return null;
  if (c.num != null) return c.num > 0 ? Math.round(c.num * 100) : null;
  return parseAmountKop(c.value);
}
// Колонка суммы по ЗАГОЛОВКУ (в первых строках) — надёжнее, чем гадать по формату:
// табельный номер / оклад справа от суммы иначе перебил бы её при равном счёте.
const XLSX_AMOUNT_HDR = /сумма|выдач|выдать|начислен|оклад|аванс|отпускн|зарплат|премия|к.выдаче/i;
function xlsxAmountColumn(grid) {
  for (const cells of grid.slice(0, 6)) {
    for (let ci = 0; ci < cells.length; ci++) {
      const c = cells[ci];
      if (c && c.num == null && XLSX_AMOUNT_HDR.test(c.value)) return { col: ci, header: cells };   // заголовок = текст, не число
    }
  }
  return { col: -1, header: null };
}
function xlsxGridToRows(grid) {
  const out = [];
  importState.truncated = false;
  const { col: amountCol, header: headerCells } = xlsxAmountColumn(grid);
  for (const cells of grid) {
    if (cells === headerCells) continue;                                  // саму строку-шапку не берём
    if (out.length >= MAX_IMPORT_ROWS) { importState.truncated = true; break; }
    let fioCell = null, bestC = -1;
    for (const c of cells) { if (!c) continue; const k = (c.value.match(/[а-яё]/gi) || []).length; if (k > bestC) { bestC = k; fioCell = c; } }
    if (!fioCell || isImportHeaderFio(fioNorm(fioCell.value))) continue;
    let amountCell = null;
    // 1) колонка суммы из шапки — если там валидная сумма
    if (amountCol >= 0 && cells[amountCol] && cells[amountCol] !== fioCell && cellAmountKop(cells[amountCol]) != null)
      amountCell = cells[amountCol];
    // 2) иначе по формату: копейки-запятая / дробное число / тысячи; при равном — правая
    if (!amountCell) {
      let bestScore = -1;
      for (const c of cells) {
        if (!c || c === fioCell || cellAmountKop(c) == null) continue;
        const norm = c.value.replace(/\s/g, ' ');
        const score = (c.num != null ? 1 : 0)
          + (c.num != null && !Number.isInteger(c.num) ? 2 : 0)          // число с копейками — сильный признак денег
          + (/,\d{1,2}$/.test(norm) ? 2 : 0) + (/\d[ .]\d{3}(\D|$)/.test(norm) ? 1 : 0);
        if (score >= bestScore) { bestScore = score; amountCell = c; }
      }
    }
    const rawAmount = amountCell ? (amountCell.num != null ? String(amountCell.num) : amountCell.value) : '';
    out.push(buildImportRow(fioCell.value, cellAmountKop(amountCell), rawAmount, fioCell.struck));
  }
  return out;
}
// Первый ВИДИМЫЙ лист = порядок в workbook.xml + маппинг r:id→файл в .rels, а НЕ
// имя файла sheetN.xml (при перестановке вкладок первым может быть sheet3.xml).
// Фолбэк — sheet1.xml / первый по алфавиту. (аудит M2)
function xlsxFirstSheetPath(parts) {
  const wsKeys = Object.keys(parts).filter(k => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort();
  if (wsKeys.length <= 1) return wsKeys[0];                          // один лист — без гаданий
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
  } catch (e) { /* фолбэк ниже */ }
  return parts['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : wsKeys[0];
}
// Загрузка из файла: .xlsx (ZIP) или .csv (грубо, RU-разделитель «;» → таб).
async function importFromFile(file) {
  if (!file) return;
  // Любая попытка файла ОБНУЛЯЕТ предпросмотр: чтобы после провала (битый/большой
  // файл B) не остались и не были подтверждены строки прошлого файла A. (аудит M1)
  importState.rows = []; importState.parsed = false; importState.truncated = false; importState.fileName = file.name || null; renderImportPreview();
  if (file.size > 6 * 1024 * 1024) { toast('Файл больше 6 МБ — вставьте список текстом', true); return; }
  const name = (file.name || '').toLowerCase();
  try {
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      const text = await file.text();
      const ta = $('impPaste');
      // ; (RU-CSV) как разделитель колонок → таб, чтобы разобрать общим путём
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
    importState.rows = []; importState.parsed = false; renderImportPreview();   // провал не оставляет чужих строк
    toast('Не удалось прочитать файл: ' + (e.message || 'ошибка'), true);
  }
}
// Пересчёт «уже внесено» + права на галочку. Ручной выбор (userSet) сохраняем;
// нетронутые строки — по autoOk. Дубль / пере-лимит всегда снимают галочку.
async function importLoadExisting() {
  importState.existing = new Set();
  try { importState.existing = await store.existingMoneyIds(importState.period, importState.kind); }
  catch (e) { /* дубль-подсветка не критична — база всё равно append-only */ }
  // Тот же документ, залитый под «родственным» видом: база его не считает дублем.
  importState.sibling = new Set(); importState.siblingKind = null;
  for (const sk of (IMPORT_SIBLINGS[importState.kind] || [])) {
    try {
      const s = await store.existingMoneyIds(importState.period, sk);
      if (s.size) { importState.siblingKind = sk; s.forEach(id => importState.sibling.add(id)); }
    } catch (e) { /* подсказка, а не гейт */ }
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
        <div class="imp-kinds">${kinds.map(k => `<button class="imp-kind${k === importState.kind ? ' on' : ''}" data-ik="${k}">${esc(IMPORT_KIND_META[k].label)}</button>`).join('')}</div>
        <div class="imp-hint">${esc(meta.hint || '')}</div>
      </div>
      <div class="imp-field imp-month">
        <label>За месяц</label>
        <input type="month" id="impMonth" value="${importState.period}">
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
  $('impMonth').onchange = e => { importState.period = e.target.value; if (importState.parsed) importLoadExisting().then(renderImportPreview); };
  $('impParse').onclick = async () => { parseImport(); await importLoadExisting(); renderImportPreview(); };
  $('impFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; importFromFile(f); };   // value='' → тот же файл повторно перечитается
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
// Подтверждение → Promise<boolean>. Показываем сумму и то, что отменить можно
// только сторно — как и в других денежных действиях.
function confirmImportLoad(kindLabel, period, count, total, warn) {
  return new Promise(resolve => {
    showModal(`<h3>Загрузить «${esc(kindLabel)}»?</h3>
      <div class="msub">За ${esc(period)} · записи попадут в журнал, их увидит владелец</div>
      <div class="rc-diff"><div><b>${count}</b> чел · <b>${fmt(Math.round(total / 100))} ₽</b></div></div>
      ${warn ? `<div class="imp-warn">${esc(warn).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="msub" style="margin-top:8px">Отменить запись можно только сторно. Продолжить?</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="ilNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="ilYes">${ICONS.check}Загрузить</button></div>`);
    $('ilNo').onclick = () => { closeModal(); resolve(false); };
    $('ilYes').onclick = () => { closeModal(); resolve(true); };
  });
}
async function doImportLoad() {
  if (importState.loading) return;                                 // повторный вход заблокирован (аудит H1)
  const incl = importState.rows.filter(r => r.include && importCanInclude(r));
  if (!incl.length) return;
  // сколько ЛИШНИХ строк на одного человека (в списке дважды/трижды → суммы сложатся)
  const cnt = new Map();
  for (const r of incl) cnt.set(r.chosenId, (cnt.get(r.chosenId) || 0) + 1);
  const extra = [...cnt.values()].reduce((s, c) => s + (c - 1), 0);
  const total = incl.reduce((s, r) => s + r.amount_kop, 0);
  const meta = IMPORT_KIND_META[importState.kind];
  const bigList = incl.filter(r => r.amount_kop > MONEY_BIG_KOP);
  const warns = [];
  // Текст был «суммы сложатся» — это НЕПРАВДА и опасная: import_money_batch
  // (migrations/046 §6) дедуплицирует по (человек, период, вид) и видит строки,
  // вставленные ранее в этой же партии. Значит ляжет ТОЛЬКО первая, остальные
  // уйдут в «пропущено (уже внесено)» — то есть отчёт назовёт потерю денег
  // успешным дедупом. Две отпускные за месяц одному человеку так и не попадут.
  if (extra) warns.push(`Один и тот же человек в списке несколько раз (${extra} ${extra === 1 ? 'лишняя строка' : 'лишних строк'}) — база запишет ТОЛЬКО ПЕРВУЮ, остальные пропустит как дубль. Если суммы разные и нужны обе — внесите вторую вручную в «Расчёте».`);
  const sibN = incl.filter(r => importState.sibling?.has(r.chosenId)).length;
  if (sibN) warns.push(`У ${sibN} чел. за этот месяц уже внесено «${IMPORT_KIND_META[importState.siblingKind].label}». Если это тот же документ — отпускные удвоятся, и сверка (Δ) этого НЕ покажет: обе графы в неё не входят.`);
  if (bigList.length) warns.push('Крупные суммы: ' + bigList.slice(0, 6).map(r => {
    const e = employees.find(x => x.id === r.chosenId); return `${e ? e.fio.split(' ')[0] : '?'} ${rub(r.amount_kop)} ₽`;
  }).join(', ') + (bigList.length > 6 ? '…' : '') + ' — проверьте, не опечатка ли.');
  if (!(await confirmImportLoad(meta.label, importState.period, incl.length, total, warns.join('\n')))) return;
  importState.loading = true;                                      // голое присвоение (не бросит); блокирует повторный вход
  try {
    renderImportPreview();                                         // блокируем кнопку/галочки — уже под try, чтобы флаг не залип
    // Предварительно снимаем уже внесённых (подсказка, чтобы меньше слать зря).
    // АТОМАРНЫЙ дедуп + защита от гонки двух клиентов теперь на СЕРВЕРЕ
    // (import_money_batch, миграция 034): вставка под advisory-lock, дубли
    // отбиваются там. Здесь гонки уже нет.
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
    // убираем обработанных (внесённых + пропущенных-дублей); проблемные остаются
    const doneIds = new Set([...(res.inserted || []), ...(res.skipped || [])].map(x => x.employee_id));
    importState.rows = importState.rows.filter(r => !(doneIds.has(r.chosenId) && r.include));
    importState.parsed = importState.rows.length > 0;
    importState.loading = false;
    await importLoadExisting();                                    // помечаем только что внесённых как «уже внесено»
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
    // line_type читаем и у СОХРАНЯЕМЫХ строк: без него проверка «основная одна»
    // ниже их не видела, и карточка с уже существующей основной + новым блоком
    // (он по умолчанию «Основной») проходила форму, а падала уже в базе —
    // ПОСЛЕ того, как отдельным запросом закрылись изменённые строки. Итог:
    // строка закрыта, замена не вставлена, повторное сохранение её добивало.
    if (keep) {
      const t = blk.querySelector('.lb-type button.on');
      out.push({ _keep: +keep, line_type: t && t.textContent.trim() === 'Основной' ? 'основной' : 'совместитель' });
      continue;
    }
    const line_type = blk.querySelector('.lb-type button.on').textContent.trim() === 'Основной' ? 'основной' : 'совместитель';
    const pay_kind = blk.querySelector('.lb-pay').value;
    const val = (sel, o) => { const el = blk.querySelector(sel); return el ? parseNum(el.value, o) : null; };
    const l = { line_type, pay_kind, amount: val('.lb-amount', { thousands: true, field: 'ставку', max: RATE_ABSURD }), amount_night: val('.lb-night', { thousands: true, field: 'ночную ставку', max: RATE_ABSURD }), percent: val('.lb-percent', { field: 'процент' }) };
    checkRate(l);                                     // тот же контроль, что на экране «Ставки»
    out.push(l);
  }
  if (!out.length) throw new Error('Нужна хотя бы одна строка начисления');
  // Считаем ВСЕ основные — и новые, и сохраняемые (см. выше). В базе это же
  // держит unique-индекс rate_line_one_active_primary, но он сработал бы уже
  // после частично применённых изменений.
  if (out.filter(l => l.line_type === 'основной').length > 1) throw new Error('Основная строка может быть только одна — лишние сделайте «Совместитель»');
  return out;
}
// Архив карточки. Архивный уходит из активного списка и из «Расчёта» (keys в
// v_month_total берут только status='active') — ему перестаёт что-либо начисляться.
// История сохраняется, смена статуса пишется в журнал. Для случайно занесённых
// старых людей: «В архив» → пропадают из расчёта; вернуть — из «Архив · N».
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
  const so = specialties.map(s => `<option value="${s.id}" ${e?.specialty_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  showModal(`<h3>${e ? 'Редактировать карточку' : 'Новая карточка'}</h3><div class="msub">${ICONS.lock} ФИО, телефон и ставки заводит владелец — изменения попадут в журнал</div>
    <label class="flbl">ФИО</label><input class="input" id="mFio" value="${esc(e?.fio || '')}" placeholder="Фамилия Имя Отчество">
    <div class="frow"><div><label class="flbl">Специальность</label><select class="input" id="mSpec">${so}</select></div>
    <div><label class="flbl">Должность</label><input class="input" id="mPos" value="${esc(e?.position === FIO_SENTINEL ? '' : (e?.position || ''))}" placeholder="напр. Заведующий"></div></div>
    <label class="flbl">Телефон (для СМС)</label><input class="input" id="mPhone" type="tel" inputmode="tel" value="${esc(fmtPhone(e?.phone) || '')}" placeholder="+7 921 554-12-31">
    <div class="frow"><div><label class="flbl">Принят</label><input class="input" id="mHired" type="date" value="${esc(e?.hired_on || '')}"></div>
    <div><label class="flbl">Уволен</label><input class="input" id="mLeft" type="date" value="${esc(e?.left_on || '')}"></div></div>
    <div class="msub" style="margin-top:-4px">Даты нужны, чтобы точно видеть неполный месяц. На расчёт оклада пока не влияют.</div>
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
      // Телефон проверяем ДО записи: иначе CHECK базы прилетает сырым английским
      // текстом в тост, который гаснет через 2.8 секунды.
      const phoneRaw = $('mPhone').value.trim(), phoneNorm = normPhone(phoneRaw);
      if (phoneRaw && !PHONE_OK.test(phoneNorm)) {
        $('mPhone').focus(); btn.disabled = false;
        toast('Телефон: нужен российский мобильный, например +7 921 554-12-31', true); return;
      }
      if (phoneRaw.replace(/[^0-9]/g, '').length === 10 && !(await confirmPhone(phoneNorm))) { btn.disabled = false; return; }
      const hired_on = $('mHired').value || null, left_on = $('mLeft').value || null;
      // Проверяем ДО записи, а не ловим сырой CHECK базы в тосте.
      if (hired_on && left_on && left_on < hired_on) {
        $('mLeft').focus(); btn.disabled = false;
        toast('Дата увольнения не может быть раньше даты приёма', true); return;
      }
      const patch = { fio, position: $('mPos').value.trim(), phone: phoneNorm || null, specialty_id: +$('mSpec').value || null, hired_on, left_on };
      const lines = collectLines(box);
      // Крупная ставка в карточке → тоже переспросить, не опечатка ли.
      const big = bigAmounts(lines);
      if (big.length && !(await confirmBigAmounts(big))) { btn.disabled = false; return; }
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
let curPeriod = null, scheduleRows = [], shiftKinds = [], schedSeq = 0;
/* ВРЕМЯ — ПО МОСКВЕ, а не по часам браузера.
   Милена живёт за границей — это вся посылка продукта. Расчёт в базе считает
   «сегодня» по МСК (msk_today), а здесь стояло голое new Date() = часовой пояс
   ЕЁ ноутбука. Значит каждый день есть окно шириной |смещение − 3ч|, когда
   график и ведомость показывают РАЗНЫЕ числа: у неё день ещё «план», а в базе
   уже «факт». Это ровно то раздвоение источника правды, от которого весь
   расчёт и вынесен в базу. Один хелпер на оба места. */
const mskNow = () => new Date(Date.now() + 3 * 3600e3);              // «сейчас» по Москве (UTC+3)
const nowPeriod = () => { const n = mskNow(); return n.getUTCFullYear() + '-' + String(n.getUTCMonth() + 1).padStart(2, '0'); };
// Русские падежи после числа: 1 приём / 2 приёма / 5 приёмов. Без этого экран
// говорил бы «2 приём», и владелец читал бы отчёт, спотыкаясь на каждой строке.
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
// 2026-07-05 → «05.07.26». Год НУЖЕН: навигация по месяцам достаёт любой год, и
// без него июль 2025 и июль 2026 в списке выглядят одинаково. Формат строгий —
// на неожиданном входе возвращаем как есть, а не режем строку вслепую.
const dm = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '')); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : String(d || ''); };
const periodLabel = p => { const [y, m] = p.split('-').map(Number); return MONTHS_RU[m] + ' ' + y; };
const daysInMonth = p => { const [y, m] = p.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const cellDate = day => curPeriod + '-' + String(day).padStart(2, '0');
const cellOf = (empId, day) => scheduleRows.find(s => s.employee_id === empId && s.work_date === cellDate(day));
// Гос. праздники РФ — ТОЛЬКО фиксированные по ТК РФ ст.112 (одни и те же каждый год),
// БЕЗ ежегодных переносов выходных. Причина двойная: переносы меняются постановлением
// каждый год (моё знание про конкретный год ненадёжно), и здесь пометки нужны ЛИШЬ для
// понимания — норма считается из графика, не из календаря (решение Дарины). Ключ MM-DD,
// поэтому список стабилен по годам и не требует обновления. На расчёт НЕ влияет.
const RF_HOLIDAYS = {
  '01-01': 'Новый год', '01-02': 'Новогодние каникулы', '01-03': 'Новогодние каникулы',
  '01-04': 'Новогодние каникулы', '01-05': 'Новогодние каникулы', '01-06': 'Новогодние каникулы',
  '01-07': 'Рождество Христово', '01-08': 'Новогодние каникулы',
  '02-23': 'День защитника Отечества', '03-08': 'Международный женский день',
  '05-01': 'Праздник Весны и Труда', '05-09': 'День Победы',
  '06-12': 'День России', '11-04': 'День народного единства',
};
// Метка дня для шапки графика: сб/вс (читаемость календаря) и/или гос. праздник (с названием).
function dayMark(day) {
  const [y, m] = curPeriod.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();   // 0=вс … 6=сб
  return { weekend: wd === 0 || wd === 6, hol: RF_HOLIDAYS[curPeriod.slice(5) + '-' + String(day).padStart(2, '0')] || '' };
}
/* У «Расчёта» СВОЙ период. Раньше он двигал общий curPeriod, не перерисовывая
   График: тот показывал июль с июльскими клетками, а клик писал в август —
   факты уходили не в тот месяц молча. */
let payPeriod = null;
function shiftPayMonth(delta) { let [y, m] = payPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } payPeriod = y + '-' + String(m).padStart(2, '0'); }
function shiftMonth(delta) { let [y, m] = curPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } curPeriod = y + '-' + String(m).padStart(2, '0'); renderSchedule(); }
const REST_KINDS = ['off', 'absent', 'отпуск'];   // нерабочие виды: НЕ в норму, НЕ «прогул», без оплаты смены
const isRest = k => REST_KINDS.includes(k);
function cellText(c) {
  if (!c || !c.plan_kind) return '';
  const k = shiftKinds.find(x => x.code === c.plan_kind), short = k ? (k.short || k.label) : c.plan_kind;
  if (isRest(c.plan_kind)) return short;
  const hh = t => t ? String(t).slice(0, 5).replace(/:00$/, '').replace(/^0(\d)/, '$1') : '';
  const s = hh(c.plan_start), e = hh(c.plan_end);
  if (s && e) return s + '–' + e;   // импортированный график: «9–17»
  return s || short;
}
// ── Табель (Вариант 2): план сверху серым + факт снизу цветом; прошлое=факт, будущее=план ──
const fmtH = n => (Math.round(n * 10) / 10) + 'ч';                 // 8 → «8ч», 7.5 → «7.5ч»
function planHoursOf(c) {                                           // плановые часы клетки (0 для выходного/пусто)
  if (!c || !c.plan_kind || isRest(c.plan_kind)) return 0;
  if (c.plan_start && c.plan_end) {
    const t = x => { const [h, m] = String(x).split(':').map(Number); return h + (m || 0) / 60; };
    let d = t(c.plan_end) - t(c.plan_start); if (d <= 0) d += 24; return d;   // через полночь
  }
  const k = shiftKinds.find(x => x.code === c.plan_kind); return k && k.hours ? +k.hours : 0;
}
function factHoursOf(c) {                                           // фактические часы (для прошедших дней)
  if (!c) return 0;
  const fx = c.fact ?? null;
  if (fx === 'x') return 0;                                         // не вышел
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx))) return parseFloat(fx);   // свои часы
  return planHoursOf(c);                                            // null = отработано по плану
}
function pastDay(day) {                                             // прошедший ли день (для факта)
  const np = nowPeriod();
  if (curPeriod < np) return true;
  if (curPeriod > np) return false;
  return day < mskNow().getUTCDate();                                // сегодня — ещё план; МСК, как msk_today() в базе
}
function factClass(c) {                                             // класс фона клетки по факту
  const p = c && c.plan_kind, fx = c ? (c.fact ?? null) : null;
  if (fx === 'x') return ' f-miss';
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx)))
    return Math.abs(parseFloat(fx) - planHoursOf(c)) > 0.05 ? ' f-dev' : ' f-ok';   // часы = плановым → «по плану», не расхождение
  return (p && !isRest(p)) ? ' f-ok' : ' f-rest';
}
function schedCellInner(c, past) {                                  // содержимое клетки: план (мини) + факт (цвет)
  const p = c && c.plan_kind, fx = c ? (c.fact ?? null) : null;
  if (!p && fx === null) return '';
  const planTxt = cellText(c);                                     // «9–17» / «В» / «С» / «—»
  if (!past) return `<span class="iv mini">${esc(planTxt)}</span>`;               // будущее — только план
  const isWork = p && !isRest(p);
  const chip = esc(p ? planTxt : 'вне гр.');                       // вышел без плана (в свой выходной)
  if (fx === 'x') return `<span class="iv mini">${chip}</span><span class="fh miss">—</span>`;
  if (fx !== null && fx !== '' && !isNaN(parseFloat(fx))) {
    const n = parseFloat(fx), dev = Math.abs(n - planHoursOf(c)) > 0.05;   // ровно плановые часы = «по плану» (зелёным), иначе отклонение (янтарь)
    return `<span class="iv mini">${chip}</span><span class="fh ${dev ? 'dev' : 'ok'}">${fmtH(n)}</span>`;
  }
  if (isWork) return `<span class="iv mini">${esc(planTxt)}</span><span class="fh ok">${fmtH(planHoursOf(c))}</span>`;
  return `<span class="iv mini faint">${esc(planTxt)}</span>`;      // выходной/отпуск по плану — просто план тускло
}
let closedDays = new Set();               // закрытые даты текущего месяца (лок табеля)
let redRemarks = [];                      // «красные замечания» владельцу: ретро-правки после закрытия
// renderSchedule — грузит данные месяца из сети, затем рисует. drawSchedule — только рисует
// из уже загруженных scheduleRows + текущих фильтров (мгновенно, без сети → без гонок/мерцания).
async function renderSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  if (!curPeriod) curPeriod = nowPeriod();
  const seq = ++schedSeq;                 // защита от гонки: быстрое переключение месяцев даёт несколько запросов
  try {
    const [rows, kinds, closed] = await Promise.all([store.listSchedule(curPeriod), store.listShiftKinds(), store.listClosedDays(curPeriod)]);
    if (seq !== schedSeq) return;         // ответ пришёл не для текущего запроса — отбрасываем (иначе чужой месяц перетрёт)
    scheduleRows = rows; shiftKinds = kinds; closedDays = new Set(closed);
    redRemarks = isOwner() ? await store.listRedRemarks().catch(e => { console.warn('listRedRemarks:', e); return []; }) : [];   // ретро-правки — видит только владелец
    if (seq !== schedSeq) return;
    drawSchedule();
  } catch (e) { toast('Не удалось загрузить график: ' + (e.message || e), true); }
}
function drawSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  if ($('mLabel')) $('mLabel').textContent = periodLabel(curPeriod);
  const nd = daysInMonth(curPeriod);
  const editable = canEditSchedule();     // оператор ведёт график (для tap по имени / шаблонов)
  const meRole = store.me()?.role;
  const isClosed = d => closedDays.has(cellDate(d));
  const anyEdit = ['operator', 'owner', 'ceo'].includes(meRole);   // есть ли право что-то править
  // СМС-подтверждение временно убрано (#70): закрытые дни владелец/Алёна/СЕО правят
  // НАПРЯМУЮ, каждая правка — в журнал (закрытие ещё показывается, но не блокирует).
  // Вернём ретро-по-СМС отдельной задачей. Пока — доверенные роли правят любой день.
  const canEditDay = d => ['owner', 'operator', 'ceo'].includes(meRole);
  const todayD = (nowPeriod() === curPeriod) ? mskNow().getUTCDate() : 0;
  const active = employees.filter(e => e.status !== 'archived');
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];

  // фильтры (селекты заполняет fillCatSelects при загрузке данных — здесь только читаем)
  const f = ($('schedSearch')?.value || '').toLowerCase().trim();
  const catF = $('schedCat')?.dataset.value || '';

  // режим: оператор правит, владелец смотрит
  if ($('schedSub')) $('schedSub').textContent = editable ? 'Прошедшие дни — клик по клетке отмечает факт (часы / не вышел). Будущие — задать смену. Клик по имени — шаблон на месяц.' : 'Просмотр: план (серым) и факт (цветом). Расхождения факта с планом — справа и в шапке.';
  if ($('schedNote')) {
    const rb = (isOwner() && redRemarks.length)   // красный баннер: ретро-правки после закрытия (кто/когда/было→стало)
      ? `<div class="red-banner"><div class="rb-head">${ICONS.lock}<b>Правки после закрытия: ${redRemarks.length}</b></div>${redRemarks.slice(0, 8).map(j => `<div class="rb-row"><span class="rb-what">${esc(j.field || 'ретро-правка')}</span><span class="rb-val">${esc(String(j.old_value ?? '—'))} → ${esc(String(j.new_value ?? '—'))}</span><span class="rb-who">${esc(j.actor || '?')} · ${esc(String(j.at).slice(0, 16).replace('T', ' '))}</span></div>`).join('')}</div>`
      : '';
    $('schedNote').innerHTML = rb + (editable ? '' : `<div class="readonly-note">${ICONS.lock} График ведёт оператор (Алёна). У вас — просмотр; закрытые дни можно править напрямую.</div>`);
  }

  // покрытие месяца: считаем только РАБОЧИЕ смены (Выходной/Не вышел — не смена)
  const worked = s => s.plan_kind && !isRest(s.plan_kind);
  const withShift = new Set(scheduleRows.filter(worked).map(s => s.employee_id));
  const shifts = scheduleRows.filter(worked).length;
  // расхождения факта с планом (анти-фрод сигнал владельцу): 'x' на рабочий день / часы ≠ плановых / выход без плана
  const isDev = s => { const fx = s.fact ?? null; if (fx === null) return false; if (fx === 'x') return planHoursOf(s) > 0; const n = parseFloat(fx); return !isNaN(n) && Math.abs(n - planHoursOf(s)) > 0.05; };   // порог как в factClass/schedCellInner
  const devs = scheduleRows.filter(isDev).length;
  if ($('schedStat')) {
    const pct = active.length ? Math.round(withShift.size / active.length * 100) : 0;
    $('schedStat').innerHTML = `<span class="fs-count"><b>${withShift.size}</b> из <b>${active.length}</b> с графиком</span><span class="cov-bar" title="${pct}% заполнено"><span class="cov-fill" style="width:${pct}%"></span></span><span class="gap-chips"><span class="mini-chip">${shifts} смен</span>${devs ? `<span class="mini-chip chip-dev" title="факт отличается от плана">⚠ расхождений: ${devs}</span>` : ''}</span>`;
  }

  // индекс клетки для O(1) (иначе find по всем строкам на каждую из ~3700 клеток)
  const byKey = new Map(scheduleRows.map(s => [s.employee_id + '|' + s.work_date, s]));
  const cget = (id, d) => byKey.get(id + '|' + cellDate(d)) || null;

  let head = '<div class="gr-corner">Сотрудник</div>';
  for (let d = 1; d <= nd; d++) {
    const { weekend, hol } = dayMark(d);
    // праздник важнее выходного (свой цвет и точка); today/dlock перебивают фон позже по CSS
    const mk = hol ? ' gr-hol' : (weekend ? ' gr-wknd' : '');
    const hint = isClosed(d) ? 'День закрыт — клик' : (anyEdit ? 'Закрыть день' : '');
    const title = hol ? (hint ? hol + ' · ' + hint : hol) : hint;   // название праздника — в подсказке
    head += `<div class="gr-day${d === todayD ? ' today' : ''}${isClosed(d) ? ' dlock' : ''}${mk}${anyEdit ? ' tapday' : ''}" data-day="${d}" title="${esc(title)}">${d}${hol ? '<i class="holdot"></i>' : ''}${isClosed(d) ? `<i class="dlockmark">${ICONS.lock}</i>` : ''}</div>`;
  }
  head += '<div class="gr-day sum">Смен</div><div class="gr-day sum">План</div><div class="gr-day sum">Факт</div><div class="gr-day sum" title="факт − план за прошедшие дни">Δ</div>';
  let rows = '', shown = 0;
  for (const cat of cats) {
    if (catF && cat !== catF) continue;
    const list = active.filter(e => specCat(e.specialty_id) === cat && String(e.fio || "").toLowerCase().includes(f));
    if (!list.length) continue;
    rows += `<div class="gr-group"><span><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${list.length}</span></div>`;
    for (const e of list) {
      shown++;
      rows += `<div class="gr-name${editable ? ' tap' : ''}" data-emp="${e.id}" title="${editable ? 'Шаблон на месяц: ' : ''}${esc(e.fio)}" style="box-shadow:inset 3px 0 0 ${catColor(cat)}">${esc(e.fio)}</div>`;
      let planM = 0, planPast = 0, factPast = 0, cnt = 0;
      for (let d = 1; d <= nd; d++) {
        const c = cget(e.id, d), pst = pastDay(d);
        const empty = !(c && (c.plan_kind || (c.fact ?? null) !== null));
        planM += planHoursOf(c);
        if (pst) { planPast += planHoursOf(c); const fh = factHoursOf(c); factPast += fh; if (fh > 0) cnt++; }
        const bg = pst ? (empty ? '' : factClass(c)) : (empty ? '' : ' fut');
        const addable = empty && canEditDay(d) && (pst || d === todayD);   // пустая клетка прошлого/сегодня, куда можно ДОБАВИТЬ смену (замена) — подсказка «+»
        rows += `<div class="gr-cell sc2${bg}${c && c.plan_kind === 'отпуск' ? ' k-vac' : ''}${addable ? ' addable' : ''}${isClosed(d) ? ' dclosed' : ''}${d === todayD ? ' today' : ''}${canEditDay(d) ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}">${schedCellInner(c, pst)}</div>`;
      }
      const delta = factPast - planPast, ds = Math.abs(delta) < 0.05 ? '0' : (delta > 0 ? '+' : '−') + fmtH(Math.abs(delta));
      rows += `<div class="gr-sum">${cnt}</div><div class="gr-sum">${fmtH(planM)}</div><div class="gr-sum s-fact">${fmtH(factPast)}</div><div class="gr-sum s-delta ${delta < -0.05 ? 'neg' : delta > 0.05 ? 'pos' : ''}">${ds}</div>`;
    }
  }
  const grid = $('scheduleGrid');
  grid.style.gridTemplateColumns = `150px repeat(${nd}, minmax(44px, 1fr)) repeat(4, minmax(46px, auto))`;
  grid.innerHTML = shown ? head + rows : `<div class="empty" style="padding:40px">${active.length ? 'Никого не найдено' : 'Нет сотрудников'}</div>`;
  if (anyEdit) {
    grid.querySelectorAll('.gr-cell').forEach(cell => cell.onclick = () => {
      const emp = +cell.dataset.emp, d = +cell.dataset.day;
      if (!canEditDay(d)) return;                 // #70: СМС убрана — закрытые дни правят напрямую (в журнал)
      pastDay(d) ? scheduleFactPopup(emp, d) : scheduleCellPopup(emp, d);   // прошлое → факт, будущее → план
    });
    grid.querySelectorAll('.gr-day.tapday').forEach(h => h.onclick = () => scheduleDayDialog(+h.dataset.day));
  }
  if (editable) grid.querySelectorAll('.gr-name.tap').forEach(n => n.onclick = () => scheduleTemplateDialog(+n.dataset.emp));
}
// Закрытие/открытие дня табеля. Закрытый день лочит клетки от оператора (правит владелец / Алёна по СМС в 5б).
function scheduleDayDialog(day) {
  const date = cellDate(day), closed = closedDays.has(date), meRole = store.me()?.role;
  const label = day + ' ' + periodLabel(curPeriod);
  if (!closed) {
    showModal(`<h3>Закрыть день ${esc(label)}?</h3>
      <div class="msub">После закрытия клетки этого дня блокируются от правок. Изменить закрытый день сможет владелец напрямую (а Алёна — по СМС-подтверждению, этап 5б). Всё пишется в журнал.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Отмена</button><button class="btn btn-primary btn-sm" id="dClose">${ICONS.lock}Закрыть день</button></div>`);
    $('dClose').onclick = async () => { const b = $('dClose'); if (b.disabled) return; b.disabled = true; try { await store.closeDay(date); closeModal(); await renderSchedule(); toast(ICONS.check + 'День ' + day + ' закрыт'); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    $('dCancel').onclick = closeModal;
  } else {
    showModal(`<h3>${ICONS.lock} День ${esc(label)} закрыт</h3>
      <div class="msub">Клетки заблокированы от правок. ${meRole === 'owner' ? 'Как владелец — вы можете открыть день или править клетки напрямую (запишется в журнал).' : 'Исправить может владелец, либо вы по СМС-подтверждению (этап 5б) — с уведомлением владельца.'}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Закрыть</button>${meRole === 'owner' ? `<button class="btn btn-primary btn-sm" id="dOpen">Открыть день</button>` : ''}</div>`);
    if ($('dOpen')) $('dOpen').onclick = async () => { const b = $('dOpen'); if (b.disabled) return; b.disabled = true; try { await store.reopenDay(date); closeModal(); await renderSchedule(); toast('День ' + day + ' открыт'); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    $('dCancel').onclick = closeModal;
  }
}
function scheduleCellPopup(empId, day) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day);
  const opts = shiftKinds.filter(k => k.code !== 'custom').map(k => `<option value="${k.code}" ${c && c.plan_kind === k.code ? 'selected' : ''}>${esc(k.label)}</option>`).join('');   // custom без конца смены = 0ч → исключаем (как в шаблоне)
  showModal(`<h3>${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3><div class="msub">${day} ${esc(periodLabel(curPeriod))} · смена = тип + время начала</div>
    <label class="flbl">Тип смены</label><select class="input" id="scKind"><option value="">— пусто —</option>${opts}</select>
    <label class="flbl">Время начала</label><input class="input" id="scStart" type="time" value="${c && c.plan_start ? esc(String(c.plan_start).slice(0, 5)) : ''}">
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="scVac">Отпуск…</button><button class="btn btn-ghost btn-sm" id="scClear">Очистить</button><button class="btn btn-primary btn-sm" id="scSave">${ICONS.check}Сохранить</button></div>`);
  $('scVac').onclick = () => vacationDialog(empId, day);
  $('scSave').onclick = async () => {
    const btn = $('scSave'); if (btn.disabled) return; btn.disabled = true;
    const kind = $('scKind').value || null;   // время без типа смены не сохраняем (иначе невидимая строка-пустышка)
    try { await store.setScheduleCell(empId, date, { plan_kind: kind, plan_start: kind ? ($('scStart').value || null) : null, plan_end: null, fact: null }); closeModal(); await renderSchedule(); toast(ICONS.check + 'Сохранено'); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('scClear').onclick = async () => {
    try { await store.setScheduleCell(empId, date, { plan_kind: null, plan_start: null, plan_end: null, fact: null }); closeModal(); await renderSchedule(); toast('Очищено'); }
    catch (err) { toast(err.message || err, true); }
  };
}
// Отпуск диапазоном «с…по…»: все дни периода → 'отпуск'. plan_start/plan_end/fact ОЧИЩАЕМ — иначе день с
// остатком времени смены посчитается отработанным и оплатится. Отпуск = уважительная: не в норму, не «прогул»,
// зарплата за эти дни не идёт (отпускные вносятся отдельной суммой). Каждый день пишется в журнал.
function vacationDialog(empId, startDay) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const startDate = cellDate(startDay);
  showModal(`<h3>Отпуск · ${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3>
    <div class="msub">с <b>${esc(startDate)}</b> по какое число (включительно)</div>
    <label class="flbl">По дату</label>
    <input class="input" id="vacEnd" type="date" value="${esc(startDate)}" min="${esc(startDate)}">
    <div class="msub" style="margin-top:8px">Все дни периода станут «Отпуск». Зарплата за них не начисляется — отпускные вносятся отдельной суммой. Правка — в журнал.</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="vacCancel">Отмена</button><button class="btn btn-primary btn-sm" id="vacSave">${ICONS.check}Отметить отпуск</button></div>`);
  $('vacCancel').onclick = closeModal;
  $('vacSave').onclick = async () => {
    const btn = $('vacSave'); if (btn.disabled) return;
    const end = $('vacEnd').value;
    if (!end || end < startDate) return toast('Дата «по» раньше начала', true);
    const days = [];
    for (let dt = new Date(startDate + 'T00:00:00Z'); ; dt.setUTCDate(dt.getUTCDate() + 1)) {
      const iso = dt.toISOString().slice(0, 10);
      days.push(iso);
      if (iso === end) break;
      if (days.length > 90) return toast('Слишком длинный период (макс 90 дней)', true);
    }
    btn.disabled = true;
    try {
      for (const d of days) await store.setScheduleCell(empId, d, { plan_kind: 'отпуск', plan_start: null, plan_end: null, fact: null });
      closeModal(); await renderSchedule(); toast(ICONS.check + `Отпуск отмечен · ${days.length} дн`);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
// Табель: отметка факта за прошедший день. Вышел по плану = сброс (null); прочерк = 'x'; свои часы = число.
// Если планового выхода НЕТ (пусто/выходной/не вышел), а человек ВЫШЕЛ на замену — Алёна добавляет смену:
// выбирает ТИП (сутки/12ч/оклад/…) → оплата по его ставке за этот тип; либо вписывает часы (почасово).
function scheduleFactPopup(empId, day) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day);
  const p = c && c.plan_kind, isWork = p && !isRest(p);
  const cur = c ? (c.fact ?? null) : null;
  const planLine = p ? `план: <b>${esc(cellText(c))}</b>${isWork ? ' · ' + fmtH(planHoursOf(c)) : ''}` : 'плана нет';
  const now = cur === 'x' ? 'не вышел' : (cur != null && cur !== '' ? fmtH(parseFloat(cur)) : (isWork ? 'по плану' : '—'));
  const hVal = (cur != null && cur !== '' && cur !== 'x') ? esc(String(cur)) : '';
  const workKinds = shiftKinds.filter(k => !isRest(k.code) && k.code !== 'custom');   // смены-замены: только рабочие типы
  const kindOpts = workKinds.map(k => `<option value="${k.code}">${esc(k.label)}</option>`).join('');
  showModal(`<h3>${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3>
    <div class="msub">${day} ${esc(periodLabel(curPeriod))} · факт · ${planLine}</div>
    <div class="fact-opts">
      ${isWork ? `<button class="btn btn-ghost fact-btn" data-f="plan">${ICONS.check}Вышел по плану · ${fmtH(planHoursOf(c))}</button>` : ''}
      ${isWork ? `<button class="btn btn-ghost fact-btn fact-miss" data-f="x">— Не вышел</button>` : ''}
      ${!isWork ? `<label class="flbl">Вышел на замену — добавить смену</label>
      <div class="frow" style="align-items:flex-end">
        <div style="flex:1"><select class="input" id="fKind"><option value="">— тип смены —</option>${kindOpts}</select></div>
        <input class="input" id="fKindStart" type="time" style="max-width:116px" title="время начала (необязательно)">
        <button class="btn btn-primary btn-sm" id="fKindSave">${ICONS.check}Смена</button>
      </div>
      <div class="msub" style="margin:-2px 0 8px">Заменяющий отработал смену → оплата по его ставке за этот тип. Или впишите часы (почасово):</div>` : ''}
      <div class="frow" style="align-items:flex-end">
        <div style="flex:1"><label class="flbl">Свои часы${isWork ? '' : ' (почасово)'}</label>
          <input class="input" id="fH" type="number" min="0" max="24" step="0.5" placeholder="напр. 6" value="${hVal}"></div>
        <button class="btn btn-primary btn-sm" id="fSave">${ICONS.check}ОК</button>
      </div>
    </div>
    <div class="modal-foot"><span class="msub">сейчас: <b>${now}</b></span><button class="btn btn-ghost btn-sm" id="fVac">Отпуск…</button><button class="btn btn-ghost btn-sm" id="fClear">Сбросить</button></div>`);
  $('fVac').onclick = () => vacationDialog(empId, day);
  const apply = async fact => {
    try { await store.setScheduleFact(empId, date, fact); closeModal(); await renderSchedule(); toast(ICONS.check + 'Факт отмечен'); }
    catch (err) { toast(err.message || err, true); }
  };
  $('modalBox').querySelectorAll('.fact-btn').forEach(b => b.onclick = () => apply(b.dataset.f === 'plan' ? null : b.dataset.f));
  $('fSave').onclick = () => { let v = parseFloat($('fH').value); if (isNaN(v) || v < 0 || v > 24) return toast('Часы 0–24', true); v = Math.round(v * 2) / 2; apply(String(v)); };   // до получаса (шаг поля 0.5) → проходит CHECK
  const kb = $('fKindSave');   // замена: добавить типовую смену (plan_kind + факт=по плану) → считается отработанной, платится по ставке типа
  if (kb) kb.onclick = async () => {
    const kind = $('fKind').value; if (!kind) return toast('Выберите тип смены', true);
    if (kb.disabled) return; kb.disabled = true;
    try { await store.setScheduleCell(empId, date, { plan_kind: kind, plan_start: $('fKindStart').value || null, plan_end: null, fact: null }); closeModal(); await renderSchedule(); toast(ICONS.check + 'Смена добавлена'); }
    catch (err) { kb.disabled = false; toast(err.message || err, true); }
  };
  $('fClear').onclick = () => apply(null);
}

// Ретро-правка закрытого дня (оператор): выбрать новый факт → код по СМС → подтвердить. Уходит владельцу в «красные замечания».
function scheduleRetroDialog(empId, day) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day);
  const p = c && c.plan_kind, isWork = p && !isRest(p);
  showModal(`<h3>${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3>
    <div class="msub">${day} ${esc(periodLabel(curPeriod))} · день закрыт</div>
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
  $('rCancel').onclick = () => closeModal();
  $('rConf').onclick = async () => {
    const btn = $('rConf'); if (btn.disabled) return; btn.disabled = true;
    try {
      const st = await store.confirmRetroEdit(requestId, $('rCode').value.trim());
      if (st === 'ok') { closeModal(); await renderSchedule(); toast(ICONS.check + 'Исправлено · владелец уведомлён'); }
      else { btn.disabled = false; toast(RUS[st] || st, true); }
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

// Шаблоны графика: заполнить весь месяц по паттерну одним кликом (клик по имени сотрудника).
// work=true → рабочая смена (выбранный тип+время), work=false → Выходной. Циклы считаются от «дня отсчёта».
function templateDays(pattern, period, anchor) {
  const nd = daysInMonth(period), [y, m] = period.split('-').map(Number);
  const cycles = { '2/2': [1, 1, 0, 0], '3/3': [1, 1, 1, 0, 0, 0], 'sutki3': [1, 0, 0, 0] };
  const out = [];
  for (let d = 1; d <= nd; d++) {
    let work;
    if (pattern === '5/2') { const wd = new Date(y, m - 1, d).getDay(); work = wd >= 1 && wd <= 5; }   // Пн–Пт
    else if (pattern === 'every') work = true;
    else { const cyc = cycles[pattern] || [1]; work = cyc[((d - anchor) % cyc.length + cyc.length) % cyc.length] === 1; }
    out.push({ day: d, work });
  }
  return out;
}
function scheduleTemplateDialog(empId) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const nd = daysInMonth(curPeriod);
  const kinds = shiftKinds.filter(k => !isRest(k.code) && k.code !== 'custom');
  const kopts = kinds.map(k => `<option value="${k.code}"${k.code === 'day' ? ' selected' : ''}>${esc(k.label)}</option>`).join('');
  const pats = [['5/2', '5/2 — Пн-Пт работа, Сб-Вс выходные'], ['2/2', '2/2 — два через два'], ['3/3', '3/3 — три через три'], ['sutki3', 'Сутки/3 — сутки, потом 3 выходных'], ['every', 'Каждый день одинаково']];
  showModal(`<h3>${esc(e.fio.split(' ').slice(0, 2).join(' '))}</h3>
    <div class="msub">Заполнить весь ${esc(periodLabel(curPeriod))} по шаблону · потом можно поправить руками</div>
    <label class="flbl">Шаблон</label><select class="input" id="tpPat">${pats.map(p => `<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select>
    <div class="frow"><div><label class="flbl">Тип смены</label><select class="input" id="tpKind">${kopts}</select></div>
      <div><label class="flbl">Время начала</label><input class="input" id="tpStart" type="time" value="08:00"></div></div>
    <label class="flbl">С какого дня начать <span style="color:var(--ink-3)">(для 2/2, 3/3, сутки)</span></label>
    <input class="input" id="tpAnchor" type="number" min="1" max="${nd}" value="1">
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="tpClear">Очистить месяц</button><button class="btn btn-primary btn-sm" id="tpFill">${ICONS.check}Заполнить</button></div>`);
  $('tpFill').onclick = async () => {
    const btn = $('tpFill'); if (btn.disabled) return; btn.disabled = true;
    const pat = $('tpPat').value, kind = $('tpKind').value, start = $('tpStart').value || null;
    const anchor = Math.min(nd, Math.max(1, +$('tpAnchor').value || 1));
    const cells = templateDays(pat, curPeriod, anchor).map(x => ({
      employee_id: empId, work_date: cellDate(x.day),
      plan_kind: x.work ? kind : 'off', plan_start: x.work ? start : null,
    })).filter(c => !closedDays.has(c.work_date));   // закрытые дни шаблоном не трогаем
    try { await store.setScheduleBulk(cells); closeModal(); await renderSchedule(); toast(ICONS.check + 'Заполнено по шаблону'); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('tpClear').onclick = async () => {
    const btn = $('tpClear'); if (btn.disabled) return; btn.disabled = true;
    try { await store.clearScheduleMonth(empId, curPeriod); closeModal(); await renderSchedule(); toast('Месяц очищен'); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
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
  if (kind === 'процент') line.percent = val('.rt-a', { field: 'процент' });
  else {
    line.amount = val('.rt-a', { thousands: true, field: 'сумму', max: RATE_ABSURD });
    if (kind === '12ч') line.amount_night = val('.rt-b', { thousands: true, field: 'ночную ставку', max: RATE_ABSURD });
  }
  return checkRate(line);                             // тот же контроль, что в карточке
}
/* Смена ставки: с какого числа действует новая.
   «По-разному бывает» — поэтому дату выбирает владелец, а не мы за неё. Расчёт
   спрашивает ставку ПО КАЖДОМУ ДНЮ, поэтому любая дата считается сама: отдельной
   механики «делить месяц» не нужно, дата и ЕСТЬ ответ на «как считать».
   Первое заведение ставки диалога не показывает: там нечего решать — владелец не
   заключает договор, а записывает то, что человек уже получает (с 1-го числа). */
const RU_MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const monthStartMSK = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 8) + '01';
function ratePreviewText(d) {
  const [y, m, day] = String(d).split('-').map(Number);
  if (!y || !m || !day) return '';
  const mn = `${RU_MONTHS[m - 1]} ${y}`;
  return day === 1
    ? `Весь <b>${mn}</b> — по новой ставке.`
    : `<b>${mn}</b> поделится: 1–${day - 1} числа по старой ставке, ${day}-е и дальше — по новой.`;
}
function rateChangeDialog(emp, oldLine, newLine) {
  return new Promise(resolve => {
    const def = monthStartMSK();
    // ВИД оплаты меняется — это не «поправить сумму», а замена способа начисления:
    // старая строка перестаёт действовать целиком. Особенно больно с процентом:
    // добавляя врачу-процентнику сменную ставку через этот экран, владелец
    // закрывал бы его процент, и зарплата падала с 3 000 до 0 — а в журнале
    // значилось бы рутинное «ставка закрыта». Пишем последствие словами.
    // (Сменная ставка ВДОБАВОК к проценту — это «Совместитель» в карточке.)
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
      <input class="input" type="date" id="rcFrom" value="${def}">
      <div class="msub" id="rcPrev" style="margin-top:8px">${ratePreviewText(def)}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="rcNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="rcYes">${ICONS.check}Применить</button></div>`);
    $('modalBox').dataset.guard = '1';                       // деньги/ставки — не закрывать случайным кликом
    const inp = $('rcFrom');
    inp.oninput = () => { $('rcPrev').innerHTML = ratePreviewText(inp.value); };
    $('rcNo').onclick = () => { closeModal(); resolve(null); };
    $('rcYes').onclick = () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) { toast('Укажите дату', true); return; }
      closeModal(); resolve(inp.value);
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
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  let html = '';
  for (const cat of cats) {
    let list = active.filter(e => specCat(e.specialty_id) === cat && String(e.fio || "").toLowerCase().includes(f));
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
        // Крупная сумма → переспросить, не опечатка ли (а не запрещать).
        if (line._needsConfirm && !(await confirmBigAmounts(bigAmounts([line])))) { btn.disabled = false; return; }
        // Сохраняем незавершённый ввод в ДРУГИХ строках, чтобы refresh их не стёр.
        const drafts = {};
        $('ratesList').querySelectorAll('.rate-row').forEach(r => {
          if (+r.dataset.id === +row.dataset.id) return;
          const a = r.querySelector('.rt-a'), b = r.querySelector('.rt-b'), k = r.querySelector('.rt-kind');
          if ((a && a.value) || (b && b.value)) drafts[r.dataset.id] = { kind: k.value, a: a ? a.value : '', b: b ? b.value : '' };
        });
        // Ставка уже была и меняется → спрашиваем дату. Заводится впервые → молча с 1-го числа.
        const emp = employees.find(x => x.id === +row.dataset.id);
        const old = emp && primaryLine(emp);
        let vfrom;
        if (old && !sameRate(old, line)) {
          // rtCollect не заполняет line_type (его проставляет setPrimaryRate) — но
          // диалог показывает строку через lineLabel, и без типа он печатал «undefined».
          vfrom = await rateChangeDialog(emp, old, { ...line, line_type: 'основной' });
          if (vfrom === null) { btn.disabled = false; return; }   // отмена — ничего не трогаем
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

/* ── журнал ── */
const J_ENTITY = { employee: 'Карточка', rate_line: 'Ставка', specialty: 'Специальность', app_user: 'Пользователь',
  // без этих подписей владелец видел сырое «money_line · cash: 5000.00» вместо человеческой строки
  money_line: 'Деньги', patient_payment: 'Оплата пациента', calc_rule: 'Правило расчёта',
  schedule: 'График', closed_day: 'День', day: 'День', import_batch: 'Импорт' };
const J_FIELD = { fio: 'ФИО', position: 'должность', phone: 'телефон', status: 'статус', specialty: 'специальность', specialty_id: 'специальность', 'новая строка': 'новая строка', 'закрыта': 'строка закрыта', 'ставка добавлена': 'ставка добавлена', 'ставка закрыта': 'ставка закрыта' };
// Действия, которые надо ПОКАЗАТЬ, а не проглотить: раньше j.action только
// сравнивался с 'created' и никогда не выводился — то есть «сторно», единственное
// слово, отличающее исправление от обычной выплаты, терялось по дороге, и
// владелец видел три независимых числа вместо «было → стало».
const J_ACTION = { 'сторно': 'СТОРНО', 'правило расчёта': 'ПРАВИЛО РАСЧЁТА' };
/* ── Расчёт (деньги) ────────────────────────────────────────────────────
   СМЕШАННАЯ строка (решение Дарины): слева — по строкам начисления, чтобы было
   видно, ИЗ ЧЕГО сложилась сумма; справа — одно на человека через rowspan,
   потому что аванс/наличка/премия — это деньги за месяц, а не за строку.
   Все цифры приходят готовыми из v_month_total (migrations/019) — браузер
   ничего денежного не считает. */
// Порядок = как человек думает: сначала наличные (их выдаёт касса), потом карта.
// Отпускные и «расчёт» разведены по способу выплаты (migrations/046): деньги на
// карте у человека УЖЕ есть, наличные ему ещё предстоит выдать — это разные
// строки в жизни, а не оттенок одной.
// «Отпускные начислено» стоит последним и подписан «не выплата» НАМЕРЕННО: это
// единственный вид в списке, который денег никому не двигает, и перепутать его
// с выплатой — значит записать человеку выданное, чего не выдавали.
const MONEY_KINDS = [
  ['cash', 'Наличные'], ['cash_avans', 'Аванс наличными'], ['otpusk_cash', 'Отпускные наличными'],
  ['premia', 'Премия'],
  ['card_avans', 'Аванс на карту'], ['card_rasch', 'ЗП на карту'],
  ['otpusk', 'Отпускные на карту'], ['card_uvol', 'Расчёт на карту (увольнение)'],
  ['otpusk_nach', 'Отпускные начислено (не выплата)'],
];
const moneyKindLabel = k => (MONEY_KINDS.find(x => x[0] === k) || [k, k])[1];
// Показываем только то, что роль реально может записать: политика ml_ins
// запрещает оператору премию — кто считает, тот не премирует. Раньше список
// предлагал все шесть, и Алёна упиралась в отказ базы после ввода.
// С migrations/022 §1 премия — ТОЛЬКО владелец: премия поднимает «к выдаче»
// и не входит в Δ, поэтому у бухгалтера это был единственный рычаг на сумму,
// которую она сама же и выдаёт (себе в том числе).
// СЕО (035) вправе вносить всё, включая премию, — раньше он проваливался в
// `return []` и получал ПУСТОЙ список видов при видимой форме «Внести деньги».
function moneyKindsFor(role) {
  if (role === 'owner' || role === 'ceo') return MONEY_KINDS;
  if (role === 'operator') return MONEY_KINDS.filter(k => k[0] !== 'premia');
  return [];
}
const rub = kop => fmt(Math.round((kop || 0) / 100));
// сколько денег уже расписано по выплатам — до этого дельта равна всей зарплате
// и подсвечивать её бессмысленно (горела бы у всех весь месяц)
const recorded = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0) + (r.card_uvol_kop || 0) + (r.cash_kop || 0) + (r.cash_avans_kop || 0);
// Всё официальное на карту одной суммой — ровно то, что вычитает delta_kop
// (аванс + ЗП + расчёт при увольнении). Отпускных на карту здесь НЕТ намеренно:
// Δ их не вычитает, и чип на карточке человека обязан сходиться с «Осталось
// выдать». Разбивка по видам — в «Расчёте» (графы) и в окне человека.
const cardTotal = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0) + (r.card_uvol_kop || 0);
let payrollRows = [], payrollLines = [], payrollSeq = 0, payrollShown = null;

async function renderPayroll(filter = '') {
  if (!isStaff()) { $('payrollTable').innerHTML = ''; return; }
  if (!payPeriod) payPeriod = nowPeriod();
  $('pLabel').textContent = periodLabel(payPeriod);
  const seq = ++payrollSeq;
  // Гасим таблицу только при ПЕРВОЙ загрузке месяца. Иначе после каждого
  // сохранения страница схлопывалась, браузер обнулял скролл — и Алёна на
  // 119 людях каждый раз возвращалась в начало списка.
  const wrap = document.querySelector('#s-payroll .gridwrap');
  const keepTop = wrap ? wrap.scrollTop : 0, keepLeft = wrap ? wrap.scrollLeft : 0;
  // Гасим при СМЕНЕ месяца (иначе под новой подписью почти секунду висят старые
  // деньги), но НЕ при обновлении после ввода — там гашение сбрасывало скролл.
  const sameMonth = payrollShown === payPeriod;
  if (!sameMonth) $('payrollTable').innerHTML = '<div class="empty">Загружаем расчёт…</div>';
  payrollShown = payPeriod;
  let rows, lines;
  try { [rows, lines] = await Promise.all([store.listPayroll(payPeriod), store.listPayrollLines(payPeriod)]); }
  catch (e) { if (seq === payrollSeq) $('payrollTable').innerHTML = `<div class="empty">Не удалось загрузить: ${esc(e.message || e)}</div>`; return; }
  if (seq !== payrollSeq) return;                       // пришёл ответ от старого месяца — игнорируем
  payrollRows = rows; payrollLines = lines;
  drawPayroll(filter);
  if (wrap) { wrap.scrollTop = keepTop; wrap.scrollLeft = keepLeft; }
}

/* Строки начисления для показа. Складываем из ДВУХ источников, потому что
   v_day_money по дням даёт деньги только для СМЕННЫХ видов: оклад считается
   помесячно (oklad_worked_sum/oklad_planned_days), а процент — от оплат
   пациентов, и в дневных строках его нет вовсе. Раньше я суммировал только дни:
   «Оклад · 20 · 17 · 0 ₽» рядом с «Зарплата 68 000», а процентник вообще
   получал «нет начислений за месяц». Дни дают КОЛИЧЕСТВА, месяц — ДЕНЬГИ. */
function linesFor(r) {
  const raw = payrollLines.filter(l => l.employee_id === r.employee_id);
  const out = raw.map(l => l.kind === 'оклад' ? { ...l, money_kop: r.oklad_kop } : l);   // оклад — помесячно
  if (r.percent_kop || r.pct_rate != null)
    out.push({ kind: 'процент', planned: null, worked: null, money_kop: r.percent_kop, isPct: true });
  return out;
}

function drawPayroll(filter = '') {
  const f = (filter || '').toLowerCase();
  const cat = $('payrollCat')?.dataset.value || '';
  const rows = payrollRows.filter(r => (r.fio || '').toLowerCase().includes(f)
    && (!cat || specCat(employees.find(e => e.id === r.employee_id)?.specialty_id) === cat));
  if (!rows.length) { $('payrollTable').innerHTML = `<div class="empty">${payrollRows.length ? 'Никого не найдено' : 'За ' + esc(periodLabel(payPeriod)) + ' данных нет'}</div>`; renderPayrollStat([]); return; }

  // Каждый вид выплаты — своя графа (решение Дарины 31.07). Раньше «Карта» была
  // одним числом на аванс+ЗП+расчёт, и по ведомости нельзя было понять, ЧТО
  // именно человеку перечислили. Порядок сохранён прежний: наличный аванс →
  // карта → наличка → отпускные → премия → остаток.
  // «Отпуск. начисл.» — НЕ выплата, а начисление: справочно, ни в одну сумму
  // не входит (migrations/046).
  const head = `<thead><tr>
    <th class="pw-name">Сотрудник</th><th>Начисление</th><th class="num">Норма</th><th class="num">Факт</th><th class="num">Сумма</th>
    <th class="num sep">Зарплата</th><th class="num">Аванс нал.</th><th class="num">Аванс на карту</th><th class="num">ЗП на карту</th><th class="num">Расчёт на карту</th><th class="num">Наличка</th>
    <th class="num">Отпуск. начисл.</th><th class="num">Отпуск. карта</th><th class="num">Отпуск. нал.</th><th class="num">Премия</th><th class="num pw-pay">Осталось выдать</th></tr></thead>`;

  // Разбивка по специальностям (как в графике): сортируем по категории,
  // перед каждой группой — строка-заголовок с подытогом «осталось выдать».
  const catOf = r => specCat(employees.find(e => e.id === r.employee_id)?.specialty_id) || 'Прочие';
  rows.sort((a, b) => catOf(a).localeCompare(catOf(b)) || (a.fio || '').localeCompare(b.fio || ''));
  let body = '', curCat = null;
  for (const r of rows) {
    const cat = catOf(r);
    if (cat !== curCat) {
      curCat = cat;
      const inCat = rows.filter(x => catOf(x) === cat);
      const catDelta = inCat.reduce((s, x) => s + (x.delta_kop || 0), 0);
      body += `<tr class="pw-group" style="--cat:${catColor(cat)}"><td colspan="16"><span>${esc(cat)} · ${inCat.length} чел · осталось выдать <b>${rub(catDelta)} ₽</b></span></td></tr>`;
    }
    const my = linesFor(r);
    const flags = payrollFlags(r);
    // одна ставка → одна строка без объединения; несколько → rowspan справа
    const n = Math.max(1, my.length);
    const right = `
      <td class="num sep fin"><b>${rub(r.salary_kop)}</b></td>
      <td class="num fin">${rub(r.cash_avans_kop)}</td>
      <td class="num fin">${rub(r.card_avans_kop)}</td>
      <td class="num fin">${rub(r.card_rasch_kop)}</td>
      <td class="num fin">${rub(r.card_uvol_kop)}</td>
      <td class="num fin">${rub(r.cash_kop)}</td>
      <td class="num fin">${rub(r.otpusk_nach_kop)}</td>
      <td class="num fin">${rub(r.otpusk_kop)}</td>
      <td class="num fin">${rub(r.otpusk_cash_kop)}</td>
      <td class="num fin">${rub(r.premia_kop)}</td>
      <td class="num pw-pay fin"><b class="money">${rub(r.delta_kop)}</b></td>`;
    if (!my.length) {
      body += `<tr class="pw-row" data-id="${r.employee_id}"><td class="pw-name"><span class="pw-fio">${esc(r.fio)}</span>${flags}</td>
        <td colspan="4" class="muted small">${r.flag_no_rate ? 'нет ставки' : 'нет начислений за месяц'}</td>${right}</tr>`;
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
  const total = `<tfoot><tr class="pw-total"><td class="pw-name">ИТОГО</td><td></td>
    <td class="num">${sum('norm_days')} дн</td><td class="num">${sum('fact_days')} дн</td><td></td>
    <td class="num sep fin"><b>${rub(sum('salary_kop'))}</b></td>
    <td class="num fin">${rub(sum('cash_avans_kop'))}</td>
    <td class="num fin">${rub(sum('card_avans_kop'))}</td><td class="num fin">${rub(sum('card_rasch_kop'))}</td>
    <td class="num fin">${rub(sum('card_uvol_kop'))}</td><td class="num fin">${rub(sum('cash_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_nach_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_kop'))}</td><td class="num fin">${rub(sum('otpusk_cash_kop'))}</td><td class="num fin">${rub(sum('premia_kop'))}</td>
    <td class="num pw-pay fin"><b class="money">${rub(sum('delta_kop'))}</b></td></tr></tfoot>`;

  $('payrollTable').innerHTML = `<table class="pw">${head}<tbody>${body}</tbody>${total}</table>`;
  $('payrollTable').querySelectorAll('.pw-row').forEach(tr => {
    tr.onclick = () => payrollDialog(+tr.dataset.id);
  });
  renderPayrollStat(rows);
}

// Флаги — короткими чипами у имени. Это ПОДСКАЗКА «посмотри», а не приговор.
function payrollFlags(r) {
  const f = [];
  if (r.flag_money_without_calc) f.push(['деньги без расчёта', 'red']);
  if (r.flag_no_rate)        f.push(['нет ставки', 'red']);
  if (r.flag_oklad_no_days)  f.push(['оклад без дней', 'red']);
  if (r.flag_rate_gap)       f.push(['ставка не на все дни', 'amber']);
  if (r.flag_no_patient_data)f.push(['нет оплат пациентов', 'amber']);
  if (r.flag_pct_no_rate)    f.push(['оплата без процента', 'amber']);
  if (r.flag_partial_month)  f.push(['неполный месяц', 'amber']);
  if (r.flag_fallback)       f.push(['запасная ставка', 'amber']);
  if (r.flag_archived)       f.push(['в архиве', 'amber']);
  if (r.flag_ambiguous)      f.push(['две одинаковые ставки', 'amber']);
  return f.length ? `<span class="pw-flags">${f.map(([t, c]) => `<span class="pw-flag ${c}">${t}</span>`).join('')}</span>` : '';
}

function renderPayrollStat(rows) {
  const s = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const problems = rows.filter(r => r.flag_no_rate || r.flag_oklad_no_days).length;
  // «Осталось выдать» = Σ Δ = начислено − выплачено (карта+нал). Главное число:
  // сколько ещё раздать людям (в осн. наличными), если все вышли по графику.
  $('payrollStat').innerHTML =
    `<span class="mini-chip strong">Осталось выдать: <b class="money">${rub(s('delta_kop'))} ₽</b></span>
     <span class="mini-chip">Начислено: <b>${rub(s('salary_kop'))} ₽</b></span>
     <span class="mini-chip">Выдано на карту: <b>${rub(s('card_avans_kop') + s('card_rasch_kop') + s('card_uvol_kop'))} ₽</b></span>
     ${s('cash_kop') + s('cash_avans_kop') ? `<span class="mini-chip">Выдано наличными: <b>${rub(s('cash_kop') + s('cash_avans_kop'))} ₽</b></span>` : ''}
     ${/* Отпускные наличными и премия в «Выдано» не входят — они ещё НЕ выданы,
           это наряд кассе. Без отдельного чипа сумма жила бы только в 14-й графе
           таблицы с горизонтальным скроллом. */''}
     ${s('to_pay_kop') ? `<span class="mini-chip">К выдаче наличными: <b>${rub(s('to_pay_kop'))} ₽</b></span>` : ''}
     ${problems ? `<span class="mini-chip warn">Нужна ставка: <b>${problems}</b></span>` : ''}`;
}

/* Модалка человека: из чего сложилась зарплата, ввод ручных денег и ИСТОРИЯ
   «кто внёс и когда». История берётся из v_money_events — там уже видно, что
   пришло из импорта (с файлом и датой загрузки), а что внесено руками. Метку
   «из импорта» подделать нельзя (migrations/010 §8), поэтому это факт. */
/* Сторно — не «удалить», а встречная запись. Спрашиваем явно, потому что обе
   останутся видны навсегда: это и есть смысл append-only. */
function confirmStorno(row) {
  return new Promise(resolve => {
    showModal2(`<h3>Сторнировать запись?</h3>
      <div class="msub">${esc(row.kind_label || moneyKindLabel(row.kind))} · ${rub(row.amount_kop)} ₽ · ${esc(row.entered_by_name || '—')}</div>
      <div class="rc-warn">Запись не удаляется. Появится встречная на <b>−${rub(row.amount_kop)} ₽</b>,
        и обе останутся видны владельцу в журнале. Это правильный способ исправить ошибку.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="stNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="stYes">${ICONS.check}Сторнировать</button></div>`);
    $('stNo').onclick = () => { closeModal2(); resolve(false); };
    $('stYes').onclick = () => { closeModal2(); resolve(true); };
  });
}

/* Здесь был автоматический «Отпускных осталось выплатить» = начислено − карта −
   наличные. УБРАН НАМЕРЕННО: обе суммы брались из ОДНОГО месяца, а весь смысл
   отдельной графы «начислено» в том, что начислить могут в июле, а выплатить в
   августе. На таких данных строка врала дважды — июль навсегда показывал бы
   «осталось 40 000» уже после выплаты, а август не показывал бы ничего.
   Настоящий остаток по отпускным — это НАКОПИТЕЛЬНЫЙ баланс по всем периодам,
   т.е. отдельная задача (запрос за все месяцы, а не за текущий). Пока три числа
   стоят рядом отдельными строками, и разность видно глазами. */

async function payrollDialog(empId) {
  const r = payrollRows.find(x => x.employee_id === empId); if (!r) return;
  const my = payrollLines.filter(l => l.employee_id === empId);
  const canEdit = isStaff();
  // процентник: ЗП = % × выручка. Пока оплаты пациентов неполные — выручку за месяц
  // вносят руками (СЕО/Алёна). Показываем поле, если у врача есть ставка «процент».
  const emp = employees.find(e => e.id === empId);
  const pctLine = emp && emp.lines && emp.lines.find(l => l.pay_kind === 'процент');
  let curRev = 0;
  if (pctLine && canEdit) { try { curRev = await store.getDoctorRevenue(empId, payPeriod); } catch (e) {} }
  const breakdown = my.length
    ? my.map(l => `<div class="me-row"><span class="muted">${esc(payKindLabel(l.kind))}${l.sub ? ' · ' + esc(l.sub) : ''}${l.isPct ? '' : ` · ${l.worked} из ${l.planned}`}</span><b>${rub(l.money_kop)} ₽</b></div>`).join('')
    : `<div class="me-row"><span class="muted">${r.flag_no_rate ? 'Ставка не заведена' : 'Начислений за месяц нет'}</span><b>0 ₽</b></div>`;
  const pct = '';   // процент теперь приходит строкой из linesFor()

  showModal(`<h3>${esc((r.fio || '').split(' ').slice(0, 2).join(' '))}</h3>
    <div class="msub">${esc(periodLabel(payPeriod))} · норма ${r.norm_days} дн · факт ${r.fact_days} дн</div>
    <div class="rc-diff">${breakdown}${pct}
      <div class="me-row me-sum"><span>Зарплата</span><b>${rub(r.salary_kop)} ₽</b></div>
      ${r.card_avans_kop ? `<div class="me-row"><span class="muted">Аванс на карту</span><b>${rub(r.card_avans_kop)} ₽</b></div>` : ''}
      ${r.card_rasch_kop ? `<div class="me-row"><span class="muted">ЗП на карту</span><b>${rub(r.card_rasch_kop)} ₽</b></div>` : ''}
      ${r.card_uvol_kop ? `<div class="me-row"><span class="muted">Расчёт на карту (увольнение)</span><b>${rub(r.card_uvol_kop)} ₽</b></div>` : ''}
      ${r.cash_kop ? `<div class="me-row"><span class="muted">Наличными</span><b>${rub(r.cash_kop)} ₽</b></div>` : ''}
      ${r.cash_avans_kop ? `<div class="me-row"><span class="muted">Аванс наличными</span><b>${rub(r.cash_avans_kop)} ₽</b></div>` : ''}
      ${r.premia_kop ? `<div class="me-row"><span class="muted">Премия</span><b>${rub(r.premia_kop)} ₽</b></div>` : ''}
      ${r.otpusk_nach_kop ? `<div class="me-row"><span class="muted">Отпускные начислено</span><b>${rub(r.otpusk_nach_kop)} ₽</b></div>` : ''}
      ${r.otpusk_kop ? `<div class="me-row"><span class="muted">Отпускные на карту</span><b>${rub(r.otpusk_kop)} ₽</b></div>` : ''}
      ${r.otpusk_cash_kop ? `<div class="me-row"><span class="muted">Отпускные наличными</span><b>${rub(r.otpusk_cash_kop)} ₽</b></div>` : ''}
      <div class="me-row me-sum"><span>Осталось выдать</span><b class="money">${rub(r.delta_kop)} ₽</b></div>
      <div class="me-row"><span class="muted small">Зарплата минус уже выданное (карта/наличные). Столько ещё раздать — в основном наличными. Отпускные в эту разницу не входят: на карту они уже выплачены, а наличные идут отдельной строкой в кассу.</span></div>
      ${r.to_pay_kop ? `<div class="me-row"><span class="muted small">Записано в кассу наличными (Бух 1)</span><span class="small">${rub(r.to_pay_kop)} ₽</span></div>` : ''}</div>
    ${pctLine && canEdit ? `<label class="flbl">Выручка за месяц · ЗП = ${esc(String(pctLine.percent))}% от неё</label>
      <div class="me-add">
        <input class="input" id="pmRev" placeholder="выручка ₽" autocomplete="off" inputmode="numeric" value="${curRev ? fmt(Math.round(curRev / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmRevSave">${ICONS.check}Сохранить</button>
      </div>
      <div class="msub">Для процентников считаем ЗП от введённой выручки (оплаты пациентов пока неполные). Изменение выручки видит владелец в журнале.</div>` : ''}
    ${canEdit ? `<label class="flbl">Внести деньги</label>
      <div class="me-add">
        <select class="input" id="pmKind">${moneyKindsFor(store.me()?.role).map(k => `<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
        <input class="input" id="pmSum" placeholder="сумма ₽" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="pmAdd">${ICONS.plus}Внести</button>
      </div>
      <div class="msub">Записи не правятся: ошибку исправляют сторно — обе записи видны владельцу.${store.me()?.role === 'operator' ? ' Премию вносит владелец.' : ''}</div>` : ''}
    <label class="flbl" style="margin-top:12px">Кто внёс и когда</label>
    <div id="pmHist" class="pm-hist"><span class="muted small">загружаем…</span></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="pmClose">Закрыть</button></div>`);
  $('modalBox').dataset.guard = '1';                    // деньги — не закрывать случайным кликом
  $('pmClose').onclick = closeModal;

  const loadHist = async () => {
    try {
      const ev = await store.listMoneyEvents(empId, payPeriod);
      const reversed = new Set(ev.filter(e => e.reverses_id).map(e => e.reverses_id));
      $('pmHist').innerHTML = ev.length ? ev.map(e => {
        const isStorno = !!e.reverses_id, isDead = reversed.has(e.id);
        // Сторнировать можно только «живую» обычную запись: сторно сторно база
        // запрещает, дважды одну и ту же — тоже (migrations/010 §3).
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
      await store.addMoneyLine({ employee_id: empId, period: payPeriod,
        kind: $('pmKind').value, amount_kop: Math.round(sum * 100) });
      $('pmSum').value = '';
      await renderPayroll($('payrollSearch')?.value || '');
      const fresh = payrollRows.find(x => x.employee_id === empId);
      if (fresh) toast(ICONS.check + 'Внесено · к выдаче ' + rub(fresh.to_pay_kop) + ' ₽');
      closeModal(); payrollDialog(empId);      // пересобираем с актуальными цифрами
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  // Сохранить месячную выручку врача → база пересчитает % → refresh покажет ЗП.
  if (pctLine && canEdit) $('pmRevSave').onclick = async () => {
    const btn = $('pmRevSave'); if (btn.disabled) return;
    let rev;
    try { rev = parseNum($('pmRev').value, { thousands: true, field: 'выручку', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (rev == null || rev < 0) { toast('Укажите выручку (0 — убрать)', true); return; }
    btn.disabled = true;
    try {
      const res = await store.setDoctorRevenue(empId, payPeriod, Math.round(rev * 100));
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + (res ? 'Выручка внесена — зарплата пересчитана' : 'Без изменений'));
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

/* ── Обзор владельца ─────────────────────────────────────────────────────
   Затверджений дизайн — renderPhone у прототипі (hero «Всего к выдаче», плитки,
   «Требует внимания», «Последние выдачи», подпись «из неизменяемого журнала»).
   Дельта: цифры реальные из v_month_total; появились ВЫДАНО/ОСТАТОК (payout);
   «Требует внимания» строится из настоящих флагов + красных записей журнала, и
   каждый пункт КЛИКАБЕЛЕН на нужный экран. График «Наличка по дням» отложен —
   он пуст до первого дня выдач (3b-6), рисовать диаграмму нулевого ряда рано. */
let ovPeriod = null, ovData = null, ovSeq = 0;
function shiftOvMonth(d) { if (!ovPeriod) ovPeriod = nowPeriod(); let [y, m] = ovPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } ovPeriod = y + '-' + String(m).padStart(2, '0'); renderOverview(); }

// Флаги v_month_total → человеческие строки «Требует внимания». Красные — сверху.
// Порядок массива = порядок показа. Клик ведёт на «Расчёт», где это видно построчно.
// key может быть строкой-колонкой флага ИЛИ функцией-предикатом (r)=>bool.
const OV_ALERTS = [
  { key: 'flag_overpaid', red: true, t: 'Выдано больше назначенного', d: 'проверьте кассу — это не должно случаться' },
  { key: 'flag_money_without_calc', red: true, t: 'Деньги есть, а расчёта нет', d: 'выплата без начисления под ней' },
  // Δ (начислено − записано) — проверка ПОЛНОТЫ расчёта, один из двух контролей
  // владельца. Раньше её на обзоре не было вовсе: если Алёна записывала наличку
  // МЕНЬШЕ заработанного, Δ≠0, но обзор говорил «Всё в порядке» (нашёл аудит 20.07).
  // Предикат ТОЧНО как в payrollDialog (app.js recorded>0 && |delta|>10000): порог
  // «что-то уже записано» гасит ложную тревогу — Δ ненулевая весь месяц по
  // построению (зарплата копится раньше, чем выдаётся наличка), поэтому сигналим
  // только когда запись НАЧАЛАСЬ, а свести не сходится. Красным — это скрытая
  // недоплата, а не рабочая недозаполненность.
  { key: r => recorded(r) > 0 && Math.abs(r.delta_kop || 0) > 10000, red: true, t: 'Расхождение: начислено ≠ записано', d: 'записанные деньги не сходятся с расчётом' },
  { key: 'flag_no_data', red: false, t: 'График есть, а денег ноль', d: 'человек работал, но ничего не начислено' },
  { key: 'flag_oklad_no_days', red: false, t: 'Оклад есть, отработанных дней ноль', d: 'оклад не на что начислить' },
  { key: 'flag_pct_no_rate', red: false, t: 'Процент без ставки', d: 'оплаты пациентов есть, а ставки процента нет' },
  { key: 'flag_no_rate', red: false, t: 'Не заведена ставка', d: 'без ставки зарплата не считается' },
  { key: 'flag_partial_month', red: false, t: 'Неполный месяц', d: 'приём или увольнение в середине месяца' },
];

async function renderOverview(reset = true) {
  if (!isOwner()) { $('overviewBody').innerHTML = ''; return; }
  if (!ovPeriod) ovPeriod = nowPeriod();
  const want = ovPeriod, seq = ++ovSeq;
  $('oLabel').textContent = periodLabel(want);
  let rows, remarks, payouts;
  try {
    [rows, remarks, payouts] = await Promise.all([
      store.listPayroll(want), store.listRedRemarks(6), store.listRecentPayouts(5),
    ]);
  } catch (e) { if (seq === ovSeq) { toast(e.message || e, true); $('oLabel').textContent = periodLabel(ovData?.period || want); } return; }
  if (seq !== ovSeq) return;                       // месяц сменили, пока грузили
  ovData = { rows, remarks, payouts, period: want };
  $('oLabel').textContent = periodLabel(want);
  drawOverview();
}

function drawOverview() {
  if (!ovData) return;
  const { rows, remarks, payouts } = ovData;
  const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const delta = sum('delta_kop'), salary = sum('salary_kop');
  // Всё официальное, что ушло на карту: аванс + ЗП + расчёт при увольнении + ОТПУСКНЫЕ
  // НА КАРТУ. Последние сюда не входили, и плитка «Официально на карту» занижала
  // сумму ровно на реестр ТКБ (в июле — 635 000 ₽), хотя в «Расчёте» рядом стоит
  // графа «Отпуск. карта» с этим же числом. Это ИМЕННО ТА цифра, что показывает,
  // сколько прошло официально, — занижать её нельзя. В Δ отпускные по-прежнему не
  // входят (033), а подстрочник героя тождеством никогда и не был.
  const card = sum('card_rasch_kop') + sum('card_avans_kop') + sum('card_uvol_kop') + sum('otpusk_kop');
  const paid = sum('paid_kop');
  const people = rows.filter(r => r.status === 'active').length;

  // hero + плитки. Главное число — «Осталось выдать» = Δ (начислено − выданное),
  // т.е. сколько ещё раздать людям (в осн. наличными), если все вышли по графику.
  const metric = (l, v, cls, gc) => `<div class="ov-metric${cls ? ' ' + cls : ''}"${gc ? ` style="--gc:${gc}"` : ''}><div class="l">${l}</div><div class="v">${v}</div></div>`;
  const hero = `<div class="ov-hero"><div class="l">Осталось выдать · ${esc(periodLabel(ovData.period))}</div>`
    + `<div class="v">${rub(delta)} <small>₽</small></div>`
    + `<div class="ov-sub">начислено <b>${rub(salary)} ₽</b> · уже на карту <b>${rub(card)} ₽</b></div></div>`;
  const bento = `<div class="ov-bento">`
    + metric('Начислено всего', rub(salary) + ' ₽', '', 'rgba(139,123,232,.34)')
    + metric('Официально на карту', rub(card) + ' ₽', '', 'rgba(62,115,216,.34)')
    + metric('Выдано наличными', rub(paid) + ' ₽', '', 'rgba(31,165,101,.4)')
    + metric('Сотрудников', fmt(people), '', 'rgba(224,153,42,.34)')
    + `</div>`;

  // Требует внимания: флаги-агрегаты (кликают на Расчёт) + красные записи (на Журнал)
  const flagAlerts = OV_ALERTS.map(a => {
    const test = typeof a.key === 'function' ? a.key : (r => r[a.key]);
    const n = rows.filter(test).length;
    return n ? `<button class="ov-alert${a.red ? ' red' : ''}" data-go="payroll"><span class="oa-ic">${a.red ? ICONS.alert : ICONS.info}</span><div><div class="oa-t">${esc(a.t)} · ${n}</div><div class="oa-d">${esc(a.d)}</div></div></button>` : '';
  }).filter(Boolean);
  const remarkAlerts = (remarks || []).slice(0, 4).map(j =>
    `<button class="ov-alert red" data-go="journal-red"><span class="oa-ic">${ICONS.alert}</span><div><div class="oa-t">${esc(J_FIELD[j.field] || j.field || 'запись')}${j.new_value ? ' · ' + esc(j.new_value) : ''}</div><div class="oa-d">${esc(j.actor || '')} · ${esc(fmtDT(j.at))}</div></div></button>`);
  const alerts = [...flagAlerts, ...remarkAlerts];
  const attention = alerts.length
    ? alerts.join('')
    : `<div class="ov-alert ok"><span class="oa-ic">${ICONS.check}</span><div><div class="oa-t">Всё в порядке</div><div class="oa-d">крупных расхождений, переплат и пробелов не видно</div></div></div>`;

  // Последние выдачи
  const paysHtml = (payouts && payouts.length) ? payouts.map(p =>
    `<div class="jrow"><div class="oa-ic" style="color:var(--green)">${ICONS.check}</div><div style="flex:1"><div style="font-weight:700;font-size:13.5px">${esc(p.fio || '—')}${p.is_self_payout ? ' <span class="pd-rev">себе</span>' : ''}</div><div class="who">подтверждено кодом · ${esc(fmtDT(p.confirmed_at))}</div></div><div class="fin" style="font-weight:700;color:var(--green-d)">${rub(p.amount_kop)} ₽</div></div>`).join('')
    : `<div class="jrow" style="border:none"><div style="flex:1;color:var(--ink-3);font-size:13px">Выдач ещё не было</div></div>`;

  $('overviewBody').innerHTML = hero + bento
    + `<div class="ov-sec">Требует внимания</div><div class="ov-alerts">${attention}</div>`
    + `<div class="ov-sec">Последние выдачи</div><div class="card">${paysHtml}</div>`
    + `<div class="note ov-note">${ICONS.lock}Все суммы — из неизменяемого журнала</div>`;

  $('overviewBody').querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    if (b.dataset.go === 'journal-red') { journalFilter = 'red'; go('journal'); renderJournal(true); }
    else go(b.dataset.go);
  });
}

/* ── Оплаты пациентов ───────────────────────────────────────────────────
   ТОЛЬКО ЧТЕНИЕ. Оплаты приходят импортом (задача #44), руками их не вводят —
   экран нужен, чтобы зайти и СВЕРИТЬ, что импорт лёг верно. Это единственный
   источник процента врачей, а у накрутки процента нет потерпевшего (врач
   доволен, теряет только владелец за 3000 км), поэтому видимая сверка — и есть
   контроль. Итоги берём ГОТОВЫМИ из v_patient_month: список постраничный, и
   сумма по загруженной странице врала бы. */
let patPeriod = null, patRows = [], patLastId = null, patHasMore = false, patMonth = [], patShown = null, patSeq = 0;
function shiftPatMonth(d) { if (!patPeriod) patPeriod = nowPeriod(); let [y, m] = patPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } patPeriod = y + '-' + String(m).padStart(2, '0'); renderPatients(); }

async function renderPatients(reset = true) {
  if (!isStaff()) { $('patList').innerHTML = ''; return; }
  if (!patPeriod) patPeriod = nowPeriod();
  // Токен против гонки — тот же приём, что schedSeq и payrollSeq. Без него быстрый
  // двойной клик по ‹/› давал ДЕНЬГИ ОДНОГО МЕСЯЦА ПОД ЗАГОЛОВКОМ ДРУГОГО: ответ
  // приходил уже после смены месяца и записывался как показанный. На экране,
  // созданном ловить накрутку процента, это тихая подмена месяца.
  const want = patPeriod, seq = ++patSeq;
  const wantLast = reset ? null : patLastId;
  $('qLabel').textContent = periodLabel(want);          // сразу показываем, ЧТО грузим
  let month, page;
  try {
    [month, page] = await Promise.all([
      reset ? store.listPatientMonth(want) : Promise.resolve(patMonth),
      store.listPatientEvents({ period: want, beforeId: wantLast }),
    ]);
  } catch (e) {
    if (seq !== patSeq) return;
    toast(e.message || e, true);
    // Возвращаем заголовок к тому месяцу, который РЕАЛЬНО на экране, иначе
    // осталась бы шапка нового месяца над данными старого.
    $('qLabel').textContent = periodLabel(patShown || want);
    return;
  }
  if (seq !== patSeq) return;               // месяц сменили, пока ждали — ответ выбрасываем
  // Состояние обновляем ТОЛЬКО целиком и только после удачной загрузки: раньше
  // patRows чистились до try, а patMonth присваивался внутри — при обрыве сети
  // оставались итоги старого месяца под новым заголовком.
  patMonth = month;
  patRows = reset ? page.rows : patRows.concat(page.rows);
  patLastId = page.lastId ?? patLastId;
  patHasMore = page.hasMore;
  patShown = want;
  $('qLabel').textContent = periodLabel(want);
  drawPatients();
}

// Пустой список при поиске НЕ значит «нет оплат»: итог по врачам приходит за весь
// месяц, а строки — постранично, поэтому у найденного врача сумма уже видна, а его
// приёмы могут быть ещё не подгружены. Раньше здесь стояло «Никого не найдено» —
// на экране сверки это читалось как недостача, которой нет.
function emptyPatText(f, month) {
  if (f && month.length) {
    const n = month.reduce((s, m) => s + (m.visits || 0) + (m.reversed || 0), 0);
    return `<div class="empty">Оплаты этого врача есть (${fmt(n)}), но ещё не загружены<br><span class="small">нажмите «Показать ещё» ниже</span></div>`;
  }
  if (f) return '<div class="empty">Такого врача в этом месяце нет</div>';
  return `<div class="empty">За ${esc(periodLabel(patShown || patPeriod))} оплат нет.<br><span class="small">Они появятся после импорта таблицы оплат</span></div>`;
}

function drawPatients() {
  const f = ($('patSearch')?.value || '').toLowerCase().trim();
  const hit = s => !f || String(s || '').toLowerCase().includes(f);
  const month = patMonth.filter(m => hit(m.fio));
  // Итог берём из БАЗЫ по отфильтрованным врачам, а не по загруженной странице.
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
  // Кнопку показываем ВСЕГДА, когда есть что грузить. Пряталась при поиске — а
  // «Показать ещё» тянет весь месяц, то есть именно ею разрыв и закрывался:
  // каждый клик подтягивал список к итогу. Спрятанная, она превращала известное
  // ограничение в тупик, и остаток разрыва читался как ложный сигнал о недостаче.
  const more = patHasMore ? `<div class="jmore-wrap"><button class="btn btn-ghost btn-sm" id="pMore">Показать ещё</button></div>` : '';
  $('patList').innerHTML = body + more;
  const mb = $('pMore'); if (mb) mb.onclick = () => renderPatients(false);
}

// Фильтры журнала. Ключи совпадают с journalMatch() в store.js — оба стора судят
// одинаково. Порядок: сначала «на что смотреть чаще» (красное = требует внимания),
// потом деньги/выдачи/премии (тонули в правках графика), потом график/ставки.
const J_FILTERS = [['all', 'Все'], ['red', 'Красные'], ['money', 'Деньги'],
  ['payout', 'Выдачи'], ['premia', 'Премии'], ['schedule', 'График'], ['rate', 'Ставки']];
let journalFilter = 'all', journalRows = [], journalLastId = null, journalHasMore = false, journalBusy = false;

function journalRowHtml(j) {
  let what;
  const act = J_ACTION[j.action] ? `<b class="jact">${esc(J_ACTION[j.action])}</b> · ` : '';
  if (j.action === 'created') what = `${J_ENTITY[j.entity] || esc(j.entity)} создана: <b>${esc(j.new_value || '')}</b>`;
  else what = `${act}${J_ENTITY[j.entity] || esc(j.entity)} · ${J_FIELD[j.field] || esc(j.field || '')}: ${j.old_value ? `<s>${esc(j.old_value)}</s> → ` : ''}<b>${esc(j.new_value || '—')}</b>`;
  return `<div class="jrow${j.red ? ' jred' : ''}"><div style="flex:1"><div>${what}</div><div class="who">${esc(j.actor)}</div></div><div class="jt">${esc(fmtDT(j.at))}</div></div>`;
}

// reset=true — сменили фильтр или зашли заново: тянем с начала. reset=false —
// «Показать ещё»: дописываем следующую страницу к уже показанному (keyset по id).
async function renderJournal(reset = true) {
  if (journalBusy) return; journalBusy = true;
  if (reset) { journalRows = []; journalLastId = null; journalHasMore = false; }
  try {
    const res = await store.listJournal({ filter: journalFilter, beforeId: reset ? null : journalLastId });
    journalRows = reset ? res.rows : journalRows.concat(res.rows);
    journalLastId = res.lastId ?? journalLastId;
    journalHasMore = res.hasMore;
  } catch (e) { toast(e.message || e, true); }
  journalBusy = false;
  drawJournal();
}

function drawJournal() {
  const chips = J_FILTERS.map(([k, l]) => `<button class="jf-chip${journalFilter === k ? ' on' : ''}" data-jf="${k}">${esc(l)}</button>`).join('');
  $('journalTools').innerHTML = `<div class="jf-chips">${chips}</div>`;
  $('journalTools').querySelectorAll('.jf-chip').forEach(b => b.onclick = () => {
    if (b.dataset.jf === journalFilter) return;
    journalFilter = b.dataset.jf; renderJournal(true);
  });
  const body = journalRows.length ? journalRows.map(journalRowHtml).join('')
    : `<div class="empty">${journalFilter === 'all' ? 'Журнал пуст — появится после первых изменений' : 'В этой категории записей нет'}</div>`;
  const more = journalHasMore ? `<div class="jmore-wrap"><button class="btn btn-ghost btn-sm" id="jMore">Показать ещё</button></div>` : '';
  $('journalList').innerHTML = body + more;
  const mb = $('jMore'); if (mb) mb.onclick = () => renderJournal(false);
}

/* ── модалка / тост ── */
function showModal(html) { $('modalBox').innerHTML = html; $('modalOv').classList.add('show'); applyIcons($('modalBox')); const f = $('modalBox').querySelector('input'); if (f) setTimeout(() => f.focus(), 60); }
function closeModal() { $('modalOv').classList.remove('show'); delete $('modalBox').dataset.guard; }
// Второй слой — диалог ПОВЕРХ уже открытой формы. Без него confirmBigAmounts
// затирал бы карточку (оба писали в общий #modalBox), и «Исправить» терял ввод.
function showModal2(html) { $('modalBox2').innerHTML = html; $('modalOv2').classList.add('show'); applyIcons($('modalBox2')); }
function closeModal2() { $('modalOv2').classList.remove('show'); }
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
{ const ps = $('payrollSearch'); if (ps) ps.oninput = e => drawPayroll(e.target.value); }
{ const pp = $('pPrev'), pn = $('pNext');
  if (pp) pp.onclick = () => { shiftPayMonth(-1); renderPayroll($('payrollSearch')?.value || ''); };
  if (pn) pn.onclick = () => { shiftPayMonth(1); renderPayroll($('payrollSearch')?.value || ''); }; }
// Обзор владельца: навигация по месяцам
{ const op = $('oPrev'), on = $('oNext');
  if (op) op.onclick = () => shiftOvMonth(-1);
  if (on) on.onclick = () => shiftOvMonth(1); }
// Оплаты пациентов: поиск фильтрует УЖЕ загруженное (drawPatients), месяц — перезагружает
{ const qs = $('patSearch'); if (qs) qs.oninput = () => drawPatients(); }
{ const qp = $('qPrev'), qn = $('qNext');
  if (qp) qp.onclick = () => shiftPatMonth(-1);
  if (qn) qn.onclick = () => shiftPatMonth(1); }
// выбор отделения (empCat/schedCat) обрабатывает makeDropdown → onPick, отдельное onchange не нужно
{ const tb = $('themeBtn'); if (tb) tb.onclick = toggleTheme; paintThemeBtn(); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!localStorage.getItem(THEME_KEY)) paintThemeBtn(); }); } catch (e) {}
$('addEmpBtn').onclick = () => employeeForm(null);
$('addSpecBtn').onclick = specForm;
$('backBtn').onclick = () => go('employees');
$('logoutBtn').innerHTML = ICONS.out;
// finally: выход должен ВЫГЛЯДЕТЬ выходом даже если signOut упал по сети. Иначе экран
// остаётся «внутри программы», хотя store.logout() уже снял пользователя и ключ дня.
$('logoutBtn').onclick = async () => {
  try { await store.logout(); }
  finally { document.body.classList.remove('authed'); renderLogin(); }
};

// Суточный сброс входа отрабатывает в store.init(), то есть при ЗАГРУЗКЕ страницы. Программа,
// поставленная иконкой на телефон, страницу не перезагружает — возвращается из переключателя
// задач «как была», и вчерашний вход прожил бы сколько угодно. Проверяем день при каждом
// возврате в программу: перезагрузка гонит код по уже проверенной ветке init() → форма входа.
// Открытая форма — исключение: перезагрузка стёрла бы незаконченный ввод без предупреждения,
// а «вернулся в программу» — это ещё и просто погасший по автоблокировке экран телефона, пока
// владелец сверяет сумму с бумажки. Хуже всего ретро-правка: в замыкании висит уже отправленный
// СМС-код, и после перезагрузки его пришлось бы запрашивать заново (а попытки ограничены).
// Пропускаем — сброс отработает при следующем возврате, когда форма будет закрыта.
// TODO(осознанно не сделано): окно, которое НИКОГДА не сворачивают (Safari на втором мониторе),
// так и не сбросится — событие привязано к возврату, а не ко времени. Сброс по таймеру не ставим
// намеренно: он перезагружал бы страницу под руками у работающего человека, а это хуже, чем сам
// пропуск. Угроза, ради которой задуман суточный сброс, — забытый/потерянный телефон, и её
// покрывает именно возврат в программу.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !store.dayExpired()) return;
  if ($('modalOv').classList.contains('show') || $('modalOv2').classList.contains('show')) return;
  location.reload();
});
applyIcons();

(async () => {
  // Форму показываем сразу — не ждём полной инициализации базы. Иначе, если getUser
  // (проверка сессии) зависает, карточка остаётся пустой. Клиент Supabase создаётся
  // быстро (до getUser), поэтому вход по паролю работает даже при зависшем getUser.
  renderLogin();
  try {
    await Promise.race([
      store.init(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('база не ответила за 20 сек')), 20000)),   // холодный первый коннект к supabase.co (за Cloudflare) бывает 7–11с; после прогрева — <300мс
    ]);
    if (store.me()) await enter();  // если уже была сессия — входим; иначе форма уже показана
  } catch (e) {
    console.error('[init]', e);
    const libFail = /библиотек|supabase\.js|is not defined|undefined/i.test(String(e.message || e));
    toast(libFail ? 'Не удалось подключиться к базе — обновите страницу (Cmd/Ctrl+R).' : 'База отвечает медленно (' + String(e.message || e) + '). Вход по паролю должен работать.', true);
  }
})();
