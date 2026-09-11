/* Nix PWA — ядро: константы, хранилище, даты, разбор речи, статистика.
   Данные лежат в localStorage этого браузера и никуда не отправляются. */

const PRIORITIES = [
  { id: 'HIGH', label: 'Высокий', weight: 0, color: '#e63c6b', glow: true },
  { id: 'MEDIUM', label: 'Средний', weight: 1, color: '#efa927', glow: true },
  { id: 'LOW', label: 'Низкий', weight: 2, color: '#5b6478', glow: false }
];

const CATEGORIES = [
  { id: 'INBOX', label: 'Входящие', color: '#6fd3e8' },
  { id: 'WORK', label: 'Работа', color: '#7c8cff' },
  { id: 'PERSONAL', label: 'Личное', color: '#c77cff' },
  { id: 'STUDY', label: 'Учёба', color: '#efa927' },
  { id: 'HEALTH', label: 'Здоровье', color: '#5dcaa5' },
  { id: 'FINANCE', label: 'Финансы', color: '#3ce6b8' },
  { id: 'OTHER', label: 'Другое', color: '#8b95a8' }
];

// Энергия — своя холодная палитра, чтобы не путалась с приоритетом
const ENERGIES = [
  { id: 'HIGH', label: 'Много сил', short: 'Тяжёлая', color: '#4c7dff' },
  { id: 'MEDIUM', label: 'Средне', short: 'Обычная', color: '#56b7e8' },
  { id: 'LOW', label: 'На автопилоте', short: 'Лёгкая', color: '#6fd3c4' }
];

const RECURRENCES = [
  { id: 'NONE', label: 'Не повторять', short: 'Разово' },
  { id: 'DAILY', label: 'Каждый день', short: 'Ежедневно' },
  { id: 'WEEKDAYS', label: 'По будням', short: 'Будни' },
  { id: 'WEEKDAYS_CUSTOM', label: 'По выбранным дням', short: 'Свои дни' },
  { id: 'WEEKLY', label: 'Каждую неделю', short: 'Еженедельно' },
  { id: 'MONTHLY', label: 'Каждый месяц', short: 'Ежемесячно' }
];

const BOARD_GROUPS = [
  { id: 'CATEGORY', label: 'Категория' },
  { id: 'PRIORITY', label: 'Приоритет' },
  { id: 'ENERGY', label: 'Силы' },
  { id: 'PROJECT', label: 'Проект' }
];

/* Вторая ось доски — свимлейны. NONE: доска одной полосой, как раньше. */
const BOARD_SWIMLANES = [
  { id: 'NONE', label: 'Без свимлейнов' },
  { id: 'CATEGORY', label: 'Категория' },
  { id: 'PRIORITY', label: 'Приоритет' },
  { id: 'ENERGY', label: 'Силы' },
  { id: 'PROJECT', label: 'Проект' }
];

/* Дни недели. Номера как в Date.getDay(): 0 — воскресенье, 1 — понедельник. */
const WEEKDAYS = [
  { day: 1, short: 'Пн' }, { day: 2, short: 'Вт' }, { day: 3, short: 'Ср' },
  { day: 4, short: 'Чт' }, { day: 5, short: 'Пт' }, { day: 6, short: 'Сб' },
  { day: 0, short: 'Вс' }
];

const hasWeekday = (mask, day) => ((mask || 0) & (1 << day)) !== 0;
const toggleWeekday = (mask, day) => (mask || 0) ^ (1 << day);
const weekdayMaskEmpty = (mask) => WEEKDAYS.every((w) => !hasWeekday(mask, w.day));
const describeWeekdays = (mask) =>
  WEEKDAYS.filter((w) => hasWeekday(mask, w.day)).map((w) => w.short).join(', ');

/** Подпись повтора: «Пн, Ср, Пт» вместо безликого «Свои дни». */
function describeRecurrence(task) {
  const rec = byId(RECURRENCES, task.recurrence || 'NONE');
  if (rec.id === 'WEEKDAYS_CUSTOM' && !weekdayMaskEmpty(task.weekdayMask)) {
    return describeWeekdays(task.weekdayMask);
  }
  return rec.short;
}

/**
 * Ключ колонки доски: ось и значение через двоеточие. Позиция плитки живёт
 * в task.boardPositions[ключ], поэтому раскладка доски по приоритету не сбивает
 * раскладку по категориям и наоборот.
 */
const boardKey = {
  CATEGORY: (id) => 'CATEGORY:' + id,
  PRIORITY: (id) => 'PRIORITY:' + id,
  ENERGY: (id) => 'ENERGY:' + id,
  PROJECT: (id) => 'PROJECT:' + (id === null || id === undefined ? 'NONE' : id),
  /**
   * Ключ ячейки доски. Без свимлейна — обычный ключ колонки, поэтому
   * позиции, расставленные раньше, продолжают читаться. Со свимлейном ключ
   * составной: «CATEGORY:WORK|PRIORITY:HIGH», ось колонки всегда первой.
   */
  cell: (columnKey, laneKey) => (laneKey ? columnKey + '|' + laneKey : columnKey),
  columnOf: (cellKey) => String(cellKey).split('|')[0]
};

/** Все категории задачи, основная первой. */
function categoriesOf(task) {
  const extra = Array.isArray(task.categories) ? task.categories : [];
  const all = [task.category].concat(extra.filter((c) => c !== task.category));
  return all.filter((c) => CATEGORIES.some((x) => x.id === c));
}

function boardPositionOf(task, key) {
  const map = task.boardPositions || {};
  const value = map[key];
  return value === undefined || value === null ? Number.MAX_SAFE_INTEGER : value;
}

const VIEW_MODES = [
  { id: 'LIST', label: 'Список' },
  { id: 'TILES', label: 'Плитки' },
  { id: 'BOARD', label: 'Доска' }
];

const SORT_MODES = [
  { id: 'DEADLINE', label: 'По дедлайну' },
  { id: 'PRIORITY', label: 'По приоритету' },
  { id: 'CREATED', label: 'По дате создания' }
];

const THEMES = [
  { id: 'DARK', label: 'Тёмная' },
  { id: 'LIGHT', label: 'Светлая' },
  { id: 'SYSTEM', label: 'Как в системе' }
];

const FONT_SCALES = [
  { id: 'NORMAL', label: 'Обычный', factor: 1 },
  { id: 'LARGE', label: 'Крупный', factor: 1.15 }
];

const REMINDER_OFFSETS = [
  { minutes: null, label: 'Без' },
  { minutes: 5, label: '5 мин' },
  { minutes: 15, label: '15 мин' },
  { minutes: 30, label: '30 мин' },
  { minutes: 60, label: '1 час' },
  { minutes: 180, label: '3 часа' },
  { minutes: 1440, label: '1 день' }
];

const FOCUS_WORK_OPTIONS = [15, 25, 35, 45, 60];
const FOCUS_BREAK_OPTIONS = [3, 5, 10, 15];

const TRASH_RETENTION_DAYS = 7;
const HEATMAP_WEEKS = 13;
const DAY = 86400000;

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

/* ---------------------------------------------------------------- хранилище */

const KEY_TASKS = 'nix.tasks.v2';
const KEY_SETTINGS = 'nix.settings.v2';
const KEY_SESSIONS = 'nix.sessions.v1';
const KEY_PROJECTS = 'nix.projects.v1';
const KEY_TEMPLATES = 'nix.templates.v1';
const KEY_VIEWS = 'nix.views.v1';

const defaultSettings = {
  theme: 'DARK',
  fontScale: 'NORMAL',
  sortMode: 'DEADLINE',
  viewMode: 'LIST',
  boardGroupBy: 'CATEGORY',
  boardSwimlaneBy: 'NONE',
  reminderMinutes: 30,
  focusWorkMinutes: 25,
  focusBreakMinutes: 5,
  focusSoundEnabled: false,
  focusHintSeen: false,
  notificationsEnabled: false
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.warn('Не удалось прочитать', key, e);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

const state = {
  tasks: readJson(KEY_TASKS, []),
  sessions: readJson(KEY_SESSIONS, []),
  projects: readJson(KEY_PROJECTS, []),
  templates: readJson(KEY_TEMPLATES, []),
  views: readJson(KEY_VIEWS, []),
  settings: Object.assign({}, defaultSettings, readJson(KEY_SETTINGS, {})),
  tab: 'TASKS',
  filter: { type: 'ALL' },
  query: '',
  searchOpen: false,
  categoryOpen: false,
  expanded: new Set(),
  editingId: null,
  draft: null,
  detailsOpen: false,
  notifiedIds: new Set(),
  calendarMode: 'DAY',
  calendarAnchor: Date.now(),
  selectedDay: null,
  heatmapMode: 'TASKS',
  focus: null,
  dragId: null
};

const saveTasks = () => writeJson(KEY_TASKS, state.tasks);
const saveSessions = () => writeJson(KEY_SESSIONS, state.sessions);
const saveProjects = () => writeJson(KEY_PROJECTS, state.projects);
const saveTemplates = () => writeJson(KEY_TEMPLATES, state.templates);
const saveViews = () => writeJson(KEY_VIEWS, state.views);
const saveSettings = () => writeJson(KEY_SETTINGS, state.settings);

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------------- даты */

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const isToday = (ms) => startOfDay(ms) === startOfDay(Date.now());
const isTomorrow = (ms) => startOfDay(ms) === startOfDay(Date.now()) + DAY;
const isOverdue = (ms) => ms < Date.now();

const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const fmtFull = (ms) =>
  new Date(ms).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });

const fmtDayMonth = (ms) =>
  new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

function fmtMonthYear(ms) {
  const text = new Date(ms).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function groupLabel(deadline) {
  if (!deadline) return 'Без срока';
  if (isOverdue(deadline) && !isToday(deadline)) return 'Просрочено';
  if (isToday(deadline)) return 'Сегодня';
  if (isTomorrow(deadline)) return 'Завтра';
  const d = new Date(deadline);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('ru-RU',
    sameYear ? { day: 'numeric', month: 'long' }
             : { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupOrder(label) {
  if (label === 'Просрочено') return 0;
  if (label === 'Сегодня') return 1;
  if (label === 'Завтра') return 2;
  if (label === 'Без срока') return 9999;
  return 3;
}

function nextOccurrence(from, recurrence, now = Date.now(), weekdayMask = 0) {
  if (!recurrence || recurrence === 'NONE') return null;
  // Повтор по своим дням без единого выбранного дня зациклил бы поиск
  if (recurrence === 'WEEKDAYS_CUSTOM' && weekdayMaskEmpty(weekdayMask)) return null;

  const d = new Date(from);
  let guard = 0;
  do {
    if (recurrence === 'DAILY') d.setDate(d.getDate() + 1);
    else if (recurrence === 'WEEKDAYS') {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    } else if (recurrence === 'WEEKDAYS_CUSTOM') {
      // Шагаем по дню вперёд до ближайшего выбранного; при непустой маске
      // нужного дня дальше семи шагов быть не может
      let steps = 0;
      do {
        d.setDate(d.getDate() + 1);
        steps += 1;
      } while (!hasWeekday(weekdayMask, d.getDay()) && steps < 7);
    } else if (recurrence === 'WEEKLY') d.setDate(d.getDate() + 7);
    else if (recurrence === 'MONTHLY') d.setMonth(d.getMonth() + 1);
    else return null;
    guard += 1;
  } while (d.getTime() <= now && guard < 500);
  return d.getTime();
}

/* Сетка месяца с понедельника, всегда 42 дня — высота не прыгает */
function monthGrid(anchor) {
  const d = new Date(anchor);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  const first = d.getTime() - shift * DAY;
  return Array.from({ length: 42 }, (_, i) => startOfDay(first + i * DAY));
}

const isSameMonth = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
};

const addMonths = (ms, amount) => {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + amount);
  return d.getTime();
};

/* ---------------------------------------------------------------- разбор дат */

const WEEKDAY_WORDS = {
  'понедельник': 1, 'вторник': 2, 'среду': 3, 'среда': 3, 'четверг': 4,
  'пятницу': 5, 'пятница': 5, 'субботу': 6, 'суббота': 6, 'воскресенье': 0
};

const MONTH_WORDS = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};

/* Консервативный разбор: если уверенности нет, дата не ставится.
   Ложное срабатывание раздражает сильнее, чем несработавший разбор. */
function parseDate(input, now = Date.now()) {
  if (!input || !input.trim()) return { title: input, deadline: null, phrase: null };

  const lower = input.toLowerCase();
  const d = new Date(now);
  let matched = [];
  let daySet = false;
  let timeSet = false;

  const relative = lower.match(/через\s+(\d{1,3})\s*(минут\w*|мин|час\w*|ч|дн\w*|день|недел\w*)/);
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const unit = relative[2];
    if (unit.startsWith('мин')) d.setMinutes(d.getMinutes() + amount);
    else if (unit.startsWith('час') || unit === 'ч') d.setHours(d.getHours() + amount);
    else if (unit.startsWith('дн') || unit === 'день') d.setDate(d.getDate() + amount);
    else if (unit.startsWith('недел')) d.setDate(d.getDate() + amount * 7);
    return { title: cleanText(input, relative[0]), deadline: d.getTime(), phrase: relative[0] };
  }

  if (lower.includes('послезавтра')) {
    d.setDate(d.getDate() + 2); daySet = true; matched.push('послезавтра');
  } else if (lower.includes('завтра')) {
    d.setDate(d.getDate() + 1); daySet = true; matched.push('завтра');
  } else if (lower.includes('сегодня')) {
    daySet = true; matched.push('сегодня');
  } else {
    for (const [word, dow] of Object.entries(WEEKDAY_WORDS)) {
      const hit = lower.match(new RegExp('(?:в|во)\\s+' + word));
      if (hit) {
        d.setDate(d.getDate() + 1);
        let guard = 0;
        while (d.getDay() !== dow && guard < 8) { d.setDate(d.getDate() + 1); guard++; }
        daySet = true; matched.push(hit[0]);
        break;
      }
    }
    if (!daySet) {
      const monthNames = Object.keys(MONTH_WORDS).join('|');
      const hit = lower.match(new RegExp('(\\d{1,2})\\s+(' + monthNames + ')'));
      if (hit) {
        d.setMonth(MONTH_WORDS[hit[2]]);
        d.setDate(parseInt(hit[1], 10));
        if (d.getTime() < now) d.setFullYear(d.getFullYear() + 1);
        daySet = true; matched.push(hit[0]);
      }
    }
  }

  const explicit = lower.match(/(?:в\s+)?(\d{1,2})[:.](\d{2})/);
  if (explicit) {
    const h = parseInt(explicit[1], 10), m = parseInt(explicit[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      d.setHours(h, m, 0, 0); timeSet = true; matched.push(explicit[0]);
    }
  }

  if (!timeSet) {
    const loose = lower.match(/в\s+(\d{1,2})\s*(утра|дня|вечера|ночи)?/);
    if (loose) {
      let h = parseInt(loose[1], 10);
      const part = loose[2];
      if (h >= 0 && h <= 23) {
        if (part === 'вечера' && h < 12) h += 12;
        if (part === 'дня' && h >= 1 && h <= 6) h += 12;
        if (part === 'ночи' && h === 12) h = 0;
        d.setHours(h, 0, 0, 0); timeSet = true; matched.push(loose[0]);
      }
    }
  }

  if (!daySet && !timeSet) return { title: input, deadline: null, phrase: null };

  d.setSeconds(0, 0);
  if (timeSet && !daySet && d.getTime() <= now) d.setDate(d.getDate() + 1);
  if (daySet && !timeSet) {
    d.setHours(9, 0, 0, 0);
    if (d.getTime() <= now) { d.setTime(now); d.setHours(d.getHours() + 1, 0, 0, 0); }
  }

  const phrase = matched.join(' ');
  return { title: cleanText(input, phrase), deadline: d.getTime(), phrase };
}

function cleanText(original, phrase) {
  if (!phrase) return original.trim();
  let result = original;
  phrase.split(' ').filter(Boolean).forEach((part) => {
    result = result.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  });
  return result.replace(/\s{2,}/g, ' ').trim().replace(/[,.;]+$/, '').trim() || original.trim();
}

/* ---------------------------------------------------------------- статистика */

function calcStats() {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart = todayStart - 6 * DAY;

  const active = state.tasks.filter((t) => !t.deletedAt);
  const completed = active.filter((t) => t.isDone && t.completedAt);

  const completedByDay = {};
  completed.forEach((t) => {
    const key = startOfDay(t.completedAt);
    completedByDay[key] = (completedByDay[key] || 0) + 1;
  });

  const focusByDay = {};
  state.sessions.forEach((s) => {
    const key = startOfDay(s.startedAt);
    focusByDay[key] = (focusByDay[key] || 0) + s.minutes;
  });

  const doneDays = Object.keys(completedByDay).map(Number).sort((a, b) => a - b);

  // Сетка выравнивается по неделям: правый край — воскресенье текущей
  const mondayIndex = (new Date(todayStart).getDay() + 6) % 7;
  const gridEnd = todayStart + (6 - mondayIndex) * DAY;
  const gridStart = gridEnd - (HEATMAP_WEEKS * 7 - 1) * DAY;

  const heatmap = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => {
    const day = gridStart + i * DAY;
    return {
      dayStart: day,
      completedCount: completedByDay[day] || 0,
      focusMinutes: focusByDay[day] || 0
    };
  });

  const weekTasks = active.filter((t) =>
    t.deadline && t.deadline >= weekStart && t.deadline < todayStart + DAY);
  const weekDone = weekTasks.filter((t) => t.isDone).length;

  const byCategory = {};
  // Задача с несколькими категориями засчитывается в каждую свою — иначе
  // разбивка перестала бы сходиться с тем, что видно на доске
  completed.forEach((t) => {
    categoriesOf(t).forEach((c) => { byCategory[c] = (byCategory[c] || 0) + 1; });
  });

  const byEnergy = {};
  completed.forEach((t) => {
    const key = t.energy || 'MEDIUM';
    byEnergy[key] = (byEnergy[key] || 0) + 1;
  });

  return {
    completedToday: completedByDay[todayStart] || 0,
    completedThisWeek: completed.filter((t) => t.completedAt >= weekStart).length,
    totalActive: active.filter((t) => !t.isDone).length,
    totalCompleted: completed.length,
    currentStreak: currentStreak(doneDays, todayStart),
    bestStreak: bestStreak(doneDays),
    heatmap,
    byCategory,
    byEnergy,
    focusToday: focusByDay[todayStart] || 0,
    focusWeek: state.sessions.filter((s) => s.startedAt >= weekStart)
      .reduce((sum, s) => sum + s.minutes, 0),
    focusAll: state.sessions.reduce((sum, s) => sum + s.minutes, 0),
    sessionsCount: state.sessions.length,
    weekRate: weekTasks.length ? weekDone / weekTasks.length : 0,
    weekPlanned: weekTasks.length,
    weekDone
  };
}

/* Серия не рвётся утром: вчерашнее выполнение ещё держит её живой */
function currentStreak(doneDays, todayStart) {
  if (!doneDays.length) return 0;
  const set = new Set(doneDays);
  const last = doneDays[doneDays.length - 1];
  if (last !== todayStart && last !== todayStart - DAY) return 0;

  let streak = 1;
  let cursor = last;
  while (set.has(cursor - DAY)) { streak++; cursor -= DAY; }
  return streak;
}

function bestStreak(doneDays) {
  if (!doneDays.length) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < doneDays.length; i++) {
    current = doneDays[i] - doneDays[i - 1] === DAY ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return minutes + ' мин';
  if (minutes % 60 === 0) return (minutes / 60) + ' ч';
  return Math.floor(minutes / 60) + ' ч ' + (minutes % 60) + ' м';
}

function pluralDays(count) {
  const m10 = count % 10, m100 = count % 100;
  if (m10 === 1 && m100 !== 11) return 'день подряд';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня подряд';
  return 'дней подряд';
}
/* Nix PWA — интерфейс: список, календарь, статистика, листы, фокус-таймер. */

const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function icon(paths, size = 13, width = 1.8, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="${width}" stroke-linecap="round"
    stroke-linejoin="round" ${extra}>${paths}</svg>`;
}

const ICONS = {
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  drag: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  fire: '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-6-6-11-6-11z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  pause: '<path d="M7 4v16M17 4v16"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="13" y="8" width="3" height="10"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
};

const VIEW_ICONS = {
  LIST: ICONS.list,
  TILES: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  BOARD: '<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="13" rx="1.5"/>' +
    '<rect x="17" y="3" width="4" height="9" rx="1.5"/>'
};

function inkFor(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#0a0d12' : '#ffffff';
}

/* ---------------------------------------------------------------- тема */

function applyTheme() {
  const root = document.documentElement;
  let effective = state.settings.theme;
  if (effective === 'SYSTEM') {
    effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'LIGHT' : 'DARK';
  }
  root.dataset.theme = effective === 'LIGHT' ? 'light' : 'dark';
  root.style.setProperty('--font-scale', String(byId(FONT_SCALES, state.settings.fontScale).factor));

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effective === 'LIGHT' ? '#F7F8FA' : '#0A0C10');
}

/* ---------------------------------------------------------------- выборка */

function liveTasks() {
  return state.tasks.filter((t) => !t.deletedAt);
}

function visibleTasks() {
  const f = state.filter;
  const query = state.query.trim().toLowerCase();
  let list = liveTasks();

  if (query) {
    list = list.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      (t.subtasks || []).some((s) => s.title.toLowerCase().includes(query)));
  } else if (f.type === 'ALL') list = list.filter((t) => !t.isDone);
  else if (f.type === 'TODAY') {
    list = list.filter((t) => !t.isDone && t.deadline && (isToday(t.deadline) || isOverdue(t.deadline)));
  } else if (f.type === 'INBOX') list = list.filter((t) => !t.isDone && categoriesOf(t).includes('INBOX'));
  else if (f.type === 'DONE') list = list.filter((t) => t.isDone);
  else if (f.type === 'CAT') list = list.filter((t) => !t.isDone && categoriesOf(t).includes(f.category));

  const inf = Number.MAX_SAFE_INTEGER;
  const auto = (a, b) => {
    if (state.settings.sortMode === 'DEADLINE') {
      return (a.deadline || inf) - (b.deadline || inf) ||
        byId(PRIORITIES, a.priority).weight - byId(PRIORITIES, b.priority).weight;
    }
    if (state.settings.sortMode === 'PRIORITY') {
      return byId(PRIORITIES, a.priority).weight - byId(PRIORITIES, b.priority).weight ||
        (a.deadline || inf) - (b.deadline || inf);
    }
    return b.createdAt - a.createdAt;
  };

  // Переставленные вручную идут первыми, остальные — по выбранной сортировке
  list.sort((a, b) => {
    const ao = a.manualOrder === undefined || a.manualOrder === null ? inf : a.manualOrder;
    const bo = b.manualOrder === undefined || b.manualOrder === null ? inf : b.manualOrder;
    return ao - bo || auto(a, b);
  });

  return list;
}

function groupTasks(list) {
  if (state.query.trim()) {
    return list.length ? [{ label: 'Найдено: ' + list.length, tasks: list }] : [];
  }
  if (state.filter.type === 'DONE') {
    if (!list.length) return [];
    const sorted = list.slice().sort((a, b) =>
      (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));
    return [{ label: 'Выполненные', tasks: sorted }];
  }

  const map = new Map();
  list.forEach((t) => {
    const label = groupLabel(t.deadline);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(t);
  });

  return Array.from(map.entries())
    .map(([label, tasks]) => ({ label, tasks }))
    .sort((a, b) => groupOrder(a.label) - groupOrder(b.label) ||
      (a.tasks[0].deadline || Number.MAX_SAFE_INTEGER) -
      (b.tasks[0].deadline || Number.MAX_SAFE_INTEGER));
}

/**
 * Колонки доски. Колонка — это категория задачи, поэтому перетаскивание
 * внутри доски трогает только позицию плитки, а саму категорию не меняет.
 * Выполненные не прячем: без них цепочка внутри колонки рвётся.
 */
/** Значения одной оси: ключ, подпись и цвет. Общее для колонок и свимлейнов. */
function axisValues(axis) {
  if (axis === 'PRIORITY') {
    return PRIORITIES.map((p) => ({ key: boardKey.PRIORITY(p.id), label: p.label, color: p.color }));
  }
  if (axis === 'ENERGY') {
    return ENERGIES.map((e) => ({ key: boardKey.ENERGY(e.id), label: e.label, color: e.color }));
  }
  if (axis === 'PROJECT') {
    const list = state.projects.filter((p) => !p.archived)
      .map((p) => ({ key: boardKey.PROJECT(p.id), label: p.name, color: projectColor(p) }));
    list.push({ key: boardKey.PROJECT(null), label: 'Без проекта', color: 'var(--text-muted)' });
    return list;
  }
  return CATEGORIES.map((c) => ({ key: boardKey.CATEGORY(c.id), label: c.label, color: c.color }));
}

/**
 * Полосы доски. Колонки задаёт ось из настроек, свимлейн режет доску поперёк.
 * Колонка опознаётся по ключу ячейки — тому же, под которым лежит позиция
 * плитки. Перетаскивание вверх-вниз меняет только позицию.
 *
 * Задача с несколькими категориями попадает в каждую свою колонку, поэтому на
 * оси CATEGORY один и тот же элемент встречается в нескольких колонках.
 * Выполненные не прячем: без них цепочка внутри колонки рвётся.
 */
function boardLanes() {
  const query = state.query.trim().toLowerCase();
  const groupBy = state.settings.boardGroupBy || 'CATEGORY';
  const swimlaneBy = state.settings.boardSwimlaneBy || 'NONE';
  let list = liveTasks();

  if (query) {
    list = list.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      (t.subtasks || []).some((s) => s.title.toLowerCase().includes(query)));
  }

  const columns = axisValues(groupBy);
  // Одна ось на обе оси — вырожденный случай: свимлейны просто не режут
  const laneAxis = (swimlaneBy !== 'NONE' && swimlaneBy !== groupBy) ? swimlaneBy : null;
  const lanes = laneAxis ? axisValues(laneAxis) : [null];

  const inf = Number.MAX_SAFE_INTEGER;

  return lanes.map((lane) => {
    const laneTasks = lane
      ? list.filter((t) => keysOf(t, laneAxis).includes(lane.key))
      : list;

    const laneColumns = columns.map((column) => {
      // Ключ ячейки, а не колонки: у каждой клетки свимлейна своя раскладка
      const cellKey = boardKey.cell(column.key, lane ? lane.key : null);
      const items = laneTasks
        .filter((t) => keysOf(t, groupBy).includes(column.key))
        .sort((a, b) =>
          boardPositionOf(a, cellKey) - boardPositionOf(b, cellKey) ||
          (a.isDone ? 1 : 0) - (b.isDone ? 1 : 0) ||
          (a.deadline || inf) - (b.deadline || inf) ||
          a.createdAt - b.createdAt);
      return Object.assign({}, column, {
        key: cellKey,
        tasks: items,
        doneCount: items.filter((t) => t.isDone).length
      });
    });

    return {
      key: lane ? lane.key : null,
      label: lane ? lane.label : null,
      color: lane ? lane.color : null,
      columns: laneColumns,
      itemCount: laneColumns.reduce((sum, c) => sum + c.tasks.length, 0)
    };
  });
}

/** В какие колонки попадает задача на выбранной оси. Для категорий — во все свои. */
function keysOf(task, groupBy) {
  if (groupBy === 'PRIORITY') return [boardKey.PRIORITY(task.priority)];
  if (groupBy === 'ENERGY') return [boardKey.ENERGY(task.energy || 'MEDIUM')];
  if (groupBy === 'PROJECT') return [boardKey.PROJECT(task.projectId)];
  return categoriesOf(task).map((c) => boardKey.CATEGORY(c));
}

/** Цвет проекта: свой, если задан, иначе из палитры по позиции. */
function projectColor(project) {
  if (project.colorHex) return project.colorHex;
  const palette = CATEGORIES.map((c) => c.color);
  const index = Math.max(0, state.projects.findIndex((p) => p.id === project.id));
  return palette[index % palette.length];
}

/* ---------------------------------------------------------------- карточка */

function renderTaskCard(task, groupLabelText, index, groupSize) {
  const prio = byId(PRIORITIES, task.priority);
  const cat = byId(CATEGORIES, task.category);
  const energy = byId(ENERGIES, task.energy || 'MEDIUM');
  const rec = byId(RECURRENCES, task.recurrence || 'NONE');
  const subs = task.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const expanded = state.expanded.has(task.id);
  const overdue = !task.isDone && task.deadline && isOverdue(task.deadline);

  // Просрочка перебивает приоритет: красный контур важнее исходной важности
  const glowColor = task.isDone ? null : (overdue ? '#e63c6b' : (prio.glow ? prio.color : null));

  const card = el('div', 'task' + (task.isDone ? ' done' : ''));
  card.dataset.id = task.id;
  card.dataset.group = groupLabelText;
  card.dataset.index = String(index);
  card.style.setProperty('--prio', task.isDone ? 'var(--text-muted)' : prio.color);
  card.style.setProperty('--cat', cat.color);
  card.style.setProperty('--energy', energy.color);
  if (glowColor) {
    card.style.setProperty('--glow', glowColor);
    card.classList.add('glowing');
    if (overdue) card.classList.add('overdue');
  }

  const main = el('div', 'task-main');
  // Зона нажатия — только чек-бокс и текст. Ручка живёт снаружи, иначе
  // долгое нажатие на неё уходит в фокус-таймер вместо перетаскивания
  const tap = el('div', 'task-tap');

  const check = el('button', 'check');
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(!!task.isDone));
  check.setAttribute('aria-label', task.isDone ? 'Вернуть в активные' : 'Отметить выполненной');
  check.innerHTML = icon(ICONS.check, 14, 3);
  check.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(task.id); });
  tap.appendChild(check);

  const body = el('div', 'task-body');
  body.appendChild(el('p', 'task-title', task.title));

  const meta = el('div', 'task-meta');
  meta.innerHTML = `<span class="meta-item prio tappable" data-act="prio">${icon(ICONS.flag)}${escapeHtml(prio.label)}</span>`;
  if (task.deadline) {
    // Тап по сроку откладывает задачу: свайпы заняты (выполнить и удалить),
    // долгое нажатие — фокус-таймер
    const tappable = task.isDone ? '' : ' tappable" data-act="snooze';
    meta.innerHTML += `<span class="meta-item${overdue ? ' overdue' : ''}${tappable}">${icon(ICONS.clock)}` +
      (overdue ? 'Просрочено · ' : '') + fmtTime(task.deadline) + '</span>';
  }
  if (rec.id !== 'NONE') {
    meta.innerHTML += `<span class="meta-item repeat">${icon(ICONS.repeat)}${escapeHtml(describeRecurrence(task))}</span>`;
  }
  body.appendChild(meta);

  // Категорий может быть несколько — на карточке места хватает на все
  const tags = el('div', 'task-meta');
  tags.innerHTML = categoriesOf(task).map((id) => {
    const c = byId(CATEGORIES, id);
    return `<span class="cat-tag" style="--cat:${c.color}">${escapeHtml(c.label)}</span>`;
  }).join('') +
    `<span class="energy-tag tappable" data-act="energy">${icon(ICONS.bolt, 11)}${escapeHtml(energy.short)}</span>`;
  if (subs.length) {
    const pct = Math.round((doneSubs / subs.length) * 100);
    tags.innerHTML += `<span class="subtask-progress">
      <span class="progress-track"><span class="progress-fill" style="width:${pct}%"></span></span>
      ${doneSubs}/${subs.length}</span>`;
  }
  body.appendChild(tags);
  tap.appendChild(body);
  main.appendChild(tap);

  const actions = el('div', 'task-actions');

  const handle = el('button', 'icon-btn drag-handle');
  handle.setAttribute('aria-label', 'Перетащить задачу');
  handle.innerHTML = icon(ICONS.drag, 18, 2);
  attachDrag(handle, card, task.id, groupLabelText, index, groupSize);
  actions.appendChild(handle);

  if (subs.length) {
    const expand = el('button', 'icon-btn');
    expand.setAttribute('aria-label', expanded ? 'Свернуть' : 'Показать подзадачи');
    expand.setAttribute('aria-expanded', String(expanded));
    expand.innerHTML = icon(expanded ? ICONS.up : ICONS.down, 18, 2);
    expand.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expanded) state.expanded.delete(task.id); else state.expanded.add(task.id);
      render();
    });
    actions.appendChild(expand);
  }
  main.appendChild(actions);

  tap.addEventListener('click', (e) => {
    // Чипы приоритета и сил правятся на месте, остальное открывает форму
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'prio') { e.stopPropagation(); cyclePriority(task.id); return; }
    if (act && act.dataset.act === 'energy') { e.stopPropagation(); cycleEnergy(task.id); return; }
    if (act && act.dataset.act === 'snooze') {
      e.stopPropagation();
      openSnoozeMenu(task.id, act);
      return;
    }
    openSheet(task.id);
  });
  // Долгое нажатие по карточке запускает фокус — как в Android-версии
  attachLongPress(tap, () => openFocus(task.id));

  card.appendChild(main);

  if (subs.length && expanded) {
    const box = el('div', 'subtasks');
    subs.forEach((sub, si) => {
      const row = el('div', 'subtask' + (sub.done ? ' done' : ''));
      const cb = el('button', 'check small');
      cb.setAttribute('role', 'checkbox');
      cb.setAttribute('aria-checked', String(!!sub.done));
      cb.setAttribute('aria-label', sub.title);
      cb.innerHTML = icon(ICONS.check, 11, 3);
      cb.addEventListener('click', (e) => { e.stopPropagation(); toggleSubtask(task.id, si); });
      row.appendChild(cb);
      row.appendChild(el('span', 'title', sub.title));
      box.appendChild(row);
    });
    card.appendChild(box);
  }

  attachSwipe(card, task.id);
  return card;
}

/**
 * Плитка — та же задача с тем же набором данных, только уложенная
 * вертикально. Используется и в сетке, и на доске.
 * dragCtx задаётся только на доске: { categoryId, index, size }.
 */
function renderTaskTile(task, dragCtx) {
  const prio = byId(PRIORITIES, task.priority);
  const cat = byId(CATEGORIES, task.category);
  const energy = byId(ENERGIES, task.energy || 'MEDIUM');
  const rec = byId(RECURRENCES, task.recurrence || 'NONE');
  const subs = task.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const overdue = !task.isDone && task.deadline && isOverdue(task.deadline);
  const glowColor = task.isDone ? null : (overdue ? '#e63c6b' : (prio.glow ? prio.color : null));

  const cats = categoriesOf(task);
  const tile = el('div', 'tile' + (task.isDone ? ' done' : ''));
  tile.dataset.id = task.id;
  tile.style.setProperty('--prio', task.isDone ? 'var(--text-muted)' : prio.color);
  tile.style.setProperty('--cat', cat.color);
  tile.style.setProperty('--energy', energy.color);
  if (glowColor) {
    tile.style.setProperty('--glow', glowColor);
    tile.classList.add('glowing');
    if (overdue) tile.classList.add('overdue');
  }

  const tap = el('div', 'tile-tap');
  tap.appendChild(el('p', 'tile-title', task.title));

  const meta = el('div', 'tile-meta');
  meta.innerHTML = `<span class="meta-item prio">${icon(ICONS.flag, 12)}${escapeHtml(prio.label)}</span>`;
  if (rec.id !== 'NONE') {
    meta.innerHTML += `<span class="meta-item repeat">${icon(ICONS.repeat, 12)}${escapeHtml(describeRecurrence(task))}</span>`;
  }
  tap.appendChild(meta);

  if (task.deadline) {
    const when = el('div', 'tile-meta');
    when.innerHTML = `<span class="meta-item${overdue ? ' overdue' : ''}">${icon(ICONS.clock, 12)}` +
      (overdue ? 'Просрочено · ' : '') + fmtTime(task.deadline) + '</span>';
    tap.appendChild(when);
  }

  // На узкой плитке показываем основную, остальные сворачиваем в «+N»
  const shown = cats.slice(0, cats.length > 2 ? 1 : 2);
  const hidden = cats.length - shown.length;
  const tags = el('div', 'tile-meta');
  tags.innerHTML = shown.map((id) => {
    const c = byId(CATEGORIES, id);
    return `<span class="cat-tag" style="--cat:${c.color}">${escapeHtml(c.label)}</span>`;
  }).join('') +
    (hidden > 0 ? `<span class="cat-more">+${hidden}</span>` : '') +
    `<span class="energy-tag">${icon(ICONS.bolt, 11)}${escapeHtml(energy.short)}</span>`;
  if (subs.length) {
    const pct = Math.round((doneSubs / subs.length) * 100);
    tags.innerHTML += `<span class="subtask-progress">
      <span class="progress-track"><span class="progress-fill" style="width:${pct}%"></span></span>
      ${doneSubs}/${subs.length}</span>`;
  }
  tap.appendChild(tags);

  tap.addEventListener('click', () => openSheet(task.id));
  attachLongPress(tap, () => openFocus(task.id));
  tile.appendChild(tap);

  const foot = el('div', 'tile-foot');
  const check = el('button', 'check small');
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(!!task.isDone));
  check.setAttribute('aria-label', task.isDone ? 'Вернуть в активные' : 'Отметить выполненной');
  check.innerHTML = icon(ICONS.check, 11, 3);
  check.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(task.id); });
  foot.appendChild(check);

  if (dragCtx) {
    const handle = el('button', 'icon-btn drag-handle');
    handle.setAttribute('aria-label', 'Переставить плитку');
    handle.innerHTML = icon(ICONS.drag, 17, 2);
    // На доске плитка ходит только внутри своей колонки, в сетке — в обе стороны
    if (dragCtx.columnKey) attachTileDrag(handle, tile, dragCtx);
    else attachGridTileDrag(handle, tile, dragCtx);
    foot.appendChild(handle);
  }
  tile.appendChild(foot);

  return tile;
}

/**
 * Разбор меток прямо в тексте задачи — чтобы не лезть в форму ради категории:
 * «#работа !важно Позвонить подрядчику».
 *
 * Нераспознанная метка остаётся в тексте как есть, а не проглатывается молча.
 */
const TAG_CATEGORIES = {
  'входящие': 'INBOX', 'inbox': 'INBOX',
  'работа': 'WORK', 'работу': 'WORK', 'work': 'WORK',
  'личное': 'PERSONAL', 'дом': 'PERSONAL',
  'учёба': 'STUDY', 'учеба': 'STUDY',
  'здоровье': 'HEALTH', 'спорт': 'HEALTH',
  'финансы': 'FINANCE', 'деньги': 'FINANCE',
  'другое': 'OTHER', 'прочее': 'OTHER'
};

const TAG_PRIORITIES = {
  'важно': 'HIGH', 'срочно': 'HIGH', 'высокий': 'HIGH',
  'средне': 'MEDIUM', 'средний': 'MEDIUM',
  'низкий': 'LOW', 'потом': 'LOW', 'неважно': 'LOW'
};

const TAG_ENERGIES = {
  'тяжёлая': 'HIGH', 'тяжелая': 'HIGH', 'сложно': 'HIGH',
  'обычная': 'MEDIUM', 'лёгкая': 'LOW', 'легкая': 'LOW', 'просто': 'LOW'
};

function parseTags(input) {
  if (!input || !input.trim()) return { cleanTitle: (input || '').trim(), categories: [] };

  const categories = [];
  let priority = null;
  let energy = null;
  const kept = [];

  input.split(' ').forEach((raw) => {
    const word = raw.trim();
    if (!word) return;
    const body = word.slice(1).toLowerCase().replace(/[,.;:]+$/, '');
    let matched = false;

    if (word[0] === '#' && TAG_CATEGORIES[body]) { categories.push(TAG_CATEGORIES[body]); matched = true; }
    else if (word[0] === '!' && TAG_PRIORITIES[body]) { priority = TAG_PRIORITIES[body]; matched = true; }
    else if (word[0] === '~' && TAG_ENERGIES[body]) { energy = TAG_ENERGIES[body]; matched = true; }

    if (!matched) kept.push(word);
  });

  return {
    cleanTitle: kept.join(' ').trim(),
    categories: categories.filter((c, i) => categories.indexOf(c) === i),
    priority,
    energy
  };
}

/* ------------------------------------------- быстрые правки с карточки */

/** Перебор приоритета тапом по чипу — без открытия формы. */
function cyclePriority(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const order = ['HIGH', 'MEDIUM', 'LOW'];
  const index = order.indexOf(task.priority);
  task.priority = order[(index + 1) % order.length];
  saveTasks();
  render();
}

function cycleEnergy(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const order = ['HIGH', 'MEDIUM', 'LOW'];
  const index = order.indexOf(task.energy || 'MEDIUM');
  task.energy = order[(index + 1) % order.length];
  saveTasks();
  render();
}

/* ---------------------------------------------------------------- отложить */

/**
 * Насколько откладывать задачу. Три варианта — больше в меню на карточке
 * не нужно: точную дату всё равно удобнее выставить в форме.
 */
const SNOOZE_OPTIONS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 3 дня', days: 3 },
  { label: 'Через неделю', days: 7 }
];

/** Отложить на день: типовая операция, ради которой не хочется открывать форму. */
function snoozeTask(taskId, days) {
  const task = findTask(taskId);
  if (!task) return;

  const base = task.deadline || startOfDay(Date.now());
  const shifted = base + days * DAY;
  // Напоминание едет вместе со сроком, сохраняя свой отступ
  if (task.deadline && task.reminderAt) {
    task.reminderAt = shifted - (task.deadline - task.reminderAt);
  }
  task.deadline = shifted;
  state.notifiedIds.delete(task.id);

  saveTasks();
  render();
  showToast(`Отложено · ${fmtDayMonth(shifted)}`);
}

let snoozeMenuEl = null;

function closeSnoozeMenu() {
  if (!snoozeMenuEl) return;
  snoozeMenuEl.remove();
  snoozeMenuEl = null;
}

function openSnoozeMenu(taskId, anchor) {
  closeSnoozeMenu();

  const layer = el('div', 'menu-layer');
  const menu = el('div', 'popup-menu');

  SNOOZE_OPTIONS.forEach((option) => {
    const item = el('button', 'popup-item', option.label);
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSnoozeMenu();
      snoozeTask(taskId, option.days);
    });
    menu.appendChild(item);
  });

  layer.addEventListener('click', closeSnoozeMenu);
  layer.appendChild(menu);
  document.body.appendChild(layer);
  snoozeMenuEl = layer;

  // Раскрываем от чипа: вниз, если снизу есть место, иначе вверх
  const rect = anchor.getBoundingClientRect();
  const height = menu.offsetHeight || 130;
  const below = window.innerHeight - rect.bottom;
  menu.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 10)) + 'px';
  menu.style.top = (below > height + 16 ? rect.bottom + 6 : rect.top - height - 6) + 'px';
}

/* ------------------------------------------------------- сохранённые виды */

/** Сохранённый вид: фильтр, поиск и раскладка одной вкладкой. */
function saveCurrentView(name) {
  state.views.push({
    id: 'v' + Date.now(),
    name: (name || '').trim() || 'Без названия',
    filter: JSON.parse(JSON.stringify(state.filter)),
    query: state.query,
    viewMode: state.settings.viewMode,
    boardGroupBy: state.settings.boardGroupBy,
    boardSwimlaneBy: state.settings.boardSwimlaneBy || 'NONE'
  });
  saveViews();
}

function applySavedView(view) {
  state.filter = JSON.parse(JSON.stringify(view.filter));
  state.query = view.query || '';
  state.settings.viewMode = view.viewMode || 'LIST';
  state.settings.boardGroupBy = view.boardGroupBy || 'CATEGORY';
  saveSettings();
  render();
}

function deleteSavedView(id) {
  state.views = state.views.filter((v) => v.id !== id);
  saveViews();
  render();
}

/** Ряд вкладок под фильтрами. Долгое нажатие удаляет вкладку. */
function renderSavedViews() {
  const row = el('div', 'chip-row views-row');

  state.views.forEach((view) => {
    const btn = chip(view.name, false, () => applySavedView(view));
    attachLongPress(btn, () => {
      if (confirm('Удалить вид «' + view.name + '»?')) deleteSavedView(view.id);
    });
    row.appendChild(btn);
  });

  row.appendChild(chip(state.views.length ? '+' : 'Сохранить вид', false, () => {
    const name = prompt('Название вида');
    if (name === null) return;
    saveCurrentView(name);
    render();
  }));

  return row;
}

/* ---------------------------------------------------------------- iOS */

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ выдаёт себя за Mac, отличаем по тач-экрану
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

/** Safari на iOS не умеет navigator.vibrate — вызываем только там, где сработает. */
function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

/**
 * Подсказка про установку. В Safari объясняем, как добавить на домашний экран;
 * в стороннем браузере на iOS предупреждаем, что установка там невозможна.
 * В standalone-режиме не показываем вообще.
 */
function renderIosHint() {
  if (!isIOS() || isStandalone()) return null;
  if (readJson('nix.hint.install', false) === true) return null;

  // Chrome и Firefox на iOS — те же WebKit внутри, но «На экран Домой» у них нет
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

  const box = el('div', 'ios-hint' + (otherBrowser ? ' warn' : ''));
  const close = el('button', 'close', '✕');
  close.setAttribute('aria-label', 'Скрыть подсказку');
  close.addEventListener('click', () => {
    writeJson('nix.hint.install', true);
    render();
  });
  box.appendChild(close);

  const text = el('span');
  text.innerHTML = otherBrowser
    ? 'Этот браузер не умеет ставить приложение на экран. Откройте страницу ' +
      'в <b>Safari</b> → «Поделиться» → <b>«На экран "Домой"»</b>.'
    : 'Чтобы Nix работал как приложение и офлайн: «Поделиться» → ' +
      '<b>«На экран "Домой"»</b>. Уведомления на iOS приходят только после этого.';
  box.appendChild(text);

  return box;
}

/* ---------------------------------------------------------------- жесты */

function attachLongPress(node, handler) {
  let timer = null;
  const start = () => { timer = setTimeout(handler, 550); };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchend', cancel, { passive: true });
  node.addEventListener('touchmove', cancel, { passive: true });
  node.addEventListener('touchcancel', cancel, { passive: true });
}

function attachSwipe(card, taskId) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, swiped = false;

  card.addEventListener('click', (e) => {
    if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, true);

  card.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || state.dragId) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dragging = true; decided = false;
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const x = e.touches[0].clientX - startX;
    const y = e.touches[0].clientY - startY;
    if (!decided) {
      if (Math.abs(y) > Math.abs(x)) { dragging = false; return; }
      decided = true;
    }
    dx = x;
    if (Math.abs(dx) > 6) swiped = true;
    card.style.transform = `translateX(${dx}px)`;
    card.style.background = dx > 0
      ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))'
      : (dx < 0 ? 'color-mix(in srgb, var(--danger) 14%, var(--surface))' : '');
  }, { passive: true });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = 'transform 0.2s ease, background 0.2s ease';
    card.style.background = '';
    const threshold = Math.min(120, card.offsetWidth * 0.35);

    if (dx > threshold) { card.style.transform = ''; toggleDone(taskId); }
    else if (dx < -threshold) {
      card.style.transform = 'translateX(-100%)';
      setTimeout(() => deleteTask(taskId), 160);
    } else card.style.transform = '';

    dx = 0;
    setTimeout(() => { swiped = false; }, 350);
  };

  card.addEventListener('touchend', finish, { passive: true });
  card.addEventListener('touchcancel', finish, { passive: true });
}

/* Перетаскивание — только за ручку, чтобы не конфликтовать со свайпом */
function attachDrag(handle, card, taskId, groupLabelText, index, groupSize) {
  let startY = 0, offset = 0, target = index, active = false;

  const begin = (clientY) => {
    active = true;
    startY = clientY;
    offset = 0;
    target = index;
    state.dragId = taskId;
    card.classList.add('dragging');
    haptic();
  };

  const move = (clientY) => {
    if (!active) return;
    offset = clientY - startY;
    card.style.transform = `translateY(${offset}px)`;
    const step = Math.round(offset / (card.offsetHeight + 10));
    target = Math.max(0, Math.min(groupSize - 1, index + step));
  };

  const end = () => {
    if (!active) return;
    active = false;
    card.classList.remove('dragging');
    card.style.transform = '';
    state.dragId = null;
    if (target !== index) reorderWithinGroup(groupLabelText, index, target);
    else render();
  };

  handle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    begin(e.touches[0].clientY);
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!active) return;
    e.preventDefault();
    move(e.touches[0].clientY);
  }, { passive: false });

  handle.addEventListener('touchend', end, { passive: true });
  handle.addEventListener('touchcancel', end, { passive: true });

  // Мышь — чтобы порядок можно было менять и на компьютере
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    begin(e.clientY);
    const onMove = (ev) => move(ev.clientY);
    const onUp = () => {
      end();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
/**
 * Плитка на доске: вверх-вниз меняет порядок внутри колонки, вбок — переносит
 * в соседнюю колонку и меняет само поле задачи.
 */
function attachTileDrag(handle, tile, ctx) {
  let startX = 0, startY = 0, dx = 0, dy = 0, target = ctx.index, active = false;

  const begin = (clientX, clientY) => {
    active = true;
    startX = clientX;
    startY = clientY;
    dx = 0;
    dy = 0;
    target = ctx.index;
    state.dragId = tile.dataset.id;
    tile.classList.add('dragging');
    haptic();
  };

  const move = (clientX, clientY) => {
    if (!active) return;
    dx = clientX - startX;
    dy = clientY - startY;
    tile.style.transform = `translate(${dx}px, ${dy}px)`;
    const step = Math.round(dy / (tile.offsetHeight + 12));
    target = Math.max(0, Math.min(ctx.size - 1, ctx.index + step));
  };

  const end = () => {
    if (!active) return;
    active = false;
    tile.classList.remove('dragging');
    tile.style.transform = '';
    state.dragId = null;

    // Вбок дальше половины колонки — это перенос, всё остальное перестановка
    const column = tile.closest('.board-column');
    const columnStep = column ? column.offsetWidth + 12 : 0;
    const shift = columnStep ? Math.round(dx / columnStep) : 0;
    const siblings = ctx.siblings || [];
    const targetColumn = (ctx.columnIndex || 0) + shift;

    if (shift !== 0 && targetColumn >= 0 && targetColumn < siblings.length) {
      const landing = Math.max(0, Math.round(dy / (tile.offsetHeight + 12)));
      moveToColumn(tile.dataset.id, siblings[targetColumn], landing);
    } else if (target !== ctx.index) {
      reorderWithinColumn(ctx.columnKey, ctx.index, target);
    } else {
      render();
    }
  };

  handle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    begin(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!active) return;
    e.preventDefault();
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  handle.addEventListener('touchend', end, { passive: true });
  handle.addEventListener('touchcancel', end, { passive: true });

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    begin(e.clientX, e.clientY);
    const onMove = (ev) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      end();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/**
 * Плитка в сетке тянется в обе стороны: вправо — соседняя плитка,
 * вниз — целый ряд. Порядок пишется общий со списком (manualOrder),
 * поэтому переставленное в плитках видно и в списке.
 */
function attachGridTileDrag(handle, tile, ctx) {
  let startX = 0, startY = 0, target = ctx.index, active = false;

  // Сколько колонок в сетке сейчас — CSS раскладывает их по ширине экрана
  const columnCount = () => {
    const grid = tile.parentElement;
    if (!grid) return 1;
    const template = getComputedStyle(grid).gridTemplateColumns;
    const count = template ? template.split(' ').filter(Boolean).length : 1;
    return Math.max(1, count);
  };

  const begin = (clientX, clientY) => {
    active = true;
    startX = clientX;
    startY = clientY;
    target = ctx.index;
    state.dragId = tile.dataset.id;
    tile.classList.add('dragging');
    haptic();
  };

  const move = (clientX, clientY) => {
    if (!active) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    tile.style.transform = `translate(${dx}px, ${dy}px)`;

    const columns = columnCount();
    const stepX = Math.round(dx / (tile.offsetWidth + 10));
    const stepY = Math.round(dy / (tile.offsetHeight + 10));
    target = Math.max(0, Math.min(ctx.size - 1, ctx.index + stepY * columns + stepX));
  };

  const end = () => {
    if (!active) return;
    active = false;
    tile.classList.remove('dragging');
    tile.style.transform = '';
    state.dragId = null;
    if (target !== ctx.index) reorderWithinGroup(ctx.groupLabel, ctx.index, target);
    else render();
  };

  handle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    begin(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!active) return;
    e.preventDefault();
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  handle.addEventListener('touchend', end, { passive: true });
  handle.addEventListener('touchcancel', end, { passive: true });

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    begin(e.clientX, e.clientY);
    const onMove = (ev) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      end();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* Nix PWA — действия над задачами и отрисовка экранов. */

/* ---------------------------------------------------------------- действия */

const findTask = (id) => state.tasks.find((t) => t.id === id);

function toggleDone(id) {
  const task = findTask(id);
  if (!task) return;

  if (task.isDone) {
    task.isDone = false;
    task.completedAt = null;
    saveTasks();
    render();
    return;
  }

  task.isDone = true;
  task.completedAt = Date.now();

  // Повтор: закрываем текущую копию и сразу создаём следующую
  if (task.recurrence && task.recurrence !== 'NONE' && task.deadline) {
    const next = nextOccurrence(task.deadline, task.recurrence, Date.now(), task.weekdayMask);
    if (next) {
      const offset = task.reminderAt ? task.deadline - task.reminderAt : null;
      const newId = makeId();
      state.tasks.push({
        id: newId,
        title: task.title,
        deadline: next,
        reminderAt: offset === null ? null : next - offset,
        priority: task.priority,
        category: task.category,
        // Категории переносим целиком, иначе повтор задачи с двумя категориями
        // терял бы все, кроме основной
        categories: categoriesOf(task).slice(1),
        projectId: task.projectId || null,
        recurrence: task.recurrence,
        weekdayMask: task.weekdayMask || 0,
        categories: categoriesOf(task),
        weekdayMask: task.weekdayMask || 0,
        energy: task.energy || 'MEDIUM',
        isDone: false,
        completedAt: null,
        createdAt: Date.now(),
        manualOrder: null,
        boardPositions: {},
        deletedAt: null,
        subtasks: (task.subtasks || []).map((s) => ({ title: s.title, done: false }))
      });
      // Время фокуса — метрика усилий над задачей, переносим на новую копию
      state.sessions.forEach((s) => { if (s.taskId === task.id) s.taskId = newId; });
      saveSessions();
    }
  }

  saveTasks();
  render();
}

function toggleSubtask(taskId, index) {
  const task = findTask(taskId);
  if (!task || !task.subtasks || !task.subtasks[index]) return;
  task.subtasks[index].done = !task.subtasks[index].done;
  saveTasks();
  render();
}

/* Удаление — в корзину, стирается через TRASH_RETENTION_DAYS дней */
function deleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  task.deletedAt = Date.now();
  state.expanded.delete(id);
  saveTasks();
  render();

  showToast('Задача в корзине', 'Вернуть', () => {
    const restored = findTask(id);
    if (restored) { restored.deletedAt = null; saveTasks(); render(); }
  });
}

function purgeExpiredTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * DAY;
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => !t.deletedAt || t.deletedAt >= cutoff);
  if (state.tasks.length !== before) saveTasks();
}

function reorderWithinGroup(groupLabelText, fromIndex, toIndex) {
  const groups = groupTasks(visibleTasks());
  const group = groups.find((g) => g.label === groupLabelText);
  if (!group || fromIndex === toIndex) { render(); return; }

  const list = group.tasks.slice();
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);

  // Пишем позиции всем в группе: иначе нетронутые всплывают наверх
  list.forEach((task, index) => {
    const real = findTask(task.id);
    if (real) real.manualOrder = index;
  });

  saveTasks();
  render();
}

function reorderWithinColumn(columnKey, fromIndex, toIndex) {
  const column = boardLanes()
    .reduce((all, lane) => all.concat(lane.columns), [])
    .find((c) => c.key === columnKey);
  if (!column || fromIndex === toIndex) { render(); return; }

  const list = column.tasks.slice();
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);

  // Пишем позиции всем в колонке под её ключом: поле задачи не меняется,
  // и раскладка соседних досок остаётся нетронутой
  list.forEach((task, index) => {
    const real = findTask(task.id);
    if (!real) return;
    if (!real.boardPositions) real.boardPositions = {};
    real.boardPositions[columnKey] = index;
  });

  saveTasks();
  render();
}

/**
 * Перенос плитки в соседнюю колонку — в отличие от перестановки, здесь
 * меняется само поле задачи: та ось, по которой разложена доска.
 *
 * Для категорий задача не теряет остальные: новая колонка становится
 * основной категорией, прежняя основная остаётся в наборе. Иначе задача,
 * которую видно сразу в нескольких колонках, молча пропала бы из части
 * из них — а множественные категории заводились ровно ради обратного.
 *
 * Свимлейн при переносе не трогаем: его ось — вторая.
 */
function moveToColumn(taskId, targetCellKey, toIndex) {
  const task = findTask(taskId);
  if (!task) return;

  const groupBy = state.settings.boardGroupBy || 'CATEGORY';
  const columnKey = boardKey.columnOf(targetCellKey);
  const value = columnKey.slice(columnKey.indexOf(':') + 1);

  if (groupBy === 'PRIORITY') {
    if (!PRIORITIES.some((p) => p.id === value)) return;
    task.priority = value;
  } else if (groupBy === 'ENERGY') {
    if (!ENERGIES.some((e) => e.id === value)) return;
    task.energy = value;
  } else if (groupBy === 'PROJECT') {
    task.projectId = value === 'NONE' ? null : value;
  } else {
    if (!CATEGORIES.some((c) => c.id === value)) return;
    const rest = categoriesOf(task).filter((c) => c !== value);
    task.category = value;
    task.categories = rest;
  }

  // Позицию в новой ячейке выставляем сразу, иначе плитка улетит в конец:
  // у непереставленных позиции нет вовсе
  const column = boardLanes()
    .reduce((all, lane) => all.concat(lane.columns), [])
    .find((c) => c.key === targetCellKey);
  const neighbours = column ? column.tasks.filter((t) => t.id !== task.id) : [];
  const landing = Math.max(0, Math.min(toIndex, neighbours.length));
  neighbours.splice(landing, 0, task);

  neighbours.forEach((item, index) => {
    const real = findTask(item.id);
    if (!real) return;
    if (!real.boardPositions) real.boardPositions = {};
    real.boardPositions[targetCellKey] = index;
  });

  saveTasks();
  render();
}

/** Сброс раскладки одной оси — остальные доски и список не меняются. */
function clearBoardOrder(groupBy) {
  const prefix = (groupBy || state.settings.boardGroupBy || 'CATEGORY') + ':';
  state.tasks.forEach((t) => {
    if (!t.boardPositions) return;
    Object.keys(t.boardPositions).forEach((key) => {
      if (key.indexOf(prefix) === 0) delete t.boardPositions[key];
    });
  });
  saveTasks();
}

function clearManualOrder() {
  state.tasks.forEach((t) => { t.manualOrder = null; });
  saveTasks();
}

/* ------------------------------------------------------ проекты и шаблоны */

function addProject(name) {
  const clean = (name || '').trim();
  if (!clean) return;
  state.projects.push({
    id: makeId(),
    name: clean,
    colorHex: null,
    archived: false,
    position: state.projects.length,
    createdAt: Date.now()
  });
  saveProjects();
}

/** Задачи проекта не удаляются — просто выходят из него. */
function deleteProject(projectId) {
  state.projects = state.projects.filter((p) => p.id !== projectId);
  state.tasks.forEach((t) => { if (t.projectId === projectId) t.projectId = null; });
  // Раскладка доски по этому проекту больше не к чему привязана
  state.tasks.forEach((t) => {
    if (t.boardPositions) delete t.boardPositions[boardKey.PROJECT(projectId)];
  });
  saveProjects();
  saveTasks();
}

function saveTemplate(name, category, steps) {
  const clean = (name || '').trim();
  if (!clean || !steps.length) return;
  state.templates.push({
    id: makeId(),
    name: clean,
    category,
    // Проект шаблона в форме не выставляется — как в Android
    projectId: null,
    createdAt: Date.now(),
    steps: steps.map((step, index) => ({
      id: makeId(),
      title: step.title,
      priority: step.priority || 'MEDIUM',
      energy: step.energy || 'MEDIUM',
      dayOffset: step.dayOffset || 0,
      position: index
    }))
  });
  saveTemplates();
}

function deleteTemplate(templateId) {
  state.templates = state.templates.filter((t) => t.id !== templateId);
  saveTemplates();
}

/**
 * Применение шаблона создаёт реальные задачи. Относительные сроки
 * («День 1», «День 3») отсчитываются от начала сегодняшнего дня, а порядок
 * шагов сразу ложится в позиции колонки — цепочка на доске видна с первого раза.
 */
function applyTemplate(templateId) {
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return;

  const dayStart = startOfDay(Date.now());
  const columnKey = boardKey.CATEGORY(template.category);
  const steps = (template.steps || []).slice().sort((a, b) => a.position - b.position);

  steps.forEach((step, index) => {
    state.tasks.push({
      id: makeId(),
      title: step.title,
      deadline: dayStart + step.dayOffset * DAY,
      reminderAt: null,
      priority: step.priority || 'MEDIUM',
      category: template.category,
      categories: [],
      projectId: template.projectId || null,
      recurrence: 'NONE',
      weekdayMask: 0,
      energy: step.energy || 'MEDIUM',
      isDone: false,
      completedAt: null,
      createdAt: Date.now(),
      manualOrder: null,
      boardPositions: { [columnKey]: index },
      deletedAt: null,
      subtasks: []
    });
  });

  saveTasks();
  render();
  showToast(`Создано задач: ${steps.length}`);
}

/* ---------------------------------------------------------------- фокус-таймер */

let focusTicker = null;

function openFocus(taskId) {
  const task = findTask(taskId);
  if (!task) return;

  state.focus = {
    taskId,
    taskTitle: task.title,
    phase: 'WORK',
    active: false,
    paused: false,
    totalSeconds: state.settings.focusWorkMinutes * 60,
    remaining: state.settings.focusWorkMinutes * 60,
    startedAt: 0,
    intervals: 0
  };
  renderFocusSheet();
  openOverlay('focus');
}

function startFocus() {
  if (!state.focus) return;
  state.focus.active = true;
  state.focus.paused = false;
  state.focus.startedAt = Date.now();
  state.settings.focusHintSeen = true;
  saveSettings();
  runFocusTicker();
  renderFocusSheet();
}

function pauseFocus() {
  if (!state.focus) return;
  state.focus.paused = true;
  clearInterval(focusTicker);
  renderFocusSheet();
}

function resumeFocus() {
  if (!state.focus) return;
  state.focus.paused = false;
  runFocusTicker();
  renderFocusSheet();
}

function stopFocus(save = true) {
  if (!state.focus) return;
  clearInterval(focusTicker);

  if (save && state.focus.active && state.focus.phase === 'WORK') {
    const elapsed = Math.floor((state.focus.totalSeconds - state.focus.remaining) / 60);
    if (elapsed >= 1) saveFocusSession(elapsed, false);
  }

  state.focus = null;
  closeOverlay();
  render();
}

function runFocusTicker() {
  clearInterval(focusTicker);
  focusTicker = setInterval(() => {
    const f = state.focus;
    if (!f || !f.active || f.paused) { clearInterval(focusTicker); return; }

    f.remaining -= 1;
    if (f.remaining > 0) { renderFocusSheet(); return; }

    clearInterval(focusTicker);
    if (f.phase === 'WORK') {
      saveFocusSession(Math.round(f.totalSeconds / 60), true);
      notifyFocus('Интервал завершён', f.taskTitle ? f.taskTitle + ' — время передохнуть' : 'Время передохнуть');
      f.phase = 'BREAK';
      f.intervals += 1;
      f.totalSeconds = state.settings.focusBreakMinutes * 60;
      f.remaining = f.totalSeconds;
      f.startedAt = Date.now();
      runFocusTicker();
    } else {
      notifyFocus('Перерыв окончен', 'Можно возвращаться к работе');
      f.phase = 'WORK';
      f.active = false;
      f.totalSeconds = state.settings.focusWorkMinutes * 60;
      f.remaining = f.totalSeconds;
    }
    renderFocusSheet();
    render();
  }, 1000);
}

function saveFocusSession(minutes, completed) {
  if (minutes < 1) return;
  state.sessions.push({
    id: makeId(),
    taskId: state.focus.taskId,
    taskTitle: state.focus.taskTitle,
    startedAt: state.focus.startedAt,
    endedAt: Date.now(),
    minutes,
    completed
  });
  saveSessions();
}

function focusMinutesFor(taskId) {
  return state.sessions.filter((s) => s.taskId === taskId)
    .reduce((sum, s) => sum + s.minutes, 0);
}

function notifyFocus(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const options = { body, icon: 'icons/icon-192.png', tag: 'nix-focus', silent: !state.settings.focusSoundEnabled };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => new Notification(title, options));
    } else new Notification(title, options);
  } catch (e) { /* тихо */ }
}

/* Браузер не может тикать в закрытой вкладке — предупреждаем перед потерей прогресса */
window.addEventListener('beforeunload', (e) => {
  if (state.focus && state.focus.active) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

/* ---------------------------------------------------------------- напоминания */

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    state.settings.notificationsEnabled = true;
    saveSettings();
    return;
  }
  if (Notification.permission === 'denied') return;

  Notification.requestPermission().then((result) => {
    state.settings.notificationsEnabled = result === 'granted';
    saveSettings();
    if (result === 'granted') showToast('Напоминания включены (пока приложение открыто)');
  }).catch(() => {});
}

function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();

  liveTasks().forEach((task) => {
    if (task.isDone || !task.reminderAt) return;
    if (state.notifiedIds.has(task.id)) return;
    if (task.reminderAt > now) return;
    // Не показываем то, что просрочено больше суток назад
    if (now - task.reminderAt > DAY) { state.notifiedIds.add(task.id); return; }

    // Пока идёт фокус по этой задаче, напоминание молчит
    if (state.focus && state.focus.active && state.focus.taskId === task.id) return;

    const cat = byId(CATEGORIES, task.category);
    const body = task.deadline ? cat.label + ' · срок в ' + fmtTime(task.deadline) : cat.label;

    try {
      const options = { body, icon: 'icons/icon-192.png', tag: 'nix-' + task.id };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification(task.title, options))
          .catch(() => new Notification(task.title, options));
      } else new Notification(task.title, options);
    } catch (e) { /* тихо */ }

    state.notifiedIds.add(task.id);
  });
}

/* ---------------------------------------------------------------- toast */

let toastTimer = null;

function showToast(text, actionLabel, onAction) {
  const toast = $('#toast');
  const action = $('#toast-action');
  $('#toast-text').textContent = text;

  if (actionLabel && onAction) {
    action.textContent = actionLabel;
    action.classList.remove('hidden');
    action.onclick = () => { onAction(); hideToast(); };
  } else {
    action.classList.add('hidden');
    action.onclick = null;
  }

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4500);
}

const hideToast = () => $('#toast').classList.remove('show');
/* Nix PWA — отрисовка вкладок, листов и настроек. */

function chip(label, selected, onClick, accent, badge, trailing) {
  const btn = el('button', 'chip', label);
  btn.setAttribute('aria-pressed', String(!!selected));
  if (selected && accent) {
    btn.style.setProperty('--chip-accent', accent);
    btn.style.setProperty('--chip-ink', inkFor(accent));
  }
  if (badge) {
    const b = el('span', 'chip-badge', String(badge));
    btn.appendChild(b);
  }
  if (trailing) {
    const span = el('span', 'chip-trailing');
    span.innerHTML = trailing;
    btn.appendChild(span);
  }
  btn.addEventListener('click', onClick);
  return btn;
}

function progressRing(fraction, label, caption, accent, size = 84) {
  const wrap = el('div', 'ring-wrap');
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));

  wrap.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" class="ring">
      <circle cx="32" cy="32" r="${radius}" fill="none" stroke="var(--border)" stroke-width="6"/>
      <circle cx="32" cy="32" r="${radius}" fill="none" stroke="${accent}" stroke-width="6"
        stroke-linecap="round" stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle" class="ring-label">${escapeHtml(label)}</text>
    </svg>
    <p class="ring-caption">${escapeHtml(caption)}</p>`;
  return wrap;
}

/* ---------------------------------------------------------------- вкладка задач */

function renderTasksTab(container) {
  const header = el('header', 'topbar');
  const stats = calcStats();
  const overdue = liveTasks().filter((t) =>
    !t.isDone && t.deadline && isOverdue(t.deadline)).length;

  const titleBox = el('div');
  titleBox.appendChild(el('h1', null, 'Nix'));
  const subtitle = el('p', 'subtitle' + (overdue ? ' danger' : ''));
  subtitle.textContent = overdue
    ? `Просрочено: ${overdue} · активных: ${stats.totalActive}`
    : (stats.totalActive === 0 && stats.completedToday === 0 ? 'Задач пока нет'
      : stats.totalActive === 0 ? `Всё выполнено · сегодня закрыто ${stats.completedToday}`
      : stats.completedToday > 0
        ? `Активных: ${stats.totalActive} · сегодня закрыто ${stats.completedToday}`
        : `Активных задач: ${stats.totalActive}`);
  titleBox.appendChild(subtitle);
  header.appendChild(titleBox);

  // Одна кнопка перебирает виды по кругу: список → плитки → доска
  const viewBtn = el('button', 'icon-btn');
  const mode = byId(VIEW_MODES, state.settings.viewMode);
  viewBtn.setAttribute('aria-label', `Вид: ${mode.label}. Переключить`);
  viewBtn.innerHTML = icon(VIEW_ICONS[mode.id], 20, 1.9);
  if (mode.id !== 'LIST') viewBtn.classList.add('active');
  viewBtn.addEventListener('click', () => {
    const next = VIEW_MODES[(VIEW_MODES.indexOf(mode) + 1) % VIEW_MODES.length];
    state.settings.viewMode = next.id;
    saveSettings();
    render();
  });
  header.appendChild(viewBtn);

  const searchBtn = el('button', 'icon-btn');
  searchBtn.setAttribute('aria-label', state.searchOpen ? 'Закрыть поиск' : 'Поиск');
  searchBtn.innerHTML = icon(state.searchOpen ? ICONS.close : ICONS.search, 20, 2);
  searchBtn.addEventListener('click', () => {
    state.searchOpen = !state.searchOpen;
    if (!state.searchOpen) state.query = '';
    render();
  });
  header.appendChild(searchBtn);

  const settingsBtn = el('button', 'icon-btn');
  settingsBtn.setAttribute('aria-label', 'Настройки');
  settingsBtn.innerHTML = icon(ICONS.settings, 20, 1.8);
  settingsBtn.addEventListener('click', () => openOverlay('settings'));
  header.appendChild(settingsBtn);

  container.appendChild(header);

  if (state.searchOpen) {
    const wrap = el('div', 'search-wrap');
    const input = el('input', 'text-input');
    input.type = 'search';
    input.placeholder = 'Поиск по задачам';
    input.value = state.query;
    input.addEventListener('input', () => {
      state.query = input.value;
      renderList($('#task-list'));
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
    setTimeout(() => input.focus(), 50);
  } else {
    container.appendChild(renderFilters());
  }

  const hint = renderIosHint();
  if (hint) container.appendChild(hint);

  container.appendChild(renderSavedViews());

  const list = el('section');
  list.id = 'task-list';
  container.appendChild(list);
  renderList(list);
}

function renderFilters() {
  const wrap = el('nav', 'filters');
  const f = state.filter;
  const inboxCount = liveTasks().filter((t) => !t.isDone && categoriesOf(t).includes('INBOX')).length;

  const row1 = el('div', 'filter-row');
  row1.appendChild(chip('Все', f.type === 'ALL', () => { state.filter = { type: 'ALL' }; render(); }));
  row1.appendChild(chip('Сегодня', f.type === 'TODAY', () => { state.filter = { type: 'TODAY' }; render(); }));
  row1.appendChild(chip('Входящие', f.type === 'INBOX',
    () => { state.filter = { type: 'INBOX' }; render(); }, null, inboxCount));
  wrap.appendChild(row1);

  const row2 = el('div', 'filter-row');
  const activeCat = f.type === 'CAT' ? byId(CATEGORIES, f.category) : null;
  row2.appendChild(chip(
    activeCat ? activeCat.label : 'Категория',
    !!activeCat,
    () => { state.categoryOpen = !state.categoryOpen; render(); },
    activeCat ? activeCat.color : null,
    null,
    icon(state.categoryOpen ? ICONS.up : ICONS.down, 13, 2)
  ));
  row2.appendChild(chip('Выполненные', f.type === 'DONE',
    () => { state.filter = { type: 'DONE' }; render(); }));
  wrap.appendChild(row2);

  if (state.categoryOpen) {
    const menu = el('div', 'category-menu');
    if (activeCat) {
      menu.appendChild(categoryRow('Все категории', 'var(--text-muted)', false, () => {
        state.filter = { type: 'ALL' }; state.categoryOpen = false; render();
      }));
    }
    CATEGORIES.forEach((cat) => {
      menu.appendChild(categoryRow(cat.label, cat.color, activeCat && activeCat.id === cat.id, () => {
        state.filter = { type: 'CAT', category: cat.id };
        state.categoryOpen = false;
        render();
      }));
    });
    wrap.appendChild(menu);
  }

  return wrap;
}

function categoryRow(label, color, active, onClick) {
  const row = el('button', 'category-row' + (active ? ' active' : ''));
  row.innerHTML = `<span class="dot" style="background:${color}"></span><span>${escapeHtml(label)}</span>`;
  row.addEventListener('click', onClick);
  return row;
}

function renderList(list) {
  list.innerHTML = '';

  // Доска живёт на своих данных: свои колонки и выполненные внутри
  if (state.settings.viewMode === 'BOARD') {
    list.appendChild(renderBoard());
    return;
  }

  const groups = groupTasks(visibleTasks());

  if (!groups.length) {
    list.appendChild(renderEmpty());
    return;
  }

  const tiles = state.settings.viewMode === 'TILES';

  groups.forEach((group) => {
    const label = el('p', 'group-label' + (group.label === 'Просрочено' ? ' overdue' : ''), group.label);
    list.appendChild(label);

    if (tiles) {
      const grid = el('div', 'tile-grid');
      group.tasks.forEach((task, index) => grid.appendChild(renderTaskTile(task, {
        groupLabel: group.label,
        index,
        size: group.tasks.length
      })));
      list.appendChild(grid);
    } else {
      group.tasks.forEach((task, index) => {
        list.appendChild(renderTaskCard(task, group.label, index, group.tasks.length));
      });
    }
  });
}

function renderBoard() {
  const lanes = boardLanes();
  const swimlanes = lanes.length > 1 || (lanes[0] && lanes[0].label);

  if (!swimlanes) {
    return renderBoardLane(lanes[0] ? lanes[0].columns : []);
  }

  // Пустые полосы прячем — иначе доска растягивается на все значения оси
  const visibleLanes = lanes.filter((l) => l.itemCount > 0);
  const wrap = el('div', 'board-lanes');

  (visibleLanes.length ? visibleLanes : lanes.slice(0, 1)).forEach((lane) => {
    const head = el('div', 'lane-head');
    head.innerHTML = `<span class="dot" style="background:${lane.color || 'var(--accent)'}"></span>` +
      `<span class="lane-title">${escapeHtml(lane.label || '')}</span>` +
      `<span class="board-count">${lane.itemCount}</span>`;
    wrap.appendChild(head);
    wrap.appendChild(renderBoardLane(lane.columns));
  });

  return wrap;
}

/** Одна горизонтальная полоса колонок — и вся доска без свимлейнов, и один свимлейн. */
function renderBoardLane(columns) {
  const filled = columns.filter((c) => c.tasks.length);
  const visible = filled.length ? filled : columns;

  const board = el('div', 'board');

  visible.forEach((column, columnIndex) => {
    const col = el('section', 'board-column');
    col.style.setProperty('--cat', column.color);

    const head = el('div', 'board-head');
    head.innerHTML = `<span class="dot"></span><span class="board-title">${escapeHtml(column.label)}</span>` +
      `<span class="board-count">${column.doneCount
        ? column.tasks.length + ' · готово ' + column.doneCount
        : column.tasks.length}</span>`;
    col.appendChild(head);

    if (!column.tasks.length) {
      col.appendChild(el('p', 'board-empty', 'Пусто'));
    } else {
      const body = el('div', 'board-body');
      column.tasks.forEach((task, index) => {
        // Ниточка между плитками — та самая видимая связь
        if (index > 0) body.appendChild(el('span', 'board-link'));
        body.appendChild(renderTaskTile(task, {
          columnKey: column.key,
          index,
          size: column.tasks.length,
          // Соседние колонки — чтобы плитку можно было утащить вбок
          columnIndex,
          siblings: visible.map((c) => c.key)
        }));
      });
      col.appendChild(body);
    }

    board.appendChild(col);
  });

  return board;
}

function renderEmpty() {
  const f = state.filter;
  let title, subtitle;

  if (state.query.trim()) {
    title = 'Ничего не найдено';
    subtitle = `По запросу «${state.query.trim()}» задач нет.`;
  } else if (f.type === 'TODAY') {
    title = 'На сегодня свободно'; subtitle = 'Задач с дедлайном на сегодня нет.';
  } else if (f.type === 'INBOX') {
    title = 'Входящие пусты'; subtitle = 'Сюда попадают быстро добавленные задачи.';
  } else if (f.type === 'DONE') {
    title = 'Пока ничего не выполнено'; subtitle = 'Здесь появятся закрытые задачи.';
  } else if (f.type === 'CAT') {
    title = `В категории «${byId(CATEGORIES, f.category).label}» пусто`;
    subtitle = 'Добавьте задачу и выберите эту категорию.';
  } else {
    title = 'Задач пока нет';
    subtitle = 'Нажмите «+». Срок можно писать словами: «завтра в 18:00». Долгое нажатие на задачу запускает фокус.';
  }

  const wrap = el('div', 'empty');
  wrap.innerHTML = `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="17" cy="34" r="10" fill="#3ce6b8" opacity="0.25"/>
      <circle cx="17" cy="34" r="5" fill="#3ce6b8"/>
      <rect x="36" y="30" width="66" height="8" rx="4" fill="#3ce6b8" opacity="0.85"/>
      <circle cx="17" cy="60" r="10" fill="#e63c6b" opacity="0.25"/>
      <circle cx="17" cy="60" r="5" fill="#e63c6b"/>
      <rect x="36" y="56" width="50" height="8" rx="4" fill="#e63c6b" opacity="0.85"/>
      <circle cx="17" cy="86" r="10" fill="#5b6478" opacity="0.18"/>
      <circle cx="17" cy="86" r="5" fill="#5b6478" opacity="0.5"/>
      <rect x="36" y="82" width="58" height="8" rx="4" fill="#5b6478" opacity="0.45"/>
    </svg><h2></h2><p></p>`;
  wrap.querySelector('h2').textContent = title;
  wrap.querySelector('p').textContent = subtitle;
  return wrap;
}

/* ---------------------------------------------------------------- календарь */

function renderCalendarTab(container) {
  const head = el('div', 'tab-head');
  const modes = el('div', 'filter-row');
  modes.appendChild(chip('День', state.calendarMode === 'DAY',
    () => { state.calendarMode = 'DAY'; render(); }));
  modes.appendChild(chip('Месяц', state.calendarMode === 'MONTH',
    () => { state.calendarMode = 'MONTH'; render(); }));
  head.appendChild(modes);
  container.appendChild(head);

  if (!state.selectedDay) state.selectedDay = startOfDay(Date.now());

  if (state.calendarMode === 'DAY') renderDayView(container);
  else renderMonthView(container);
}

function renderDayView(container) {
  const day = state.selectedDay;
  const dayEnd = day + DAY;
  const tasks = liveTasks()
    .filter((t) => t.deadline && t.deadline >= day && t.deadline < dayEnd)
    .sort((a, b) => a.deadline - b.deadline);
  const undated = isToday(day)
    ? liveTasks().filter((t) => !t.isDone && !t.deadline)
    : [];

  const nav = el('div', 'period-nav');
  const prev = el('button', 'icon-btn');
  prev.setAttribute('aria-label', 'Предыдущий день');
  prev.innerHTML = icon(ICONS.left, 20, 2);
  prev.addEventListener('click', () => { state.selectedDay -= DAY; render(); });

  const titleBox = el('div', 'period-title');
  const label = groupLabel(day);
  titleBox.appendChild(el('h2', null,
    (label === 'Без срока' || label === 'Просрочено') ? fmtDayMonth(day) : label));
  titleBox.appendChild(el('p', 'muted-small', fmtDayMonth(day)));

  const next = el('button', 'icon-btn');
  next.setAttribute('aria-label', 'Следующий день');
  next.innerHTML = icon(ICONS.right, 20, 2);
  next.addEventListener('click', () => { state.selectedDay += DAY; render(); });

  nav.append(prev, titleBox, next);
  container.appendChild(nav);

  const body = el('div', 'day-body');
  attachDaySwipe(body);

  if (undated.length) {
    body.appendChild(el('p', 'group-label', 'Без времени'));
    undated.forEach((task, i) => body.appendChild(renderTaskCard(task, 'Без времени', i, undated.length)));
  }

  body.appendChild(el('p', 'group-label', 'По времени'));

  if (!tasks.length) {
    body.appendChild(el('p', 'muted-small pad', 'На этот день задач с временем нет'));
  } else {
    const hours = tasks.map((t) => new Date(t.deadline).getHours());
    const from = Math.min(...hours), to = Math.max(...hours);

    for (let hour = from; hour <= to; hour++) {
      const row = el('div', 'hour-row');
      const timeCol = el('div', 'hour-label', String(hour).padStart(2, '0') + ':00');
      const line = el('div', 'hour-line');
      const slot = el('div', 'hour-slot');

      const atHour = tasks.filter((t) => new Date(t.deadline).getHours() === hour);
      atHour.forEach((task, i) => slot.appendChild(renderTaskCard(task, 'По времени', i, atHour.length)));
      if (!atHour.length) slot.appendChild(el('div', 'hour-empty'));

      row.append(timeCol, line, slot);
      body.appendChild(row);
    }
  }

  container.appendChild(body);
}

function attachDaySwipe(node) {
  let startX = 0, total = 0, active = false;
  node.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; total = 0; active = true;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (active) total = e.touches[0].clientX - startX;
  }, { passive: true });
  node.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    if (total > 90) { state.selectedDay -= DAY; render(); }
    else if (total < -90) { state.selectedDay += DAY; render(); }
  }, { passive: true });
}

function renderMonthView(container) {
  const anchor = state.calendarAnchor;
  const grid = monthGrid(anchor);

  const nav = el('div', 'period-nav');
  const prev = el('button', 'icon-btn');
  prev.setAttribute('aria-label', 'Предыдущий месяц');
  prev.innerHTML = icon(ICONS.left, 20, 2);
  prev.addEventListener('click', () => { state.calendarAnchor = addMonths(anchor, -1); render(); });

  const title = el('h2', null, fmtMonthYear(anchor));

  const next = el('button', 'icon-btn');
  next.setAttribute('aria-label', 'Следующий месяц');
  next.innerHTML = icon(ICONS.right, 20, 2);
  next.addEventListener('click', () => { state.calendarAnchor = addMonths(anchor, 1); render(); });

  nav.append(prev, title, next);
  container.appendChild(nav);

  const weekdays = el('div', 'weekdays');
  ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach((d) => weekdays.appendChild(el('span', null, d)));
  container.appendChild(weekdays);

  const byDay = {};
  liveTasks().forEach((t) => {
    if (!t.deadline) return;
    const key = startOfDay(t.deadline);
    (byDay[key] = byDay[key] || []).push(t);
  });

  const gridEl = el('div', 'month-grid');
  grid.forEach((day) => {
    const cell = el('button', 'day-cell');
    if (!isSameMonth(day, anchor)) cell.classList.add('other-month');
    if (isToday(day)) cell.classList.add('today');
    if (day === state.selectedDay) cell.classList.add('selected');

    cell.appendChild(el('span', 'day-num', String(new Date(day).getDate())));

    const pending = (byDay[day] || []).filter((t) => !t.isDone);
    if (pending.length) {
      const dots = el('span', 'day-dots');
      pending.slice(0, 3).forEach((t) => {
        const dot = el('span', 'dot');
        dot.style.background = byId(PRIORITIES, t.priority).color;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => {
      state.selectedDay = day;
      state.calendarMode = 'DAY';
      render();
    });
    gridEl.appendChild(cell);
  });

  container.appendChild(gridEl);
  container.appendChild(el('p', 'muted-small pad', 'Тап по дню открывает его расписание'));
  attachMonthSwipe(gridEl);
}

function attachMonthSwipe(node) {
  let startX = 0, total = 0, active = false;
  node.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; total = 0; active = true;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (active) total = e.touches[0].clientX - startX;
  }, { passive: true });
  node.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    if (total > 90) { state.calendarAnchor = addMonths(state.calendarAnchor, -1); render(); }
    else if (total < -90) { state.calendarAnchor = addMonths(state.calendarAnchor, 1); render(); }
  }, { passive: true });
}

/* ---------------------------------------------------------------- статистика */

function renderStatsTab(container) {
  const stats = calcStats();
  container.appendChild(el('h1', 'screen-title', 'Статистика'));

  const top = el('div', 'stat-row');

  const streakCard = el('div', 'card streak-card');
  streakCard.innerHTML = `
    <div class="stat-head">${icon(ICONS.fire, 13)}<span>Серия</span></div>
    <p class="stat-value ${stats.currentStreak ? 'danger' : 'muted'}">${stats.currentStreak || '—'}</p>
    <p class="muted-small">${stats.currentStreak ? pluralDays(stats.currentStreak) : 'дней подряд'}</p>
    <span class="stat-bg">${icon(ICONS.fire, 52)}</span>`;
  top.appendChild(streakCard);

  const ringCard = el('div', 'card ring-card');
  ringCard.appendChild(progressRing(
    stats.weekRate,
    Math.round(stats.weekRate * 100) + '%',
    stats.weekPlanned ? `${stats.weekDone} из ${stats.weekPlanned} за неделю` : 'Нет задач со сроком',
    'var(--accent)'
  ));
  top.appendChild(ringCard);
  container.appendChild(top);

  const metrics = el('div', 'stat-row');
  metrics.appendChild(metricCard('Сегодня', String(stats.completedToday), 'var(--accent)'));
  metrics.appendChild(metricCard('Фокус сегодня', formatMinutes(stats.focusToday), 'var(--accent)'));
  container.appendChild(metrics);

  const metrics2 = el('div', 'stat-row');
  metrics2.appendChild(metricCard('Закрыто за неделю', String(stats.completedThisWeek), 'var(--text-secondary)'));
  metrics2.appendChild(metricCard('Лучшая серия',
    stats.bestStreak ? stats.bestStreak + ' дн.' : '—', 'var(--text-secondary)'));
  container.appendChild(metrics2);

  container.appendChild(el('p', 'group-label', 'Активность за 13 недель'));

  const modes = el('div', 'filter-row');
  modes.appendChild(chip('Задачи', state.heatmapMode === 'TASKS',
    () => { state.heatmapMode = 'TASKS'; render(); }));
  modes.appendChild(chip('Часы фокуса', state.heatmapMode === 'FOCUS',
    () => { state.heatmapMode = 'FOCUS'; render(); }));
  container.appendChild(modes);

  container.appendChild(renderHeatmap(stats));

  if (Object.keys(stats.byCategory).length) {
    container.appendChild(el('p', 'group-label', 'По категориям'));
    container.appendChild(renderBreakdown(
      Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([id, value]) => {
          const cat = byId(CATEGORIES, id);
          return { label: cat.label, value, color: cat.color };
        }),
      stats.totalCompleted
    ));
  }

  if (Object.keys(stats.byEnergy).length) {
    container.appendChild(el('p', 'group-label', 'По затратам сил'));
    container.appendChild(renderBreakdown(
      ENERGIES.filter((e) => stats.byEnergy[e.id])
        .map((e) => ({ label: e.label, value: stats.byEnergy[e.id], color: e.color })),
      stats.totalCompleted
    ));
  }

  container.appendChild(el('p', 'group-label', 'Всего'));
  const totals = el('div', 'stat-row');
  totals.appendChild(metricCard('Выполнено за всё время', String(stats.totalCompleted), 'var(--accent)'));
  totals.appendChild(metricCard('Всего в фокусе', formatMinutes(stats.focusAll), 'var(--text-secondary)'));
  container.appendChild(totals);

  if (!stats.totalCompleted && !stats.sessionsCount) {
    container.appendChild(el('p', 'muted-small center pad',
      'Отмечайте задачи выполненными и запускайте фокус — здесь появятся серии и карта активности.'));
  }
}

function metricCard(label, value, color) {
  const card = el('div', 'card metric');
  card.innerHTML = `<p class="muted-small">${escapeHtml(label)}</p>
    <p class="stat-value" style="color:${color}">${escapeHtml(value)}</p>`;
  return card;
}

function renderHeatmap(stats) {
  const card = el('div', 'card');
  const values = stats.heatmap.map((d) =>
    state.heatmapMode === 'TASKS' ? d.completedCount : d.focusMinutes);
  const max = Math.max(...values, 0);

  const grid = el('div', 'heatmap');
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const col = el('div', 'heat-col');
    for (let day = 0; day < 7; day++) {
      const idx = week * 7 + day;
      const entry = stats.heatmap[idx];
      const value = values[idx];
      const cell = el('button', 'heat-cell');

      if (value > 0 && max > 0) {
        const intensity = 0.28 + 0.72 * (value / max);
        cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, transparent)`;
      }
      if (isToday(entry.dayStart)) cell.classList.add('today');

      cell.title = fmtDayMonth(entry.dayStart) + ' — ' +
        (state.heatmapMode === 'TASKS' ? value + ' задач' : formatMinutes(value));

      if (value > 0) {
        cell.addEventListener('click', () => {
          state.selectedDay = entry.dayStart;
          state.calendarMode = 'DAY';
          state.tab = 'CALENDAR';
          render();
        });
      }
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
  card.appendChild(grid);

  const legend = el('div', 'heat-legend');
  legend.innerHTML = '<span class="muted-small">меньше</span>' +
    [0, 0.3, 0.6, 1].map((level) =>
      `<span class="heat-cell legend" style="background:${level === 0 ? 'var(--border)' :
        `color-mix(in srgb, var(--accent) ${level * 100}%, transparent)`}"></span>`).join('') +
    '<span class="muted-small">больше</span>';
  card.appendChild(legend);

  return card;
}

function renderBreakdown(entries, total) {
  const card = el('div', 'card');
  entries.forEach((entry) => {
    const fraction = total ? entry.value / total : 0;
    const row = el('div', 'breakdown-row');
    row.innerHTML = `
      <div class="breakdown-head">
        <span>${escapeHtml(entry.label)}</span>
        <span style="color:${entry.color}">${entry.value}</span>
      </div>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width:${fraction * 100}%;background:${entry.color}"></div>
      </div>`;
    card.appendChild(row);
  });
  return card;
}
/* Nix PWA — листы задачи, фокуса, настроек и корзины + точка входа. */

let overlayKind = null;

function openOverlay(kind) {
  overlayKind = kind;
  if (kind === 'settings') renderSettings();

  const scrim = $('#scrim');
  const sheet = $('#sheet');

  scrim.classList.remove('hidden');
  requestAnimationFrame(() => {
    scrim.classList.add('open');
    sheet.classList.add('open');
  });
}

function closeOverlay() {
  const kind = overlayKind;
  overlayKind = null;
  $('#sheet').classList.remove('open');
  $('#scrim').classList.remove('open');
  setTimeout(() => $('#scrim').classList.add('hidden'), 280);

  // Свернуть лист фокуса можно, не убивая идущую сессию
  if (kind !== 'focus') { state.editingId = null; state.draft = null; }
  // Недособранный шаблон не должен всплыть при следующем открытии экрана
  templateDraft = null;
}

/* ---------------------------------------------------------------- лист задачи */

function blankDraft() {
  return {
    title: '',
    deadline: null,
    reminderOffset: null,
    priority: 'MEDIUM',
    category: 'INBOX',
    categories: [],
    projectId: null,
    recurrence: 'NONE',
    weekdayMask: 0,
    energy: 'MEDIUM',
    subtasks: [],
    parsedHint: null
  };
}

function openSheet(taskId) {
  state.editingId = taskId || null;
  state.detailsOpen = !!taskId;

  if (taskId) {
    const task = findTask(taskId);
    if (!task) return;
    state.draft = {
      title: task.title,
      deadline: task.deadline,
      reminderOffset: (task.reminderAt && task.deadline)
        ? Math.round((task.deadline - task.reminderAt) / 60000) : null,
      priority: task.priority,
      category: task.category,
      categories: categoriesOf(task).slice(1),
      projectId: task.projectId || null,
      recurrence: task.recurrence || 'NONE',
      weekdayMask: task.weekdayMask || 0,
      energy: task.energy || 'MEDIUM',
      subtasks: (task.subtasks || []).map((s) => ({ title: s.title, done: !!s.done })),
      parsedHint: null
    };
  } else {
    state.draft = blankDraft();
  }

  renderSheet();
  openOverlay('task');
  if (!taskId) setTimeout(() => { const i = $('#input-title'); if (i) i.focus(); }, 320);
}

function renderSheet() {
  const sheet = $('#sheet-inner');
  sheet.innerHTML = '';
  const d = state.draft;
  if (!d) return;

  const head = el('div', 'sheet-head');
  head.appendChild(el('h2', null, state.editingId ? 'Редактировать' : 'Новая задача'));
  const closeBtn = el('button', 'icon-btn');
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML = icon(ICONS.close, 20, 2);
  closeBtn.addEventListener('click', closeOverlay);
  head.appendChild(closeBtn);
  sheet.appendChild(head);

  // Поле названия с микрофоном
  const titleWrap = el('div', 'input-with-action');
  const input = el('textarea', 'text-input');
  input.id = 'input-title';
  input.rows = 1;
  input.placeholder = 'Что нужно сделать?';
  input.value = d.title;
  input.addEventListener('input', () => {
    d.title = input.value;
    input.classList.remove('error');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';

    if (!state.editingId && !d.deadline) {
      const parsed = parseDate(input.value);
      const newHint = parsed.deadline && parsed.phrase ? fmtFull(parsed.deadline) : null;
      if (newHint !== d.parsedHint) { d.parsedHint = newHint; refreshHint(); }
    }
  });
  titleWrap.appendChild(input);

  if (speechSupported()) {
    const mic = el('button', 'mic-btn');
    mic.setAttribute('aria-label', 'Продиктовать задачу');
    mic.innerHTML = icon(ICONS.mic, 18, 2);
    mic.addEventListener('click', () => startSpeech(input));
    titleWrap.appendChild(mic);
  }
  sheet.appendChild(titleWrap);

  const hint = el('div');
  hint.id = 'parsed-hint';
  sheet.appendChild(hint);
  refreshHint();

  // Дедлайн
  const dateRow = el('div', 'picker-row');
  const dateBtn = el('button', 'picker' + (d.deadline ? ' active' : ''));
  dateBtn.innerHTML = `${icon(ICONS.calendar, 15)}<span>${d.deadline ? fmtFull(d.deadline) : 'Дедлайн'}</span>`;
  const dateInput = el('input');
  dateInput.type = 'datetime-local';
  dateInput.className = 'hidden-input';
  dateInput.addEventListener('change', () => {
    if (dateInput.value) { d.deadline = new Date(dateInput.value).getTime(); renderSheet(); }
  });
  dateBtn.addEventListener('click', () => {
    dateInput.value = toLocalInput(new Date(d.deadline || Date.now()));
    if (typeof dateInput.showPicker === 'function') {
      try { dateInput.showPicker(); } catch (e) { dateInput.click(); }
    } else dateInput.click();
  });
  dateRow.append(dateBtn, dateInput);

  if (d.deadline) {
    const clear = el('button', 'icon-btn bordered');
    clear.setAttribute('aria-label', 'Убрать дедлайн');
    clear.innerHTML = icon(ICONS.close, 16, 2);
    clear.addEventListener('click', () => {
      d.deadline = null; d.reminderOffset = null; d.recurrence = 'NONE'; renderSheet();
    });
    dateRow.appendChild(clear);
  }
  sheet.appendChild(dateRow);

  // Кнопка раскрытия деталей
  const toggle = el('button', 'details-toggle');
  toggle.innerHTML = icon(state.detailsOpen ? ICONS.up : ICONS.down, 16, 2) +
    `<span>${state.detailsOpen ? 'Скрыть детали' : 'Ещё детали'}</span>` +
    (state.detailsOpen ? '' : '<span class="muted-small">приоритет, категория, повтор, подзадачи</span>');
  toggle.addEventListener('click', () => { state.detailsOpen = !state.detailsOpen; renderSheet(); });
  sheet.appendChild(toggle);

  if (state.detailsOpen) {
    sheet.appendChild(fieldLabel(d.deadline ? 'Напомнить до дедлайна' : 'Напомнить (нужен дедлайн)'));
    const reminders = el('div', 'chip-wrap');
    REMINDER_OFFSETS.forEach((opt) => {
      reminders.appendChild(chip(opt.label, d.reminderOffset === opt.minutes, () => {
        if (d.deadline || opt.minutes === null) {
          d.reminderOffset = opt.minutes;
          if (opt.minutes !== null) requestNotificationPermission();
          renderSheet();
        }
      }));
    });
    sheet.appendChild(reminders);

    sheet.appendChild(fieldLabel('Приоритет'));
    const prios = el('div', 'chip-wrap');
    PRIORITIES.forEach((p) => {
      prios.appendChild(chip(p.label, d.priority === p.id,
        () => { d.priority = p.id; renderSheet(); }, p.color));
    });
    sheet.appendChild(prios);

    sheet.appendChild(fieldLabel('Сколько сил требует'));
    const energies = el('div', 'chip-wrap');
    ENERGIES.forEach((e) => {
      energies.appendChild(chip(e.label, d.energy === e.id,
        () => { d.energy = e.id; renderSheet(); }, e.color));
    });
    sheet.appendChild(energies);

    // Категорий может быть несколько. Первая — основная: её показывают там,
    // где место есть только на одну. Снять последнюю нельзя
    sheet.appendChild(fieldLabel('Категории'));
    sheet.appendChild(el('p', 'muted-small pad',
      'Первая выбранная — основная. На доске задача встанет в каждую колонку'));
    const cats = el('div', 'chip-wrap');
    if (!Array.isArray(d.categories)) d.categories = [];
    CATEGORIES.forEach((c) => {
      const isPrimary = d.category === c.id;
      const isOn = isPrimary || d.categories.includes(c.id);
      cats.appendChild(chip(
        isPrimary ? c.label + ' · основная' : c.label,
        isOn,
        () => {
          if (isPrimary) {
            // Тап по основной снимает её, основной становится следующая
            if (d.categories.length) {
              d.category = d.categories.shift();
            }
          } else if (isOn) {
            d.categories = d.categories.filter((x) => x !== c.id);
          } else {
            d.categories.push(c.id);
          }
          renderSheet();
        },
        c.color
      ));
    });
    sheet.appendChild(cats);

    if (state.projects.filter((p) => !p.archived).length) {
      sheet.appendChild(fieldLabel('Проект'));
      const projs = el('div', 'chip-wrap');
      projs.appendChild(chip('Без проекта', !d.projectId,
        () => { d.projectId = null; renderSheet(); }));
      state.projects.filter((p) => !p.archived).forEach((project) => {
        projs.appendChild(chip(project.name, d.projectId === project.id,
          () => { d.projectId = project.id; renderSheet(); }, projectColor(project)));
      });
      sheet.appendChild(projs);
    }

    sheet.appendChild(fieldLabel('Повтор'));
    const recs = el('div', 'chip-wrap');
    RECURRENCES.forEach((r) => {
      recs.appendChild(chip(r.short, d.recurrence === r.id,
        () => { d.recurrence = r.id; renderSheet(); }));
    });
    sheet.appendChild(recs);

    if (d.recurrence === 'WEEKDAYS_CUSTOM') {
      const days = el('div', 'weekday-row');
      WEEKDAYS.forEach((w) => {
        const btn = el('button', 'weekday' + (hasWeekday(d.weekdayMask, w.day) ? ' on' : ''), w.short);
        btn.setAttribute('aria-pressed', String(hasWeekday(d.weekdayMask, w.day)));
        btn.addEventListener('click', () => {
          d.weekdayMask = toggleWeekday(d.weekdayMask, w.day);
          renderSheet();
        });
        days.appendChild(btn);
      });
      sheet.appendChild(days);
      if (weekdayMaskEmpty(d.weekdayMask)) {
        sheet.appendChild(el('p', 'muted-small pad danger',
          'Выберите хотя бы один день — иначе повтор не сработает'));
      }
    }

    if (d.recurrence !== 'NONE' && !d.deadline) {
      sheet.appendChild(el('p', 'muted-small pad',
        'Для повтора нужен дедлайн — следующая задача создаётся от него'));
    }

    sheet.appendChild(fieldLabel('Подзадачи'));
    d.subtasks.forEach((sub, index) => {
      const row = el('div', 'subtask-edit');
      const cb = el('button', 'check small');
      cb.setAttribute('role', 'checkbox');
      cb.setAttribute('aria-checked', String(sub.done));
      cb.innerHTML = icon(ICONS.check, 11, 3);
      cb.addEventListener('click', () => { sub.done = !sub.done; renderSheet(); });

      const title = el('span', 'title' + (sub.done ? ' done' : ''), sub.title);

      const del = el('button', 'icon-btn small');
      del.setAttribute('aria-label', 'Удалить подзадачу');
      del.innerHTML = icon(ICONS.close, 15, 2);
      del.addEventListener('click', () => { d.subtasks.splice(index, 1); renderSheet(); });

      row.append(cb, title, del);
      sheet.appendChild(row);
    });

    const addRow = el('div', 'add-row');
    const subInput = el('input', 'text-input');
    subInput.placeholder = 'Добавить пункт';
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSub(); }
    });
    const addBtn = el('button', 'add-btn');
    addBtn.setAttribute('aria-label', 'Добавить подзадачу');
    addBtn.innerHTML = icon(ICONS.check, 18, 2.4).replace(ICONS.check, '<path d="M12 5v14M5 12h14"/>');
    const addSub = () => {
      const value = subInput.value.trim();
      if (!value) return;
      d.subtasks.push({ title: value, done: false });
      subInput.value = '';
      renderSheet();
    };
    addBtn.addEventListener('click', addSub);
    addRow.append(subInput, addBtn);
    sheet.appendChild(addRow);
  }

  const save = el('button', 'primary-btn', state.editingId ? 'Сохранить' : 'Добавить');
  save.addEventListener('click', saveDraft);
  sheet.appendChild(save);
}

function fieldLabel(text) {
  return el('p', 'field-label', text);
}

function refreshHint() {
  const box = $('#parsed-hint');
  if (!box) return;
  const d = state.draft;
  box.innerHTML = '';
  if (!d || !d.parsedHint || d.deadline) return;

  const btn = el('button', 'parsed-hint');
  btn.innerHTML = icon(ICONS.clock, 14) + `<span>Поставить срок: ${escapeHtml(d.parsedHint)}</span>`;
  btn.addEventListener('click', () => {
    const parsed = parseDate(d.title);
    if (parsed.deadline) {
      d.deadline = parsed.deadline;
      d.title = parsed.title;
      d.parsedHint = null;
      renderSheet();
    }
  });
  box.appendChild(btn);
}

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function saveDraft() {
  const d = state.draft;
  if (!d) return;

  let title = ($('#input-title').value || '').trim();
  let deadline = d.deadline;

  // Если дату не подтвердили вручную — разбираем при сохранении
  if (!deadline && !state.editingId) {
    const parsed = parseDate(title);
    if (parsed.deadline) { deadline = parsed.deadline; title = parsed.title; }
  }

  // Метки в тексте («#работа !важно») разбираем только для новой задачи:
  // при редактировании поля уже выставлены руками и перебивать их нельзя
  if (!state.editingId) {
    const tags = parseTags(title);
    if (tags.cleanTitle) {
      title = tags.cleanTitle;
      if (tags.categories.length) {
        d.category = tags.categories[0];
        d.categories = tags.categories.slice(1);
      }
      if (tags.priority) d.priority = tags.priority;
      if (tags.energy) d.energy = tags.energy;
    }
  }

  if (!title) {
    const input = $('#input-title');
    input.classList.add('error');
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
    return;
  }

  const reminderAt = (d.reminderOffset !== null && deadline)
    ? deadline - d.reminderOffset * 60000 : null;

  if (state.editingId) {
    const task = findTask(state.editingId);
    if (task) {
      Object.assign(task, {
        title, deadline, reminderAt,
        priority: d.priority,
        category: d.category,
        categories: (d.categories || []).filter((c) => c !== d.category),
        projectId: d.projectId || null,
        recurrence: d.recurrence,
        weekdayMask: d.weekdayMask || 0,
        energy: d.energy,
        subtasks: d.subtasks.slice()
      });
      state.notifiedIds.delete(task.id);
    }
  } else {
    state.tasks.push({
      id: makeId(),
      title, deadline, reminderAt,
      priority: d.priority,
      category: d.category,
      categories: (d.categories || []).filter((c) => c !== d.category),
      projectId: d.projectId || null,
      recurrence: d.recurrence,
      weekdayMask: d.weekdayMask || 0,
      energy: d.energy,
      isDone: false,
      completedAt: null,
      createdAt: Date.now(),
      manualOrder: null,
      boardPositions: {},
      deletedAt: null,
      subtasks: d.subtasks.slice()
    });
  }

  saveTasks();
  closeOverlay();
  render();
  if (reminderAt) requestNotificationPermission();
}

/* ---------------------------------------------------------------- голос */

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function startSpeech(input) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;

  const recognition = new Recognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    // Текст попадает в поле — его всегда можно поправить до сохранения
    const current = state.draft.title.trim();
    state.draft.title = current ? current + ' ' + text : text;
    input.value = state.draft.title;

    if (!state.editingId && !state.draft.deadline) {
      const parsed = parseDate(state.draft.title);
      state.draft.parsedHint = parsed.deadline && parsed.phrase ? fmtFull(parsed.deadline) : null;
      refreshHint();
    }
  };

  recognition.onerror = () => showToast('Не удалось распознать речь');
  try { recognition.start(); } catch (e) { showToast('Микрофон недоступен'); }
}

/* ---------------------------------------------------------------- лист фокуса */

function renderFocusSheet() {
  if (overlayKind !== 'focus' && !state.focus) return;
  const sheet = $('#sheet-inner');
  const f = state.focus;
  if (!f) return;

  sheet.innerHTML = '';

  const head = el('div', 'sheet-head');
  head.appendChild(el('h2', null, 'Фокус'));
  const closeBtn = el('button', 'icon-btn');
  closeBtn.setAttribute('aria-label', 'Свернуть');
  closeBtn.innerHTML = icon(ICONS.close, 20, 2);
  closeBtn.addEventListener('click', closeOverlay);
  head.appendChild(closeBtn);
  sheet.appendChild(head);

  sheet.appendChild(el('p', 'muted-small center', f.taskTitle));

  if (!state.settings.focusHintSeen && !f.active) {
    const hint = el('div', 'focus-hint');
    hint.innerHTML = icon(ICONS.timer, 16) +
      `<span>Работаете ${state.settings.focusWorkMinutes} минут без отвлечений, потом ` +
      `${state.settings.focusBreakMinutes} минут отдыха. Пока идёт сессия, напоминание этой ` +
      `задачи не сработает. Вкладку закрывать нельзя — таймер остановится.</span>`;
    sheet.appendChild(hint);
  }

  const progress = f.totalSeconds ? (f.totalSeconds - f.remaining) / f.totalSeconds : 0;
  const clock = String(Math.floor(Math.max(0, f.remaining) / 60)).padStart(2, '0') + ':' +
    String(Math.max(0, f.remaining) % 60).padStart(2, '0');
  const caption = !f.active ? 'Готов к запуску'
    : f.paused ? 'Пауза' : (f.phase === 'WORK' ? 'Работа' : 'Перерыв');

  const ringBox = el('div', 'focus-ring');
  ringBox.appendChild(progressRing(progress, clock, caption,
    f.phase === 'WORK' ? 'var(--accent)' : 'var(--text-secondary)', 168));
  sheet.appendChild(ringBox);

  if (f.intervals > 0) {
    sheet.appendChild(el('p', 'muted-small center', 'Интервалов за сессию: ' + f.intervals));
  }

  const total = focusMinutesFor(f.taskId);
  if (total > 0) {
    sheet.appendChild(el('p', 'muted-small center', 'Всего на задачу: ' + formatMinutes(total)));
  }

  const actions = el('div', 'focus-actions');
  if (!f.active) {
    const start = el('button', 'primary-btn');
    start.innerHTML = icon(ICONS.play, 18, 2) + '<span>Начать</span>';
    start.addEventListener('click', startFocus);
    actions.appendChild(start);
  } else {
    const toggle = el('button', 'primary-btn');
    toggle.innerHTML = icon(f.paused ? ICONS.play : ICONS.pause, 18, 2) +
      `<span>${f.paused ? 'Продолжить' : 'Пауза'}</span>`;
    toggle.addEventListener('click', () => f.paused ? resumeFocus() : pauseFocus());

    const stop = el('button', 'secondary-btn');
    stop.innerHTML = icon(ICONS.stop, 18, 2) + '<span>Завершить</span>';
    stop.addEventListener('click', () => stopFocus(true));

    actions.append(toggle, stop);
  }
  sheet.appendChild(actions);
}
/* Nix PWA — настройки, корзина, импорт/экспорт, запуск приложения. */

function renderSettings() {
  const sheet = $('#sheet-inner');
  sheet.innerHTML = '';

  const head = el('div', 'sheet-head');
  head.appendChild(el('h2', null, 'Настройки'));
  const closeBtn = el('button', 'icon-btn');
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML = icon(ICONS.close, 20, 2);
  closeBtn.addEventListener('click', closeOverlay);
  head.appendChild(closeBtn);
  sheet.appendChild(head);

  sheet.appendChild(group('Оформление', [
    chipsRow('Тема', THEMES, state.settings.theme, (id) => {
      state.settings.theme = id; saveSettings(); applyTheme(); renderSettings();
    }),
    chipsRow('Размер шрифта', FONT_SCALES, state.settings.fontScale, (id) => {
      state.settings.fontScale = id; saveSettings(); applyTheme(); renderSettings();
    })
  ]));

  sheet.appendChild(group('Задачи', [
    chipsRow('Вид задач', VIEW_MODES, state.settings.viewMode, (id) => {
      state.settings.viewMode = id;
      saveSettings();
      renderSettings();
      render();
    }),
    chipsRow('Доска группирует по', BOARD_GROUPS, state.settings.boardGroupBy, (id) => {
      state.settings.boardGroupBy = id;
      // Свимлейн по той же оси резал бы доску сам по себе
      if (state.settings.boardSwimlaneBy === id) state.settings.boardSwimlaneBy = 'NONE';
      saveSettings();
      renderSettings();
      render();
    }),
    chipsRow(
      'Свимлейны доски',
      BOARD_SWIMLANES.filter((s) => s.id !== state.settings.boardGroupBy),
      state.settings.boardSwimlaneBy || 'NONE',
      (id) => {
        state.settings.boardSwimlaneBy = id;
        saveSettings();
        renderSettings();
        render();
      }
    ),
    actionRow(
      'Сбросить раскладку доски',
      'Только для оси «' + byId(BOARD_GROUPS, state.settings.boardGroupBy).label +
        '». Другие доски и список не изменятся',
      () => {
        clearBoardOrder();
        render();
        showToast('Раскладка доски сброшена');
      }
    ),
    chipsRow('Сортировка по умолчанию', SORT_MODES, state.settings.sortMode, (id) => {
      // Явная смена сортировки сбрасывает ручной порядок
      clearManualOrder();
      state.settings.sortMode = id;
      saveSettings();
      renderSettings();
    }),
    chipsRow(
      'Напоминание по умолчанию',
      REMINDER_OFFSETS.filter((o) => o.minutes !== null)
        .map((o) => ({ id: String(o.minutes), label: o.label })),
      String(state.settings.reminderMinutes),
      (id) => { state.settings.reminderMinutes = Number(id); saveSettings(); renderSettings(); }
    )
  ]));

  sheet.appendChild(group('Фокус-таймер', [
    chipsRow(
      'Длительность работы',
      FOCUS_WORK_OPTIONS.map((m) => ({ id: String(m), label: m >= 60 ? '1 час' : m + ' мин' })),
      String(state.settings.focusWorkMinutes),
      (id) => { state.settings.focusWorkMinutes = Number(id); saveSettings(); renderSettings(); }
    ),
    chipsRow(
      'Длительность перерыва',
      FOCUS_BREAK_OPTIONS.map((m) => ({ id: String(m), label: m + ' мин' })),
      String(state.settings.focusBreakMinutes),
      (id) => { state.settings.focusBreakMinutes = Number(id); saveSettings(); renderSettings(); }
    ),
    switchRow('Звук окончания интервала', state.settings.focusSoundEnabled, (value) => {
      state.settings.focusSoundEnabled = value; saveSettings(); renderSettings();
    })
  ]));

  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permHint =
    permission === 'granted' ? 'Работают, пока приложение открыто или свёрнуто в фон' :
    permission === 'denied' ? 'Заблокированы в настройках браузера' :
    permission === 'unsupported' ? 'Браузер не поддерживает уведомления' :
    'Нажмите, чтобы разрешить';

  const notifRow = el('div', 'settings-row');
  const notifInner = el('div', 'switch-row');
  const labels = el('div');
  labels.appendChild(el('div', 'label', 'Напоминания задач'));
  labels.appendChild(el('div', 'hint', permHint));
  const sw = el('button', 'switch');
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(permission === 'granted'));
  sw.disabled = permission === 'denied' || permission === 'unsupported';
  sw.addEventListener('click', () => {
    requestNotificationPermission();
    setTimeout(renderSettings, 400);
  });
  notifInner.append(labels, sw);
  notifRow.appendChild(notifInner);
  sheet.appendChild(group('Уведомления', [notifRow]));

  const projectCount = state.projects.filter((p) => !p.archived).length;
  const templateCount = state.templates.length;
  sheet.appendChild(group('Организация', [
    actionRow(
      'Проекты и шаблоны',
      projectCount || templateCount
        ? `Проектов: ${projectCount} · шаблонов: ${templateCount}`
        : 'Проекты для группировки доски и заготовленные цепочки задач',
      renderProjects
    )
  ]));

  const trashCount = state.tasks.filter((t) => t.deletedAt).length;
  sheet.appendChild(group('Данные', [
    actionRow('Корзина',
      trashCount ? `${trashCount} · хранятся ${TRASH_RETENTION_DAYS} дней`
        : `Пусто · удалённые хранятся ${TRASH_RETENTION_DAYS} дней`,
      renderTrash),
    actionRow('Экспорт задач в файл', 'Скачать резервную копию JSON', exportJson),
    actionRow('Импорт задач из файла', 'Дубликаты по названию и сроку пропускаются',
      () => $('#import-input').click()),
    actionRow('Очистить выполненные', 'Закрытые задачи уйдут в корзину', () => {
      const now = Date.now();
      let count = 0;
      state.tasks.forEach((t) => {
        if (t.isDone && !t.deletedAt) { t.deletedAt = now; count++; }
      });
      saveTasks();
      renderSettings();
      render();
      showToast(`В корзину отправлено: ${count}`);
    }, true)
  ]));

  const about = el('div', 'settings-row');
  about.appendChild(el('div', 'label', 'Nix · версия 2.1'));
  about.appendChild(el('div', 'hint',
    'Свайп вправо — выполнить, влево — в корзину. Тап открывает редактирование, ' +
    'ручка справа меняет порядок, долгое нажатие запускает фокус. ' +
    'Срок можно писать словами: «завтра в 18:00». ' +
    'Кнопка вида в шапке переключает список, плитки и доску. ' +
    'Категорий у задачи может быть несколько — на доске она встанет в каждую колонку.'));
  sheet.appendChild(group('О приложении', [about]));

  const storage = el('div', 'settings-row');
  storage.appendChild(el('div', 'label', 'Где хранятся данные'));
  storage.appendChild(el('div', 'hint',
    'Только в этом браузере на этом устройстве. Очистка данных сайта удалит их — ' +
    'делайте экспорт заранее. На iOS хранилище может очиститься, если не открывать ' +
    'приложение около недели.'));
  sheet.appendChild(group('Хранение', [storage]));
}

function group(title, rows) {
  const wrap = el('div', 'settings-group');
  wrap.appendChild(el('p', 'group-label', title));
  const card = el('div', 'settings-card');
  rows.forEach((r) => card.appendChild(r));
  wrap.appendChild(card);
  return wrap;
}

function chipsRow(label, items, activeId, onPick) {
  const row = el('div', 'settings-row');
  row.appendChild(el('div', 'label', label));
  const chips = el('div', 'chip-wrap tight');
  items.forEach((item) => {
    chips.appendChild(chip(item.label, item.id === activeId, () => onPick(item.id)));
  });
  row.appendChild(chips);
  return row;
}

function switchRow(label, checked, onChange) {
  const row = el('div', 'settings-row');
  const inner = el('div', 'switch-row');
  inner.appendChild(el('div', 'label', label));
  const sw = el('button', 'switch');
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(checked));
  sw.addEventListener('click', () => onChange(!checked));
  inner.appendChild(sw);
  row.appendChild(inner);
  return row;
}

function actionRow(label, hint, onClick, danger) {
  const row = el('button', 'settings-row action' + (danger ? ' danger' : ''));
  row.appendChild(el('div', 'label', label));
  row.appendChild(el('div', 'hint', hint));
  row.addEventListener('click', onClick);
  return row;
}

/* ------------------------------------------------- проекты и шаблоны (экран) */

/**
 * Проекты и шаблоны цепочек. Оба списка живут на одном экране: они редко
 * нужны и оба про «настроить один раз, дальше пользоваться».
 *
 * Состояние конструктора держим снаружи функции — экран перерисовывается
 * целиком после каждого действия, и набранные шаги не должны пропадать.
 */
let templateDraft = null;

function blankTemplateDraft() {
  return { name: '', category: 'INBOX', stepTitle: '', stepDay: 0, steps: [] };
}

function renderProjects() {
  if (!templateDraft) templateDraft = blankTemplateDraft();

  const sheet = $('#sheet-inner');
  sheet.innerHTML = '';

  const head = el('div', 'sheet-head');
  const back = el('button', 'icon-btn');
  back.setAttribute('aria-label', 'Назад');
  back.innerHTML = icon(ICONS.left, 20, 2);
  back.addEventListener('click', renderSettings);
  const titleBox = el('div', 'row-center');
  titleBox.append(back, el('h2', null, 'Проекты и шаблоны'));
  head.appendChild(titleBox);
  sheet.appendChild(head);

  /* --- проекты --- */

  sheet.appendChild(el('p', 'group-label', 'Проекты'));

  const addRow = el('div', 'add-row');
  const projectInput = el('input', 'text-input');
  projectInput.type = 'text';
  projectInput.placeholder = 'Новый проект';
  projectInput.value = '';
  const addBtn = el('button', 'icon-btn accent');
  addBtn.setAttribute('aria-label', 'Добавить проект');
  addBtn.innerHTML = icon(ICONS.check, 18, 2.4);
  const commitProject = () => {
    const value = projectInput.value.trim();
    if (!value) return;
    addProject(value);
    renderProjects();
    render();
  };
  addBtn.addEventListener('click', commitProject);
  projectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitProject();
  });
  addRow.append(projectInput, addBtn);
  sheet.appendChild(addRow);

  if (!state.projects.length) {
    sheet.appendChild(el('p', 'muted-small',
      'Проектов пока нет. Проект — это уровень над категориями, ' +
      'по нему можно группировать доску.'));
  } else {
    state.projects.forEach((project) => {
      const row = el('div', 'project-row');
      const dot = el('span', 'project-dot');
      dot.style.background = projectColor(project);
      const name = el('p', 'project-name', project.name);

      const used = state.tasks.filter((t) => !t.deletedAt && t.projectId === project.id).length;
      const count = el('span', 'muted-small', used ? `${used} задач` : 'пусто');

      const remove = el('button', 'icon-btn danger');
      remove.setAttribute('aria-label', 'Удалить проект');
      remove.innerHTML = icon(ICONS.trash, 17, 2);
      remove.addEventListener('click', () => {
        deleteProject(project.id);
        renderProjects();
        render();
      });

      row.append(dot, name, count, remove);
      sheet.appendChild(row);
    });
    sheet.appendChild(el('p', 'muted-small',
      'Удаление проекта не удаляет задачи — они просто выходят из него.'));
  }

  /* --- шаблоны --- */

  sheet.appendChild(el('p', 'group-label spaced', 'Шаблоны цепочек'));
  sheet.appendChild(el('p', 'muted-small',
    'Шаблон — заготовленный набор задач с относительными сроками. ' +
    'Применение создаёт реальные задачи: «День 0» — сегодня, «День 3» — через три дня.'));

  state.templates.forEach((template) => {
    const cat = byId(CATEGORIES, template.category);
    const card = el('div', 'template-card');

    const top = el('div', 'template-top');
    const info = el('div', 'template-info');
    info.appendChild(el('p', 'template-name', template.name));
    const sub = el('p', 'template-sub',
      `${(template.steps || []).length} шагов · ${cat.label}`);
    sub.style.color = cat.color;
    info.appendChild(sub);
    top.appendChild(info);

    const apply = el('button', 'icon-btn accent');
    apply.setAttribute('aria-label', 'Применить шаблон');
    apply.innerHTML = icon(ICONS.play, 17, 2);
    apply.addEventListener('click', () => {
      applyTemplate(template.id);
      renderProjects();
    });

    const remove = el('button', 'icon-btn danger');
    remove.setAttribute('aria-label', 'Удалить шаблон');
    remove.innerHTML = icon(ICONS.trash, 17, 2);
    remove.addEventListener('click', () => {
      deleteTemplate(template.id);
      renderProjects();
    });

    top.append(apply, remove);
    card.appendChild(top);

    (template.steps || []).slice().sort((a, b) => a.position - b.position).forEach((step) => {
      card.appendChild(el('p', 'template-step', `День ${step.dayOffset} · ${step.title}`));
    });

    sheet.appendChild(card);
  });

  sheet.appendChild(renderTemplateBuilder());
}

/**
 * Конструктор шаблона. Намеренно простой: имя, категория и шаги со сдвигом
 * в днях — этого хватает, чтобы цепочка легла на доску в нужном порядке.
 */
function renderTemplateBuilder() {
  const d = templateDraft;
  const box = el('div', 'template-card builder');

  box.appendChild(el('p', 'template-name', 'Новый шаблон'));

  const nameInput = el('input', 'text-input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Название шаблона';
  nameInput.value = d.name;
  nameInput.addEventListener('input', () => { d.name = nameInput.value; });
  box.appendChild(nameInput);

  box.appendChild(el('p', 'field-label', 'Категория цепочки'));
  const cats = el('div', 'chip-wrap tight');
  CATEGORIES.slice(0, 4).forEach((item) => {
    cats.appendChild(chip(item.label, d.category === item.id, () => {
      d.category = item.id;
      renderProjects();
    }, item.color));
  });
  box.appendChild(cats);

  d.steps.forEach((step, index) => {
    const line = el('p', 'template-step removable', `День ${step.dayOffset} · ${step.title}`);
    line.title = 'Убрать шаг';
    line.addEventListener('click', () => {
      d.steps.splice(index, 1);
      renderProjects();
    });
    box.appendChild(line);
  });

  const stepRow = el('div', 'add-row');
  const stepInput = el('input', 'text-input');
  stepInput.type = 'text';
  stepInput.placeholder = 'Шаг';
  stepInput.value = d.stepTitle;
  stepInput.addEventListener('input', () => { d.stepTitle = stepInput.value; });
  const dayChip = chip(`День ${d.stepDay}`, false, () => {
    d.stepDay = (d.stepDay + 1) % 15;
    renderProjects();
  });
  stepRow.append(stepInput, dayChip);
  box.appendChild(stepRow);

  const actions = el('div', 'chip-wrap tight');
  actions.appendChild(chip('Добавить шаг', false, () => {
    const value = (d.stepTitle || '').trim();
    if (!value) return;
    d.steps.push({ title: value, dayOffset: d.stepDay, priority: 'MEDIUM', energy: 'MEDIUM' });
    d.stepTitle = '';
    renderProjects();
  }));
  actions.appendChild(chip(
    'Сохранить шаблон',
    !!d.name.trim() && d.steps.length > 0,
    () => {
      if (!d.name.trim() || !d.steps.length) return;
      saveTemplate(d.name, d.category, d.steps);
      templateDraft = blankTemplateDraft();
      renderProjects();
    }
  ));
  box.appendChild(actions);

  return box;
}

/* ---------------------------------------------------------------- корзина */

function renderTrash() {
  const sheet = $('#sheet-inner');
  sheet.innerHTML = '';

  const head = el('div', 'sheet-head');
  const back = el('button', 'icon-btn');
  back.setAttribute('aria-label', 'Назад');
  back.innerHTML = icon(ICONS.left, 20, 2);
  back.addEventListener('click', renderSettings);
  const titleBox = el('div', 'row-center');
  titleBox.append(back, el('h2', null, 'Корзина'));
  head.appendChild(titleBox);

  const trash = state.tasks.filter((t) => t.deletedAt)
    .sort((a, b) => b.deletedAt - a.deletedAt);

  if (trash.length) {
    const clear = el('button', 'link-danger', 'Очистить');
    clear.addEventListener('click', () => {
      state.tasks = state.tasks.filter((t) => !t.deletedAt);
      saveTasks();
      renderTrash();
      render();
    });
    head.appendChild(clear);
  }
  sheet.appendChild(head);

  sheet.appendChild(el('p', 'muted-small pad',
    `Удалённые задачи хранятся ${TRASH_RETENTION_DAYS} дней, потом стираются сами`));

  if (!trash.length) {
    sheet.appendChild(el('p', 'muted-small center pad', 'Корзина пуста'));
    return;
  }

  trash.forEach((task) => {
    const daysLeft = Math.max(0,
      TRASH_RETENTION_DAYS - Math.floor((Date.now() - task.deletedAt) / DAY));
    const cat = byId(CATEGORIES, task.category);

    const row = el('div', 'trash-row');
    const info = el('div', 'trash-info');
    info.appendChild(el('p', 'trash-title', task.title));
    const meta = el('div', 'trash-meta');
    meta.innerHTML = `<span style="color:${cat.color}">${escapeHtml(cat.label)}</span>` +
      `<span class="muted-small">${daysLeft > 0 ? 'удалится через ' + daysLeft + ' дн.' : 'удалится сегодня'}</span>`;
    info.appendChild(meta);
    row.appendChild(info);

    const restore = el('button', 'icon-btn accent');
    restore.setAttribute('aria-label', 'Восстановить');
    restore.innerHTML = icon(ICONS.restore, 18, 2);
    restore.addEventListener('click', () => {
      task.deletedAt = null; saveTasks(); renderTrash(); render();
    });

    const remove = el('button', 'icon-btn danger');
    remove.setAttribute('aria-label', 'Удалить навсегда');
    remove.innerHTML = icon(ICONS.trash, 18, 2);
    remove.addEventListener('click', () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      // Сессии остаются в статистике: обнуляем только привязку
      state.sessions.forEach((s) => { if (s.taskId === task.id) s.taskId = null; });
      saveSessions();
      saveTasks();
      renderTrash();
      render();
    });

    row.append(restore, remove);
    sheet.appendChild(row);
  });
}

/* ---------------------------------------------------------------- импорт/экспорт */

function exportJson() {
  const payload = {
    app: 'Nix',
    version: 3,
    exportedAt: Date.now(),
    tasks: state.tasks.filter((t) => !t.deletedAt),
    sessions: state.sessions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nix-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importJson(file) {
  const reader = new FileReader();

  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(String(reader.result));
    } catch (e) {
      showToast('Файл повреждён или это не резервная копия');
      return;
    }

    const incoming = Array.isArray(data) ? data : data.tasks;
    if (!Array.isArray(incoming)) {
      showToast('В файле нет списка задач');
      return;
    }

    let imported = 0, duplicates = 0, invalid = 0;

    incoming.forEach((raw) => {
      const title = String(raw.title || '').trim();
      if (!title) { invalid++; return; }

      const deadline = raw.deadline || null;
      // Дубликат — совпали и название, и срок
      const exists = state.tasks.some((t) =>
        !t.deletedAt && t.title === title && (t.deadline || null) === deadline);
      if (exists) { duplicates++; return; }

      state.tasks.push({
        id: makeId(),
        title,
        deadline,
        reminderAt: raw.reminderAt || null,
        priority: PRIORITIES.some((p) => p.id === raw.priority) ? raw.priority : 'MEDIUM',
        category: CATEGORIES.some((c) => c.id === raw.category) ? raw.category : 'INBOX',
        recurrence: RECURRENCES.some((r) => r.id === raw.recurrence) ? raw.recurrence : 'NONE',
        weekdayMask: Number(raw.weekdayMask) || 0,
        // Файлы старых версий поля categories не знают — тогда категория одна
        categories: Array.isArray(raw.categories)
          ? raw.categories.filter((c) => CATEGORIES.some((x) => x.id === c) && c !== raw.category)
          : [],
        projectId: null,
        energy: ENERGIES.some((e) => e.id === raw.energy) ? raw.energy : 'MEDIUM',
        isDone: !!raw.isDone,
        completedAt: raw.completedAt || null,
        createdAt: raw.createdAt || Date.now(),
        manualOrder: null,
        boardPositions: {},
        deletedAt: null,
        subtasks: Array.isArray(raw.subtasks)
          ? raw.subtasks
              .filter((s) => s && String(s.title || '').trim())
              .map((s) => ({ title: String(s.title).trim(), done: !!s.done }))
          : []
      });
      imported++;
    });

    saveTasks();
    render();
    renderSettings();

    let report = `Добавлено задач: ${imported}`;
    if (duplicates) report += `, пропущено дубликатов: ${duplicates}`;
    if (invalid) report += `, с ошибками: ${invalid}`;
    showToast(report);
  };

  reader.readAsText(file);
}

/* ---------------------------------------------------------------- запуск */

function render() {
  applyTheme();

  const main = $('#app');
  main.innerHTML = '';
  main.className = 'app tab-' + state.tab.toLowerCase();

  if (state.tab === 'TASKS') renderTasksTab(main);
  else if (state.tab === 'CALENDAR') renderCalendarTab(main);
  else renderStatsTab(main);

  renderTabs();
  $('#fab').classList.toggle('hidden', state.tab !== 'TASKS');
}

function renderTabs() {
  const bar = $('#tabs');
  bar.innerHTML = '';

  const tabs = [
    { id: 'TASKS', label: 'Задачи', icon: ICONS.list },
    { id: 'CALENDAR', label: 'Календарь', icon: ICONS.calendar },
    { id: 'STATS', label: 'Статистика', icon: ICONS.chart }
  ];

  tabs.forEach((tab) => {
    const active = state.tab === tab.id;
    const btn = el('button', 'tab' + (active ? ' active' : ''));
    btn.innerHTML = icon(tab.icon, 17, 1.9) + (active ? `<span>${tab.label}</span>` : '');

    // Точка напоминает, что фокус ещё идёт
    if (tab.id === 'TASKS' && state.focus && state.focus.active) {
      btn.innerHTML += '<span class="tab-dot"></span>';
    }

    btn.addEventListener('click', () => { state.tab = tab.id; render(); });
    bar.appendChild(btn);
  });
}

function hideSplash() {
  const splash = $('#splash');
  if (!splash) return;
  splash.classList.add('fade');
  setTimeout(() => splash.remove(), 400);
}

function init() {
  purgeExpiredTrash();
  applyTheme();
  render();

  $('#fab').addEventListener('click', () => openSheet(null));
  $('#scrim').addEventListener('click', closeOverlay);

  const importInput = el('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.id = 'import-input';
  importInput.className = 'sr-only';
  importInput.addEventListener('change', () => {
    if (importInput.files && importInput.files[0]) importJson(importInput.files[0]);
    importInput.value = '';
  });
  document.body.appendChild(importInput);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && snoozeMenuEl) { closeSnoozeMenu(); return; }
    if (e.key === 'Escape' && overlayKind) closeOverlay();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { render(); checkReminders(); }
  });

  setTimeout(hideSplash, 700);
  checkReminders();
  setInterval(checkReminders, 30000);
  // Раз в минуту: «Сегодня/Завтра» и просрочка меняются со временем
  setInterval(() => { if (!overlayKind) render(); }, 60000);

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.settings.theme === 'SYSTEM') applyTheme();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // по file:// service worker недоступен — это нормально
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
