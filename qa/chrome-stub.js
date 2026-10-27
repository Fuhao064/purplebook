// Popup QA 用 chrome/browser API stub —— 仅用于本地渲染自检，不属于扩展产物。
(function () {
  let stored = {};
  const fireChanged = (obj) => {
    // 与真实 chrome.storage.onChanged 一致：changes = { key: { newValue } }
    const changes = {};
    for (const [key, value] of Object.entries(obj)) {
      changes[key] = { newValue: value };
    }
    for (const fn of api.storage.onChanged.listeners) fn(changes, 'sync');
  };
  const api = {
    runtime: {
      getManifest: () => ({ version: '0.3.8', name: 'PurpleBook' }),
    },
    tabs: {
      create: async ({ url }) => {
        console.log('[stub] tabs.create', url);
        let result = document.getElementById('qa-search-result');
        if (!result) {
          result = document.createElement('p');
          result.id = 'qa-search-result';
          result.style.cssText = 'margin:12px 16px;overflow-wrap:anywhere;font-size:12px';
          document.body.append(result);
        }
        result.textContent = `已打开：${url}`;
        return { id: 1, url };
      },
    },
    storage: {
      sync: {
        get: async (defaults) => {
          if (defaults === null || defaults === undefined) return { ...stored };
          if (typeof defaults === 'string') return { [defaults]: stored[defaults] };
          const out = {};
          for (const key of Object.keys(defaults)) {
            out[key] = key in stored ? stored[key] : defaults[key];
          }
          return out;
        },
        set: async (obj) => {
          // 与真实 chrome.storage 一致：不做深合并，整键覆盖
          stored = { ...stored, ...obj };
          console.log('[stub] storage.sync.set', obj);
          fireChanged(obj);
        },
      },
      onChanged: {
        listeners: [],
        addListener(fn) {
          this.listeners.push(fn);
        },
        removeListener(fn) {
          this.listeners = this.listeners.filter((f) => f !== fn);
        },
      },
    },
  };
  // 启动时模拟扩展接口异常；仅作用于本地预览，不进入扩展安装包。
  const fault = new URLSearchParams(location.search).get('api');
  if (fault === 'missing-runtime') delete api.runtime;
  if (fault === 'stale-context') {
    const invalidated = () => { throw new Error('Extension context invalidated.'); };
    api.runtime.getManifest = invalidated;
    api.storage.sync.get = invalidated;
    api.storage.onChanged.addListener = invalidated;
  }
  window.chrome = api;
  window.browser = api;
  console.log('[stub] chrome/browser API ready');
})();
