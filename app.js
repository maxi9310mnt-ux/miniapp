// === Telegram WebApp ===
const tg = window.Telegram?.WebApp || {};
if (tg.ready) tg.ready();
if (tg.expand) tg.expand();

// === Мок-данные (заглушка вместо сервера) ===
const MOCK = {
  categories: ["Танцы у пилона", "Трюки на пилоне", "Растяжка"],
  trainers: {
    "Танцы у пилона": [
      { id: 1, name: "Анна" },
      { id: 2, name: "Мария" },
    ],
    "Трюки на пилоне": [
      { id: 3, name: "Дмитрий" },
      { id: 4, name: "Игорь" },
    ],
    "Растяжка": [
      { id: 5, name: "Ольга" },
      { id: 6, name: "Екатерина" },
    ],
  },
  // Занятые слоты для примера — можно показать, что что-то недоступно
  busy: {
    // ключ: "YYYY-MM-DD|trainer_id"
    // значение: массив занятых start-времени
  },
  slots: ["10:00", "11:00", "12:00", "13:00", "15:00", "16:00", "17:00", "18:00", "19:00"],
  maxPerSlot: 3,
};

// === Состояние приложения ===
const state = {
  user: null,
  name: null,
  category: null,
  trainer: null,
  date: null,
  start: null,
  end: null,
};

// === Работа с localStorage ===
function loadUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}
function saveUser(data) {
  localStorage.setItem("user", JSON.stringify(data));
}
function loadBookings() {
  try {
    return JSON.parse(localStorage.getItem("bookings") || "[]");
  } catch {
    return [];
  }
}
function saveBooking(b) {
  const all = loadBookings();
  all.push(b);
  localStorage.setItem("bookings", JSON.stringify(all));
}

// === Навигация между экранами ===
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (tg.BackButton) tg.BackButton.show();
}

// === Утилиты ===
function pad2(n) { return String(n).padStart(2, "0"); }
function formatMonth(m) { return pad2(m); }
function endTime(start) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + 60; // слот 1 час
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}
function showAlert(text) {
  if (tg.showAlert) tg.showAlert(text);
  else alert(text);
}

// === Инициализация ===
function init() {
  const saved = loadUser();
  if (saved?.name) {
    state.name = saved.name;
    showScreen("screen-category");
    renderCategories();
    return;
  }

  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    state.user = tgUser;
    const firstName = tgUser.first_name || "";
    document.getElementById("welcome-text").textContent =
      `Это ${firstName}, верно?`;
    document.getElementById("name-input").value =
      `${firstName} ${tgUser.last_name || ""}`.trim();
  } else {
    document.getElementById("welcome-text").textContent =
      "Заполни имя, чтобы продолжить.";
  }

  showScreen("screen-register");
}

// === Регистрация ===
document.getElementById("btn-save-name").addEventListener("click", () => {
  const name = document.getElementById("name-input").value.trim();
  if (name.length < 2) {
    showAlert("Введите имя (мин. 2 символа)");
    return;
  }
  state.name = name;
  saveUser({ name, tg_id: state.user?.id || null });

  renderCategories();
  showScreen("screen-category");
});

// === Категории ===
function renderCategories() {
  const container = document.getElementById("category-list");
  container.innerHTML = "";
  MOCK.categories.forEach(cat => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="item-title">${cat}</div>`;
    div.onclick = () => {
      state.category = cat;
      renderTrainers(cat);
      showScreen("screen-trainer");
    };
    container.appendChild(div);
  });
}

document.getElementById("btn-back-to-cat").onclick = () =>
  showScreen("screen-category");

// === Тренеры ===
function renderTrainers(category) {
  const trainers = MOCK.trainers[category] || [];
  const container = document.getElementById("trainer-list");
  container.innerHTML = "";
  trainers.forEach(t => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="item-title">👤 ${t.name}</div>`;
    div.onclick = () => {
      state.trainer = t;
      state.date = null;
      currentYear = new Date().getFullYear();
      currentMonth = new Date().getMonth() + 1;
      renderCalendar();
      showScreen("screen-date");
    };
    container.appendChild(div);
  });
}

document.getElementById("btn-back-to-trn").onclick = () =>
  showScreen("screen-trainer");

// === Календарь ===
let currentYear, currentMonth;

function renderCalendar() {
  const container = document.getElementById("calendar-container");
  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  let html = `
    <div class="calendar-header">
      <button id="cal-prev">◀</button>
      <span>${currentMonth}.${currentYear}</span>
      <button id="cal-next">▶</button>
    </div>
    <div class="calendar-grid">
      ${dayNames.map(d => `<div class="calendar-day empty">${d}</div>`).join("")}
  `;

  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const offset = (firstDay + 6) % 7;
  for (let i = 0; i < offset; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth - 1, d);
    const dateStr = `${currentYear}-${pad2(currentMonth)}-${pad2(d)}`;
    const dayOfWeek = dateObj.getDay(); // 0 = Вс, 6 = Сб

    // Доступность: не в прошлом + не воскресенье
    const isPast = dateObj < today;
    const isSunday = dayOfWeek === 0;
    const available = !isPast && !isSunday;

    const cls = available ? "calendar-day" : "calendar-day disabled";
    if (available) {
      html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    } else {
      html += `<div class="${cls}">${d}</div>`;
    }
  }

  html += `</div>`;
  container.innerHTML = html;

  document.getElementById("cal-prev").onclick = () => {
    currentMonth--;
    if (currentMonth === 0) { currentMonth = 12; currentYear--; }
    renderCalendar();
  };
  document.getElementById("cal-next").onclick = () => {
    currentMonth++;
    if (currentMonth === 13) { currentMonth = 1; currentYear++; }
    renderCalendar();
  };

  container.querySelectorAll(".calendar-day[data-date]").forEach(el => {
    el.onclick = () => {
      state.date = el.dataset.date;
      renderSlots();
      showScreen("screen-time");
    };
  });
}

document.getElementById("btn-back-to-date").onclick = () =>
  showScreen("screen-date");

// === Слоты ===
function renderSlots() {
  const container = document.getElementById("time-list");
  container.innerHTML = "";

  // Проверяем занятость (из localStorage)
  const bookings = loadBookings();
  const key = `${state.date}|${state.trainer.id}`;
  const takenCount = bookings.filter(b =>
    b.date === state.date && b.trainer_id === state.trainer.id
  ).length;

  MOCK.slots.forEach(slot => {
    const end = endTime(slot);
    const left = MOCK.maxPerSlot - takenCount;
    const available = left > 0;

    const div = document.createElement("div");
    div.className = available ? "item" : "item disabled";
    div.innerHTML = `
      <div class="item-title">${slot} – ${end}</div>
      <div class="item-sub">${available ? left + " мест" : "мест нет"}</div>
    `;
    if (available) {
      div.onclick = () => book(slot, end);
    }
    container.appendChild(div);
  });
}

// === Запись ===
function book(start, end) {
  state.start = start;
  state.end = end;

  const booking = {
    user_name: state.name,
    tg_id: state.user?.id || null,
    category: state.category,
    trainer_id: state.trainer.id,
    trainer_name: state.trainer.name,
    date: state.date,
    start,
    end,
    created_at: new Date().toISOString(),
  };
  saveBooking(booking);

  document.getElementById("success-text").innerHTML =
    `🎯 ${state.category}<br>` +
    `👤 ${state.trainer.name}<br>` +
    `📅 ${state.date}<br>` +
    `🕐 ${start} – ${end}`;

  if (tg.HapticFeedback?.notificationOccurred) {
    tg.HapticFeedback.notificationOccurred("success");
  }
  showScreen("screen-success");
}

document.getElementById("btn-done").onclick = () => {
  if (tg.close) tg.close();
};

// === Кнопка «Назад» Telegram ===
if (tg.BackButton) {
  tg.BackButton.onClick(() => {
    const current = document.querySelector(".screen.active")?.id;
    const map = {
      "screen-category": "screen-register",
      "screen-trainer": "screen-category",
      "screen-date": "screen-trainer",
      "screen-time": "screen-date",
      "screen-success": "screen-time",
    };
    if (map[current]) showScreen(map[current]);
  });
}

// === Запуск ===
init();
