/* Слой данных: один интерфейс, две реализации.
   MockStore  — ДЕМО: всё в localStorage этого браузера, вход без пароля.
   SupabaseStore — прод: Supabase Auth + Postgres (RLS и журнал — в базе,
   см. docs/sprint1-schema.sql). Выбор — по наличию ключей в config.js. */

const LS_KEY = 'milena-app-demo-v1';

const DEMO_USERS = [
  { id: 'u-milena', name: 'Милена', role: 'owner' },
  { id: 'u-alena',  name: 'Алёна',  role: 'operator' },
];

const DEMO_SEED = {
  specialties: [
    { id: 1, name: 'Врач-терапевт', category: 'Врачи' },
    { id: 2, name: 'Хирург', category: 'Врачи' },
    { id: 3, name: 'Медсестра', category: 'Средний персонал' },
    { id: 4, name: 'Администратор', category: 'Прочие' },
  ],
  employees: [],   // реальные карточки вводит владелица — демо стартует пустым
  journal: [],
  nextId: { specialty: 5, employee: 1, journal: 1, line: 1 },
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
    const today = new Date().toISOString().slice(0, 10);
    const cur = e.lines.find(l => !l.valid_to && l.line_type === 'основной');
    if (cur) { cur.valid_to = today; this._log('updated', 'rate_line', cur.id, 'ставка закрыта', lineLabel(cur), null); }
    const nl = { id: this.db.nextId.line++, line_type: 'основной', pay_kind: line.pay_kind,
      amount: line.amount ?? null, amount_night: line.amount_night ?? null, percent: line.percent ?? null,
      valid_from: today, valid_to: null };
    e.lines.push(nl);
    this._log('updated', 'rate_line', nl.id, 'ставка добавлена', null, lineLabel(nl));
    this._save(); return nl;
  }
  async listJournal(limit = 100) { return this.db.journal.slice(0, limit); }
}

export function lineLabel(l) {
  const kind = l.pay_kind;
  if (kind === 'процент') return `${l.line_type} · процент ${l.percent ?? '?'} %`;
  if (kind === '12ч') return `${l.line_type} · 12ч день ${l.amount ?? '?'} / ночь ${l.amount_night ?? '?'} ₽`;
  const unit = { 'оклад': '₽/мес', 'сутки': '₽/смена', 'почасово': '₽/час' }[kind] || '₽';
  return `${l.line_type} · ${kind} ${l.amount ?? '?'} ${unit}`;
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
    console.log('[store] загрузка библиотеки Supabase…');
    const { createClient } = await this._loadLib();
    console.log('[store] создание клиента…');
    this.sb = createClient(this.url, this.key);
    // Проверку существующей сессии (getUser) на старте НЕ делаем намеренно: она использует
    // navigatorLock, который в некоторых браузерах/условиях зависает и блокирует весь вход.
    // Сессия проверится при login(). Жертвуем автовходом ради надёжного показа формы.
    console.log('[store] клиент готов — вход по почте и паролю доступен');
  }
  async _loadProfile(authUser) {
    const { data, error } = await this.sb.from('app_user').select('*').eq('id', authUser.id).single();
    if (error) throw new Error('Пользователь не приписан к программе (app_user): ' + error.message);
    this.user = { id: data.id, name: data.display_name, role: data.role };
  }
  demoUsers() { return []; }
  async loginDemo() { throw new Error('Демо-вход недоступен: подключена настоящая база'); }
  async login(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    await this._loadProfile(data.user);
    return this.user;
  }
  async logout() { await this.sb.auth.signOut(); this.user = null; }
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
    const today = new Date().toISOString().slice(0, 10);
    const { data: cur, error: eSel } = await this.sb.from('rate_line')
      .select('id').eq('employee_id', id).eq('line_type', 'основной').is('valid_to', null);
    if (eSel) throw eSel;
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
