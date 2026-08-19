/* Слой данных: один интерфейс, две реализации.
   MockStore  — ДЕМО: всё в localStorage этого браузера, вход без пароля.
   SupabaseStore — прод: Supabase Auth + Postgres (RLS и журнал — в базе,
   см. docs/sprint1-schema.sql). Выбор — по наличию ключей в config.js. */

const LS_KEY = 'milena-app-demo-v1';
/* Из сырых строк выдач за месяц — то, что показывает «Обзор»: список последних
   и счётчик «выдано вперёд». Одна функция на оба хранилища: демо и прод обязаны
   считать это одинаково, иначе проверить в демо нельзя.
   Выбрасываем ДВА вида строк: сами сторно (они тоже confirmed и выглядели бы
   обычной выдачей с минусом) и выдачи, которые уже отменили — «последние
   выдачи» должны быть тем, что реально отдано. Сторно всегда новее своей
   выдачи и в том же месяце, поэтому отбор точный. */
function сводкаВыдач(строки, limit, имя) {
  const отменены = new Set(строки.filter(p => p.reverses_id).map(p => p.reverses_id));
  const живые = строки.filter(p => !p.reverses_id && !отменены.has(p.id));
  return {
    list: живые.slice(0, limit).map(p => ({ ...p, fio: имя(p) })),
    // ЛЮДЕЙ, а не выдач: после перехода границы каждая следующая выдача тоже
    // помечена, и десять по 20 000 одному человеку давали «Выдано вперёд · 5».
    // Все остальные пункты «Требует внимания» считают людей — единица измерения
    // внутри одного списка обязана быть одна.
    ahead: new Set(живые.filter(p => p.given_ahead).map(p => p.employee_id)).size,
  };
}

// Месяцы словами — зеркало ru_period() в базе. Демо и прод должны писать в
// журнал ОДИНАКОВО, иначе проверить формулировку в демо нельзя.
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь',
  'июль','август','сентябрь','октябрь','ноябрь','декабрь'];
// Фильтры журнала — ОДНО определение на оба стора, чтобы демо и прод судили
// одинаково (демо-режим уже трижды вводил в заблуждение расхождением с продом).
// premia не отдельный entity, а money_line с 'премия' в field (log_money_line
// пишет '… · ' || ru_money_kind(kind)) — именно этот фильтр делает премию
// находимой, а значит и безопасным возврат её ввода бухгалтеру.
function journalMatch(j, filter) {
  switch (filter) {
    case 'red':      return !!j.red;
    case 'money':    return j.entity === 'money_line' || j.entity === 'patient_payment';
    case 'payout':   return j.entity === 'payout';
    case 'premia':   return j.entity === 'money_line' && String(j.field || '').includes('премия');
    case 'schedule': return j.entity === 'schedule';
    case 'rate':     return j.entity === 'rate_line';
    default:         return true;
  }
}
const LOGIN_DAY_KEY = 'milena-login-day';                                        // день последнего входа (МСК)
const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);   // календарная дата в МСК (UTC+3) — для ежедневного сброса доступа
// С какого числа действует ставка. НЕ «сегодня», а 1-е число текущего месяца.
// Причина: ставка заводится один раз и живёт, пока её не поменяли (меняется ~раз
// в год, и только владельцем). Заводя её, Милена не заключает новый договор —
// она записывает то, что человек УЖЕ получает. С датой «сегодня» ставка,
// внесённая 16-го, не действовала бы с 1-го по 15-е, и оклад за этот месяц
// посчитался бы неверно. Тем же числом закрывается старая строка при смене:
// месяц целиком достаётся новой ставке (вариант А, см. docs/meeting-milena.md A3).
// МСК, а не UTC: toISOString() между 00:00 и 03:00 по Москве дал бы вчерашнюю дату.
const rateFrom = () => mskDay().slice(0, 8) + '01';

/* Правка задним числом ПОСЛЕ 6-го числа требует явной отметки «осознанно»: по 6-е
   включительно по прошлому месяцу ещё идут подсчёты, и правка — обычная работа, а
   дальше это уже вмешательство в закрытый расчёт. То же правило проверяет база
   (rate_backdate_needs_ok, миграция 081), и такая правка попадает в журнал с
   пометкой «ЗАДНИМ ЧИСЛОМ» и автором. Определение ОДНО на весь клиент: и диалоги
   в app.js, и вызовы RPC ниже берут его отсюда, чтобы не разъехались. */
export const backdateNeedsOk = d =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && d < rateFrom() && +mskDay().slice(8, 10) > 6;

/* ⚠ КАЖДАЯ боевая роль обязана быть здесь. Иначе её экраны нельзя открыть
   глазами — ни мне, ни Дарине, — и проверка сводится к «права в базе есть,
   значит работает». Так и вышло 12.08: бухгалтеру открыли права и пункты меню,
   всё сошлось запросами, а «График» у неё оказался ПУСТЫМ — рисование выходило
   по isStaff. Увидели уже на проде.
   Заводя новую роль, добавляйте её сюда ПЕРВЫМ делом, до кода. */
const DEMO_USERS = [
  { id: 'u-milena', name: 'Милена', role: 'owner' },
  { id: 'u-alena',  name: 'Алёна',  role: 'operator' },
  { id: 'u-ceo',    name: 'Директор', role: 'ceo' },
  { id: 'u-buh',    name: 'Бухгалтер', role: 'cashier1' },
  { id: 'u-buh2',   name: 'Бух 2 · карта/1С', role: 'cashier2' },
];

/* Виды смен — соответствуют таблице shift_kind в прод-БД. Клетка графика =
   время начала + код.

   dept — отделение, которому вид предлагают; без него вид виден всем. Живёт
   ЗДЕСЬ, а не в базе, потому что выпадающие списки читают именно этот массив
   (listShiftKinds отдаёт его и в демо, и на проде). Тот же принцип, что у
   именованных сумм за смену: у санитарок свои, у медсестёр свои.

   `day6` — шестичасовая смена процедурной медсестры (код клиники МсПроц6).
   Дарина 12.08: «потрібно щоб правильна кількість годин стояла, бо може
   відпрацювати більше і тоді будуть якісь їй надбавки». Денег вид не двигает —
   медсестре платят суммой за смену из клетки, — но часы идут в переработку, а
   значит в надбавки. До этого такие дни лежали как «День», то есть 8 часов
   вместо 6 (миграция 135). */
export const SHIFT_KINDS = [
  { code: 'day',     label: 'День',      short: 'Д',  hours: 8 },
  { code: 'day6',    label: '6ч',        short: '6',  hours: 6, dept: 'Медсестры' },
  { code: 'day12',   label: '12ч день',  short: '12д', hours: 12 },
  { code: 'night12', label: '12ч ночь',  short: '12н', hours: 12 },
  { code: 'day24',   label: 'Сутки',     short: 'С',  hours: 24 },
  { code: 'off',     label: 'Выходной',  short: 'В',  hours: 0 },
  { code: 'отпуск',  label: 'Отпуск',    short: 'Отп', hours: 0 },
  // ⚠ Был в базе (109), но НЕ в этом списке — гэп с самой 109, нашёлся при
  // разборе переносов. Последствие тихое и дорогое: открыть будущий день с
  // таким видом → нужного <option> в списке нет → браузер показывает первый,
  // «— пусто —» → «Сохранить» без единой правки шлёт plan_kind=null, и отметка
  // отпуска ИСЧЕЗАЕТ. Не выстрелило только потому, что таких дней сейчас ноль.
  { code: 'отпуск_бз', label: 'Отпуск без сохр.', short: 'Отп·бз', hours: 0 },
  { code: 'absent',  label: 'Не вышел',  short: '—',  hours: 0 },
  { code: 'custom',  label: 'Своё время', short: '·', hours: null },
];
export const shiftKind = code => SHIFT_KINDS.find(k => k.code === code) || null;

/* Производственный календарь РФ 2026 для ДЕМО — зеркало таблицы prod_norm
   (migrations/056). В проде календарь живёт в базе и правится владельцем; здесь
   он вшит, чтобы демо показывало те же числа, что прод. Сходится сам с собой:
   247 рабочих дней × 8 ч − 4 предпраздничных часа = 1972 ч за год при 40-часовой. */
const PROD_NORM_2026 = {
  '2026-01': { '40': 120.0, '36': 108.0, '24':  72.0 },
  '2026-02': { '40': 152.0, '36': 136.8, '24':  91.2 },
  '2026-03': { '40': 168.0, '36': 151.2, '24': 100.8 },
  '2026-04': { '40': 175.0, '36': 157.4, '24': 104.6 },
  '2026-05': { '40': 151.0, '36': 135.8, '24':  90.2 },
  '2026-06': { '40': 167.0, '36': 150.2, '24':  99.8 },
  '2026-07': { '40': 184.0, '36': 165.6, '24': 110.4 },
  '2026-08': { '40': 168.0, '36': 151.2, '24': 100.8 },
  '2026-09': { '40': 176.0, '36': 158.4, '24': 105.6 },
  '2026-10': { '40': 176.0, '36': 158.4, '24': 105.6 },
  '2026-11': { '40': 159.0, '36': 143.0, '24':  95.0 },
  '2026-12': { '40': 176.0, '36': 158.4, '24': 105.6 },
};

const DEMO_SEED = {
  specialties: [
    { id: 1, name: 'Врач-терапевт', category: 'Стационарные' },
    { id: 2, name: 'Хирург', category: 'Стационарные' },
    { id: 3, name: 'Медсестра', category: 'Медсестры' },
    { id: 4, name: 'Администратор', category: 'Прочие' },
  ],
  // Справочник отделений — дерево в два уровня, как на проде после 123.
  // Без него демо рисовало бы плоский список, и любая правка группировки
  // проверялась бы только на живой базе.
  catOrder: [
    { category: 'Врачи', sort: 10, parent: null },
    { category: 'Стационарные', sort: 11, parent: 'Врачи' },
    { category: 'Амбулаторные основные', sort: 12, parent: 'Врачи' },
    { category: 'Совместители', sort: 13, parent: 'Врачи' },
    { category: 'Консультанты', sort: 14, parent: 'Врачи' },
    { category: 'Психодиагностика', sort: 15, parent: 'Врачи' },
    { category: 'Администраторы', sort: 20, parent: null },
    { category: 'Ресепшн', sort: 21, parent: 'Администраторы' },
    { category: 'Колл-центр', sort: 22, parent: 'Администраторы' },
    { category: 'Медсестры и санитарки', sort: 30, parent: null },
    { category: 'Медсестры', sort: 31, parent: 'Медсестры и санитарки' },
    { category: 'Санитарки', sort: 32, parent: 'Медсестры и санитарки' },
    { category: 'Администрация клиники', sort: 40, parent: null },
    { category: 'Прочие', sort: 90, parent: null },
  ],
  employees: [],   // реальные карточки вводит владелица — демо стартует пустым
  journal: [],
  schedule: [],
  closed: [],      // закрытые дни табеля: [{work_date, closed_by, closed_at}]
  retro: [],       // заявки на ретро-правку закрытого дня (СМС-код): [{id,work_date,employee_id,target,new_fact,code,attempts,status,expires}]
  // Оплаты пациентов в демо. Раньше ключа не было вовсе, и оба Mock-метода
  // возвращали [] — то есть рабочий экран и МЁРТВЫЙ выглядели одинаково пусто.
  // Именно это скрыло, что экран не открывался ни разу. Пара со сторно — чтобы
  // в демо было видно, что сторно вычитается, а не просто «минус строка».
  patients: [
    { id: 1, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-05', paid_at: '10:15', service: 'Консультация', amount_kop: 300000, reverses_id: null, is_import: true },
    { id: 2, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-05', paid_at: '10:15', service: 'Консультация', amount_kop: -300000, reverses_id: 1, is_import: false },
    { id: 3, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-12', paid_at: '14:00', service: 'Приём повторный', amount_kop: 250000, reverses_id: null, is_import: true },
    { id: 4, employee_id: 2, fio: 'Петров Сергей Иванович', paid_on: '2026-07-08', paid_at: '09:30', service: 'Операция', amount_kop: 1200000, reverses_id: null, is_import: true },
  ],
  // Пара подтверждённых выдач для секции «Последние выдачи» в обзоре владельца.
  // Выдач в сиде НЕТ. Раньше тут лежали две «для красоты» — без поля period и на
  // сотрудников, которых в пустом демо не существует: плитка «Выдано наличными»
  // честно считала 0 ₽, а список рядом рисовал 75 000 ₽. Демо стартует пустым,
  // как и всё остальное.
  payouts: [],
  nextId: { specialty: 5, employee: 1, journal: 1, line: 1, schedule: 1, retro: 1, patient: 5, payout: 3 },
};

/* ── ДЕМО ─────────────────────────────────────────────────────────── */
export class MockStore {
  constructor() { this.mode = 'demo'; this.user = null; this._load(); }
  _load() {
    try { this.db = JSON.parse(localStorage.getItem(LS_KEY)) || structuredClone(DEMO_SEED); }
    catch { this.db = structuredClone(DEMO_SEED); }
    // Ключи, которых в сохранённой базе ещё нет, доливаем из сида. Без этого у
    // всех, кто открывал демо РАНЬШЕ, не появился бы catOrder — а с ним теперь
    // строится группировка по отделениям, и без справочника люди пропадают с
    // экранов. Существующее не трогаем: демо-данные вводили руками.
    for (const [k, v] of Object.entries(DEMO_SEED)) {
      if (this.db[k] === undefined) this.db[k] = structuredClone(v);
    }
  }
  _save() { localStorage.setItem(LS_KEY, JSON.stringify(this.db)); }
  resetDemo() { this.db = structuredClone(DEMO_SEED); this._save(); }

  async init() {
    const uid = sessionStorage.getItem('milena-demo-user');
    this.user = DEMO_USERS.find(u => u.id === uid) || null;
  }
  demoUsers() { return DEMO_USERS; }
  async loginDemo(id) {
    this.user = DEMO_USERS.find(u => u.id === id) || null;
    if (this.user) sessionStorage.setItem('milena-demo-user', id);
    return this.user;
  }
  async login() { throw new Error('В демо-режиме вход по кнопкам ниже'); }
  async logout() { this.user = null; sessionStorage.removeItem('milena-demo-user'); }
  dayExpired() { return false; }   // в демо суточного сброса нет — там и данных настоящих нет
  me() { return this.user; }

  // red — последним и необязательным: у всех прежних вызовов его нет, и они
  // должны продолжать работать без правок.
  _log(action, entity, entityId, field, oldV, newV, red) {
    this.db.journal.unshift({
      id: this.db.nextId.journal++,
      actor: this.user?.name || '?', action, entity, entity_id: entityId,
      field: field || null, old_value: oldV ?? null, new_value: newV ?? null,
      red: !!red, at: new Date().toISOString(),
    });
  }

  async listSpecialties() { return [...this.db.specialties]; }
  async addSpecialty(name, category) {
    if (this.db.specialties.some(s => s.name.toLowerCase() === name.toLowerCase()))
      throw new Error('Такая специальность уже есть');
    const s = { id: this.db.nextId.specialty++, name, category: category || 'Прочие' };
    this.db.specialties.push(s);
    this._log('created', 'specialty', s.id, null, null, name);
    this._save(); return s;
  }
  /* Правила отделения и именованные суммы за смену (101). В демо держим в той же
     локальной базе — экран «Правила» должен работать и без сети. */
  async listShiftPresets() { return [...(this.db.presets || [])]; }
  async saveShiftPreset(row) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Менять варианты оплаты может владелец или директор');
    this.db.presets = this.db.presets || [];
    const i = row.id ? this.db.presets.findIndex(p => p.id === row.id) : -1;
    if (i >= 0) { this.db.presets[i] = { ...this.db.presets[i], ...row }; this._log('updated', 'shift_preset', row.id, 'вариант оплаты', null, row.code); }
    else { row.id = (this.db.nextId.preset = (this.db.nextId.preset || 1) + 1); this.db.presets.push(row); this._log('created', 'shift_preset', row.id, 'вариант оплаты', null, row.code); }
    this._save(); return row;
  }
  async deleteShiftPreset(id) {
    if (this.user?.role !== 'owner') throw new Error('Удалять варианты может только владелец');
    this.db.presets = (this.db.presets || []).filter(p => p.id !== id);
    this._log('deleted', 'shift_preset', id, 'вариант оплаты', null, null); this._save();
  }
  async listDeptRules() { return [...(this.db.deptRules || [])]; }
  async saveDeptRule(row) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Менять норму отделения может владелец или директор');
    this.db.deptRules = this.db.deptRules || [];
    const i = this.db.deptRules.findIndex(r => r.category === row.category);
    if (i >= 0) this.db.deptRules[i] = { ...this.db.deptRules[i], ...row };
    else { row.id = (this.db.nextId.rule = (this.db.nextId.rule || 1) + 1); this.db.deptRules.push(row); }
    this._log('updated', 'dept_rule', row.id || 0, 'норма отделения', null, row.category);
    this._save(); return row;
  }
  async deleteDeptRule(category) {
    if (this.user?.role !== 'owner') throw new Error('Удалять правила может только владелец');
    this.db.deptRules = (this.db.deptRules || []).filter(r => r.category !== category);
    this._save();
  }
  /* Часы факта демо не считает (это 113-я вьюха), но КТО ЕСТЬ В СПИСКЕ — обязано
     отдавать честно: по наличию строки прогноз «к концу месяца» решает, заводили
     человеку график или нет. Пустой список означал бы «графика нет ни у кого», и
     демо тянуло бы в прогноз отпускников и процентников — ровно то поведение,
     которое в бою и чинили. Клетка считается заведённой так же, как в renderGaps:
     есть план ИЛИ факт. */
  async listMonthMarked(period) {
    const pre = period + '-';
    const ids = new Set();
    for (const s of (this.db.schedule || []))
      if (String(s.work_date).startsWith(pre) && (s.plan_kind || s.fact)) ids.add(s.employee_id);
    return [...ids].map(employee_id => ({ employee_id, period: period + '-01',
      marked_hours: 0, past_hours: 0, unmarked_days: 0, marked_days: 0 }));
  }
  async listCategoryOrder() { return [...(this.db.catOrder || [])]; }
  async setCategoryOrder(rows) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Менять порядок может владелец или директор');
    this.db.catOrder = this.db.catOrder || [];
    for (const r of rows) {
      const cur = this.db.catOrder.find(x => x.category === r.category);
      // parent приходит не всегда (перестановка шлёт его, а старые вызовы могли и
      // не слать) — не затираем его undefined'ом, иначе блок молча вылетит из группы.
      if (cur) { cur.sort = r.sort; if ('parent' in r) cur.parent = r.parent ?? null; }
      else this.db.catOrder.push({ parent: null, ...r });
    }
    this._save();
  }
  async setSpecialtySort(rows) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Менять справочник может владелец или директор');
    for (const r of rows) { const s = this.db.specialties.find(x => x.id === r.id); if (s) s.sort = r.sort; }
    this._save();
  }
  /* Зеркало RPC rename_department (миграция 123): переименование или, если имя
     занято, слияние. Тянет за собой людей, блоки внутри, специальности и правила —
     ровно как каскады внешних ключей на проде. Возвращает число людей в итоговом
     отделении. */
  async renameCategory(oldName, newName) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Переименовать отделение может владелец или директор');
    newName = String(newName || '').trim();
    if (!newName) throw new Error('Название отделения не может быть пустым');
    if (oldName === newName) return 0;
    this.db.catOrder = this.db.catOrder || [];
    const was = this.db.catOrder.find(o => o.category === oldName);
    if (!was) throw new Error(`Отделения «${oldName}» нет в справочнике`);
    const target = this.db.catOrder.find(o => o.category === newName);

    // Сначала ПРОВЕРКИ, только потом правки. RPC на проде выполняется в
    // транзакции и при отказе не оставляет следов; здесь транзакции нет, и
    // порядок «сначала переписали, потом отказали» оставил бы демо-базу
    // переименованной наполовину — её зафиксировал бы первый же _save().
    if (target?.parent && this.db.catOrder.some(o => o.parent === oldName)) {
      throw new Error(`В «${oldName}» есть блоки, а «${newName}» само лежит внутри отделения — так объединить нельзя`);
    }

    this.db.specialties.filter(x => x.category === oldName).forEach(x => { x.category = newName; });
    this.db.employees.filter(x => x.dept === oldName).forEach(x => { x.dept = newName; });
    this.db.catOrder.filter(o => o.parent === oldName).forEach(o => { o.parent = newName; });
    // Суммы за смену: на проде их тянет каскад внешнего ключа, при слиянии —
    // отдельный UPDATE внутри RPC. Демо обязано делать то же, иначе список сумм
    // остаётся под отделением, которого больше нет.
    (this.db.presets || []).filter(p => p.category === oldName).forEach(p => { p.category = newName; });
    // Норма отделения. При слиянии у цели своя уже может быть — её и оставляем,
    // а исходную выбрасываем (так же поступает RPC). Иначе получились бы два
    // правила на одну категорию, и find() взял бы случайное.
    const rules = this.db.deptRules || [];
    if (target && rules.some(r => r.category === newName)) {
      this.db.deptRules = rules.filter(r => r.category !== oldName);
    } else {
      rules.filter(r => r.category === oldName).forEach(r => { r.category = newName; });
    }

    if (target) this.db.catOrder = this.db.catOrder.filter(o => o !== was);
    else was.category = newName;
    this._log('updated', 'category_order', 0, 'отделение', oldName, newName);
    this._save();
    return this.db.employees.filter(e => e.dept === newName && e.status === 'active').length;
  }
  async setEmployeeHidden(id, hidden) {
    // Текст отказа и красный флаг — слово в слово как в базе (триггеры
    // employee_guard_columns и log_employee_hide). Демо для Дарины и Мілєни —
    // способ посмотреть, как оно себя поведёт, и расхождение здесь означало бы,
    // что демо врёт про боевую систему.
    if (this.user?.role !== 'owner') throw new Error('Убирать из архива и возвращать может только владелец');
    const e = this.db.employees.find(x => x.id === id);
    if (!e) throw new Error('Карточка не найдена');
    e.hidden_at = hidden ? new Date().toISOString() : null;
    this._log('updated', 'employee', id, 'архив', hidden ? 'в списке' : 'убрана',
              hidden ? 'убрана из списка' : 'возвращена в список', true);
    this._save(); return e;
  }
  async updateSpecialty(id, name, category) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Менять справочник может владелец или директор');
    const s = this.db.specialties.find(x => x.id === id);
    if (!s) throw new Error('Специальность не найдена');
    if (this.db.specialties.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
      throw new Error('Такая специальность уже есть');
    const was = s.name + ' · ' + s.category;
    s.name = name; s.category = category || 'Прочие';
    this._log('updated', 'specialty', s.id, 'специальность', was, s.name + ' · ' + s.category);
    this._save(); return s;
  }

  async listEmployees() { return structuredClone(this.db.employees); }
  // Зеркало промежуточных оценок (миграция 145): в демо живут тут же, в db.
  async listEstimates(period) {
    return (this.db.estimates || []).filter(x => x.period === period)
      .map(x => ({ ...x }));
  }
  async saveEstimate(employee_id, period, kind, amount_kop, note) {
    if (!['owner', 'ceo', 'operator'].includes(this.user?.role))
      throw new Error('Прикидку вносят Милена, директор или Алёна');
    this.db.estimates = this.db.estimates || [];
    const i = this.db.estimates.findIndex(x =>
      x.employee_id === employee_id && x.period === period && x.kind === kind);
    const было = i >= 0 ? this.db.estimates[i].amount_kop : null;
    const row = { employee_id, period, kind, amount_kop, note: note || null,
                  updated_at: new Date().toISOString() };
    if (i >= 0) this.db.estimates[i] = row; else this.db.estimates.push(row);
    // Журнал так же, как в бою (там это делает триггер): правка приблизительной
    // цифры не должна теряться ни в одном хранилище.
    this._log(i >= 0 ? 'updated' : 'created', 'month_estimate', employee_id,
              'оценка к авансу · ' + kind,
              было == null ? null : (было / 100).toString(), (amount_kop / 100).toString());
    this._save();
    return row;
  }
  async delEstimate(employee_id, period, kind) {
    this.db.estimates = (this.db.estimates || []).filter(x =>
      !(x.employee_id === employee_id && x.period === period && x.kind === kind));
    this._log('deleted', 'month_estimate', employee_id, 'оценка к авансу · ' + kind, null, null);
    this._save();
    return true;
  }
  // Зеркало боевого listArchivedBy: в демо журнал лежит тут же, и actor — уже имя.
  async listArchivedBy(ids = []) {
    const want = new Set(ids);
    const by = new Map();
    for (const j of (this.db.journal || []))          // журнал в демо уже отсортирован свежими вперёд
      if (j.entity === 'employee' && j.field === 'status' && j.new_value === 'archived'
          && want.has(j.entity_id) && !by.has(j.entity_id))
        by.set(j.entity_id, { at: j.at, who: j.actor || null });
    return by;
  }
  async createEmployee({ fio, position, phone, specialty_id, specialty_id_2, dept, hired_on, left_on, lines, valid_from }) {
    const vfrom = valid_from || rateFrom();
    const e = {
      id: this.db.nextId.employee++, fio, position: position || '', phone: phone || '',
      specialty_id: specialty_id || null, specialty_id_2: specialty_id_2 || null, dept: dept || null, status: 'active',
      hired_on: hired_on || null, left_on: left_on || null,
      created_at: new Date().toISOString(),
      lines: (lines || []).map(l => ({ ...l, id: this.db.nextId.line++, valid_from: vfrom, valid_to: null })),
    };
    this.db.employees.unshift(e);
    this._log('created', 'employee', e.id, null, null, fio);
    this._save(); return structuredClone(e);
  }
  async updateEmployee(id, patch, newLines, validFrom) {
    const e = this.db.employees.find(x => x.id === id);
    if (!e) throw new Error('Карточка не найдена');
    // dept — как в базе: отделение меняют владелец и директор (сторож
    // employee_guard_columns, 123). Демо обязано отказывать теми же словами.
    if (patch.dept !== undefined && patch.dept !== e.dept && !['owner', 'ceo'].includes(this.user?.role)) {
      throw new Error('Отделение меняет владелец или директор: по нему группируются график, ведомость и правила');
    }
    for (const f of ['fio', 'position', 'phone', 'specialty_id', 'dept', 'status', 'hired_on', 'left_on', 'week_hours']) {
      if (patch[f] !== undefined && patch[f] !== e[f]) {
        this._log('updated', 'employee', id, f, String(e[f] ?? ''), String(patch[f] ?? ''));
        e[f] = patch[f];
      }
    }
    // hidden_at отдельно от списка выше: у него человеческая подпись в журнале и
    // красный флаг — как у триггера log_employee_hide в базе. Через общий цикл
    // получилось бы «hidden_at: 2026-08-09T10:00:00Z → », что не читается.
    // В боевом хранилище patch уходит в UPDATE целиком, и «Вернуть» снимает
    // пометку; демо обязано вести себя так же, иначе оно врёт про боевую систему.
    if (patch.hidden_at !== undefined && patch.hidden_at !== e.hidden_at) {
      this._log('updated', 'employee', id, 'архив',
                e.hidden_at ? 'убрана' : 'в списке',
                patch.hidden_at ? 'убрана из списка' : 'возвращена в список', true);
      e.hidden_at = patch.hidden_at;
    }
    if (newLines) {
      const vfrom = validFrom || rateFrom();
      const active = e.lines.filter(l => !l.valid_to);
      // закрываем строки, которых больше нет / которые изменились; добавляем новые
      for (const ol of active) {
        const match = newLines.find(nl => nl._keep === ol.id);
        if (!match) {
          ol.valid_to = vfrom;
          this._log('updated', 'rate_line', ol.id, 'закрыта', lineLabel(ol), null);
        }
      }
      for (const nl of newLines) {
        if (nl._keep) continue; // без изменений
        const line = { id: this.db.nextId.line++, line_type: nl.line_type, pay_kind: nl.pay_kind,
          amount: nl.amount ?? null, amount_night: nl.amount_night ?? null,
          percent: nl.percent ?? null, valid_from: vfrom, valid_to: null };
        e.lines.push(line);
        this._log('updated', 'rate_line', line.id, 'новая строка', null, lineLabel(line));
      }
    }
    this._save(); return structuredClone(e);
  }
  async setPrimaryRate(id, line, validFrom) {
    const e = this.db.employees.find(x => x.id === id);
    if (!e) throw new Error('Карточка не найдена');
    const active = e.lines.filter(l => !l.valid_to && l.line_type === 'основной');
    if (active.length === 1 && sameRate(active[0], line)) return active[0];   // no-op: та же ставка — не смётываем журнал
    const vfrom = validFrom || rateFrom();
    active.forEach(c => { c.valid_to = vfrom; this._log('updated', 'rate_line', c.id, 'ставка закрыта', lineLabel(c), null); });   // закрываем ВСЕ активные основные
    const nl = { id: this.db.nextId.line++, line_type: 'основной', pay_kind: line.pay_kind,
      amount: line.amount ?? null, amount_night: line.amount_night ?? null, percent: line.percent ?? null,
      valid_from: vfrom, valid_to: null };
    e.lines.push(nl);
    this._log('updated', 'rate_line', nl.id, 'ставка добавлена', null, lineLabel(nl));
    this._save(); return nl;
  }
  /* Расчёт в ДЕМО. Внимание: демо считает в браузере, а прод — в базе (view).
     Это упрощённое зеркало для показа экрана; расхождения с продом возможны,
     потому что здесь нет ни RLS, ни CHECK, ни флагов. Проверять денежную
     логику надо на проде в BEGIN…ROLLBACK, а не в демо. */
  _demoPayrollLines(period) {
    const out = [];
    for (const e of this.db.employees) {
      const cells = (this.db.schedule || []).filter(s => s.employee_id === e.id && String(s.work_date).startsWith(period));
      const lines = (e.lines || []).filter(l => !l.valid_to);
      for (const l of lines) {
        if (l.pay_kind === 'процент') {   // ЗП = % × ручная выручка (зеркало v_month_salary/036)
          const rev = (this.db.docRevenue || []).filter(x => x.employee_id === e.id && x.period === period).reduce((s, x) => s + x.amount_kop, 0);
          if (rev > 0) out.push({ employee_id: e.id, kind: 'процент', planned: 0, worked: 0, hours: 0, money_kop: Math.round(rev * (l.percent || 0) / 100), isPct: true });
          continue;
        }
        const want = { 'оклад': ['day'], 'сутки': ['day24'], '12ч': ['day12', 'night12'], 'почасово': ['custom'] }[l.pay_kind] || [];
        const mine = cells.filter(c => want.includes(c.plan_kind));
        const planned = mine.length;
        const worked = mine.filter(c => c.fact !== 'x').length;
        let money = 0;
        if (l.pay_kind === 'оклад') money = planned ? Math.round((l.amount || 0) * 100 * worked / planned) : 0;
        else if (l.pay_kind === 'сутки') money = Math.round((l.amount || 0) * 100 * worked);
        else if (l.pay_kind === '12ч') money = mine.filter(c => c.fact !== 'x')
          .reduce((s, c) => s + Math.round((c.plan_kind === 'night12' ? (l.amount_night || 0) : (l.amount || 0)) * 100), 0);
        if (planned || worked) out.push({ employee_id: e.id, kind: l.pay_kind, planned, worked, hours: 0, money_kop: money });
      }
    }
    return out;
  }
  async listPayrollLines(period) { return this._demoPayrollLines(period); }
  async getPayrollRow(employee_id, period) {
    return (await this.listPayroll(period)).find(r => r.employee_id === employee_id) || null;
  }
  async listPayroll(period) {
    const lines = this._demoPayrollLines(period);
    // Архивных прод НЕ выбрасывает: keys в v_month_total держит человека, если за
    // месяц есть хоть один денежный след — выплата, перенос, выдача, зарплата по
    // графику. Иначе долг уволенному исчезал бы с экрана вместе с ним. Демо
    // повторяет это правило: иначе оно врёт увереннее боя (тот же довод, что ниже
    // про отпускные), и метка «Архив · N» в нём не появилась бы никогда.
    const sled = e => (this.db.money || []).some(m => m.employee_id === e.id && m.period === period)
      || (this.db.carry   || []).some(c => c.employee_id === e.id && c.period === period)
      || (this.db.payouts || []).some(p => p.employee_id === e.id && p.period === period)
      || lines.some(l => l.employee_id === e.id);
    return this.db.employees.filter(e => e.status !== 'archived' || sled(e)).map(e => {
      const my = lines.filter(l => l.employee_id === e.id);
      const salary = my.reduce((s, l) => s + l.money_kop, 0);
      const mon = (this.db.money || []).filter(x => x.employee_id === e.id && x.period === period);
      const sum = k => mon.filter(x => x.kind === k).reduce((s, x) => s + x.amount_kop, 0);
      // Зеркало v_month_total: в «к выдаче» идут наличные виды — наличка, премия и
      // отпускные НАЛИЧНЫМИ; карточные там не участвуют, они уже выплачены.
      // Про отпускные НА КАРТУ здесь раньше стояло «Δ их не вычитает, за дни отпуска
      // оклад не начисляется» — правило времён 044/046. Оно отменено: с появлением
      // otpusk_nach отпуск виден с обеих сторон — начисление прибавляется, выплата
      // вычитается. См. delta_kop ниже.
      const cash = sum('cash'), premia = sum('premia'), otpusk = sum('otpusk'),
            otpuskCash = sum('otpusk_cash'), cardUvol = sum('card_uvol');
      const ovr = (this.db.salaryOverride || []).find(x => x.employee_id === e.id && x.period === period);
      const salaryFinal = ovr ? ovr.amount_kop : salary;   // финальная сумма вручную заменяет расчёт
      return { employee_id: e.id, period: period + '-01', fio: e.fio, status: e.status,
        oklad_kop: my.filter(l => l.kind === 'оклад').reduce((s, l) => s + l.money_kop, 0),
        shift_kop: my.filter(l => l.kind !== 'оклад' && l.kind !== 'процент').reduce((s, l) => s + l.money_kop, 0),
        percent_kop: my.filter(l => l.kind === 'процент').reduce((s, l) => s + l.money_kop, 0), salary_kop: salaryFinal,
        // Прогноз на конец месяца (119) демо не считает: в боевой базе он берётся
        // из будущих плановых дней, а MockStore их не оплачивает вовсе. Ставим
        // равным расчёту — тогда строка «К концу месяца» просто не появится.
        // Врать нулём или выдуманным числом здесь нельзя: демо для того и есть,
        // чтобы показывать, как поведёт себя боевая система.
        salary_plan_kop: salaryFinal,
        salary_marked_kop: salaryFinal,
        cash_kop: cash, cash_avans_kop: sum('cash_avans'), premia_kop: premia, otpusk_kop: otpusk,
        otpusk_cash_kop: otpuskCash, card_uvol_kop: cardUvol,
        otpusk_nach_kop: sum('otpusk_nach'),   // начисление, не выплата: ни в to_pay, ни в delta
        card_avans_kop: sum('card_avans'), card_rasch_kop: sum('card_rasch'),
        to_pay_kop: cash + premia + otpuskCash,
        // Выданное на руки (085). Без этой строки демо не показывало фичу вовсе:
        // плитка «Выдано наличными» на «Обзоре» вечно 0 ₽, а сигнал «Выдано
        // вперёд» не мог сработать от настоящей выдачи. Как в базе — сумма всех
        // confirmed, сторно уже минусовое.
        paid_kop: (this.db.payouts || [])
          .filter(p => p.employee_id === e.id && p.period === period && p.status === 'confirmed')
          .reduce((s, p) => s + (p.amount_kop || 0), 0),
        unchecked_kop: premia + otpuskCash,
        // + премия: она деньги, которые человеку ЕЩЁ надо выдать (миграция 059).
        // Демо обязано считать так же, как прод, иначе оно врёт увереннее прода.
        // перенос с прошлого месяца (067) — со знаком, как в бою
        carry_kop: ((this.db.carry || []).find(x => x.employee_id === e.id && x.period === period) || {}).amount_kop || 0,
        bolnich_nach_kop: sum('bolnich_nach'), bolnich_kop: sum('bolnich'),
        // Зеркало delta_kop из v_month_total. РАСХОДИЛОСЬ с боем: демо не прибавляло
        // начисленные отпускные и не вычитало выплаченные — правило времён 046, когда
        // otpusk_nach ещё не существовал. На проде обе половины давно в формуле, и
        // из-за такой же устаревшей ПОДПИСИ под цифрой (03.08) чуть не прибавили
        // отпускные второй раз. Демо, считающее не как бой, врёт увереннее боя.
        delta_kop: salaryFinal + premia + sum('otpusk_nach') + sum('bolnich_nach')
          + (((this.db.carry || []).find(x => x.employee_id === e.id && x.period === period) || {}).amount_kop || 0)
          - (sum('card_rasch') + sum('card_avans') + cardUvol + cash + sum('cash_avans')
             + otpusk + otpuskCash + sum('bolnich')),
        norm_days: my.reduce((s, l) => s + l.planned, 0), fact_days: my.reduce((s, l) => s + l.worked, 0),
        flag_no_rate: !(e.lines || []).some(l => !l.valid_to), flag_partial_month: false,
        flag_oklad_no_days: false, flag_no_data: false, flag_no_patient_data: false, flag_manual_salary: !!ovr,
      flag_archived: e.status === 'archived' };
    });
  }
  async addMoneyLine({ employee_id, period, kind, amount_kop, note }) {
    if (!(amount_kop > 0)) throw new Error('Сумма должна быть больше 0');
    this.db.money = this.db.money || [];
    const row = { id: (this.db.nextId.money = (this.db.nextId.money || 1) + 1), employee_id, period, kind,
      amount_kop, note: note || null, entered_by: this.user?.name || '?', created_at: new Date().toISOString(), source: 'manual' };
    this.db.money.push(row);
    this._log('деньги', 'money_line', row.id, kind, null, (amount_kop / 100) + ' ₽');
    this._save(); return row;
  }
  async reverseMoneyLine(row) {
    if ((this.db.money || []).some(x => x.reverses_id === row.id)) throw new Error('Эта запись уже сторнирована');
    if (row.reverses_id) throw new Error('Нельзя сторнировать сторно');
    this.db.money = this.db.money || [];
    const r = { id: (this.db.nextId.money = (this.db.nextId.money || 1) + 1),
      employee_id: row.employee_id, period: row.period, kind: row.kind,
      amount_kop: -row.amount_kop, reverses_id: row.id, note: 'исправление',
      entered_by: this.user?.name || '?', created_at: new Date().toISOString(), source: 'manual' };
    this.db.money.push(r);
    this._log('сторно', 'money_line', r.id, row.kind, (row.amount_kop / 100) + ' ₽', (r.amount_kop / 100) + ' ₽');
    this._save(); return r;
  }
  // Импорт ведомостей: множество employee_id, у кого за период уже есть чистая
  // (не сторнированная) сумма этого вида — чтобы не залить второй раз.
  async existingMoneyIds(period, kind) {
    const net = new Map();
    for (const r of (this.db.money || [])) {
      if (r.kind !== kind || r.period !== period) continue;
      net.set(r.employee_id, (net.get(r.employee_id) || 0) + r.amount_kop);
    }
    return new Set([...net].filter(([, v]) => v > 0).map(([k]) => k));
  }
  async addMoneyLinesBatch(period, kind, items) {
    this.db.money = this.db.money || [];
    // Зеркалим прод: money_line_sane_chk (010) — |сумма| ≤ 1 000 000 ₽. В проде
    // такой ряд рушит ВЕСЬ пакет (атомарно), поэтому и здесь — до единой записи.
    if (items.some(it => it.amount_kop > 100000000)) throw new Error('Сумма вне разумных границ');
    const out = [];
    for (const it of items) {
      if (!(it.amount_kop > 0)) continue;
      // source='manual' — как в проде: прямую вставку RLS (022) не пускает под
      // source='import', та метка зарезервирована за серверной процедурой (010 §8).
      const row = { id: (this.db.nextId.money = (this.db.nextId.money || 1) + 1),
        employee_id: it.employee_id, period, kind, amount_kop: it.amount_kop,
        note: it.note || 'импорт ведомости', entered_by: this.user?.name || '?',
        created_at: new Date().toISOString(), source: 'manual' };
      this.db.money.push(row);
      this._log('деньги', 'money_line', row.id, kind, null, (it.amount_kop / 100) + ' ₽');
      out.push(row);
    }
    this._save(); return out;
  }
  // Зеркало серверной import_money_batch (миграция 034): провенанс source='import',
  // дедуп по чистой сумме (period,kind), сопоставление по fio (точное). Демо без
  // RLS и без замка — но форма ответа и логика та же, чтобы демо не расходилось.
  async importMoneyBatch(period, kind, items, filename) {
    this.db.money = this.db.money || [];
    const batch_id = (this.db.nextId.batch = (this.db.nextId.batch || 0) + 1);
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const inserted = [], skipped = [], unmatched = [];
    for (const it of (items || [])) {
      const amt = it.amount_kop;
      if (!(amt > 0) || amt > 100000000) { unmatched.push({ item: it, reason: 'сумма вне границ' }); continue; }
      // как на сервере: ключ employee_id присутствует → путь по id; иначе по fio.
      let emp = null;
      if ('employee_id' in it) {
        emp = it.employee_id;
        if (emp == null || !this.db.employees.some(e => e.id === emp)) { unmatched.push({ item: it, reason: 'нет сотрудника' }); continue; }
      } else if (it.fio && norm(it.fio) !== '') {
        const hits = this.db.employees.filter(e => e.status !== 'archived' && norm(e.fio) === norm(it.fio));
        if (hits.length !== 1) { unmatched.push({ fio: it.fio, reason: hits.length ? 'неоднозначно' : 'не найден' }); continue; }
        emp = hits[0].id;
      } else { unmatched.push({ fio: it.fio || '', reason: 'пустое ФИО' }); continue; }
      const net = this.db.money.filter(m => m.employee_id === emp && m.period === period && m.kind === kind).reduce((s, m) => s + m.amount_kop, 0);
      if (net > 0) { skipped.push({ employee_id: emp }); continue; }
      const row = { id: (this.db.nextId.money = (this.db.nextId.money || 1) + 1), employee_id: emp, period, kind,
        amount_kop: amt, note: 'импорт ведомости', entered_by: this.user?.name || '?',
        created_at: new Date().toISOString(), source: 'import', import_batch_id: batch_id };
      this.db.money.push(row);
      this._log('деньги', 'money_line', row.id, kind, null, (amt / 100) + ' ₽');
      inserted.push({ employee_id: emp, amount_kop: amt });
    }
    this._save();
    return { batch_id, inserted_count: inserted.length, inserted, skipped_count: skipped.length, skipped, unmatched };
  }
  async getDoctorRevenue(employee_id, period) {
    return (this.db.docRevenue || []).filter(r => r.employee_id === employee_id && r.period === period).reduce((s, r) => s + r.amount_kop, 0);
  }
  async setDoctorRevenue(employee_id, period, target_kop) {
    this.db.docRevenue = this.db.docRevenue || [];
    const cur = await this.getDoctorRevenue(employee_id, period);
    const delta = target_kop - cur;
    if (delta === 0) return null;
    const row = { id: (this.db.nextId.docrev = (this.db.nextId.docrev || 0) + 1), employee_id, period, amount_kop: delta, created_at: new Date().toISOString() };
    this.db.docRevenue.push(row);
    this._log('выручка', 'doctor_month_revenue', row.id, null, null, (target_kop / 100) + ' ₽');
    this._save(); return row;
  }
  // Финальная сумма вручную — зеркало прода (миграция 049). Одна на (человек, месяц).
  async getSalaryOverride(employee_id, period) {
    const r = (this.db.salaryOverride || []).find(x => x.employee_id === employee_id && x.period === period);
    return r ? r.amount_kop : null;
  }
  async listPrevRemainder(period) {
    const [y, m] = period.split('-').map(Number);
    const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const all = (await this.listPayroll(pm))
      .map(r => ({ employee_id: r.employee_id, fio: r.fio, delta_kop: r.delta_kop || 0, salary_kop: r.salary_kop || 0 }))
      .sort((a, b) => a.delta_kop - b.delta_kop);
    return { prev: pm, rows: all.filter(r => r.delta_kop < 0), all };
  }
  async listCarries(period) {
    return (this.db.carry || []).filter(x => x.period === period)
      .map(x => ({ employee_id: x.employee_id, amount_kop: x.amount_kop, note: x.note || null }));
  }
  /* Зеркало log_month_carry (миграция 134). Демо обязано красить журнал ТАК ЖЕ,
     как бой: правка и снятие уже учтённого переноса — КРАСНЫМ, создание — нет.
     Иначе на демо нельзя проверить именно то, ради чего 134 и написана, а окно
     при этом обещает «пишутся в журнал красным». */
  async setCarry(employee_id, period, amount_kop, note) {
    this.db.carry = this.db.carry || [];
    const i = this.db.carry.findIndex(x => x.employee_id === employee_id && x.period === period);
    const было = i >= 0 ? this.db.carry[i].amount_kop : null;
    if (amount_kop == null) {
      if (i >= 0) {
        this.db.carry.splice(i, 1);
        this._log('deleted', 'month_carry', employee_id, 'с прошлого месяца',
                  period + ': ' + (было / 100) + ' ₽ (убран)', null, true);
      }
      this._save(); return null;
    }
    const row = { employee_id, period, amount_kop, note: note || null };
    if (i >= 0) this.db.carry[i] = row; else this.db.carry.push(row);
    this._log(i >= 0 ? 'updated' : 'created', 'month_carry', employee_id, 'с прошлого месяца',
              i >= 0 ? period + ': ' + (было / 100) + ' ₽' : null,
              period + ': ' + (amount_kop / 100) + ' ₽' + (note ? ' · ' + note : ''),
              i >= 0);
    this._save(); return row;
  }
  async setSalaryOverride(employee_id, period, amount_kop, note) {
    this.db.salaryOverride = this.db.salaryOverride || [];
    const i = this.db.salaryOverride.findIndex(x => x.employee_id === employee_id && x.period === period);
    if (amount_kop == null) {
      if (i >= 0) { this.db.salaryOverride.splice(i, 1); this._log('финальная сумма', 'salary_override', employee_id, null, null, 'убрана'); this._save(); }
      return null;
    }
    if (i >= 0) { this.db.salaryOverride[i].amount_kop = amount_kop; this.db.salaryOverride[i].note = note || null; }
    else this.db.salaryOverride.push({ employee_id, period, amount_kop, note: note || null });
    this._log('финальная сумма', 'salary_override', employee_id, null, null, (amount_kop / 100) + ' ₽' + (note ? ' · ' + note : ''));
    this._save(); return { employee_id, period, amount_kop };
  }
  async listNotes(employee_id) {
    return (this.db.notes || []).filter(n => n.employee_id === employee_id)
      .slice().sort((a, b) => a.created_at < b.created_at ? 1 : -1)
      .map(n => ({ ...n, author_name: n.author_name || this.user?.name || '—' }));
  }
  async addNote(employee_id, text) {
    this.db.notes = this.db.notes || [];
    const row = { id: (this.db.nextId.note = (this.db.nextId.note || 0) + 1), employee_id, text,
      author_name: this.user?.name || '—', created_at: new Date().toISOString() };
    this.db.notes.push(row); this._save(); return row;
  }
  async listMoneyEvents(employee_id, period) {
    return (this.db.money || []).filter(x => x.employee_id === employee_id && x.period === period)
      .map(x => ({ ...x, kind_label: MONEY_KIND_RU[x.kind] || x.kind, entered_by_name: x.entered_by, is_import: false }));
  }
  async listShiftKinds() { return SHIFT_KINDS; }
  async listSchedule(period) {
    const pre = period + '-';   // period = 'YYYY-MM'
    return this.db.schedule.filter(s => String(s.work_date).startsWith(pre)).map(s => ({ ...s }));
  }
  async setScheduleCell(employeeId, work_date, cell, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error('День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор');
    const empty = (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null && (cell.fact ?? null) === null;
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date && (s.position || 'main') === position);
    if (empty) { if (idx >= 0) this.db.schedule.splice(idx, 1); this._save(); return null; }   // очистка = удаление строки
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    if (!row) { row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, position, plan_start: null, plan_end: null, plan_kind: null, fact: null, source: 'manual' }; this.db.schedule.push(row); }
    if ('plan_start' in cell) row.plan_start = cell.plan_start ?? null;
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;   // ручная правка = старт+код, диапазон импорта сбрасываем
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    row.updated_at = new Date().toISOString();
    this._save(); return { ...row };
  }
  async setScheduleBulk(cells) {   // массовое заполнение (шаблон): cells=[{employee_id,work_date,plan_kind,plan_start,fact?}]
    let zapisano = 0;
    for (const c of cells) {
      if (this._dayClosed(c.work_date)) continue;   // закрытый день шаблоном не переписывает НИКТО (зеркалит RLS 143)
      zapisano++;
      const pos = c.position || 'main';
      const idx = this.db.schedule.findIndex(s => s.employee_id === c.employee_id && s.work_date === c.work_date && (s.position || 'main') === pos);
      let row = idx >= 0 ? this.db.schedule[idx] : null;
      if (!row) { row = { id: this.db.nextId.schedule++, employee_id: c.employee_id, work_date: c.work_date, position: pos, plan_start: null, plan_kind: null, plan_end: null, fact: null, source: c.source || 'template' }; this.db.schedule.push(row); }
      row.plan_kind = c.plan_kind ?? null;
      row.plan_start = c.plan_start ?? null;
      row.plan_end = c.plan_end ?? null;
      if ('fact' in c) row.fact = c.fact ?? null;
      row.updated_at = new Date().toISOString();
    }
    this._save(); return zapisano;                       // сколько РЕАЛЬНО записали (как в проде), а не сколько прислали
  }
  async clearScheduleMonth(employeeId, period, position = 'main') {   // удалить месяц ОДНОЙ позиции (закрытые дни не трогаем ни у кого)
    const pre = period + '-', before = this.db.schedule.length;
    this.db.schedule = this.db.schedule.filter(s => !(s.employee_id === employeeId && (s.position || 'main') === position && String(s.work_date).startsWith(pre) && !this._dayClosed(s.work_date)));
    this._save(); return before - this.db.schedule.length;
  }
  async setScheduleFact(employeeId, work_date, fact, position = 'main') {   // табель: null=по плану · 'x'=не вышел · число=факт.часы
    if (this._dayClosed(work_date)) throw new Error('День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор');
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date && (s.position || 'main') === position);
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    const old = row ? (row.fact ?? null) : null;
    if (!row) {
      if (fact == null) return null;                     // нет ни плана, ни факта — нечего отмечать
      row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, position, plan_start: null, plan_kind: null, plan_end: null, fact: null, source: 'manual' };
      this.db.schedule.push(row);
    }
    row.fact = fact ?? null;
    row.updated_at = new Date().toISOString();
    this._log('updated', 'schedule', row.id, 'факт', String(old ?? ''), String(fact ?? ''));   // анти-фрод след: кто/когда
    if (!row.plan_kind && (row.fact == null)) {          // клетка без плана и без факта — удаляем строку-пустышку
      this.db.schedule.splice(this.db.schedule.indexOf(row), 1); this._save(); return null;
    }
    this._save(); return { ...row };
  }
  _dayClosed(wd) { return (this.db.closed || []).some(d => d.work_date === wd); }
  // Нормы часов месяца — зеркало v_month_norm (migrations/056): ручное
  // переопределение → производственный календарь РФ по типу недели → ничего.
  async listMonthNorms(period) {
    const per = period + '-01';
    const cal = PROD_NORM_2026[period] || null;
    return this.db.employees.filter(e => e.status !== 'archived').map(e => {
      const wk = e.week_hours == null ? null : parseFloat(e.week_hours);
      const calH = cal && wk != null ? cal[String(wk)] ?? null : null;
      const man = (this.db.monthNorms || []).find(n => n.employee_id === e.id && n.period === per);
      return { employee_id: e.id, period: per, hours: man ? man.hours : calH,
        is_manual: !!man, week_hours: wk, calendar_hours: calH };
    });
  }
  async setMonthNorm(employee_id, period, hours) {
    this.db.monthNorms = this.db.monthNorms || [];
    const per = period + '-01';
    const cur = this.db.monthNorms.find(n => n.employee_id === employee_id && n.period === per);
    const e = this.db.employees.find(x => x.id === employee_id);
    const old = cur ? String(cur.hours) : null;
    if (cur) cur.hours = hours; else this.db.monthNorms.push({ employee_id, period: per, hours });
    this._log('updated', 'employee_month_norm', employee_id, `${e ? e.fio : '?'} · ${period} · норма часов`, old, String(hours));
    this._save(); return { employee_id, period: per, hours };
  }
  async clearMonthNorm(employee_id, period) {
    this.db.monthNorms = this.db.monthNorms || [];
    const per = period + '-01';
    const i = this.db.monthNorms.findIndex(n => n.employee_id === employee_id && n.period === per);
    if (i < 0) return null;
    const [row] = this.db.monthNorms.splice(i, 1);
    const e = this.db.employees.find(x => x.id === employee_id);
    this._log('updated', 'employee_month_norm', employee_id, `${e ? e.fio : '?'} · ${period} · норма часов`, String(row.hours), 'по календарю');
    this._save(); return row;
  }
  async listClosedDays(period) {                         // множество закрытых дат месяца 'YYYY-MM'
    const pre = period + '-';
    return (this.db.closed || []).filter(d => String(d.work_date).startsWith(pre)).map(d => d.work_date);
  }
  /* Записи в журнал зеркалят триггер log_closed_day (002): закрытие — обычной
     строкой, открытие — КРАСНОЙ и с тем, кто и когда закрывал. Без этого демо
     врало бы в самом важном: Дарина проверяет «фіксується в журналі червоним»
     именно здесь, а на проде это делает база. */
  async closeDay(work_date) {                            // закрыть день (operator/owner/ceo)
    // Роль и «не будущее» проверяем и здесь: на проде это делает политика cd_ins,
    // и демо обязано упираться в то же самое, иначе проверка глазами врёт.
    if (!['owner', 'operator', 'ceo'].includes(this.user?.role)) throw new Error('Закрывать дни может Алёна, Милена или директор');
    if (work_date > new Date(Date.now() + 3 * 3600e3 + 864e5).toISOString().slice(0, 10)) throw new Error('Этот день ещё не наступил — закрывать нечего');
    this.db.closed = this.db.closed || [];
    if (!this.db.closed.some(d => d.work_date === work_date)) {
      this.db.closed.push({ work_date, closed_by: this.user?.id || null, closed_at: new Date().toISOString() });
      this._log('closed', 'day', 0, 'закрыт день', null, work_date);
    }
    this._save(); return work_date;
  }
  async reopenDay(work_date) {                           // открыть день — владелец и директор (зеркалит cd_del)
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Открыть день может Милена или директор');
    const bylo = (this.db.closed || []).find(d => d.work_date === work_date);
    this.db.closed = (this.db.closed || []).filter(d => d.work_date !== work_date);
    if (bylo) this._log('reopened', 'day', 0, 'открыт день (был закрыт ' + (bylo.closed_by ?? '?') + ' @ ' + bylo.closed_at + ')', work_date, work_date, true);
    this._save(); return true;
  }
  // Закрыть период целиком. Зеркалит close_period (143): будущее отсекаем, уже
  // закрытые пропускаем, возвращаем СКОЛЬКО закрыли — чтобы повторный клик
  // честно сказал «уже были закрыты», а не соврал галочкой.
  async closePeriod(from_date, to_date) {
    if (!['owner', 'operator', 'ceo'].includes(this.user?.role)) throw new Error('Закрывать дни может Алёна, Милена или директор');
    const zavtra = new Date(Date.now() + 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
    this.db.closed = this.db.closed || [];
    let n = 0;
    for (let d = new Date(from_date + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to_date; d.setUTCDate(d.getUTCDate() + 1)) {
      const wd = d.toISOString().slice(0, 10);
      if (wd > zavtra) continue;
      if (this.db.closed.some(x => x.work_date === wd)) continue;
      this.db.closed.push({ work_date: wd, closed_by: this.user?.id || null, closed_at: new Date().toISOString() });
      this._log('closed', 'day', 0, 'закрыт день', null, wd);   // по строке на день, как триггер на проде
      n++;
    }
    this._save(); return n;
  }
  async openPeriod(from_date, to_date) {                 // зеркалит open_period (144): право у owner/ceo
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Открыть день может Милена или директор');
    this.db.closed = this.db.closed || [];
    let n = 0;
    for (const d of [...this.db.closed]) {
      if (d.work_date < from_date || d.work_date > to_date) continue;
      this.db.closed = this.db.closed.filter(x => x.work_date !== d.work_date);
      this._log('reopened', 'day', 0, 'открыт день (был закрыт: ' + (d.closed_by ?? '?') + ')', d.work_date, d.work_date, true);
      n++;
    }
    this._save(); return n;
  }
  async requestRetroEdit(work_date, employee_id, target, payload) {   // ретро-правка закрытого дня: заявка + код
    if (!(this.db.closed || []).some(d => d.work_date === work_date)) throw new Error('день не закрыт');
    this.db.retro = this.db.retro || [];
    this.db.nextId.retro = this.db.nextId.retro || 1;   // существующий localStorage мог не иметь поля (иначе NaN-id)
    if (this.db.retro.some(r => r.employee_id === employee_id && r.work_date === work_date && r.status === 'pending' && Date.now() < r.expires))
      throw new Error('уже есть активный запрос на эту клетку');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const id = this.db.nextId.retro++;
    this.db.retro.push({ id, work_date, employee_id, target, new_fact: payload.new_fact ?? null, code, attempts: 0, status: 'pending', expires: Date.now() + 600000 });
    this._save();
    return { id, demoCode: code };   // demoCode — ТОЛЬКО демо (в проде код уходит по СМС и не возвращается)
  }
  async confirmRetroEdit(request_id, code) {             // -> 'ok' | 'wrong_code' | 'expired' | 'locked' | 'already_done' | 'not_found'
    const r = (this.db.retro || []).find(x => x.id === request_id);
    if (!r) return 'not_found';
    if (r.status !== 'pending') return 'already_done';
    if (Date.now() > r.expires) { r.status = 'expired'; this._save(); return 'expired'; }
    if (r.attempts >= 5) { r.status = 'expired'; this._save(); return 'locked'; }
    if (String(r.code) !== String(code).trim()) { r.attempts++; this._save(); return 'wrong_code'; }
    const idx = this.db.schedule.findIndex(s => s.employee_id === r.employee_id && s.work_date === r.work_date);
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    if (!row) { row = { id: this.db.nextId.schedule++, employee_id: r.employee_id, work_date: r.work_date, plan_start: null, plan_end: null, plan_kind: null, fact: null, source: 'manual' }; this.db.schedule.push(row); }
    const old = row.fact ?? null;
    row.fact = r.new_fact ?? null; row.updated_at = new Date().toISOString();
    this.db.journal.unshift({ id: this.db.nextId.journal++, actor: this.user?.name || '?', action: 'retro', entity: 'schedule', entity_id: row.id, field: 'ретро-правка ' + r.work_date, old_value: String(old ?? '—'), new_value: String(r.new_fact ?? '—'), at: new Date().toISOString(), red: true });
    r.status = 'confirmed'; this._save(); return 'ok';
  }
  // Демо-зеркало оплат пациентов: те же поля и та же арифметика сторно, что в
  // v_patient_month / v_patient_events — иначе демо снова разошёлся бы с продом.
  async listPatientMonth(period) {
    const by = new Map();
    for (const p of (this.db.patients || [])) {
      if (String(p.paid_on || '').slice(0, 7) !== String(period).slice(0, 7)) continue;
      const k = p.employee_id, cur = by.get(k) || { employee_id: k, period, fio: p.fio || '—', amount_kop: 0, visits: 0, reversed: 0 };
      cur.amount_kop += p.amount_kop || 0;
      if (p.reverses_id) cur.reversed++; else cur.visits++;
      by.set(k, cur);
    }
    return [...by.values()].sort((a, b) => b.amount_kop - a.amount_kop);
  }
  async listPatientEvents({ period, beforeId = null, limit = 50 } = {}) {
    let arr = (this.db.patients || [])
      .filter(p => String(p.paid_on || '').slice(0, 7) === String(period).slice(0, 7))
      .sort((a, b) => (b.id || 0) - (a.id || 0));
    if (beforeId != null) arr = arr.filter(p => (p.id || 0) < beforeId);
    const rows = arr.slice(0, limit);
    return { rows, hasMore: arr.length > limit, lastId: rows.length ? rows[rows.length - 1].id : null };
  }
  async listRedRemarks(limit = 50) { return (this.db.journal || []).filter(j => j.red).slice(0, limit); }
  async listRecentPayouts(limit = 5, period = null) {
    const все = (this.db.payouts || [])
      .filter(p => p.status === 'confirmed' && (!period || p.period === period))
      .sort((a, b) => String(b.confirmed_at || '').localeCompare(String(a.confirmed_at || '')));
    return сводкаВыдач(все, limit, p => p.fio || '—');
  }
  /* Выдача наличных (085) в демо. Правила базы повторяем ровно те, что проверить
     глазами: выдачу не удалить и не переписать, ошибку гасят МИНУСОВОЙ строкой,
     сторно одно на выдачу и сторно не сторнируют. Без этого демо показывало бы
     кнопку, которая «всегда работает», и первое же несовпадение вылезло бы
     на проде. Скрытую ЗП тут не изображаем — в демо её нет. */
  // В демо базы нет — показываем в консоли, чтобы путь был проверяем и здесь.
  async logError(kind, message, stack, screen, version, ms) {
    console.warn('[ушло бы в базу]', { kind, message, screen, version, ms });
  }
  async listPayouts(employee_id, period) {
    return (this.db.payouts || [])
      .filter(p => p.employee_id === employee_id && p.period === period && p.status === 'confirmed')
      .sort((a, b) => a.id - b.id);
  }
  async payoutGive(employee_id, period, amount_kop, note) {
    if (!['owner', 'operator', 'ceo', 'cashier1', 'cashier2'].includes(this.user?.role))
      throw new Error('Нет права выдавать наличные этому сотруднику');
    if (!(amount_kop > 0)) throw new Error('Сумма выдачи должна быть больше нуля');
    const emp = (this.db.employees || []).find(e => e.id === employee_id);
    if (!emp) throw new Error('Сотрудник не найден');
    // Тот же запрет, что в базе (payout_give + CHECK payout_period_not_future_chk):
    // без него демо разрешало то, на чём прод откажет.
    const мес = new Date().toISOString().slice(0, 7);
    if (period > мес) throw new Error('Нельзя выдать за будущий месяц');
    // Старый localStorage мог не знать про payout — иначе id = NaN и кнопка
    // «Отменить» молча ничего не делает. Тот же приём, что для retro.
    if (!this.db.nextId.payout) this.db.nextId.payout = 1;
    const id = this.db.nextId.payout++;
    // Сам себе? В демо у пользователей связи с карточкой нет, поэтому тут почти
    // всегда false — но правило то же, что в базе, и подставить её можно руками.
    const себе = !!(this.user?.employee_id && this.user.employee_id === employee_id);
    this.db.payouts = this.db.payouts || [];
    // Держим ССЫЛКУ на созданную строку: given_ahead проставляется ниже, уже
    // после await, и «последняя в массиве» к тому моменту может быть чужой.
    const строкаВыдачи = { id, employee_id, fio: emp.fio, period, amount_kop,
      status: 'confirmed', confirmed_at: new Date().toISOString(), code_sent_at: null,
      reverses_id: null, cancel_reason: null, is_self_payout: себе,
      note: (note || '').trim().slice(0, 200) || null, given_ahead: false };
    this.db.payouts.push(строкаВыдачи);
    // Красным помечает ТОЛЬКО выдача вперёд — «сам себе» больше не тревога
    // (Дарина 04.08). Основание то же, что в базе: выдано за месяц больше, чем
    // «Осталось выдать».
    const дано = (this.db.payouts || [])
      .filter(p => p.employee_id === employee_id && p.period === period && p.status === 'confirmed')
      .reduce((s, p) => s + (p.amount_kop || 0), 0);
    const строка = (await this.listPayroll(period)).find(x => x.employee_id === employee_id);
    const вперёд = дано > (строка?.delta_kop || 0);
    строкаВыдачи.given_ahead = вперёд;
    // Месяц и «задним числом» — как в триггере (085): без них демо не показывало
    // ровно те две вещи, которые туда и добавляли.
    // Предыдущий месяц считаем ДАТОЙ, а не вычитанием единицы из строки: в январе
    // «01 − 1» давало «2026-00», и декабрь — прошлый месяц! — уезжал в «задним
    // числом», хотя база его таковым не считает. Проверено на границе года.
    const сег = new Date(), пред = new Date(Date.UTC(сег.getFullYear(), сег.getMonth() - 1, 1));
    const назад = period < пред.toISOString().slice(0, 7);
    this._log('created', 'payout', id,
      (вперёд ? 'ВЫДАНО ВПЕРЁД, без кода · ' : 'ВЫДАНО, без кода · ') + emp.fio
        + ' · ' + MONTHS_RU[Number(period.slice(5)) - 1] + ' ' + period.slice(0, 4)
        + (назад ? ' · ЗАДНИМ ЧИСЛОМ' : '')
        + ((note || '').trim() ? ' · ' + note.trim().slice(0, 200) : ''), null,
      (Math.round(amount_kop/100)).toLocaleString('ru-RU') + ' ₽', вперёд || назад);
    this._save(); return id;
  }
  async payoutReverse(payout_id, reason) {
    if (!['owner', 'operator', 'ceo', 'cashier1', 'cashier2'].includes(this.user?.role))
      throw new Error('Нет права отменять выдачу');
    const src = (this.db.payouts || []).find(p => p.id === payout_id);
    if (!src) throw new Error('Выдача не найдена');
    if (src.reverses_id) throw new Error('Это сторно, его не отменяют');
    if (src.status !== 'confirmed') throw new Error('Отменяют только состоявшуюся выдачу');
    if ((this.db.payouts || []).some(p => p.reverses_id === payout_id)) throw new Error('Эту выдачу уже отменили');
    if (!this.db.nextId.payout) this.db.nextId.payout = 1;
    const id = this.db.nextId.payout++;
    this.db.payouts.push({ id, employee_id: src.employee_id, fio: src.fio, period: src.period,
      amount_kop: -src.amount_kop, status: 'confirmed', confirmed_at: new Date().toISOString(),
      code_sent_at: null, reverses_id: src.id, cancel_reason: (reason || '').trim().slice(0, 200) || null,
      // В базе колонка NOT NULL DEFAULT false — в демо строка сторно тоже должна
      // иметь false, а не undefined: «демо == прод» проверяется по значениям.
      given_ahead: false,
      is_self_payout: false });
    this._log('created', 'payout', id,
      'ОТМЕНА выдачи · ' + src.fio
        + ' · ' + MONTHS_RU[Number(src.period.slice(5)) - 1] + ' ' + src.period.slice(0, 4)
        + ((reason || '').trim() ? ' · ' + reason.trim().slice(0, 200) : ''),
      null, '−' + (Math.round(src.amount_kop/100)).toLocaleString('ru-RU') + ' ₽', true);
    this._save(); return id;
  }
  // Зеркало присутствия (083) для демо: одна «вкладка» — сам вошедший. Смысл не
  // в многопользовательности, а в том, чтобы блок на «Обзоре» было на чём проверить.
  async ping(state) {
    if (!this.user) return;
    this.db.presence = (this.db.presence || []).filter(p => p.user_id !== this.user.id);
    this.db.presence.push({ user_id: this.user.id, display_name: this.user.name, role: this.user.role,
      last_seen: new Date().toISOString(), screen: state.screen ?? null,
      period: state.period ? state.period + '-01' : null, editing: state.editing ?? null,
      editing_at: state.editing ? new Date().toISOString() : null });
    this._save();
  }
  async listPresence() {
    const now = Date.now();
    return (this.db.presence || []).map(p => ({ ...p,
      online: now - new Date(p.last_seen).getTime() < 90000,
      edits_hour: (this.db.journal || []).filter(j => j.actor === p.display_name
        && now - new Date(j.at).getTime() < 3600000).length }));
  }
  /* ── Обсуждение в демо (зеркало 086) ────────────────────────────────────
     Приватность повторяем ЧЕСТНО: в демо тоже видно только свои каналы. Иначе
     на демо нельзя проверить главное правило — «владелец в чужой приватный не
     входит», — а проверять его надо именно там, где не страшно ошибиться. */
  _chans() {
    if (!this.db.channels) {
      this.db.channels = [{ id: 1, name: 'Общий', kind: 'team', is_private: false, members: [] },
                          { id: 2, name: 'Разработчикам', kind: 'dev', is_private: false, members: [] }];
      this.db.nextId.channel = 3; this.db.nextId.comment = 1; this._save();
    }
    return this.db.channels;
  }
  _canSeeChan(c) {
    return !c.is_private || c.created_by === this.user?.id
        || (c.members || []).some(m => m.user_id === this.user?.id);
  }
  async listAccounts() { return DEMO_USERS.map(u => ({ id: u.id, display_name: u.name, role: u.role })); }
  async listChannels() { return this._chans().filter(c => this._canSeeChan(c)); }
  async listComments(channelId, limit = 100) {
    const c = this._chans().find(x => x.id === channelId);
    if (!c || !this._canSeeChan(c)) return [];
    return (this.db.comments || []).filter(m => m.channel_id === channelId).slice(-limit);
  }
  async postComment(c) {
    const ch = this._chans().find(x => x.id === c.channel_id);
    if (!ch || !this._canSeeChan(ch)) throw new Error('Этот канал приватный — вас в нём нет');
    if (!String(c.text || '').trim()) throw new Error('Сообщение пустое или длиннее 4000 знаков');
    this.db.comments = this.db.comments || [];
    const emp = c.about_employee_id ? (this.db.employees || []).find(e => e.id === c.about_employee_id) : null;
    const row = { id: this.db.nextId.comment++, channel_id: c.channel_id, author: this.user.id,
      author_user: { display_name: this.user.name, role: this.user.role },
      text: c.text, created_at: new Date().toISOString(), edited_at: null, deleted_at: null,
      mentions: c.mentions || [], about_employee_id: c.about_employee_id ?? null,
      about: emp ? { fio: emp.fio } : null,
      about_screen: c.about_screen ?? null, about_period: c.about_period ? c.about_period + '-01' : null };
    this.db.comments.push(row); this._save();
    return row;
  }
  async editComment(id, text) {
    const m = (this.db.comments || []).find(x => x.id === id);
    if (!m || m.author !== this.user.id) throw new Error('Изменить можно только своё сообщение');
    if (m.deleted_at) throw new Error('Удалённое сообщение изменить нельзя');
    m.text = text; m.edited_at = new Date().toISOString(); this._save(); return m;
  }
  async deleteComment(id) {
    const m = (this.db.comments || []).find(x => x.id === id);
    if (!m || m.author !== this.user.id) throw new Error('Удалить можно только своё сообщение');
    m.deleted_at = new Date().toISOString(); this._save(); return m;
  }
  async createChannel(name, memberIds) {
    const row = { id: this.db.nextId.channel++, name, kind: 'team', is_private: true, created_by: this.user.id,
      members: [...new Set([this.user.id, ...(memberIds || [])])].map(u => ({ user_id: u })) };
    this._chans().push(row); this._save(); return row;
  }
  async markRead(channelId) {
    this.db.reads = (this.db.reads || []).filter(r => !(r.user_id === this.user.id && r.channel_id === channelId));
    this.db.reads.push({ user_id: this.user.id, channel_id: channelId, last_read: new Date().toISOString() });
    this._save();
  }
  async unreadCounts() {
    const seen = new Map((this.db.reads || []).filter(r => r.user_id === this.user?.id).map(r => [r.channel_id, r.last_read]));
    const out = new Map();
    for (const m of this.db.comments || []) {
      if (m.author === this.user?.id || m.deleted_at) continue;
      const s = seen.get(m.channel_id);
      if (!s || m.created_at > s) out.set(m.channel_id, (out.get(m.channel_id) || 0) + 1);
    }
    return out;
  }
  async listJournal({ filter = 'all', beforeId = null, limit = 50, who = '', act = '', from = '', to = '' } = {}) {
    let arr = (this.db.journal || []).filter(j => journalMatch(j, filter)).sort((a, b) => (b.id || 0) - (a.id || 0));
    if (beforeId != null) arr = arr.filter(j => (j.id || 0) < beforeId);
    // Зеркало вьюхи v_journal_named (миграция 070): демо обязано показывать журнал
    // так же, как прод, иначе на нём нельзя проверить именно то, ради чего 070 и
    // делалась. Правила те же: часть сущностей кладёт в entity_id самого
    // сотрудника, часть — номер своей строки, и его надо разрешать поиском.
    const BY_EMP = ['employee', 'employee_month_norm', 'month_carry', 'salary_override', 'doctor_month_revenue'];
    // payout — как money_line: в entity_id номер СВОЕЙ строки, сотрудника и месяц
    // достаём поиском. Без этой строки каждая выдача в демо-журнале писалась бы
    // «сотрудник не определён», и ветку срезки ФИО, дописанную ради 085, в демо
    // было бы не проверить — при том что в базе journal_fill_subject их ставит.
    const SRC = { schedule: 'schedule', money_line: 'money', rate_line: null, payout: 'payouts' };
    const rows = arr.slice(0, limit).map(j => {
      let subject_id = j.employee_id ?? null, subject_date = j.ref_date ?? null;
      if (subject_id == null) {
        if (BY_EMP.includes(j.entity)) subject_id = j.entity_id;
        else if (SRC[j.entity]) {
          const row = (this.db[SRC[j.entity]] || []).find(r => r.id === j.entity_id);
          if (row) { subject_id = row.employee_id ?? null; subject_date = subject_date ?? (row.work_date || row.period || null); }
        }
      }
      const emp = subject_id == null ? null : (this.db.employees || []).find(e => e.id === subject_id);
      return { ...j, subject_id, subject_date, subject_fio: emp ? emp.fio : null };
    });
    // те же фильтры, что в бою: кто/кого, действие, период — иначе на демо
    // нельзя проверить именно то, ради чего экран и делается
    const ACT = { add: ['created', 'деньги', 'выручка', 'импорт'],
                  edit: ['updated'], del: ['deleted', 'сторно', 'возврат'] };
    const w = String(who || '').toLowerCase();
    const out = rows.filter(j =>
      (!w || (j.subject_fio || '').toLowerCase().includes(w)
          || String(j.actor_name || j.actor || '').toLowerCase().includes(w))
      && (!ACT[act] || ACT[act].includes(j.action))
      && (!from || String(j.at).slice(0, 10) >= from)
      && (!to || String(j.at).slice(0, 10) <= to));
    return { rows: out, hasMore: arr.length > limit, lastId: out.length ? out[out.length - 1].id : null };
  }
}

export function lineLabel(l) {
  const kind = l.pay_kind;
  if (kind === 'процент') return `${l.line_type} · процент ${l.percent ?? '?'} %`;
  if (kind === '12ч') return `${l.line_type} · 12ч день ${l.amount ?? '?'} / ночь ${l.amount_night ?? '?'} ₽`;
  // Зеркало rate_label() в БД (migrations/055): у «сдельно» суммы в ставке НЕТ,
  // иначе метка печаталась бы «сдельно ? ₽» и читалась как потерянная ставка.
  if (kind === 'сдельно') return `${l.line_type} · сдельно (сумму за месяц вписывают вручную)`;
  const unit = { 'оклад': '₽/мес', 'фикс': '₽/мес', 'сутки': '₽/смена', 'почасово': '₽/час' }[kind] || '₽';
  return `${l.line_type} · ${kind} ${l.amount ?? '?'} ${unit}`;
}

// Одинаковая ли ставка (чтобы не смётывать журнал повторным сохранением того же).
// parseFloat с обеих сторон — numeric из Supabase приходит строкой ("50000.00").
/* Сырые ошибки Postgres → человеческий русский.
   Форма уже проверяет всё это (checkRate в app.js), так что сюда долетает
   только то, что форму обошло. Но если долетело — Милена не должна читать
   «new row violates check constraint "rate_line_amount_sane_chk"» английским
   в тосте, который гаснет через 2.8 секунды. */
/* Ошибки карточки сотрудника. До 022/023 путь сохранения карточки не заглядывал
   ни в одну из этих таблиц — CHECK телефона прилетал Милене сырым английским
   текстом Postgres. А это самая частая ошибка на этом экране: она заполняет
   52 недостающих номера. */
const EMPLOYEE_ERRORS = [
  ['phone_fmt_chk',          'Проверьте телефон: нужен российский мобильный, например +7 921 554-12-31'],
  ['employee_hire_leave_chk','Дата увольнения не может быть раньше даты приёма'],
  ['employee_status_check',  'Недопустимый статус карточки'],
  // Заводит — владелец и СЕО (emp_insert), правит — ещё Алёна и бухгалтер
  // (emp_update, 105). Общий текст «только владелец» после 105 стал неправдой и
  // сбивал бы с толку именно тех, кому правку как раз открыли.
  ['violates row-level security', 'Недостаточно прав на эту карточку'],
];
export function employeeError(err) {
  const raw = (err && (err.message || err.details || String(err))) || 'Неизвестная ошибка';
  for (const [needle, human] of EMPLOYEE_ERRORS) if (raw.includes(needle)) return human;
  return raw;
}

const RATE_ERRORS = [
  ['rate_line_amount_sane_chk', 'Сумма вне разумных границ (больше 0 и не больше 100 000 000 ₽)'],
  ['rate_line_kind_amount_chk', 'Поля не соответствуют виду оплаты: для «12ч» нужны обе ставки — дневная и ночная; для процента — от 1 до 100; у «сдельно» суммы быть не должно'],
  // Эти два ловят случай «приложение выложили раньше, чем накатили 055»:
  // база ещё не знает вида «сдельно», и без перевода Милена получила бы
  // сырое английское «violates check constraint» в тосте на 2.8 секунды.
  ['rate_line_pay_kind_check', 'База ещё не знает вид оплаты «Сдельно» — нужна миграция 055. Скажите об этом разработчику'],
  ['rate_line_check', 'База ещё не знает вид оплаты «Сдельно» — нужна миграция 055. Скажите об этом разработчику'],
  ['rate_line_range_chk',       'Новая ставка не может действовать раньше той, что уже стоит'],
  ['rate_line_one_active_primary', 'У сотрудника уже есть основная строка начисления. Лишние сделайте «Совместитель»'],
  ['Ставку нельзя править напрямую', 'Ставку нельзя править напрямую — заведите новую через смену ставки'],
  ['violates row-level security', 'Недостаточно прав: ставки заводит и меняет только владелец'],
];
export function rateError(err) {
  const raw = (err && (err.message || err.details || String(err))) || 'Неизвестная ошибка';
  for (const [needle, human] of RATE_ERRORS) if (raw.includes(needle)) return human;
  return raw;                                        // наши собственные raise из RPC уже по-русски
}

/* Ошибки обсуждения (086) → по-русски. Отдельно от rateError: там нарушение RLS
   значит «вы не владелец», здесь — «канал приватный, вас в нём нет». */
const COMMENT_ERRORS = [
  ['comment_text_check',         'Сообщение пустое или длиннее 4000 знаков'],
  ['comment_channel_name_check', 'Название канала: от 1 до 60 знаков'],
  ['for table "comment_channel_member"', 'Добавлять участников может только тот, кто завёл канал'],
  ['for table "comment_channel"',        'Недостаточно прав, чтобы завести канал'],
  ['violates row-level security',        'Этот канал приватный — вас в нём нет'],
];
export function commentError(err) {
  const raw = (err && (err.message || err.details || String(err))) || 'Неизвестная ошибка';
  for (const [needle, human] of COMMENT_ERRORS) if (raw.includes(needle)) return human;
  return raw;                                        // raise из триггера уже по-русски
}

/* Ошибки денежных записей → человеческий русский (те же CHECK/RLS, что в
   migrations/008–019). Сырое «violates check constraint» Милена читать не должна. */
// Подписи видов выплат — по смыслу те же, что ru_money_kind() в БД
// (migrations/046 §3); в БД они строчными, здесь с заглавной. Используются ТОЛЬКО
// в демо-режиме: на проде подпись приходит из v_money_events (kind_label).
const MONEY_KIND_RU = { cash: 'Наличные', cash_avans: 'Аванс наличными', premia: 'Премия',
  otpusk: 'Отпускные на карту', otpusk_cash: 'Отпускные наличными', otpusk_nach: 'Отпускные начислено',
  card_avans: 'Аванс на карту', card_rasch: 'ЗП на карту', card_uvol: 'Расчёт на карту (увольнение)' };
const MONEY_ERRORS = [
  ['money_line_sane_chk',   'Сумма вне разумных границ'],
  ['money_line_sign_chk',   'Сумма должна быть больше 0. Чтобы отменить запись — сделайте сторно'],
  ['money_line_period_chk', 'Период должен быть 1-м числом месяца'],
  ['Денежные записи не правятся', 'Денежные записи не правятся и не удаляются — исправление вносится сторно'],
  // Клиент может оказаться НОВЕЕ базы (публикация app/ и миграция — разные шаги).
  // Без этой строки попытка внести новый вид давала бы сырой английский Postgres,
  // а по старой RLS — «Недостаточно прав», что для владельца прямая ложь.
  // Номер миграции в тексте — тот, что человек будет искать в migrations/. Виды
  // выплат разъехались по графам в 053 (046 занята другой, уже применённой; см.
  // шапку 053_payout_kinds_split.sql).
  ['money_line_kind_chk', 'Этот вид выплаты база ещё не знает: не применена миграция 053. Обновите базу или выберите другой вид'],
  ['violates row-level security', 'Недостаточно прав для этого вида выплаты'],
  ['без сессии запрещена',  'Сессия истекла — войдите заново'],
];
export /* У переноса нет «вида выплаты», и moneyError с его текстом («Недостаточно прав
   для этого вида выплаты») уводил бы в сторону: перенос — это одна сумма на
   месяц, а не начисление. Отдельный переводчик, чтобы отказ читался по делу. */
function carryError(e) {
  const m = String(e?.message || e || '');
  if (/row-level security|permission denied|42501/i.test(m)) return 'Перенос с прошлого месяца меняет владелец или директор';
  if (/month_carry_nonzero_chk/i.test(m)) return 'Ноль переносить нечего — уберите перенос совсем';
  if (/month_carry_sane_chk/i.test(m)) return 'Слишком большая сумма переноса — проверьте, не опечатка ли';
  return m || 'Не удалось сохранить перенос';
}
function moneyError(err) {
  const raw = (err && (err.message || err.details || String(err))) || 'Неизвестная ошибка';
  for (const [needle, human] of MONEY_ERRORS) if (raw.includes(needle)) return human;
  return raw;                                        // наши raise из БД уже по-русски
}

export function sameRate(a, b) {
  const n = v => v == null || v === '' ? null : parseFloat(v);
  return a.pay_kind === b.pay_kind && n(a.amount) === n(b.amount) && n(a.amount_night) === n(b.amount_night) && n(a.percent) === n(b.percent);
}

/* ── SUPABASE (прод) ──────────────────────────────────────────────── */
export class SupabaseStore {
  constructor(url, key) { this.mode = 'supabase'; this.url = url; this.key = key; this.user = null; }
  /* Библиотека лежит локально (app/vendor/supabase.js) и грузится с нашего хостинга,
     а не с CDN — esm.sh/jsdelivr за Cloudflare и недоступны из РФ. Ленивая загрузка:
     в демо-режиме файл не тянется. */
  _loadLib() {
    if (window.supabase) return Promise.resolve(window.supabase);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = './vendor/supabase.js';
      s.onload = () => window.supabase ? res(window.supabase) : rej(new Error('Библиотека Supabase загрузилась, но не инициализировалась'));
      s.onerror = () => rej(new Error('Не удалось загрузить библиотеку Supabase (vendor/supabase.js)'));
      document.head.appendChild(s);
    });
  }
  async init() {
    const { createClient } = await this._loadLib();
    // lock: no-op — отключаем navigatorLock (именно он зависал и оставлял пустую карточку).
    // С ним getSession/login не виснут, а автовход по сохранённой сессии снова работает.
    this.sb = createClient(this.url, this.key, {
      auth: { persistSession: true, autoRefreshToken: true, lock: (_n, _t, fn) => fn() },
    });
    const { data } = await this.sb.auth.getSession();
    if (data?.session?.user) {
      if (localStorage.getItem(LOGIN_DAY_KEY) === mskDay()) await this._loadProfile(data.session.user);   // тот же день — остаёмся в системе
      else { try { await this.sb.auth.signOut(); } catch (e) {} this.user = null; }                       // вход был вчера/раньше → сбрасываем, нужен свежий вход
    }
  }
  async _loadProfile(authUser) {
    const { data, error } = await this.sb.from('app_user').select('*').eq('id', authUser.id).single();
    if (error) throw new Error('Пользователь не приписан к программе (app_user): ' + error.message);
    this.user = { id: data.id, name: data.display_name, role: data.role };
  }
  demoUsers() { return []; }
  async loginDemo() { throw new Error('Демо-вход недоступен: подключена настоящая база'); }
  async login(email, password) {
    if (!this.sb) throw new Error('База не загрузилась — обновите страницу (Cmd/Ctrl+R)');
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    localStorage.setItem(LOGIN_DAY_KEY, mskDay());   // запоминаем день входа — назавтра доступ сбросится
    await this._loadProfile(data.user);
    return this.user;
  }
  // Ключ дня снимаем ВСЕГДА, даже если signOut не достучался до сети: в библиотеке есть
  // ветка раннего выхода по сетевой ошибке, при которой сессия остаётся в localStorage.
  // Тогда «Выйти» нарисует форму входа, а следующее открытие в тот же день пустило бы
  // обратно БЕЗ пароля (гейт на init() сверяет только день). Снятый ключ закрывает это.
  async logout() {
    try { if (this.sb) await this.sb.auth.signOut(); }
    finally { this.user = null; localStorage.removeItem(LOGIN_DAY_KEY); }   // сначала юзер: если
    // localStorage запрещён (Safari «Блокировать все cookie»), removeItem бросит — и при обратном
    // порядке владелец остался бы залогинен в памяти при нарисованной форме входа.
  }
  // Вход просрочен? Проверяется не только при загрузке: программа, поставленная на телефон
  // иконкой, месяцами не перезагружается — висит в переключателе задач и возвращается «как
  // была». Без этой проверки вчерашний вход жил бы сколько угодно.
  // Если хранилище отвалилось посреди сессии — считаем вход просроченным, а не живым: лишний
  // ввод пароля дешевле бессрочного доступа. Зацикливания не будет — после перезагрузки
  // init() не выставит пользователя, и охранник !!this.user закоротит проверку.
  dayExpired() {
    if (!this.user) return false;
    try { return localStorage.getItem(LOGIN_DAY_KEY) !== mskDay(); } catch (e) { return true; }
  }
  me() { return this.user; }

  async listSpecialties() {
    const { data, error } = await this.sb.from('specialty').select('*').order('sort').order('name');
    if (error) throw error; return data;
  }
  async addSpecialty(name, category) {
    const { data, error } = await this.sb.from('specialty').insert({ name, category }).select().single();
    if (error) throw error; return data;
  }
  /* Переименование справочника. .select() обязателен: RLS не «запрещает», а не
     находит строку, и без него PostgREST вернул бы успех на нуле изменённых
     строк — оператор увидел бы «Сохранено», а в базе осталось бы старое имя. */
  /* Правила отделения и именованные суммы за смену (101).
     .select() после записи обязателен: RLS не «запрещает», а не находит строку, и
     без него PostgREST вернул бы успех на нуле изменённых строк — человек увидел
     бы «Сохранено», а в базе осталось бы старое. */
  async listShiftPresets() {
    const { data, error } = await this.sb.from('shift_preset').select('*')
      .order('category').order('sort').order('valid_from', { nullsFirst: true });
    if (error) throw error; return data || [];
  }
  async saveShiftPreset(row) {
    const q = row.id
      ? this.sb.from('shift_preset').update(row).eq('id', row.id)
      : this.sb.from('shift_preset').insert(row);
    const { data, error } = await q.select().single();
    if (error) throw error; return data;
  }
  async deleteShiftPreset(id) {
    const { data, error } = await this.sb.from('shift_preset').delete().eq('id', id).select();
    if (error) throw error;
    if (!data?.length) throw new Error('Удалить не удалось — нет прав или вариант уже удалён');
  }
  async listDeptRules() {
    const { data, error } = await this.sb.from('dept_rule').select('*').order('category');
    if (error) throw error; return data || [];
  }
  async saveDeptRule(row) {
    const { data, error } = await this.sb.from('dept_rule')
      .upsert(row, { onConflict: 'category' }).select().single();
    if (error) throw error; return data;
  }
  async deleteDeptRule(category) {
    const { data, error } = await this.sb.from('dept_rule').delete().eq('category', category).select();
    if (error) throw error;
    if (!data?.length) throw new Error('Удалить не удалось — нет прав или правила уже нет');
  }
  /* Сколько зарплаты подтверждено отметкой факта (113). Отдельным запросом, а не
     колонкой в расчёте: считается по дням, а расчёт — по месяцу. */
  /* Промежуточная ОЦЕНКА наработанного (миграция 145). Не начисление: ни одна
     вьюха расчёта её не читает, в «Осталось выдать» она не попадает. Нужна к
     20-му числу, когда выдают авансы: у кого ни отметок, ни выручки, картины
     нет вовсе, и аванс ставят на глаз (в июле так вышло 69 % и 73 % месячного
     заработка вперёд у двоих). */
  async listEstimates(period) {
    const { data, error } = await this.sb.from('month_estimate')
      .select('employee_id, kind, amount_kop, note, updated_at').eq('period', period + '-01');
    if (error) throw new Error(error.message);
    return data || [];
  }
  /* Одна строка на человека+месяц+вид, поэтому upsert по этому ключу: оценка по
     определению меняется («ці цифри приблизні, можуть змінювати»). Каждая правка
     идёт в журнал триггером — было → стало, кто, когда. */
  async saveEstimate(employee_id, period, kind, amount_kop, note) {
    const { data, error } = await this.sb.from('month_estimate')
      .upsert({ employee_id, period: period + '-01', kind, amount_kop,
                note: note || null, entered_by: this.user.id },
              { onConflict: 'employee_id,period,kind' })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async delEstimate(employee_id, period, kind) {
    // .select() обязателен: RLS не «запрещает», а не находит строку, и без него
    // PostgREST вернул бы успех на нуле удалённых.
    const { data, error } = await this.sb.from('month_estimate').delete()
      .eq('employee_id', employee_id).eq('period', period + '-01').eq('kind', kind).select();
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('Не удалось убрать прикидку — нет прав или её уже нет');
    return true;
  }
  async listMonthMarked(period) {
    const { data, error } = await this.sb.from('v_month_marked').select('*').eq('period', period + '-01');
    if (error) throw error; return data || [];
  }
  async listCategoryOrder() {
    const { data, error } = await this.sb.from('category_order').select('*').order('sort');
    if (error) throw error;
    return data || [];
  }
  /* Порядок отделений и специальностей (088). upsert, а не update: отделение
     могли вписать руками в форме специальности — строки порядка у него ещё нет. */
  async setCategoryOrder(rows) {
    // .select() — как в setSpecialtySort: под RLS запрет на UPDATE не даёт ошибки,
    // он даёт НОЛЬ изменённых строк, и без этого отказ выглядел бы как успех.
    const { data, error } = await this.sb.from('category_order')
      .upsert(rows, { onConflict: 'category' }).select();
    // Через этот метод идёт не только перестановка, но и ЗАВЕДЕНИЕ отделения
    // (123), а там база отказывает по делу: третий уровень вложенности, занятое
    // имя. Глотать её текст и всегда говорить «недостаточно прав» — значит
    // отправить владельца искать несуществующую проблему с доступом. Про права
    // говорим только тогда, когда дело правда в них.
    if (error) {
      throw new Error(error.code === '42501' || /permission|policy|row-level/i.test(error.message || '')
        ? 'Менять справочник отделений может владелец или директор'
        : (error.message || 'Не удалось сохранить справочник отделений'));
    }
    if (rows.length && (!data || !data.length)) throw new Error('Менять справочник отделений может владелец или директор');
  }
  async setSpecialtySort(rows) {
    for (const r of rows) {
      const { data, error } = await this.sb.from('specialty').update({ sort: r.sort }).eq('id', r.id).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('Менять справочник может владелец или директор');
    }
  }
  /* Переименование ОТДЕЛЕНИЯ — одной транзакцией в базе (RPC, миграция 123).
     Раньше это делали здесь в четыре запроса подряд: переписать категорию у
     специальностей → завести новую строку порядка → удалить старую. Транзакции
     между ними не было, и оборвись связь посередине — отделение осталось бы
     переименованным наполовину. А с внешними ключами такой порядок и не пройдёт:
     на строку справочника теперь смотрят люди, норма часов и суммы за смену.
     Совпало с существующим именем — отделения сливаются, это законный способ их
     объединить (форма предупреждает заранее). Возвращает число людей в итоговом
     отделении. */
  async renameCategory(oldName, newName) {
    const { data, error } = await this.sb.rpc('rename_department', { p_old: oldName, p_new: newName });
    if (error) throw new Error(error.message || 'Переименовать отделение может владелец или директор');
    return data ?? 0;
  }
  async updateSpecialty(id, name, category) {
    const { data, error } = await this.sb.from('specialty').update({ name, category }).eq('id', id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Менять справочник может владелец или директор');
    return data[0];
  }
  async listEmployees() {
    const { data, error } = await this.sb.from('employee')
      .select('*, lines:rate_line(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(e => ({ ...e, lines: e.lines || [] }));
  }
  /* Кто и когда убрал человека в архив. В самой карточке этого нет — есть только
     нынешний status, — поэтому берём из журнала: он неизменяемый (триггер
     journal_no_update), то есть ответ «кто убрал» подделать нельзя.

     Берём v_journal_named ради actor_name: в journal лежит uuid, и экрану
     пришлось бы отдельно тянуть список пользователей. security_invoker=on, так
     что RLS журнала (только владелец) действует ровно как на таблице — вызывать
     это имеет смысл только там, где экран и так владельческий.

     Возвращений из архива бывает несколько (человека вернули и убрали опять),
     поэтому берём САМУЮ СВЕЖУЮ запись на каждого — она и описывает нынешнее
     состояние карточки. */
  async listArchivedBy(ids = []) {
    if (!ids.length) return new Map();
    const { data, error } = await this.sb.from('v_journal_named')
      .select('entity_id,at,actor_name')
      .eq('entity', 'employee').eq('field', 'status').eq('new_value', 'archived')
      .in('entity_id', ids).order('at', { ascending: false });
    if (error) throw new Error(error.message);
    const by = new Map();
    for (const r of data || []) if (!by.has(r.entity_id)) by.set(r.entity_id, { at: r.at, who: r.actor_name || null });
    return by;
  }
  async createEmployee({ fio, position, phone, specialty_id, specialty_id_2, dept, hired_on, left_on, lines, valid_from }) {
    const { data: e, error } = await this.sb.from('employee')
      .insert({ fio, position, phone, specialty_id, specialty_id_2: specialty_id_2 || null, dept: dept || null, hired_on: hired_on || null, left_on: left_on || null, created_by: this.user.id }).select().single();
    if (error) throw new Error(employeeError(error));
    if (lines?.length) {
      const vfrom = valid_from || rateFrom();
      const rows = lines.map(l => ({ employee_id: e.id, line_type: l.line_type, pay_kind: l.pay_kind,
        amount: l.amount ?? null, amount_night: l.amount_night ?? null, percent: l.percent ?? null,
        valid_from: vfrom, created_by: this.user.id }));
      const { error: e2 } = await this.sb.from('rate_line').insert(rows);
      if (e2) { // карточка без ставок — уводим в архив, чтобы не висела в активных; DELETE запрещён
        await this.sb.from('employee').update({ status: 'archived' }).eq('id', e.id);
        throw new Error('Ставки не сохранились, карточка отменена: ' + rateError(e2));
      }
    }
    return e;
  }
  async updateEmployee(id, patch, newLines, validFrom) {
    // .select() возвращает изменённые ряды: если RLS не пустил — массив пустой,
    // и мы это заметим (иначе PostgREST молча вернёт success на 0 строк).
    const { data: upd, error } = await this.sb.from('employee').update(patch).eq('id', id).select();
    if (error) throw new Error(employeeError(error));   // поля-диффы в журнал пишет триггер БД
    if (!upd || !upd.length) throw new Error('Изменение не сохранено (недостаточно прав)');
    if (newLines) {
      // ВЕСЬ реконсайл строк — одним RPC в транзакции (migrations/028). Раньше здесь
      // был цикл: закрыть лишние строки отдельными запросами, потом вставить новые.
      // Транзакции между ними не было — если вставку отклоняли (опечатка в сумме),
      // часть строк оставалась ЗАКРЫТОЙ без замены → дыра в ставках → тихий недоплат.
      // Тот же класс, что чинил 013 для экрана «Ставки»; это второй вход — карточка.
      const p_keep_ids = newLines.filter(l => l._keep).map(l => l._keep);
      const p_new_lines = newLines.filter(l => !l._keep).map(l => ({
        line_type: l.line_type, pay_kind: l.pay_kind,
        amount: l.amount ?? null, amount_night: l.amount_night ?? null, percent: l.percent ?? null,
      }));
      const { error: eR } = await this.sb.rpc('reconcile_employee_rates',
        { p_employee_id: id, p_keep_ids, p_new_lines, p_valid_from: validFrom || null,
          p_backdate_ok: backdateNeedsOk(validFrom) });
      if (eR) throw new Error(rateError(eR));
    }
  }
  /* Убрать карточку из списка «Архив» или вернуть обратно (105). Не удаление:
     запись и журнал остаются. Право проверяет ТРИГГЕР в базе — только владелец;
     .select() обязателен, иначе отказ RLS выглядел бы как успех на нуле строк. */
  async setEmployeeHidden(id, hidden) {
    const { data, error } = await this.sb.from('employee')
      .update({ hidden_at: hidden ? new Date().toISOString() : null }).eq('id', id).select();
    if (error) throw new Error(employeeError(error));
    if (!data || !data.length) throw new Error('Убирать из архива может только владелец');
    return data[0];
  }
  async setPrimaryRate(id, line, validFrom) {
    // ОДИН вызов вместо «закрыть старую» + «вставить новую» двумя запросами.
    // Раньше между ними не было транзакции: если вставку отклоняли (опечатка в
    // сумме), старая оставалась ЗАКРЫТОЙ, а новой не появлялось — человек
    // оставался без ставки, и оклад тихо проседал ~60%, пока экран выглядел
    // нормально. Теперь оба шага внутри set_primary_rate (migrations/013):
    // либо оба, либо ни одного. Проверки прав, no-op и «задним числом» —
    // тоже там, на стороне базы, а не здесь.
    // validFrom задаёт владелец при СМЕНЕ ставки (rateChangeDialog); пусто =
    // первое заведение → 1-е число текущего месяца.
    const { data, error } = await this.sb.rpc('set_primary_rate', {
      p_employee_id:  id,
      p_pay_kind:     line.pay_kind,
      p_amount:       line.amount ?? null,
      p_amount_night: line.amount_night ?? null,
      p_percent:      line.percent ?? null,
      p_valid_from:   validFrom || null,
      p_backdate_ok:  backdateNeedsOk(validFrom),
    });
    if (error) throw new Error(rateError(error));
    return Array.isArray(data) ? data[0] : data;
  }
  async listShiftKinds() { return SHIFT_KINDS; }
  async listSchedule(period) {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    // Порционно — НЕ зависим от «Max rows» в панели Supabase. 119×31 = до 3689 строк
    // за месяц; при штатном лимите 1000 PostgREST молча ОБРЕЗАЛ БЫ до 1000, и ~2/3
    // графика пропали бы БЕЗ ошибки, а клик по «пустой» ячейке затёр бы реальные
    // данные upsert'ом. Раньше это держалось на том, что кто-то вручную поднял
    // лимит до 9999 (#53). Теперь тянем страницами до тех пор, пока страница
    // полная, — при любом лимите берём всё.
    return this._fetchAll(() => this.sb.from('schedule').select('*').gte('work_date', start).lt('work_date', next));
  }
  // Достаёт ВСЕ строки запроса страницами через .range(), не завися от серверного
  // лимита строк. Порядок по id обязателен: без стабильной сортировки .range()
  // между страницами мог бы дублировать или терять строки. makeQuery — функция,
  // возвращающая свежий билдер (range/order его мутируют).
  async _fetchAll(makeQuery, pageSize = 1000) {
    const all = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await makeQuery().order('id', { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      all.push(...data);
      if (data.length < pageSize) break;   // неполная страница = последняя
    }
    return all;
  }
  // position — какая из работ человека: 'main' (основная) или 'second' (вторая работа).
  // Ключ таблицы с миграции 072 — тройка (employee_id, work_date, position), и
  // onConflict обязан её повторять: по старой паре запрос теперь падает, потому
  // что такого ограничения больше нет.
  async setScheduleCell(employeeId, work_date, cell, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error(SupabaseStore.ZAKRYT);
    // «Пусто» считаем ТОЛЬКО когда вызывающий действительно чистит смену, то есть
    // прислал поля плана/факта. Иначе частичное обновление (одна лишь сумма)
    // читалось как пустая клетка и УДАЛЯЛО строку целиком: клик до «пусто» у
    // санитарки сносил вместе с суммой и саму смену 12ч, а с ней норму и факт
    // дня. Терялось молча — на экране клетка и так становится пустой.
    const touchesShift = 'plan_kind' in cell || 'plan_start' in cell || 'fact' in cell
      || 'fact_start' in cell || 'fact_end' in cell;
    const empty = touchesShift && (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null
      && (cell.fact ?? null) === null && (cell.amount_kop ?? null) === null
      && (cell.fact_start ?? null) === null;
    if (empty) {   // очистка = удаление строки, чтобы таблица не копила пустышки
      // .select() обязателен: DELETE под правами не ошибается на закрытом дне, а
      // молча удаляет НОЛЬ строк — и «Очищено» говорилось бы про целую смену.
      const { data, error } = await this.sb.from('schedule').delete()
        .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).select('id');
      if (error) throw this._perevestiOtkaz(error, work_date);
      if (!data || !data.length) {
        const { data: est } = await this.sb.from('schedule').select('id')
          .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).maybeSingle();
        if (est) { this._zapomnit(work_date); throw new Error(SupabaseStore.ZAKRYT); }
      }
      return null;
    }
    const row = { employee_id: employeeId, work_date, position, source: 'manual', updated_by: this.user.id };
    if ('plan_start' in cell) row.plan_start = cell.plan_start ?? null;
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;   // ручная правка = старт+код, диапазон импорта сбрасываем
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    if ('amount_kop' in cell) row.amount_kop = cell.amount_kop ?? null;   // оплата за смену целиком (074)
    // Своё время факта (108): «вышла с 9 до 21» — это ФАКТ, а не план. Раньше
    // такое наблюдение писать было некуда, кроме плана, и заливка из документа
    // его затирала.
    if ('fact_start' in cell) row.fact_start = cell.fact_start ?? null;
    if ('fact_end' in cell) row.fact_end = cell.fact_end ?? null;
    const { data, error } = await this.sb.from('schedule')
      .upsert(row, { onConflict: 'employee_id,work_date,position' }).select().single();
    if (error) throw this._perevestiOtkaz(error, work_date); return data;
  }
  async setScheduleBulk(cells) {   // массовое заполнение (шаблон/импорт). fact не трогаем — это план
    /* plan_end пишем ТОЛЬКО когда вызывающий его прислал. Раньше стояло
       `c.plan_end ?? null` — и повторный прогон шаблона, который это поле не
       передавал, ОБНУЛЯЛ конец смены у всех уже заполненных клеток: «9–17»
       превращалось в «9», и двенадцатичасовая смена снова считалась
       восьмичасовой, потому что часы брались из типа смены. Та же ошибка, что
       мы правили в 64 записях Алёны, только вносил её сам шаблон. */
    const rows = cells.map(c => {
      const row = { employee_id: c.employee_id, work_date: c.work_date,
        position: c.position || 'main',
        plan_kind: c.plan_kind ?? null, plan_start: c.plan_start ?? null,
        source: c.source || 'template', updated_by: this.user.id };
      if ('plan_end' in c) row.plan_end = c.plan_end ?? null;
      return row;
    });
    /* Закрытые дни ВЫБРАСЫВАЕМ из пачки, а не отправляем и надеемся. Отправить —
       значит уронить ВСЮ операцию: upsert идёт одним запросом, и одна строка на
       закрытый день отобьёт вместе с ней все остальные. Человек бы увидел
       «шаблон не применился» на весь месяц из-за одного проверенного дня.
       Пропущенные считаем и возвращаем — вызывающий скажет об этом вслух. */
    const otkrytye = rows.filter(r => !this._dayClosed(r.work_date));
    if (!otkrytye.length) return 0;
    const { error } = await this.sb.from('schedule').upsert(otkrytye, { onConflict: 'employee_id,work_date,position' });
    if (error) throw this._perevestiOtkaz(error, otkrytye[0].work_date);
    return otkrytye.length;                              // сколько РЕАЛЬНО записали, а не сколько прислали
  }
  // Чистим ОДНУ позицию: «Очистить месяц» в шаблоне относится к той строке
  // графика, из которой его вызвали, а не к обеим работам человека.
  async clearScheduleMonth(employeeId, period, position = 'main') {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    /* ⚠ DELETE под правами не ошибается на закрытых днях — он их просто НЕ ТРОГАЕТ
       (строка не проходит USING). Это ровно то поведение, которое нужно: очистка
       месяца не должна сносить проверенное. Но раньше метод возвращал true, и
       «месяц очищен» говорилось даже когда половина дней осталась. Возвращаем
       реальное число удалённых строк — вызывающий скажет человеку правду. */
    const { data, error } = await this.sb.from('schedule').delete()
      .eq('employee_id', employeeId).eq('position', position).gte('work_date', start).lt('work_date', next).select('id');
    if (error) throw error; return (data || []).length;
  }
  async setScheduleFact(employeeId, work_date, fact, position = 'main') {   // табель: пишем ТОЛЬКО факт (source/план не трогаем — сохраняем 'import')
    /* ⚠ Проверка стоит ПЕРВОЙ строкой не для красоты. Без неё закрытый день врал
       молча: UPDATE под правами возвращает НОЛЬ строк (не ошибку), код считал
       «строки нет» и шёл INSERT-ом ниже; при fact == null он вообще возвращал
       null — то есть «по плану» на закрытом дне выглядело как успешно
       сохранённое, а в базе не менялось ничего. Отметка факта — это деньги. */
    if (this._dayClosed(work_date)) throw new Error(SupabaseStore.ZAKRYT);
    // Журнал правок факта пишет триггер schedule_journal (migrations/002) — здесь ничего не нужно
    //   (перезаписывается при след. правке). Для анти-фрода нужна неизменяемая история кто/когда отметил.
    // eq('position') обязателен во ВСЕХ трёх запросах: без него отметка факта по
    // основной работе задела бы и строку дежурства за тот же день.
    const { data: upd, error } = await this.sb.from('schedule')
      .update({ fact: fact ?? null, updated_by: this.user.id })
      .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).select();
    if (error) throw error;
    if (upd && upd.length) {
      const r = upd[0];
      if (!r.plan_kind && (r.fact ?? null) === null) {   // ни плана, ни факта — не держим пустышку (как setScheduleCell)
        const { error: dErr } = await this.sb.from('schedule').delete()
          .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position);
        if (dErr) throw dErr; return null;
      }
      return r;
    }
    /* ⚠ Сюда мы попадаем, когда UPDATE не тронул НИ ОДНОЙ строки. Это два разных
       случая, и раньше они были склеены: (1) строки графика нет — писать нечего,
       (2) строка есть, но день закрыли из соседнего окна, и права её не отдали.
       Во втором случае при fact == null программа возвращала null и рисовала
       «Факт отмечен» — то есть врала: в базе не менялось ничего, а стоявший там
       'x' («не вышел») оставался, и человек не получал денег за день.
       Спрашиваем базу прямо: строка существует? Значит нас не пустили. */
    if (fact == null) {
      const { data: est } = await this.sb.from('schedule').select('id')
        .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).maybeSingle();
      if (est) { this._zapomnit(work_date); throw new Error(SupabaseStore.ZAKRYT); }
      return null;                                       // строки действительно нет — писать нечего
    }
    const { data: ins, error: e2 } = await this.sb.from('schedule')   // вышел без плана — новая строка
      .insert({ employee_id: employeeId, work_date, position, fact, source: 'manual', updated_by: this.user.id }).select().single();
    if (e2) throw this._perevestiOtkaz(e2, work_date); return ins;
  }
  // Нормы часов месяца. Считает БАЗА (v_month_norm, migrations/056): ручное
  // переопределение → производственный календарь по типу недели из карточки.
  // Одним запросом на месяц — иначе 119 вызовов employee_norm_hours().
  async listMonthNorms(period) {
    const { data, error } = await this.sb.from('v_month_norm')
      .select('employee_id, hours, is_manual, week_hours, calendar_hours').eq('period', period + '-01');
    if (error) throw error; return data || [];
  }
  // Переопределение на (человек, месяц) — редактируемое, одна строка. set_by
  // ставим сами: RLS emn_wr требует set_by = auth.uid() (нельзя от чужого имени).
  async setMonthNorm(employee_id, period, hours) {
    const { data, error } = await this.sb.from('employee_month_norm')
      .upsert({ employee_id, period: period + '-01', hours, set_by: this.user.id }, { onConflict: 'employee_id,period' })
      .select().single();
    if (error) throw new Error(employeeError(error));
    return data;
  }
  async clearMonthNorm(employee_id, period) {
    const { error } = await this.sb.from('employee_month_norm')
      .delete().eq('employee_id', employee_id).eq('period', period + '-01');
    if (error) throw new Error(employeeError(error));
    return true;
  }
  /* Закрытые дни держит БАЗА (права sch_ins/sch_upd/sch_del, миграция 143) — это
     единственная настоящая защита. Кэш ниже нужен не вместо неё, а чтобы отказ
     выглядел человеческой фразой, а не сырой ошибкой Postgres, и чтобы шаблон на
     месяц не падал целиком из-за одного закрытого дня.

     ⚠ Кэш ОБЯЗАН уметь ЗАБЫВАТЬ. Первая версия только добавляла даты — и день,
     который владелица только что открыла, оставался «закрытым» в кэше до F5:
     замок с числа снимался, клетка становилась редактируемой, а сохранение
     отбивалось фразой «день закрыт, откройте его» — тот, кто его уже открыл.
     Поэтому listClosedDays ПЕРЕСОБИРАЕТ свой месяц целиком, а closeDay /
     closePeriod / reopenDay правят кэш сразу за собой.

     Кэш всё равно может отстать (закрыли из соседнего окна) — на этот случай
     последнее слово за базой, а _perevestiOtkaz переводит её ответ на русский. */
  async listClosedDays(period) {                         // множество закрытых дат месяца 'YYYY-MM'
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { data, error } = await this.sb.from('closed_day').select('work_date').gte('work_date', start).lt('work_date', next);
    if (error) throw error;
    const dni = (data || []).map(d => d.work_date);
    this._closed = this._closed || new Set();
    const pre = period + '-';
    for (const d of [...this._closed]) if (d.startsWith(pre)) this._closed.delete(d);   // свой месяц — заново
    for (const d of dni) this._closed.add(d);
    return dni;
  }
  _dayClosed(wd) { return !!(this._closed && this._closed.has(wd)); }
  _zabyt(wd) { this._closed && this._closed.delete(wd); }
  _zapomnit(wd) { (this._closed = this._closed || new Set()).add(wd); }
  static ZAKRYT = 'День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор';
  /* Отказ прав выглядит как «new row violates row-level security policy». Человеку
     такое показывать нельзя. ⚠ Раньше здесь стояла ещё и проверка _dayClosed — и
     она делала перевод бесполезным ровно тогда, когда он нужен: если кэш свеж, до
     запроса не дошли вовсе, а если отстал, то _dayClosed == false и сырой текст
     улетал в тост. Записи в schedule ЗАПРЕЩЕНЫ только закрытием дня (роль
     проверена входом), поэтому отказ прав здесь означает именно его. */
  _perevestiOtkaz(e, work_date) {
    const t = String(e?.message || e || '');
    if (/row-level security|violates row level/i.test(t)) { this._zapomnit(work_date); return new Error(SupabaseStore.ZAKRYT); }
    return e;
  }
  async closeDay(work_date) {                            // закрыть день (operator/owner/ceo). closed_by = default auth.uid() (RLS)
    const { error } = await this.sb.from('closed_day').upsert({ work_date }, { onConflict: 'work_date', ignoreDuplicates: true });
    if (error) throw error;
    this._zapomnit(work_date);
    return work_date;
  }
  // Закрыть период одним вызовом (RPC close_period, миграция 143). Права берёт
  // из политики cd_ins — второй копии матрицы прав тут намеренно нет.
  // Возвращает, сколько дней реально закрылось: будущее и уже закрытое не в счёт.
  async closePeriod(from_date, to_date) {
    const { data, error } = await this.sb.rpc('close_period', { p_from: from_date, p_to: to_date });
    if (error) throw error;
    for (const d of this._dniPerioda(from_date, to_date)) this._zapomnit(d);
    return data ?? 0;
  }
  // Парная к closePeriod (144). Без неё закрытие несимметрично: закрыть месяц —
  // одно действие, открыть — тридцать. Право база берёт из cd_del (owner/ceo).
  async openPeriod(from_date, to_date) {
    const { data, error } = await this.sb.rpc('open_period', { p_from: from_date, p_to: to_date });
    if (error) throw error;
    for (const d of this._dniPerioda(from_date, to_date)) this._zabyt(d);
    return data ?? 0;
  }
  _dniPerioda(from_date, to_date) {
    const out = [];
    for (const d = new Date(from_date + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to_date; d.setUTCDate(d.getUTCDate() + 1))
      out.push(d.toISOString().slice(0, 10));
    return out;
  }
  async reopenDay(work_date) {                           // открыть день — RLS пускает владельца и директора (cd_del)
    // ⚠ DELETE под RLS не ошибается, а возвращает НОЛЬ строк — молчаливый отказ.
    // Поэтому смотрим на .select(): пусто = не пустило (или день уже открыт).
    const { data, error } = await this.sb.from('closed_day').delete().eq('work_date', work_date).select();
    if (error) throw error;
    if (!data || !data.length) {
      // Ноль строк — это ДВА разных случая, и валить их в «нет прав» нельзя:
      // владелице, у которой право есть, программа отвечала бы, что права нет.
      // Спрашиваем базу, существует ли строка: нет — день уже открыт (второе окно,
      // повторный клик), есть — значит нас действительно не пустили.
      const { data: est } = await this.sb.from('closed_day').select('work_date').eq('work_date', work_date).maybeSingle();
      this._zabyt(work_date);
      if (!est) return true;                             // уже открыт — не ошибка
      throw new Error('Открыть день может Милена или директор');
    }
    this._zabyt(work_date);
    return true;
  }
  async requestRetroEdit(work_date, employee_id, target, payload) {   // RPC: заявка + СМС-код (код не возвращается)
    const { data, error } = await this.sb.rpc('request_retro_edit', {
      p_work_date: work_date, p_employee_id: employee_id, p_target: target,
      p_new_fact: payload.new_fact ?? null, p_new_plan_kind: payload.new_plan_kind ?? null, p_new_plan_start: payload.new_plan_start ?? null });
    if (error) throw error; return { id: data };
  }
  async confirmRetroEdit(request_id, code) {             // RPC: -> статус-строка ('ok'/'wrong_code'/'expired'/'locked'/…)
    const { data, error } = await this.sb.rpc('confirm_retro_edit', { p_request_id: request_id, p_code: code });
    if (error) throw error; return data;
  }
  async listRedRemarks(limit = 50) {                     // «красные замечания» владельцу: ретро-правки
    const { data, error } = await this.sb.from('journal').select('*, actor_user:app_user(display_name)').eq('red', true).order('at', { ascending: false }).limit(limit);
    if (error) throw error; return (data || []).map(j => ({ ...j, actor: j.actor_user?.display_name || j.actor }));
  }
  // Последние выданные наличные для обзора владельца. payout_sel пускает owner ко
  // всем строкам; employee embed'ится по FK payout_employee_id_fkey.
  async listRecentPayouts(limit = 5, period = null) {
    // Из этого списка убираем ДВА вида строк: сами сторно (они тоже confirmed и
    // выглядели бы как обычная выдача, только с минусом) и выдачи, которые уже
    // отменили — «последние выдачи» должны быть тем, что реально отдано.
    // Берём с запасом и отсеиваем на клиенте: сторно всегда НОВЕЕ своей выдачи,
    // поэтому если выдача попала в окно, её отмена тоже в нём — отбор точный.
    // Месяцем ограничиваем: «Обзор» весь помесячный, и плитка «Выдано наличными»
    // рядом — тоже. Без этого под июлем показывались бы августовские выдачи.
    // Берём ВЕСЬ месяц, а не первые сорок: тем же запросом считаем, сколько за
    // месяц выдано вперёд, и на усечённом окне этот счёт молча врал бы. Строки
    // крошечные, выдач за месяц столько же, сколько людей.
    // Явный список колонок, а не `*`: на «Обзоре» это в одном Promise.all с
    // расчётом, а канал у клиники плохой. `note`/`cancel_reason` по 200 символов
    // здесь не нужны вовсе, и семнадцать колонок ради пяти строк — расточительство.
    let q = this.sb.from('payout')
      .select('id, employee_id, amount_kop, confirmed_at, code_sent_at, reverses_id, given_ahead, is_self_payout, emp:employee(fio)')
      .eq('status', 'confirmed');
    if (period) q = q.eq('period', period + '-01');
    const { data, error } = await q.order('confirmed_at', { ascending: false });
    if (error) throw error;
    return сводкаВыдач(data || [], limit, p => p.emp?.fio || '—');
  }
  /* Выдача наличных из рук в руки (085). Пишем ТОЛЬКО через RPC: политик
     insert/update на payout нет и не будет — кассира и статус ставит сервер,
     иначе «кто выдал» стало бы полем, которому нельзя верить. */
  /* Ошибка у пользователя → в базу (094). Тихо: это последний рубеж, и он не
     имеет права сам стать источником ошибки. Любой сбой отправки проглатываем —
     человеку и так уже плохо, второе красное окно ему не поможет. */
  async logError(kind, message, stack, screen, version, ms) {
    try {
      await this.sb.rpc('log_client_error', {
        p_kind: kind, p_message: message, p_stack: stack,
        p_screen: screen, p_version: version, p_ua: navigator.userAgent,
        p_ms: (ms == null ? null : Math.round(ms)) });
    } catch (e) { /* молчим намеренно */ }
  }
  async listPayouts(employee_id, period) {
    // ТОЛЬКО confirmed: так же считают v_month_payout и триггер переплаты.
    // СМС-ветка жива (статусы pending/cancelled/expired разрешены схемой), и
    // строка в любом из них попала бы в «уже выдано» — человека недоплатили бы
    // на её сумму, а флаг переплаты промолчал.
    const { data, error } = await this.sb.from('payout')
      .select('*').eq('employee_id', employee_id).eq('period', period + '-01')
      .eq('status', 'confirmed').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  async payoutGive(employee_id, period, amount_kop, note) {
    const { data, error } = await this.sb.rpc('payout_give',
      { p_employee_id: employee_id, p_period: period + '-01', p_amount_kop: amount_kop,
        p_note: note || null });
    if (error) throw error;
    return data;
  }
  async payoutReverse(payout_id, reason) {
    const { data, error } = await this.sb.rpc('payout_reverse',
      { p_payout_id: payout_id, p_reason: reason || null });
    if (error) throw error;
    return data;
  }
  // Keyset-пагинация по id (не offset): журнал append-only, новые записи сверху,
  // при offset они сдвигали бы страницы — строки дублировались бы или терялись.
  // Сортировка по id, а не по at: at при заливке шаблона (31 запись) почти
  // одинаков, id строго монотонен и без коллизий. Тянем limit+1, чтобы узнать,
  // есть ли ещё, без отдельного count.
  async listJournal({ filter = 'all', beforeId = null, limit = 50, who = '', act = '', from = '', to = '' } = {}) {
    // v_journal_named, а не сама таблица: вьюха доносит, У КОГО правка (subject_fio)
    // и за какой день (subject_date). У старых записей сотрудник достаётся поиском
    // по entity_id, пока жива исходная строка, — миграция 070. security_invoker=on,
    // так что RLS журнала (только владелец) действует ровно как на таблице.
    let q = this.sb.from('v_journal_named').select('*')
      .order('id', { ascending: false }).limit(limit + 1);
    if (filter === 'red') q = q.eq('red', true);
    else if (filter === 'money') q = q.in('entity', ['money_line', 'patient_payment']);
    else if (filter === 'payout') q = q.eq('entity', 'payout');
    else if (filter === 'premia') q = q.eq('entity', 'money_line').ilike('field', '%премия%');
    else if (filter === 'schedule') q = q.eq('entity', 'schedule');
    else if (filter === 'rate') q = q.eq('entity', 'rate_line');
    // Кто/кого: ищем И по автору правки, И по человеку, которого она касается —
    // «покажи всё по Иванову» не различает, он правил или правили его.
    if (who) {
      const w = `%${String(who).replace(/[%,()]/g, ' ')}%`;
      q = q.or(`subject_fio.ilike.${w},actor_name.ilike.${w}`);
    }
    // Денежные записи пишутся своими словами ('деньги', 'сторно'), остальные —
    // created/updated/deleted. Поэтому не один eq, а список на каждое действие.
    const ACT = { add: ['created', 'деньги', 'выручка', 'импорт'],
                  edit: ['updated'], del: ['deleted', 'сторно', 'возврат'] };
    if (ACT[act]) q = q.in('action', ACT[act]);
    // Даты включительно: «по» берём концом дня, иначе записи выбранного дня
    // не попадут — время у них не нулевое.
    if (from) q = q.gte('at', from + 'T00:00:00');
    if (to) q = q.lte('at', to + 'T23:59:59');
    if (beforeId != null) q = q.lt('id', beforeId);
    const { data, error } = await q;
    if (error) throw error;
    const hasMore = data.length > limit;
    const rows = (hasMore ? data.slice(0, limit) : data).map(j => ({ ...j, actor: j.actor_name || j.actor }));
    return { rows, hasMore, lastId: rows.length ? rows[rows.length - 1].id : null };
  }

  /* ── Оплаты пациентов ───────────────────────────────────────────────
     Только ЧТЕНИЕ. Вводить руками не даём (решение Дарины 20.07): оплаты
     приходят импортом, а экран нужен, чтобы зайти и СВЕРИТЬ, что импорт лёг
     верно. Это единственный источник процента врачей, и «атаку №1» (накрутку
     процента) ловит именно видимая сверка — потерпевшего у неё нет.
     Итоги считает БАЗА (v_patient_month): список постраничный, и сумма по
     загруженной странице врала бы. Сторно вычитается само (отрицательная сумма
     разрешена только строке с reverses_id). */
  // period приходит как 'YYYY-MM', в базе это date первого числа — та же
  // конвертация, что в listPayroll (period + '-01').
  async listPatientMonth(period) {
    const { data, error } = await this.sb.from('v_patient_month')
      .select('*').eq('period', period + '-01').order('amount_kop', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async listPatientEvents({ period, beforeId = null, limit = 50 } = {}) {
    let q = this.sb.from('v_patient_events').select('*').eq('period', period + '-01')
      .order('id', { ascending: false }).limit(limit + 1);
    if (beforeId != null) q = q.lt('id', beforeId);
    const { data, error } = await q;
    if (error) throw error;
    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    return { rows, hasMore, lastId: rows.length ? rows[rows.length - 1].id : null };
  }

  /* ── Расчёт (деньги) ────────────────────────────────────────────────
     Читаем ГОТОВЫЕ цифры из БД. Ничего денежного здесь не считаем: зарплата —
     функция входов, её считает v_month_total (migrations/019). Браузер только
     показывает и подписывает суммы. */
  async listPayroll(period) {                            // строка ведомости на человека
    const { data, error } = await this.sb.from('v_month_total')
      .select('*').eq('period', period + '-01').order('fio');
    if (error) throw error; return data || [];
  }
  async getPayrollRow(employee_id, period) {             // одна строка — для карточки сотрудника
    const { data, error } = await this.sb.from('v_month_total')
      .select('*').eq('employee_id', employee_id).eq('period', period + '-01').maybeSingle();
    if (error) throw error; return data || null;
  }
  async listPayrollLines(period) {                       // разбивка по строкам начисления
    // Агрегат считает БАЗА (v_payroll_lines, migrations/020): ~47 строк вместо
    // 1162 дневных. Тянуть дни в браузер было нельзя — PostgREST режет выдачу
    // на 1000 строк МОЛЧА, и «Сумма» опустела бы у всех за отсечкой.
    const { data, error } = await this.sb.from('v_payroll_lines')
      .select('*').eq('period', period + '-01');
    if (error) throw error;
    return (data || []).map(l => ({ ...l, planned: Number(l.planned) || 0, worked: Number(l.worked) || 0,
      hours: Number(l.hours) || 0, money_kop: Number(l.money_kop) || 0 }));
  }
  async addMoneyLine({ employee_id, period, kind, amount_kop, note }) {
    const { data, error } = await this.sb.from('money_line')
      .insert({ employee_id, period: period + '-01', kind, amount_kop, note: note || null, entered_by: this.user.id })
      .select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  async reverseMoneyLine(row) {
    // Сторно = НОВАЯ запись на минус исходную, а не правка старой. База требует
    // ровно минус ту же сумму, тот же вид/период/человека и запрещает сторно
    // сторно (migrations/010 §3). Обе записи остаются видны владельцу, и обе —
    // в журнале, причём сторно красным.
    const { data, error } = await this.sb.from('money_line').insert({
      employee_id: row.employee_id, period: row.period, kind: row.kind,
      amount_kop: -row.amount_kop, reverses_id: row.id,
      note: 'исправление', entered_by: this.user.id,
    }).select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  async listMoneyEvents(employee_id, period) {           // история «кто внёс и когда» — клик по числу
    const { data, error } = await this.sb.from('v_money_events')
      .select('*').eq('employee_id', employee_id).eq('period', period + '-01')
      .order('created_at', { ascending: false });
    if (error) throw error; return data || [];
  }
  // Импорт ведомостей: у кого за (период, вид) уже есть чистая сумма > 0 —
  // защита от повторной заливки. Сторно-пары в сумме дают 0 и не блокируют.
  async existingMoneyIds(period, kind) {
    const { data, error } = await this.sb.from('money_line')
      .select('employee_id, amount_kop').eq('period', period + '-01').eq('kind', kind);
    if (error) throw error;
    const net = new Map();
    for (const r of data || []) net.set(r.employee_id, (net.get(r.employee_id) || 0) + r.amount_kop);
    return new Set([...net].filter(([, v]) => v > 0).map(([k]) => k));
  }
  // Пакетная запись из импорта — ОДНИМ insert (атомарно: либо все ряды, либо
  // ни одного). entered_by ставим сами = auth.uid(), как требует RLS (ml_ins);
  // право писать этот kind проверит база — при отказе весь пакет откатится.
  async addMoneyLinesBatch(period, kind, items) {
    const rows = items.filter(it => it.amount_kop > 0).map(it => ({
      employee_id: it.employee_id, period: period + '-01', kind,
      amount_kop: it.amount_kop, note: it.note || 'импорт ведомости', entered_by: this.user.id,
    }));
    if (!rows.length) return [];
    const { data, error } = await this.sb.from('money_line').insert(rows).select();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  // Импорт через СЕРВЕРНУЮ процедуру (миграция 034): провенанс source='import'+
  // партия, атомарный дедуп под advisory-lock (закрывает гонку двух клиентов),
  // серверное сопоставление ФИО. items = [{employee_id|fio, amount_kop}].
  // Возвращает {batch_id, inserted_count, inserted, skipped_count, skipped, unmatched}.
  async importMoneyBatch(period, kind, items, filename) {
    const { data, error } = await this.sb.rpc('import_money_batch', {
      p_kind: kind, p_period: period + '-01', p_items: items, p_filename: filename || null,
    });
    if (error) throw new Error(moneyError(error));
    return data;
  }
  // Месячная выручка врача (для %). Хранение append-only (миграция 036) → чистое
  // значение = сумма строк. Показываем net, «установка» пишет дельту (net станет
  // target), чтобы значение было редактируемым, но каждое изменение — в журнал.
  async getDoctorRevenue(employee_id, period) {
    const { data, error } = await this.sb.from('doctor_month_revenue')
      .select('amount_kop').eq('employee_id', employee_id).eq('period', period + '-01');
    if (error) throw error;
    return (data || []).reduce((s, r) => s + r.amount_kop, 0);
  }
  async setDoctorRevenue(employee_id, period, target_kop) {
    const cur = await this.getDoctorRevenue(employee_id, period);
    const delta = target_kop - cur;
    if (delta === 0) return null;                              // без изменений
    const { data, error } = await this.sb.from('doctor_month_revenue')
      .insert({ employee_id, period: period + '-01', amount_kop: delta,
        note: cur ? 'коррекция выручки' : null, entered_by: this.user.id })
      .select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  // Финальная сумма вручную (миграция 049): для людей без графика — итоговая
  // зарплата за месяц одной суммой, ЗАМЕНЯЕТ вычисленную в v_month_total. Одна
  // строка на (сотрудник, месяц), редактируемая; каждое изменение — в журнал.
  async getSalaryOverride(employee_id, period) {
    const { data, error } = await this.sb.from('month_salary_override')
      .select('amount_kop').eq('employee_id', employee_id).eq('period', period + '-01').maybeSingle();
    if (error) throw error;
    return data ? data.amount_kop : null;
  }
  /* Кто ушёл в минус в предыдущем месяце — кандидаты на перенос. Считаем на
     лету, а не храним: пока месяц не закрыт, его цифры ещё двигаются, и
     заранее записанный перенос устарел бы молча. */
  /* Остаток прошлого месяца. rows — только должники (их переносим), all — ВСЕ,
     включая вышедших в плюс.
     `all` нужен, чтобы поймать два случая, которых раньше не видел никто:
       • перенос УСТАРЕЛ — прошлый месяц потом поправили, и снимок разошёлся;
       • перенос ЛИШНИЙ — человек больше не в минусе, а перенос ему всё ещё
         уменьшает выдачу.
     Оба возможны только у того, у кого перенос УЖЕ стоит, — а таких прежняя
     кнопка пропускала молча («уже проставленные не трогаем»). */
  async listPrevRemainder(period) {
    const [y, m] = period.split('-').map(Number);
    const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const { data, error } = await this.sb.from('v_month_total')
      // salary_kop — для прогноза тем, у кого в этом месяце графика нет вовсе:
      // «к концу месяца» берёт им сумму прошлого месяца (иначе больше миллиона
      // прогноза просто выпадало из итога).
      .select('employee_id, fio, delta_kop, salary_kop').eq('period', pm + '-01').order('delta_kop');
    if (error) throw error;
    const all = data || [];
    return { prev: pm, rows: all.filter(r => (r.delta_kop || 0) < 0), all };
  }
  /* Сами строки переносов за месяц — ради ПРИМЕЧАНИЯ. В v_month_total лежит
     только сумма (carry_kop), а пересчёту нужно знать, кто её поставил: свою
     запись он подписывает сам («остаток за …», «пересчитан: …»), и трогать
     можно только такие. Ручную — чужое решение — переписывать нельзя.
     Отдельным запросом, а не колонкой во вьюхе: это деньги 100 человек, и
     трогать их вьюху ради подписи не стоит. */
  async listCarries(period) {
    const { data, error } = await this.sb.from('month_carry')
      .select('employee_id, amount_kop, note').eq('period', period + '-01');
    if (error) throw error;
    return data || [];
  }
  /* Перенос остатка с прошлого месяца (миграция 067). Сумма СО ЗНАКОМ:
     минус — переплатили вперёд, плюс — недоплатили. null убирает перенос. */
  async setCarry(employee_id, period, amount_kop, note) {
    if (amount_kop == null) {
      // .select() обязателен: под RLS запрет на DELETE не даёт ошибки — он даёт
      // НОЛЬ удалённых строк и 204. Без этого Алёне (её роль писать переносы не
      // может) показывался тост «Перенос убран», а перенос оставался на месте и
      // в журнале не было ни строчки. В пакетном пути это «Готово: 5 из 5» при
      // нуле сделанного. Тот же путь у любого, чья сессия протухла.
      const { data, error } = await this.sb.from('month_carry')
        .delete().eq('employee_id', employee_id).eq('period', period + '-01').select();
      if (error) throw new Error(carryError(error));
      if (!data || !data.length) throw new Error('Убрать перенос может владелец или директор');
      return null;
    }
    const { data, error } = await this.sb.from('month_carry')
      .upsert({ employee_id, period: period + '-01', amount_kop, note: note || null, entered_by: this.user.id },
              { onConflict: 'employee_id,period' })
      .select().single();
    if (error) throw new Error(carryError(error));
    return data;
  }
  async setSalaryOverride(employee_id, period, amount_kop, note) {
    if (amount_kop == null) {                                  // убрать → вернуть расчёт
      const { error } = await this.sb.from('month_salary_override')
        .delete().eq('employee_id', employee_id).eq('period', period + '-01');
      if (error) throw new Error(moneyError(error));
      return null;
    }
    const { data, error } = await this.sb.from('month_salary_override')
      .upsert({ employee_id, period: period + '-01', amount_kop, note: note || null, entered_by: this.user.id },
              { onConflict: 'employee_id,period' })
      .select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  // Комментарии на карточке (миграция 037): лента заметок, append-only.
  async listNotes(employee_id) {
    const { data, error } = await this.sb.from('employee_note')
      .select('*, author_user:app_user(display_name)').eq('employee_id', employee_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(n => ({ ...n, author_name: n.author_user?.display_name || '—' }));
  }
  async addNote(employee_id, text) {
    const { data, error } = await this.sb.from('employee_note')
      .insert({ employee_id, text, author: this.user.id }).select().single();
    if (error) throw error;
    return data;
  }
  /* ── Кто в программе (миграция 083) ─────────────────────────────────────
     Отметка «я здесь»: экран, месяц и что открыто на правку. Имя и роль
     проставит триггер из app_user — клиент их не шлёт и подделать не может.
     Ошибки ГЛОТАЕМ: присутствие — украшение, из-за него не должно падать
     сохранение смены или тем более вход. */
  async ping(state) {
    if (!this.user) return;
    try {
      await this.sb.from('user_presence').upsert({
        user_id: this.user.id,
        screen: state.screen ?? null,
        period: state.period ? state.period + '-01' : null,
        editing: state.editing ?? null,
      }, { onConflict: 'user_id' });
    } catch (e) { console.warn('ping:', e); }
  }
  async listPresence() {
    const { data, error } = await this.sb.from('v_presence').select('*');
    if (error) throw error;
    return data || [];
  }

  /* ── Обсуждение (миграция 086) ───────────────────────────────────────────
     Что видно — решает RLS: публичный канал всем, приватный только участникам.
     Здесь фильтров по правам НЕТ намеренно: дублировать правило в браузере
     значит однажды разойтись с базой, а верить всё равно только базе. */
  /* Кого можно позвать через «@». Не app_user: та отдаёт свою строку и только
     владельцу — все (политика au_self), поэтому Алёна не увидела бы никого.
     v_account (087) — три колонки, без телефона и привязки к сотруднику. */
  async listAccounts() {
    const { data, error } = await this.sb.from('v_account').select('*').order('display_name');
    if (error) throw error;
    return data || [];
  }
  async listChannels() {
    const { data, error } = await this.sb.from('comment_channel')
      .select('*, members:comment_channel_member(user_id)').order('id');
    if (error) throw error;
    return data || [];
  }
  async listComments(channelId, limit = 100) {
    const { data, error } = await this.sb.from('comment')
      .select('*, author_user:app_user!comment_author_fkey(display_name, role), about:employee(fio)')
      .eq('channel_id', channelId).order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).reverse();
  }
  async postComment(c) {
    const { data, error } = await this.sb.from('comment').insert({
      channel_id: c.channel_id, author: this.user.id, text: c.text,
      mentions: c.mentions || [], about_employee_id: c.about_employee_id ?? null,
      about_screen: c.about_screen ?? null,
      about_period: c.about_period ? c.about_period + '-01' : null,
    }).select().single();
    if (error) throw new Error(commentError(error));
    return data;
  }
  // .select() обязателен: RLS не «запрещает», а не находит строку — без него
  // PostgREST вернул бы успех на нуле изменённых строк, и чужое сообщение
  // выглядело бы отредактированным до перезагрузки.
  async editComment(id, text) {
    const { data, error } = await this.sb.from('comment').update({ text }).eq('id', id).select();
    if (error) throw new Error(commentError(error));
    if (!data || !data.length) throw new Error('Изменить можно только своё сообщение');
    return data[0];
  }
  async deleteComment(id) {
    const { data, error } = await this.sb.from('comment')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id).select();
    if (error) throw new Error(commentError(error));
    if (!data || !data.length) throw new Error('Удалить можно только своё сообщение');
    return data[0];
  }
  async createChannel(name, memberIds) {
    const { data, error } = await this.sb.from('comment_channel')
      .insert({ name, is_private: true, created_by: this.user.id }).select().single();
    if (error) throw new Error(commentError(error));
    const rows = [...new Set([this.user.id, ...(memberIds || [])])].map(u => ({ channel_id: data.id, user_id: u }));
    const { error: e2 } = await this.sb.from('comment_channel_member').insert(rows);
    if (e2) throw new Error(commentError(e2));
    return data;
  }
  async markRead(channelId) {
    try {
      await this.sb.from('comment_read').upsert(
        { user_id: this.user.id, channel_id: channelId, last_read: new Date().toISOString() },
        { onConflict: 'user_id,channel_id' });
    } catch (e) { console.warn('markRead:', e); }   // отметка о прочтении не должна ронять чтение
  }
  /* Непрочитанное — ОДИН запрос, и тот на пульсе присутствия (30 с). Отдельный
     цикл опроса здесь заводить нельзя: холодный заход в клинике весит 800 КБ без
     сжатия, интернет плохой, кеш пустой каждый раз. */
  async unreadCounts() {
    try {
      const [{ data: reads }, { data: msgs }] = await Promise.all([
        this.sb.from('comment_read').select('channel_id, last_read'),
        this.sb.from('comment').select('channel_id, created_at, author').is('deleted_at', null),
      ]);
      const seen = new Map((reads || []).map(r => [r.channel_id, r.last_read]));
      const out = new Map();
      for (const m of msgs || []) {
        if (m.author === this.user.id) continue;                 // своё непрочитанным не бывает
        const s = seen.get(m.channel_id);
        if (!s || m.created_at > s) out.set(m.channel_id, (out.get(m.channel_id) || 0) + 1);
      }
      return out;
    } catch (e) { console.warn('unreadCounts:', e); return new Map(); }
  }
}

export function makeStore() {
  const c = window.APP_CONFIG || {};
  return (c.SUPABASE_URL && c.SUPABASE_ANON_KEY)
    ? new SupabaseStore(c.SUPABASE_URL, c.SUPABASE_ANON_KEY)
    : new MockStore();
}
