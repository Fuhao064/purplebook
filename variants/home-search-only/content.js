(() => {
  'use strict';
  const { normalizeState } = globalThis.PurpleBook;
  let state = normalizeState(null);
  function apply() {
    document.documentElement.dataset.ppHomeSearch = state.pureMode &&
      /^\/(?:explore\/?)?$/.test(location.pathname) ? 'on' : 'off';
  }
  apply();
  (async () => {
    try {
      state = normalizeState(await globalThis.chrome?.storage?.sync?.get?.(null));
      apply();
    } catch (error) {
      console.warn('[PurpleBook Lite] 读取设置失败，请刷新页面。', error);
    }
  })();
  try {
    globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync' || !changes.pureMode) return;
      state = normalizeState({ ...state, pureMode: changes.pureMode.newValue });
      apply();
    });
  } catch (error) {
    console.warn('[PurpleBook Lite] 页面设置同步暂不可用，请刷新页面。', error);
  }
  window.addEventListener('popstate', apply);
  window.addEventListener('pageshow', apply);
  if (window.navigation) {
    window.navigation.addEventListener('currententrychange', apply);
    window.navigation.addEventListener('navigatesuccess', apply);
  } else {
    setInterval(apply, 400);
  }
})();
