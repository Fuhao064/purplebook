/**
 * PurpleBook popup —— 总开关 + 分组件开关。
 * 状态读写 chrome.storage.sync（结构见 shared.js）；content script 监听
 * onChanged 热更新。组件开关语义：ON = 隐藏该元素。
 */
(() => {
  'use strict';

  const { COMPONENT_KEYS, COMPONENT_LABELS, DEFAULT_COMPONENTS, FEATURE_GROUPS, normalizeState, buildSearchURL } = globalThis.PurpleBook;

  const masterToggle = document.getElementById('toggle');
  const statusText = document.getElementById('status-text');
  const defaultLayout = document.getElementById('default-layout');
  const componentRows = document.getElementById('component-rows');
  const componentsCard = document.getElementById('components');
  const featureGroups = document.getElementById('feature-groups');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-keyword');
  const searchSubmit = document.getElementById('search-submit');
  const searchError = document.getElementById('search-error');

  const STATUS_ON = '已开启：下方开关控制各页面元素的隐藏。';
  const STATUS_OFF = '已关闭：下方组件恢复显示；搜索增强仍可使用。';

  let state = normalizeState(null);

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const keyword = searchInput.value.trim();
    if (!keyword) {
      searchInput.focus();
      return;
    }
    searchSubmit.disabled = true;
    searchError.hidden = true;
    try {
      await chrome.tabs.create({ url: buildSearchURL(keyword) });
      if (location.protocol === 'chrome-extension:') window.close();
    } catch (error) {
      searchError.textContent = '打开搜索失败，请重试。';
      searchError.hidden = false;
      console.warn('[PurpleBook] 弹窗搜索失败。', error);
    } finally {
      searchSubmit.disabled = false;
    }
  });

  // 生成组件开关行（一次构建，之后只同步状态）
  const rowControls = new Map();
  for (const key of COMPONENT_KEYS) {
    const row = document.createElement('div');
    row.className = 'row sub-row';

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = COMPONENT_LABELS[key];

    const button = document.createElement('button');
    button.className = 'toggle';
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', `隐藏${COMPONENT_LABELS[key]}`);
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    button.append(thumb);

    button.addEventListener('click', () => {
      // storage.set 不做深合并：必须整包写入 components
      const nextComponents = { ...state.components, [key]: !state.components[key] };
      chrome.storage.sync.set({ components: nextComponents }).catch((error) => {
        console.warn('[PurpleBook] 保存设置失败。', error);
      });
    });

    row.append(label, button);
    componentRows.append(row);
    rowControls.set(key, { row, button });
  }

  const featureControls = new Map();
  for (const group of FEATURE_GROUPS) {
    const details = document.createElement('details');
    details.className = 'card feature-card';
    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.append(summary);
    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'row sub-row';
      const label = document.createElement('span');
      label.className = 'row-label';
      label.textContent = item.label;
      const button = document.createElement('button');
      button.className = 'toggle';
      button.type = 'button';
      button.setAttribute('role', 'switch');
      button.setAttribute('aria-label', item.label);
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      button.append(thumb);
      button.addEventListener('click', () => {
        const features = { ...state.features, [item.key]: !state.features[item.key] };
        chrome.storage.sync.set({ features }).catch((error) => {
          console.warn('[PurpleBook] 保存搜索/页面设置失败。', error);
        });
      });
      row.append(label, button);
      details.append(row);
      featureControls.set(item.key, { row, button });
    }
    featureGroups.append(details);
  }

  function renderToggle(button, on, disabled) {
    button.classList.toggle('on', on);
    button.setAttribute('aria-checked', String(on));
    button.disabled = Boolean(disabled);
  }

  function render() {
    renderToggle(masterToggle, state.pureMode, false);
    statusText.textContent = state.pureMode ? STATUS_ON : STATUS_OFF;
    componentsCard.classList.toggle('disabled', !state.pureMode);

    for (const key of COMPONENT_KEYS) {
      const { row, button } = rowControls.get(key);
      const hidden = state.components[key];
      renderToggle(button, hidden, !state.pureMode);
      row.classList.toggle('active', state.pureMode && hidden);
    }
    for (const [key, { row, button }] of featureControls) {
      renderToggle(button, state.features[key], false);
      row.classList.toggle('active', state.features[key]);
    }
  }

  masterToggle.addEventListener('click', () => {
    chrome.storage.sync.set({ pureMode: !state.pureMode }).catch((error) => {
      console.warn('[PurpleBook] 保存设置失败。', error);
    });
    // 状态以 storage.onChanged 回流为准，避免本地与同步值不一致
  });

  defaultLayout.addEventListener('click', async () => {
    defaultLayout.disabled = true;
    try {
      await chrome.storage.sync.set({ pureMode: true, components: { ...DEFAULT_COMPONENTS } });
    } catch (error) {
      statusText.textContent = '恢复默认布局失败，请重试。';
      console.warn('[PurpleBook] 恢复默认布局失败。', error);
    } finally {
      defaultLayout.disabled = false;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !('pureMode' in changes || 'components' in changes || 'features' in changes)) return;
    state = normalizeState({
      pureMode: 'pureMode' in changes ? changes.pureMode.newValue : state.pureMode,
      components: 'components' in changes ? changes.components.newValue : state.components,
      features: 'features' in changes ? changes.features.newValue : state.features,
    });
    render();
  });

  (async () => {
    try {
      state = normalizeState(await chrome.storage.sync.get(null));
    } catch (error) {
      console.warn('[PurpleBook] 读取设置失败，按默认显示。', error);
    }
    render();
  })();
})();
