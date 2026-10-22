/**
 * 临时纯净搜索视图：原生搜索框留在原 DOM，CSS 临时居中。
 * 不改 pureMode/components、不改输入框的值或站点搜索事件。
 */
(() => {
  'use strict';

  const { normalizeState } = globalThis.PurplePurify;
  document.documentElement.dataset.ppSearchVersion = chrome.runtime.getManifest().version;
  let state = normalizeState(null);
  let view = null;
  let routeTimer = null;
  let submitTimer = null;
  let observer = null;
  let resizeObserver = null;

  function isUsableSearch(input) {
    if (input.disabled || input.readOnly || input.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const rect = input.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // 新版会保留 display:none 的旧搜索框；其他扩展也可能注入透明镜像输入。
    for (let node = input; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible' || Number(style.opacity) < 0.01) return false;
    }
    return getComputedStyle(input).pointerEvents !== 'none';
  }

  function findSearch() {
    const classicInputs = [...document.querySelectorAll('#search-input')];
    // 优先使用笔记搜索；没有经典输入框时兼容新版搜索区域。
    const candidates = [
      ...classicInputs.filter((input) => input.closest('.header-container')),
      ...classicInputs,
      ...document.querySelectorAll('textarea[name="aiSearchTextarea"]'),
    ];
    for (const input of candidates) {
      if (!isUsableSearch(input)) continue;
      const target = input.closest('.input-box') || input.closest('.search-area') || input.parentElement;
      if (target) return { input, target };
    }
    return null;
  }

  function closeSearch(restore = true) {
    if (!view) return;
    const previous = view;
    view = null;
    clearInterval(routeTimer);
    clearTimeout(submitTimer);
    routeTimer = null;
    submitTimer = null;
    observer?.disconnect();
    observer = null;
    resizeObserver?.disconnect();
    resizeObserver = null;

    delete document.documentElement.dataset.ppSearch;
    delete previous.target.dataset.ppSearchTarget;
    delete previous.target.dataset.ppSearchKind;
    for (const host of previous.hosts) delete host.dataset.ppSearchHost;
    previous.controls.remove();

    if (restore && location.href === previous.url) {
      if (previous.focus?.isConnected && typeof previous.focus.focus === 'function') {
        previous.focus.focus({ preventScroll: true });
      }
      window.scrollTo(previous.scrollX, previous.scrollY);
    }
  }

  function syncPage() {
    if (view && (
      location.href !== view.url || !view.input.isConnected || !view.target.isConnected ||
      view.input.getBoundingClientRect().width <= 0
    )) {
      closeSearch(false);
    }
  }

  function openSearch() {
    if (view) {
      view.input.focus({ preventScroll: true });
      return true;
    }
    if (!document.body) return false;
    const root = document.documentElement;
    root.dataset.ppSearchVersion = chrome.runtime.getManifest().version;
    // 同一同步任务内临时解除本扩展的隐藏规则，按站点真实布局挑选输入框。
    // 此阶段不隐藏页面内容，visibility/opacity 检查不会被搜索视图本身干扰。
    root.dataset.ppSearch = 'preparing';
    let search;
    try {
      search = findSearch();
    } finally {
      if (!search) delete root.dataset.ppSearch;
    }
    if (!search) return false;

    const controls = document.createElement('div');
    controls.id = 'pp-search-controls';
    const title = document.createElement('h1');
    title.className = 'pp-search-title';
    title.textContent = '纯净搜索';
    const hint = document.createElement('p');
    hint.className = 'pp-search-help';
    hint.textContent = 'Enter 搜索 · Esc 返回';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'pp-search-back';
    back.textContent = '返回页面  Esc';
    back.addEventListener('click', () => closeSearch());
    controls.append(title, hint, back);

    const hosts = [];
    for (let host = search.target.parentElement; host && host !== document.body; host = host.parentElement) {
      hosts.push(host);
    }
    view = {
      ...search,
      hosts,
      controls,
      focus: document.activeElement,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      url: location.href,
    };
    search.target.dataset.ppSearchTarget = 'on';
    search.target.dataset.ppSearchKind = search.input.tagName === 'TEXTAREA' ? 'ai' : 'classic';
    for (const host of hosts) host.dataset.ppSearchHost = 'on';
    document.documentElement.dataset.ppSearch = 'on';
    document.body.append(controls);
    observer = new MutationObserver(syncPage);
    observer.observe(document.body, { childList: true, subtree: true });
    const alignLabels = () => {
      if (view) controls.style.setProperty('--pp-search-half-height', `${search.target.getBoundingClientRect().height / 2}px`);
    };
    resizeObserver = new ResizeObserver(alignLabels);
    resizeObserver.observe(search.target);
    alignLabels();
    search.input.focus({ preventScroll: true });
    if (document.activeElement !== search.input) {
      closeSearch(false);
      return false;
    }
    // 只在搜索视图开启时兜底检查 SPA URL；不修改页面世界的 history 方法。
    routeTimer = setInterval(syncPage, 400);
    return true;
  }

  function isEditing(event) {
    return event.composedPath().some((node) => node instanceof Element && (
      node.isContentEditable || node.matches('input, textarea, select, [role="textbox"]')
    ));
  }

  function closeAfterSubmit() {
    if (!view?.input.value.trim()) return;
    // 先让小红书原生事件处理搜索/登录，再恢复页面。
    clearTimeout(submitTimer);
    submitTimer = setTimeout(() => closeSearch(false), 0);
  }

  function isSlash(event) {
    return event.key === '/' || event.key === '／' || event.code === 'NumpadDivide' ||
      (event.code === 'Slash' && !event.shiftKey);
  }

  window.addEventListener('keydown', (event) => {
    if (view && event.key === 'Escape') {
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSearch();
      return;
    }
    if (
      !isSlash(event) || !state.features.slashSearch || event.defaultPrevented || event.repeat ||
      event.ctrlKey || event.altKey || event.metaKey || isEditing(event)
    ) return;
    if (openSearch()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // 兼容站点在 keydown 或 keyup 处理 Enter；不提前隐藏输入框导致 keyup 丢失。
  document.addEventListener('keyup', (event) => {
    if (
      view && event.key === 'Enter' && event.target === view.input && view.input.tagName === 'INPUT' &&
      !event.isComposing && !event.shiftKey
    ) closeAfterSubmit();
  }, true);

  document.addEventListener('submit', (event) => {
    if (view && event.target instanceof Element && event.target.contains(view.input)) closeAfterSubmit();
  }, true);

  document.addEventListener('click', (event) => {
    if (!view || !(event.target instanceof Element) || !view.target.contains(event.target)) return;
    if (event.target.closest('.search-icon, button[type="submit"]')) closeAfterSubmit();
  }, true);
  window.addEventListener('popstate', syncPage);
  window.addEventListener('hashchange', syncPage);
  window.navigation?.addEventListener('navigatesuccess', syncPage);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.features) return;
    state = normalizeState({ ...state, features: changes.features.newValue });
    if (!state.features.slashSearch) closeSearch();
  });
  chrome.storage.sync.get(null).then((raw) => {
    state = normalizeState(raw);
    if (!state.features.slashSearch) closeSearch();
  }).catch((error) => console.warn('[PurplePurify] 读取搜索设置失败。', error));
})();
