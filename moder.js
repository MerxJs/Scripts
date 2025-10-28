(function () {
  'use strict';
  const CONFIG = {
    MAX_ACTIVE: 3,
    STATUS_LABEL: 'Модерация',
    HOTKEY_CODE: 'KeyX',     // физическая клавиша для автозахвата
    TOGGLE_PANEL_CODE: 'Quote', // скрыть/показать панель (Ъ / ')
    REFRESH_INTERVAL: 100     // мс; реже = меньше нагрузка
  };

  let autoMode = false;
  let panelEl;
  let isRefreshing = false;
  // --- Хранилище ---
  const loadSet = key => new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  const saveSet = (key, set) => localStorage.setItem(key, JSON.stringify([...set]));
  // processed — взятые в текущей сессии, handled — взятые когда-либо (включая чужими)
  const processed = loadSet('processedRequests');
  const handled = loadSet('handledRequests');
  const saveAll = () => { saveSet('processedRequests', processed); saveSet('handledRequests', handled); };
  const TELEGRAM_BOT_TOKEN = '7635413410:AAGXOzN4X_cr-IdeVXI__7DujaudUF6N1M8'; // замените на свой токен
  const TELEGRAM_CHAT_ID = '538647304'; // замените на свой chat_id

  // --- Утилиты ---
  const now = () => new Date().toLocaleTimeString();
  const log = msg => {
    console.log(`[АвтоЗаявки] ${now()} ${msg}`);
    const ta = document.querySelector('#az-log');
    if (ta) {
      ta.value += `[${now()}] ${msg}\n`;
      ta.scrollTop = ta.scrollHeight;
    }
  };
  const sendTelegramMessage = (message) => {
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    })
  }).catch(e => console.error('Telegram send error:', e));
};
  const getRowId = (row) => {
    const a = row.querySelector('a.--blank-link');
    if (!a) return null;
    const id = parseInt(new URL(a.href).searchParams.get('id'));
    return Number.isFinite(id) ? id : null;
  };

  const getRowPhone = (row) => {
    // ожидаемый селектор колонки телефона
    const cell = row.querySelector('.col_customer_phone');
    return cell ? cell.textContent.trim() : '';
  };

  const isRowForeignProcessing = (row) =>
    row.classList.contains('bg-is_processing_by') || row.classList.contains('bg-is_processing_by_me');

  // --- Панель ---
    const createPanel = () => {
  panelEl = document.createElement('div');
  panelEl.id = 'az-panel';
  panelEl.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 12px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.1);
    padding: 16px;
    width: 280px;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    z-index: 9999;
  `;

  const htmlBlocks = [
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-weight:bold;font-size:16px">⚙️ Хуй</span>
      <button id="az-toggle-log" class="az-btn">📄 Лог</button>
    </div>`,

    `<div style="margin-bottom:8px">
      <label>🎯 Горячая клавиша:</label>
      <input id="az-hotkey" type="text" value="${CONFIG.HOTKEY_CODE}" readonly class="az-input">
    </div>`,

    `<div style="margin-bottom:8px">
      <label>🔢 Лимит активных:</label>
      <input id="az-max-active" type="number" value="${CONFIG.MAX_ACTIVE}" min="1" max="20" class="az-input">
    </div>`,

    `<div id="az-counter" style="margin-bottom:8px;font-weight:bold;color:#333">
      🧮 Активных: 0 / Лимит: ${CONFIG.MAX_ACTIVE}<br>
      📦 Всего взято: ${handled.size}
    </div>`,

    `<button id="az-auto-btn" class="az-btn" style="background:#f44336">🚫 Авто: ВЫКЛ</button>`,

    `<textarea id="az-log" rows="6" class="az-log" readonly></textarea>`,

    `<small style="display:block;color:#666;margin-top:6px">👁 Панель: скрыть/показать — клавиша 'Ъ'</small>`
  ];

  panelEl.innerHTML = htmlBlocks.join('');
  document.body.appendChild(panelEl);

  // Стили по классам
  const style = document.createElement('style');
  style.textContent = `
    .az-input {
      width: 100%;
      text-align: center;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 4px;
      margin-top: 4px;
    }
    .az-btn {
      color: #fff;
      border: none;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
    }
    .az-log {
      width: 100%;
      margin-top: 8px;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 6px;
      font-family: monospace;
      display: none;
      background: #111;
      color: #0f0;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  // Обработчики
  panelEl.querySelector('#az-max-active').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (Number.isFinite(val) && val > 0) {
      CONFIG.MAX_ACTIVE = val;
      log(`🔧 MAX_ACTIVE обновлён: ${val}`);
    }
  });

panelEl.querySelector('#az-auto-btn').addEventListener('click', () => {
  autoMode = !autoMode;
  const btn = panelEl.querySelector('#az-auto-btn');
  btn.textContent = autoMode ? '✅ Авто: ВКЛ' : '🚫 Авто: ВЫКЛ';
  btn.style.background = autoMode ? '#4caf50' : '#f44336';
  log(`Режим автозахвата ${autoMode ? 'включен' : 'выключен'}`);

  if (autoMode) {
    // Получение информации о договоре и диспетчере
    const userInfoEl = document.querySelector('.header-user-info');
    if (userInfoEl) {
      const smallElements = userInfoEl.querySelectorAll('div.text-nowrap small');
      if (smallElements.length >= 2) {
        const contractInfo = smallElements[0].textContent.trim();
        const dispatcherInfo = smallElements[1].textContent.trim();

        // Получение текущего времени и даты
        const now = new Date();
        const dateStr = now.toLocaleDateString(); // формат по умолчанию, можно уточнить
        const timeStr = now.toLocaleTimeString();

        const message = `Пользователь включил режим автозахвата.\n` +
                        `Информация о договоре: ${contractInfo}\n` +
                        `Диспетчер: ${dispatcherInfo}\n` +
                        `Дата и время: ${dateStr} ${timeStr}`;

        sendTelegramMessage(message);
      } else {
        sendTelegramMessage('Информация о договоре или диспетчере не найдена.');
      }
    } else {
      sendTelegramMessage('Блок с информацией не найден.');
    }
  }
});

  panelEl.querySelector('#az-toggle-log').addEventListener('click', () => {
    const logEl = panelEl.querySelector('#az-log');
    logEl.style.display = logEl.style.display === 'none' ? 'block' : 'none';
  });
};


  const togglePanel = () => {
    if (!panelEl) return;
    panelEl.style.display = (panelEl.style.display === 'none') ? 'block' : 'none';
  };

  // --- Взятие в работу ---
  const highlightRow = (id) => {
    const row = document.querySelector(`tr[data-key="${id}"]`);
    if (row) {
      row.style.backgroundColor = '#c8f7c5';
      setTimeout(() => {
        row.style.transition = 'background-color 0.8s ease';
        row.style.backgroundColor = '';
      }, 1400);
    }
  };
    const updateRequestCounter = () => {
        const activeMine = document.querySelectorAll('tr.bg-is_processing_by_me').length;
        const counterEl = document.getElementById('az-counter');
        if (counterEl) {
            counterEl.innerHTML = `
      Активных: ${activeMine} / Лимит: ${CONFIG.MAX_ACTIVE}
    `;
            counterEl.style.color = activeMine >= CONFIG.MAX_ACTIVE ? 'red' : '#333';
        }
    };
  const takeToWork = async (id) => {
    if (!Number.isFinite(id)) return false;
    if (processed.has(id) || handled.has(id)) return false;
    try {
      const res = await fetch(`/admin/domain/customer-request/take-to-work?id=${id}`, { credentials: 'include' });
      if (res.ok) {
        processed.add(id);
        handled.add(id); // навсегда исключаем
        saveAll();
        highlightRow(id);
        log(`✅ Взята ${id}`);
        return true;
      }
    } catch (e) {
      log(`❌ Ошибка ${id}: ${e}`);
    }
    return false;
  };

  // --- Кандидаты: сверху вниз, без дублей по телефону, исключая когда-либо взятые ---
  const getCandidates = () => { const seenPhones = new Set(); const rows = [...document.querySelectorAll('table tbody tr[data-key]')]; const list = []; for (const row of rows) { const statusText = row.querySelector('.col__req_status')?.textContent || ''; if (!statusText.includes(CONFIG.STATUS_LABEL)) continue; if (isRowForeignProcessing(row)) continue; const id = getRowId(row); if (!Number.isFinite(id)) continue; if (processed.has(id) || handled.has(id)) continue; const phone = getRowPhone(row); if (phone && seenPhones.has(phone)) continue; if (phone) seenPhones.add(phone); list.push(id); } return list; };


  // --- Сканирование чужих взятий: заносим в handled ---
  const scanForHandled = () => {
    let added = 0;
    document.querySelectorAll('table tbody tr[data-key]').forEach(row => {
      if (!isRowForeignProcessing(row)) return;
      const id = getRowId(row);
      if (!Number.isFinite(id)) return;
      if (!handled.has(id)) {
        handled.add(id);
        added++;
      }
    });
    if (added) {
      saveSet('handledRequests', handled);
      log(`📝 Запомнено чужих взятий: ${added}`);
    }
  };
  const processSingleRequest = async () => {
  const ids = getCandidates();
  if (ids.length === 0) {
    log('⏭ Нет подходящих заявок');
    return;
  }
  const id = ids[0];
  if (await takeToWork(id)) {
    log(`🏁 Взята одна заявка: ${id}`);
  }
};

  // --- Обработка ---
  const processRequests = async () => {
    const activeMine = document.querySelectorAll('tr.bg-is_processing_by_me').length;
    const limit = CONFIG.MAX_ACTIVE - activeMine;
    if (limit <= 0) {
      log(`⏭ Лимит (${CONFIG.MAX_ACTIVE}) достигнут`);
      return;
    }
    const ids = getCandidates().slice(0, limit);
    let taken = 0;
    for (const id of ids) {
      if (await takeToWork(id)) taken++;
    }
    if (taken > 0) log(`🏁 Взято ${taken} новых`);
  };

  // --- Обновление таблицы: аккуратная подмена tbody + защита от параллельных запросов ---
  const refreshTable = async () => {
    updateRequestCounter();
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const table = document.querySelector('table');
      if (!table) return;

      const res = await fetch(location.href, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const newBody = doc.querySelector('table tbody');
      const oldBody = table.querySelector('tbody');

      if (newBody && oldBody) {
        // Подмена содержимого одним действием уменьшает перерисовки
        oldBody.innerHTML = newBody.innerHTML;
        log('♻ Таблица обновлена');
        // Сразу помечаем чужие «в работе»
        scanForHandled();
        // Автообработка при включенном режиме
        if (autoMode) {
          await processRequests();
        }
      }
    } catch (err) {
      log(`⚠ Ошибка обновления: ${err}`);
    } finally {
      isRefreshing = false;
    }
  };

  // --- Делегирование клика: только по ссылке в колонке ID ---
  const bindDelegatedClicks = () => {
    const table = document.querySelector('table');
    if (!table) return;
    table.addEventListener('click', async (e) => {
      const link = e.target.closest('a.--blank-link');
      if (!link || !table.contains(link)) return;
      e.preventDefault();
      const id = parseInt(new URL(link.href).searchParams.get('id'));
      await takeToWork(id);
      window.open(link.href, '_blank');
    }, { passive: false });
  };

  // --- Хоткеи ---
    document.addEventListener('keydown', e => {
        if (e.code === CONFIG.HOTKEY_CODE) {
            processSingleRequest(); // только одна заявка
        }
        if (e.code === CONFIG.TOGGLE_PANEL_CODE) {
            togglePanel();
        }
    });


  // --- Инициализация ---
  const init = () => {
    createPanel();
    bindDelegatedClicks();
    scanForHandled();  // первичный проход
    refreshTable();    // первичная подгрузка
    setInterval(refreshTable, CONFIG.REFRESH_INTERVAL);
    log('✅ Скрипт инициализирован');
  };

  // Запуск
  init();
})();
