(function () {
  'use strict';

  function createRegionBadge(regionText) {
    const badge = document.createElement('span');
    badge.className = 'region-badge';
    badge.textContent = regionText;
    Object.assign(badge.style, {
      marginLeft: '8px',
      padding: '2px 10px',
      borderRadius: '20px',
      backgroundColor: '#e0f3ff',
      color: '#0078d4',
      fontSize: '12px',
      fontWeight: '500',
      display: 'inline-block',
      verticalAlign: 'middle',
      boxShadow: 'inset 0 0 0 1px #cce5ff',
      transition: 'opacity 0.4s ease',
      opacity: '0'
    });
    setTimeout(() => {
      badge.style.opacity = '1';
    }, 50);
    return badge;
  }

  function insertRegionNextToPhone() {
    const phoneBlocks = document.querySelectorAll('#customerInfo .col-lg-3');
    phoneBlocks.forEach(block => {
      const rawText = block.textContent;
      const match = rawText.match(/(\+7\s?\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2})/);
      if (match) {
        const phone = match[1];
        if (!block.querySelector('.region-badge') && typeof window.fetchRegion === 'function') {
          window.fetchRegion(phone, region => {
            const badge = createRegionBadge(region);
            const phoneSpan = block.querySelector('span');
            if (phoneSpan) {
              phoneSpan.after(badge);
            } else {
              block.appendChild(badge);
            }
          });
        }
      }
    });
  }

  const observer = new MutationObserver(() => {
    const infoBlock = document.getElementById('customerInfo');
    if (infoBlock) {
      insertRegionNextToPhone();
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
