/* Milena · Спринт 1 — вход, карточки сотрудников, специальности, журнал.
   Данные — через store.js (демо: localStorage · прод: Supabase).
   Все пользовательские строки при выводе проходят esc() — без исключений. */
// Версия импорта ДОЛЖНА идти в ногу с app.js/styles.css (index.html). Отставание
// безопасно только пока сервер отдаёт по ETag-ревалидации; при immutable-кэше
// новый app.js спарился бы с замороженным старым store.js → поломка у постоянных
// пользователей. Правило записано в milena-safety: бампать при КАЖДОЙ правке store.js.
import { makeStore, lineLabel, sameRate, backdateNeedsOk } from './store.js?v=95';

const $ = id => document.getElementById(id);

/* ── «Идёт обмен с базой» ────────────────────────────────────────────────
   Жалоба Дарины 01.08: вносишь сумму при плохом интернете и просто ждёшь, не
   понимая — грузится или зависло. Раньше единственным признаком была погасшая
   кнопка, а её на телефоне не видно.

   Считаем запросы к базе в ОДНОМ месте — обёртке над store, — чтобы не трогать
   полсотни вызовов и не забыть новый. Показываем не сразу: короткий запрос
   (обычный случай) мелькнул бы полоской на каждый чих. Дальше текст меняется по
   времени ожидания, потому что «медленно» и «висит» человек различает только так.
   Сообщения РАЗНЫЕ по смыслу: «сохраняем» — идёт, «медленный интернет» — идёт, но
   долго, «нет интернета» — НЕ сохранится, и это надо знать до, а не после ввода. */
const NET_SHOW_AFTER = 450;      // короче — только моргание на быстрых запросах
const NET_SLOW_AFTER = 4000;     // столько человек ещё считает нормальным ожиданием
let netPending = 0, netStarted = 0, netTimers = [];
function netPaint(text, cls) {
  const b = $('netBar'); if (!b) return;
  b.className = 'netbar show' + (cls ? ' ' + cls : '');
  b.innerHTML = (cls === 'off' ? '' : '<span class="btn-spin"></span>') + esc(text);
}
function netHide() { const b = $('netBar'); if (b && !b.classList.contains('off')) b.className = 'netbar'; }
function netClearTimers() { netTimers.forEach(clearTimeout); netTimers = []; }
function netStart() {
  if (++netPending > 1) return;                       // уже показываем
  netStarted = Date.now();
  netClearTimers();
  netTimers.push(setTimeout(() => netPaint('Сохраняем…'), NET_SHOW_AFTER));
  netTimers.push(setTimeout(() => netPaint('Медленный интернет — ждём ответа базы', 'slow'), NET_SLOW_AFTER));
  netTimers.push(setTimeout(() => netPaint('Всё ещё пытаемся. Не закрывайте программу', 'slow'), 15000));
}
function netEnd() {
  if (--netPending > 0) return;
  netPending = 0;
  netClearTimers();
  netHide();
}
// Обёртка: любой асинхронный метод store считается запросом к базе. Синхронные
// (me(), dayExpired()) отдаём как есть — иначе полоска мигала бы на каждом чтении
// из памяти. Прокси, а не правка store.js: store подменяется и в демо-режиме.
function withNetIndicator(s) {
  const cache = new Map();
  return new Proxy(s, {
    get(t, prop) {
      const v = t[prop];
      if (typeof v !== 'function' || prop.startsWith('_')) return typeof v === 'function' ? v.bind(t) : v;
      if (!cache.has(prop)) cache.set(prop, (...args) => {
        const out = v.apply(t, args);
        if (!out || typeof out.then !== 'function') return out;   // синхронный ответ — не сеть
        netStart();
        return out.finally(netEnd);
      });
      return cache.get(prop);
    },
  });
}
const store = withNetIndicator(makeStore());
/* Интернета нет совсем — это НЕ «медленно», а «сейчас ничего не сохранится».
   Показываем постоянно, пока не вернётся: человек должен увидеть это ДО того,
   как наберёт сумму и станет ждать. navigator.onLine врёт в одну сторону (может
   говорить «есть», когда сети по факту нет), поэтому он тут не единственный
   признак, а дополнение к полоске ожидания — не заменяет её. */
function netOffline() {
  const b = $('netBar'); if (!b) return;
  b.className = 'netbar show off';
  b.textContent = 'Нет интернета — изменения не сохраняются';
}
window.addEventListener('offline', netOffline);
window.addEventListener('online', () => { const b = $('netBar'); if (b) b.className = 'netbar'; if (netPending) netPaint('Сохраняем…'); });
if (navigator.onLine === false) setTimeout(netOffline, 0);
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
// «сдельно» — единственный вид БЕЗ суммы в ставке (migrations/055). Это пометка
// «этому человеку сумму называют готовым числом каждый месяц»; сама сумма живёт
// в «Финальной сумме вручную» (month_salary_override, 049) — второго механизма
// денег не заводим. Пометка отвечает на вопрос «почему у него вписано руками»:
// без неё ручная сумма у окладника (ошибка) выглядит так же, как у сдельщика.
const PAY_KINDS = [['оклад', 'Оклад'], ['фикс', 'Фикс/мес'], ['сутки', 'Сутки'], ['12ч', '12ч день / ночь'], ['почасово', 'Почасово'], ['процент', 'Процент'], ['сдельно', 'Сдельно (сумма за месяц)']];
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

/* Сортировка по фамилии — ОДНА на «График» и «Расчёт» (Дарина 03.08). Обычно
   списки разбиты по отделениям, и чтобы найти человека, надо знать, в каком он
   отделении. С этим переключателем — все одним списком А→Я.
   Настройка общая и переживает перезагрузку: искать человека по фамилии — это
   привычка, а не разовое действие, и переставлять галочку на каждом экране и
   после каждого входа было бы наказанием. */
const AZ_KEY = 'milena-sort-az';
let sortAZ = false;
try { sortAZ = localStorage.getItem(AZ_KEY) === '1'; } catch (e) {}
// trim() обязателен: ФИО правят руками и заливают из Excel, и один лишний
// пробел в начале выбрасывал человека в САМОЕ НАЧАЛО списка — мимо своей буквы.
const byFio = (a, b) => String(a.fio || '').trim().localeCompare(String(b.fio || '').trim(), 'ru');
function setSortAZ(on) {
  sortAZ = !!on;
  try { localStorage.setItem(AZ_KEY, sortAZ ? '1' : ''); } catch (e) {}
  const a = $('payAZ'), b = $('schedAZ');
  if (a) a.checked = sortAZ;
  if (b) b.checked = sortAZ;
  // Перерисовываем ОБА экрана, а не только текущий. Галочка ставится сразу в
  // обоих — и если перерисовать лишь открытый, на второй придёшь с поднятой
  // галочкой над списком, разбитым по-старому: go() «График» сам не перерисовывает,
  // если месяц не менялся. Обе функции рисуют из уже загруженного и молча выходят,
  // когда рисовать нечего, так что за скрытый экран платим только версткой в памяти,
  // а не походом в базу — на плохом интернете галочка думала бы секунды впустую.
  drawPayroll($('payrollSearch')?.value || '');
  drawSchedule();
}

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
  // Пробелы — рабочий список «что дозаполнить». Обзор показывает флаги счётчиками
  // и уводит на Расчёт; здесь те же флаги развёрнуты пофамильно, плюс то, чего в
  // v_month_total нет вовсе (нет графика за месяц, дыры в карточке).
  // staffOnly, а не ownerOnly: заполняет пробелы Алёна, ей и нужен список
  // (решение 30.07). Утечки скрытой зарплаты это не даёт — v_month_total
  // ВЫБРАСЫВАЕТ строку целиком: `NOT (hidden_salary AND current_app_role() IN
  // ('operator','cashier1','cashier2'))`, миграции 040/041. То есть у Алёны
  // спрятанный человек просто не появится ни в одной денежной группе.
  { s: 'gaps', i: 'alert', l: 'Пробелы', staffOnly: true },
  { s: 'vacation', i: 'cal', l: 'Отпуска', staffOnly: true },
  { s: 'archive', i: 'users', l: 'Архив', ownerOnly: true },
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
  $('sideNav').innerHTML = navItems().map(n => `<button class="nav-item${n.s === curScreen ? ' active' : ''}" data-s="${n.s}"><span class="ic">${ICONS[n.i] || ''}</span>${n.l}</button>`).join('');
  $('mobileNav').innerHTML = navItems().map(n => `<button data-s="${n.s}" class="${n.s === curScreen ? 'active' : ''}"><span>${ICONS[n.i] || ''}</span>${n.l}</button>`).join('');
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go(b.dataset.s));
}
// replace=true — не добавлять запись в историю. Нужно, когда экран меняется В ОТВЕТ
// на уже изменившийся адрес (applyHash): запись браузер завёл сам, и push поверх
// неё делал капкан — «назад» возвращал на тот же адрес, тот снова пушил, и выйти
// назад было нельзя вообще. Клики внутри программы — наоборот, push.
function go(screen, replace) {
  if (curScreen && curScreen !== screen && !replace) navStack++;
  curScreen = screen;
  // Месяц переносим ДО перерисовки, чтобы экран сразу нарисовался нужным — иначе
  // между показом и перерисовкой он моргал бы чужим месяцем, а клик по клетке в
  // эту щель ушёл бы не туда (тот самый баг, из-за которого месяцы разносили).
  const movedMonth = adoptPeriod(screen);
  if (screen === 'overview') renderOverview();
  if (screen === 'gaps') renderGaps();
  if (screen === 'vacation') renderVacation();
  if (screen === 'archive') renderArchive();
  if (screen === 'payroll') renderPayroll($('payrollSearch')?.value || '');
  // Грузим ВСЕГДА, как renderPayroll выше. Условие `patShown !== patPeriod` было
  // сломано дважды: при обоих null оно давало false и экран не открывался НИКОГДА;
  // а если бы открылся — Алёна заносит импорт, а Милена не может обновить, потому
  // что повторный заход в тот же месяц был бы no-op. Экран сверки с кэшем, который
  // не сбрасывается, отменяет сам себя.
  if (typeof syncTopBack === 'function') syncTopBack();
  if (screen === 'patients') renderPatients();
  if (screen === 'import') renderImport();
  // «График» — единственный, кого go() сам не рисует (его рисует refresh при
  // входе). Значит перенесённый месяц дорисовываем здесь, иначе сетка осталась бы
  // от прошлого месяца, а cellDate() уже отдавал бы новый.
  if (screen === 'schedule' && movedMonth) renderSchedule();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  $('s-' + screen).classList.add('show');
  // Лесенку примороженных подытогов «Расчёта» пересчитываем ЗДЕСЬ — это первый
  // момент, когда экран показан и высоты вообще можно измерить. На скрытом всё
  // меряется нулями, и три строки легли бы друг на друга; renderPayroll выше
  // вызван ДО показа и помочь не может, а его перерисовка приходит только с
  // ответом базы — до тех пор подвал стоял бы слипшимся.
  if (screen === 'payroll') stickFooterRows($('payrollTable'));
  renderNav();
  document.querySelector('.main').scrollTop = 0;
  // Первый экран после входа — тоже replace: он и есть дно истории, чтобы «назад»
  // с него выходило из программы, а не оставляло пустой адрес.
  syncHash(!firstNav && !replace);
  firstNav = false;
  presencePing();          // сменил экран — сразу видно, где он
}

/* ── Адрес экрана ───────────────────────────────────────────────────────
   У каждого экрана свой адрес: grafik.one/#/raschet/2026-07. Зачем именно здесь:
   (1) программа стоит иконкой на телефоне и в Dock. Кнопка «назад» на Android
       раньше закрывала её целиком, а свайп на iPhone не делал ничего — уйти с
       карточки можно было только кнопкой внутри экрана;
   (2) страница перезагружается САМА (проверка версии внизу index.html и суточный
       сброс входа) — без адреса человек каждый раз оказывался на «Обзоре», теряя
       и экран, и выбранный месяц;
   (3) на экран можно дать ссылку, а не объяснять словами, куда нажать.
   Адреса ХЭШЕВЫЕ (#/…), а не путями (/raschet). Не из-за 404: сервер как раз
   отдаёт index.html на любой путь с кодом 200 (SAFETY.md, проверено 28.07) —
   а из-за относительных ссылок. index.html тянет styles.css / app.js / config.js
   / иконки БЕЗ ведущего слэша, и на двухсегментном пути /kartochka/17 браузер
   искал бы их в /kartochka/ — программа не загрузилась бы вовсе. Чинится это
   тегом <base> или абсолютными путями, то есть правкой каждой ссылки ради
   косметики адреса. Хэш ещё и не мешает проверке версии: она берёт pathname.
   Слаги транслитом: ссылку читает Милена, а не программист.
   ⚠ Адрес НЕ ДАЁТ ПРАВ: allowedScreen пускает только на экраны, которые роль и
   так видит в меню, а данные всё равно закрыты RLS. */
const ROUTES = [
  { s: 'overview',    slug: 'obzor',        arg: 'period' },
  { s: 'employees',   slug: 'sotrudniki' },
  // Карточка — «kartochka», а не «sotrudnik»: с «sotrudniki» они различались бы
  // одной буквой на конце, а ссылку переносят и обрезают в мессенджере. «Карточка»
  // и есть слово, которым эту сущность зовут в команде.
  // TODO(осознанно отложено, MED): месяца в адресе карточки нет, а блок «Осталось
  // выдать» показывает payPeriod (loadCardMoney). Значит один и тот же
  // #/kartochka/17 у отправителя и получателя покажет РАЗНЫЕ месяцы, и он же
  // сменится после авто-перезагрузки. Не молча — месяц подписан рядом с суммой.
  // Чинится вторым аргументом в адресе; отложено, чтобы не расширять грамматику
  // адресов ради одного экрана в этой задаче.
  { s: 'card',        slug: 'kartochka',    arg: 'id' },
  // «Пробелы» приехали из master уже после маршрутизации — без адреса экран
  // нельзя было ни прислать ссылкой, ни удержать в общем месяце.
  { s: 'gaps',        slug: 'probely',      arg: 'period' },
  { s: 'vacation',    slug: 'otpuska',      arg: 'period' },
  { s: 'archive',     slug: 'arhiv' },
  { s: 'schedule',    slug: 'grafik',       arg: 'period' },
  { s: 'payroll',     slug: 'raschet',      arg: 'period' },
  { s: 'rates',       slug: 'stavki' },
  // «patsienty», а не «oplaty»: здесь деньги ВХОДЯЩИЕ (база процента врачей), а
  // «оплаты/выплаты» в этой программе — то, что выдают людям. Милена прочла бы
  // #/oplaty как «выплаты» и пошла бы искать не тот экран.
  { s: 'patients',    slug: 'patsienty',    arg: 'period' },
  { s: 'import',      slug: 'import' },
  { s: 'specialties', slug: 'specialnosti' },
  { s: 'journal',     slug: 'zhurnal' },
  { s: 'soon',        slug: 'skoro' },      // заглушка кассиров: адрес есть, ссылки на неё нет
];
// У «Графика», «Расчёта», «Оплат» и «Обзора» месяц СВОЙ (переменные разные
// намеренно — см. комментарий у payPeriod). Поэтому месяц в адресе — через
// геттер/сеттер того экрана, а не через одну общую переменную.
// ⚠ Список обязан совпадать с теми, у кого в ROUTES стоит arg: 'period'. Забыть
// здесь — тихо: адрес просто перестанет называть месяц, и никто не заметит.
const PERIOD_OF = {
  gaps:     { get: () => gapsPeriod, set: v => { gapsPeriod = v; workPeriod = v; } },
  vacation: { get: () => vacPeriod,  set: v => { vacPeriod = v; workPeriod = v; } },
  schedule: { get: () => curPeriod, set: v => { curPeriod = v; workPeriod = v; } },
  payroll:  { get: () => payPeriod, set: v => { payPeriod = v; workPeriod = v; } },
  patients: { get: () => patPeriod, set: v => { patPeriod = v; workPeriod = v; } },
  overview: { get: () => ovPeriod,  set: v => { ovPeriod = v; workPeriod = v; } },
  card:     { get: () => payPeriod, set: v => { payPeriod = v; workPeriod = v; } },
};
/* ── Выбранный месяц — ОБЩИЙ для экранов ────────────────────────────────
   Выбрал июль на «Расчёте» — «График», «Оплаты» и «Обзор» тоже показывают июль,
   пока не сменишь. Раньше у каждого экрана был свой месяц, и человек, разбирая
   июль в августе, листал назад заново на каждой вкладке (Дарина, 01.08).

   ⚠ Общий месяц однажды УЖЕ ломал программу — см. комментарий у payPeriod:
   «Расчёт» двигал общий curPeriod, «График» при этом не перерисовывался и
   показывал июльские клетки, а клик писал факт в август. Именно поэтому месяцы
   и разнесли. Возвращаем общий выбор ТОЛЬКО потому, что теперь та беда
   невозможна конструктивно:
     · перенос месяца и перерисовка экрана идут ОДНИМ шагом, в go();
     · пока новый месяц грузится, сетка и таблица гаснут, кликать не по чему;
     · у каждого экрана есть пара «хотели / показано» (schedShown, payrollShown,
       patShown, ovData.period), и при сбое загрузки месяц откатывается.
   Если хоть одно из трёх уберут — общий месяц придётся разносить обратно. */
let workPeriod = null;
// Переносит общий месяц на экран, куда заходим. true = месяц сменился, экран
// нужно перерисовать (тот, кого go() не рисует сам, — «График»).
function adoptPeriod(screen) {
  const p = PERIOD_OF[screen];
  if (!p || !workPeriod || p.get() === workPeriod) return false;
  p.set(workPeriod);
  return true;
}
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
let firstNav = true;
// Вошли по живой сессии (страница перезагрузилась под тем же человеком) или
// человек вводил пароль? От этого зависит, можно ли верить адресу в строке —
// см. enter(). Ставится один раз при старте, до первого enter().
let restoredSession = false;
function parseHash() {
  const raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];
  if (!raw) return null;
  const [slug, arg] = raw.split('/');
  // decodeURIComponent бросает URIError на «#/%» и прочих обломках. Разбор адреса
  // зовёт и enter() — необработанное исключение там повесило бы ВХОД в программу
  // из-за кривой ссылки. Кривой адрес — это просто «не адрес».
  let name; try { name = decodeURIComponent(slug || ''); } catch (e) { return null; }
  const r = ROUTES.find(x => x.slug === name);
  if (!r) return null;
  const t = { s: r.s };
  if (r.arg === 'id') {
    // Только цифры и без ведущих нулей. Number() принял бы и «0x10» (=16), и « 1 »,
    // и «017» — открылась бы карточка, которую в адресе никто не писал.
    if (!/^[1-9]\d*$/.test(arg || '')) return null;
    t.id = Number(arg);
  }
  if (r.arg === 'period' && PERIOD_RE.test(arg || '')) t.period = arg;
  return t;
}
// Карточка в меню не значится — её пускаем тем же условием, что и список
// сотрудников. Заглушка «скоро» — наоборот, только тем, у кого нет экранов.
function allowedScreen(s) {
  if (s === 'card') return isStaff();
  if (s === 'soon') return !isStaff();
  return navItems().some(n => n.s === s);
}
function hashFor(screen) {
  const r = ROUTES.find(x => x.s === screen);
  if (!r) return '';
  if (r.arg === 'id') { const id = $('cardBody').dataset.emp; return id ? `#/${r.slug}/${id}` : ''; }
  if (r.arg === 'period') { const p = PERIOD_OF[screen]?.get(); return p ? `#/${r.slug}/${p}` : `#/${r.slug}`; }
  return `#/${r.slug}`;
}
// push=false (replaceState) для смены месяца: месяц — состояние ВНУТРИ экрана, и
// пролистав полгода, человек не должен жать «назад» шесть раз, чтобы уйти с
// «Расчёта». В ссылке месяц при этом остаётся — ради него всё и делалось.
// WebKit бросает SecurityError после ~100 вызовов history за 30 секунд, а программа
// стоит иконкой и живёт в одной вкладке днями. Исключение отсюда прилетело бы в
// go() и оборвало САМ ПЕРЕХОД (месяц уже сдвинут, экран не перерисован) — адрес
// того не стоит: молча остаёмся с прежней строкой.
const histSafe = fn => { try { fn(); } catch (e) { console.warn('history:', e); } };
const clearHash = () => histSafe(() => history.replaceState(navState(), '', location.href.split('#')[0]));
// Нонс сеанса. Помечать записи просто «своя» оказалось мало: гасится только та
// запись, на которую браузер реально перешёл ДО входа, а те, что глубже в стеке,
// после входа следующего человека оживают — одно «назад», и на экране карточка,
// которую смотрел предыдущий. Нонс живёт в sessionStorage: переживает
// перезагрузку (тот же человек, его записи работают), но снимается при выходе —
// значит записи прошлого сеанса опознаются и гасятся, а не открываются.
const SID_KEY = 'milena-nav-sid';
function navSid() {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) { s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(SID_KEY, s); }
    return s;
  } catch (e) { return 'nosid'; }     // приватный режим без хранилища — деградируем до «своя/чужая»
}
const navState = () => ({ own: 1, sid: navSid() });
function syncHash(push) {
  if (!store.me()) return;                                 // см. applyHash
  const h = hashFor(curScreen);
  if (!h) return;
  // Адрес уже верный — но пометку всё равно ставим, если её нет. Иначе запись,
  // на которую человек попал по УЖЕ каноническому адресу (набрал руками, открыл
  // присланную ссылку, достал из закладок), навсегда оставалась «чужой» и
  // переживала выход: следующий на общем компьютере двумя «назад» доставал из
  // строки карточку предыдущего. Раз экран показан вошедшему — запись его.
  if (h === location.hash) { if (history.state?.sid !== navSid()) histSafe(() => history.replaceState(navState(), '', h)); return; }
  if (push) location.hash = h;
  // Помечаем запись истории как СВОЮ: адрес в ней написала программа, а не человек
  // по присланной ссылке. На экране входа это единственный способ их различить —
  // свою гасим (следующий не должен приземлиться на экран предыдущего), чужую
  // бережём: ради неё всё и делалось.
  // Голый фрагмент, а не pathname+search+h: строка вида «//что-то» (сервер отдаёт
  // index.html на любой путь) стала бы протокол-относительным адресом, и
  // replaceState бросил бы SecurityError прямо из go(). Фрагмент резолвится от
  // текущего адреса, путь и query сохраняются, origin сменить нечем.
  histSafe(() => history.replaceState(navState(), '', h));
}
// Ответ на смену адреса: «назад»/«вперёд», открытая ссылка, ручная правка строки.
// Замка от собственного hashchange нет намеренно — вместо него проверка «мы уже
// там»: она не зависит от того, в каком порядке браузер разложит события.
function applyHash() {
  // До входа ЧУЖОЙ адрес не трогаем: Милена шлёт Алёне #/grafik/2026-07, та
  // открывает его с экрана входа — перепиши мы адрес по curScreen прошлого
  // сеанса, и после входа Алёна попала бы не туда. Ссылку разберёт enter().
  // А вот СВОЮ старую запись (вышли и нажали «назад») гасим: компьютер общий,
  // и следующий вход не должен приземляться на экран предыдущего человека.
  if (!store.me()) {
    if (history.state?.own && location.hash) clearHash();
    return;
  }
  // Запись ПРОШЛОГО сеанса (человек вышел, вошёл следующий — нонс уже другой).
  // Не переходим: иначе одно «назад» открывало бы экран и карточку предыдущего.
  // Гасим её по пути, так что след стирается сам, пока по нему идут назад.
  if (history.state?.own && history.state.sid !== navSid()) return syncHash(false);
  // Открытая форма и «назад». Правило берём то же, что уже действует для Escape и
  // клика по фону (dataset.guard): обычную форму закрыть можно, форму с деньгами —
  // нет. Иначе «назад» унёс бы экран из-под неё вместе с незаконченным вводом —
  // суммой, сверенной с бумажки, пока экран телефона гас по автоблокировке.
  // Второй слой — это подтверждение поверх формы, его тоже держим.
  if (modalOpen()) {
    // Отказ восстанавливает адрес ПУШЕМ (syncHash(true)), а не заменой и не
    // history.forward(). Перебрали оба: forward() чинил «назад», но не спасал
    // набранный руками адрес (там стека «вперёд» нет — и строка врала навсегда,
    // а авто-перезагрузка уносила в чужой месяц); replaceState же затирал бы ту
    // запись, на которую браузер уже перешёл, и повторные «назад» молча съедали
    // стек, пока не выбрасывали из программы. Пуш не портит ни одной записи и
    // делает строку верной сразу. Цена — лишняя запись за отказ, то есть потом
    // одно холостое «назад»; это дешевле и потерянного ввода, и вранья в адресе.
    // Цикла нет: следующий hashchange увидит адрес уже каноническим.
    if (guardedModal()) { toast('Сначала завершите или отмените форму'); syncHash(true); return; }
  }
  const t = parseHash();
  if (!t || !allowedScreen(t.s)) return syncHash(false);   // чужой или мусорный адрес — вернуть строку к тому, что на экране
  const per = PERIOD_OF[t.s];
  const changedPeriod = !!(t.period && per && per.get() !== t.period);
  const sameCard = t.s !== 'card' || Number($('cardBody').dataset.emp) === t.id;
  // Экран уже такой — не трогаем его, но адрес приводим к каноническому виду.
  // Иначе #/grafik/2026-1 (месяц не по формату) молча теряет месяц, и в строке
  // остаётся месяц, которого на экране НЕТ, — а такую ссылку ещё и перешлют.
  // replaceState событий не порождает, зацикливания тут быть не может.
  if (t.s === curScreen && !changedPeriod && sameCard) return syncHash(false);
  // Неохраняемую форму закрываем только ЗДЕСЬ — когда переход точно состоится.
  // Закрой мы её раньше, мусорный или чужой адрес (и «мы уже тут» выше) сносил бы
  // диалог графика вместе с введённым, никуда не перейдя: «форма закрылась сама».
  if (modalOpen()) { closeModal(); closeModal2(); }
  if (changedPeriod) per.set(t.period);
  // Всюду ниже replace: запись в истории браузер уже завёл, второй раз не нужно.
  if (t.s === 'card') {
    if (!openCard(t.id, true)) { toast('Такой карточки нет', true); go('employees', true); }
    return;
  }
  go(t.s, true);
  // go() перерисовывает обзор/расчёт/оплаты/импорт сам, а график рисует refresh()
  // при входе — значит, месяц, пришедший адресом, дорисовываем здесь.
  if (t.s === 'schedule' && changedPeriod) renderSchedule();
}
window.addEventListener('hashchange', applyHash);

/* ── Кто в программе прямо сейчас (миграция 083) ────────────────────────
   Дарина 02.08: Милене надо видеть, кто онлайн, на каком экране и правит ли
   что-то; остальным — просто кто онлайн. Плюс предупреждение «эту же карточку
   уже открыли», как в гугл-доках.

   Отметка, а не живой канал (её решение): «была 4 минуты назад» полезнее
   зелёной точки, которая на плохом интернете мигает. Цена — задержка до
   полминуты, но НЕ для правок: открыли или закрыли форму — отмечаемся сразу,
   иначе предупреждение опаздывало бы ровно тогда, когда оно и нужно.

   Пока вкладка скрыта, не отмечаемся вовсе: «онлайн» с телефона в кармане —
   это ложь, а Милена по этому признаку решает, писать человеку или нет. */
const PRESENCE_EVERY = 30000;
let presence = { screen: null, period: null, editing: null };
let presenceTimer = null, presenceRows = [];
function presencePing() {
  if (!store.me() || document.visibilityState !== 'visible') return;
  presence.screen = curScreen;
  presence.period = PERIOD_OF[curScreen] ? PERIOD_OF[curScreen].get() : workPeriod;
  store.ping(presence);          // ошибки глотает сам store: присутствие не должно ронять работу
}
// Что человек держит открытым на правку. Ключ общий для всех: 'card:17',
// 'payroll:17:2026-07' — по нему и сверяем, не сидят ли двое в одном месте.
function setEditing(key) {
  if (presence.editing === (key || null)) return;
  presence.editing = key || null;
  presencePing();
  if (key) warnCoEdit(key);          // и сразу смотрим, не сидит ли тут кто-то ещё
}
/* Предупреждение «этим же сейчас занят кто-то ещё» — как в гугл-доках. Ставим
   ВНУТРЬ формы, а не тостом: тост исчезнет, а решать надо в момент сохранения.
   Список перечитываем при открытии и раз в 10 секунд, пока форма открыта: тот,
   кто открыл ПОСЛЕ нас, иначе остался бы незамеченным. Правки друг друга это не
   блокирует — программа не знает, кто прав; она лишь не даёт затереть молча. */
async function warnCoEdit(key) {
  await loadPresence();
  if (presence.editing !== key || !modalOpen()) return;
  const box = $('modalOv2').classList.contains('show') ? $('modalBox2') : $('modalBox');
  box.querySelector('.co-edit')?.remove();
  const кто = othersEditing(key).map(p => p.display_name).filter(Boolean);
  if (!кто.length) return;
  const first = box.querySelector('h3');
  // Формулировки без рода: в программе есть и мужчины, и женщины, а угадывать по
  // имени нельзя. «Кто сохранит последним» — и короче, и точнее описывает риск.
  // Текст одним <span>: во flex-контейнере <b> стал бы отдельным элементом, и
  // строка рвалась бы прямо посреди фразы, вокруг имени.
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
// Показ обновляем тем же тактом: у владельца — блок на «Обзоре», у остальных —
// строка в шапке. Каждый рисует только своё, лишних запросов нет.
function presenceRefreshUi() {
  if (!store.me()) return;
  if (isOwner()) { if (curScreen === 'overview') drawPresenceBlock(); }
  else drawPresenceTop();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') presenceStart();
  else clearInterval(presenceTimer);
});
// Кто ещё сидит на том же объекте. Протухшие вкладки (>2 мин) не считаем: человек
// давно ушёл, а предупреждение «её правит Алёна» пугало бы зря.
function othersEditing(key) {
  const me = store.me()?.id;
  return presenceRows.filter(p => p.editing === key && p.user_id !== me
    && p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000);
}
async function loadPresence() {
  try { presenceRows = await store.listPresence(); } catch (e) { presenceRows = []; }
  return presenceRows;
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
  // Адрес разбираем ДО refresh(): месяц из ссылки попадает в curPeriod раньше,
  // чем refresh() нарисует график, — иначе он сначала грузил бы текущий месяц, а
  // потом перерисовывался бы на нужный (два запроса и мигание чужого месяца).
  const t = parseHash();
  // Адрес, который писали МЫ ({own:1} переживает перезагрузку вместе с записью),
  // после РУЧНОГО входа не используем: страница могла перезагрузиться сама, или
  // сессия истекла за ночь — а за компьютером уже другой человек, и он не должен
  // приземляться на карточку предыдущего. Если сессия была жива и мы вошли без
  // формы (restoredSession) — это тот же человек, адрес его. Присланная ссылка
  // (state пуст) работает всегда: ради неё маршрутизация и делалась.
  const stale = !restoredSession && !!history.state?.own;
  const target = t && !stale && allowedScreen(t.s) ? t : null;   // ссылка на чужой экран (роль его не видит) — молча на свой
  if (target?.period && PERIOD_OF[target.s]) PERIOD_OF[target.s].set(target.period);
  await refresh();
  presenceStart();          // с этого момента остальные видят, что человек в программе
  if (target?.s === 'card') {
    if (openCard(target.id)) return;
    toast('Такой карточки нет', true);                 // ссылку прислали на удалённого/чужого — не молчим
    return go('employees');                            // звали к человеку — оставляем в списке людей, как и applyHash
  }
  if (target) return go(target.s);
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
  const cats = catsOrdered([...specialties.map(s => s.category), 'Прочие']);
  const opts = [{ v: '', label: 'Все отделения' }, ...cats.map(c => ({ v: c, label: c }))];
  const wire = (id, onPick) => { const el = $(id); if (el) makeDropdown(el, opts, el.dataset.value || '', onPick); };
  wire('empCat', () => renderEmployees($('empSearch').value || ''));
  wire('schedCat', () => drawSchedule());
  wire('payrollCat', () => drawPayroll($('payrollSearch')?.value || ''));
  // «без начисления» — только перерисовка, данные уже загружены
  if ($('payOnlyZero')) $('payOnlyZero').onchange = () => drawPayroll($('payrollSearch')?.value || '');
  // Один переключатель на два экрана: галочка ставится в обоих и переживает вход.
  ['payAZ', 'schedAZ'].forEach(id => { const el = $(id); if (el) { el.checked = sortAZ; el.onchange = () => setSortAZ(el.checked); } });
}
async function refresh() {
  const [sp, em, co] = await Promise.all([store.listSpecialties(), store.listEmployees(),
    // Порядок отделений — не критично: экран обязан собраться и без него.
    store.listCategoryOrder().catch(e => { console.warn('listCategoryOrder:', e); return []; })]);
  specialties = sp; employees = em;
  catOrder = new Map((co || []).map(r => [r.category, r.sort]));
  fillCatSelects();
  renderEmployees($('empSearch').value || '');
  renderSpecs();
  renderSchedule();
  if (isOwner()) { renderRates($('rateSearch')?.value || ''); renderJournal(); }
}

/* ── сотрудники ── */
const specName = id => specialties.find(s => s.id === id)?.name || '—';
const specCat = id => specialties.find(s => s.id === id)?.category || 'Прочие';
// Человек может работать у нас на ДВУХ работах (employee.specialty_id_2,
// миграция 072). Фильтр по отделению обязан находить его по любой из них —
// иначе дежурант-врач пропадает из «Врачей», когда вторая работа в другой
// отделения, и наоборот. Группируется он при этом по ОСНОВНОМУ (specCat).
// picked=true — отделение выбрано явно: ищем по ЛЮБОЙ из работ, чтобы дежурант
// не пропадал из «Врачей». picked=false — рисуем все отделения подряд, и тогда
// человек должен попасть РОВНО в одну (свою основную), иначе задвоится в списке.
const inCat = (e, cat, picked) => picked
  ? (specCat(e.specialty_id) === cat || (e.specialty_id_2 != null && specCat(e.specialty_id_2) === cat))
  : specCat(e.specialty_id) === cat;
/* Шапка ЛЮБОГО окна про человека — одна на все окна, чтобы везде было одинаково:
   ФИО ЦЕЛИКОМ (с отчеством) + специальность + строка контекста. «Фамилия Имя»
   не показывает отчества, а однофамильцы различаются только им — в «Расчёте»
   этим подписывают выдачу денег, в графике так же легко отметить смену не тому.
   sub — ГОТОВЫЙ html (даты, <b>), экранирует его вызывающий; title — слово
   перед именем («Отпуск · …»). Специальности нет → specName даёт «—», такую
   строку не рисуем совсем, чтобы не занимать место прочерком. */
function personHead(e, sub, title = '') {
  const spec = e ? specName(e.specialty_id) : '—';
  return `<h3>${title ? esc(title) + ' · ' : ''}${esc((e && e.fio) || '')}</h3>
    ${spec !== '—' ? `<div class="msub">${esc(spec)}</div>` : ''}
    ${sub ? `<div class="msub">${sub}</div>` : ''}`;
}
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
    let list = all.filter(e => inCat(e, cat, !!catF) && String(e.fio || "").toLowerCase().includes(f));
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
// Возвращает false, если карточки с таким id нет: по ссылке #/kartochka/999
// роутеру нужно отличить «открыл» от «нечего открывать» и увести в список.
/* ПАНЕЛЬ ЧЕЛОВЕКА: расчёт и график того же месяца прямо в карточке, чтобы не
   ходить по трём экранам ради одного сотрудника (просьба Дарины 01.08).
   Месяц берём ОБЩИЙ (PERIOD_OF.card = payPeriod): панель и «Расчёт» обязаны
   показывать одно и то же, иначе человек сверял бы разные числа.
   Правки — те же функции, что и в окне «Расчёта» (editPayout/editSalary), а не
   их копии: две реализации правки денег разошлись бы на первой же доработке. */
async function loadCardPanel(id) {
  const box = $('cardPanel'); if (!box || !isStaff()) return;
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
  if (+$('cardBody').dataset.emp !== id) return;      // пока грузили, открыли другого
  if (!r) { box.innerHTML = ''; return; }

  const my = linesForRow(r, (lines || []).filter(l => l.employee_id === id));
  // процентник: ЗП = % × выручка. Выручку вводят руками, и именно её Дарина
  // заполняет по вечерам — поле должно быть здесь, а не только в окне «Расчёта».
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
      <div class="me-row me-sum me-earned"><span>Всего заработано</span><b class="money">${rub(earned(r))} ₽</b></div>
      ${(r.card_avans_kop || r.card_rasch_kop || r.card_uvol_kop || r.otpusk_kop
        || r.bolnich_kop || r.cash_kop || r.cash_avans_kop || r.otpusk_cash_kop)
        ? '<div class="me-cap">Выдано</div>' : ''}
      ${payRow('Аванс на карту', r.card_avans_kop, 'card_avans', canEdit)}
      ${payRow('ЗП на карту', r.card_rasch_kop, 'card_rasch', canEdit)}
      ${payRow('Расчёт на карту (увольнение)', r.card_uvol_kop, 'card_uvol', canEdit)}
      ${payRow('Отпускные на карту', r.otpusk_kop, 'otpusk', canEdit)}
      ${payRow('Больничные на карту', r.bolnich_kop, 'bolnich', canEdit)}
      ${payRow('Наличными', r.cash_kop, 'cash', canEdit)}
      ${payRow('Аванс наличными', r.cash_avans_kop, 'cash_avans', canEdit)}
      ${payRow('Отпускные наличными', r.otpusk_cash_kop, 'otpusk_cash', canEdit)}
      ${cardTotal(r) ? `<div class="me-row me-sum me-card"><span>Всего на карту</span><b class="money">${rub(cardTotal(r))} ₽</b></div>` : ''}
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
  // клетка графика: прошлое — факт, будущее — план, ровно как на экране «График».
  // scheduleRows/curPeriod синхронизируем, потому что попапы читают именно их.
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
  payPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = payPeriod;
  loadCardMoney(id); loadCardPanel(id);
}

/* Переходы между экранами ПО ОДНОМУ ЧЕЛОВЕКУ. Раньше, чтобы посмотреть одного
   сотрудника целиком, приходилось обойти четыре экрана и в каждом искать его по
   имени заново. Теперь достаточно кнопки: экран открывается уже отфильтрованным
   по нему. Фильтр ставим в то же поле поиска, которым пользуется человек, —
   чтобы было видно, ПОЧЕМУ в списке одна строка, и легко сбросить. */
let cardFrom = null;   // экран, с которого открыли карточку — туда и вернёт «назад»
function focusOn(screen, empId) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const key = String(e.fio || '').split(' ')[0];      // фамилии достаточно и она не ломает поиск пробелами
  cardFrom = curScreen;                               // чтобы «назад» вернул туда, откуда пришли
  closeModal();
  if (screen === 'schedule') { const i = $('schedSearch'); if (i) i.value = key; }
  if (screen === 'payroll')  { const i = $('payrollSearch'); if (i) i.value = key; }
  if (screen === 'employees'){ const i = $('empSearch'); if (i) i.value = key; }
  go(screen);
  if (screen === 'schedule') renderSchedule();
  if (screen === 'employees') renderEmployees(key);
}

/* С КАКОГО ЧИСЛА действует ставка — в самой карточке. Без этого не видно
   главного: Дарина убрала Санниковой оклад, закрыв его августом, а он весь июль
   продолжал действовать — в расчёте так и стояла строка «оклад», и понять почему
   можно было только запросом к базе.
   valid_to — дата, ПЕРЕД которой строка перестаёт действовать, поэтому в тексте
   показываем предыдущий день: «по 31.07», а не «по 01.08» — иначе читается как
   «работала первого августа».
   valid_to = valid_from значит, что строка не действовала ни дня: так выглядит
   отмена только что заведённого. Пишем «аннулирована», как и журнал ставок. */
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
      ${canEditCards() ? `<button class="btn btn-ghost btn-sm" id="editEmpBtn">${ICONS.edit}Редактировать</button><button class="btn btn-ghost btn-sm" id="archiveEmpBtn">${e.status === 'active' ? 'В архив' : 'Из архива'}</button>` : `<span class="tag">${ICONS.lock} правит владелец</span>`}
    </div></div>
    <div class="grid2">
      <div class="card cardpad"><div class="caps" style="margin-bottom:12px">Строки начисления</div>${lines}${oldLines ? `<div class="caps" style="margin:16px 0 6px">История ставок</div>${oldLines}` : ''}</div>
      <div class="card cardpad">
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
      ${isStaff() ? `<div class="me-add" style="margin-top:12px">
        <input class="input" id="noteInput" placeholder="добавить заметку к карточке…" autocomplete="off" maxlength="4000">
        <button class="btn btn-primary btn-sm" id="noteAdd">${ICONS.plus}Добавить</button>
      </div>` : ''}
    </div>`;
  $('cardBody').dataset.emp = id;      // чья карточка сейчас открыта — чтобы
  applyIcons($('cardBody'));           // поздний ответ по деньгам не лёг в чужую
  const eb = $('editEmpBtn'); if (eb) eb.onclick = () => employeeForm(e);
  const ab = $('archiveEmpBtn'); if (ab) ab.onclick = () => toggleArchive(e);
  // переходы из карточки: тот же человек, но в расчёте или в графике —
  // чтобы не возвращаться в список и не искать его заново
  const cp = $('cardToPay'); if (cp) cp.onclick = () => { focusOn('payroll', id); setTimeout(() => payrollDialog(id), 350); };
  const cs2 = $('cardToSched'); if (cs2) cs2.onclick = () => focusOn('schedule', id);
  go('card', replace);                 // адрес карточки берётся из dataset.emp выше
  loadCardMoney(id);
  loadCardPanel(id);
  loadCardNotes(id);
  return true;
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
        <span class="mini-chip">Начислено${r.flag_manual_salary ? ' (вручную)' : ''}: <b>${rub(r.salary_kop)} ₽</b></span>
        ${cardDelta(r) ? `<span class="mini-chip">Карта: <b>${rub(cardDelta(r))} ₽</b></span>` : ''}
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
  // Сдельно: поля ставки нет намеренно. Была бы сумма и здесь, и в «Финальной
  // сумме вручную» — стало бы два источника правды и вечный вопрос, какой верен.
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
  // Сдельно — единственный вид БЕЗ суммы. Чистим все три поля, чтобы в базу не
  // уехал хвост от прежнего вида оплаты: rate_line_kind_amount_chk (055) требует
  // у «сдельно» ровно пустые amount/amount_night/percent.
  if (l.pay_kind === 'сдельно') { l.amount = null; l.amount_night = null; l.percent = null; return l; }
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
    modalOnClose2 = () => resolve(false);          // крестик/Escape = «Исправить»
    $('baNo').onclick = () => { resolve(false); closeModal2(); };
    $('baYes').onclick = () => { resolve(true); closeModal2(); };
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
    modalOnClose2 = () => resolve(false);          // крестик/Escape = «Исправить»
    $('phNo').onclick = () => { resolve(false); closeModal2(); };
    $('phYes').onclick = () => { resolve(true); closeModal2(); };
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
    // Две защиты, и обе нужны. guard — как у остальных денежных форм: не даёт
    // закрыть окно случайным Escape, кликом по фону и «назад» (маршрутизация
    // спрашивает именно его). modalOnClose ниже — страховка на всё остальное
    // (крестик): без неё resolve не позвался бы, await в doImportLoad висел бы
    // вечно, и экран импорта остался бы «в процессе» до перезагрузки.
    $('modalBox').dataset.guard = '1';
    modalOnClose = () => resolve(false);           // крестик/Escape = «Отмена»
    $('ilNo').onclick = () => { resolve(false); closeModal(); };
    $('ilYes').onclick = () => { resolve(true); closeModal(); };
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
  // Ключ правки: по нему другие увидят «эту же карточку сейчас открыли».
  setEditing(e ? 'card:' + e.id : 'card:new');
  const so = specialties.map(s => `<option value="${s.id}" ${e?.specialty_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  // Дежурство — ВТОРАЯ специальность. Пустая строка первой: у большинства
  // дежурства нет, и поле должно оставаться пустым по умолчанию.
  const so2 = `<option value="">— нет —</option>` +
    specialties.map(s => `<option value="${s.id}" ${e?.specialty_id_2 === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  showModal(`<h3>${e ? 'Редактировать карточку' : 'Новая карточка'}</h3><div class="msub">${ICONS.lock} ФИО, телефон и ставки заводит владелец — изменения попадут в журнал</div>
    <label class="flbl">ФИО</label><input class="input" id="mFio" value="${esc(e?.fio || '')}" placeholder="Фамилия Имя Отчество">
    <div class="frow"><div><label class="flbl">Специальность</label>
      <div class="sp-pick"><select class="input" id="mSpec">${so}</select>
        <button class="btn btn-ghost btn-sm" id="mSpecNew" type="button" title="Завести новую специальность">${ICONS.plus}</button></div></div>
    <div><label class="flbl">Должность</label><input class="input" id="mPos" value="${esc(e?.position === FIO_SENTINEL ? '' : (e?.position || ''))}" placeholder="напр. Заведующий"></div></div>
    <!-- Милена 06.08: «Бухгалтер записан врачом. Я полезла редактировать, а там нет
         возможности добавить название». Справочник правился ТОЛЬКО на отдельном
         экране «Специальности» — то есть посреди правки карточки надо было уйти,
         завести, вернуться и начать заново. Заводим прямо здесь, без вложенного
         окна: модалка тут уже открыта, вторая поверх неё стёрла бы первую. -->
    <div class="sp-new" id="mSpecNewBox" hidden>
      <input class="input" id="mSpecName" placeholder="название, напр. Бухгалтер">
      <input class="input" id="mSpecCat" list="catlist2" placeholder="отделение">
      <datalist id="catlist2">${[...new Set(specialties.map(s => s.category))].map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
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
  $('modalBox').dataset.guard = '1';   // карточку не закрывать случайным кликом по фону / Escape — потеря ввода
  const box = $('mLines');
  const init = e ? activeLines(e) : [null];
  (init.length ? init : [null]).forEach(l => { box.insertAdjacentHTML('beforeend', lineBlockHtml(l)); wireLineBlock(box.lastElementChild, l); });
  $('mAddLine').onclick = () => { box.insertAdjacentHTML('beforeend', lineBlockHtml(null)); wireLineBlock(box.lastElementChild, null); };
  // Новая специальность прямо из карточки. Форму НЕ перерисовываем — введённое
  // (ФИО, телефон, строки начисления) осталось бы в старом DOM и пропало; просто
  // дописываем вариант в список и сразу его выбираем.
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
      specialties.push(sp);                       // список в памяти — чтобы и «Вторая работа» его увидела
      for (const id of ['mSpec', 'mSpec2']) {
        const sel = $(id); if (!sel) continue;
        sel.insertAdjacentHTML('beforeend', `<option value="${sp.id}">${esc(sp.name)}</option>`);
      }
      $('mSpec').value = String(sp.id);           // ради чего и заводили — сразу ставим человеку
      $('mSpecNewBox').hidden = true; $('mSpecName').value = ''; $('mSpecCat').value = '';
      fillCatSelects();                           // фильтры по отделениям на других экранах
      toast(ICONS.check + 'Добавлено: ' + esc(name));
    } catch (err) { toast(err.message || err, true); }
    finally { btn.disabled = false; }
  };
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
      const patch = { fio, position: $('mPos').value.trim(), phone: phoneNorm || null,
        specialty_id: +$('mSpec').value || null, specialty_id_2: +$('mSpec2').value || null, hired_on, left_on };
      const lines = collectLines(box);
      // Крупная ставка в карточке → тоже переспросить, не опечатка ли.
      const big = bigAmounts(lines);
      if (big.length && !(await confirmBigAmounts(big))) { btn.disabled = false; return; }
      // Появились НОВЫЕ строки ставки — спрашиваем, с какого месяца они действуют.
      // Существующие (_keep) не трогаем: у них своя дата начала.
      const fresh = (lines || []).filter(l => !l._keep);
      const removed = e ? activeLines(e).length - (lines || []).filter(l => l._keep).length : 0;
      let vfrom = null;
      if (fresh.length || removed > 0) {
        vfrom = await rateStartDialog(fresh, removed);
        if (!vfrom) { btn.disabled = false; return; }
      }
      if (e) { await store.updateEmployee(e.id, patch, lines, vfrom); toast(ICONS.check + 'Карточка обновлена — изменения в журнале'); }
      else { await store.createEmployee({ ...patch, lines, valid_from: vfrom }); toast(ICONS.check + 'Карточка создана: ' + esc(fio.split(' ')[0])); }
      closeModal(); await refresh(); if (e) openCard(e.id);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

/* ── специальности ── */
/* Справочник был показом: завести можно, переименовать — нет. Дарина 06.08:
   «треба зробити також щоб це можна було редагувати в спеціальностях» (повод —
   «Психолог-психотерапевт», которого хотят звать просто «Психолог»).
   Право в базе уже есть (политика spec_update, owner+ceo) — не хватало экрана. */
function canEditSpecs() { return ['owner', 'ceo'].includes(store.me()?.role); }
/* Порядок отделений (088). Отделение без строки в справочнике порядка уходит в
   конец — так же, как её отсортировала бы база. */
let catOrder = new Map();
function catSort(c) { return catOrder.has(c) ? catOrder.get(c) : 9999; }
function catsOrdered(list) {
  return [...new Set(list)].sort((a, b) => catSort(a) - catSort(b) || a.localeCompare(b, 'ru'));
}
/* Справочник группами: отделение — заголовок, под ним его специальности.
   Стрелками двигаются и отделения, и специальности внутри отделения: Дарина
   просила править «порядок видачі відділень ТА спеціальностей» — это две разные
   очереди, и на экранах они применяются вместе. */
function renderSpecs() {
  const ed = canEditSpecs();
  const cats = catsOrdered(specialties.map(s => s.category));
  const cnt = id => employees.filter(e => e.status !== 'archived' && e.specialty_id === id).length;
  const arrow = (dir, kind, key, off) => `<button class="sp-mv" data-mv="${kind}" data-key="${esc(String(key))}" data-d="${dir}"${off ? ' disabled' : ''} title="${dir < 0 ? 'Выше' : 'Ниже'}" type="button">${dir < 0 ? '↑' : '↓'}</button>`;
  $('specList').innerHTML = cats.map((c, ci) => {
    const inCat = specialties.filter(s => s.category === c)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, 'ru'));
    return `<div class="sp-cat">
        <span class="sp-cat-name${ed ? ' sp-cat-tap' : ''}"${ed ? ` data-cat="${esc(c)}" title="Переименовать отделение"` : ''}>${esc(c)}${ed ? ` <span class="me-pen">${ICONS.pencil || '✎'}</span>` : ''}</span>
        <span class="muted small">${inCat.length}</span>
        ${ed ? `<span class="sp-mvs">${arrow(-1, 'cat', c, ci === 0)}${arrow(1, 'cat', c, ci === cats.length - 1)}</span>` : ''}
      </div>` +
      inCat.map((s, i) => `<div class="line-row sp-row${ed ? ' sp-tap' : ''}"${ed ? ` data-spec="${s.id}" title="Переименовать или перенести в другое отделение"` : ''}>
        <div style="font-weight:700">${esc(s.name)}</div>
        ${cnt(s.id) ? `<span class="muted small" style="margin-left:8px">${cnt(s.id)} чел</span>` : ''}
        ${ed ? `<span class="sp-mvs" style="margin-left:auto">${arrow(-1, 'spec', s.id, i === 0)}${arrow(1, 'spec', s.id, i === inCat.length - 1)}</span>
        <span class="me-pen">${ICONS.pencil || '✎'}</span>` : ''}</div>`).join('');
  }).join('') || '<div class="empty">Справочник пуст</div>';
  applyIcons($('specList'));
  if (!ed) return;
  $('specList').querySelectorAll('.sp-tap[data-spec]').forEach(el => {
    el.onclick = () => specForm(specialties.find(s => s.id === +el.dataset.spec));
  });
  $('specList').querySelectorAll('.sp-cat-tap[data-cat]').forEach(el => {
    el.onclick = e => { e.stopPropagation(); catForm(el.dataset.cat); };
  });
  // stopPropagation: стрелка лежит ВНУТРИ кликабельной строки, иначе поверх
  // перестановки открывалась бы ещё и форма переименования.
  $('specList').querySelectorAll('.sp-mv').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    if (b.disabled) return;
    b.disabled = true;
    try { await moveSpec(b.dataset.mv, b.dataset.key, +b.dataset.d); }
    catch (err) { toast(err.message || err, true); b.disabled = false; }
  });
}
/* Переименование отделения. Своей строки у отделения нет — это текст в каждой
   специальности, поэтому правка задевает их все разом. Пишем это словами: люди
   переименовывают «Психологов», не задумываясь, что под ними пять специальностей. */
function catForm(cat) {
  const inCat = specialties.filter(s => s.category === cat);
  const others = [...new Set(specialties.map(s => s.category))].filter(c => c !== cat);
  showModal(`<h3>Отделение</h3>
    <div class="msub">Поменяется у всех специальностей этого отделения — сейчас их ${inCat.length}:
      ${inCat.map(s => esc(s.name)).join(', ')}</div>
    <label class="flbl">Название</label><input class="input" id="mCn" value="${esc(cat)}">
    <div class="msub" id="mCnWarn" style="margin-top:8px"></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="mSave">${ICONS.check}Сохранить</button></div>`);
  const inp = $('mCn');
  // Совпало с существующим — это не ошибка, а слияние отделений. Но сказать надо
  // ДО нажатия: иначе человек нажмёт «Сохранить» и увидит, что отделений стало меньше.
  const warn = () => {
    const v = inp.value.trim();
    $('mCnWarn').innerHTML = (v && others.some(c => c.toLowerCase() === v.toLowerCase()))
      ? `<div class="rc-warn">${ICONS.lock} Отделение <b>${esc(v)}</b> уже есть — они <b>объединятся</b> в одно.</div>` : '';
  };
  inp.oninput = warn; warn();
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const v = inp.value.trim(); if (!v) { inp.focus(); return; }
    if (v === cat) { closeModal(); return; }
    btn.disabled = true;
    try { const n = await store.renameCategory(cat, v); closeModal(); toast(ICONS.check + `Отделение переименовано (${n})`); await refresh(); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
/* Перестановка соседей. Меняем не два номера, а переписываем ПОЗИЦИИ всему
   списку. Обмен двух номеров выглядит экономнее, но не работает, когда номера
   равны — а именно так и есть в жизни: у отделений порядка ещё нет вовсе
   (все 9999), у старых специальностей sort=0 у всех. Тогда «поменять местами»
   меняет 0 на 0, и кнопка молча ничего не делает (поймано прогоном).
   Списки короткие — отделений девять, специальностей в отделении единицы. */
async function moveSpec(kind, key, dir) {
  const moved = (arr, i) => {                       // переставить элемент i на i+dir
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return null;
    const out = arr.slice(); [out[i], out[j]] = [out[j], out[i]]; return out;
  };
  if (kind === 'cat') {
    const cats = catsOrdered(specialties.map(s => s.category));
    const out = moved(cats, cats.indexOf(key));
    if (!out) return;
    await store.setCategoryOrder(out.map((c, i) => ({ category: c, sort: (i + 1) * 10 })));
  } else {
    const s = specialties.find(x => x.id === +key);
    if (!s) return;
    const inCat = specialties.filter(x => x.category === s.category)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, 'ru'));
    const out = moved(inCat, inCat.indexOf(s));
    if (!out) return;
    await store.setSpecialtySort(out.map((x, i) => ({ id: x.id, sort: i })));
  }
  await refresh();
}
/* Одна форма на «завести» и «переименовать»: поля те же, различие — в заголовке
   и в том, какой метод store зовём. */
function specForm(s) {
  const cats = [...new Set(specialties.map(x => x.category))];
  const used = s ? employees.filter(e => e.status !== 'archived' && e.specialty_id === s.id).length : 0;
  showModal(`<h3>${s ? 'Специальность' : 'Новая специальность'}</h3>
    <div class="msub">${s ? 'Название и отделение поменяются у всех, кому она стоит' + (used ? ` — сейчас это ${used} чел` : '') + '. Изменение попадёт в журнал.'
                        : 'Добавится в справочник и группировку'}</div>
    <label class="flbl">Название</label><input class="input" id="mSn" placeholder="напр. Невролог" value="${esc(s?.name || '')}">
    <label class="flbl">Отделение</label><input class="input" id="mSc" list="catlist" placeholder="Врачи / Средний персонал / своё…" value="${esc(s?.category || '')}"><datalist id="catlist">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="mCancel">Отмена</button><button class="btn btn-primary btn-sm" id="mSave">${s ? ICONS.check + 'Сохранить' : ICONS.plus + 'Добавить'}</button></div>`);
  $('mCancel').onclick = closeModal;
  $('mSave').onclick = async () => {
    const btn = $('mSave'); if (btn.disabled) return;
    const n = $('mSn').value.trim(); if (!n) { $('mSn').focus(); return; }
    const c = $('mSc').value.trim() || 'Прочие';
    if (s && n === s.name && c === s.category) { closeModal(); return; }   // ничего не меняли — не сорим в журнале
    btn.disabled = true;
    try {
      if (s) { await store.updateSpecialty(s.id, n, c); toast(ICONS.check + 'Сохранено: ' + esc(n)); }
      else   { await store.addSpecialty(n, c);          toast(ICONS.check + 'Добавлено: ' + esc(n)); }
      closeModal(); refresh();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}

/* ── график: сетка месяц × сотрудники (operator + owner) ── */
const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
// schedShown — месяц, который РЕАЛЬНО нарисован (в отличие от curPeriod = который
// хотели). Та же пара, что payrollShown/payPeriod и patShown/patPeriod.
// TODO(осознанно отложено, MED — дефект НЕ этой задачи, он старше): пока месяц
// грузится, curPeriod уже новый, а сетка на экране старая. cellDate() и pastDay()
// берут curPeriod — значит клик по клетке в этом окне (RTT до базы) уходит в
// НОВЫЙ месяц, хотя человек видит старый. Приходит и от ‹/›, и от адреса.
// Лечится тем, что рисовать и кликать надо по schedShown, а не по curPeriod —
// это правка логики клика по клеткам, то есть самого денежного места экрана;
// делать её заодно с маршрутизацией опаснее, чем отдельно и с проверкой.
let curPeriod = null, schedShown = null, scheduleRows = [], shiftKinds = [], schedSeq = 0;
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
// 1-е число СЛЕДУЮЩЕГО месяца, 'YYYY-MM-DD'. Нужен, чтобы сравнивать период со
// ставками так же, как это делает база: `valid_from < period + interval '1 mon'`.
// ISO-даты сравниваются лексикографически — это и есть сравнение по дате.
const nextPeriodStart = p => { let [y, m] = p.split('-').map(Number); if (++m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0') + '-01'; };
const cellDate = day => curPeriod + '-' + String(day).padStart(2, '0');
const cellOf = (empId, day, pos = 'main') => scheduleRows.find(s => s.employee_id === empId && s.work_date === cellDate(day) && (s.position || 'main') === pos);
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
function shiftPayMonth(delta) { let [y, m] = payPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } payPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = payPeriod; syncHash(false); }
function shiftMonth(delta) { let [y, m] = curPeriod.split('-').map(Number); m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } curPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = curPeriod; syncHash(false); renderSchedule(); }
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
// Дежурство читается БУКВОЙ, а не часом начала: смен там всего три, и «Н/С/—»
// с одного взгляда отличимы, тогда как «18» и «8» глаз путает с обычной сменой.
/* ── САНИТАРКИ: смена оплачивается СУММОЙ, а не часами ──────────────────────
   Сумма зависит от локации, поэтому живёт в самой клетке (schedule.amount_kop,
   миграция 074), а не в ставке человека: ставка одна на все смены, а тут у
   каждого дня своя. Клик листает три ходовые суммы, своя — правой кнопкой или
   долгим нажатием (на телефоне правой кнопки нет).
   ⚠ Суммы пока зашиты здесь. Дарина просила вынести их в настройку отдельной
   задачей — «спочатку ввести це, а потім думати як змінювати в майбутньому». */
const SAN_AMOUNTS = [230000, 320000, 370000, 450000, 505000];    // 2300 / 3200 / 3700 / 4500 / 5050 ₽
/* Кому клетка платит суммой. Правило выведено из ДАННЫХ, а не из должности: у
   всех шестерых санитарок основная специальность «Санитарка», но у Казаковой и
   Мазур есть ещё и оклад — их основная работа считается по нему как раньше, а
   санитарные смены идут второй строкой. Значит: основная строка платит суммой,
   только если оклада нет; вторая строка — если вторая работа санитарская. */
function isAmountCell(e, pos) {
  if (!e) return false;
  const san = id => /санитар/i.test(specName(id));
  if (pos === 'second') return san(e.specialty_id_2);
  if (!san(e.specialty_id)) return false;
  return !activeLines(e).some(l => l.pay_kind === 'оклад');
}
const rubShort = kop => (kop / 100).toLocaleString('ru-RU');
/* Клик по клетке отвечает МГНОВЕННО: рисуем новое значение сразу, запрос уходит
   следом. Раньше ждали ответа сервера и потом перезагружали ВЕСЬ график — 119
   человек x 31 день из базы после каждого клика; на небыстром интернете это
   секунда с лишним ожидания на каждую клетку, а проставлять их надо десятками.
   Если запись не прошла — возвращаем прежнее значение и говорим об этом вслух:
   молча показывать несохранённое нельзя, это деньги. */
function paintAmountCell(empId, day, pos, kop) {
  const sel = `.gr-cell[data-emp="${empId}"][data-day="${day}"]` +
    (pos === 'second' ? '[data-pos="second"]' : ':not([data-pos="second"])');
  const el = document.querySelector(sel);
  if (!el) return;
  const i = kop ? SAN_AMOUNTS.indexOf(kop) : -1;
  el.innerHTML = kop ? `<span class="amt-v a${i < 0 ? 'x' : i}">${esc(rubShort(kop))}</span>` : '';
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
/* Хвост «суммовой» строки. Часов у таких смен нет вовсе, поэтому «Смен 0 / Факт 0ч»
   было бы не нулём работы, а неверным вопросом: считаем смены С СУММОЙ и их сумму
   за месяц. Пересчитывается на лету при каждом клике — Дарина просила, чтобы итоги
   не ждали перезагрузки. */
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
  // цикл: 3200 -> 3700 -> 5050 -> пусто -> 3200
  const next = at < 0 ? SAN_AMOUNTS[0] : (at + 1 < SAN_AMOUNTS.length ? SAN_AMOUNTS[at + 1] : null);
  const bare = !cur || (!cur.plan_kind && (cur.fact ?? null) === null);   // в клетке была только сумма
  const patch = next == null && bare
    ? { plan_kind: null, plan_start: null, fact: null, amount_kop: null }   // убрать клетку целиком
    : { amount_kop: next };                                                // тронуть только деньги
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
/* Своя сумма — правой кнопкой или долгим нажатием. */
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
    // «Убрать» на клетке, где кроме суммы ничего не было, чистит её целиком;
    // если под суммой стоит настоящая смена — снимаем только деньги.
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
function schedCellInner(c, past, pos = 'main') {                   // содержимое клетки: план (мини) + факт (цвет)
  const p = c && c.plan_kind, fx = c ? (c.fact ?? null) : null;
  // Санитарская смена: в клетке ДЕНЬГИ, а не часы. Показываем их и выходим —
  // ни плана, ни факта у такой смены нет, сумма и есть всё содержимое.
  if (c && c.amount_kop) {
    const i = SAN_AMOUNTS.indexOf(c.amount_kop);
    return `<span class="amt-v a${i < 0 ? 'x' : i}">${esc(rubShort(c.amount_kop))}</span>`;
  }
  if (!p && fx === null) return '';
  if (pos === 'second') {
    const L = SECOND_LETTER[p] || (p ? cellText(c) : '');
    return `<span class="iv mini sec-l${p === 'absent' ? ' miss' : ''}">${esc(L)}</span>`;
  }
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
// Нормы часов месяца: employee_id → {hours, is_manual, week_hours, calendar_hours}.
// Считает БАЗА (v_month_norm, migrations/056): норма = ручное переопределение,
// иначе производственный календарь РФ по типу недели из карточки. Одним запросом
// на месяц, а не вызовом функции на каждого из 119 человек.
let monthNorms = new Map();
// renderSchedule — грузит данные месяца из сети, затем рисует. drawSchedule — только рисует
// из уже загруженных scheduleRows + текущих фильтров (мгновенно, без сети → без гонок/мерцания).
async function renderSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  if (!curPeriod) curPeriod = nowPeriod();
  // Гасим сетку при СМЕНЕ месяца. Пока грузится новый, на экране висели клетки
  // старого — а cellDate() и pastDay() уже отдают НОВЫЙ месяц, и тап по такой
  // клетке писал факт не в тот месяц молча. Убираем сами кликабельные клетки,
  // не трогая логику клика (см. TODO у schedShown). При обновлении ТОГО ЖЕ месяца
  // (после каждой правки) не гасим: моргало бы и сбрасывался горизонтальный
  // скролл на 31 колонке — та же причина, что у «Расчёта».
  if (schedShown !== curPeriod) { $('scheduleGrid').innerHTML = '<div class="empty">Загружаем график…</div>'; if ($('mLabel')) $('mLabel').textContent = periodLabel(curPeriod); }
  const seq = ++schedSeq;                 // защита от гонки: быстрое переключение месяцев даёт несколько запросов
  try {
    const [rows, kinds, closed, norms] = await Promise.all([store.listSchedule(curPeriod), store.listShiftKinds(), store.listClosedDays(curPeriod),
      store.listMonthNorms(curPeriod).catch(e => { console.warn('listMonthNorms:', e); return []; })]);   // норма — не критично: график должен открыться и без неё
    if (seq !== schedSeq) return;         // ответ пришёл не для текущего запроса — отбрасываем (иначе чужой месяц перетрёт)
    // Общие переменные пишем ОДНИМ куском и только ПОСЛЕ await, между ними ничего
    // не вставляем. Когда-то здесь стоял второй запрос (ретро-правки), а
    // scheduleRows присваивались ДО него: проигравший гонку запрос успевал положить
    // туда СВОЙ месяц и уйти по seq-гарду, а schedShown оставался старым. Откат по
    // ошибке рисовал старый месяц чужими строками — сетка выходила ПУСТОЙ, и
    // владелец «дозаполнял» месяц, который на самом деле полон.
    scheduleRows = rows; shiftKinds = kinds; closedDays = new Set(closed);
    monthNorms = new Map((norms || []).map(n => [n.employee_id, n]));   // сюда же: то же правило «после последнего await»
    schedShown = curPeriod;
    drawSchedule();
  } catch (e) {
    if (seq !== schedSeq) return;
    toast('Не удалось загрузить график: ' + (e.message || e), true);
    // Откатываем curPeriod к нарисованному месяцу. Иначе на экране остаётся старая
    // сетка со старой шапкой, а curPeriod уже новый — и клик по клетке записал бы
    // факт В ДРУГОЙ МЕСЯЦ молча (cellDate() берёт именно curPeriod). Это тот самый
    // случай, ради которого у «Расчёта» когда-то завели отдельный период. Заодно
    // перестаёт врать адрес: он теперь называет месяц вслух и его пересылают.
    if (schedShown && schedShown !== curPeriod) { curPeriod = schedShown; workPeriod = curPeriod; drawSchedule(); syncHash(false); }
  }
}
function drawSchedule() {
  if (!isStaff() || !$('scheduleGrid')) return;
  // Тот же замок, что у drawPayroll: в scheduleRows лежит месяц schedShown. Пока
  // грузится ДРУГОЙ — рисовать нечем, и без этой строки поиск, выбор отделения или
  // галочка сортировки нарисовали бы клетки старого месяца под шапкой нового, а
  // тап по такой клетке пишет факт в новый месяц. renderSchedule зовёт нас уже
  // после присвоения schedShown, откат по ошибке — тоже, так что им замок не мешает.
  if (!schedShown || schedShown !== curPeriod) return;
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
  // Тип недели живёт в карточке (employee.week_hours), а карточку правят владелец и
  // СЕО (RLS emp_update, 035). Показываем «клик» ровно тем, кого пустит база —
  // иначе Алёна тыкала бы в поле и получала отказ.
  const canEditNorm = ['owner', 'ceo'].includes(meRole);
  const todayD = (nowPeriod() === curPeriod) ? mskNow().getUTCDate() : 0;
  const active = employees.filter(e => e.status !== 'archived');
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];

  // фильтры (селекты заполняет fillCatSelects при загрузке данных — здесь только читаем)
  const f = ($('schedSearch')?.value || '').toLowerCase().trim();
  const catF = $('schedCat')?.dataset.value || '';

  // режим: оператор правит, владелец смотрит
  if ($('schedSub')) $('schedSub').textContent = editable ? 'Прошедшие дни — клик по клетке отмечает факт (часы / не вышел). Будущие — задать смену. Клик по имени — шаблон на месяц.' : 'Просмотр: план (серым) и факт (цветом). Расхождения факта с планом — справа и в шапке.';
  // Красного баннера «Правки после закрытия» здесь больше нет (Дарина 05.08:
  // «він тільки місце займає, а ніхто його не читає»). Ничего не потеряно: те же
  // записи лежат в Журнале под фильтром «Красные», и Обзор ведёт туда же кнопкой
  // в «Требует внимания». Баннер был третьей копией — самой слабой: обрезан на 8
  // строках, без фильтра и без перехода. Заодно ушёл лишний круг к серверу: он
  // грузился ОТДЕЛЬНЫМ запросом после общей пачки, при каждом открытии графика.
  if ($('schedNote')) {
    $('schedNote').innerHTML = editable ? '' : `<div class="readonly-note">${ICONS.lock} График ведёт оператор (Алёна). У вас — просмотр; закрытые дни можно править напрямую.</div>`;
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
  const byKey = new Map(scheduleRows.map(s => [s.employee_id + '|' + s.work_date + '|' + (s.position || 'main'), s]));
  const cget = (id, d, pos = 'main') => byKey.get(id + '|' + cellDate(d) + '|' + pos) || null;

  let head = '<div class="gr-corner">Сотрудник</div>';
  for (let d = 1; d <= nd; d++) {
    const { weekend, hol } = dayMark(d);
    // праздник важнее выходного (свой цвет и точка); today/dlock перебивают фон позже по CSS
    const mk = hol ? ' gr-hol' : (weekend ? ' gr-wknd' : '');
    const hint = isClosed(d) ? 'День закрыт — клик' : (anyEdit ? 'Закрыть день' : '');
    const title = hol ? (hint ? hol + ' · ' + hint : hol) : hint;   // название праздника — в подсказке
    head += `<div class="gr-day${d === todayD ? ' today' : ''}${isClosed(d) ? ' dlock' : ''}${mk}${anyEdit ? ' tapday' : ''}" data-day="${d}" title="${esc(title)}">${d}${hol ? '<i class="holdot"></i>' : ''}${isClosed(d) ? `<i class="dlockmark">${ICONS.lock}</i>` : ''}</div>`;
  }
  // «Норма» вместо суммы плановых часов (migrations/056): у администраторов и
  // колл-центра норма — договорённость (180 ч), а не то, что успели расставить в
  // табеле. Δ при этом СТАВИТ прежний вопрос — «вышел ли так, как назначено», —
  // и потому по-прежнему считается от плана, а не от нормы.
  // Порядок хвоста: Смен · Δ · Норма · Факт. Δ переехала ЛЕВЕЕ намеренно —
  // приморозить можно только КРАЙНИЕ справа колонки подряд, а Дарина попросила
  // держать на виду именно «Норму» и «Факт» (02.08). Δ осталась рядом с ними.
  head += '<div class="gr-day sum s-cnt">Смен</div><div class="gr-day sum s-delta" title="факт − норма (у кого норма задана); иначе факт − план смен за прошедшие дни">Δ</div><div class="gr-day sum s-norm" title="норма часов в месяц — задаётся вручную">Норма</div><div class="gr-day sum s-fact">Факт</div>';
  let rows = '', shown = 0;
  // Сначала плоский список пар [сотрудник, отделение] — тогда порядок и заголовки
  // групп решаются в одном месте, а тело строки остаётся единственным.
  const seq = [];
  for (const cat of cats) {
    if (catF && cat !== catF) continue;
    const list = active.filter(e => inCat(e, cat, !!catF) && String(e.fio || "").toLowerCase().includes(f));
    for (const e of list) seq.push([e, cat]);
  }
  if (sortAZ) seq.sort((a, b) => byFio(a[0], b[0]));
  const inCatCount = c => seq.filter(x => x[1] === c).length;
  {
    let curCat = null;
    for (const [e, cat] of seq) {
      if (!sortAZ && cat !== curCat) {
        curCat = cat;
        rows += `<div class="gr-group"><span><i class="cat-dot" style="background:${catColor(cat)}"></i>${esc(cat)} · ${inCatCount(cat)}</span></div>`;
      }
      shown++;
      rows += `<div class="gr-name${editable ? ' tap' : ''}" data-emp="${e.id}" title="${editable ? 'Шаблон на месяц: ' : ''}${esc(e.fio)}" style="box-shadow:inset 3px 0 0 ${catColor(cat)}">${esc(e.fio)}</div>`;
      let planPast = 0, factPast = 0, cnt = 0;
      const amtRow = isAmountCell(e, 'main');          // санитарка без оклада — смены суммой
      for (let d = 1; d <= nd; d++) {
        const c = cget(e.id, d), pst = pastDay(d);
        const empty = !(c && (c.plan_kind || (c.fact ?? null) !== null));
        if (pst) { planPast += planHoursOf(c); const fh = factHoursOf(c); factPast += fh; if (fh > 0) cnt++; }
        const bg = pst ? (empty ? '' : factClass(c)) : (empty ? '' : ' fut');
        const addable = empty && canEditDay(d) && (pst || d === todayD);   // пустая клетка прошлого/сегодня, куда можно ДОБАВИТЬ смену (замена) — подсказка «+»
        rows += `<div class="gr-cell sc2${bg}${amtRow ? ' amt' : ''}${c && c.plan_kind === 'отпуск' ? ' k-vac' : ''}${addable ? ' addable' : ''}${isClosed(d) ? ' dclosed' : ''}${d === todayD ? ' today' : ''}${canEditDay(d) ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}">${schedCellInner(c, pst)}</div>`;
      }
      // numeric из Supabase приходит строкой — parseFloat обязателен
      const nrm = monthNorms.get(e.id), nh = nrm && nrm.hours != null ? parseFloat(nrm.hours) : null;
      // Δ ОТ НОРМЫ, когда норма есть (решение Дарины 01.08). Раньше сравнивали с
      // планом смен, и рядом со столбцом «Норма 184» это читалось как ложь: у
      // Голик стояло «+2ч» при 8 отработанных часах — потому что её единственная
      // смена была на 6 ч, а вышла она на 8. Теперь Δ отвечает на тот вопрос,
      // который ТЕПЕРЬ СТОИТ ДЕНЕГ: сколько недоработано до нормы (оклад считается
      // от неё, миграция 058).
      // Если нормы нет — считаем как раньше, от плана смен: у сменщиков это
      // единственный сигнал «вышел не так, как назначено», терять его нельзя.
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
      // ── ВТОРАЯ РАБОТА: своя строка графика ──────────────────────────────────
      // Появляется, только если в карточке заполнено поле «Вторая работа»
      // (employee.specialty_id_2, миграция 072). Клетки те же, но пишутся с
      // position='second' — своя строка, свои часы, отдельная оплата.
      if (e.specialty_id_2) {
        rows += `<div class="gr-name gr-second" data-emp="${e.id}" data-pos="second" title="${esc(specName(e.specialty_id_2))} — вторая работа · клик по клетке листает Н (ночь) → С (сутки) → «не вышел» → пусто · правая кнопка (на телефоне долгое нажатие) — обычный диалог со сменами и часами">`
          + `<span class="sec-tag">${ICONS.moon}</span>${esc(specName(e.specialty_id_2))}</div>`;
        let dCnt = 0, dFact = 0;
        const amtRow2 = isAmountCell(e, 'second');     // вторая работа санитарская — тоже суммой
        for (let d = 1; d <= nd; d++) {
          const c = cget(e.id, d, 'second'), pst = pastDay(d);
          const empty = !(c && (c.plan_kind || (c.fact ?? null) !== null));
          if (pst) { const fh = factHoursOf(c); dFact += fh; if (fh > 0) dCnt++; }
          const bg = pst ? (empty ? '' : factClass(c)) : (empty ? '' : ' fut');
          rows += `<div class="gr-cell sc2 sec${amtRow2 ? ' amt' : ''}${bg}${isClosed(d) ? ' dclosed' : ''}${d === todayD ? ' today' : ''}${canEditDay(d) ? '' : ' ro'}" data-emp="${e.id}" data-day="${d}" data-pos="second">${schedCellInner(c, pst, 'second')}</div>`;
        }
        // Порядок колонок ТОТ ЖЕ, что у основной строки (master переставил их
        // на cnt · Δ · норма · факт) — иначе итоги съедут по сетке.
        // Нормы у второй работы нет: она сверх основной, сравнивать не с чем.
        rows += amtRow2 ? amountTail(e.id, 'second')
          : `<div class="gr-sum s-cnt">${dCnt}</div><div class="gr-sum s-delta"></div><div class="gr-sum s-norm"><span class="muted">—</span></div><div class="gr-sum s-fact">${fmtH(dFact)}</div>`;
      }
    }
  }
  const grid = $('scheduleGrid');
  // Колонка «Норма» — крайняя справа: чтобы кликнуть по ней, таблицу домотали
  // вправо. innerHTML ниже сбрасывает scrollLeft, и после каждого сохранения
  // норму пришлось бы искать заново — на 119 людях это неработоспособно.
  const wrap = grid.closest('.gridwrap'), keepL = wrap ? wrap.scrollLeft : 0, keepT = wrap ? wrap.scrollTop : 0;
  // Ширину первой колонки берём из CSS (--gr-name-w), а не числом здесь: когда
  // имена расширили до 190px ради ФИО в две строки, эта строка осталась на 150px,
  // и колонка с именами наезжала на первое число месяца.
  grid.style.gridTemplateColumns = `var(--gr-name-w, 190px) repeat(${nd}, minmax(44px, 1fr)) repeat(4, var(--gr-sum-w, 50px))`;
  grid.innerHTML = shown ? head + rows : `<div class="empty" style="padding:40px">${active.length ? 'Никого не найдено' : 'Нет сотрудников'}</div>`;
  if (wrap) { wrap.scrollLeft = keepL; wrap.scrollTop = keepT; }
  if (anyEdit) {
    grid.querySelectorAll('.gr-cell').forEach(cell => cell.onclick = () => {
      const emp = +cell.dataset.emp, d = +cell.dataset.day;
      if (!canEditDay(d)) return;                 // #70: СМС убрана — закрытые дни правят напрямую (в журнал)
      // Дежурство ставится ОДНИМ кликом (решение Дарины 05.08): смены там всего
      // три, и открывать ради них модалку — лишний шаг на каждую клетку.
      // Подробности (часы, замена) остаются на правой кнопке / долгом тапе.
      const pos = cell.dataset.pos || 'main';
      // Санитарская смена платится СУММОЙ: клик листает ходовые 3200/3700/5050,
      // своя — правой кнопкой или долгим нажатием. Часы у такой клетки не спрашиваем.
      const who = employees.find(x => x.id === emp);
      if (isAmountCell(who, pos)) { cycleAmountCell(emp, d, pos); return; }
      if (pos === 'second') { cycleSecondCell(emp, d); return; }
      pastDay(d) ? scheduleFactPopup(emp, d) : scheduleCellPopup(emp, d);   // прошлое → факт, будущее → план
    });
    // Правая кнопка на дежурстве — обычный диалог. На телефоне правой кнопки нет,
    // поэтому то же самое вешаем на долгое нажатие.
    grid.querySelectorAll('.gr-cell.sec, .gr-cell.amt').forEach(cell => {
      const open = ev => {
        ev.preventDefault();
        const emp = +cell.dataset.emp, d = +cell.dataset.day;
        if (!canEditDay(d)) return;
        const p2 = cell.dataset.pos || 'main';
        const who = employees.find(x => x.id === emp);
        if (isAmountCell(who, p2)) { amountCellPopup(who, d, p2); return; }
        pastDay(d) ? scheduleFactPopup(emp, d, 'second') : scheduleCellPopup(emp, d, 'second');
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
/* Дежурство одним кликом: Н (ночь) → С (сутки) → «не вышел» → пусто → Н…
   Три состояния и очистка — весь словарь дежурства, поэтому модалка тут лишняя.
   Пишем ВСЕГДА планом: дежурство назначают, а не отмечают задним числом; факт
   «не вышел» выражаем видом 'absent' — он нерабочий и не оплачивается (043). */
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
    await store.setScheduleCell(empId, cellDate(day),
      { plan_kind: next.kind, plan_start: next.start, plan_end: null, fact: null }, 'second');
    await renderSchedule();
  } catch (err) { toast(err.message || err, true); }
}

/* Норма часов месяца. Решение Дарины 31.07: «проставить по календарю РФ, но с
   возможностью исправить вручную на клетке». Отсюда два поля в одном диалоге:
     • ТИП НЕДЕЛИ — свойство человека (40/36/24 или сменный график). По нему
       календарь (prod_norm) сам даёт норму КАЖДОГО месяца — проставлять руками
       12 раз в году не нужно;
     • НОРМА НА ЭТОТ МЕСЯЦ — исключение (неполный месяц, больничный). Пусто =
       берём календарную. Это и есть «правка на клетке».
   ⚠ Норма ДОЛЖНА влиять на деньги (оплата = ставка / норма × факт — так считают
   в клинике), но база сегодня считает оклад по ДНЯМ графика (v_month_salary/044).
   Переход на часовую формулу — отдельная работа; см. шапку migrations/056.
   ⚠ Не путать с колонкой norm_hours в v_month_total — там сумма ПЛАНОВЫХ часов
   по расставленным сменам, другая величина, они нигде не соединяются. */
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
    <label class="flbl">Норма на ${esc(periodLabel(curPeriod))}</label>
    <input class="input" id="nhVal" inputmode="decimal" value="${man == null ? '' : esc(String(man))}" placeholder="${cal == null ? 'по календарю нормы нет' : 'по календарю ' + esc(String(cal))}" autocomplete="off">
    <div class="msub" style="margin-top:6px">${cal == null
        ? 'Сменный график — календарь нормы не даёт. Впишите своё число (например 180 = 15 смен × 12 ч) или выберите неделю выше.'
        : `Пусто — берём календарные <b>${esc(fmtH(cal))}</b>. Своё число нужно для исключений: приняли или уволили в середине месяца, длинный больничный.`}
      Пока на расчёт не влияет: зарплата считается по дням графика, переход на часы — отдельная задача. Изменение попадёт в журнал.</div>
    <div class="modal-foot">
      ${man != null ? `<button class="btn btn-ghost btn-sm" id="nhReset">Вернуть календарную</button>` : ''}
      <button class="btn btn-ghost btn-sm" id="nhCancel">Отмена</button>
      <button class="btn btn-primary btn-sm" id="nhSave">${ICONS.check}Сохранить</button></div>`);
  $('nhCancel').onclick = closeModal;
  $('nhVal').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('nhSave').click(); } };
  // Перерисовываем только график и только после перезагрузки норм. Полный
  // refresh() тянул бы сотрудников/справочники/ставки/журнал ради одного числа,
  // а drawSchedule сохраняет прокрутку — иначе после каждого сохранения таблицу
  // пришлось бы доматывать вправо заново (колонка «Норма» — крайняя).
  const redraw = async () => { await renderSchedule(); };
  if (man != null) $('nhReset').onclick = async () => {
    const b = $('nhReset'); if (b.disabled) return; b.disabled = true;
    try { await store.clearMonthNorm(empId, curPeriod); closeModal(); await redraw(); toast(ICONS.check + 'Вернули норму по календарю'); }
    catch (err) { b.disabled = false; toast(err.message || err, true); }
  };
  $('nhSave').onclick = async () => {
    const btn = $('nhSave'); if (btn.disabled) return;
    let v;
    try { v = parseNum($('nhVal').value, { field: 'норму (часов в месяц)' }); }   // пусто → null = вернуть календарную
    catch (err) { toast(err.message, true); return; }
    // Границы те же, что emn hours check (migrations/056): 744 = 31 сутки × 24 ч.
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
      if (newWk !== oldWk) await refresh();          // тип недели живёт в карточке — обновляем и её
      else await redraw();
      toast(ICONS.check + 'Норма сохранена');
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
// Закрытие/открытие дня табеля. Закрытый день лочит клетки от оператора (правит владелец / Алёна по СМС в 5б).
function scheduleDayDialog(day) {
  const date = cellDate(day), closed = closedDays.has(date), meRole = store.me()?.role;
  const label = day + ' ' + periodLabel(curPeriod);
  if (!closed) {
    showModal(`<h3>Закрыть день ${esc(label)}?</h3>
      <div class="msub">После закрытия клетки этого дня блокируются от правок. Изменить закрытый день сможет владелец напрямую (а Алёна — по СМС-подтверждению, этап 5б). Всё пишется в журнал.</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Отмена</button><button class="btn btn-primary btn-sm" id="dClose">${ICONS.lock}Закрыть день</button></div>`);
    $('dClose').onclick = async () => { const b = $('dClose'); if (b.disabled) return; b.disabled = true; try { await store.closeDay(date); closeModal(); toast(ICONS.check + 'День ' + day + ' закрыт'); renderSchedule(); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    $('dCancel').onclick = closeModal;
  } else {
    showModal(`<h3>${ICONS.lock} День ${esc(label)} закрыт</h3>
      <div class="msub">Клетки заблокированы от правок. ${meRole === 'owner' ? 'Как владелец — вы можете открыть день или править клетки напрямую (запишется в журнал).' : 'Исправить может владелец, либо вы по СМС-подтверждению (этап 5б) — с уведомлением владельца.'}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="dCancel">Закрыть</button>${meRole === 'owner' ? `<button class="btn btn-primary btn-sm" id="dOpen">Открыть день</button>` : ''}</div>`);
    if ($('dOpen')) $('dOpen').onclick = async () => { const b = $('dOpen'); if (b.disabled) return; b.disabled = true; try { await store.reopenDay(date); closeModal(); toast('День ' + day + ' открыт'); renderSchedule(); } catch (e) { b.disabled = false; toast(e.message || e, true); } };
    $('dCancel').onclick = closeModal;
  }
}
function scheduleCellPopup(empId, day, pos = 'main') {
  setEditing('sched:' + empId + ':' + cellDate(day));
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day, pos);
  const opts = shiftKinds.filter(k => k.code !== 'custom').map(k => `<option value="${k.code}" ${c && c.plan_kind === k.code ? 'selected' : ''}>${esc(k.label)}</option>`).join('');   // custom без конца смены = 0ч → исключаем (как в шаблоне)
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · смена = тип + время начала`)}
    <label class="flbl">Тип смены</label><select class="input" id="scKind"><option value="">— пусто —</option>${opts}</select>
    <label class="flbl">Время начала</label><input class="input" id="scStart" type="time" value="${c && c.plan_start ? esc(String(c.plan_start).slice(0, 5)) : ''}">
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="scVac">Отпуск…</button><button class="btn btn-ghost btn-sm" id="scClear">Очистить</button><button class="btn btn-primary btn-sm" id="scSave">${ICONS.check}Сохранить</button></div>`);
  $('scVac').onclick = () => vacationDialog(empId, day);
  $('scSave').onclick = async () => {
    const btn = $('scSave'); if (btn.disabled) return; btn.disabled = true;
    const kind = $('scKind').value || null;   // время без типа смены не сохраняем (иначе невидимая строка-пустышка)
    try { await store.setScheduleCell(empId, date, { plan_kind: kind, plan_start: kind ? ($('scStart').value || null) : null, plan_end: null, fact: null }, pos); closeModal(); toast(ICONS.check + 'Сохранено'); renderSchedule(); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('scClear').onclick = async () => {
    try { await store.setScheduleCell(empId, date, { plan_kind: null, plan_start: null, plan_end: null, fact: null }, pos); closeModal(); toast('Очищено'); renderSchedule(); }
    catch (err) { toast(err.message || err, true); }
  };
}
// Отпуск диапазоном «с…по…»: все дни периода → 'отпуск'. plan_start/plan_end/fact ОЧИЩАЕМ — иначе день с
// остатком времени смены посчитается отработанным и оплатится. Отпуск = уважительная: не в норму, не «прогул»,
// зарплата за эти дни не идёт (отпускные вносятся отдельной суммой). Каждый день пишется в журнал.
function vacationDialog(empId, startDay) {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const startDate = cellDate(startDay);
  showModal(`${personHead(e, `с <b>${esc(startDate)}</b> по какое число (включительно)`, 'Отпуск')}
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
      closeModal(); toast(ICONS.check + `Отпуск отмечен · ${days.length} дн`); renderSchedule();
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
}
// Табель: отметка факта за прошедший день. Вышел по плану = сброс (null); прочерк = 'x'; свои часы = число.
// Если планового выхода НЕТ (пусто/выходной/не вышел), а человек ВЫШЕЛ на замену — Алёна добавляет смену:
// выбирает ТИП (сутки/12ч/оклад/…) → оплата по его ставке за этот тип; либо вписывает часы (почасово).
function scheduleFactPopup(empId, day, pos = 'main') {
  const e = employees.find(x => x.id === empId); if (!e) return;
  const date = cellDate(day), c = cellOf(empId, day, pos);
  const p = c && c.plan_kind, isWork = p && !isRest(p);
  const cur = c ? (c.fact ?? null) : null;
  const planLine = p ? `план: <b>${esc(cellText(c))}</b>${isWork ? ' · ' + fmtH(planHoursOf(c)) : ''}` : 'плана нет';
  const now = cur === 'x' ? 'не вышел' : (cur != null && cur !== '' ? fmtH(parseFloat(cur)) : (isWork ? 'по плану' : '—'));
  const hVal = (cur != null && cur !== '' && cur !== 'x') ? esc(String(cur)) : '';
  const workKinds = shiftKinds.filter(k => !isRest(k.code) && k.code !== 'custom');   // смены-замены: только рабочие типы
  const kindOpts = workKinds.map(k => `<option value="${k.code}">${esc(k.label)}</option>`).join('');
  showModal(`${personHead(e, `${day} ${esc(periodLabel(curPeriod))} · факт · ${planLine}`)}
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
    try { await store.setScheduleFact(empId, date, fact, pos); closeModal(); toast(ICONS.check + 'Факт отмечен'); renderSchedule(); }
    catch (err) { toast(err.message || err, true); }
  };
  $('modalBox').querySelectorAll('.fact-btn').forEach(b => b.onclick = () => apply(b.dataset.f === 'plan' ? null : b.dataset.f));
  $('fSave').onclick = () => { let v = parseFloat($('fH').value); if (isNaN(v) || v < 0 || v > 24) return toast('Часы 0–24', true); v = Math.round(v * 2) / 2; apply(String(v)); };   // до получаса (шаг поля 0.5) → проходит CHECK
  const kb = $('fKindSave');   // замена: добавить типовую смену (plan_kind + факт=по плану) → считается отработанной, платится по ставке типа
  if (kb) kb.onclick = async () => {
    const kind = $('fKind').value; if (!kind) return toast('Выберите тип смены', true);
    if (kb.disabled) return; kb.disabled = true;
    try { await store.setScheduleCell(empId, date, { plan_kind: kind, plan_start: $('fKindStart').value || null, plan_end: null, fact: null }, pos); closeModal(); toast(ICONS.check + 'Смена добавлена'); renderSchedule(); }
    catch (err) { kb.disabled = false; toast(err.message || err, true); }
  };
  $('fClear').onclick = () => apply(null);
}

// Ретро-правка закрытого дня (оператор): выбрать новый факт → код по СМС → подтвердить. Уходит владельцу в «красные замечания».
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
  // guard: код уже ОТПРАВЛЕН, requestId живёт только в этом замыкании, а попытки
  // ограничены (RUS.locked/expired). Закройся окно случайно — Escape, клик по фону,
  // «назад» — и код придётся запрашивать заново, тратя попытку. Выход — «Отмена».
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
  showModal(`${personHead(e, `Заполнить весь ${esc(periodLabel(curPeriod))} по шаблону · потом можно поправить руками`)}
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
    try { await store.setScheduleBulk(cells); closeModal(); toast(ICONS.check + 'Заполнено по шаблону'); renderSchedule(); }
    catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  $('tpClear').onclick = async () => {
    const btn = $('tpClear'); if (btn.disabled) return; btn.disabled = true;
    try { await store.clearScheduleMonth(empId, curPeriod); closeModal(); toast('Месяц очищен'); renderSchedule(); }
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
  if (kind === 'сдельно') return `<span class="muted small">сумму вписывают на «Расчёте»</span>`;
  return `<input class="input rt-a" inputmode="numeric" value="${has ? (l.amount ?? '') : ''}" placeholder="сумма ₽">`;
}
function rtRow(e) {
  const l = primaryLine(e), kind = l?.pay_kind || 'оклад';
  // «фикс» и «сдельно» на этом экране не заводят (он для массовой простановки
  // ставок), но если такой вид уже стоит — его надо ПОКАЗАТЬ. Иначе select молча
  // показывал бы «Оклад», и сохранение строки подменяло бы вид оплаты.
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
/* С какого числа начинает действовать ставка. Берём месяц, ОТКРЫТЫЙ В ПРОГРАММЕ:
   человек считает июль — значит и ставку заводит на июль, какое бы сегодня ни было
   число. От сегодняшнего месяца это отвязано намеренно: 1 августа 2026 все ставки,
   заведённые для июля, молча легли в август, и у Хуцишвили за 12 отработанных дней
   вышло 0 ₽ — в июле ставки «ещё не было». monthStartMSK остаётся запасным. */
const openPeriod = () => [workPeriod, payPeriod, curPeriod, ovPeriod]
  .find(p => /^\d{4}-\d{2}$/.test(p || '')) || null;
const rateStartDefault = () => { const p = openPeriod(); return p ? p + '-01' : monthStartMSK(); };
/* Границы даты «действует с» — те же, что проверяет база (rate_edit_floor,
   миграция 081): не раньше начала прошлого месяца (глубже месяцы посчитаны и
   выплачены) и не дальше трёх месяцев вперёд (там это почти всегда опечатка в
   годе). Прошлый месяц доступен ВСЕГДА: после 6-го числа он не закрывается, а
   требует отметки «осознанно» — см. backdateNeedsOk.
   На СОЗДАНИИ карточки ставки вставляются прямым INSERT, мимо RPC, — там эта
   проверка вообще единственная. */
function rateBounds() {
  const t = new Date(Date.now() + 3 * 3600e3);                       // МСК
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), d = t.getUTCDate();
  const iso = dt => dt.toISOString().slice(0, 10);
  return { min: iso(new Date(Date.UTC(y, m - 1, 1))), max: iso(new Date(Date.UTC(y, m + 3, d))) };
}
/* Дата раньше текущего месяца — это правка уже посчитанного и, возможно,
   выплаченного. Молча так делать нельзя: предупреждаем словами.
   По 6-е число включительно предупреждения достаточно: по прошлому месяцу ещё
   идут подсчёты, и правка — обычная работа. С 7-го просим отметку «осознанно».
   То же правило проверяет база (rate_backdate_needs_ok, миграция 081) — здесь
   оно не для безопасности, а чтобы человек не наткнулся на отказ вслепую. */
function rateBackWarn(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || d >= monthStartMSK()) return '';
  const warn = `<div class="rc-warn">${ICONS.lock} Это <b>задним числом</b>: месяц уже посчитан,
       по нему могли быть выплаты. Суммы пересчитаются.</div>`;
  // Галочка перерисовывается вместе с датой и сбрасывается — подтверждают именно
  // ту дату, которая стоит в поле, а не какую-то отмеченную до её изменения.
  return backdateNeedsOk(d)
    ? warn + `<label class="rc-ok"><input type="checkbox" id="rbOk">
       <span>Да, ставлю дату <b>задним числом</b> осознанно — правка попадёт в журнал с моим именем</span></label>`
    : warn;
}
/* Общая проверка для обоих диалогов: без отметки дальше не пускаем. */
function backdateBlocked(d) {
  if (!backdateNeedsOk(d) || $('rbOk')?.checked) return false;
  toast('Отметьте, что ставите дату задним числом осознанно', true);
  return true;
}
/* Предупреждение под полем даты: если ставка стартует ПОЗЖЕ открытого месяца,
   за этот месяц не начислится ничего — ровно тот случай, что мы разбирали. */
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
/* Новые строки ставки в карточке заводились БЕЗ вопроса о дате: она бралась от
   сегодняшнего числа. Именно так ставки Хуцишвили и Круглова попали в август,
   хотя заводили их для июля. Теперь спрашиваем — с подсказкой о последствии. */
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
    modalOnClose2 = () => resolve(null);           // крестик/Escape = «Отмена»
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
      <input class="input" type="date" id="rcFrom" value="${def}" min="${rateBounds().min}" max="${rateBounds().max}">
      <div class="msub" id="rcPrev" style="margin-top:8px">${ratePreviewText(def)}</div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="rcNo">Отмена</button>
        <button class="btn btn-primary btn-sm" id="rcYes">${ICONS.check}Применить</button></div>`);
    $('modalBox').dataset.guard = '1';                       // деньги/ставки — не закрывать случайным кликом
    const inp = $('rcFrom');
    const drawRc = () => { $('rcPrev').innerHTML = ratePreviewText(inp.value) + rateStartWarn(inp.value) + rateBackWarn(inp.value); };
    inp.oninput = drawRc; drawRc();
    modalOnClose = () => resolve(null);            // крестик/Escape = «Отмена»
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
  const cats = [...new Set([...specialties.map(s => s.category), 'Прочие'])];
  let html = '';
  for (const cat of cats) {
    let list = active.filter(e => inCat(e, cat, false) && String(e.fio || "").toLowerCase().includes(f));
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
  schedule: 'График', closed_day: 'День', day: 'День', import_batch: 'Импорт',
  // без этих подписей владелец видит сырые имена таблиц вместо человеческой строки
  salary_override: 'Финальная сумма', employee_month_norm: 'Норма часов',
  doctor_month_revenue: 'Выручка врача' };
const J_FIELD = { fio: 'ФИО', position: 'должность', phone: 'телефон', status: 'статус', specialty: 'специальность', specialty_id: 'специальность', norm_hours: 'норма часов', week_hours: 'рабочая неделя', hired_on: 'принят', left_on: 'уволен', 'новая строка': 'новая строка', 'закрыта': 'строка закрыта', 'ставка добавлена': 'ставка добавлена', 'ставка закрыта': 'ставка закрыта' };
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
/* «Всего на карту» — сумма ВЫДАННОГО безналом: ЗП, аванс, отпускные и
   больничные. Начисления (otpusk_nach, bolnich_nach) сюда НЕ входят — Дарина
   03.08: «нарахування не йдуть туди у все на карту», это ещё не деньги на
   руках. «Расчёт при увольнении» тоже карточный, но в перечень не назван —
   не подмешиваем молча, добавим явно, если понадобится. */
const cardTotal = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0)
  + (r.otpusk_kop || 0) + (r.bolnich_kop || 0);
/* Формула начисления словами: «70 000 × 96 ч ÷ 180 ч». Дарина 03.08 — «щоб у нас
   в розрахунку теж так зрозуміло і докладно все було розписано».
   Раньше строка гласила «Оклад · 8 из 8 — 37 333 ₽», и откуда взялись 37 333 при
   окладе 70 000, по карточке понять было нельзя: 8 из 8 дней отработано, а
   заплачено чуть больше половины. Не видно было ни ставки, ни нормы, а делится
   именно на месячную норму часов (миграция 058), а не на дни графика.
   Возвращает '' там, где показывать нечего: домысливать формулу опаснее, чем
   промолчать — по проценту без введённой выручки или по сдельной сумме её нет. */
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
  // сменные виды: сумма за смену × сколько смен отработано
  if (amt != null && l.worked) return `${fmt(amt)} × ${l.worked} см`;
  return '';
}
/* «Всего заработано» — весь заработок человека за месяц из ВСЕХ источников, одним
   числом. Просьба Виталия 03.08: «мне нужно понимать сколько суммарно будет у
   человека заработка… сделать ещё одну колонку с одной цифрой, из которой потом
   вычту то, что на карту и уже выдавалось на руки».
   Ровно то же, что складывает «Осталось выдать» со знаком плюс, — поэтому здесь
   и берётся, а не считается заново: разъедутся формулы, разъедутся и цифры.
   Перенос с прошлого месяца сюда НЕ входит: это не заработок июля, а долг с
   июня, и в «Осталось выдать» он приходит отдельным слагаемым. */
const earned = r => (r.salary_kop || 0) + (r.premia_kop || 0)
  + (r.otpusk_nach_kop || 0) + (r.bolnich_nach_kop || 0);
const MONEY_KINDS = [
  ['cash', 'Наличные'], ['cash_avans', 'Аванс наличными'], ['otpusk_cash', 'Отпускные наличными'],
  ['premia', 'Премия'],
  ['card_avans', 'Аванс на карту'], ['card_rasch', 'ЗП на карту'],
  ['otpusk', 'Отпускные на карту'], ['card_uvol', 'Расчёт на карту (увольнение)'],
  ['otpusk_nach', 'Отпускные начислено (не выплата)'],
  ['bolnich_nach', 'Больничные начислено (не выплата)'],
  ['bolnich', 'Больничные на карту'],
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
// Чип на карточке человека: то, что вычитает delta_kop (аванс + ЗП + расчёт
// при увольнении) — чип обязан сходиться с «Осталось выдать». Это НЕ то же
// самое, что колонка «Всего на карту» (cardTotal выше): там по просьбе Дарины
// считается ВЫДАННОЕ безналом, включая отпускные и больничные.
const cardDelta = r => (r.card_rasch_kop || 0) + (r.card_avans_kop || 0) + (r.card_uvol_kop || 0);
let payrollRows = [], payrollLines = [], payrollSeq = 0, payrollShown = null;
// Норма часов месяца на «Расчёте» — та же v_month_norm, что и в графике.
// Нужна, чтобы шапка окна человека говорила часами, а не днями: оклад теперь
// считается от НОРМЫ и ФАКТА в часах (миграция 058), и дни к этому отношения
// уже не имеют — «норма 12 дн · факт 11 дн» рядом с суммой сбивало с толку.
let payrollNorms = new Map();

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
  const prevShown = payrollShown;                       // что реально лежит в payrollRows
  // Чипы гасим ВМЕСТЕ с таблицей: «Осталось выдать» — контрольная цифра владельца,
  // и висеть от прошлого месяца под новой подписью она не должна.
  if (!sameMonth) $('payrollTable').innerHTML = '<div class="empty">Загружаем расчёт…</div>';
  // payrollShown ставим ТОЛЬКО после успеха (как schedShown/patShown/ovData.period).
  // Раньше он значил «загрузка началась»: два быстрых клика по ›, и второй вызов
  // брал prevShown = месяц, который никогда не грузился, — откат уводил бы ИМЕННО
  // в него, а ввод суммы записался бы туда же.
  let rows, lines;
  let norms = [];
  try { [rows, lines, norms] = await Promise.all([store.listPayroll(payPeriod), store.listPayrollLines(payPeriod),
    store.listMonthNorms(payPeriod).catch(e => { console.warn('listMonthNorms:', e); return []; })]); }   // норма не критична: ведомость должна открыться и без неё
  // Месяц не загрузился — откатываем payPeriod к тому, что РЕАЛЬНО лежит в
  // payrollRows (они при ошибке не обновились). Без отката любой следующий
  // drawPayroll — а его зовёт просто ввод в поиске и смена отделения — нарисовал
  // бы СТАРЫЕ деньги под НОВОЙ подписью и новым адресом, вместе со строкой ИТОГО;
  // а ввод суммы ушёл бы с period = payPeriod, то есть в месяц, которого никто не
  // видел. Это единственный из четырёх «месячных» экранов, который ПИШЕТ деньги.
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
  if (seq !== payrollSeq) return;                       // пришёл ответ от старого месяца — игнорируем
  payrollShown = payPeriod;                             // теперь месяц ДЕЙСТВИТЕЛЬНО показан
  payrollRows = rows; payrollLines = lines;
  payrollNorms = new Map((norms || []).map(n => [n.employee_id, n]));
  drawPayroll(filter);
  if (wrap) { wrap.scrollTop = keepTop; wrap.scrollLeft = keepLeft; }
}

/* Строки начисления для показа. Складываем из ДВУХ источников, потому что
   v_day_money по дням даёт деньги только для СМЕННЫХ видов: оклад считается
   помесячно (oklad_worked_sum/oklad_planned_days), а процент — от оплат
   пациентов, и в дневных строках его нет вовсе. Раньше я суммировал только дни:
   «Оклад · 20 · 17 · 0 ₽» рядом с «Зарплата 68 000», а процентник вообще
   получал «нет начислений за месяц». Дни дают КОЛИЧЕСТВА, месяц — ДЕНЬГИ. */
function linesFor(r) { return linesForRow(r, payrollLines.filter(l => l.employee_id === r.employee_id)); }
function linesForRow(r, raw) {
  const out = raw.map(l => l.kind === 'оклад' ? { ...l, money_kop: r.oklad_kop } : l);   // оклад — помесячно
  const has = k => raw.some(l => l.kind === k);
  if ((r.percent_kop || r.pct_rate != null) && !has('процент'))
    out.push({ kind: 'процент', planned: null, worked: null, money_kop: r.percent_kop, isPct: true });
  // «Фикс/мес» к графику не привязан, дневных строк у него нет вовсе — без этой
  // строки человек с надбавкой видел только оклад, а сумма в итоге была больше:
  // ровно то, из-за чего у Бардаковой не было разбивки «оклад + надбавка».
  // has() — страховка от дубля, если v_payroll_lines начнёт отдавать этот вид.
  if (r.fix_kop && !has('фикс'))
    out.push({ kind: 'фикс', planned: null, worked: null, money_kop: r.fix_kop, isPct: true });
  return out;
}

function drawPayroll(filter = '') {
  // В payrollRows лежат деньги за payrollShown. Если сейчас грузится ДРУГОЙ месяц —
  // рисовать нечего. Поиск по ФИО и выбор отделения зовут drawPayroll НАПРЯМУЮ,
  // минуя renderPayroll: без этой строки один символ в поиске перерисовывал старые
  // деньги — вместе с подытогами по отделениям, строкой ИТОГО и чипами «Осталось
  // выдать» — под новой подписью и новым адресом. Ошибки сети для этого не нужно.
  // `!payrollShown` — отдельным условием: пока «Расчёт» не открывали ни разу, ОБА
  // пусты, равенство выполняется, и мы шли рисовать месяц null (падало на
  // periodLabel). Ловится, только когда рисовать просят с ДРУГОГО экрана.
  if (!payrollShown || payrollShown !== payPeriod) return;
  const f = (filter || '').toLowerCase();
  const cat = $('payrollCat')?.dataset.value || '';
  // «без начисления» — быстрый способ увидеть, кому за месяц ничего не посчиталось:
  // нет ставки, нет графика, не введена выручка. Именно этот список закрывают
  // в конце месяца, и раньше его приходилось выискивать глазами по всей ведомости.
  const onlyZero = $('payOnlyZero')?.checked;
  const rows = payrollRows.filter(r => (r.fio || '').toLowerCase().includes(f)
    && (!cat || specCat(employees.find(e => e.id === r.employee_id)?.specialty_id) === cat)
    && (!onlyZero || (r.salary_kop || 0) === 0));
  if (!rows.length) {
    $('payrollTable').innerHTML = `<div class="empty">${onlyZero && payrollRows.length ? 'Всем за месяц что-то начислено 🎉'
      : payrollRows.length ? 'Никого не найдено' : 'За ' + esc(periodLabel(payPeriod)) + ' данных нет'}</div>`;
    return;
  }

  // Каждый вид выплаты — своя графа (решение Дарины 31.07). Раньше «Карта» была
  // одним числом на аванс+ЗП+расчёт, и по ведомости нельзя было понять, ЧТО
  // именно человеку перечислили. Порядок сохранён прежний: наличный аванс →
  // карта → наличка → отпускные → премия → остаток.
  // «Отпуск. начисл.» — НЕ выплата, а начисление: справочно, ни в одну сумму
  // не входит (migrations/046).
  const head = `<thead><tr>
    <th class="pw-name">Сотрудник</th><th>Начисление</th><th class="num">Норма</th><th class="num">Факт</th><th class="num">Сумма</th>
    <th class="num sep">Зарплата</th><th class="num pw-earned">Всего заработано</th><th class="num">Аванс на карту</th><th class="num">ЗП на карту</th><th class="num pw-cardtot">Всего на карту</th><th class="num pw-carry">С прошлого мес.</th><th class="num pw-pay">Осталось выдать</th><th class="num">Расчёт на карту</th><th class="num">Аванс нал.</th><th class="num">Наличка</th>
    <th class="num">Отпуск. начисл.</th><th class="num">Отпуск. карта</th><th class="num">Отпуск. нал.</th><th class="num">Премия</th><th class="num">Больн. начисл.</th><th class="num">Больн. карта</th></tr></thead>`;

  // Разбивка по специальностям (как в графике): сортируем по отделению,
  // перед каждой группой — строка-заголовок с подытогом «осталось выдать».
  const catOf = r => specCat(employees.find(e => e.id === r.employee_id)?.specialty_id) || 'Прочие';
  if (sortAZ) rows.sort(byFio);
  else rows.sort((a, b) => catSort(catOf(a)) - catSort(catOf(b))
    || catOf(a).localeCompare(catOf(b)) || (a.fio || '').localeCompare(b.fio || ''));
  let body = '', curCat = null;
  for (const r of rows) {
    const cat = catOf(r);
    if (!sortAZ && cat !== curCat) {
      curCat = cat;
      const inCat = rows.filter(x => catOf(x) === cat);
      const catDelta = inCat.reduce((s, x) => s + (x.delta_kop || 0), 0);
      body += `<tr class="pw-group" style="--cat:${catColor(cat)}"><td colspan="21"><span>${esc(cat)} · ${inCat.length} чел · осталось выдать <b>${rub(catDelta)} ₽</b></span></td></tr>`;
    }
    const my = linesFor(r);
    const flags = payrollFlags(r);
    // одна ставка → одна строка без объединения; несколько → rowspan справа
    const n = Math.max(1, my.length);
    const right = `
      <td class="num sep fin"><b>${rub(r.salary_kop)}</b></td>
      <td class="num fin pw-earned"><b>${rub(earned(r))}</b></td>
      <td class="num fin">${rub(r.card_avans_kop)}</td>
      <td class="num fin">${rub(r.card_rasch_kop)}</td>
      <td class="num fin pw-cardtot"><b>${rub(cardTotal(r))}</b></td>
      <td class="num fin pw-carry${isStaff() ? ' pw-tap' : ''}" data-carry="${r.employee_id}"${isStaff() ? ' title="Изменить или убрать перенос"' : ''}>${
        r.carry_kop ? `<b class="money${r.carry_kop < 0 ? ' neg' : ''}">${rub(r.carry_kop)}</b>` : '<span class="muted">—</span>'}</td>
      <td class="num pw-pay fin"><b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)}</b></td>
      <td class="num fin">${rub(r.card_uvol_kop)}</td>
      <td class="num fin">${rub(r.cash_avans_kop)}</td>
      <td class="num fin">${rub(r.cash_kop)}</td>
      <td class="num fin">${rub(r.otpusk_nach_kop)}</td>
      <td class="num fin">${rub(r.otpusk_kop)}</td>
      <td class="num fin">${rub(r.otpusk_cash_kop)}</td>
      <td class="num fin">${rub(r.premia_kop)}</td>
      <td class="num fin">${rub(r.bolnich_nach_kop)}</td>
      <td class="num fin">${rub(r.bolnich_kop)}</td>
`;
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
  // «Осталось выдать» в итоге складываем ТОЛЬКО из плюсов: это деньги, которые
  // реально надо раздать. Минусы — переплата вперёд, они не уменьшают выдачу,
  // а переходят на следующий месяц, и им своя строка. Раньше всё складывалось
  // в одно число, и переплата одному тихо гасила недоплату другому: итог
  // показывал меньше, чем предстоит выдать на руки.
  const toGive   = rows.reduce((s, r) => s + Math.max(0, r.delta_kop || 0), 0);
  const overpaid = rows.reduce((s, r) => s + Math.min(0, r.delta_kop || 0), 0);
  const overpaidCnt = rows.filter(r => (r.delta_kop || 0) < 0).length;
  const total = `<tfoot><tr class="pw-total"><td class="pw-name">ИТОГО</td><td></td>
    <td></td><td></td><td></td>
    <td class="num sep fin"><b>${rub(sum('salary_kop'))}</b></td>
    <td class="num fin pw-earned"><b>${rub(rows.reduce((s2, r) => s2 + earned(r), 0))}</b></td>
    <td class="num fin">${rub(sum('card_avans_kop'))}</td><td class="num fin">${rub(sum('card_rasch_kop'))}</td>
    <td class="num fin pw-cardtot"><b>${rub(sum('card_rasch_kop') + sum('card_avans_kop') + sum('otpusk_kop') + sum('bolnich_kop'))}</b></td>
    <td class="num fin pw-carry"><b class="money${sum('carry_kop') < 0 ? ' neg' : ''}">${sum('carry_kop') ? rub(sum('carry_kop')) : '—'}</b></td>
    <td class="num pw-pay fin"><b class="money">${rub(toGive)}</b></td>
    <td class="num fin">${rub(sum('card_uvol_kop'))}</td>
    <td class="num fin">${rub(sum('cash_avans_kop'))}</td><td class="num fin">${rub(sum('cash_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_nach_kop'))}</td>
    <td class="num fin">${rub(sum('otpusk_kop'))}</td><td class="num fin">${rub(sum('otpusk_cash_kop'))}</td><td class="num fin">${rub(sum('premia_kop'))}</td>
    <td class="num fin">${rub(sum('bolnich_nach_kop'))}</td>
    <td class="num fin">${rub(sum('bolnich_kop'))}</td>
</tr>
    <tr class="pw-total pw-accrued"><td class="pw-name">Всего начислено</td>
      <td colspan="8" class="muted small">зарплата ${rub(sum('salary_kop'))}${
        sum('premia_kop') ? ' + премии ' + rub(sum('premia_kop')) : ''}${
        sum('otpusk_nach_kop') ? ' + отпускные ' + rub(sum('otpusk_nach_kop')) : ''}${
        sum('bolnich_nach_kop') ? ' + больничные ' + rub(sum('bolnich_nach_kop')) : ''}</td>
      <td class="num pw-cardtot"></td><td class="num pw-carry"></td>
      <td class="num pw-pay fin"><b class="money">${rub(sum('salary_kop') + sum('premia_kop') + sum('otpusk_nach_kop') + sum('bolnich_nach_kop'))}</b></td>
      <td colspan="9"></td></tr>
    ${overpaid ? `<tr class="pw-total pw-over"><td class="pw-name">Переплата вперёд</td>
      <td colspan="10" class="muted small">выдано больше, чем начислено — эта сумма перейдёт на следующий месяц${overpaidCnt ? ` · ${overpaidCnt} чел` : ''}</td>
      <td class="num pw-pay fin"><b class="money neg">−${rub(Math.abs(overpaid))}</b></td>
      <td colspan="9"></td></tr>` : ''}</tfoot>`;

  $('payrollTable').innerHTML = `<table class="pw">${head}<tbody>${body}</tbody>${total}</table>`;
  stickFooterRows($('payrollTable'));
  $('payrollTable').querySelectorAll('.pw-row').forEach(tr => {
    tr.onclick = () => payrollDialog(+tr.dataset.id);
  });
  // Ячейка переноса — своё окно. stopPropagation, иначе поверх откроется ещё и
  // окно всей строки, и человеку придётся закрывать два подряд.
  {
    const cb = $('carryPrev');
    if (cb) {
      cb.hidden = !isStaff();
      cb.onclick = () => carryFromPrev(payPeriod, () => renderPayroll($('payrollSearch')?.value || ''));
    }
  }
  $('payrollTable').querySelectorAll('.pw-carry.pw-tap[data-carry]').forEach(td => {
    td.onclick = e => { e.stopPropagation(); editCarry(+td.dataset.carry, payPeriod, () => renderPayroll($('payrollSearch')?.value || '')); };
  });
}

// Флаги — короткими чипами у имени. Это ПОДСКАЗКА «посмотри», а не приговор.
// Есть ли у человека вид оплаты «сдельно», действующий в периоде ведомости.
// Держим отдельной функцией: этим признаком гасится ложный flag_no_rate и в
// чипах, и в счётчике «нужна ставка», и в модалке — расходиться им нельзя.
function isPiece(employee_id) {
  const e = employees.find(x => x.id === employee_id);
  if (!e || !e.lines) return false;
  const p1 = payPeriod + '-01', pn = nextPeriodStart(payPeriod);
  return e.lines.some(l => l.pay_kind === 'сдельно' && l.valid_from < pn && (!l.valid_to || l.valid_to > p1));
}
function payrollFlags(r) {
  const f = [];
  if (r.flag_manual_salary) f.push(['сумма вручную', 'info']);
  if (!r.flag_manual_salary) {            // при ручной финальной сумме расчётные предупреждения не к месту
    if (r.flag_money_without_calc) f.push(['деньги без расчёта', 'red']);
    // у сдельщика ставки «под смену» и не должно быть — сумму называют числом
  if (r.flag_no_rate && !isPiece(r.employee_id)) f.push(['нет ставки', 'red']);
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

/* Цветные плашки над «Расчётом» убраны (Дарина 03.08): «вони і місця багато
   займають і зайві». Те же числа есть в таблице — строка ИТОГО теперь держится
   внизу всегда (v=114), а «Осталось выдать» по отделениям стоит в заголовке
   каждой группы. Освободившееся место отдано таблице.
   Если понадобится вернуть — они были: Осталось выдать, Начислено, Выдано на
   карту, Выдано наличными, К выдаче наличными, Нужна ставка; считались суммой
   по колонкам delta_kop, salary_kop, card_… и cash_… из показанных строк. */

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
    modalOnClose2 = () => resolve(false);          // крестик/Escape = «Отмена»
    $('stNo').onclick = () => { resolve(false); closeModal2(); };
    $('stYes').onclick = () => { resolve(true); closeModal2(); };
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

/* Строка выплаты в разбивке + кнопка «убрать». Раньше убрать выплату можно было
   только внизу модалки, в ленте «Кто внёс и когда» — Дарина её попросту не
   находила: лента длинная и лежит под всеми полями ввода. Кнопка стоит там, где
   человек СМОТРИТ на неверную сумму.
   Внутри это по-прежнему сторно (встречная запись), а не удаление: деньги в этой
   системе — не число, а перечень событий, и стереть событие значит потерять след
   «кто внёс». Пользователю про сторно знать не нужно — он видит «убрать». */
function payRow(label, kop, kind, canEdit) {
  if (!kop) return '';
  const can = canEdit && kind && moneyKindsFor(store.me()?.role).some(k => k[0] === kind);
  return `<div class="me-row${can ? ' me-tap' : ''}"${can ? ` data-kind="${kind}" title="Изменить или убрать"` : ''}>`
       + `<span class="muted">${esc(label)}</span><b>${rub(kop)} ₽</b>`
       + (can ? `<span class="me-pen">${ICONS.pencil || '✎'}</span>` : '')
       + `</div>`;
}
/* Живые записи вида за месяц: не сторно и не сторнированные ранее. Повторное
   сторно база запретит, а тихо проглотить отказ здесь было бы хуже всего. */
function liveOf(ev, kind) {
  const dead = new Set(ev.filter(x => x.reverses_id).map(x => x.reverses_id));
  return ev.filter(x => !x.reverses_id && !dead.has(x.id) && (!kind || x.kind === kind));
}
/* Правка выплаты: изменить сумму ИЛИ убрать. И то, и другое внутри — сторно
   прежних записей (плюс новая запись, если сумма меняется, а не обнуляется).
   Дарине про сторно думать не нужно: она видит сумму, меняет её или убирает.
   Почему не UPDATE: деньги здесь — не число, а перечень событий; переписав
   событие, мы потеряли бы след «кто внёс», ради которого система и строилась. */
async function editPayout(empId, per, kind, onDone) {
  let ev;
  try { ev = await store.listMoneyEvents(empId, per); }
  catch (e) { toast(e.message || e, true); return; }
  const live = liveOf(ev, kind);
  const cur = live.reduce((s, x) => s + x.amount_kop, 0);
  if (!live.length) { toast('Записей этого вида за месяц нет', true); return; }

  showModal2(`<h3>${esc(moneyKindLabel(kind))}</h3>
    <div class="msub">${esc(periodLabel(per))} · сейчас <b>${rub(cur)} ₽</b> ${live.length > 1 ? `(${live.length} записей)` : ''}</div>
    <label class="flbl">Новая сумма</label>
    <input class="input" id="epVal" inputmode="numeric" autocomplete="off" value="${rub(cur)}">
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
      for (const row of live) await store.reverseMoneyLine(row);          // по одной: база проверяет каждую
      if (newKop > 0) await store.addMoneyLine({ employee_id: empId, period: per, kind, amount_kop: newKop, note: 'исправление суммы' });
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
/* «Убрать все выплаты за месяц» — когда бухгалтер начислила всем скопом и надо
   откатить целиком. Спрашиваем отдельно и показываем итог: это самое крупное
   действие в окне. */
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
    modalOnClose2 = () => resolve(false);          // крестик/Escape = «Отмена»
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

/* Правка ИТОГОВОЙ зарплаты кликом по строке «Зарплата». Это та же «финальная
   сумма вручную» (month_salary_override), что и в поле ниже, но открывается там,
   где человек смотрит на неверную сумму — по просьбе Дарины, тем же жестом, что
   и правка выплат.
   ⚠ Отличие от выплат: здесь НЕ сторно. Выплата — событие («выдали 5-го»), её
   нельзя стереть, только погасить встречной. А итоговая зарплата — не событие,
   а решение «сколько человек заработал»; оно одно на месяц, и его меняют.
   Каждое изменение и так видно владельцу в журнале. */
/* Перенос остатка с прошлого месяца (миграция 067). Вводим ПОЛОЖИТЕЛЬНОЕ число
   переплаты — так его прислала Дарина в файле и так его считают на бумаге, — а в
   базу пишем со знаком минус: перенос складывается с остальными деньгами в общей
   формуле, без отдельных ветвлений. Плюс в базе означает недоплату клиники. */
/* Перенос остатков предыдущего месяца одним действием. Не делаем это само собой
   при открытии месяца: пока прошлый месяц не сведён, его цифры ещё двигаются —
   Дарина как раз вписывала суммы, пока я работал, — и записанный заранее перенос
   молча устарел бы. Кнопка даёт момент, когда человек решает «прошлый месяц
   готов». Уже проставленные вручную переносы не трогаем. */
async function carryFromPrev(per, onDone) {
  let r;
  try { r = await store.listPrevRemainder(per); }
  catch (e) { toast(e.message || e, true); return; }
  const have = new Set(payrollRows.filter(x => x.carry_kop).map(x => x.employee_id));
  const fresh = r.rows.filter(x => !have.has(x.employee_id));
  const sum = fresh.reduce((a, x) => a + x.delta_kop, 0);
  if (!r.rows.length) { toast(`За ${periodLabel(r.prev)} переплат нет — переносить нечего`); return; }
  if (!fresh.length) { toast('Все переносы за этот месяц уже проставлены'); return; }
  const list = fresh.slice(0, 12).map(x =>
    `<div class="me-row"><span class="muted">${esc(x.fio)}</span><b class="money neg">${rub(x.delta_kop)} ₽</b></div>`).join('');
  showModal2(`<h3>Перенести остатки за ${esc(periodLabel(r.prev))}?</h3>
    <div class="msub">${fresh.length} чел на <b>${rub(Math.abs(sum))} ₽</b> — эта сумма уменьшит «Осталось выдать»
      за ${esc(periodLabel(per))}${have.size ? `. Уже проставленные вручную (${have.size}) не трогаем` : ''}.</div>
    <div class="rc-diff" style="max-height:220px;overflow:auto">${list}${
      fresh.length > 12 ? `<div class="muted small">…и ещё ${fresh.length - 12}</div>` : ''}</div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="cpNo">Отмена</button>
      <button class="btn btn-primary btn-sm" id="cpYes">${ICONS.check}Перенести</button></div>`);
  modalOnClose2 = () => {};
  $('cpNo').onclick = closeModal2;
  $('cpYes').onclick = async () => {
    const b = $('cpYes'); if (b.disabled) return; b.disabled = true;
    b.textContent = 'Переношу…';
    let done = 0;
    try {
      // по одному, а не пачкой: у каждой записи свой журнальный след, и если
      // на середине что-то отвалится, уже перенесённое останется на месте
      for (const x of fresh) {
        await store.setCarry(x.employee_id, per, x.delta_kop, `остаток за ${periodLabel(r.prev)}`);
        done++;
      }
      closeModal2(); toast(ICONS.check + `Перенесено: ${done} чел`); if (onDone) await onDone();
    } catch (err) {
      closeModal2();
      toast(`Перенесено ${done} из ${fresh.length}, дальше ошибка: ${err.message || err}`, true);
      if (onDone) await onDone();
    }
  };
}
async function editCarry(empId, per, onDone, row) {
  const src = row || payrollRows.find(x => x.employee_id === empId) || {};
  const fio = src.fio || '';
  const cur = src.carry_kop || 0;
  const over = cur < 0;                                   // переплата — обычный случай
  showModal2(`<h3>С прошлого месяца</h3>
    <div class="msub">${esc(fio)} · ${esc(periodLabel(per))}${cur ? ` · сейчас <b>${rub(cur)} ₽</b>` : ''}</div>
    <label class="flbl">Переплатили в прошлом месяце</label>
    <input class="input" id="ecVal" inputmode="numeric" autocomplete="off" value="${cur ? fmt(Math.round(Math.abs(cur) / 100)) : ''}" placeholder="напр. 19 589">
    <input class="input" id="ecNote" placeholder="причина (необязательно)" autocomplete="off" style="margin-top:8px" value="">
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
      await store.setCarry(empId, per, -Math.round(v * 100), $('ecNote').value.trim() || null);
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

async function payrollDialog(empId) {
  const r = payrollRows.find(x => x.employee_id === empId); if (!r) return;
  // Месяц ФИКСИРУЕМ здесь и дальше пользуемся только `per`. Ниже два запроса к
  // базе, и всё это время окна ещё нет — modalOpen() = false, dataset.guard не
  // выставлен, — значит payPeriod свободно уводят и ‹/›, и «назад», и открытая
  // ссылка. Строка `r` при этом снята ДО ожидания. Без фиксации заголовок печатал
  // бы один месяц, суммы показывал другой, а запись уходила бы в третий — и это
  // деньги, которые потом только сторнировать.
  const per = payPeriod;
  // ТОТ ЖЕ linesFor, что и в таблице «Расчёт». Раньше модалка брала сырые дневные
  // строки и из-за этого показывала «Оклад · 20 из 20 · 0 ₽» (у оклада дневные
  // деньги всегда 0, он месячный), а процент и фикс теряла вовсе — то есть на
  // вопрос «откуда взялась эта сумма» не отвечала. Один источник — модалка и
  // ведомость больше не могут разойтись.
  const my = linesFor(r);
  const canEdit = isStaff();
  // Ставки берём ПО ПЕРИОДУ ведомости, а не «действующие сейчас»: база в
  // v_month_salary (036 §pctr) спрашивает перекрытие с месяцем. Иначе у врача с
  // закрытой процентной строкой выручку за прошлый месяц было бы не ввести, хотя
  // база её на процент умножит.
  const emp = employees.find(e => e.id === empId);
  const inPeriod = l => l.valid_from < nextPeriodStart(per) && (!l.valid_to || l.valid_to > per + '-01');   // ← per, не payPeriod: месяц зафиксирован выше
  const periodLines = (emp && emp.lines ? emp.lines : []).filter(inPeriod);
  const pctLine = periodLines.find(l => l.pay_kind === 'процент');
  // сдельщик: вид оплаты «сдельно» (055) — пометка «сумму называют готовым числом».
  // Отдельного поля ему НЕ даём: сумма живёт в «Финальной сумме вручную» ниже,
  // просто подписываем блок так, чтобы было видно — это норма, а не костыль.
  const piece = periodLines.some(l => l.pay_kind === 'сдельно');
  let curRev = 0;
  if (pctLine && canEdit) { try { curRev = await store.getDoctorRevenue(empId, per); } catch (e) {} }
  let curOverride = null;                                 // финальная сумма вручную (миграция 049)
  if (canEdit) { try { curOverride = await store.getSalaryOverride(empId, per); } catch (e) {} }
  // Пока ждали базу, месяц или экран могли смениться. Диалог тогда уже не про то,
  // что перед человеком: молча уходим, строку он откроет заново.
  if (payPeriod !== per || curScreen !== 'payroll') return;
  setEditing('payroll:' + empId + ':' + per);   // деньги — самое дорогое место для двойной правки
  // Норма часов нужна ДВАЖДЫ: в формуле оклада ниже и в подзаголовке «норма · факт».
  // Считаем ОДИН раз и здесь, до первого использования. Раньше её брали только
  // внутри подзаголовка, а formula ниже обращалась к `nh` из чужой области — и у
  // всех, у кого есть хоть одно начисление, окно падало с ReferenceError и просто
  // не открывалось. На демо не воспроизводилось: у тестового сотрудника начислений
  // нет, ветка с формулой не строится вовсе.
  const _nrm = payrollNorms.get(empId);
  const nh = _nrm && _nrm.hours != null ? parseFloat(_nrm.hours) : null;
  const breakdown = my.length
    ? my.map(l => { const f = rateFormula(l, r, nh, emp);
        return `<div class="me-row me-calc"><span class="muted">${esc(payKindLabel(l.kind))}${l.sub ? ' · ' + esc(l.sub) : ''}${l.isPct ? '' : ` · ${l.worked} из ${l.planned}`}${
          f ? `<i class="me-f">${esc(f)}</i>` : ''}</span><b>${rub(l.money_kop)} ₽</b></div>`; }).join('')
    // При ручной сумме «Начислений за месяц нет · 0 ₽» стоял бы прямо над
    // «Зарплата 175 000» и читался как противоречие. Пишем причину словами:
    // именно на вопрос «откуда взялась эта сумма» модалка и должна отвечать.
    : `<div class="me-row"><span class="muted">${
        r.flag_manual_salary ? 'Сумма вписана вручную — расчёт по графику не применялся'
        : piece ? 'Сдельно — сумму за месяц вписывают ниже'
        : r.flag_no_rate ? 'Ставка не заведена' : 'Начислений за месяц нет'
      }</span>${r.flag_manual_salary || piece ? '' : '<b>0 ₽</b>'}</div>`;
  const pct = '';   // процент теперь приходит строкой из linesFor()

  // ФИО берём из строки расчёта (v_month_total) — это имя, под которым человек
  // идёт в ведомости; специальность из карточки. emp может не найтись (список
  // карточек урезан ролью) — тогда останется одно ФИО, без строки специальности.
  showModal(`${personHead({ fio: r.fio, specialty_id: emp?.specialty_id },
      `${esc(periodLabel(per))} · ${(() => {
        const fh = Number(r.fact_hours) || 0;
        // Часы — если норма задана. Иначе дни, как было: у сменщиков без нормы
        // говорить «норма — ч» бессмысленно, а дни им как раз о чём-то говорят.
        return nh != null ? `норма ${fmtH(nh)} · факт ${fmtH(fh)}`
                          : `норма ${r.norm_days} дн · факт ${r.fact_days} дн`;
      })()}`)}
    <div class="rc-diff">
      <div class="me-cap">Заработано</div>
      ${breakdown}${pct}
      <div class="me-row me-sum${canEdit ? ' me-tap' : ''}"${canEdit ? ' id="pmSalaryRow" title="Задать итоговую зарплату вручную"' : ''}><span>Зарплата${r.flag_manual_salary ? ' · <b class="jact">вручную</b>' : ''}</span><b>${rub(r.salary_kop)} ₽</b>${canEdit ? `<span class="me-pen">${ICONS.pencil || '✎'}</span>` : ''}</div>
      ${payRow('Премия', r.premia_kop, 'premia', canEdit)}
      ${payRow('Отпускные начислено', r.otpusk_nach_kop, 'otpusk_nach', canEdit)}
      ${payRow('Больничные начислено', r.bolnich_nach_kop, 'bolnich_nach', canEdit)}
      <div class="me-row me-sum me-earned"><span>Всего заработано</span><b class="money">${rub(earned(r))} ₽</b></div>
      ${(r.card_avans_kop || r.card_rasch_kop || r.card_uvol_kop || r.otpusk_kop
        || r.bolnich_kop || r.cash_kop || r.cash_avans_kop || r.otpusk_cash_kop)
        ? '<div class="me-cap">Выдано</div>' : ''}
      ${payRow('Аванс на карту', r.card_avans_kop, 'card_avans', canEdit)}
      ${payRow('ЗП на карту', r.card_rasch_kop, 'card_rasch', canEdit)}
      ${payRow('Расчёт на карту (увольнение)', r.card_uvol_kop, 'card_uvol', canEdit)}
      ${payRow('Отпускные на карту', r.otpusk_kop, 'otpusk', canEdit)}
      ${payRow('Больничные на карту', r.bolnich_kop, 'bolnich', canEdit)}
      ${payRow('Наличными', r.cash_kop, 'cash', canEdit)}
      ${payRow('Аванс наличными', r.cash_avans_kop, 'cash_avans', canEdit)}
      ${payRow('Отпускные наличными', r.otpusk_cash_kop, 'otpusk_cash', canEdit)}
      ${cardTotal(r) ? `<div class="me-row me-sum me-card"><span>Всего на карту</span><b class="money">${rub(cardTotal(r))} ₽</b></div>` : ''}
      ${r.carry_kop || canEdit ? `<div class="me-row me-sum cp-carry${canEdit ? ' me-tap' : ''}"${canEdit ? ' title="Изменить или убрать перенос"' : ''}>
        <span class="muted">С прошлого месяца</span><b class="money${(r.carry_kop || 0) < 0 ? ' neg' : ''}">${r.carry_kop ? rub(r.carry_kop) + ' ₽' : '—'}</b>
        ${canEdit ? '<span class="me-pen">\u270E</span>' : ''}</div>` : ''}
      <div class="me-row me-sum"><span>Осталось выдать</span><b class="money${(r.delta_kop || 0) < 0 ? ' neg' : ''}">${rub(r.delta_kop)} ₽</b></div>
      <div class="me-row"><span class="muted small">«Всего заработано» минус всё уже выданное — на карту и наличными — плюс перенос с прошлого месяца. Столько ещё раздать, в основном наличными.<br>Начисленные отпускные и больничные <b>входят</b> в заработок, а выплаченные — вычитаются: если начислили и выплатили поровну, на разницу они не влияют.</span></div>
      ${r.to_pay_kop ? `<div class="me-row"><span class="muted small">Записано в кассу наличными (Бух 1)</span><span class="small">${rub(r.to_pay_kop)} ₽</span></div>` : ''}</div>
    ${pctLine && canEdit ? `<label class="flbl">Выручка за месяц · ЗП = ${esc(String(pctLine.percent))}% от неё</label>
      <div class="me-add">
        <input class="input" id="pmRev" placeholder="выручка ₽" autocomplete="off" inputmode="numeric" value="${curRev ? fmt(Math.round(curRev / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmRevSave">${ICONS.check}Сохранить</button>
      </div>
      <div class="msub">Для процентников считаем ЗП от введённой выручки (оплаты пациентов пока неполные). Изменение выручки видит владелец в журнале.</div>` : ''}
    ${canEdit ? `<label class="flbl">${piece ? 'Сумма за месяц · сдельно' : 'Финальная сумма вручную'}${r.flag_manual_salary ? ' · <span class="jact">задана</span>' : ''}</label>
      <div class="me-add">
        <input class="input" id="pmFinal" placeholder="итоговая зарплата ₽" autocomplete="off" inputmode="numeric" value="${curOverride ? fmt(Math.round(curOverride / 100)) : ''}">
        <button class="btn btn-primary btn-sm" id="pmFinalSave">${ICONS.check}${r.flag_manual_salary ? 'Изменить' : 'Задать'}</button>
        ${r.flag_manual_salary ? `<button class="btn btn-ghost btn-sm" id="pmFinalClear">Убрать</button>` : ''}
      </div>
      <input class="input" id="pmFinalNote" placeholder="причина (необязательно): напр. «по ведомости, без графика»" autocomplete="off" style="margin-top:8px;width:100%">
      <div class="msub">${piece ? 'У этого человека вид оплаты «сдельно» — сумму за месяц называют готовым числом, это штатный путь, а не исключение. ' : 'Для людей без графика: '}Итоговая зарплата за месяц одной суммой. Заменяет расчёт → «осталось» = эта сумма − выданное на карту/наличными. Причина и каждое изменение видны владельцу — в журнале и в «Требует внимания».</div>` : ''}
    ${canEdit ? `<label class="flbl">Внести деньги</label>
      <div class="me-add">
        <select class="input" id="pmKind">${moneyKindsFor(store.me()?.role).map(k => `<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
        <input class="input" id="pmSum" placeholder="сумма ₽" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="pmAdd">${ICONS.plus}Внести</button>
      </div>
      <div class="msub">Записи не правятся: ошибку исправляют сторно — обе записи видны владельцу.${store.me()?.role === 'operator' ? ' Премию вносит владелец.' : ''}</div>` : ''}
    ${canEdit && recorded(r) ? `<div class="me-row" style="margin-top:10px"><span class="muted small">Начислили лишнего всем скопом?</span><button class="btn btn-ghost btn-sm" id="pmUndoAll">Убрать все выплаты за месяц</button></div>` : ''}
    <div class="me-jump">
      <button class="btn btn-ghost btn-sm" id="pmToCard">${ICONS.user || ''}Карточка</button>
      <button class="btn btn-ghost btn-sm" id="pmToSched">${ICONS.calendar || ''}График</button>
    </div>
    <label class="flbl" style="margin-top:12px">Кто внёс и когда</label>
    <div id="pmHist" class="pm-hist"><span class="muted small">загружаем…</span></div>
    <div class="modal-foot"><button class="btn btn-ghost btn-sm" id="pmClose">Закрыть</button></div>`);
  $('modalBox').dataset.guard = '1';                    // деньги — не закрывать случайным кликом
  const reopen = async () => { await renderPayroll($('payrollSearch')?.value || ''); closeModal(); payrollDialog(empId); };
  $('modalBox').querySelectorAll('.me-row.me-tap[data-kind]').forEach(el => el.onclick = () => editPayout(empId, per, el.dataset.kind, reopen));
  $('modalBox').querySelectorAll('.cp-carry.me-tap').forEach(el => el.onclick = () => editCarry(empId, per, reopen, r));
  if ($('pmSalaryRow')) $('pmSalaryRow').onclick = () => editSalary(empId, per, r, reopen);
  if ($('pmUndoAll')) $('pmUndoAll').onclick = () => undoAllPayouts(empId, per, reopen);
  if ($('pmToCard')) $('pmToCard').onclick = () => focusOn('employees', empId) || openCard(empId);
  if ($('pmToSched')) $('pmToSched').onclick = () => focusOn('schedule', empId);
  $('pmClose').onclick = closeModal;

  const loadHist = async () => {
    try {
      const ev = await store.listMoneyEvents(empId, per);
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
      await store.addMoneyLine({ employee_id: empId, period: per,
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
      const res = await store.setDoctorRevenue(empId, per, Math.round(rev * 100));
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + (res ? 'Выручка внесена — зарплата пересчитана' : 'Без изменений'));
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  // Финальная сумма вручную: задать/изменить (миграция 049). Заменяет «заработал».
  if (canEdit) $('pmFinal').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pmFinalSave').click(); } };
  if (canEdit) $('pmFinalSave').onclick = async () => {
    const btn = $('pmFinalSave'); if (btn.disabled) return;
    let val;
    try { val = parseNum($('pmFinal').value, { thousands: true, field: 'сумму', max: RATE_ABSURD }); }
    catch (err) { toast(err.message, true); return; }
    if (val == null || val <= 0) { toast('Укажите сумму больше 0 (или «Убрать»)', true); return; }
    if (val > RATE_CONFIRM && !(await confirmBigAmounts([val]))) return;
    btn.disabled = true;
    try {
      const note = $('pmFinalNote')?.value.trim() || null;   // причина (необязательно) → в журнал
      await store.setSalaryOverride(empId, per, Math.round(val * 100), note);
      await renderPayroll($('payrollSearch')?.value || '');
      toast(ICONS.check + 'Финальная сумма задана — «осталось» пересчитано');
      closeModal(); payrollDialog(empId);
    } catch (err) { btn.disabled = false; toast(err.message || err, true); }
  };
  if (canEdit && r.flag_manual_salary) $('pmFinalClear').onclick = async () => {
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

/* ── Обзор владельца ─────────────────────────────────────────────────────
   Затверджений дизайн — renderPhone у прототипі (hero «Всего к выдаче», плитки,
   «Требует внимания», «Последние выдачи», подпись «из неизменяемого журнала»).
   Дельта: цифры реальные из v_month_total; появились ВЫДАНО/ОСТАТОК (payout);
   «Требует внимания» строится из настоящих флагов + красных записей журнала, и
   каждый пункт КЛИКАБЕЛЕН на нужный экран. График «Наличка по дням» отложен —
   он пуст до первого дня выдач (3b-6), рисовать диаграмму нулевого ряда рано. */
let ovPeriod = null, ovData = null, ovSeq = 0;
function shiftOvMonth(d) { if (!ovPeriod) ovPeriod = nowPeriod(); let [y, m] = ovPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } ovPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = ovPeriod; syncHash(false); renderOverview(); }

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
  // Ручная финальная сумма — прямой рычаг на «осталось выдать» в обход графика.
  // Не красная (это законный способ для людей без графика), но владелец ДОЛЖЕН её
  // видеть: иначе оператор мог бы ручной суммой погасить красный флаг незаметно
  // (находка аудита F2). Каждая правка ещё и в журнале (миграция 052, fail-closed).
  { key: 'flag_manual_salary', red: false, t: 'Сумма задана вручную', d: 'зарплата вписана рукой, не из графика — сверьте с выданным' },
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
  // Месяц не загрузился — откатываем ovPeriod к тому, что РЕАЛЬНО на экране, а не
  // только заголовок. Иначе расходятся три вещи: данные (старый месяц), ‹/› (шагали
  // бы от несостоявшегося) и адрес, который теперь называет месяц вслух и который
  // человек перешлёт — получатель уехал бы в месяц, которого отправитель не видел.
  } catch (e) { if (seq === ovSeq) { toast(e.message || e, true); ovPeriod = ovData?.period || want; workPeriod = ovPeriod; $('oLabel').textContent = periodLabel(ovPeriod); syncHash(false); } return; }
  if (seq !== ovSeq) return;                       // месяц сменили, пока грузили
  ovData = { rows, remarks, payouts, period: want };
  $('oLabel').textContent = periodLabel(want);
  drawOverview();
}

function drawOverview() {
  if (!ovData) return;
  const { rows, remarks, payouts } = ovData;
  const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const salary = sum('salary_kop');
  // Плюсы и минусы НЕ складываем (решение Дарины 01.08). Раньше главное число
  // было суммой всех разниц: переплата одному тихо гасила недоплату другому, и
  // владелец видел меньше, чем предстоит раздать на руки. Теперь «Осталось
  // выдать» — только положительные, а переплата вперёд — своей строкой: это не
  // деньги к выдаче, а остаток, уезжающий в следующий месяц.
  const toGive = rows.reduce((a, r) => a + Math.max(0, r.delta_kop || 0), 0);
  const overpaid = rows.reduce((a, r) => a + Math.min(0, r.delta_kop || 0), 0);
  const overCnt = rows.filter(r => (r.delta_kop || 0) < 0).length;
  // Всё официальное, что ушло на карту: аванс + ЗП + расчёт при увольнении + ОТПУСКНЫЕ
  // НА КАРТУ. Последние сюда не входили, и плитка «Официально на карту» занижала
  // сумму ровно на реестр ТКБ (в июле — 635 000 ₽), хотя в «Расчёте» рядом стоит
  // графа «Отпуск. карта» с этим же числом. Это ИМЕННО ТА цифра, что показывает,
  // сколько прошло официально, — занижать её нельзя. В Δ отпускные по-прежнему не
  // входят (033), а подстрочник героя тождеством никогда и не был.
  const card = sum('card_rasch_kop') + sum('card_avans_kop') + sum('otpusk_kop') + sum('bolnich_kop');
  const uvol = sum('card_uvol_kop');            // расчёт при увольнении — тоже безнал, но своей строкой
  const paid = sum('paid_kop');
  // «Начислено» — это ВСЁ, что человеку причитается за месяц, а не одна зарплата:
  // премия, начисленные отпускные и больничные — тоже начисления, и без них
  // главная цифра занижена. За июль зарплата 7 317 731, а начислено 8 044 829.
  const premia = sum('premia_kop'), otpNach = sum('otpusk_nach_kop'), bol = sum('bolnich_nach_kop');
  const accrued = salary + premia + otpNach + bol;
  const carry = sum('carry_kop');                                   // перенос с прошлого месяца, со знаком
  const cash = sum('cash_kop') + sum('cash_avans_kop') + sum('otpusk_cash_kop');
  const people = rows.filter(r => r.status === 'active').length;

  // hero + плитки. Главное число — «Осталось выдать» = Δ (начислено − выданное),
  // т.е. сколько ещё раздать людям (в осн. наличными), если все вышли по графику.
  const metric = (l, v, cls, gc) => `<div class="ov-metric${cls ? ' ' + cls : ''}"${gc ? ` style="--gc:${gc}"` : ''}><div class="l">${l}</div><div class="v">${v}</div></div>`;
  // Полная раскладка месяца: начислено → выдано → осталось. Раньше в подстрочнике
  // стояла только зарплата и карта, и сойтись это ни с чем не могло: премия,
  // отпускные, больничные и перенос в них не входили.
  const line = (l, v, cls) => `<div class="ov-line${cls ? ' ' + cls : ''}"><span>${l}</span><b>${v}</b></div>`;
  const hero = `<div class="ov-hero"><div class="l">Осталось выдать · ${esc(periodLabel(ovData.period))}</div>`
    + `<div class="v big">${rub(toGive)} <small>₽</small></div>`
    + (overpaid ? `<div class="ov-over">Переплата вперёд: <b>−${rub(Math.abs(overpaid))} ₽</b>`
        + `<span class="muted small"> · ${overCnt} чел · выдано больше начисленного, перейдёт на следующий месяц</span></div>` : '')
    + `<div class="ov-break">`
      + line('Начислено всего', rub(accrued) + ' ₽', 'sum')
      + line('· зарплата', rub(salary) + ' ₽', 'sub')
      + (premia ? line('· премии', rub(premia) + ' ₽', 'sub') : '')
      + (otpNach ? line('· отпускные', rub(otpNach) + ' ₽', 'sub') : '')
      + (bol ? line('· больничные', rub(bol) + ' ₽', 'sub') : '')
      + (carry ? line('С прошлого месяца', (carry < 0 ? '−' : '') + rub(Math.abs(carry)) + ' ₽', 'sub neg') : '')
      + line('Выдано', rub(card + uvol + cash) + ' ₽', 'sum')
      + line('· на карту', rub(card) + ' ₽', 'sub')
      + (uvol ? line('· расчёт при увольнении', rub(uvol) + ' ₽', 'sub') : '')
      + (cash ? line('· наличными', rub(cash) + ' ₽', 'sub') : '')
    + `</div></div>`;
  const bento = `<div class="ov-bento">`
    + metric('Начислено всего', rub(accrued) + ' ₽', '', 'rgba(139,123,232,.34)')
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
    + `<div class="ov-sec">Кто в программе</div><div class="card" id="ovPresence"><span class="muted small" style="padding:14px 18px;display:block">смотрим…</span></div>`
    + `<div class="ov-sec">Последние выдачи</div><div class="card">${paysHtml}</div>`
    + `<div class="note ov-note">${ICONS.lock}Все суммы — из неизменяемого журнала</div>`;
  drawPresenceBlock();

  $('overviewBody').querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    // Месяц «Обзора» переносим на целевой экран: плашка посчитана по ovPeriod, и
    // без этого клик по июньскому флагу открывал «Расчёт» за август — владелец шёл
    // разбирать флаг в месяц, где его нет. Теперь этот месяц ещё и в адресе,
    // который перешлют, так что расхождение стало видимым и заразным.
    if (b.dataset.go === 'payroll' && ovPeriod) payPeriod = ovPeriod;
    if (b.dataset.go === 'journal-red') { journalFilter = 'red'; go('journal'); renderJournal(true); }
    else go(b.dataset.go);
  });
}

/* Итоговые строки держатся внизу таблицы, а не ждут, пока домотаешь сотню
   человек (Дарина 03.08). Строк ТРИ — «Итого», «Всего начислено», иногда
   «Переплата вперёд», — и одним CSS их не приморозить: с bottom:0 они легли бы
   друг на друга. Поэтому считаем каждой свой отступ снизу = высота строк под
   ней. Пересчитываем после каждой отрисовки: состав строк и высоты меняются. */
function stickFooterRows(host) {
  // Нас зовут из go() — до всякой отрисовки и для любой роли. Если узла нет,
  // выйти надо молча: исключение здесь оборвало бы go() на середине, не дойдя
  // ни до меню, ни до адреса.
  if (!host) return;
  // Только .pw-total: приморожены к низу именно они, и лесенка складывается из их
  // высот. Обычная строка в tfoot (появись она) сдвинула бы отсчёт на свою высоту.
  const rows = [...host.querySelectorAll('tfoot tr.pw-total')];
  // На СКРЫТОМ экране (display:none) высоты меряются нулями — посчитать лесенку
  // тут нельзя в принципе, поэтому и не пробуем. Считает её go() в момент, когда
  // экран показан: там высоты настоящие. Записать нули было бы даже хуже — они
  // прикидываются посчитанными.
  if (!host.offsetParent && getComputedStyle(host).position !== 'fixed') return;
  let acc = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const h = rows[i].getBoundingClientRect().height;
    rows[i].style.bottom = acc + 'px';
    acc += h;
  }
}

/* ── «Кто в программе» ──────────────────────────────────────────────────
   Владельцу — подробно: экран, месяц, сколько правок за час (из журнала, то есть
   из аудита, а не со слов браузера). Остальным — просто кто онлайн: видимость
   взаимная по решению Дарины, скрытое наблюдение стоило бы доверия дороже.

   «Была 4 минуты назад» вместо голого «офлайн» — ради этого всё и делалось:
   Милена заходит периодически и решает, писать человеку сейчас или он уже ушёл. */
const SCREEN_RU = { overview: 'Обзор', gaps: 'Пробелы', vacation: 'Отпуска', archive: 'Архив', employees: 'Сотрудники', card: 'Карточка',
  schedule: 'График', payroll: 'Расчёт', rates: 'Ставки', patients: 'Оплаты пациентов',
  import: 'Импорт', specialties: 'Специальности', journal: 'Журнал', soon: '—' };
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
// Остальным ролям — компактная строка в шапке: только сколько человек в программе
// и кто именно. Экраны и правки им не показываем, это не их дело.
async function drawPresenceTop() {
  const el = $('presTop'); if (!el || isOwner()) return;
  const rows = (await loadPresence()).filter(p => p.user_id !== store.me()?.id && p.online);
  el.innerHTML = rows.length
    ? `<span class="prs-dot on"></span>${esc(rows.map(p => p.display_name).filter(Boolean).join(', '))}`
    : '';
}

/* ── Пробелы ────────────────────────────────────────────────────────────
   Рабочий список «что дозаполнить». Обзор даёт те же флаги счётчиками и уводит
   на Расчёт — там их надо ещё найти глазами среди сотни строк. Здесь каждый
   флаг развёрнут пофамильно и ведёт на экран, где это чинится.

   Две проверки живут только тут, в v_month_total их нет:
   · «нет графика за месяц» — norm_days и fact_days оба пустые. На июль это
     30 человек из 102, то есть самая большая дыра, а на Обзоре её не видно;
   · дыры в карточке (фамилия-заглушка, телефон, специальность) — они не
     денежные, но без телефона не отправить код подтверждения выдачи.

   Считает по-прежнему база: берём готовый v_month_total, здесь только
   раскладка. Фильтр скрытой зарплаты (миграции 040/041) сидит внутри вьюхи,
   поэтому этот экран его не обходит. */
let gapsPeriod = null, gapsData = null, gapsSeq = 0;

/* ── ОТПУСКА ───────────────────────────────────────────────────────────────
   График и деньги по отпускам живут порознь, и расходятся сильно: за июль из
   двадцати человек, кого отпуск коснулся, сошлось у четверых. У четырнадцати
   отпускные начислены или выданы, а дней в графике нет вовсе; у двоих наоборот —
   двадцать и пять дней проставлены, а денег ноль. Увидеть это было неоткуда:
   в «Расчёте» видны суммы, в «Графике» дни, вместе их никто не сводил.
   Отдельная таблица в базе не нужна — всё считается из того, что уже есть. */
let vacPeriod = null, vacData = null, vacSeq = 0;

/* ── АРХИВ ─────────────────────────────────────────────────────────────────
   Архивных 31 человек, и увидеть их можно было только кнопкой «Показать архив»
   внутри «Сотрудников» — то есть если знать, что она там есть. При этом за
   архивным могут висеть деньги: Частухина отправили в архив с 27 000 ₽ к
   выдаче, и заметили это случайно.
   Экран отвечает на три вопроса: кто в архиве, когда его туда убрали и не
   осталось ли за ним долга. Отсюда же возвращаем в активные. */
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
  arcRows = emps.filter(e => e.status === 'archived').map(e => {
    const r = money.get(e.id) || {};
    return { id: e.id, fio: e.fio || '—', spec: specName(e.specialty_id),
             left_on: e.left_on || null, delta: r.delta_kop || 0, salary: r.salary_kop || 0 };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.fio.localeCompare(b.fio, 'ru'));
  drawArchive();
}

function drawArchive() {
  const f = ($('arcSearch')?.value || '').trim().toLowerCase();
  const onlyMoney = !!$('arcOnlyMoney')?.checked;
  const list = arcRows.filter(x => (!f || x.fio.toLowerCase().includes(f)) && (!onlyMoney || x.delta));
  const withMoney = arcRows.filter(x => x.delta).length;
  const noLeft = arcRows.filter(x => !x.left_on).length;
  $('arcStat').innerHTML = `<span class="mini-chip neutral">${arcRows.length} чел</span>`
    + (withMoney ? `<span class="mini-chip">с деньгами: ${withMoney}</span>` : '')
    + (noLeft ? `<span class="mini-chip neutral">без даты увольнения: ${noLeft}</span>` : '');

  $('arcBody').innerHTML = list.length ? `<div class="gridwrap"><table class="pw arc"><thead><tr>
      <th class="pw-name">Сотрудник</th><th>Специальность</th><th>Дата увольнения</th>
      <th class="num">Начислено</th><th class="num pw-pay">Осталось выдать</th><th></th></tr></thead><tbody>${
    list.map(x => `<tr class="arc-row${x.delta ? ' arc-money' : ''}">
      <td class="pw-name"><span class="pw-fio">${esc(x.fio)}</span>${
        x.delta ? '<span class="mini-chip">остались деньги</span>' : ''}</td>
      <td class="muted">${esc(x.spec)}</td>
      <td>${x.left_on ? esc(dmy(x.left_on)) : '<span class="muted">не проставлена</span>'}</td>
      <td class="num fin">${x.salary ? rub(x.salary) : '<span class="muted">—</span>'}</td>
      <td class="num pw-pay fin">${x.delta ? `<b class="money${x.delta < 0 ? ' neg' : ''}">${rub(x.delta)}</b>` : '<span class="muted">—</span>'}</td>
      <td class="num"><button class="btn btn-ghost btn-sm arc-back" data-id="${x.id}">Вернуть</button>
        <button class="btn btn-ghost btn-sm arc-hist" data-fio="${esc(x.fio)}">История</button></td></tr>`).join('')
    }</tbody></table></div>`
    : `<div class="empty">${arcRows.length ? 'Никого не нашлось по этому условию.' : 'Архив пуст.'}</div>`;

  $('arcBody').querySelectorAll('.arc-row .pw-name').forEach((td, i) =>
    td.onclick = () => openCard(list[i].id));
  // «История» — тот же журнал, но сразу отфильтрованный по этому человеку:
  // ответ на «кто и когда его убрал» лежит именно там.
  $('arcBody').querySelectorAll('.arc-hist').forEach(b => b.onclick = () => {
    jWho = (b.dataset.fio.split(' ')[0] || '').trim(); jAct = jFrom = jTo = '';
    go('journal'); renderJournal(true);
  });
  $('arcBody').querySelectorAll('.arc-back').forEach(b => b.onclick = async () => {
    const x = list.find(y => y.id === +b.dataset.id); if (!x) return;
    if (!(await confirmBack(x))) return;
    b.disabled = true;
    try { await store.updateEmployee(x.id, { status: 'active' });
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


/* Дни отпуска идут подряд, поэтому показываем ПЕРИОДАМИ, а не списком чисел:
   «11–31 июля» вместо двадцати одной даты. Разрыв больше суток — новый период
   (человек мог уйти дважды за месяц). */
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

async function renderVacation() {
  if (!isStaff()) { $('vacBody').innerHTML = ''; return; }
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
  const byEmp = new Map();
  for (const c of (cells || [])) {
    if (c.plan_kind !== 'отпуск') continue;
    if (!byEmp.has(c.employee_id)) byEmp.set(c.employee_id, []);
    byEmp.get(c.employee_id).push(c.work_date);
  }
  vacData = { rows, emps, days: byEmp, period: want };
  drawVacation();
}

function drawVacation() {
  if (!vacData) return;
  const { rows, emps, days } = vacData;
  const f = ($('vacSearch')?.value || '').trim().toLowerCase();
  const flat = !!$('vacFlat')?.checked;
  const empOf = new Map(emps.map(e => [e.id, e]));
  const rowOf = new Map(rows.map(r => [r.employee_id, r]));

  // берём всех, у кого есть ЛИБО дни отпуска, ЛИБО отпускные деньги
  const ids = new Set([...days.keys()]);
  for (const r of rows) if (r.otpusk_nach_kop || r.otpusk_kop || r.otpusk_cash_kop) ids.add(r.employee_id);

  const list = [...ids].map(id => {
    const e = empOf.get(id) || {}, r = rowOf.get(id) || {};
    const dts = days.get(id) || [];
    const nach = r.otpusk_nach_kop || 0, card = r.otpusk_kop || 0, cash = r.otpusk_cash_kop || 0;
    return { id, fio: e.fio || r.fio || '—', cat: specCat(e.specialty_id), dts,
             spans: vacSpans(dts), nach, card, cash, paid: card + cash,
             noDays: dts.length === 0, noMoney: dts.length > 0 && !nach && !card && !cash };
  }).filter(x => !f || x.fio.toLowerCase().includes(f))
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
    + (tot.noMoney ? `<span class="mini-chip">график без денег: ${tot.noMoney}</span>` : '');

  const row = x => `<tr class="vac-row${x.noDays ? ' vac-bad' : ''}${x.noMoney ? ' vac-warn' : ''}" data-id="${x.id}">
    <td class="pw-name"><span class="pw-fio">${esc(x.fio)}</span>${
      x.noDays ? '<span class="mini-chip warn">нет в графике</span>'
      : x.noMoney ? '<span class="mini-chip warn">нет отпускных</span>' : ''}</td>
    <td>${x.dts.length ? esc(vacSpanLabel(x.spans)) : '<span class="muted">—</span>'}</td>
    <td class="num">${x.dts.length || '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.nach ? rub(x.nach) : '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.card ? rub(x.card) : '<span class="muted">—</span>'}</td>
    <td class="num fin">${x.cash ? rub(x.cash) : '<span class="muted">—</span>'}</td>
    <td class="num fin"><b class="money${x.nach - x.paid < 0 ? ' neg' : ''}">${rub(x.nach - x.paid)}</b></td></tr>`;

  let body = '';
  if (flat) body = list.map(row).join('');
  else {
    const cats = catsOrdered(list.map(x => x.cat));
    for (const cat of cats) {
      const my = list.filter(x => x.cat === cat);
      body += `<tr class="pw-group" style="--cat:${catColor(cat)}"><td colspan="7"><span>${esc(cat)} · ${my.length}</span></td></tr>`
        + my.map(row).join('');
    }
  }
  $('vacBody').innerHTML = list.length
    ? `<div class="gridwrap"><table class="pw vac"><thead><tr>
        <th class="pw-name">Сотрудник</th><th>Даты отпуска</th><th class="num">Дней</th>
        <th class="num">Начислено</th><th class="num">На карту</th><th class="num">Наличными</th>
        <th class="num pw-pay">Осталось</th></tr></thead><tbody>${body}</tbody>
        <tfoot><tr class="pw-total"><td class="pw-name">ИТОГО</td><td></td>
          <td class="num">${tot.days}</td><td class="num fin">${rub(tot.nach)}</td>
          <td class="num fin">${rub(sum('card'))}</td><td class="num fin">${rub(sum('cash'))}</td>
          <td class="num pw-pay fin"><b class="money">${rub(tot.nach - tot.paid)}</b></td></tr></tfoot></table></div>`
    : `<div class="empty">За ${esc(periodLabel(vacData.period))} отпусков нет — ни дней в графике, ни отпускных.</div>`;
  $('vacBody').querySelectorAll('.vac-row').forEach(tr => tr.onclick = () => openCard(+tr.dataset.id));
}

// «Богданова Лариса Викторовна» → «Богданова Л.В.»: в строке пробела фамилий
// бывает три десятка, полными они не помещаются.
const shortFio = f => {
  const p = String(f || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '—';                      // пустое ФИО — иначе в списке остаётся « · · »
  return p.length < 2 ? p[0] : p[0] + ' ' + p.slice(1).map(w => w[0].toUpperCase() + '.').join('');
};
function shiftGapsMonth(d) {
  if (!gapsPeriod) gapsPeriod = nowPeriod();
  let [y, m] = gapsPeriod.split('-').map(Number); m += d;
  if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
  gapsPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = gapsPeriod; syncHash(false); renderGaps();
}

// Проверки идут ПО РОСТЕРУ (активные сотрудники), а расчётная строка из
// v_month_total подтягивается к человеку. Наоборот — фильтровать сам
// v_month_total — нельзя: его CTE periods содержит только месяцы, где уже
// есть клетки или деньги. На пустом месяце вьюха вернула бы НОЛЬ строк, и
// экран бодро сказал бы «всё заполнено» там, где не заведено вообще ничего.
//
// go — куда ведёт клик. Функцией там, где экран владельческий: «Ставки»
// renderRates гасит для не-owner, и Алёна уехала бы на пустую страницу.
//
// Группы: 0 — мешает расчёту (красное), 1 — не хватает данных (жёлтое).
const RATES_GO = () => (isOwner() ? 'rates' : 'employees');
const GAP_CHECKS = [
  // Ростерная, а не flag_no_rate: тот считается по дням графика (миграция 044),
  // и у человека БЕЗ единой клетки строки в v_month_salary нет вовсе — флаг
  // молча false. То есть ровно те, кого экран и должен ловить, выпадали бы.
  { g: 0, t: 'Не заведена ставка', d: 'без ставки зарплата не считается вовсе', go: RATES_GO, test: e => cardGaps(e).rate },
  { g: 0, t: 'Ставка обрывается посреди месяца', d: 'часть дней не по чему считать', go: RATES_GO, test: (e, r) => !!r?.flag_rate_gap },
  { g: 0, t: 'Отрицательная зарплата', d: 'начислено меньше нуля — так быть не должно', go: 'payroll', test: (e, r) => (r?.salary_kop || 0) < 0 },
  { g: 0, t: 'Переплата: выдано больше начисленного', d: 'проверьте кассу', go: 'payroll', test: (e, r) => !!r?.flag_overpaid },
  { g: 0, t: 'Деньги есть, а расчёта нет', d: 'выплата без начисления под ней', go: 'payroll', test: (e, r) => !!r?.flag_money_without_calc },
  // Порог тот же, что на Обзоре и в payrollDialog: сигналим, только когда
  // запись уже началась, иначе Δ ненулевая весь месяц по построению.
  // TODO(MED, не мой коммит): recorded() складывает r.card_uvol_kop, которого в
  // РАЗВЁРНУТОЙ v_month_total нет (проверено на живой базе) — undefined → 0. То
  // есть у уволенных с расчётом на карту порог этой проверки считается не от той
  // суммы. Чинится вьюхой параллельной сессии, которая ещё не на проде; трогать
  // её здесь нельзя, иначе разъедемся с ними ещё сильнее.
  { g: 0, t: 'Начислено ≠ записано', d: 'записанные деньги не сходятся с расчётом', go: 'payroll', test: (e, r) => !!r && recorded(r) > 0 && Math.abs(r.delta_kop || 0) > 10000 },
  // По РЕАЛЬНЫМ клеткам, а не по norm_days: с миграции 043 отпуск в норму не
  // входит, поэтому у отпускника norm_days и fact_days нулевые — по ним он
  // неотличим от того, кому график не заводили. Случаи противоположные.
  { g: 1, t: 'Нет графика за месяц', d: 'ни одной клетки, график не заводили', go: 'schedule', test: (e, r, x) => !x.hasCell.has(e.id) },
  // Без клеток про это уже сказано строкой выше — не дублируем человека.
  { g: 1, t: 'Оклад есть, отработанных дней ноль', d: 'оклад не на что начислить', go: 'schedule', test: (e, r, x) => !!r?.flag_oklad_no_days && x.hasCell.has(e.id) },
  // Именно flag_no_data, а не своя формула: у вьюхи пять условий (в т.ч. «месяц
  // не будущий» и «денег тоже нет»). Своя проверка на живом июле давала 11
  // человек против 1 у флага — то есть 10 ложных, и Обзор с Пробелами
  // показывали бы разное про одно и то же.
  { g: 1, t: 'Начислено ноль', d: 'рабочие дни в графике есть, а зарплаты нет', go: 'payroll', test: (e, r) => !!r?.flag_no_data },
  { g: 1, t: 'Процент без ставки', d: 'оплаты пациентов есть, а процента нет', go: RATES_GO, test: (e, r) => !!r?.flag_pct_no_rate },
  { g: 1, t: 'Нет оплат пациентов', d: 'процент считать не от чего', go: 'patients', test: (e, r) => !!r?.flag_no_patient_data },
];
// Дыры в карточке — не про деньги за месяц, месяц на них не влияет.
// Предикаты берём из cardGaps(), общего с экраном «Сотрудники»: там телефон
// проверяется тем же инвариантом, что CHECK в базе (миграция 023), а фамилия —
// по содержимому, а не только по импортной заглушке. Свои формулы разъезжались
// с чипами на «Сотрудниках»: два экрана показывали бы разные числа.
const CARD_CHECKS = [
  { t: 'Фамилия не уточнена', d: 'в карточке нет фамилии или стоит заглушка', test: e => cardGaps(e).fio },
  { t: 'Нет телефона', d: 'некуда отправить код подтверждения выдачи', test: e => cardGaps(e).phone },
  { t: 'Не указана специальность', d: 'человек выпадет из разрезов по специальностям', test: e => cardGaps(e).spec },
];

async function renderGaps() {
  if (!isStaff()) { $('gapsBody').innerHTML = ''; return; }
  if (!gapsPeriod) gapsPeriod = nowPeriod();
  const want = gapsPeriod, seq = ++gapsSeq;
  $('gLabel').textContent = periodLabel(want);
  let rows, emps, cells;
  try {
    [rows, emps, cells] = await Promise.all([
      store.listPayroll(want), store.listEmployees(), store.listSchedule(want),
    ]);
  } catch (e) {
    // Гасим тело, а не только тостим: выход из программы не перезагружает
    // страницу, поэтому иначе на общем компьютере разбор ПРЕДЫДУЩЕГО
    // пользователя остался бы висеть у следующего до конца сессии.
    if (seq === gapsSeq) { gapsData = null; $('gapsBody').innerHTML = ''; toast(e.message || e, true); }
    return;
  }
  if (seq !== gapsSeq) return;                     // месяц сменили, пока грузили
  // Клетка считается заведённой, если в ней есть план ИЛИ факт. Пустые строки
  // (обе колонки null) оба стора умеют создавать — «вышел без плана» и остатки
  // импорта; без этой проверки один такой артефакт прятал бы человека из
  // «нет графика», и он исчезал бы с экрана совсем.
  const hasCell = new Set();
  for (const c of (cells || [])) if (c.plan_kind || c.fact) hasCell.add(c.employee_id);
  gapsData = { rows, emps, period: want, hasCell };
  $('gLabel').textContent = periodLabel(want);
  drawGaps();
}

function drawGaps() {
  if (!gapsData) return;
  const { rows, emps, hasCell } = gapsData;
  const active = (emps || []).filter(e => e.status === 'active');
  const ctx = { hasCell };
  // Расчётную строку подтягиваем К человеку. Её может не быть вовсе (пустой
  // месяц), поэтому все денежные проверки написаны через r?. — без строки они
  // просто молчат, а ростерные (график, ставка, карточка) работают всегда.
  const byId = new Map(rows.map(r => [r.employee_id, r]));

  const found = GAP_CHECKS.map(c => ({ ...c, who: active.filter(e => c.test(e, byId.get(e.id), ctx)) })).filter(c => c.who.length);
  const cards = CARD_CHECKS.map(c => ({ ...c, who: active.filter(c.test) })).filter(c => c.who.length);
  // Считаем ЛЮДЕЙ, а не строк: один человек может попасть в несколько проверок
  // (нет ставки → и зарплата ноль), и сумма строк завышала бы масштаб.
  const people = new Set();
  for (const c of [...found, ...cards]) for (const e of c.who) people.add(e.id);
  const total = people.size;

  if (!total) {
    $('gapsBody').innerHTML = `<div class="ov-alerts"><div class="ov-alert ok"><span class="oa-ic">${ICONS.check}</span>`
      + `<div><div class="oa-t">Пробелов нет</div><div class="oa-d">за ${esc(periodLabel(gapsData.period))} всё заполнено</div></div></div></div>`;
    return;
  }

  // Одна строка = одна проблема. Фамилии сразу под ней, чтобы не пришлось
  // открывать: смысл экрана — увидеть, кого именно дозаполнить.
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
    + sec('Мешает расчёту', found.filter(c => c.g === 0), true)
    + sec('Не хватает данных', found.filter(c => c.g === 1), false)
    + sec('Неполные карточки', cards, false)
    + `<div class="note ov-note">${ICONS.info}Нажмите на строку — откроется экран, где это заполняется</div>`;

  $('gapsBody').querySelectorAll('[data-go]').forEach(b => {
    if (b.dataset.go) b.onclick = () => go(b.dataset.go);
    else b.onclick = () => go('employees');
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
function shiftPatMonth(d) { if (!patPeriod) patPeriod = nowPeriod(); let [y, m] = patPeriod.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; } patPeriod = y + '-' + String(m).padStart(2, '0'); workPeriod = patPeriod; syncHash(false); renderPatients(); }

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
    // Возвращаем к тому месяцу, который РЕАЛЬНО на экране, иначе осталась бы шапка
    // нового месяца над данными старого. Откатываем и сам patPeriod с адресом:
    // адрес называет месяц вслух, и такую ссылку перешлют — получатель уехал бы в
    // месяц, которого отправитель не видел, на экране, созданном ловить накрутку.
    patPeriod = patShown || want; workPeriod = patPeriod;
    $('qLabel').textContent = periodLabel(patPeriod);
    syncHash(false);
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
/* Фильтры журнала (просьба Дарины 05.08): «щоб вона могла відфільтрувати дії
   певної людини, певні дії, по даті». Держим отдельно от чипов-разделов: чипы
   отвечают «где» (график, ставки, деньги), а это — «кто», «что» и «когда».
   Ищем И по автору правки, И по тому, кого она касается: «покажи всё по
   Иванову» не различает, он правил или правили его. */
let jWho = '', jAct = '', jFrom = '', jTo = '';
const J_ACTS = [['', 'Любое действие'], ['add', 'Добавление'], ['edit', 'Изменение'], ['del', 'Удаление и сторно']];

function journalRowHtml(j) {
  let what;
  const act = J_ACTION[j.action] ? `<b class="jact">${esc(J_ACTION[j.action])}</b> · ` : '';
  // Триггеры денег кладут ФИО прямо в текст поля («Иванов И.И. · июль 2026 · зп на
  // карту»). Теперь имя стоит отдельной строкой сверху, и в тексте оно повторялось
  // дважды подряд. Срезаем повтор — трогаем только показ, сам журнал не меняем.
  const fld = String(j.field || '');
  const fldShort = j.subject_fio && fld.startsWith(j.subject_fio + ' · ') ? fld.slice(j.subject_fio.length + 3) : fld;
  if (j.action === 'created') what = `${J_ENTITY[j.entity] || esc(j.entity)} создана: <b>${esc(j.new_value || '')}</b>`;
  else what = `${act}${J_ENTITY[j.entity] || esc(j.entity)} · ${J_FIELD[fldShort] || esc(fldShort)}: ${j.old_value ? `<s>${esc(j.old_value)}</s> → ` : ''}<b>${esc(j.new_value || '—')}</b>`;
  // У КОГО и за какой день — главное, чего журналу не хватало: строка «клетка:
  // → day 08:00» не давала ни имени, ни даты, и красный флаг «правка после
  // закрытия» некому было предъявить (Дарина 02.08, миграция 070).
  // У записей до 070 сотрудник достаётся поиском по entity_id и находится не
  // всегда: если строку графика или выплату удалили, восстанавливать нечего.
  // Тогда пишем это прямо, а не подставляем догадку — журнал должен либо знать,
  // либо честно молчать.
  // Молчание и «не определён» — РАЗНОЕ. Справочник специальностей или заведение
  // пользователя ни к какому сотруднику не относятся, там строки быть не должно.
  // А вот правка графика или выплаты всегда чья-то: если имя не нашлось (строку
  // удалили до 070), это надо сказать вслух, иначе запись читается как «ничья».
  const PERSONAL = ['schedule', 'money_line', 'rate_line', 'employee', 'employee_month_norm',
    'month_carry', 'salary_override', 'doctor_month_revenue', 'payout'];
  const кто = j.subject_fio ? esc(j.subject_fio)
    : (PERSONAL.includes(j.entity) ? '<span class="muted">сотрудник не определён</span>' : '');
  // Дату показываем ТОЛЬКО у графика: там это настоящий день правки. У денег и
  // норм дата — это первое число месяца, и «01.07» читалось бы как «первого
  // июля», хотя речь про весь июль. Месяц у них и так написан словами в тексте.
  const когда = j.entity === 'schedule' && j.subject_date ? esc(dm(j.subject_date)) : '';
  const subj = кто || когда
    ? `<div class="jsubj">${кто}${кто && когда ? ' · ' : ''}${когда}</div>`
    : '';
  // Порядок строк: У КОГО (крупно, первым — это то, что ищут глазами) → что на
  // что → кто правил. Раньше первой шла сущность, и записи сливались в столбец
  // одинаковых «График · клетка».
  return `<div class="jrow${j.red ? ' jred' : ''}"><div style="flex:1">${subj}<div>${what}</div><div class="who">${esc(j.actor)}</div></div><div class="jt">${esc(fmtDT(j.at))}</div></div>`;
}

// reset=true — сменили фильтр или зашли заново: тянем с начала. reset=false —
// «Показать ещё»: дописываем следующую страницу к уже показанному (keyset по id).
async function renderJournal(reset = true) {
  if (journalBusy) return; journalBusy = true;
  if (reset) { journalRows = []; journalLastId = null; journalHasMore = false; }
  try {
    const res = await store.listJournal({ filter: journalFilter, beforeId: reset ? null : journalLastId,
      who: jWho, act: jAct, from: jFrom, to: jTo });
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
  const on = jWho || jAct || jFrom || jTo;
  $('journalTools').innerHTML = `<div class="jf-chips">${chips}</div>
    <div class="jf-row">
      <div class="search jf-who"><span data-ic="search"></span><input id="jWho" placeholder="Фамилия — чья правка или о ком" autocomplete="off" value="${esc(jWho)}"></div>
      <select class="input jf-sel" id="jAct">${acts}</select>
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
  // Поиск по фамилии — с задержкой: иначе запрос уходит на каждую букву, а на
  // здешнем интернете это заметно. Даты и действие срабатывают сразу.
  { const w = $('jWho');
    if (w) { let t = null;
      w.oninput = () => { clearTimeout(t); t = setTimeout(() => { jWho = w.value.trim(); renderJournal(true); }, 400); };
      w.onkeydown = ev => { if (ev.key === 'Enter') { clearTimeout(t); jWho = w.value.trim(); renderJournal(true); } }; } }
  { const a = $('jAct'); if (a) a.onchange = () => { jAct = a.value; renderJournal(true); }; }
  { const f = $('jFrom'); if (f) f.onchange = () => { jFrom = f.value; renderJournal(true); }; }
  { const t2 = $('jTo'); if (t2) t2.onchange = () => { jTo = t2.value; renderJournal(true); }; }
  { const c = $('jClear'); if (c) c.onclick = () => { jWho = jAct = jFrom = jTo = ''; renderJournal(true); }; }
}

/* ── модалка / тост ── */
/* Крестик добавляем ВСЕМ окнам разом, а не по одному: пять диалогов (смена,
   факт, ретро-правка, шаблон месяца, сумма в панели) закрывались только кликом
   по пустому месту, а это, по словам Дарины, понятно не всем. Так и новые окна
   получат выход сами собой, без отдельной правки. */
const MODAL_X = '<div class="modal-xwrap"><button class="modal-x" type="button" aria-label="Закрыть">\u2715</button></div>';
/* onClose — ответ окна, когда его закрыли не кнопкой. Диалоги на промисах
   (подтверждения суммы и телефона, дата ставки, сторно) резолвились только из
   своих кнопок; крестик закрывал окно молча, промис висел вечно, и «Сохранить»
   в карточке под ним оставалась мёртвой. Теперь ответ даёт и крестик, и Escape,
   и клик по фону. Повторный resolve промис игнорирует — двойной вызов безопасен. */
let modalOnClose = null, modalOnClose2 = null;
function showModal(html, onClose) { modalOnClose = onClose || null; $('modalBox').innerHTML = MODAL_X + html; $('modalOv').classList.add('show'); applyIcons($('modalBox')); const f = $('modalBox').querySelector('input'); if (f) setTimeout(() => f.focus(), 60); }
// ⚠ Никакого syncHash здесь. Пробовали — closeModal зовётся и из applyHash (закрыть
// неохраняемую форму и идти дальше), и syncHash успевал вернуть адрес на СТАРЫЙ
// экран ДО того, как applyHash прочитает новый: переход просто исчезал, а запись
// истории затиралась. Адрес чинит сам отказ в applyHash, пушем.
function closeModal() { $('modalOv').classList.remove('show'); delete $('modalBox').dataset.guard;
  setEditing(null);          // форма закрыта — снимаем «правит», не дожидаясь такта
  const f = modalOnClose; modalOnClose = null; if (f) f(); }
// Открыта любая из двух форм (вторая — диалог поверх первой). Спрашивают и
// маршрутизация («назад» не уводит экран из-под формы), и суточный сброс.
const modalOpen = () => $('modalOv').classList.contains('show') || $('modalOv2').classList.contains('show');
// Форма, которую нельзя закрыть случайно: помеченная dataset.guard (карточка,
// деньги, ставки) и весь второй слой — он и есть подтверждение суммы.
// ⚠ Диалоги графика (смена, факт, отпуск, шаблон, ретро-правка со СМС-кодом)
// guard НЕ ставят, поэтому «назад» закрывает их так же, как Escape и клик по
// фону, — вместе с введённым. Расширять guard на них — отдельное решение: у
// ретро-правки в замыкании висит уже отправленный код, а попытки ограничены.
const guardedModal = () => ($('modalOv').classList.contains('show') && !!$('modalBox').dataset.guard) || $('modalOv2').classList.contains('show');
// Второй слой — диалог ПОВЕРХ уже открытой формы. Без него confirmBigAmounts
// затирал бы карточку (оба писали в общий #modalBox), и «Исправить» терял ввод.
function showModal2(html, onClose) { modalOnClose2 = onClose || null; $('modalBox2').innerHTML = MODAL_X + html; $('modalOv2').classList.add('show'); applyIcons($('modalBox2')); }
function closeModal2() { $('modalOv2').classList.remove('show');
  const f = modalOnClose2; modalOnClose2 = null; if (f) f(); }
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
/* Крестик закрывает и защищённые окна тоже: это осознанное нажатие, а не
   случайный клик мимо, — ровно как кнопка «Отмена», которая там уже есть. */
$('modalBox').addEventListener('click', e => { if (e.target.closest('.modal-x')) closeModal(); });
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
{ const as = $('arcSearch'); if (as) as.oninput = () => drawArchive(); }
{ const am = $('arcOnlyMoney'); if (am) am.onchange = () => drawArchive(); }
{ const vf = $('vacFlat'); if (vf) vf.onchange = () => drawVacation(); }
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
{ const gp = $('gPrev'), gn = $('gNext');
  if (gp) gp.onclick = () => shiftGapsMonth(-1);
  if (gn) gn.onclick = () => shiftGapsMonth(1); }
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
// replace: кнопка нарисована шевроном «влево» и читается как «назад», поэтому
// новую запись заводить нельзя — иначе системное «назад» возвращало бы в только
// что закрытую карточку, и выход из программы шёл пинг-понгом список↔карточка.
// «Назад» ведёт ТУДА, ОТКУДА ПРИШЛИ. Раньше всегда в «Сотрудники»: перейдя из
// «Расчёта» в карточку, вернуться в расчёт было нечем — приходилось открывать
// экран заново и снова искать человека.
$('backBtn').onclick = () => { const to = cardFrom || 'employees'; cardFrom = null; go(to, true); };

/* Кнопка «назад» в шапке. Нужна прежде всего в окне «добавлено в Dock»: там нет
   браузерных стрелок, и вернуться с «Графика» на «Расчёт» было нечем — только
   заново кликать в меню. Работает по истории экранов (её ведут адреса вида
   #/raschet/2026-07), поэтому возвращает ровно туда, где человек был.
   Прячем, когда возвращаться некуда: кнопка, которая ничего не делает, хуже её
   отсутствия. */
function syncTopBack() {
  const b = $('topBack'); if (!b) return;
  b.hidden = (curScreen === 'overview');   // с «Обзора» возвращаться некуда: он и есть начало
}
let navStack = 0;
window.addEventListener('popstate', () => { navStack = Math.max(0, navStack - 1); syncTopBack(); });
// Если истории нет — уводим на «Обзор», а НЕ history.back(): при запуске
// приложение восстанавливает последний экран прошлого сеанса, истории за ним
// не существует, и back() выкинул бы человека из окна «добавлено в Dock».
$('topBack').onclick = () => { if (navStack > 0) history.back(); else go('overview'); };
$('topBack').innerHTML = ICONS.chevL || '‹';
$('logoutBtn').innerHTML = ICONS.out;
// finally: выход должен ВЫГЛЯДЕТЬ выходом даже если signOut упал по сети. Иначе экран
// остаётся «внутри программы», хотя store.logout() уже снял пользователя и ключ дня.
// Выход НЕ перезагружает страницу (и не должен: если signOut упал по сети,
// перезагрузка подняла бы сессию обратно из localStorage, а форма входа при
// этом уже нарисована). Значит разобранные экраны остаются в DOM как есть.
// На общем компьютере это видно следующему вошедшему: он жмёт вкладку, экран
// показан синхронно, а перерисовка асинхронная — до ответа сервера висит
// разбор предыдущего пользователя, а при ошибке запроса и вовсе бессрочно.
// Больнее всего «Расчёт» (там суммы) и «Пробелы» (там пофамильно видно тех,
// кого от оператора прячет вьюха). Поэтому гасим руками.
const DATA_PANES = ['overviewBody', 'gapsBody', 'payrollTable', 'payrollNote', 'scheduleGrid',
  'schedNote', 'empList', 'roNote', 'cardBody', 'ratesList', 'ratesTools', 'importBody',
  'patByDoc', 'journalTools'];
function clearDataPanes() {
  for (const id of DATA_PANES) { const el = $(id); if (el) el.innerHTML = ''; }
  ovData = null; gapsData = null;          // чтобы отложенная перерисовка не вернула чужое
  // Забываем и ЗАГРУЖЕННЫЕ месяцы. Без этого разметку мы стёрли, а данные
  // предыдущего человека остались в памяти вместе с отметкой «месяц загружен» —
  // и любая перерисовка «из уже загруженного» (галочка сортировки, поиск, выбор
  // отделения) заново вписала бы чужие зарплаты в погашенную панель, не сходив
  // в базу. Обычно следом идёт location.reload() и вопрос снят, но код ниже
  // прямо рассчитан на случай, когда перезагрузки НЕ случится.
  payrollShown = null; payrollRows = []; schedShown = null; scheduleRows = [];
  // И объявляем недействительными ЗАПРОСЫ В ПУТИ. Каждый экран отбрасывает свой
  // ответ по счётчику (`if (seq !== payrollSeq) return`), а токен после выхода
  // ещё живёт секунды — ответ, вылетевший ДО выхода, приходил ПОСЛЕ, проходил
  // проверку и сам возвращал зарплаты предыдущего человека в только что
  // погашенную панель. Сдвигаем счётчики — и все ответы «прошлой жизни» чужие.
  payrollSeq++; schedSeq++; ovSeq++; gapsSeq++; patSeq++;
}
$('logoutBtn').onclick = async () => {
  try { await store.logout(); }
  finally {
    document.body.classList.remove('authed');
    // Гасим адрес и ПЕРЕЗАГРУЖАЕМСЯ. Снятие класса только ПРЯЧЕТ приложение (CSS),
    // разметка предыдущего человека остаётся в DOM — и следующий, войдя, видел бы
    // её всё то время, пока идёт refresh() (первый коннект бывает секундами). На
    // «Расчёте» это зарплаты всех, включая строку СЕО, которую прячет миграция 040.
    // Перезагрузка чистит и разметку, и ростер в памяти, и адрес предыдущего.
    // Сессию она не вернёт: store.logout() снимает ключ дня ВСЕГДА (даже если
    // signOut не достучался до сети), а store.init() без ключа дня входить не даёт.
    clearHash();
    // Нонс сеанса снимаем ЗДЕСЬ, а не полагаемся на перезагрузку: если она не
    // случится (офлайн, бросок history по троттлингу), записи прошлого человека
    // всё равно опознаются как чужие. restoredSession — по той же причине.
    try { sessionStorage.removeItem(SID_KEY); } catch (e) {}
    restoredSession = false;
    // Ровно для случая «reload не случится», который оговорён строкой ниже:
    // тогда разметка предыдущего человека осталась бы в DOM, а её как раз и
    // прячет перезагрузка. Гасим панели явно — это дёшево и не мешает reload.
    clearDataPanes();
    renderLogin();          // если reload не случится (бросок/офлайн) — форма входа всё равно на месте
    location.reload();
  }
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
  if (modalOpen()) return;
  // Адрес гасим ДО перезагрузки. Сброс существует ради забытого/потерянного
  // телефона — то есть ровно ради случая, когда вернулся НЕ тот же человек;
  // иначе экран входа остался бы с #/kartochka/17 и выдал бы, чью карточку
  // смотрели, а после входа туда же и высадил.
  clearHash();
  // Класс снимаем СРАЗУ, не дожидаясь перезагрузки: на холодном мобильном коннекте
  // «Расчёт» предыдущего висел бы на экране всё это время, а офлайн — навсегда.
  // Это и есть сценарий потерянного телефона, ради которого сброс существует.
  document.body.classList.remove('authed');
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
    if (store.me()) { restoredSession = true; await enter(); }  // сессия жива — тот же человек, входим; иначе форма уже показана
  } catch (e) {
    console.error('[init]', e);
    const libFail = /библиотек|supabase\.js|is not defined|undefined/i.test(String(e.message || e));
    toast(libFail ? 'Не удалось подключиться к базе — обновите страницу (Cmd/Ctrl+R).' : 'База отвечает медленно (' + String(e.message || e) + '). Вход по паролю должен работать.', true);
  }
  // Загрузились на экран входа, а в строке висит НАШ прежний адрес (#/kartochka/17).
  // Выход и суточный сброс гасят его сами, но остаются пути, где его никто не гасил:
  // проверка версии внизу index.html, обычный F5, переоткрытие программы наутро —
  // сессия истекла внутри store.init(), а адрес остался и выдаёт, чью карточку
  // смотрели. Приземлиться туда следующему уже не даёт stale в enter(); здесь
  // убираем сам след. Присланную ссылку не трогаем: у неё state пуст.
  if (!store.me() && history.state?.own && location.hash) {
    clearHash();
  }
})();
