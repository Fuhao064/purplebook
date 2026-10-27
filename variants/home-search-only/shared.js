/** 轻量版仅保留主页搜索框与斜杠设置。搜索交互复用完整版 search.js。 */
(() => {
  'use strict';
  globalThis.PurpleBook = {
    normalizeState(raw) {
      return {
        pureMode: typeof raw?.pureMode === 'boolean' ? raw.pureMode : true,
        features: { slashSearch: typeof raw?.features?.slashSearch === 'boolean' ? raw.features.slashSearch : true },
      };
    },
  };
})();
