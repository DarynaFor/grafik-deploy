/* Слой данных: один интерфейс, две реализации.
   MockStore  — ДЕМО: всё в localStorage этого браузера, вход без пароля.
   SupabaseStore — прод: Supabase Auth + Postgres (RLS и журнал — в базе,
   см. docs/sprint1-schema.sql). Выбор — по наличию ключей в config.js. */

const LS_KEY = 'milena-app-demo-v1';
const LOGIN_DAY_KEY = 'milena-login-day';                                        // день последнего входа (МСК)
const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);   // календарная дата в МСК (UTC+3) — для ежедневного сброса доступа

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
  nextId: { specialty: 5, employee: 1, journal: 1, line: 1, schedule: 1, retro: 1 },
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
    const today = new Date().toISOString().slice(0, 10);
    const e = {
      id: this.db.nextId.employee++, fio, position: position || '', phone: phone || '',
      specialty_id: specialty_id || null, status: 'active',
      created_at: new Date().toISOString(),
      lines: (lines || []).map(l => ({ ...l, id: this.db.nextId.line++, valid_from: today, valid_to: null })),
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
      const today = new Date().toISOString().slice(0, 10);
      const active = e.lines.filter(l => !l.valid_to);
      // закрываем строки, которых больше нет / которые изменились; добавляем новые
      for (const ol of active) {
        const match = newLines.find(nl => nl._keep === ol.id);
        if (!match) {
          ol.valid_to = today;
          this._log('updated', 'rate_line', ol.id, 'закрыта', lineLabel(ol), null);
        }
      }
      for (const nl of newLines) {
        if (nl._keep) continue; // без изменений
        const line = { id: this.db.nextId.line++, line_type: nl.line_type, pay_kind: nl.pay_kind,
          amount: nl.amount ?? null, amount_night: nl.amount_night ?? null,
          percent: nl.percent ?? null, valid_from: today, valid_to: null };
        e.lines.push(line);
        this._log('updated', 'rate_line', line.id, 'новая строка', null, lineLabel(line));
      }
    }
    this._save(); return structuredClone(e);
  }
  async setPrimaryRate(id, line) {
    const e = this.db.employees.find(x => x.id === id);
    if (!e) throw new Error('Карточка не найдена');
    const active = e.lines.filter(l => !l.valid_to && l.line_type === 'основной');
    if (active.length === 1 && sameRate(active[0], line)) return active[0];   // no-op: та же ставка — не смётываем журнал
    const today = new Date().toISOString().slice(0, 10);
    active.forEach(c => { c.valid_to = today; this._log('updated', 'rate_line', c.id, 'ставка закрыта', lineLabel(c), null); });   // закрываем ВСЕ активные основные
    const nl = { id: this.db.nextId.line++, line_type: 'основной', pay_kind: line.pay_kind,
      amount: line.amount ?? null, amount_night: line.amount_night ?? null, percent: line.percent ?? null,
      valid_from: today, valid_to: null };
    e.lines.push(nl);
    this._log('updated', 'rate_line', nl.id, 'ставка добавлена', null, lineLabel(nl));
    this._save(); return nl;
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
  async listRedRemarks(limit = 50) { return (this.db.journal || []).filter(j => j.red).slice(0, limit); }
  async listJournal(limit = 100) { return this.db.journal.slice(0, limit); }
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
    if (error) throw error;
    if (lines?.length) {
      const today = new Date().toISOString().slice(0, 10);
      const rows = lines.map(l => ({ employee_id: e.id, line_type: l.line_type, pay_kind: l.pay_kind,
        amount: l.amount ?? null, amount_night: l.amount_night ?? null, percent: l.percent ?? null,
        valid_from: today, created_by: this.user.id }));
      const { error: e2 } = await this.sb.from('rate_line').insert(rows);
      if (e2) { // карточка без ставок — уводим в архив, чтобы не висела в активных; DELETE запрещён
        await this.sb.from('employee').update({ status: 'archived' }).eq('id', e.id);
        throw new Error('Ставки не сохранились, карточка отменена: ' + e2.message);
      }
    }
    return e;
  }
  async updateEmployee(id, patch, newLines) {
    // .select() возвращает изменённые ряды: если RLS не пустил — массив пустой,
    // и мы это заметим (иначе PostgREST молча вернёт success на 0 строк).
    const { data: upd, error } = await this.sb.from('employee').update(patch).eq('id', id).select();
    if (error) throw error;              // поля-диффы в журнал пишет триггер БД
    if (!upd || !upd.length) throw new Error('Изменение не сохранено (недостаточно прав)');
    if (newLines) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: active, error: eSel } = await this.sb.from('rate_line')
        .select('*').eq('employee_id', id).is('valid_to', null);
      if (eSel) throw eSel;
      for (const ol of active || []) {
        if (!newLines.find(nl => nl._keep === ol.id)) {
          const { data: cl, error: eUpd } = await this.sb.from('rate_line')
            .update({ valid_to: today }).eq('id', ol.id).select();
          if (eUpd) throw eUpd;
          if (!cl || !cl.length) throw new Error('Не удалось закрыть старую ставку (недостаточно прав)');
        }
      }
      const fresh = newLines.filter(nl => !nl._keep).map(l => ({ employee_id: id,
        line_type: l.line_type, pay_kind: l.pay_kind, amount: l.amount ?? null,
        amount_night: l.amount_night ?? null, percent: l.percent ?? null,
        valid_from: today, created_by: this.user.id }));
      if (fresh.length) { const { error: e2 } = await this.sb.from('rate_line').insert(fresh); if (e2) throw e2; }
    }
  }
  async setPrimaryRate(id, line) {
    const { data: cur, error: eSel } = await this.sb.from('rate_line')
      .select('id,pay_kind,amount,amount_night,percent').eq('employee_id', id).eq('line_type', 'основной').is('valid_to', null);
    if (eSel) throw eSel;
    if ((cur || []).length === 1 && sameRate(cur[0], line)) return cur[0];   // no-op: та же ставка — не смётываем анти-фрод журнал
    const today = new Date().toISOString().slice(0, 10);
    for (const ol of cur || []) {
      const { data: cl, error: eUpd } = await this.sb.from('rate_line').update({ valid_to: today }).eq('id', ol.id).select();
      if (eUpd) throw eUpd;
      if (!cl || !cl.length) throw new Error('Не удалось закрыть старую ставку (недостаточно прав)');
    }
    const { data, error } = await this.sb.from('rate_line').insert({ employee_id: id, line_type: 'основной',
      pay_kind: line.pay_kind, amount: line.amount ?? null, amount_night: line.amount_night ?? null,
      percent: line.percent ?? null, valid_from: today, created_by: this.user.id }).select().single();
    if (error) throw error; return data;
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
    // TODO(этап 5): append-only журнал правок факта через триггер БД — сейчас след только в updated_by
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
  async listJournal(limit = 100) {
    const { data, error } = await this.sb.from('journal')
      .select('*, actor_user:app_user(display_name)').order('at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data.map(j => ({ ...j, actor: j.actor_user?.display_name || j.actor }));
  }
}

export function makeStore() {
  const c = window.APP_CONFIG || {};
  return (c.SUPABASE_URL && c.SUPABASE_ANON_KEY)
    ? new SupabaseStore(c.SUPABASE_URL, c.SUPABASE_ANON_KEY)
    : new MockStore();
}
