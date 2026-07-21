/* Слой данных: один интерфейс, две реализации.
   MockStore  — ДЕМО: всё в localStorage этого браузера, вход без пароля.
   SupabaseStore — прод: Supabase Auth + Postgres (RLS и журнал — в базе,
   см. docs/sprint1-schema.sql). Выбор — по наличию ключей в config.js. */

const LS_KEY = 'milena-app-demo-v1';
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

const DEMO_USERS = [
  { id: 'u-milena', name: 'Милена', role: 'owner' },
  { id: 'u-alena',  name: 'Алёна',  role: 'operator' },
];

// Виды смен — соответствуют таблице shift_kind в прод-БД. Клетка графика = время начала + код.
export const SHIFT_KINDS = [
  { code: 'day',     label: 'День',      short: 'Д',  hours: 8 },
  { code: 'day12',   label: '12ч день',  short: '12д', hours: 12 },
  { code: 'night12', label: '12ч ночь',  short: '12н', hours: 12 },
  { code: 'day24',   label: 'Сутки',     short: 'С',  hours: 24 },
  { code: 'off',     label: 'Выходной',  short: 'В',  hours: 0 },
  { code: 'absent',  label: 'Не вышел',  short: '—',  hours: 0 },
  { code: 'custom',  label: 'Своё время', short: '·', hours: null },
];
export const shiftKind = code => SHIFT_KINDS.find(k => k.code === code) || null;

const DEMO_SEED = {
  specialties: [
    { id: 1, name: 'Врач-терапевт', category: 'Врачи' },
    { id: 2, name: 'Хирург', category: 'Врачи' },
    { id: 3, name: 'Медсестра', category: 'Средний персонал' },
    { id: 4, name: 'Администратор', category: 'Прочие' },
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
  payouts: [
    { id: 1, employee_id: 1, fio: 'Иванова Мария Петровна', amount_kop: 4000000, status: 'confirmed', confirmed_at: '2026-07-05T09:12:00', is_self_payout: false },
    { id: 2, employee_id: 2, fio: 'Петров Сергей Иванович', amount_kop: 3500000, status: 'confirmed', confirmed_at: '2026-07-05T09:05:00', is_self_payout: false },
  ],
  nextId: { specialty: 5, employee: 1, journal: 1, line: 1, schedule: 1, retro: 1, patient: 5, payout: 3 },
};

/* ── ДЕМО ─────────────────────────────────────────────────────────── */
export class MockStore {
  constructor() { this.mode = 'demo'; this.user = null; this._load(); }
  _load() {
    try { this.db = JSON.parse(localStorage.getItem(LS_KEY)) || structuredClone(DEMO_SEED); }
    catch { this.db = structuredClone(DEMO_SEED); }
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
  me() { return this.user; }

  _log(action, entity, entityId, field, oldV, newV) {
    this.db.journal.unshift({
      id: this.db.nextId.journal++,
      actor: this.user?.name || '?', action, entity, entity_id: entityId,
      field: field || null, old_value: oldV ?? null, new_value: newV ?? null,
      at: new Date().toISOString(),
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

  async listEmployees() { return structuredClone(this.db.employees); }
  async createEmployee({ fio, position, phone, specialty_id, lines }) {
    const vfrom = rateFrom();
    const e = {
      id: this.db.nextId.employee++, fio, position: position || '', phone: phone || '',
      specialty_id: specialty_id || null, status: 'active',
      created_at: new Date().toISOString(),
      lines: (lines || []).map(l => ({ ...l, id: this.db.nextId.line++, valid_from: vfrom, valid_to: null })),
    };
    this.db.employees.unshift(e);
    this._log('created', 'employee', e.id, null, null, fio);
    this._save(); return structuredClone(e);
  }
  async updateEmployee(id, patch, newLines) {
    const e = this.db.employees.find(x => x.id === id);
    if (!e) throw new Error('Карточка не найдена');
    for (const f of ['fio', 'phone', 'specialty_id', 'status']) {
      if (patch[f] !== undefined && patch[f] !== e[f]) {
        this._log('updated', 'employee', id, f, String(e[f] ?? ''), String(patch[f] ?? ''));
        e[f] = patch[f];
      }
    }
    if (newLines) {
      const vfrom = rateFrom();
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
        if (l.pay_kind === 'процент') continue;
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
    return this.db.employees.filter(e => e.status !== 'archived').map(e => {
      const my = lines.filter(l => l.employee_id === e.id);
      const salary = my.reduce((s, l) => s + l.money_kop, 0);
      const mon = (this.db.money || []).filter(x => x.employee_id === e.id && x.period === period);
      const sum = k => mon.filter(x => x.kind === k).reduce((s, x) => s + x.amount_kop, 0);
      const cash = sum('cash'), premia = sum('premia'), otpusk = sum('otpusk');
      return { employee_id: e.id, period: period + '-01', fio: e.fio, status: e.status,
        oklad_kop: my.filter(l => l.kind === 'оклад').reduce((s, l) => s + l.money_kop, 0),
        shift_kop: my.filter(l => l.kind !== 'оклад').reduce((s, l) => s + l.money_kop, 0),
        percent_kop: 0, salary_kop: salary,
        cash_kop: cash, cash_avans_kop: sum('cash_avans'), premia_kop: premia, otpusk_kop: otpusk,
        card_avans_kop: sum('card_avans'), card_rasch_kop: sum('card_rasch'),
        to_pay_kop: cash + premia + otpusk,
        unchecked_kop: premia + otpusk,
        delta_kop: salary - (sum('card_rasch') + sum('card_avans') + cash + sum('cash_avans')),
        norm_days: my.reduce((s, l) => s + l.planned, 0), fact_days: my.reduce((s, l) => s + l.worked, 0),
        flag_no_rate: !(e.lines || []).some(l => !l.valid_to), flag_partial_month: false,
        flag_oklad_no_days: false, flag_no_data: false, flag_no_patient_data: false };
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
  async listMoneyEvents(employee_id, period) {
    return (this.db.money || []).filter(x => x.employee_id === employee_id && x.period === period)
      .map(x => ({ ...x, kind_label: MONEY_KIND_RU[x.kind] || x.kind, entered_by_name: x.entered_by, is_import: false }));
  }
  async listShiftKinds() { return SHIFT_KINDS; }
  async listSchedule(period) {
    const pre = period + '-';   // period = 'YYYY-MM'
    return this.db.schedule.filter(s => String(s.work_date).startsWith(pre)).map(s => ({ ...s }));
  }
  async setScheduleCell(employeeId, work_date, cell) {
    if (this.user?.role === 'operator' && this._dayClosed(work_date)) throw new Error('День закрыт — правку вносит владелец (или Алёна по СМС, этап 5б)');
    const empty = (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null && (cell.fact ?? null) === null;
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date);
    if (empty) { if (idx >= 0) this.db.schedule.splice(idx, 1); this._save(); return null; }   // очистка = удаление строки
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    if (!row) { row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, plan_start: null, plan_end: null, plan_kind: null, fact: null, source: 'manual' }; this.db.schedule.push(row); }
    if ('plan_start' in cell) row.plan_start = cell.plan_start ?? null;
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;   // ручная правка = старт+код, диапазон импорта сбрасываем
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    row.updated_at = new Date().toISOString();
    this._save(); return { ...row };
  }
  async setScheduleBulk(cells) {   // массовое заполнение (шаблон): cells=[{employee_id,work_date,plan_kind,plan_start,fact?}]
    const op = this.user?.role === 'operator';
    for (const c of cells) {
      if (op && this._dayClosed(c.work_date)) continue;   // закрытый день оператор шаблоном не переписывает (зеркалит RLS)
      const idx = this.db.schedule.findIndex(s => s.employee_id === c.employee_id && s.work_date === c.work_date);
      let row = idx >= 0 ? this.db.schedule[idx] : null;
      if (!row) { row = { id: this.db.nextId.schedule++, employee_id: c.employee_id, work_date: c.work_date, plan_start: null, plan_kind: null, plan_end: null, fact: null, source: c.source || 'template' }; this.db.schedule.push(row); }
      row.plan_kind = c.plan_kind ?? null;
      row.plan_start = c.plan_start ?? null;
      row.plan_end = c.plan_end ?? null;
      if ('fact' in c) row.fact = c.fact ?? null;
      row.updated_at = new Date().toISOString();
    }
    this._save(); return cells.length;
  }
  async clearScheduleMonth(employeeId, period) {   // удалить весь месяц у сотрудника (закрытые дни у оператора не трогаем)
    const pre = period + '-', before = this.db.schedule.length, op = this.user?.role === 'operator';
    this.db.schedule = this.db.schedule.filter(s => !(s.employee_id === employeeId && String(s.work_date).startsWith(pre) && !(op && this._dayClosed(s.work_date))));
    this._save(); return before - this.db.schedule.length;
  }
  async setScheduleFact(employeeId, work_date, fact) {   // табель: null=по плану · 'x'=не вышел · число=факт.часы
    if (this.user?.role === 'operator' && this._dayClosed(work_date)) throw new Error('День закрыт — правку вносит владелец (или Алёна по СМС, этап 5б)');
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date);
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    const old = row ? (row.fact ?? null) : null;
    if (!row) {
      if (fact == null) return null;                     // нет ни плана, ни факта — нечего отмечать
      row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, plan_start: null, plan_kind: null, plan_end: null, fact: null, source: 'manual' };
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
  async listClosedDays(period) {                         // множество закрытых дат месяца 'YYYY-MM'
    const pre = period + '-';
    return (this.db.closed || []).filter(d => String(d.work_date).startsWith(pre)).map(d => d.work_date);
  }
  async closeDay(work_date) {                            // закрыть день (operator/owner)
    this.db.closed = this.db.closed || [];
    if (!this.db.closed.some(d => d.work_date === work_date))
      this.db.closed.push({ work_date, closed_by: this.user?.id || null, closed_at: new Date().toISOString() });
    this._save(); return work_date;
  }
  async reopenDay(work_date) {                           // открыть день — ТОЛЬКО владелец
    if (this.user?.role !== 'owner') throw new Error('Открыть день может только владелец');
    this.db.closed = (this.db.closed || []).filter(d => d.work_date !== work_date);
    this._save(); return true;
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
  async listRecentPayouts(limit = 5) {
    return (this.db.payouts || []).filter(p => p.status === 'confirmed')
      .sort((a, b) => String(b.confirmed_at || '').localeCompare(String(a.confirmed_at || ''))).slice(0, limit);
  }
  async listJournal({ filter = 'all', beforeId = null, limit = 50 } = {}) {
    let arr = (this.db.journal || []).filter(j => journalMatch(j, filter)).sort((a, b) => (b.id || 0) - (a.id || 0));
    if (beforeId != null) arr = arr.filter(j => (j.id || 0) < beforeId);
    const rows = arr.slice(0, limit);
    return { rows, hasMore: arr.length > limit, lastId: rows.length ? rows[rows.length - 1].id : null };
  }
}

export function lineLabel(l) {
  const kind = l.pay_kind;
  if (kind === 'процент') return `${l.line_type} · процент ${l.percent ?? '?'} %`;
  if (kind === '12ч') return `${l.line_type} · 12ч день ${l.amount ?? '?'} / ночь ${l.amount_night ?? '?'} ₽`;
  const unit = { 'оклад': '₽/мес', 'сутки': '₽/смена', 'почасово': '₽/час' }[kind] || '₽';
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
  ['employee_status_check',  'Недопустимый статус карточки'],
  ['violates row-level security', 'Недостаточно прав: карточки заводит и меняет только владелец'],
];
export function employeeError(err) {
  const raw = (err && (err.message || err.details || String(err))) || 'Неизвестная ошибка';
  for (const [needle, human] of EMPLOYEE_ERRORS) if (raw.includes(needle)) return human;
  return raw;
}

const RATE_ERRORS = [
  ['rate_line_amount_sane_chk', 'Сумма вне разумных границ (больше 0 и не больше 100 000 000 ₽)'],
  ['rate_line_kind_amount_chk', 'Для «12ч» нужны обе ставки — дневная и ночная; для процента — значение от 1 до 100'],
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

/* Ошибки денежных записей → человеческий русский (те же CHECK/RLS, что в
   migrations/008–019). Сырое «violates check constraint» Милена читать не должна. */
// Подписи видов выплат — те же, что ru_money_kind() в БД (migrations/010).
const MONEY_KIND_RU = { cash: 'Наличные', cash_avans: 'Аванс наличными', premia: 'Премия',
  otpusk: 'Отпускные', card_avans: 'Аванс на карту', card_rasch: 'Расчёт на карту' };
const MONEY_ERRORS = [
  ['money_line_sane_chk',   'Сумма вне разумных границ'],
  ['money_line_sign_chk',   'Сумма должна быть больше 0. Чтобы отменить запись — сделайте сторно'],
  ['money_line_period_chk', 'Период должен быть 1-м числом месяца'],
  ['Денежные записи не правятся', 'Денежные записи не правятся и не удаляются — исправление вносится сторно'],
  ['violates row-level security', 'Недостаточно прав для этого вида выплаты'],
  ['без сессии запрещена',  'Сессия истекла — войдите заново'],
];
export function moneyError(err) {
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
  async logout() { if (this.sb) await this.sb.auth.signOut(); this.user = null; }
  me() { return this.user; }

  async listSpecialties() {
    const { data, error } = await this.sb.from('specialty').select('*').order('sort').order('name');
    if (error) throw error; return data;
  }
  async addSpecialty(name, category) {
    const { data, error } = await this.sb.from('specialty').insert({ name, category }).select().single();
    if (error) throw error; return data;
  }
  async listEmployees() {
    const { data, error } = await this.sb.from('employee')
      .select('*, lines:rate_line(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(e => ({ ...e, lines: e.lines || [] }));
  }
  async createEmployee({ fio, position, phone, specialty_id, lines }) {
    const { data: e, error } = await this.sb.from('employee')
      .insert({ fio, position, phone, specialty_id, created_by: this.user.id }).select().single();
    if (error) throw new Error(employeeError(error));
    if (lines?.length) {
      const vfrom = rateFrom();
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
  async updateEmployee(id, patch, newLines) {
    // .select() возвращает изменённые ряды: если RLS не пустил — массив пустой,
    // и мы это заметим (иначе PostgREST молча вернёт success на 0 строк).
    const { data: upd, error } = await this.sb.from('employee').update(patch).eq('id', id).select();
    if (error) throw new Error(employeeError(error));   // поля-диффы в журнал пишет триггер БД
    if (!upd || !upd.length) throw new Error('Изменение не сохранено (недостаточно прав)');
    if (newLines) {
      const vfrom = rateFrom();
      const { data: active, error: eSel } = await this.sb.from('rate_line')
        .select('*').eq('employee_id', id).is('valid_to', null);
      if (eSel) throw new Error(rateError(eSel));
      for (const ol of active || []) {
        if (!newLines.find(nl => nl._keep === ol.id)) {
          const { data: cl, error: eUpd } = await this.sb.from('rate_line')
            .update({ valid_to: vfrom }).eq('id', ol.id).select();
          if (eUpd) throw new Error(rateError(eUpd));
          if (!cl || !cl.length) throw new Error('Не удалось закрыть старую ставку (недостаточно прав)');
        }
      }
      const fresh = newLines.filter(nl => !nl._keep).map(l => ({ employee_id: id,
        line_type: l.line_type, pay_kind: l.pay_kind, amount: l.amount ?? null,
        amount_night: l.amount_night ?? null, percent: l.percent ?? null,
        valid_from: vfrom, created_by: this.user.id }));
      if (fresh.length) { const { error: e2 } = await this.sb.from('rate_line').insert(fresh); if (e2) throw new Error(rateError(e2)); }
    }
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
    });
    if (error) throw new Error(rateError(error));
    return Array.isArray(data) ? data[0] : data;
  }
  async listShiftKinds() { return SHIFT_KINDS; }
  async listSchedule(period) {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { data, error } = await this.sb.from('schedule').select('*').gte('work_date', start).lt('work_date', next);
    if (error) throw error; return data;
  }
  async setScheduleCell(employeeId, work_date, cell) {
    const empty = (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null && (cell.fact ?? null) === null;
    if (empty) {   // очистка = удаление строки, чтобы таблица не копила пустышки
      const { error } = await this.sb.from('schedule').delete().eq('employee_id', employeeId).eq('work_date', work_date);
      if (error) throw error; return null;
    }
    const row = { employee_id: employeeId, work_date, source: 'manual', updated_by: this.user.id };
    if ('plan_start' in cell) row.plan_start = cell.plan_start ?? null;
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;   // ручная правка = старт+код, диапазон импорта сбрасываем
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    const { data, error } = await this.sb.from('schedule').upsert(row, { onConflict: 'employee_id,work_date' }).select().single();
    if (error) throw error; return data;
  }
  async setScheduleBulk(cells) {   // массовое заполнение (шаблон/импорт). fact не трогаем — это план
    const rows = cells.map(c => ({ employee_id: c.employee_id, work_date: c.work_date, plan_kind: c.plan_kind ?? null, plan_start: c.plan_start ?? null, plan_end: c.plan_end ?? null, source: c.source || 'template', updated_by: this.user.id }));
    const { error } = await this.sb.from('schedule').upsert(rows, { onConflict: 'employee_id,work_date' });
    if (error) throw error; return rows.length;
  }
  async clearScheduleMonth(employeeId, period) {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { error } = await this.sb.from('schedule').delete().eq('employee_id', employeeId).gte('work_date', start).lt('work_date', next);
    if (error) throw error; return true;
  }
  async setScheduleFact(employeeId, work_date, fact) {   // табель: пишем ТОЛЬКО факт (source/план не трогаем — сохраняем 'import')
    // Журнал правок факта пишет триггер schedule_journal (migrations/002) — здесь ничего не нужно
    //   (перезаписывается при след. правке). Для анти-фрода нужна неизменяемая история кто/когда отметил.
    const { data: upd, error } = await this.sb.from('schedule')
      .update({ fact: fact ?? null, updated_by: this.user.id }).eq('employee_id', employeeId).eq('work_date', work_date).select();
    if (error) throw error;
    if (upd && upd.length) {
      const r = upd[0];
      if (!r.plan_kind && (r.fact ?? null) === null) {   // ни плана, ни факта — не держим пустышку (как setScheduleCell)
        const { error: dErr } = await this.sb.from('schedule').delete().eq('employee_id', employeeId).eq('work_date', work_date);
        if (dErr) throw dErr; return null;
      }
      return r;
    }
    if (fact == null) return null;                       // строки нет и писать нечего
    const { data: ins, error: e2 } = await this.sb.from('schedule')   // вышел без плана — новая строка
      .insert({ employee_id: employeeId, work_date, fact, source: 'manual', updated_by: this.user.id }).select().single();
    if (e2) throw e2; return ins;
  }
  async listClosedDays(period) {                         // множество закрытых дат месяца 'YYYY-MM'
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { data, error } = await this.sb.from('closed_day').select('work_date').gte('work_date', start).lt('work_date', next);
    if (error) throw error; return (data || []).map(d => d.work_date);
  }
  async closeDay(work_date) {                            // закрыть день (operator/owner). closed_by = default auth.uid() (RLS)
    const { error } = await this.sb.from('closed_day').upsert({ work_date }, { onConflict: 'work_date', ignoreDuplicates: true });
    if (error) throw error; return work_date;
  }
  async reopenDay(work_date) {                           // открыть день — RLS пускает только владельца
    const { data, error } = await this.sb.from('closed_day').delete().eq('work_date', work_date).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Открыть день может только владелец');
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
  async listRecentPayouts(limit = 5) {
    const { data, error } = await this.sb.from('payout')
      .select('*, emp:employee(fio)').eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(p => ({ ...p, fio: p.emp?.fio || '—' }));
  }
  // Keyset-пагинация по id (не offset): журнал append-only, новые записи сверху,
  // при offset они сдвигали бы страницы — строки дублировались бы или терялись.
  // Сортировка по id, а не по at: at при заливке шаблона (31 запись) почти
  // одинаков, id строго монотонен и без коллизий. Тянем limit+1, чтобы узнать,
  // есть ли ещё, без отдельного count.
  async listJournal({ filter = 'all', beforeId = null, limit = 50 } = {}) {
    let q = this.sb.from('journal').select('*, actor_user:app_user(display_name)')
      .order('id', { ascending: false }).limit(limit + 1);
    if (filter === 'red') q = q.eq('red', true);
    else if (filter === 'money') q = q.in('entity', ['money_line', 'patient_payment']);
    else if (filter === 'payout') q = q.eq('entity', 'payout');
    else if (filter === 'premia') q = q.eq('entity', 'money_line').ilike('field', '%премия%');
    else if (filter === 'schedule') q = q.eq('entity', 'schedule');
    else if (filter === 'rate') q = q.eq('entity', 'rate_line');
    if (beforeId != null) q = q.lt('id', beforeId);
    const { data, error } = await q;
    if (error) throw error;
    const hasMore = data.length > limit;
    const rows = (hasMore ? data.slice(0, limit) : data).map(j => ({ ...j, actor: j.actor_user?.display_name || j.actor }));
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
}

export function makeStore() {
  const c = window.APP_CONFIG || {};
  return (c.SUPABASE_URL && c.SUPABASE_ANON_KEY)
    ? new SupabaseStore(c.SUPABASE_URL, c.SUPABASE_ANON_KEY)
    : new MockStore();
}
