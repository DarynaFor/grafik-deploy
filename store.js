const LS_KEY = 'milena-app-demo-v1';
function сводкаВыдач(строки, limit, имя) {
  const отменены = new Set(строки.filter(p => p.reverses_id).map(p => p.reverses_id));
  const живые = строки.filter(p => !p.reverses_id && !отменены.has(p.id));
  return {
    list: живые.slice(0, limit).map(p => ({ ...p, fio: имя(p) })),
    ahead: new Set(живые.filter(p => p.given_ahead).map(p => p.employee_id)).size,
  };
}
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь',
  'июль','август','сентябрь','октябрь','ноябрь','декабрь'];
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
const LOGIN_DAY_KEY = 'milena-login-day';
const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const rateFrom = () => mskDay().slice(0, 8) + '01';
export const backdateNeedsOk = d =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && d < rateFrom() && +mskDay().slice(8, 10) > 6;
const DEMO_USERS = [
  { id: 'u-milena', name: 'Милена', role: 'owner' },
  { id: 'u-alena',  name: 'Алёна',  role: 'operator' },
  { id: 'u-ceo',    name: 'Директор', role: 'ceo' },
  { id: 'u-buh',    name: 'Бухгалтер', role: 'cashier1' },
  { id: 'u-buh2',   name: 'Бух 2 · карта/1С', role: 'cashier2' },
];
export const SHIFT_KINDS = [
  { code: 'day',     label: 'День',      short: 'Д',  hours: 8 },
  { code: 'day6',    label: '6ч',        short: '6',  hours: 6, dept: 'Медсестры' },
  { code: 'day12',   label: '12ч день',  short: '12д', hours: 12 },
  { code: 'night12', label: '12ч ночь',  short: '12н', hours: 12 },
  { code: 'day24',   label: 'Сутки',     short: 'С',  hours: 24 },
  { code: 'off',     label: 'Выходной',  short: 'В',  hours: 0 },
  { code: 'отпуск',  label: 'Отпуск',    short: 'Отп', hours: 0 },
  { code: 'отпуск_бз', label: 'Отпуск без сохр.', short: 'Отп·бз', hours: 0 },
  { code: 'absent',  label: 'Не вышел',  short: '—',  hours: 0 },
  { code: 'custom',  label: 'Своё время', short: '·', hours: null },
];
export const shiftKind = code => SHIFT_KINDS.find(k => k.code === code) || null;
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
  employees: [],
  journal: [],
  schedule: [],
  closed: [],
  retro: [],
  patients: [
    { id: 1, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-05', paid_at: '10:15', service: 'Консультация', amount_kop: 300000, reverses_id: null, is_import: true },
    { id: 2, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-05', paid_at: '10:15', service: 'Консультация', amount_kop: -300000, reverses_id: 1, is_import: false },
    { id: 3, employee_id: 1, fio: 'Иванова Мария Петровна', paid_on: '2026-07-12', paid_at: '14:00', service: 'Приём повторный', amount_kop: 250000, reverses_id: null, is_import: true },
    { id: 4, employee_id: 2, fio: 'Петров Сергей Иванович', paid_on: '2026-07-08', paid_at: '09:30', service: 'Операция', amount_kop: 1200000, reverses_id: null, is_import: true },
  ],
  payouts: [],
  nextId: { specialty: 5, employee: 1, journal: 1, line: 1, schedule: 1, retro: 1, patient: 5, payout: 3 },
};
export class MockStore {
  constructor() { this.mode = 'demo'; this.user = null; this._load(); }
  _load() {
    try { this.db = JSON.parse(localStorage.getItem(LS_KEY)) || structuredClone(DEMO_SEED); }
    catch { this.db = structuredClone(DEMO_SEED); }
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
  dayExpired() { return false; }
  me() { return this.user; }
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
  async renameCategory(oldName, newName) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Переименовать отделение может владелец или директор');
    newName = String(newName || '').trim();
    if (!newName) throw new Error('Название отделения не может быть пустым');
    if (oldName === newName) return 0;
    this.db.catOrder = this.db.catOrder || [];
    const was = this.db.catOrder.find(o => o.category === oldName);
    if (!was) throw new Error(`Отделения «${oldName}» нет в справочнике`);
    const target = this.db.catOrder.find(o => o.category === newName);
    if (target?.parent && this.db.catOrder.some(o => o.parent === oldName)) {
      throw new Error(`В «${oldName}» есть блоки, а «${newName}» само лежит внутри отделения — так объединить нельзя`);
    }
    this.db.specialties.filter(x => x.category === oldName).forEach(x => { x.category = newName; });
    this.db.employees.filter(x => x.dept === oldName).forEach(x => { x.dept = newName; });
    this.db.catOrder.filter(o => o.parent === oldName).forEach(o => { o.parent = newName; });
    (this.db.presets || []).filter(p => p.category === oldName).forEach(p => { p.category = newName; });
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
  async listArchivedBy(ids = []) {
    const want = new Set(ids);
    const by = new Map();
    for (const j of (this.db.journal || []))
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
    if (patch.dept !== undefined && patch.dept !== e.dept && !['owner', 'ceo'].includes(this.user?.role)) {
      throw new Error('Отделение меняет владелец или директор: по нему группируются график, ведомость и правила');
    }
    for (const f of ['fio', 'position', 'phone', 'specialty_id', 'dept', 'status', 'hired_on', 'left_on', 'week_hours']) {
      if (patch[f] !== undefined && patch[f] !== e[f]) {
        this._log('updated', 'employee', id, f, String(e[f] ?? ''), String(patch[f] ?? ''));
        e[f] = patch[f];
      }
    }
    if (patch.hidden_at !== undefined && patch.hidden_at !== e.hidden_at) {
      this._log('updated', 'employee', id, 'архив',
                e.hidden_at ? 'убрана' : 'в списке',
                patch.hidden_at ? 'убрана из списка' : 'возвращена в список', true);
      e.hidden_at = patch.hidden_at;
    }
    if (newLines) {
      const vfrom = validFrom || rateFrom();
      const active = e.lines.filter(l => !l.valid_to);
      for (const ol of active) {
        const match = newLines.find(nl => nl._keep === ol.id);
        if (!match) {
          ol.valid_to = vfrom;
          this._log('updated', 'rate_line', ol.id, 'закрыта', lineLabel(ol), null);
        }
      }
      for (const nl of newLines) {
        if (nl._keep) continue;
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
    if (active.length === 1 && sameRate(active[0], line)) return active[0];
    const vfrom = validFrom || rateFrom();
    active.forEach(c => { c.valid_to = vfrom; this._log('updated', 'rate_line', c.id, 'ставка закрыта', lineLabel(c), null); });
    const nl = { id: this.db.nextId.line++, line_type: 'основной', pay_kind: line.pay_kind,
      amount: line.amount ?? null, amount_night: line.amount_night ?? null, percent: line.percent ?? null,
      valid_from: vfrom, valid_to: null };
    e.lines.push(nl);
    this._log('updated', 'rate_line', nl.id, 'ставка добавлена', null, lineLabel(nl));
    this._save(); return nl;
  }
  _demoPayrollLines(period) {
    const out = [];
    for (const e of this.db.employees) {
      const cells = (this.db.schedule || []).filter(s => s.employee_id === e.id && String(s.work_date).startsWith(period));
      const lines = (e.lines || []).filter(l => !l.valid_to);
      for (const l of lines) {
        if (l.pay_kind === 'процент') {
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
    const sled = e => (this.db.money || []).some(m => m.employee_id === e.id && m.period === period)
      || (this.db.carry   || []).some(c => c.employee_id === e.id && c.period === period)
      || (this.db.payouts || []).some(p => p.employee_id === e.id && p.period === period)
      || lines.some(l => l.employee_id === e.id);
    return this.db.employees.filter(e => e.status !== 'archived' || sled(e)).map(e => {
      const my = lines.filter(l => l.employee_id === e.id);
      const salary = my.reduce((s, l) => s + l.money_kop, 0);
      const mon = (this.db.money || []).filter(x => x.employee_id === e.id && x.period === period);
      const sum = k => mon.filter(x => x.kind === k).reduce((s, x) => s + x.amount_kop, 0);
      const cash = sum('cash'), premia = sum('premia'), otpusk = sum('otpusk'),
            otpuskCash = sum('otpusk_cash'), cardUvol = sum('card_uvol');
      const ovr = (this.db.salaryOverride || []).find(x => x.employee_id === e.id && x.period === period);
      const salaryFinal = ovr ? ovr.amount_kop : salary;
      return { employee_id: e.id, period: period + '-01', fio: e.fio, status: e.status,
        oklad_kop: my.filter(l => l.kind === 'оклад').reduce((s, l) => s + l.money_kop, 0),
        shift_kop: my.filter(l => l.kind !== 'оклад' && l.kind !== 'процент').reduce((s, l) => s + l.money_kop, 0),
        percent_kop: my.filter(l => l.kind === 'процент').reduce((s, l) => s + l.money_kop, 0), salary_kop: salaryFinal,
        salary_plan_kop: salaryFinal,
        salary_marked_kop: salaryFinal,
        cash_kop: cash, cash_avans_kop: sum('cash_avans'), premia_kop: premia, otpusk_kop: otpusk,
        otpusk_cash_kop: otpuskCash, card_uvol_kop: cardUvol,
        otpusk_nach_kop: sum('otpusk_nach'),
        card_avans_kop: sum('card_avans'), card_rasch_kop: sum('card_rasch'),
        to_pay_kop: cash + premia + otpuskCash,
        paid_kop: (this.db.payouts || [])
          .filter(p => p.employee_id === e.id && p.period === period && p.status === 'confirmed')
          .reduce((s, p) => s + (p.amount_kop || 0), 0),
        unchecked_kop: premia + otpuskCash,
        carry_kop: ((this.db.carry || []).find(x => x.employee_id === e.id && x.period === period) || {}).amount_kop || 0,
        bolnich_nach_kop: sum('bolnich_nach'), bolnich_kop: sum('bolnich'),
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
    if (items.some(it => it.amount_kop > 100000000)) throw new Error('Сумма вне разумных границ');
    const out = [];
    for (const it of items) {
      if (!(it.amount_kop > 0)) continue;
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
  async importMoneyBatch(period, kind, items, filename) {
    this.db.money = this.db.money || [];
    const batch_id = (this.db.nextId.batch = (this.db.nextId.batch || 0) + 1);
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const inserted = [], skipped = [], unmatched = [];
    for (const it of (items || [])) {
      const amt = it.amount_kop;
      if (!(amt > 0) || amt > 100000000) { unmatched.push({ item: it, reason: 'сумма вне границ' }); continue; }
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
    const pre = period + '-';
    return this.db.schedule.filter(s => String(s.work_date).startsWith(pre)).map(s => ({ ...s }));
  }
  async setScheduleCell(employeeId, work_date, cell, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error('День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор');
    const empty = (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null && (cell.fact ?? null) === null;
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date && (s.position || 'main') === position);
    if (empty) { if (idx >= 0) this.db.schedule.splice(idx, 1); this._save(); return null; }
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    if (!row) { row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, position, plan_start: null, plan_end: null, plan_kind: null, fact: null, source: 'manual' }; this.db.schedule.push(row); }
    if ('plan_start' in cell) row.plan_start = cell.plan_start ?? null;
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    row.updated_at = new Date().toISOString();
    this._save(); return { ...row };
  }
  async setScheduleBulk(cells) {
    let zapisano = 0;
    for (const c of cells) {
      if (this._dayClosed(c.work_date)) continue;
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
    this._save(); return zapisano;
  }
  async clearScheduleMonth(employeeId, period, position = 'main') {
    const pre = period + '-', before = this.db.schedule.length;
    this.db.schedule = this.db.schedule.filter(s => !(s.employee_id === employeeId && (s.position || 'main') === position && String(s.work_date).startsWith(pre) && !this._dayClosed(s.work_date)));
    this._save(); return before - this.db.schedule.length;
  }
  async setScheduleFact(employeeId, work_date, fact, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error('День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор');
    const idx = this.db.schedule.findIndex(s => s.employee_id === employeeId && s.work_date === work_date && (s.position || 'main') === position);
    let row = idx >= 0 ? this.db.schedule[idx] : null;
    const old = row ? (row.fact ?? null) : null;
    if (!row) {
      if (fact == null) return null;
      row = { id: this.db.nextId.schedule++, employee_id: employeeId, work_date, position, plan_start: null, plan_kind: null, plan_end: null, fact: null, source: 'manual' };
      this.db.schedule.push(row);
    }
    row.fact = fact ?? null;
    row.updated_at = new Date().toISOString();
    this._log('updated', 'schedule', row.id, 'факт', String(old ?? ''), String(fact ?? ''));
    if (!row.plan_kind && (row.fact == null)) {
      this.db.schedule.splice(this.db.schedule.indexOf(row), 1); this._save(); return null;
    }
    this._save(); return { ...row };
  }
  _dayClosed(wd) { return (this.db.closed || []).some(d => d.work_date === wd); }
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
  async listClosedDays(period) {
    const pre = period + '-';
    return (this.db.closed || []).filter(d => String(d.work_date).startsWith(pre)).map(d => d.work_date);
  }
  async closeDay(work_date) {
    if (!['owner', 'operator', 'ceo'].includes(this.user?.role)) throw new Error('Закрывать дни может Алёна, Милена или директор');
    if (work_date > new Date(Date.now() + 3 * 3600e3 + 864e5).toISOString().slice(0, 10)) throw new Error('Этот день ещё не наступил — закрывать нечего');
    this.db.closed = this.db.closed || [];
    if (!this.db.closed.some(d => d.work_date === work_date)) {
      this.db.closed.push({ work_date, closed_by: this.user?.id || null, closed_at: new Date().toISOString() });
      this._log('closed', 'day', 0, 'закрыт день', null, work_date);
    }
    this._save(); return work_date;
  }
  async reopenDay(work_date) {
    if (!['owner', 'ceo'].includes(this.user?.role)) throw new Error('Открыть день может Милена или директор');
    const bylo = (this.db.closed || []).find(d => d.work_date === work_date);
    this.db.closed = (this.db.closed || []).filter(d => d.work_date !== work_date);
    if (bylo) this._log('reopened', 'day', 0, 'открыт день (был закрыт ' + (bylo.closed_by ?? '?') + ' @ ' + bylo.closed_at + ')', work_date, work_date, true);
    this._save(); return true;
  }
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
      this._log('closed', 'day', 0, 'закрыт день', null, wd);
      n++;
    }
    this._save(); return n;
  }
  async openPeriod(from_date, to_date) {
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
  async requestRetroEdit(work_date, employee_id, target, payload) {
    if (!(this.db.closed || []).some(d => d.work_date === work_date)) throw new Error('день не закрыт');
    this.db.retro = this.db.retro || [];
    this.db.nextId.retro = this.db.nextId.retro || 1;
    if (this.db.retro.some(r => r.employee_id === employee_id && r.work_date === work_date && r.status === 'pending' && Date.now() < r.expires))
      throw new Error('уже есть активный запрос на эту клетку');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const id = this.db.nextId.retro++;
    this.db.retro.push({ id, work_date, employee_id, target, new_fact: payload.new_fact ?? null, code, attempts: 0, status: 'pending', expires: Date.now() + 600000 });
    this._save();
    return { id, demoCode: code };
  }
  async confirmRetroEdit(request_id, code) {
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
    const мес = new Date().toISOString().slice(0, 7);
    if (period > мес) throw new Error('Нельзя выдать за будущий месяц');
    if (!this.db.nextId.payout) this.db.nextId.payout = 1;
    const id = this.db.nextId.payout++;
    const себе = !!(this.user?.employee_id && this.user.employee_id === employee_id);
    this.db.payouts = this.db.payouts || [];
    const строкаВыдачи = { id, employee_id, fio: emp.fio, period, amount_kop,
      status: 'confirmed', confirmed_at: new Date().toISOString(), code_sent_at: null,
      reverses_id: null, cancel_reason: null, is_self_payout: себе,
      note: (note || '').trim().slice(0, 200) || null, given_ahead: false };
    this.db.payouts.push(строкаВыдачи);
    const дано = (this.db.payouts || [])
      .filter(p => p.employee_id === employee_id && p.period === period && p.status === 'confirmed')
      .reduce((s, p) => s + (p.amount_kop || 0), 0);
    const строка = (await this.listPayroll(period)).find(x => x.employee_id === employee_id);
    const вперёд = дано > (строка?.delta_kop || 0);
    строкаВыдачи.given_ahead = вперёд;
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
      given_ahead: false,
      is_self_payout: false });
    this._log('created', 'payout', id,
      'ОТМЕНА выдачи · ' + src.fio
        + ' · ' + MONTHS_RU[Number(src.period.slice(5)) - 1] + ' ' + src.period.slice(0, 4)
        + ((reason || '').trim() ? ' · ' + reason.trim().slice(0, 200) : ''),
      null, '−' + (Math.round(src.amount_kop/100)).toLocaleString('ru-RU') + ' ₽', true);
    this._save(); return id;
  }
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
    const BY_EMP = ['employee', 'employee_month_norm', 'month_carry', 'salary_override', 'doctor_month_revenue'];
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
  if (kind === 'сдельно') return `${l.line_type} · сдельно (сумму за месяц вписывают вручную)`;
  const unit = { 'оклад': '₽/мес', 'фикс': '₽/мес', 'сутки': '₽/смена', 'почасово': '₽/час' }[kind] || '₽';
  return `${l.line_type} · ${kind} ${l.amount ?? '?'} ${unit}`;
}
const EMPLOYEE_ERRORS = [
  ['phone_fmt_chk',          'Проверьте телефон: нужен российский мобильный, например +7 921 554-12-31'],
  ['employee_hire_leave_chk','Дата увольнения не может быть раньше даты приёма'],
  ['employee_status_check',  'Недопустимый статус карточки'],
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
  return raw;
}
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
  return raw;
}
const MONEY_KIND_RU = { cash: 'Наличные', cash_avans: 'Аванс наличными', premia: 'Премия',
  otpusk: 'Отпускные на карту', otpusk_cash: 'Отпускные наличными', otpusk_nach: 'Отпускные начислено',
  card_avans: 'Аванс на карту', card_rasch: 'ЗП на карту', card_uvol: 'Расчёт на карту (увольнение)' };
const MONEY_ERRORS = [
  ['money_line_sane_chk',   'Сумма вне разумных границ'],
  ['money_line_sign_chk',   'Сумма должна быть больше 0. Чтобы отменить запись — сделайте сторно'],
  ['money_line_period_chk', 'Период должен быть 1-м числом месяца'],
  ['Денежные записи не правятся', 'Денежные записи не правятся и не удаляются — исправление вносится сторно'],
  ['money_line_kind_chk', 'Этот вид выплаты база ещё не знает: не применена миграция 053. Обновите базу или выберите другой вид'],
  ['violates row-level security', 'Недостаточно прав для этого вида выплаты'],
  ['без сессии запрещена',  'Сессия истекла — войдите заново'],
];
export
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
  return raw;
}
export function sameRate(a, b) {
  const n = v => v == null || v === '' ? null : parseFloat(v);
  return a.pay_kind === b.pay_kind && n(a.amount) === n(b.amount) && n(a.amount_night) === n(b.amount_night) && n(a.percent) === n(b.percent);
}
export class SupabaseStore {
  constructor(url, key) { this.mode = 'supabase'; this.url = url; this.key = key; this.user = null; }
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
    this.sb = createClient(this.url, this.key, {
      auth: { persistSession: true, autoRefreshToken: true, lock: (_n, _t, fn) => fn() },
    });
    const { data } = await this.sb.auth.getSession();
    if (data?.session?.user) {
      if (localStorage.getItem(LOGIN_DAY_KEY) === mskDay()) await this._loadProfile(data.session.user);
      else { try { await this.sb.auth.signOut(); } catch (e) {} this.user = null; }
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
    localStorage.setItem(LOGIN_DAY_KEY, mskDay());
    await this._loadProfile(data.user);
    return this.user;
  }
  async logout() {
    try { if (this.sb) await this.sb.auth.signOut(); }
    finally { this.user = null; localStorage.removeItem(LOGIN_DAY_KEY); }
  }
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
  async listMonthMarked(period) {
    const { data, error } = await this.sb.from('v_month_marked').select('*').eq('period', period + '-01');
    if (error) throw error; return data || [];
  }
  async listCategoryOrder() {
    const { data, error } = await this.sb.from('category_order').select('*').order('sort');
    if (error) throw error;
    return data || [];
  }
  async setCategoryOrder(rows) {
    const { data, error } = await this.sb.from('category_order')
      .upsert(rows, { onConflict: 'category' }).select();
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
      if (e2) {
        await this.sb.from('employee').update({ status: 'archived' }).eq('id', e.id);
        throw new Error('Ставки не сохранились, карточка отменена: ' + rateError(e2));
      }
    }
    return e;
  }
  async updateEmployee(id, patch, newLines, validFrom) {
    const { data: upd, error } = await this.sb.from('employee').update(patch).eq('id', id).select();
    if (error) throw new Error(employeeError(error));
    if (!upd || !upd.length) throw new Error('Изменение не сохранено (недостаточно прав)');
    if (newLines) {
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
  async setEmployeeHidden(id, hidden) {
    const { data, error } = await this.sb.from('employee')
      .update({ hidden_at: hidden ? new Date().toISOString() : null }).eq('id', id).select();
    if (error) throw new Error(employeeError(error));
    if (!data || !data.length) throw new Error('Убирать из архива может только владелец');
    return data[0];
  }
  async setPrimaryRate(id, line, validFrom) {
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
    return this._fetchAll(() => this.sb.from('schedule').select('*').gte('work_date', start).lt('work_date', next));
  }
  async _fetchAll(makeQuery, pageSize = 1000) {
    const all = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await makeQuery().order('id', { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      all.push(...data);
      if (data.length < pageSize) break;
    }
    return all;
  }
  async setScheduleCell(employeeId, work_date, cell, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error(SupabaseStore.ZAKRYT);
    const touchesShift = 'plan_kind' in cell || 'plan_start' in cell || 'fact' in cell
      || 'fact_start' in cell || 'fact_end' in cell;
    const empty = touchesShift && (cell.plan_kind ?? null) === null && (cell.plan_start ?? null) === null
      && (cell.fact ?? null) === null && (cell.amount_kop ?? null) === null
      && (cell.fact_start ?? null) === null;
    if (empty) {
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
    if ('plan_end' in cell) row.plan_end = cell.plan_end ?? null;
    if ('plan_kind' in cell) row.plan_kind = cell.plan_kind ?? null;
    if ('fact' in cell) row.fact = cell.fact ?? null;
    if ('amount_kop' in cell) row.amount_kop = cell.amount_kop ?? null;
    if ('fact_start' in cell) row.fact_start = cell.fact_start ?? null;
    if ('fact_end' in cell) row.fact_end = cell.fact_end ?? null;
    const { data, error } = await this.sb.from('schedule')
      .upsert(row, { onConflict: 'employee_id,work_date,position' }).select().single();
    if (error) throw this._perevestiOtkaz(error, work_date); return data;
  }
  async setScheduleBulk(cells) {
    const rows = cells.map(c => {
      const row = { employee_id: c.employee_id, work_date: c.work_date,
        position: c.position || 'main',
        plan_kind: c.plan_kind ?? null, plan_start: c.plan_start ?? null,
        source: c.source || 'template', updated_by: this.user.id };
      if ('plan_end' in c) row.plan_end = c.plan_end ?? null;
      return row;
    });
    const otkrytye = rows.filter(r => !this._dayClosed(r.work_date));
    if (!otkrytye.length) return 0;
    const { error } = await this.sb.from('schedule').upsert(otkrytye, { onConflict: 'employee_id,work_date,position' });
    if (error) throw this._perevestiOtkaz(error, otkrytye[0].work_date);
    return otkrytye.length;
  }
  async clearScheduleMonth(employeeId, period, position = 'main') {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { data, error } = await this.sb.from('schedule').delete()
      .eq('employee_id', employeeId).eq('position', position).gte('work_date', start).lt('work_date', next).select('id');
    if (error) throw error; return (data || []).length;
  }
  async setScheduleFact(employeeId, work_date, fact, position = 'main') {
    if (this._dayClosed(work_date)) throw new Error(SupabaseStore.ZAKRYT);
    const { data: upd, error } = await this.sb.from('schedule')
      .update({ fact: fact ?? null, updated_by: this.user.id })
      .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).select();
    if (error) throw error;
    if (upd && upd.length) {
      const r = upd[0];
      if (!r.plan_kind && (r.fact ?? null) === null) {
        const { error: dErr } = await this.sb.from('schedule').delete()
          .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position);
        if (dErr) throw dErr; return null;
      }
      return r;
    }
    if (fact == null) {
      const { data: est } = await this.sb.from('schedule').select('id')
        .eq('employee_id', employeeId).eq('work_date', work_date).eq('position', position).maybeSingle();
      if (est) { this._zapomnit(work_date); throw new Error(SupabaseStore.ZAKRYT); }
      return null;
    }
    const { data: ins, error: e2 } = await this.sb.from('schedule')
      .insert({ employee_id: employeeId, work_date, position, fact, source: 'manual', updated_by: this.user.id }).select().single();
    if (e2) throw this._perevestiOtkaz(e2, work_date); return ins;
  }
  async listMonthNorms(period) {
    const { data, error } = await this.sb.from('v_month_norm')
      .select('employee_id, hours, is_manual, week_hours, calendar_hours').eq('period', period + '-01');
    if (error) throw error; return data || [];
  }
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
  async listClosedDays(period) {
    const start = period + '-01';
    const [y, m] = period.split('-').map(Number);
    const next = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01');
    const { data, error } = await this.sb.from('closed_day').select('work_date').gte('work_date', start).lt('work_date', next);
    if (error) throw error;
    const dni = (data || []).map(d => d.work_date);
    this._closed = this._closed || new Set();
    const pre = period + '-';
    for (const d of [...this._closed]) if (d.startsWith(pre)) this._closed.delete(d);
    for (const d of dni) this._closed.add(d);
    return dni;
  }
  _dayClosed(wd) { return !!(this._closed && this._closed.has(wd)); }
  _zabyt(wd) { this._closed && this._closed.delete(wd); }
  _zapomnit(wd) { (this._closed = this._closed || new Set()).add(wd); }
  static ZAKRYT = 'День закрыт. Чтобы исправить, его надо открыть — это может Милена или директор';
  _perevestiOtkaz(e, work_date) {
    const t = String(e?.message || e || '');
    if (/row-level security|violates row level/i.test(t)) { this._zapomnit(work_date); return new Error(SupabaseStore.ZAKRYT); }
    return e;
  }
  async closeDay(work_date) {
    const { error } = await this.sb.from('closed_day').upsert({ work_date }, { onConflict: 'work_date', ignoreDuplicates: true });
    if (error) throw error;
    this._zapomnit(work_date);
    return work_date;
  }
  async closePeriod(from_date, to_date) {
    const { data, error } = await this.sb.rpc('close_period', { p_from: from_date, p_to: to_date });
    if (error) throw error;
    for (const d of this._dniPerioda(from_date, to_date)) this._zapomnit(d);
    return data ?? 0;
  }
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
  async reopenDay(work_date) {
    const { data, error } = await this.sb.from('closed_day').delete().eq('work_date', work_date).select();
    if (error) throw error;
    if (!data || !data.length) {
      const { data: est } = await this.sb.from('closed_day').select('work_date').eq('work_date', work_date).maybeSingle();
      this._zabyt(work_date);
      if (!est) return true;
      throw new Error('Открыть день может Милена или директор');
    }
    this._zabyt(work_date);
    return true;
  }
  async requestRetroEdit(work_date, employee_id, target, payload) {
    const { data, error } = await this.sb.rpc('request_retro_edit', {
      p_work_date: work_date, p_employee_id: employee_id, p_target: target,
      p_new_fact: payload.new_fact ?? null, p_new_plan_kind: payload.new_plan_kind ?? null, p_new_plan_start: payload.new_plan_start ?? null });
    if (error) throw error; return { id: data };
  }
  async confirmRetroEdit(request_id, code) {
    const { data, error } = await this.sb.rpc('confirm_retro_edit', { p_request_id: request_id, p_code: code });
    if (error) throw error; return data;
  }
  async listRedRemarks(limit = 50) {
    const { data, error } = await this.sb.from('journal').select('*, actor_user:app_user(display_name)').eq('red', true).order('at', { ascending: false }).limit(limit);
    if (error) throw error; return (data || []).map(j => ({ ...j, actor: j.actor_user?.display_name || j.actor }));
  }
  async listRecentPayouts(limit = 5, period = null) {
    let q = this.sb.from('payout')
      .select('id, employee_id, amount_kop, confirmed_at, code_sent_at, reverses_id, given_ahead, is_self_payout, emp:employee(fio)')
      .eq('status', 'confirmed');
    if (period) q = q.eq('period', period + '-01');
    const { data, error } = await q.order('confirmed_at', { ascending: false });
    if (error) throw error;
    return сводкаВыдач(data || [], limit, p => p.emp?.fio || '—');
  }
  async logError(kind, message, stack, screen, version, ms) {
    try {
      await this.sb.rpc('log_client_error', {
        p_kind: kind, p_message: message, p_stack: stack,
        p_screen: screen, p_version: version, p_ua: navigator.userAgent,
        p_ms: (ms == null ? null : Math.round(ms)) });
    } catch (e) {   }
  }
  async listPayouts(employee_id, period) {
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
  async listJournal({ filter = 'all', beforeId = null, limit = 50, who = '', act = '', from = '', to = '' } = {}) {
    let q = this.sb.from('v_journal_named').select('*')
      .order('id', { ascending: false }).limit(limit + 1);
    if (filter === 'red') q = q.eq('red', true);
    else if (filter === 'money') q = q.in('entity', ['money_line', 'patient_payment']);
    else if (filter === 'payout') q = q.eq('entity', 'payout');
    else if (filter === 'premia') q = q.eq('entity', 'money_line').ilike('field', '%премия%');
    else if (filter === 'schedule') q = q.eq('entity', 'schedule');
    else if (filter === 'rate') q = q.eq('entity', 'rate_line');
    if (who) {
      const w = `%${String(who).replace(/[%,()]/g, ' ')}%`;
      q = q.or(`subject_fio.ilike.${w},actor_name.ilike.${w}`);
    }
    const ACT = { add: ['created', 'деньги', 'выручка', 'импорт'],
                  edit: ['updated'], del: ['deleted', 'сторно', 'возврат'] };
    if (ACT[act]) q = q.in('action', ACT[act]);
    if (from) q = q.gte('at', from + 'T00:00:00');
    if (to) q = q.lte('at', to + 'T23:59:59');
    if (beforeId != null) q = q.lt('id', beforeId);
    const { data, error } = await q;
    if (error) throw error;
    const hasMore = data.length > limit;
    const rows = (hasMore ? data.slice(0, limit) : data).map(j => ({ ...j, actor: j.actor_name || j.actor }));
    return { rows, hasMore, lastId: rows.length ? rows[rows.length - 1].id : null };
  }
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
  async listPayroll(period) {
    const { data, error } = await this.sb.from('v_month_total')
      .select('*').eq('period', period + '-01').order('fio');
    if (error) throw error; return data || [];
  }
  async getPayrollRow(employee_id, period) {
    const { data, error } = await this.sb.from('v_month_total')
      .select('*').eq('employee_id', employee_id).eq('period', period + '-01').maybeSingle();
    if (error) throw error; return data || null;
  }
  async listPayrollLines(period) {
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
    const { data, error } = await this.sb.from('money_line').insert({
      employee_id: row.employee_id, period: row.period, kind: row.kind,
      amount_kop: -row.amount_kop, reverses_id: row.id,
      note: 'исправление', entered_by: this.user.id,
    }).select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  async listMoneyEvents(employee_id, period) {
    const { data, error } = await this.sb.from('v_money_events')
      .select('*').eq('employee_id', employee_id).eq('period', period + '-01')
      .order('created_at', { ascending: false });
    if (error) throw error; return data || [];
  }
  async existingMoneyIds(period, kind) {
    const { data, error } = await this.sb.from('money_line')
      .select('employee_id, amount_kop').eq('period', period + '-01').eq('kind', kind);
    if (error) throw error;
    const net = new Map();
    for (const r of data || []) net.set(r.employee_id, (net.get(r.employee_id) || 0) + r.amount_kop);
    return new Set([...net].filter(([, v]) => v > 0).map(([k]) => k));
  }
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
  async importMoneyBatch(period, kind, items, filename) {
    const { data, error } = await this.sb.rpc('import_money_batch', {
      p_kind: kind, p_period: period + '-01', p_items: items, p_filename: filename || null,
    });
    if (error) throw new Error(moneyError(error));
    return data;
  }
  async getDoctorRevenue(employee_id, period) {
    const { data, error } = await this.sb.from('doctor_month_revenue')
      .select('amount_kop').eq('employee_id', employee_id).eq('period', period + '-01');
    if (error) throw error;
    return (data || []).reduce((s, r) => s + r.amount_kop, 0);
  }
  async setDoctorRevenue(employee_id, period, target_kop) {
    const cur = await this.getDoctorRevenue(employee_id, period);
    const delta = target_kop - cur;
    if (delta === 0) return null;
    const { data, error } = await this.sb.from('doctor_month_revenue')
      .insert({ employee_id, period: period + '-01', amount_kop: delta,
        note: cur ? 'коррекция выручки' : null, entered_by: this.user.id })
      .select().single();
    if (error) throw new Error(moneyError(error));
    return data;
  }
  async getSalaryOverride(employee_id, period) {
    const { data, error } = await this.sb.from('month_salary_override')
      .select('amount_kop').eq('employee_id', employee_id).eq('period', period + '-01').maybeSingle();
    if (error) throw error;
    return data ? data.amount_kop : null;
  }
  async listPrevRemainder(period) {
    const [y, m] = period.split('-').map(Number);
    const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const { data, error } = await this.sb.from('v_month_total')
      .select('employee_id, fio, delta_kop, salary_kop').eq('period', pm + '-01').order('delta_kop');
    if (error) throw error;
    const all = data || [];
    return { prev: pm, rows: all.filter(r => (r.delta_kop || 0) < 0), all };
  }
  async listCarries(period) {
    const { data, error } = await this.sb.from('month_carry')
      .select('employee_id, amount_kop, note').eq('period', period + '-01');
    if (error) throw error;
    return data || [];
  }
  async setCarry(employee_id, period, amount_kop, note) {
    if (amount_kop == null) {
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
    if (amount_kop == null) {
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
    } catch (e) { console.warn('markRead:', e); }
  }
  async unreadCounts() {
    try {
      const [{ data: reads }, { data: msgs }] = await Promise.all([
        this.sb.from('comment_read').select('channel_id, last_read'),
        this.sb.from('comment').select('channel_id, created_at, author').is('deleted_at', null),
      ]);
      const seen = new Map((reads || []).map(r => [r.channel_id, r.last_read]));
      const out = new Map();
      for (const m of msgs || []) {
        if (m.author === this.user.id) continue;
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
//# sourceMappingURL=store.js.map
