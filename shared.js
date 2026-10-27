/**
 * PurpleBook 共享常量与状态规范化（content script 与 popup 共用，零依赖）。
 *
 * 状态结构（chrome.storage.sync）：
 *   {
 *     pureMode: true,                    // 页面精简总开关：false = 显示受控页面元素
 *     components: {                      // 分组件隐藏：true = 隐藏该元素
 *       homeSearch: true,                //   仅主页的原生搜索框
 *       header: true,                    //   顶部导航栏
 *       sidebar: false,                  //   左侧边栏（默认显示）
 *       aiBanner: true,                  //   「问点点」AI 搜索横幅
 *       stickySearch: true,              //   吸顶搜索框
 *       floatButton: true                //   「图片搜索」悬浮按钮
 *     },
 *     features: { slashSearch: true, contextMenuSearch: true, ... }
 *   }
 *
 * 语义：true = 隐藏；默认显示侧栏、隐藏其余组件。
 * 已保存的开关继续保留，缺失项按当前默认值补齐。
 */
(function () {
  'use strict';

  const COMPONENT_KEYS = ['homeSearch', 'header', 'sidebar', 'aiBanner', 'stickySearch', 'floatButton'];

  const COMPONENT_LABELS = {
    homeSearch: '主页搜索框',
    header: '顶部导航栏',
    sidebar: '左侧边栏',
    aiBanner: '「问点点」AI 横幅',
    stickySearch: '吸顶搜索框',
    floatButton: '「图片搜索」悬浮按钮',
  };

  const DEFAULT_COMPONENTS = {
    homeSearch: true,
    header: true,
    sidebar: false,
    aiBanner: true,
    stickySearch: true,
    floatButton: true,
  };

  const FEATURE_GROUPS = [
    {
      label: '搜索增强',
      items: [
        { key: 'slashSearch', label: '按 / 展开或收起搜索框', defaultValue: true },
        { key: 'contextMenuSearch', label: '选中文字右键搜索', defaultValue: true },
        { key: 'hideSearchSuggestions', label: '隐藏「猜你想搜」', defaultValue: true },
        { key: 'hideAISearchResult', label: '隐藏搜索结果 AI 卡片', defaultValue: false },
      ],
    },
    {
      label: '侧栏入口精简',
      items: [
        { key: 'hideLive', label: '隐藏直播入口', defaultValue: false },
        { key: 'hideAIChat', label: '隐藏 AI 聊天入口', defaultValue: false },
        { key: 'hidePublish', label: '隐藏发布入口', defaultValue: false },
        { key: 'hideNotifications', label: '隐藏通知入口', defaultValue: false },
        { key: 'hideNotificationBadge', label: '隐藏通知小红点', defaultValue: false },
        { key: 'hideRedVideo', label: '隐藏 RED 视频入口', defaultValue: false },
      ],
    },
  ];
  const FEATURE_KEYS = FEATURE_GROUPS.flatMap((group) => group.items.map((item) => item.key));
  const DEFAULT_FEATURES = Object.fromEntries(
    FEATURE_GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.defaultValue])),
  );

  function buildSearchURL(keyword) {
    const params = new URLSearchParams({ keyword: keyword.trim(), source: 'web_explore_feed' });
    return `https://www.xiaohongshu.com/search_result?${params}`;
  }

  /** 任意来源（storage / 旧版本数据）→ 完整合法状态 */
  function normalizeState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const components = { ...DEFAULT_COMPONENTS };
    if (source.components && typeof source.components === 'object') {
      for (const key of COMPONENT_KEYS) {
        if (typeof source.components[key] === 'boolean') {
          components[key] = source.components[key];
        }
      }
    }
    const features = { ...DEFAULT_FEATURES };
    if (source.features && typeof source.features === 'object') {
      for (const key of FEATURE_KEYS) {
        if (typeof source.features[key] === 'boolean') features[key] = source.features[key];
      }
    }
    return {
      pureMode: typeof source.pureMode === 'boolean' ? source.pureMode : true,
      components,
      features,
    };
  }

  globalThis.PurpleBook = {
    COMPONENT_KEYS,
    COMPONENT_LABELS,
    DEFAULT_COMPONENTS,
    FEATURE_GROUPS,
    FEATURE_KEYS,
    DEFAULT_FEATURES,
    buildSearchURL,
    normalizeState,
  };
})();
