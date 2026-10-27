/** 原位展开 / 收起原生搜索框；不移动节点、不改输入值或站点搜索事件。 */
(() => {
  'use strict';
  const { normalizeState } = globalThis.PurpleBook;
  const root = document.documentElement;
  // 版本只用于诊断。扩展重载后的旧上下文可能无法访问 runtime，不能因此中断搜索。
  try {
    root.dataset.ppSearchVersion = globalThis.chrome?.runtime?.getManifest?.()?.version || 'unavailable';
  } catch {
    root.dataset.ppSearchVersion = 'unavailable';
  }
  let state = normalizeState(null);
  let view = null;
  let routeTimer = null;
  let observer = null;

  function isUsableSearch(input) {
    if (input.disabled || input.readOnly || input.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const rect = input.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // 新版仍保留隐藏的旧框；跳过透明镜像与不可交互的输入。
    for (let node = input; node && node !== root; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible' || Number(style.opacity) < 0.01) return false;
    }
    return getComputedStyle(input).pointerEvents !== 'none';
  }

  function findSearch() {
    const classicInputs = [...document.querySelectorAll('#search-input')];
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
    routeTimer = null;
    observer?.disconnect();
    observer = null;
    if (previous.target.contains(document.activeElement)) document.activeElement.blur();
    delete root.dataset.ppSearch;
    if (restore && location.href === previous.url && previous.focus?.isConnected) {
      previous.focus.focus?.({ preventScroll: true });
    }
    if (restore && location.href === previous.url && previous.scrolled) {
      window.scrollTo(previous.scrollX, previous.scrollY);
    }
  }

  function syncPage() {
    if (view && (
      location.href !== view.url || !view.input.isConnected || !view.target.isConnected ||
      !isUsableSearch(view.input)
    )) closeSearch(false);
  }

  function openSearch() {
    if (!document.body) return false;
    // 同一任务内临时解除扩展隐藏，按站点原布局选择真正可用的搜索框。
    root.dataset.ppSearch = 'preparing';
    let search;
    try {
      search = findSearch();
    } finally {
      if (!search) delete root.dataset.ppSearch;
    }
    if (!search) return false;
    view = { ...search, focus: document.activeElement, url: location.href,
      scrollX: window.scrollX, scrollY: window.scrollY, scrolled: false };
    root.dataset.ppSearch = 'on';
    search.input.focus({ preventScroll: true });
    if (document.activeElement !== search.input) {
      closeSearch(false);
      return false;
    }
    const rect = search.input.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      view.scrolled = true;
      search.input.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    observer = new MutationObserver(syncPage);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    routeTimer = setInterval(syncPage, 400);
    return true;
  }

  function isEditing(event) {
    return event.composedPath().some((node) => node instanceof Element && (
      node.isContentEditable || node.matches('input, textarea, select, [role="textbox"]')
    ));
  }

  function isSlash(event) {
    return event.key === '/' || event.key === '／' || event.code === 'NumpadDivide' ||
      (event.code === 'Slash' && !event.shiftKey);
  }

  window.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented || event.repeat ||
      event.ctrlKey || event.altKey || event.metaKey) return;
    if (view && event.key === 'Escape') {
      if (isEditing(event) && !event.composedPath().includes(view.input)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSearch();
      return;
    }
    if (!isSlash(event) || !state.features.slashSearch) return;
    // 展开后焦点在原生搜索输入框，第二次 / 也可直接收起。
    if (isEditing(event) && !(view && event.composedPath().includes(view.input))) return;
    if (view) {
      closeSearch();
    } else if (!openSearch()) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('popstate', syncPage);
  window.addEventListener('hashchange', syncPage);
  window.addEventListener('pageshow', syncPage);
  window.navigation?.addEventListener('currententrychange', syncPage);
  window.navigation?.addEventListener('navigatesuccess', syncPage);

  try {
    globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync' || !['features', 'components', 'pureMode'].some((key) => key in changes)) return;
      if (changes.features) state = normalizeState({ ...state, features: changes.features.newValue });
      closeSearch();
    });
  } catch (error) {
    console.warn('[PurpleBook] 搜索设置同步暂不可用，请刷新页面。', error);
  }
  (async () => {
    try {
      state = normalizeState(await globalThis.chrome?.storage?.sync?.get?.(null));
      if (!state.features.slashSearch) closeSearch();
    } catch (error) {
      console.warn('[PurpleBook] 读取搜索设置失败，请刷新页面。', error);
    }
  })();
})();
