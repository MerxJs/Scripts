(function () {
  'use strict';

  const commentCache = new Map();
  let activeRequestId = null;

  const tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'absolute',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '12px 16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    fontSize: '14px',
    lineHeight: '1.4',
    color: '#333',
    maxWidth: '320px',
    zIndex: '9999',
    transition: 'opacity 0.2s ease',
    opacity: '0',
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
    wordBreak: 'break-word',
    display: 'none'
  });
  document.body.appendChild(tooltip);

  let hideTimeout;

  document.addEventListener('mouseover', function (e) {
    const link = e.target.closest('a.--blank-link[href*="customer-request/update?id="]');
    if (link) {
      const href = link.getAttribute('href');
      const rect = link.getBoundingClientRect();
      tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tooltip.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 340)}px`;

      // Отменяем предыдущий показ
      clearTimeout(hideTimeout);
      activeRequestId = href;

      if (commentCache.has(href)) {
        tooltip.textContent = commentCache.get(href);
        tooltip.style.display = 'block';
        requestAnimationFrame(() => (tooltip.style.opacity = '1'));
        return;
      }

      // Загружаем только если нет в кэше
      GM_xmlhttpRequest({
        method: 'GET',
        url: location.origin + href,
        onload: function (response) {
          if (activeRequestId !== href) return; // пользователь уже ушёл

          const parser = new DOMParser();
          const doc = parser.parseFromString(response.responseText, 'text/html');
          const textarea = doc.querySelector('#customerrequest-partner_comment');
          const comment = textarea ? (textarea.value.trim() || 'Комментарий отсутствует') : 'Комментарий не найден';
          commentCache.set(href, comment);

          tooltip.textContent = comment;
          tooltip.style.display = 'block';
          requestAnimationFrame(() => (tooltip.style.opacity = '1'));
        },
        onerror: function () {
          if (activeRequestId !== href) return;
          tooltip.textContent = 'Ошибка загрузки';
          tooltip.style.display = 'block';
          requestAnimationFrame(() => (tooltip.style.opacity = '1'));
        }
      });
    }
  });

  document.addEventListener('mouseout', function (e) {
    const link = e.target.closest('a.--blank-link[href*="customer-request/update?id="]');
    if (link) {
      activeRequestId = null;
      hideTimeout = setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => {
          tooltip.style.display = 'none';
        }, 200);
      }, 100);
    }
  });
})();
