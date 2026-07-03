// Estado da aplicação
const state = {
  currentDate: new Date(),
  selectedDate: new Date(),
  mobileSection: 'agenda',
  tasks: [],
  readyTasks: [],
  filter: 'all',
  editingTaskId: null,
  editingReadyTaskId: null,
  userProfile: null,
  workingDays: null,
  user: null,
  companyUsers: [],
  viewingUserId: null,
  viewingUserName: null
};

const STORAGE_KEY = 'task-checklist-data';
const SETTINGS_KEY = 'task-checklist-settings';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ACCENT_PRESETS = {
  indigo: { accent: '#6366f1', hover: '#818cf8', soft: 'rgba(99, 102, 241, 0.15)' },
  blue: { accent: '#3b82f6', hover: '#60a5fa', soft: 'rgba(59, 130, 246, 0.15)' },
  emerald: { accent: '#10b981', hover: '#34d399', soft: 'rgba(16, 185, 129, 0.15)' },
  orange: { accent: '#f59e0b', hover: '#fbbf24', soft: 'rgba(245, 158, 11, 0.15)' },
  pink: { accent: '#ec4899', hover: '#f472b6', soft: 'rgba(236, 72, 153, 0.15)' },
  violet: { accent: '#8b5cf6', hover: '#a78bfa', soft: 'rgba(139, 92, 246, 0.15)' },
  'rgb-red': { accent: '#ef4444', hover: '#f87171', soft: 'rgba(239, 68, 68, 0.15)' },
  'rgb-green': { accent: '#22c55e', hover: '#4ade80', soft: 'rgba(34, 197, 94, 0.15)' },
  'rgb-blue': { accent: '#3b82f6', hover: '#60a5fa', soft: 'rgba(59, 130, 246, 0.15)' }
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showScreenNotification(message, tone = 'warning') {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '20px';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.maxWidth = 'min(92vw, 520px)';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '0.92rem';
    toast.style.fontWeight = '600';
    toast.style.lineHeight = '1.35';
    toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
    toast.style.zIndex = '2200';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    document.body.appendChild(toast);
  }

  const tones = {
    warning: { bg: '#7f1d1d', border: '#ef4444' },
    success: { bg: '#14532d', border: '#22c55e' },
    info: { bg: '#1e3a8a', border: '#3b82f6' }
  };
  const activeTone = tones[tone] || tones.warning;
  toast.style.background = activeTone.bg;
  toast.style.border = `1px solid ${activeTone.border}`;
  toast.style.color = '#ffffff';
  toast.textContent = message;

  if (toast.dismissTimer) clearTimeout(toast.dismissTimer);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  toast.dismissTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3600);
}

function escapeDialogText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

function showAppDialog({
  title = 'Aviso',
  message = '',
  confirmText = 'OK',
  cancelText = '',
  tone = 'info'
} = {}) {
  return new Promise((resolve) => {
    const toneMap = {
      info: { icon: 'info', border: 'var(--accent)' },
      warning: { icon: 'alert-triangle', border: '#f59e0b' },
      danger: { icon: 'shield-alert', border: '#ef4444' },
      success: { icon: 'check-circle-2', border: '#22c55e' }
    };
    const activeTone = toneMap[tone] || toneMap.info;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '2100';
    overlay.innerHTML = `
      <div class="modal w-full max-w-md rounded-2xl border bg-app-card p-5 shadow-app md:p-6" role="dialog" aria-modal="true" aria-label="${escapeDialogText(title)}" style="border-color:${activeTone.border}">
        <div class="mb-3 flex items-center gap-2">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-app-secondary text-app-accent">
            <i data-lucide="${activeTone.icon}"></i>
          </span>
          <h3 class="text-base font-semibold text-app-text">${escapeDialogText(title)}</h3>
        </div>
        <p class="mb-5 text-sm leading-relaxed text-app-subtle">${escapeDialogText(message)}</p>
        <div class="flex justify-end gap-2">
          ${cancelText ? `<button type="button" class="btn-secondary inline-flex h-10 items-center justify-center rounded-lg border border-app-border bg-app-secondary px-4 text-sm font-medium text-app-subtle transition-colors hover:text-app-text" data-dialog-action="cancel">${escapeDialogText(cancelText)}</button>` : ''}
          <button type="button" class="btn-primary inline-flex h-10 items-center justify-center rounded-lg bg-app-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-app-accentHover" data-dialog-action="confirm">${escapeDialogText(confirmText)}</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
    };

    const finish = (answer) => {
      cleanup();
      resolve(answer);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        finish(false);
      }
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    overlay.querySelector('[data-dialog-action="confirm"]')?.addEventListener('click', () => finish(true));
    overlay.querySelector('[data-dialog-action="cancel"]')?.addEventListener('click', () => finish(false));

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    refreshIcons();
  });
}

function showAppAlert(message, options = {}) {
  return showAppDialog({
    title: options.title || 'Aviso',
    message,
    confirmText: options.confirmText || 'OK',
    tone: options.tone || 'info'
  });
}

function showAppConfirm(message, options = {}) {
  return showAppDialog({
    title: options.title || 'Confirmar acao',
    message,
    confirmText: options.confirmText || 'Confirmar',
    cancelText: options.cancelText || 'Cancelar',
    tone: options.tone || 'warning'
  });
}

function getAppBasePath() {
  const path = window.location.pathname || '/';
  const cleaned = path.replace(/(?:index|auth)\.html$/i, '').replace(/auth\/?$/i, '');
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}

function getAppRoute(route) {
  const fileName = route === 'auth' ? 'auth.html' : 'index.html';
  if (window.location.protocol === 'file:') {
    return new URL(fileName, window.location.href).href;
  }

  const base = getAppBasePath();
  return route === 'auth' ? `${base}auth` : base;
}

function navigateToRoute(route) {
  window.location.href = getAppRoute(route);
}

function normalizeCanonicalUrl() {
  if (window.location.protocol === 'file:') return;

  const pathname = window.location.pathname || '/';
  let canonicalPath = null;

  if (/\/index\.html$/i.test(pathname)) {
    canonicalPath = pathname.replace(/index\.html$/i, '');
  } else if (/\/auth\.html$/i.test(pathname)) {
    canonicalPath = pathname.replace(/auth\.html$/i, 'auth');
  }

  if (canonicalPath == null) return;
  if (canonicalPath === '') canonicalPath = '/';

  const normalized = canonicalPath + window.location.search + window.location.hash;
  window.history.replaceState(null, '', normalized);
}

// Versículos e frases do dia (rotaciona conforme o dia do ano)
const VERSICULOS_BIBLICOS = [
  '“O Senhor é o meu pastor; nada me faltará.” — Salmos 23:1',
  '“Esforçai-vos e tende bom ânimo; não temais.” — Josué 1:9',
  '“Tudo posso naquele que me fortalece.” — Filipenses 4:13',
  '“O Senhor está perto de todos os que o invocam.” — Salmos 145:18',
  '“Vinde a mim, todos os que estais cansados, e eu vos aliviarei.” — Mateus 11:28',
  '“O amor é paciente, o amor é bondoso.” — 1 Coríntios 13:4',
  '“Confia no Senhor de todo o teu coração.” — Provérbios 3:5',
  '“Este é o dia que o Senhor fez; regozijemo-nos nele.” — Salmos 118:24',
  '“A paz de Deus guardará o vosso coração.” — Filipenses 4:7',
  '“O Senhor é a minha luz e a minha salvação.” — Salmos 27:1',
  '“Não andeis ansiosos por coisa alguma.” — Filipenses 4:6',
  '“Buscai primeiro o reino de Deus.” — Mateus 6:33',
  '“O fruto do Espírito é amor, alegria, paz.” — Gálatas 5:22',
  '“O Senhor te guardará de todo mal.” — Salmos 121:7',
  '“Com Cristo posso enfrentar qualquer coisa.” — Filipenses 4:13'
];

const FRASES_MOTIVACIONAIS = [
  'Hoje é um ótimo dia para começar.',
  'Um passo de cada vez leva você longe.',
  'Seu esforço de hoje é seu sucesso de amanhã.',
  'Acredite: você é capaz.',
  'Cada tarefa concluída é uma vitória.',
  'Organize o dia e ganhe paz de espírito.',
  'Pequenos progressos ainda são progressos.',
  'Comece onde você está. Use o que você tem.',
  'O melhor momento para agir é agora.',
  'Celebre as pequenas conquistas.',
  'Foco e consistência mudam o jogo.',
  'Respire, organize e siga em frente.',
  'Você está mais perto do que imagina.',
  'Um dia de cada vez, uma tarefa de cada vez.',
  'Seu trabalho de hoje importa.'
];

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDailyMessage() {
  const today = new Date();
  const dayOfYear = getDayOfYear(today);
  const useVerse = today.getDate() % 2 === 0; // dias pares: versículo; ímpares: frase
  const list = useVerse ? VERSICULOS_BIBLICOS : FRASES_MOTIVACIONAIS;
  const index = dayOfYear % list.length;
  return list[index];
}

function updateDailyMessage() {
  const el = document.getElementById('dailyMessage');
  if (el) {
    el.textContent = getDailyMessage();
  }
}

// Utilitários de data
function getDefaultWorkingDays() {
  // Segunda (1) até Sexta (5)
  return [1, 2, 3, 4, 5];
}

function getActiveWorkingDays() {
  const days = (state.workingDays && state.workingDays.length)
    ? state.workingDays
    : getDefaultWorkingDays();
  return [...new Set(days.map(Number))]
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function getWorkingDayLabel(day) {
  return ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'][day] || 'dia selecionado';
}

function formatDateKey(date) {
  const key = date.toISOString().split('T')[0];
  return key;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

/** Interpreta "YYYY-MM-DD" como data local (meio-dia), alinhado a tarefas com data específica. */
function parseDateKeyLocal(key) {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function calendarDaysBetween(fromDate, toDate) {
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Primeira ocorrência de weekDay (0–6) em refDate ou nos dias seguintes. */
function firstWeekDayOnOrAfter(refDate, weekDay) {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === weekDay) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
}

function matchesBiweeklyOnDate(task, date) {
  if (task.weekDay !== date.getDay()) return false;
  const anchor = parseDateKeyLocal(task.biweeklyStart);
  if (!anchor) return false;
  const diff = calendarDaysBetween(anchor, date);
  if (diff < 0) return false;
  return diff % 14 === 0;
}

/**
 * Dias da semana (0–6) de uma tarefa semanal.
 * Aceita o novo formato (weekDays: array) e o antigo (weekDay: número único).
 */
function getTaskWeekDays(task) {
  if (task && Array.isArray(task.weekDays) && task.weekDays.length) {
    return [...new Set(task.weekDays.map(Number))]
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
  }
  if (task && task.weekDay != null && Number.isInteger(Number(task.weekDay))) {
    return [Number(task.weekDay)];
  }
  return [];
}

function mapLoadedTask(t) {
  const task = { ...t, completedDates: t.completedDates || [] };
  if (task.frequency === 'biweekly' && task.weekDay != null && !task.biweeklyStart) {
    task.biweeklyStart = formatDateKey(firstWeekDayOnOrAfter(new Date(), task.weekDay));
  }
  return task;
}

// Configurações / tema
function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (!s) return { theme: 'dark', accent: '#22c55e', fontSize: 'medium' };
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed.accent === 'string' && ACCENT_PRESETS[parsed.accent]) {
      parsed.accent = ACCENT_PRESETS[parsed.accent].accent;
    }
    if (!parsed.accent) parsed.accent = '#22c55e';
    return parsed;
  } catch (e) {
    return { theme: 'dark', accent: '#22c55e', fontSize: 'medium' };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
  if (typeof updateUserRoleAndCode === 'function') {
    updateUserRoleAndCode();
  }
}

function applySettings(settings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.setAttribute('data-font-size', settings.fontSize);
  const palette = getAccentPalette(settings.accent);
  document.documentElement.style.setProperty('--accent', palette.accent);
  document.documentElement.style.setProperty('--accent-hover', palette.hover);
  document.documentElement.style.setProperty('--accent-soft', palette.soft);
  document.documentElement.style.setProperty('--accent-contrast', palette.contrast);
  document.documentElement.style.setProperty('--accent-hover-contrast', palette.hoverContrast);
  if (settings.theme === 'dark') {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f0f12');
  } else if (settings.theme === 'light') {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f4f5');
  }
}

function normalizeHexColor(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return null;
  if (v.length === 4) {
    return '#' + v.slice(1).split('').map(ch => ch + ch).join('').toLowerCase();
  }
  return v.toLowerCase();
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

function brightenHex(hex, ratio = 0.2) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#34d399';
  const brighten = (c) => Math.min(255, Math.round(c + (255 - c) * ratio));
  return `#${[brighten(rgb.r), brighten(rgb.g), brighten(rgb.b)].map(n => n.toString(16).padStart(2, '0')).join('')}`;
}

function getContrastText(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  return yiq >= 150 ? '#111827' : '#ffffff';
}

function getAccentPalette(accentValue) {
  if (typeof accentValue === 'string' && ACCENT_PRESETS[accentValue]) {
    const preset = ACCENT_PRESETS[accentValue];
    return {
      ...preset,
      contrast: getContrastText(preset.accent),
      hoverContrast: getContrastText(preset.hover)
    };
  }
  const accent = normalizeHexColor(accentValue) || '#22c55e';
  const rgb = hexToRgb(accent);
  if (!rgb) {
    const preset = ACCENT_PRESETS.emerald;
    return {
      ...preset,
      contrast: getContrastText(preset.accent),
      hoverContrast: getContrastText(preset.hover)
    };
  }
  const hover = brightenHex(accent, 0.2);
  return {
    accent,
    hover,
    soft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    contrast: getContrastText(accent),
    hoverContrast: getContrastText(hover)
  };
}

function updateAccentPickerUI(accentValue) {
  const normalized = normalizeHexColor(accentValue) || '#22c55e';
  const swatch = document.getElementById('accentPickerSwatch');
  const valueEl = document.getElementById('accentPickerValue');
  const input = document.getElementById('accentColorInput');
  if (swatch) swatch.style.background = normalized;
  if (valueEl) valueEl.textContent = normalized.toUpperCase();
  if (input) input.value = normalized;
}

// Persistência - Firestore ou localStorage
async function loadTasks() {
  if (typeof firebaseReady !== 'undefined' && firebaseReady && state.user) {
    try {
      const db = firebase.firestore();
      // Perfil do usuário (empresa / cargo)
      const userProfileDoc = await db.collection('users').doc(state.user.uid).get();
      if (userProfileDoc.exists) {
        state.userProfile = userProfileDoc.data();
      }
      if (state.userProfile?.companyId) {
        try {
          const companyDoc = await db.collection('companies')
            .doc(state.userProfile.companyId)
            .get();
          if (companyDoc.exists && Array.isArray(companyDoc.data().workingDays)) {
            state.workingDays = companyDoc.data().workingDays;
          }
        } catch (e) {
          console.error('Erro ao carregar dias de funcionamento da empresa:', e);
        }
      }

      const doc = await db.collection('users').doc(state.user.uid).collection('tasks').doc('data').get();
      if (doc.exists) {
        const data = doc.data();
        if (data.tasks) {
          state.tasks = data.tasks.map(mapLoadedTask);
        }
        if (data.readyTasks) {
          state.readyTasks = data.readyTasks;
        }
        // Mantém compatibilidade com versões antigas, mas só usa se não vier da empresa
        if (!state.workingDays && Array.isArray(data.workingDays)) {
          state.workingDays = data.workingDays;
        }
      } else {
        // Se o usuário não tiver documento de tarefas ainda, limpa o estado local
        // para não manter tarefas de uma visualização anterior (ex.: colaborador).
        state.tasks = [];
        state.readyTasks = [];
      }
    } catch (e) {
      console.error('Erro ao carregar do Firestore:', e);
    }
  } else {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        state.tasks = (parsed.tasks || []).map(mapLoadedTask);
        state.readyTasks = parsed.readyTasks || [];
        if (Array.isArray(parsed.workingDays)) {
          state.workingDays = parsed.workingDays;
        }
      }
    } catch (e) {
      console.error('Erro ao carregar tarefas:', e);
    }
  }
}

/**
 * Salva tarefas no Firestore de forma granular.
 * @param {{tasks?: boolean, ready?: boolean}} [parts] Quais partes gravar.
 *   Sem argumento, grava ambas (compatibilidade).
 *   Ex.: saveTasks({ tasks: true }) grava só as tarefas recorrentes,
 *   sem reescrever o array de "pronta entrega" (usa merge).
 */
async function saveTasks(parts) {
  const writeTasks = !parts || parts.tasks === true;
  const writeReady = !parts || parts.ready === true;

  if (typeof firebaseReady !== 'undefined' && firebaseReady && state.user) {
    try {
      const db = firebase.firestore();
      // Salva nas tarefas do usuário atual da tela: próprio usuário ou colaborador (quando admin está visualizando)
      const targetUserId = isViewingOtherUser() ? state.viewingUserId : state.user.uid;

      const payload = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (writeTasks) payload.tasks = state.tasks;
      if (writeReady) payload.readyTasks = state.readyTasks;

      // merge: grava apenas os campos alterados, sem reescrever o documento inteiro.
      await db.collection('users').doc(targetUserId).collection('tasks').doc('data')
        .set(payload, { merge: true });
    } catch (e) {
      console.error('Erro ao salvar no Firestore:', e);
    }
  } else {
    // localStorage é um único registro local; manter ambos juntos é barato e simples.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks,
      readyTasks: state.readyTasks,
      workingDays: state.workingDays || getDefaultWorkingDays()
    }));
  }
}

// Calendário
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthTitle = document.getElementById('currentMonth');
  
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  monthTitle.textContent = `${MONTHS[month]} ${year}`;

  grid.innerHTML = WEEKDAYS.map(d => 
    `<div class="calendar-day-header">${d}</div>`
  ).join('');

  const firstDay = new Date(year, month, 1);
  const startDate = getWeekStart(firstDay);

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dayNum = date.getDate();
    const isOtherMonth = date.getMonth() !== month;
    const isToday = isSameDay(date, new Date());
    const isSelected = isSameDay(date, state.selectedDate);
    const taskCount = getTasksForDate(date).length;

    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    if (isOtherMonth) dayEl.classList.add('other-month');
    if (isToday) dayEl.classList.add('today');
    if (isSelected) dayEl.classList.add('selected');
    if (taskCount > 0) dayEl.classList.add('has-tasks');

    const dotsToShow = Math.min(taskCount, 3);
    const dotsHtml = dotsToShow > 0
      ? `<span class="cal-day-dots" aria-hidden="true">${'<span class="cal-dot"></span>'.repeat(dotsToShow)}</span>`
      : '';
    dayEl.innerHTML = `<span class="cal-day-num">${dayNum}</span>${dotsHtml}`;
    if (taskCount > 0) {
      dayEl.setAttribute('aria-label', `${dayNum}: ${taskCount} tarefa${taskCount > 1 ? 's' : ''}`);
    }
    dayEl.dataset.date = formatDateKey(date);
    dayEl.addEventListener('click', () => selectDate(date));

    grid.appendChild(dayEl);
  }
}

function selectDate(date) {
  state.selectedDate = date;
  renderCalendar();
  renderTasks();
  updateSelectedDateTitle();
}

// Modal: lista de todas as tarefas
function openAllTasksModal() {
  renderAllTasks();
  const modal = document.getElementById('allTasksModal');
  if (modal) modal.classList.add('active');
  refreshIcons();
}

function closeAllTasksModal() {
  const modal = document.getElementById('allTasksModal');
  if (modal) modal.classList.remove('active');
}

function renderAllTasks() {
  const list = document.getElementById('allTasksList');
  if (!list) return;

  const recurring = state.tasks.filter(t => !t.isReadyTask);
  const ready = state.readyTasks || [];

  if (!recurring.length && !ready.length) {
    list.innerHTML = `
      <p class="all-tasks-empty rounded-lg border border-dashed border-app-border bg-app-secondary/30 p-4 text-center text-sm text-app-muted">Nenhuma tarefa cadastrada ainda.</p>
    `;
    return;
  }

  const recurringHtml = recurring.length ? `
    <div class="all-tasks-group">
      <h4 class="all-tasks-group-title">Tarefas recorrentes (${recurring.length})</h4>
      ${recurring.map(task => `
        <button type="button" class="all-task-row" data-id="${task.id}">
          <span class="all-task-title">${escapeHtml(task.title)}</span>
          <span class="task-badge ${task.frequency}">${escapeHtml(getFrequencyLabel(task.frequency, task))}</span>
        </button>
      `).join('')}
    </div>
  ` : '';

  const readyHtml = ready.length ? `
    <div class="all-tasks-group">
      <h4 class="all-tasks-group-title">Pronta entrega (${ready.length})</h4>
      ${ready.map(task => `
        <div class="all-task-row is-ready ${task.completed ? 'is-done' : ''}">
          <span class="all-task-title">${escapeHtml(task.title)}</span>
          <span class="task-badge specific">${task.completed ? 'Concluída' : 'Pronta entrega'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  list.innerHTML = recurringHtml + readyHtml;

  list.querySelectorAll('.all-task-row[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === row.dataset.id);
      if (!task) return;
      const target = getDisplayDateForTask(task);
      if (target) {
        state.currentDate = new Date(target.getFullYear(), target.getMonth(), 1);
        selectDate(target);
      }
      closeAllTasksModal();
    });
  });

  refreshIcons();
}

// Dias úteis / empresa
function isWorkingDay(date, workingDays) {
  const days = workingDays && workingDays.length ? workingDays : getDefaultWorkingDays();
  return days.includes(date.getDay());
}

function adjustToPreviousWorkingDay(date, workingDays) {
  const days = workingDays && workingDays.length ? workingDays : getDefaultWorkingDays();
  const d = new Date(date);
  let guard = 0;
  while (!days.includes(d.getDay()) && guard < 31) {
    d.setDate(d.getDate() - 1);
    guard++;
  }
  return d;
}

function adjustToNextWorkingDay(date, workingDays) {
  const days = workingDays && workingDays.length ? workingDays : getDefaultWorkingDays();
  const d = new Date(date);
  let guard = 0;
  while (!days.includes(d.getDay()) && guard < 31) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

function getMonthlyEffectiveDateForTask(task, referenceDate, workingDays) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  // monthDay 0 = último dia do mês
  const monthDay = task.monthDay === 0 ? lastDay : (task.monthDay || 1);
  const clampedDay = Math.min(monthDay, lastDay);
  const base = new Date(year, month, clampedDay);
  const days = workingDays && workingDays.length ? workingDays : getDefaultWorkingDays();
  // Primeiro dia do mês: se for fora de serviço, usar o próximo dia útil
  if (clampedDay === 1 && !days.includes(base.getDay())) {
    return adjustToNextWorkingDay(base, workingDays);
  }
  return adjustToPreviousWorkingDay(base, workingDays);
}

// Equipe / permissões
function isAdmin() {
  return !!(state.userProfile && state.userProfile.role === 'admin');
}

function isGerente() {
  return !!(state.userProfile && state.userProfile.role === 'gerente');
}

function isLeader() {
  return !!(state.userProfile && state.userProfile.role === 'leader');
}

function canViewTeamPanel() {
  return isAdmin() || isGerente();
}

function canViewOtherUserTasks() {
  return isAdmin() || isGerente() || isLeader();
}

function canAssignTasksToOthers() {
  return isAdmin() || isGerente() || isLeader();
}

async function sendPresenceHeartbeat() {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady && state.user)) return;
  try {
    const token = await state.user.getIdToken();
    await fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentSurface: 'checklist',
        currentPath: window.location.pathname
      })
    });
  } catch (e) {
    // ignore heartbeat failures
  }
}

function startPresenceHeartbeat() {
  void sendPresenceHeartbeat();
  if (state.presenceTimer) clearInterval(state.presenceTimer);
  state.presenceTimer = setInterval(sendPresenceHeartbeat, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sendPresenceHeartbeat();
  });
}

function isViewingOtherUser() {
  return !!(state.viewingUserId && state.viewingUserId !== state.user?.uid);
}

async function saveCompanyWorkingDays() {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady &&
    state.user && state.userProfile && state.userProfile.companyId && isAdmin())) {
    return;
  }

  try {
    const db = firebase.firestore();
    await db.collection('companies')
      .doc(state.userProfile.companyId)
      .update({
        workingDays: state.workingDays || getDefaultWorkingDays(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (e) {
    console.error('Erro ao salvar dias de funcionamento da empresa:', e);
  }
}

async function viewUserTasks(userId) {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady && state.user && canViewOtherUserTasks())) {
    return;
  }

  // Se selecionar o próprio admin, sai do modo de visualização (se estiver ativo)
  if (userId === state.user.uid) {
    await exitViewMode();
    return;
  }

  try {
    const db = firebase.firestore();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await showAppAlert('Usuario selecionado nao encontrado.', { title: 'Usuario nao encontrado', tone: 'warning' });
      return;
    }

    const profile = userDoc.data();
    const tasksDoc = await db.collection('users').doc(userId)
      .collection('tasks').doc('data').get();

    state.viewingUserId = userId;
    state.viewingUserName = profile.name || profile.email || 'Colaborador';

    state.userProfile = state.userProfile || {};

    if (tasksDoc.exists) {
      const data = tasksDoc.data();
      state.tasks = (data.tasks || []).map(mapLoadedTask);
      state.readyTasks = data.readyTasks || [];
      // workingDays continua vindo da empresa
    } else {
      state.tasks = [];
      state.readyTasks = [];
    }

    document.getElementById('teamModal')?.classList.remove('active');

    renderCalendar();
    renderTasks();
    renderReadyTasks();
    updateSelectedDateTitle();
    updateViewingInfoBanner();
  } catch (e) {
    console.error('Erro ao carregar tarefas do colaborador:', e);
    await showAppAlert('Nao foi possivel carregar as tarefas deste colaborador.', { title: 'Falha ao carregar', tone: 'danger' });
  }
}

async function exitViewMode() {
  // Sempre volta para as próprias tarefas, mesmo que o estado de visualização esteja inconsistente
  state.viewingUserId = null;
  state.viewingUserName = null;

  await loadTasks();
  renderCalendar();
  renderTasks();
  renderReadyTasks();
  updateSelectedDateTitle();
  updateViewingInfoBanner();
}

async function refreshTasks() {
  const btn = document.getElementById('refreshTasksBtn');
  const originalTitle = btn?.getAttribute('title') || 'Atualizar tarefas';
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Atualizando…');
  }

  try {
    if (isViewingOtherUser() && typeof firebaseReady !== 'undefined' && firebaseReady && state.user) {
      const db = firebase.firestore();
      const tasksDoc = await db.collection('users').doc(state.viewingUserId)
        .collection('tasks').doc('data').get();
      if (tasksDoc.exists) {
        const data = tasksDoc.data();
        state.tasks = (data.tasks || []).map(mapLoadedTask);
        state.readyTasks = data.readyTasks || [];
      }
    } else {
      await loadTasks();
    }
    renderCalendar();
    renderTasks();
    renderReadyTasks();
    updateSelectedDateTitle();
    if (isViewingOtherUser()) updateViewingInfoBanner();
    if (btn) {
      btn.setAttribute('title', 'Atualizado!');
      btn.setAttribute('aria-label', 'Atualizado!');
      setTimeout(() => {
        btn.disabled = false;
        btn.setAttribute('title', originalTitle);
        btn.setAttribute('aria-label', originalTitle);
      }, 1500);
    }
  } catch (e) {
    console.error('Erro ao atualizar tarefas:', e);
    if (btn) {
      btn.disabled = false;
      btn.setAttribute('aria-label', originalTitle);
    }
  }
}

// Tarefas
function getTasksForDate(date) {
  if (!isWorkingDay(date, state.workingDays)) return [];

  const dateKey = formatDateKey(date);
  const dayOfWeek = date.getDay();

  return state.tasks.filter(task => {
    if (task.frequency === 'daily') return true;
    if (task.frequency === 'weekly') return getTaskWeekDays(task).includes(dayOfWeek);
    if (task.frequency === 'biweekly') return matchesBiweeklyOnDate(task, date);
    if (task.frequency === 'monthly') {
      const effective = getMonthlyEffectiveDateForTask(task, date, state.workingDays);
      return isSameDay(effective, date);
    }
    if (task.frequency === 'specific') return task.date === dateKey;
    return false;
  });
}

function isTaskCompleted(task, date) {
  const dateKey = formatDateKey(date);
  return task.completedDates?.includes(dateKey) ?? false;
}

async function toggleTaskComplete(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const dateKey = formatDateKey(state.selectedDate);
  if (!task.completedDates) task.completedDates = [];
  
  const idx = task.completedDates.indexOf(dateKey);
  if (idx >= 0) {
    task.completedDates.splice(idx, 1);
  } else {
    task.completedDates.push(dateKey);
  }
  await saveTasks({ tasks: true });
  renderTasks();
  renderCalendar();
}

async function deleteTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  await saveTasks({ tasks: true });
  renderTasks();
  renderCalendar();
}

// Tarefas pronta entrega
function renderReadyTasks() {
  const list = document.getElementById('readyTaskList');
  if (!list) return;

  const orderedReadyTasks = [...state.readyTasks].sort((a, b) => {
    const aCompleted = !!a.completed;
    const bCompleted = !!b.completed;
    if (aCompleted === bCompleted) return 0;
    return aCompleted ? 1 : -1;
  });

  if (orderedReadyTasks.length === 0) {
    list.innerHTML = `
      <li class="empty-state rounded-xl border border-dashed border-app-border bg-app-secondary/30 p-4 text-center">
        <p class="text-sm text-app-muted">Nenhuma tarefa pronta entrega cadastrada</p>
      </li>
    `;
    refreshIcons();
    return;
  }

  list.innerHTML = orderedReadyTasks.map(task => {
    const completedClass = task.completed ? 'completed' : '';
    return `
    <li class="task-item ${completedClass} rounded-xl border border-app-border bg-app-secondary/40 p-3 transition-colors hover:bg-app-secondary/70" data-id="${task.id}">
      <div class="task-controls mb-2 flex items-center justify-between gap-2">
        <div class="task-checkbox h-5 w-5 rounded border border-app-border bg-app-card" role="button" tabindex="0" aria-label="Marcar como concluída"></div>
        <div class="task-actions flex items-center gap-1.5">
          <button class="task-edit inline-flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-app-card text-sm transition-colors hover:border-app-accent hover:text-app-accent" aria-label="Editar"><i data-lucide="pencil"></i></button>
          <button class="task-delete inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-lg leading-none text-red-300 transition-colors hover:bg-red-500/20" aria-label="Excluir"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="task-content flex flex-col items-center justify-center gap-2 text-center">
        <span class="task-title text-center text-sm font-medium text-app-text">${escapeHtml(task.title)}</span>
      </div>
    </li>
  `;
  }).join('');

  list.querySelectorAll('.task-item').forEach(item => {
    const id = item.dataset.id;
    item.querySelector('.task-checkbox').addEventListener('click', () => toggleReadyTaskComplete(id));
    const editBtn = item.querySelector('.task-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = state.readyTasks.find(t => t.id === id);
        if (task) openReadyTaskModal(task);
      });
    }
    item.querySelector('.task-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showAppConfirm('Excluir esta tarefa pronta entrega?', {
        title: 'Confirmar exclusao',
        confirmText: 'Excluir',
        tone: 'danger'
      });
      if (confirmed) await deleteReadyTask(id);
    });
  });
  refreshIcons();
}

async function toggleReadyTaskComplete(id) {
  const task = state.readyTasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  await saveTasks({ ready: true });
  renderReadyTasks();
}

async function deleteReadyTask(id) {
  state.readyTasks = state.readyTasks.filter(t => t.id !== id);
  await saveTasks({ ready: true });
  renderReadyTasks();
}

async function clearCompletedReadyTasks() {
  const completedCount = state.readyTasks.filter(t => !!t.completed).length;
  if (completedCount === 0) {
    await showAppAlert('Nao ha tarefas concluidas para excluir.', { title: 'Nada para limpar', tone: 'info' });
    return;
  }
  const confirmed = await showAppConfirm(
    `Excluir ${completedCount} tarefa(s) pronta entrega concluida(s)?`,
    { title: 'Confirmar limpeza', confirmText: 'Excluir', tone: 'danger' }
  );
  if (!confirmed) {
    return;
  }
  state.readyTasks = state.readyTasks.filter(t => !t.completed);
  await saveTasks({ ready: true });
  renderReadyTasks();
}

// Administração - equipe
async function loadCompanyUsers() {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady && state.user && state.userProfile && state.userProfile.companyId && (canViewTeamPanel() || canAssignTasksToOthers()))) {
    return;
  }

  try {
    const db = firebase.firestore();
    const snapshot = await db.collection('users')
      .where('companyId', '==', state.userProfile.companyId)
      .get();

    state.companyUsers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderTeamList();
  } catch (e) {
    console.error('Erro ao carregar equipe da empresa:', e);
  }
}

function renderTeamList() {
  const listEl = document.getElementById('teamList');
  if (!listEl || !canViewTeamPanel()) return;

  if (!state.companyUsers.length) {
    listEl.innerHTML = `
      <p class="team-empty rounded-lg border border-dashed border-app-border bg-app-secondary/30 p-4 text-center text-sm text-app-muted">Nenhum colaborador encontrado nesta empresa.</p>
    `;
    refreshIcons();
    return;
  }

  listEl.innerHTML = state.companyUsers.map(user => {
    const role = user.role || 'member';
    const isSelf = user.id === state.user?.uid;
    const name = user.name || '(Sem nome)';
    const email = user.email || '';

    const roleOptions = [
      { value: 'admin', label: 'Administrador' },
      { value: 'gerente', label: 'Gerente' },
      { value: 'leader', label: 'Líder' },
      { value: 'member', label: 'Colaborador' }
    ].map(opt => {
      const selected = opt.value === role ? 'selected' : '';
      return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    }).join('');

    const selfBadge = isSelf ? '<span class="team-self-badge rounded-md bg-app-accent/20 px-2 py-0.5 text-xs font-semibold text-app-accent">Você</span>' : '';

    const excludeBtn = isSelf || !isAdmin() ? '' : `
      <button type="button" class="btn-danger team-exclude-btn inline-flex h-9 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20" aria-label="Excluir usuário" title="Excluir da empresa">
        Excluir
      </button>`;

    return `
      <div class="team-row mb-2 grid grid-cols-1 gap-2 rounded-lg border border-app-border bg-app-secondary/40 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center" data-id="${user.id}">
        <div class="team-col team-main">
          <div class="team-name flex items-center gap-2 text-sm font-semibold text-app-text">${escapeHtml(name)} ${selfBadge}</div>
          <div class="team-email text-xs text-app-muted md:text-sm">${escapeHtml(email)}</div>
        </div>
        <div class="team-col team-role-col">
          <select class="team-role h-9 w-full rounded-md border border-app-border bg-app-card px-2 text-sm text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/30 disabled:opacity-60" ${isSelf || !isAdmin() ? 'disabled' : ''}>
            ${roleOptions}
          </select>
        </div>
        <div class="team-col team-actions-col flex items-center gap-2">
          <button type="button" class="btn-secondary team-view-btn inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-card px-3 text-sm font-medium text-app-subtle transition-colors hover:text-app-text">
            Ver tarefas
          </button>
          ${excludeBtn}
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.team-row').forEach(row => {
    const userId = row.dataset.id;
    const viewBtn = row.querySelector('.team-view-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', async () => {
        await viewUserTasks(userId);
      });
    }
    const excludeBtn = row.querySelector('.team-exclude-btn');
    if (excludeBtn) {
      excludeBtn.addEventListener('click', () => excludeUserFromCompany(userId, row));
    }
  });
  refreshIcons();
}

async function excludeUserFromCompany(userId, rowEl) {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady && state.user && isAdmin())) {
    return;
  }
  const user = state.companyUsers.find(u => u.id === userId);
  const name = user?.name || user?.email || 'Este usuário';
  const confirmed = await showAppConfirm(
    `Excluir ${name} da empresa? Ele nao tera mais acesso as tarefas da empresa.`,
    { title: 'Excluir usuario da empresa', confirmText: 'Excluir', tone: 'danger' }
  );
  if (!confirmed) {
    return;
  }
  try {
    const db = firebase.firestore();
    await db.collection('users').doc(userId).update({
      companyId: firebase.firestore.FieldValue.delete(),
      role: 'member'
    });
    state.companyUsers = state.companyUsers.filter(u => u.id !== userId);
    if (state.viewingUserId === userId) {
      await exitViewMode();
    }
    renderTeamList();
  } catch (e) {
    console.error('Erro ao excluir usuário:', e);
    await showAppAlert('Nao foi possivel excluir o usuario. Tente novamente.', { title: 'Falha ao excluir', tone: 'danger' });
  }
}

async function saveTeamChanges() {
  if (!(typeof firebaseReady !== 'undefined' && firebaseReady && state.user && isAdmin())) {
    return;
  }

  const listEl = document.getElementById('teamList');
  if (!listEl) return;

  const rows = Array.from(listEl.querySelectorAll('.team-row'));
  if (!rows.length) return;

  const db = firebase.firestore();
  const batch = db.batch();
  let hasChanges = false;

  rows.forEach(row => {
    const userId = row.dataset.id;
    const roleSelect = row.querySelector('.team-role');

    const original = state.companyUsers.find(u => u.id === userId) || {};
    const newRole = roleSelect && !roleSelect.disabled ? roleSelect.value : (original.role || 'member');
    const currentRole = original.role || 'member';

    if (newRole !== currentRole) {
      const ref = db.collection('users').doc(userId);
      batch.update(ref, { role: newRole });
      hasChanges = true;

      original.role = newRole;
      if (state.userProfile && userId === state.user.uid) {
        state.userProfile.role = newRole;
      }
    }
  });

  if (!hasChanges) {
    await showAppAlert('Nenhuma alteracao para salvar.', { title: 'Sem alteracoes', tone: 'info' });
    return;
  }

  try {
    await batch.commit();
    await showAppAlert('Equipe atualizada com sucesso.', { title: 'Sucesso', tone: 'success' });
    renderTeamList();

    updateUserRoleAndCode();
  } catch (e) {
    console.error('Erro ao salvar alterações da equipe:', e);
    await showAppAlert('Erro ao salvar alteracoes da equipe. Tente novamente em alguns instantes.', { title: 'Falha ao salvar', tone: 'danger' });
  }
}

function getFrequencyLabel(freq, task) {
  const base = { daily: 'Diária', weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', specific: 'Específica' }[freq] || freq;
  if (freq === 'monthly' && task && task.monthDay === 0) return 'Mensal (último dia)';
  if (freq === 'weekly' && task) {
    const days = getTaskWeekDays(task);
    if (days.length) {
      const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const ordered = [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d));
      return `Semanal (${ordered.map(d => labels[d]).join(', ')})`;
    }
  }
  return base;
}

// Retorna uma data em que a tarefa aparece (para focar a tela após editar)
function getDisplayDateForTask(task) {
  if (!task) return state.selectedDate;
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  if (task.frequency === 'daily') return state.selectedDate;
  if (task.frequency === 'weekly') {
    const days = getTaskWeekDays(task);
    if (!days.length) return state.selectedDate;
    const lastDom = new Date(year, month + 1, 0).getDate();
    for (let dom = 1; dom <= lastDom; dom++) {
      const cand = new Date(year, month, dom, 12, 0, 0, 0);
      if (days.includes(cand.getDay())) return cand;
    }
    return state.selectedDate;
  }
  if (task.frequency === 'biweekly' && task.biweeklyStart != null && task.weekDay !== undefined) {
    const anchor = parseDateKeyLocal(task.biweeklyStart);
    if (!anchor) return state.selectedDate;
    const lastDom = new Date(year, month + 1, 0).getDate();
    for (let dom = 1; dom <= lastDom; dom++) {
      const cand = new Date(year, month, dom, 12, 0, 0, 0);
      if (matchesBiweeklyOnDate(task, cand)) return cand;
    }
    return anchor;
  }
  if (task.frequency === 'monthly') {
    return getMonthlyEffectiveDateForTask(task, state.currentDate, state.workingDays);
  }
  if (task.frequency === 'specific' && task.date) {
    const d = new Date(task.date + 'T12:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  return state.selectedDate;
}

function renderTasks() {
  const list = document.getElementById('taskList');
  let tasks = getTasksForDate(state.selectedDate);
  // Exibir apenas tarefas normais (não prontas-entrega) nesta lista
  tasks = tasks.filter(t => !t.isReadyTask);
  // Pendentes no topo, concluídas ao final
  tasks = [...tasks].sort((a, b) => {
    const aCompleted = isTaskCompleted(a, state.selectedDate);
    const bCompleted = isTaskCompleted(b, state.selectedDate);
    if (aCompleted === bCompleted) return 0;
    return aCompleted ? 1 : -1;
  });

  if (tasks.length === 0) {
    list.innerHTML = `
      <li class="empty-state rounded-xl border border-dashed border-app-border bg-app-secondary/30 p-4 text-center">
        <p class="mb-3 text-sm text-app-muted">Nenhuma tarefa para este dia</p>
        <button class="add-task-btn inline-flex h-10 items-center justify-center rounded-lg bg-app-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-app-accentHover" onclick="document.getElementById('addTaskBtn').click()">
          + Adicionar tarefa
        </button>
      </li>
    `;
    refreshIcons();
    return;
  }

  list.innerHTML = tasks.map(task => {
    const completed = isTaskCompleted(task, state.selectedDate);
    return `
      <li class="task-item ${completed ? 'completed' : ''} rounded-xl border border-app-border bg-app-secondary/40 p-3 transition-colors hover:bg-app-secondary/70" data-id="${task.id}">
        <div class="task-controls mb-2 flex items-center justify-between gap-2">
          <div class="task-checkbox h-5 w-5 rounded border border-app-border bg-app-card" role="button" tabindex="0" aria-label="Marcar como concluída"></div>
          <div class="task-actions flex items-center gap-1.5">
            <button class="task-edit inline-flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-app-card text-sm transition-colors hover:border-app-accent hover:text-app-accent" aria-label="Editar"><i data-lucide="pencil"></i></button>
            <button class="task-delete inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-lg leading-none text-red-300 transition-colors hover:bg-red-500/20" aria-label="Excluir"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="task-content flex flex-col items-center justify-center gap-2 text-center">
          <span class="task-title text-center text-sm font-medium text-app-text">${escapeHtml(task.title)}</span>
          <span class="task-badge ${task.frequency} rounded-md px-2 py-1 text-xs font-semibold">${getFrequencyLabel(task.frequency, task)}</span>
        </div>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.task-item').forEach(item => {
    const id = item.dataset.id;
    item.querySelector('.task-checkbox').addEventListener('click', () => toggleTaskComplete(id));
    const editBtn = item.querySelector('.task-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = state.tasks.find(t => t.id === id);
        if (task) openModal(task);
      });
    }
    item.querySelector('.task-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showAppConfirm('Excluir esta tarefa?', {
        title: 'Confirmar exclusao',
        confirmText: 'Excluir',
        tone: 'danger'
      });
      if (confirmed) await deleteTask(id);
    });
  });
  refreshIcons();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateSelectedDateTitle() {
  const title = document.getElementById('selectedDateTitle');
  if (!title) return;

  const d = state.selectedDate;
  if (!isWorkingDay(d, state.workingDays)) {
    title.textContent = `Empresa fechada em ${WEEKDAYS[d.getDay()]}`;
    return;
  }

  const isToday = isSameDay(d, new Date());
  const dateStr = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  title.textContent = isToday ? `Tarefas de hoje (${dateStr})` : `Tarefas de ${dateStr}`;
}

function updateViewingInfoBanner() {
  const el = document.getElementById('viewingInfo');
  if (!el) return;

  if (isViewingOtherUser() && state.viewingUserName) {
    el.style.display = 'flex';
    el.innerHTML = `
      <span class="viewing-info-text">Visualizando tarefas de ${escapeHtml(state.viewingUserName)}.</span>
      <button type="button" class="viewing-back-btn"><i data-lucide="arrow-left"></i> Voltar para minhas tarefas</button>
    `;
    const backBtn = el.querySelector('.viewing-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', async () => {
        await exitViewMode();
      });
    }
    refreshIcons();
  } else {
    el.style.display = 'none';
    el.textContent = '';
    el.onclick = null;
  }
}

// Modal tarefa
function openModal(task = null) {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const modalTitle = document.getElementById('modalTitle');
  const taskIdEl = document.getElementById('taskId');
  const frequencyGroup = document.getElementById('taskFrequency')?.closest('.form-group');

  form.reset();
  state.editingTaskId = null;
  state.editingReadyTaskId = null;

  if (task) {
    state.editingTaskId = task.id;
    modalTitle.textContent = 'Editar tarefa';
    if (taskIdEl) taskIdEl.value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskFrequency').value = task.frequency;
    if (task.date) document.getElementById('taskDate').value = task.date;
    if (task.weekDay !== undefined) document.getElementById('taskWeekDay').value = task.weekDay;
    const lastDayCb = document.getElementById('taskLastDayOfMonth');
    if (task.monthDay === 0) {
      if (lastDayCb) lastDayCb.checked = true;
      document.getElementById('taskMonthDay').value = '';
    } else {
      if (lastDayCb) lastDayCb.checked = false;
      document.getElementById('taskMonthDay').value = task.monthDay || 1;
    }
  } else {
    modalTitle.textContent = 'Nova tarefa';
    if (taskIdEl) taskIdEl.value = '';
    document.getElementById('taskDate').value = formatDateKey(state.selectedDate);
    const lastDayCb = document.getElementById('taskLastDayOfMonth');
    if (lastDayCb) lastDayCb.checked = false;
    document.getElementById('taskMonthDay').value = '1';
  }
  updateFrequencyFields(task?.frequency || 'daily');
  updateWeekDayOptions();

  if (task && task.frequency === 'weekly') {
    setTaskWeekDaysChecks(getTaskWeekDays(task));
  } else if (!task) {
    const selectedDay = state.selectedDate.getDay();
    if (getActiveWorkingDays().includes(selectedDay)) {
      setTaskWeekDaysChecks([selectedDay]);
    }
  }

  modal.classList.add('active');
  document.getElementById('taskTitle').focus();
}

// Modal tarefa pronta entrega (reutiliza o mesmo modal, sem frequência)
async function openReadyTaskModal(task = null) {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const modalTitle = document.getElementById('modalTitle');
  const assigneeGroup = document.getElementById('taskAssigneeGroup');
  const assigneeSelect = document.getElementById('taskAssignee');
  const frequencyGroup = document.getElementById('taskFrequency').closest('.form-group');

  form.reset();
  state.editingTaskId = null;
  state.editingReadyTaskId = null;

  // Esconde campos de recorrência para tarefas pronta entrega
  frequencyGroup.style.display = 'none';
  document.getElementById('datePickerGroup').style.display = 'none';
  document.getElementById('weekDayGroup').style.display = 'none';
  document.getElementById('weekDaysGroup').style.display = 'none';
  document.getElementById('monthDayGroup').style.display = 'none';

  // Para admins, gerentes e líderes, mostrar seleção de colaborador ao criar tarefa pronta entrega
  if (assigneeGroup && assigneeSelect) {
    if (canAssignTasksToOthers()) {
      if (!state.companyUsers.length) {
        await loadCompanyUsers();
      }
      assigneeGroup.style.display = 'block';
      // Limpa e popula opções
      assigneeSelect.innerHTML = '<option value=\"\">Selecione um colaborador</option>';
      // Sempre incluir o próprio admin
      if (state.user && state.user.email) {
        const opt = document.createElement('option');
        opt.value = state.user.uid;
        opt.textContent = `${state.user.email} (você)`;
        assigneeSelect.appendChild(opt);
      }
      // Tenta usar a lista carregada da equipe, se existir
      if (state.companyUsers && state.companyUsers.length) {
        state.companyUsers.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name ? `${u.name} (${u.email || ''})` : (u.email || u.id);
          assigneeSelect.appendChild(opt);
        });
      }
    } else {
      assigneeGroup.style.display = 'none';
    }
  }

  if (task) {
    state.editingReadyTaskId = task.id;
    modalTitle.textContent = 'Editar tarefa pronta entrega';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
  } else {
    modalTitle.textContent = 'Nova tarefa pronta entrega';
    document.getElementById('taskId').value = '';
  }

  modal.classList.add('active');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  document.getElementById('taskModal').classList.remove('active');
  state.editingTaskId = null;
}

function updateFrequencyFields(freq) {
  const dateGroup = document.getElementById('datePickerGroup');
  const weekGroup = document.getElementById('weekDayGroup');
  const weekDaysGroup = document.getElementById('weekDaysGroup');
  const monthGroup = document.getElementById('monthDayGroup');

  dateGroup.style.display = 'none';
  weekGroup.style.display = 'none';
  if (weekDaysGroup) weekDaysGroup.style.display = 'none';
  monthGroup.style.display = 'none';

  if (freq === 'weekly' && weekDaysGroup) weekDaysGroup.style.display = 'block';
  if (freq === 'biweekly') weekGroup.style.display = 'block';
  if (freq === 'monthly') monthGroup.style.display = 'block';
  if (freq === 'specific') dateGroup.style.display = 'block';
  updateWeekDayOptions();
}

function updateWeekDayOptions() {
  const select = document.getElementById('taskWeekDay');
  if (!select) return;

  const activeDays = getActiveWorkingDays();
  const previousValue = parseInt(select.value, 10);
  const labels = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  const optionsHtml = activeDays.map(day => `<option value="${day}">${labels[day]}</option>`).join('');

  select.innerHTML = optionsHtml;
  if (!activeDays.length) {
    select.innerHTML = '<option value="">Sem dias disponiveis</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  if (activeDays.includes(previousValue)) {
    select.value = String(previousValue);
  } else {
    select.value = String(activeDays[0]);
  }

  renderWeekDaysCheckboxes();
}

function renderWeekDaysCheckboxes() {
  const container = document.getElementById('taskWeekDaysOptions');
  if (!container) return;

  const activeDays = getActiveWorkingDays();
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const previouslyChecked = new Set(
    Array.from(container.querySelectorAll('.task-weekday-input:checked'))
      .map(i => parseInt(i.value, 10))
  );

  if (!activeDays.length) {
    container.innerHTML = '<p class="text-xs text-app-muted">Sem dias disponíveis (configure os dias de funcionamento).</p>';
    return;
  }

  const order = [1, 2, 3, 4, 5, 6, 0].filter(day => activeDays.includes(day));
  container.innerHTML = order.map(day => `
    <label class="day-option inline-flex items-center justify-center gap-1 rounded-lg border border-app-border bg-app-secondary px-2 py-2 text-sm">
      <input type="checkbox" class="task-weekday-input" value="${day}" ${previouslyChecked.has(day) ? 'checked' : ''}>
      ${labels[day]}
    </label>`).join('');
}

function setTaskWeekDaysChecks(days) {
  const container = document.getElementById('taskWeekDaysOptions');
  if (!container) return;
  const wanted = new Set((days || []).map(Number));
  container.querySelectorAll('.task-weekday-input').forEach(input => {
    input.checked = wanted.has(parseInt(input.value, 10));
  });
}

function getSelectedTaskWeekDays() {
  const container = document.getElementById('taskWeekDaysOptions');
  if (!container) return [];
  return Array.from(container.querySelectorAll('.task-weekday-input:checked'))
    .map(i => parseInt(i.value, 10))
    .filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
}

async function purgeTasksOutsideWorkingDays() {
  const activeDays = getActiveWorkingDays();
  const activeSet = new Set(activeDays);
  const originalCount = state.tasks.length;

  state.tasks = state.tasks.filter(task => {
    if (task.frequency === 'weekly') {
      const validDays = getTaskWeekDays(task).filter(d => activeSet.has(d));
      if (validDays.length) task.weekDays = validDays;
      return validDays.length > 0;
    }
    if (task.frequency === 'biweekly') {
      return activeSet.has(task.weekDay);
    }
    if (task.frequency === 'specific' && task.date) {
      const specificDate = parseDateKeyLocal(task.date);
      return specificDate ? activeSet.has(specificDate.getDay()) : true;
    }
    return true;
  });

  const removedCount = originalCount - state.tasks.length;
  if (removedCount > 0) {
    await saveTasks({ tasks: true });
    showScreenNotification(
      `${removedCount} tarefa(s) removida(s) por estarem em dias sem funcionamento.`,
      'info'
    );
  }
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value.trim();
  const frequencyField = document.getElementById('taskFrequency');
  const frequency = frequencyField && frequencyField.closest('.form-group').style.display !== 'none'
    ? frequencyField.value
    : null;
  const taskIdInput = document.getElementById('taskId');
  const taskId = (taskIdInput && taskIdInput.value) ? String(taskIdInput.value).trim() : '';

  // Se o campo de frequência estiver escondido, trata como tarefa pronta entrega
  if (!frequency) {
    const readyId = taskId || 'ready-' + Date.now();
    const taskData = {
      id: readyId,
      title,
      completed: false
    };

    const assigneeSelect = document.getElementById('taskAssignee');
    const assigneeGroupVisible = assigneeSelect && assigneeSelect.closest('.form-group').style.display !== 'none';

    // Admin ao designar tarefa pronta entrega deve sempre selecionar um colaborador (evita bug de gravar no perfil errado)
    if (canAssignTasksToOthers() && assigneeGroupVisible) {
      if (!assigneeSelect.value || assigneeSelect.value.trim() === '') {
        await showAppAlert('Selecione um colaborador para atribuir a tarefa.', {
          title: 'Colaborador obrigatorio',
          tone: 'warning'
        });
        return;
      }
    }

    let targetUserId = state.user?.uid;
    if (canAssignTasksToOthers() && assigneeGroupVisible && assigneeSelect.value) {
      targetUserId = assigneeSelect.value;
    }

    // Se a tarefa pronta entrega for do próprio usuário logado
    if (!targetUserId || targetUserId === state.user?.uid) {
      if (state.editingReadyTaskId) {
        state.readyTasks = state.readyTasks.map(t => t.id === state.editingReadyTaskId ? { ...t, ...taskData } : t);
      } else {
        state.readyTasks.push(taskData);
      }

      await saveTasks({ ready: true });
      closeModal();
      renderReadyTasks();
    } else {
      // Atribui tarefa para outro colaborador no Firestore
      try {
        const db = firebase.firestore();
        const ref = db.collection('users').doc(targetUserId).collection('tasks').doc('data');
        const snap = await ref.get();
        const data = snap.exists ? snap.data() : {};
        const readyTasks = data.readyTasks || [];

        if (state.editingReadyTaskId) {
          // Atualização simples: substitui por id nos dados remotos
          const idx = readyTasks.findIndex(t => t.id === state.editingReadyTaskId);
          if (idx >= 0) {
            readyTasks[idx] = { ...readyTasks[idx], ...taskData };
          } else {
            readyTasks.push(taskData);
          }
        } else {
          readyTasks.push(taskData);
        }

        // merge: grava apenas o array de pronta entrega, preservando as
        // tarefas recorrentes do colaborador sem reescrever o documento todo.
        await ref.set({
          readyTasks,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Se estivermos visualizando este colaborador, atualiza a lista local também
        if (isViewingOtherUser() && state.viewingUserId === targetUserId) {
          if (state.editingReadyTaskId) {
            state.readyTasks = state.readyTasks.map(t => t.id === state.editingReadyTaskId ? { ...t, ...taskData } : t);
          } else {
            state.readyTasks.push(taskData);
          }
          renderReadyTasks();
        }

        closeModal();
        await showAppAlert('Tarefa pronta entrega atribuida com sucesso.', {
          title: 'Sucesso',
          tone: 'success'
        });
      } catch (err) {
        console.error('Erro ao atribuir tarefa pronta entrega para colaborador:', err);
        await showAppAlert('Nao foi possivel atribuir a tarefa para o colaborador.', {
          title: 'Falha ao atribuir',
          tone: 'danger'
        });
      }
    }
    return;
  } else {
    const taskData = {
      id: taskId || 'task-' + Date.now(),
      title,
      frequency,
      completedDates: []
    };

    if (frequency === 'weekly') {
      const activeDays = getActiveWorkingDays();
      const selectedDays = getSelectedTaskWeekDays().filter(d => activeDays.includes(d));
      if (!selectedDays.length) {
        showScreenNotification(
          'Selecione ao menos um dia da semana em que a empresa trabalha.',
          'warning'
        );
        return;
      }
      taskData.weekDays = [...new Set(selectedDays)].sort((a, b) => a - b);
    }
    if (frequency === 'biweekly') {
      taskData.weekDay = parseInt(document.getElementById('taskWeekDay').value, 10);
      if (!getActiveWorkingDays().includes(taskData.weekDay)) {
        showScreenNotification(
          'Nao e possivel agendar uma tarefa para esta data pois a empresa nao trabalha no dia especifico.',
          'warning'
        );
        return;
      }
      const existingForAnchor = taskId ? state.tasks.find(t => t.id === taskId) : null;
      const wd = taskData.weekDay;
      if (existingForAnchor && existingForAnchor.frequency === 'biweekly' &&
          existingForAnchor.biweeklyStart && existingForAnchor.weekDay === wd) {
        taskData.biweeklyStart = existingForAnchor.biweeklyStart;
      } else {
        taskData.biweeklyStart = formatDateKey(firstWeekDayOnOrAfter(state.selectedDate, wd));
      }
    }
    if (frequency === 'monthly') {
      const lastDayCb = document.getElementById('taskLastDayOfMonth');
      if (lastDayCb && lastDayCb.checked) {
        taskData.monthDay = 0; // último dia do mês
      } else {
        const day = parseInt(document.getElementById('taskMonthDay').value, 10);
        taskData.monthDay = Math.min(31, Math.max(1, day || 1));
      }
    }
    if (frequency === 'specific') {
      taskData.date = document.getElementById('taskDate').value;
      const specificDate = parseDateKeyLocal(taskData.date);
      if (specificDate && !isWorkingDay(specificDate, state.workingDays)) {
        showScreenNotification(
          `Nao e possivel agendar para ${getWorkingDayLabel(specificDate.getDay())}, pois a empresa nao trabalha nesse dia.`,
          'warning'
        );
        return;
      }
    }

    // Usar sempre o ID do formulário para saber qual tarefa atualizar (evita bug de atualizar a errada)
    const idToUpdate = taskId || null;
    const existing = idToUpdate ? state.tasks.find(t => t.id === idToUpdate) : null;

    if (existing) {
      taskData.id = existing.id;
      taskData.completedDates = existing.completedDates || [];
      state.tasks = state.tasks.map(t => t.id === existing.id ? taskData : t);
      // Após editar, focar na data em que a tarefa passa a aparecer para não "sumir"
      state.selectedDate = getDisplayDateForTask(taskData);
    } else {
      state.tasks.push(taskData);
    }
  }

  await saveTasks({ tasks: true });
  closeModal();
  renderCalendar();
  renderTasks();
  updateSelectedDateTitle();
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  normalizeCanonicalUrl();

  const ultraMode = localStorage.getItem('ultraMode');
  if (ultraMode === 'crm' || ultraMode === 'api') {
    window.location.href = '/hub';
    return;
  }

  applySettings(loadSettings());

  // Auth
  if (typeof firebaseReady !== 'undefined' && firebaseReady) {
    firebase.auth().onAuthStateChanged(async (user) => {
      state.user = user;
      const logoutBtn = document.getElementById('logoutBtn');
      const userEmail = document.getElementById('userEmail');
      if (user) {
        userEmail.textContent = user.displayName || user.email;
        userEmail.style.display = 'inline';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      } else {
        navigateToRoute('auth');
        return;
      }
      await loadTasks();
      updateHeaderUserIdentity();
      startPresenceHeartbeat();
      initApp();
    });
  } else {
    document.getElementById('userEmail').style.display = 'none';
    await loadTasks();
    initApp();
  }
});

function updateHeaderUserIdentity() {
  const userEl = document.getElementById('userEmail');
  if (!userEl) return;
  const profileName = state.userProfile?.name ? String(state.userProfile.name).trim() : '';
  const displayName = profileName || state.user?.displayName || state.user?.email || '';
  userEl.textContent = displayName;
  userEl.style.display = displayName ? 'inline' : 'none';
}

function initApp() {
  updateDailyMessage();
  initMobileSectionsNav();

  // Navegação calendário
  document.getElementById('prevMonth').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById('addTaskBtn').addEventListener('click', () => {
    // Garante que campos de recorrência apareçam para tarefas normais
    document.getElementById('taskFrequency').closest('.form-group').style.display = 'block';
    updateFrequencyFields('daily');
    openModal();
  });

  const addReadyTaskBtn = document.getElementById('addReadyTaskBtn');
  if (addReadyTaskBtn) {
    addReadyTaskBtn.addEventListener('click', () => openReadyTaskModal());
  }
  const clearCompletedReadyBtn = document.getElementById('clearCompletedReadyBtn');
  if (clearCompletedReadyBtn) {
    clearCompletedReadyBtn.addEventListener('click', () => {
      clearCompletedReadyTasks();
    });
  }

  document.getElementById('taskFrequency').addEventListener('change', (e) => {
    updateFrequencyFields(e.target.value);
    if (e.target.value === 'weekly' && !getSelectedTaskWeekDays().length) {
      const selectedDay = state.selectedDate.getDay();
      if (getActiveWorkingDays().includes(selectedDay)) {
        setTaskWeekDaysChecks([selectedDay]);
      }
    }
  });

  document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);

  document.getElementById('taskModal').addEventListener('click', (e) => {
    if (e.target.id === 'taskModal') closeModal();
  });

  // Configurações
  const settings = loadSettings();
  const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
  if (themeRadio) themeRadio.checked = true;
  updateAccentPickerUI(settings.accent);
  document.querySelectorAll('.size-option').forEach(o => o.classList.remove('active'));
  document.querySelector(`.size-option[data-size="${settings.fontSize}"]`)?.classList.add('active');

  // Dias de funcionamento (empresa)
  const workingDays = (state.workingDays && state.workingDays.length)
    ? state.workingDays
    : getDefaultWorkingDays();
  const dayCheckboxes = document.querySelectorAll('.working-day-input');
  dayCheckboxes.forEach(cb => {
    const val = parseInt(cb.value, 10);
    cb.checked = workingDays.includes(val);

    // Apenas administradores podem alterar os dias de funcionamento
    if (!isAdmin()) {
      cb.disabled = true;
    }
  });
  updateWeekDayOptions();

  document.getElementById('refreshTasksBtn')?.addEventListener('click', () => {
    refreshTasks();
  });

  document.getElementById('allTasksBtn')?.addEventListener('click', openAllTasksModal);
  document.getElementById('closeAllTasks')?.addEventListener('click', closeAllTasksModal);
  document.getElementById('cancelAllTasksBtn')?.addEventListener('click', closeAllTasksModal);
  document.getElementById('allTasksModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'allTasksModal') closeAllTasksModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('allTasksModal');
      if (modal && modal.classList.contains('active')) closeAllTasksModal();
    }
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('active');
  });

  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
  });

  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') e.target.classList.remove('active');
  });

  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const s = loadSettings();
      s.theme = e.target.value;
      saveSettings(s);
    });
  });

  const accentPickerBtn = document.getElementById('accentPickerBtn');
  const accentColorInput = document.getElementById('accentColorInput');
  if (accentPickerBtn && accentColorInput) {
    accentPickerBtn.addEventListener('click', () => {
      accentColorInput.click();
    });
    accentColorInput.addEventListener('input', (e) => {
      const chosen = normalizeHexColor(e.target.value);
      if (!chosen) return;
      const s = loadSettings();
      s.accent = chosen;
      saveSettings(s);
      updateAccentPickerUI(chosen);
    });
  }

  document.querySelectorAll('.size-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const s = loadSettings();
      s.fontSize = btn.dataset.size;
      saveSettings(s);
    });
  });

  // Atualizar dias de funcionamento ao marcar/desmarcar (apenas admin)
  if (isAdmin()) {
    document.querySelectorAll('.working-day-input').forEach(cb => {
      cb.addEventListener('change', async () => {
        const selected = Array.from(document.querySelectorAll('.working-day-input'))
          .filter(c => c.checked)
          .map(c => parseInt(c.value, 10));

        state.workingDays = selected.length ? selected : getDefaultWorkingDays();
        updateWeekDayOptions();
        await purgeTasksOutsideWorkingDays();
        await saveCompanyWorkingDays();
        renderCalendar();
        renderTasks();
        updateSelectedDateTitle();
      });
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const user = firebase.auth().currentUser;
        if (user) {
          const token = await user.getIdToken();
          await fetch('/api/presence/offline', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (_) {}
      firebase.auth().signOut();
      navigateToRoute('auth');
    }
  });

  // Painel de equipe (apenas administradores)
  const teamBtn = document.getElementById('teamBtn');
  const teamModal = document.getElementById('teamModal');
  if (teamBtn && teamModal && canViewTeamPanel()) {
    teamBtn.style.display = 'inline-flex';

    const closeTeamModal = async () => {
      teamModal.classList.remove('active');
      // Ao sair do painel da equipe, sempre voltar para as tarefas do administrador.
      if (isViewingOtherUser()) {
        await exitViewMode();
      }
    };

    teamBtn.addEventListener('click', async () => {
      await loadCompanyUsers();
      teamModal.classList.add('active');
    });

    document.getElementById('closeTeam')?.addEventListener('click', async () => {
      await closeTeamModal();
    });

    document.getElementById('cancelTeamBtn')?.addEventListener('click', async () => {
      await closeTeamModal();
    });

    teamModal.addEventListener('click', async (e) => {
      if (e.target.id === 'teamModal') {
        await closeTeamModal();
      }
    });

    document.getElementById('saveTeamBtn')?.addEventListener('click', () => {
      saveTeamChanges();
    });
  } else if (teamBtn) {
    // Garante que o botão não apareça para não-admins
    teamBtn.style.display = 'none';
  }

  // PWA Install
  let deferredPrompt;
  const installBtn = document.getElementById('installBtn');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (installBtn && isStandalone) {
    installBtn.style.display = 'none';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
  });

  document.getElementById('installBtn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted' && installBtn) installBtn.style.display = 'none';
      deferredPrompt = null;
      return;
    }

    if (isIos && !isStandalone) {
      await showAppAlert(
        'Para instalar no iPhone/iPad, abra no Safari e use Compartilhar > Adicionar a Tela de Inicio.',
        { title: 'Instalacao no iOS', tone: 'info' }
      );
      return;
    }

    await showAppAlert(
      'Instalacao indisponivel neste momento. Tente pelo menu do navegador: "Instalar app" ou "Adicionar a tela inicial".',
      { title: 'Instalacao indisponivel', tone: 'info' }
    );
  });

  renderCalendar();
  renderTasks();
  renderReadyTasks();
  updateSelectedDateTitle();
  updateMobileSectionVisibility();

  updateUserRoleAndCode();
  refreshIcons();
}

function initMobileSectionsNav() {
  const nav = document.getElementById('mobileSectionsNav');
  if (!nav) return;

  nav.querySelectorAll('.mobile-section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mobileSection = btn.dataset.section || 'agenda';
      updateMobileSectionVisibility();
    });
  });

  window.addEventListener('resize', updateMobileSectionVisibility);
}

function updateMobileSectionVisibility() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const nav = document.getElementById('mobileSectionsNav');
  const buttons = nav ? Array.from(nav.querySelectorAll('.mobile-section-btn')) : [];
  const sections = Array.from(document.querySelectorAll('[data-mobile-section]'));
  const readySection = document.querySelector('.ready-tasks-section');
  const calendarSection = document.querySelector('.calendar-section');
  const tasksSection = document.querySelector('.tasks-section');

  if (!isMobile) {
    if (nav) nav.style.display = 'none';
    sections.forEach(section => {
      section.classList.remove('is-active');
      section.style.display = '';
    });
    return;
  }

  if (nav) nav.style.display = 'grid';
  if (!['ready', 'agenda'].includes(state.mobileSection)) {
    state.mobileSection = 'agenda';
  }

  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === state.mobileSection);
  });

  // Controle explícito das 3 seções para evitar sobreposição no mobile.
  if (state.mobileSection === 'ready') {
    if (readySection) {
      readySection.classList.add('is-active');
      readySection.style.display = 'block';
    }
    if (calendarSection) {
      calendarSection.classList.remove('is-active');
      calendarSection.style.display = 'none';
    }
    if (tasksSection) {
      tasksSection.classList.remove('is-active');
      tasksSection.style.display = 'none';
    }
    return;
  }

  if (readySection) {
    readySection.classList.remove('is-active');
    readySection.style.display = 'none';
  }
  if (calendarSection) {
    calendarSection.classList.add('is-active');
    calendarSection.style.display = 'block';
  }
  if (tasksSection) {
    tasksSection.classList.add('is-active');
    tasksSection.style.display = 'block';
  }
}

function updateUserRoleAndCode() {
  const wrap = document.getElementById('userRoleCodeWrap');
  if (!wrap || !state.userProfile) return;

  const roleLabel = state.userProfile.role === 'admin' ? 'Administrador' :
    state.userProfile.role === 'gerente' ? 'Gerente' :
    state.userProfile.role === 'leader' ? 'Líder' : 'Colaborador';
  const companyCode = (state.userProfile.companyId || '').trim();
  const showCodeBox = isAdmin() && companyCode;

  const roleClass = state.userProfile.role === 'admin' ? 'role-badge role-admin' :
    state.userProfile.role === 'gerente' ? 'role-badge role-gerente' :
    state.userProfile.role === 'leader' ? 'role-badge role-leader' : 'role-badge role-collab';

  let html = `<span class="${roleClass}">${roleLabel}</span>`;
  if (showCodeBox) {
    html += `
      <div class="company-code-box">
        <span class="company-code-label">Código da empresa</span>
        <span class="company-code-value" data-code="${escapeHtml(companyCode)}">${escapeHtml(companyCode)}</span>
        <button type="button" class="company-code-copy-btn" aria-label="Copiar código">Copiar</button>
      </div>`;
  }
  wrap.innerHTML = html;

  const copyBtn = wrap.querySelector('.company-code-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const codeEl = wrap.querySelector('.company-code-value');
      const code = (codeEl?.dataset?.code ?? codeEl?.textContent ?? '').trim();
      if (!code) return;

      function showCopied() {
        copyBtn.textContent = 'Copiado!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copiar';
          copyBtn.classList.remove('copied');
        }, 2000);
      }

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(code);
          showCopied();
          return;
        }
      } catch (_) {}

      // Fallback para HTTP ou navegadores sem Clipboard API
      try {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, code.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) showCopied();
      } catch (_) {}
    });
  }
}
