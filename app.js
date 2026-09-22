// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Состояние приложения
const state = {
  user: null,
  name: null,
  category: null,
  trainer: null,
  date: null,
  time: null,
};

// === API (замени на свой адрес) ===
const API_BASE = 'https://твой-домен.com/api';

// === Вспомогательные функции ===
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  tg.BackButton.show(); // показываем кнопку «назад» в Telegram
}

async function apiCall(endpoint, options = {}) {
  const initData = tg.initData;
  if (!initData) throw new Error('Нет initData — откройте из Telegram');

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${initData}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Ошибка сервера');
  }
  return res.json();
}

// === Инициализация ===
async function init() {
  // Данные пользователя из Telegram
  if (tg.initDataUnsafe?.user) {
    state.user = tg.initDataUnsafe.user;
    const firstName = state.user.first_name || '';
    document.getElementById('welcome-text').textContent =
      `Это ${firstName}, верно?`;
    document.getElementById('name-input').value =
      `${firstName} ${state.user.last_name || ''}`.trim();
  } else {
    document.getElementById('welcome-text').textContent =
      'Заполни имя, чтобы продолжить.';
  }

  // Проверяем, зарегистрирован ли пользователь
  try {
    const me = await apiCall('/me');
    if (me.name) {
      state.name = me.name;
      await loadCategories();
      showScreen('screen-category');
      return;
    }
  } catch (e) {
    console.log('Не зарегистрирован');
  }

  showScreen('screen-register');
}

// === Экран регистрации ===
document.getElementById('btn-save-name').addEventListener('click', async () => {
  const name = document.getElementById('name-input').value.trim();
  if (name.length < 2) {
    tg.showAlert('Введите имя (мин. 2 символа)');
    return;
  }
  try {
    await apiCall('/register', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    state.name = name;
    await loadCategories();
    showScreen('screen-category');
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
});

// === Категории ===
async function loadCategories() {
  const cats = await apiCall('/categories');
  const container = document.getElementById('category-list');
  container.innerHTML = '';
  cats.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<div class="item-title">${cat}</div>`;
    div.onclick = () => {
      state.category = cat;
      loadTrainers(cat);
      showScreen('screen-trainer');
    };
    container.appendChild(div);
  });
}

document.getElementById('btn-back-to-cat').onclick = () =>
  showScreen('screen-category');

// === Тренеры ===
async function loadTrainers(category) {
  const trainers = await apiCall(`/trainers?category=${encodeURIComponent(category)}`);
  const container = document.getElementById('trainer-list');
  container.innerHTML = '';
  trainers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<div class="item-title">👤 ${t.name}</div>`;
    div.onclick = () => {
      state.trainer = t;
      state.date = null;
      loadCalendar();
      showScreen('screen-date');
    };
    container.appendChild(div);
  });
}

document.getElementById('btn-back-to-trn').onclick = () =>
  showScreen('screen-trainer');

// === Календарь ===
let currentYear, currentMonth;

async function loadCalendar() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth() + 1;
  renderCalendar();
}

async function renderCalendar() {
  // Запрашиваем доступные дни у сервера
  const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const days = await apiCall(
    `/calendar?trainer_id=${state.trainer.id}&month=${monthStr}`
  );

  const container = document.getElementById('calendar-container');
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let html = `
    <div class="calendar-header">
      <button id="cal-prev">◀</button>
      <span>${currentMonth}.${currentYear}</span>
      <button id="cal-next">▶</button>
    </div>
    <div class="calendar-grid">
      ${dayNames.map(d => `<div class="calendar-day empty">${d}</div>`).join('')}
  `;

  // Первый день месяца (0 = Пн, 6 = Вс)
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const offset = (firstDay + 6) % 7;
  for (let i = 0; i < offset; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  // Дни месяца
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const info = days[dateStr];
    const cls = info?.available ? 'calendar-day' : 'calendar-day disabled';
    html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Навигация
  document.getElementById('cal-prev').onclick = () => {
    currentMonth--;
    if (currentMonth === 0) { currentMonth = 12; currentYear--; }
    renderCalendar();
  };
  document.getElementById('cal-next').onclick = () => {
    currentMonth++;
    if (currentMonth === 13) { currentMonth = 1; currentYear++; }
    renderCalendar();
  };

  // Клик по дню
  container.querySelectorAll('.calendar-day[data-date]').forEach(el => {
    el.onclick = () => {
      state.date = el.dataset.date;
      loadTimes();
      showScreen('screen-time');
    };
  });
}

document.getElementById('btn-back-to-date').onclick = () =>
  showScreen('screen-date');

// === Время ===
async function loadTimes() {
  const times = await apiCall(
    `/slots?trainer_id=${state.trainer.id}&date=${state.date}`
  );
  const container = document.getElementById('time-list');
  container.innerHTML = '';
  times.forEach(slot => {
    const div = document.createElement('div');
    const cls = slot.available ? 'item' : 'item disabled';
    div.className = cls;
    const left = slot.left ?? 0;
    div.innerHTML = `
      <div class="item-title">${slot.start} – ${slot.end}</div>
      <div class="item-sub">${slot.available ? left + ' мест' : 'мест нет'}</div>
    `;
    if (slot.available) {
      div.onclick = () => book(slot);
    }
    container.appendChild(div);
  });
}

// === Запись ===
async function book(slot) {
  try {
    await apiCall('/book', {
      method: 'POST',
      body: JSON.stringify({
        trainer_id: state.trainer.id,
        category: state.category,
        date: state.date,
        start: slot.start,
        end: slot.end,
      }),
    });
    document.getElementById('success-text').innerHTML =
      `🎯 ${state.category}<br>👤 ${state.trainer.name}<br>📅 ${state.date}<br>🕐 ${slot.start} – ${slot.end}`;
    showScreen('screen-success');
    tg.HapticFeedback.notificationOccurred('success');
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
}

document.getElementById('btn-done').onclick = () => tg.close();

// Навигация «Назад» через Telegram
tg.BackButton.onClick(() => {
  const current = document.querySelector('.screen.active').id;
  const map = {
    'screen-category': 'screen-register',
    'screen-trainer': 'screen-category',
    'screen-date': 'screen-trainer',
    'screen-time': 'screen-date',
    'screen-success': 'screen-time',
  };
  if (map[current]) showScreen(map[current]);
});

// Запуск
init().catch(e => {
  tg.showAlert('Ошибка инициализации: ' + e.message);
});
