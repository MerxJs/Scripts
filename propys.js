(function() {
    'use strict';

    // Создание контейнера
    const container = document.createElement('div');
    container.id = 'clipboard-numbers-container';
    container.innerHTML = `
        <div class="cn-header">📋 Хуй</div>
        <div class="cn-body"><em>Ожидаем загрузку...</em></div>
        <button class="cn-button">🔗 Открыть все номера</button>
    `;
    document.body.appendChild(container);

    // Стили
    const style = document.createElement('style');
    style.textContent = `
        #clipboard-numbers-container {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            max-height: 500px;
            overflow-y: auto;
            background: linear-gradient(135deg, #f9f9f9, #e9ecef);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            font-family: 'Segoe UI', sans-serif;
            z-index: 9999;
            padding: 15px;
            transition: all 0.3s ease-in-out;
            cursor: default;
        }
        .cn-header {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
            color: #333;
            cursor: move;
            user-select: none;
        }
        .cn-body a {
            display: block;
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 8px;
            margin: 5px 0;
            text-decoration: none;
            color: #007bff;
            transition: background 0.2s;
        }
        .cn-body a:hover {
            background: #f1f3f5;
        }
        .cn-button {
            display: block;
            width: 100%;
            margin-top: 10px;
            padding: 10px;
            background: #28a745;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        .cn-button:hover {
            background: #218838;
        }
    `;
    document.head.appendChild(style);

    // Перетаскивание
    const header = container.querySelector('.cn-header');
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            container.style.left = `${e.clientX - offsetX}px`;
            container.style.top = `${e.clientY - offsetY}px`;
            container.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    let currentNumbers = [];

    async function updateClipboardNumbers() {
        try {
            const clipboardText = await navigator.clipboard.readText();
            const phoneNumbers = [...clipboardText.matchAll(/(?:\+7|8)\s?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g)]
                .map(match => match[0].replace(/\s+/g, '').replace(/[^+\d]/g, ''))
                .filter((v, i, a) => a.indexOf(v) === i);

            currentNumbers = phoneNumbers;
            const body = container.querySelector('.cn-body');
            body.innerHTML = '';

            if (phoneNumbers.length === 0) {
                body.innerHTML = '<em>Ничего не найдено</em>';
                return;
            }

            phoneNumbers.forEach(number => {
                const link = document.createElement('a');
                link.href = `https://kp-lead-centre.ru/admin/domain/customer-request/index?phone=${encodeURIComponent(number)}`;
                link.textContent = number;
                link.target = '_blank';
                body.appendChild(link);
            });
        } catch (err) {
            container.querySelector('.cn-body').innerHTML = '<em>Ошибка чтения буфера</em>';
            console.error(err);
        }
    }

    container.querySelector('.cn-button').onclick = () => {
        currentNumbers.forEach(number => {
            const url = `https://kp-lead-centre.ru/admin/domain/customer-request/index?phone=${encodeURIComponent(number)}`;
            window.open(url, '_blank');
        });
    };

    function conditionalUpdate() {
        if (document.visibilityState === 'visible') {
            updateClipboardNumbers();
        }
    }

    document.addEventListener('visibilitychange', conditionalUpdate);
    setInterval(conditionalUpdate, 500);

    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone');

    if (phone && !sessionStorage.getItem('phoneFiltered')) {
        const observer = new MutationObserver(() => {
            const input = document.querySelector('input[name="CRSearch[phone]"]');
            const filterButton = document.getElementById('cr-index-apply-filter');

            if (input && filterButton) {
                input.value = phone;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                    filterButton.click();
                    sessionStorage.setItem('phoneFiltered', 'true');
                }, 500);

                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
