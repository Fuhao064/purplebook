/**
 * PurpleBook content script —— 移植自原 PurpleBook Electron 版本的 preload.js（去除 Electron IPC）。
 *
 * 1. 纯净信息流开关：CSS 由 manifest 在 document_start 注入（content.css，默认生效），
 *    这里只负责读取设置并切换 <html> 上的门控属性：
 *      - data-pp-pure="off"                    信息流总开关关闭，原有布局规则失效
 *      - data-pp-header="off" 等               对应组件改为显示（true = 隐藏）
 * 2. 信息流居中：通过受门控的 CSS 平移，不写网格节点的内联 left/position。
 *    偏移只在纯净流开启且侧栏隐藏时生效，页面缓存或重建不会留下旧偏移。
 * 3. 状态存 chrome.storage.sync（结构见 shared.js）。popup / 快捷键 / 本脚本
 *    三端统一由 storage.onChanged 驱动，切换即时生效，无需刷新页面。
 */
(() => {
  'use strict';

  const { normalizeState } = globalThis.PurpleBook;

  /** dataset 键：组件 key → <html> 上的 data-pp-xxx 豁免属性 */
  const COMPONENT_DATASET_KEYS = {
    header: 'ppHeader',
    sidebar: 'ppSidebar',
    aiBanner: 'ppAiBanner',
    stickySearch: 'ppStickySearch',
    floatButton: 'ppFloatButton',
  };

  const FEATURE_DATASET_KEYS = {
    hideSearchSuggestions: 'ppHideSearchSuggestions',
    hideAISearchResult: 'ppHideAiSearchResult',
    hideLive: 'ppHideLive',
    hideAIChat: 'ppHideAiChat',
    hidePublish: 'ppHidePublish',
    hideNotifications: 'ppHideNotifications',
    hideNotificationBadge: 'ppHideNotificationBadge',
    hideRedVideo: 'ppHideRedVideo',
  };

  let state = normalizeState(null);

  /** 开启时移除门控属性（CSS 默认生效，保证默认开启零闪烁）；关闭时设置 */
  function applyGate() {
    const root = document.documentElement;

    if (state.pureMode) {
      if (root.dataset.ppPure) delete root.dataset.ppPure;
      for (const [key, datasetKey] of Object.entries(COMPONENT_DATASET_KEYS)) {
        if (state.components[key]) {
          delete root.dataset[datasetKey]; // 隐藏：规则默认生效
        } else {
          root.dataset[datasetKey] = 'off'; // 显示：显式豁免
        }
      }
    } else {
      root.dataset.ppPure = 'off'; // 总开关关闭，其余属性无需逐个处理
    }
    for (const [key, datasetKey] of Object.entries(FEATURE_DATASET_KEYS)) {
      root.dataset[datasetKey] = state.features[key] ? 'on' : 'off';
    }
  }

  /* ================= 信息流网格居中 ================= */

  let cleanupCenterer = null;

  function clearCentering() {
    delete document.documentElement.dataset.ppFeedCentered;
    document.documentElement.style.removeProperty('--pp-feed-shift');
  }

  function startCenterer() {
    if (cleanupCenterer || !document.body) return;
    const root = document.documentElement;
    let disposed = false;
    let observedContent = null;
    let observedFeed = null;

    // 站点会单独改变内容区宽度，也可能缓存或替换整个网格。
    const ro = new ResizeObserver(() => recentre());
    function watchLayout(content, feed) {
      if (observedContent === content && observedFeed === feed) return;
      observedContent = content;
      observedFeed = feed;
      ro.disconnect();
      ro.observe(document.body);
      if (content) ro.observe(content);
      if (feed) ro.observe(feed);
    }

    const number = value => parseFloat(value) || 0;
    function recentre() {
      if (disposed) return;
      if (!shouldCenter() || root.hasAttribute('data-pp-search')) {
        clearCentering();
        return;
      }
      const liveFeed = document.querySelector('#exploreFeeds');
      const liveContent = liveFeed?.closest('.feeds-content');
      watchLayout(liveContent, liveFeed);
      if (!liveFeed || !liveContent || liveFeed.getBoundingClientRect().width <= 0) {
        clearCentering();
        return;
      }

      const feedRect = liveFeed.getBoundingClientRect();
      let minLeft = Infinity;
      let maxRight = -Infinity;
      for (const card of liveFeed.querySelectorAll('section.note-item')) {
        const r = card.getBoundingClientRect();
        if (r.width <= 0) continue;
        minLeft = Math.min(minLeft, r.left - feedRect.left);
        maxRight = Math.max(maxRight, r.right - feedRect.left);
      }
      if (!isFinite(minLeft) || maxRight <= minLeft) {
        clearCentering();
        return;
      }

      // 在真实内容区与视口的交集内居中，不能只按父级宽度向右推。
      const contentRect = liveContent.getBoundingClientRect();
      const css = getComputedStyle(liveContent);
      const contentLeft = contentRect.left + liveContent.clientLeft;
      const left = Math.max(0, contentLeft + number(css.paddingLeft));
      const right = Math.min(root.clientWidth,
        contentLeft + liveContent.clientWidth - number(css.paddingRight));
      const avail = right - left;
      const gridWidth = maxRight - minLeft;
      if (avail <= 0 || gridWidth > avail + 1) {
        clearCentering();
        return; // 等站点瀑布流完成重排，不给过宽的网格追加位移。
      }
      const previousShift = root.dataset.ppFeedCentered === 'on'
        ? number(root.style.getPropertyValue('--pp-feed-shift')) : 0;
      const baseLeft = feedRect.left - previousShift;
      const offset = left + (avail - gridWidth) / 2 - (baseLeft + minLeft);
      if (Math.abs(offset) < 0.01) {
        clearCentering();
        return;
      }
      const shift = `${Number(offset.toFixed(3))}px`;
      if (root.style.getPropertyValue('--pp-feed-shift') !== shift) {
        root.style.setProperty('--pp-feed-shift', shift);
      }
      root.dataset.ppFeedCentered = 'on';
    }

    const mo = new MutationObserver(recentre);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-pp-search'] });
    ro.observe(document.body);
    window.addEventListener('resize', recentre);

    cleanupCenterer = () => {
      disposed = true;
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', recentre);
      clearCentering();
      cleanupCenterer = null;
    };

    recentre();
  }

  function ensureCenterer() {
    if (!cleanupCenterer) startCenterer();
  }

  function stopCenterer() {
    if (cleanupCenterer) cleanupCenterer();
    else clearCentering();
  }

  /** 居中器只在"总开关开且侧边栏被隐藏"时介入：侧边栏显示 = 保持原始布局 */
  function shouldCenter() {
    return state.pureMode && state.components.sidebar === true;
  }

  /* ================= 状态切换与启动 ================= */

  function activate() {
    applyGate();
    if (shouldCenter()) ensureCenterer();
    else stopCenterer();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!('pureMode' in changes) && !('components' in changes) && !('features' in changes)) return;
    const next = normalizeState({
      pureMode: 'pureMode' in changes ? changes.pureMode.newValue : state.pureMode,
      components: 'components' in changes ? changes.components.newValue : state.components,
      features: 'features' in changes ? changes.features.newValue : state.features,
    });
    state = next;
    activate();
  });

  (async () => {
    try {
      state = normalizeState(await chrome.storage.sync.get(null));
    } catch (error) {
      console.warn('[PurpleBook] 读取设置失败，保持默认净化。', error);
      state = normalizeState(null);
    }

    // 异步读取和设置变化都走同一启停路径，避免留下先前启动的居中器。
    activate();

    // 居中器等 DOM 就绪再启动（与 preload 启动时序一致；ensureCenterer 幂等，
    // 之后即使 onChanged 提前触发也不会重复启动）
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        activate,
        { once: true },
      );
    } else if (shouldCenter()) {
      ensureCenterer();
    }
  })();
})();
