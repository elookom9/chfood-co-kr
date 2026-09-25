(() => {
  'use strict';

  const WATERMARK_SRC = '/assets/banjuk9dan-watermark.png';
  const ADMIN_SELECTOR = '#adminShell, #adminEditorDialog, .admin-shell, .admin-editor';
  const EDITABLE_SELECTOR = 'input, textarea, select, option, [contenteditable="true"]';
  const MIN_SIDE = 84;
  let noticeTimer = 0;

  document.documentElement.classList.add('copyguard-active');

  function isExempt(target) {
    const node = target instanceof Element ? target : target?.parentElement;
    return Boolean(node?.closest(`${ADMIN_SELECTOR}, ${EDITABLE_SELECTOR}`));
  }

  function showNotice() {
    let notice = document.getElementById('copyguardNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'copyguardNotice';
      notice.className = 'copyguard-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.textContent = '저작권 보호 콘텐츠입니다. 무단 복제·저장을 금지합니다.';
      document.body.appendChild(notice);
    }
    window.clearTimeout(noticeTimer);
    notice.classList.add('is-visible');
    noticeTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 1900);
  }

  function protectImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.copyguard === 'done') return;
    if (img.classList.contains('copyguard-watermark') || img.closest(ADMIN_SELECTOR) || img.closest('.product-image, .product-detail-media') || img.hasAttribute('data-no-watermark')) return;
    const apply = () => {
      if (img.dataset.copyguard === 'done' || !img.isConnected) return;
      if ((img.naturalWidth || img.width) < MIN_SIDE || (img.naturalHeight || img.height) < MIN_SIDE) return;
      const host = img.parentElement;
      if (!host) return;
      img.dataset.copyguard = 'done';
      img.draggable = false;
      host.classList.add('copyguard-watermark-host');
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      if (host.querySelector(':scope > .copyguard-watermark')) return;
      const mark = document.createElement('img');
      mark.src = WATERMARK_SRC;
      mark.alt = '';
      mark.setAttribute('aria-hidden', 'true');
      mark.className = 'copyguard-watermark';
      mark.draggable = false;
      host.appendChild(mark);
    };
    if (img.complete) apply();
    else img.addEventListener('load', apply, { once: true });
  }

  function protectImages(root = document) {
    if (root instanceof HTMLImageElement) protectImage(root);
    root.querySelectorAll?.('img').forEach(protectImage);
  }

  const block = (event) => {
    if (isExempt(event.target)) return;
    event.preventDefault();
    showNotice();
  };

  document.addEventListener('contextmenu', block, true);
  document.addEventListener('copy', block, true);
  document.addEventListener('cut', block, true);
  document.addEventListener('dragstart', (event) => {
    if (!isExempt(event.target) && event.target.closest?.('img')) block(event);
  }, true);
  document.addEventListener('keydown', (event) => {
    if (isExempt(event.target)) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ['c', 's', 'u'].includes(key)) block(event);
    if (key === 'printscreen') showNotice();
  }, true);

  const start = () => {
    protectImages();
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') protectImage(record.target);
        for (const node of record.addedNodes) {
          if (node instanceof Element) protectImages(node);
        }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
