/**
 * PurpleBook DOM 探针 —— 选择器漂移修复工具。
 * 移植自原 PurpleBook Electron 版本的 scripts/inspect-pure.mjs（一键体检）+ find-selector.mjs（按文本反查），
 * 扩展场景不需要 9223 调试端口：直接在小红书页面 F12 控制台粘贴运行即可。
 *
 * 用法：
 *   1. 打开 https://www.xiaohongshu.com/explore，F12 → Console
 *   2. 粘贴本文件全部内容并回车 —— 逐条体检净化及搜索选择器是否仍然命中
 *   3. 若某条显示 absent（站点改版），运行全局函数 __ppFind("问点点") 按文本
 *      反查新的 class 链，然后把新选择器更新进 content.css
 *
 * 建议分别在首页（下滚触发吸顶搜索框后再跑一次）和搜索结果页各体检一遍。
 */
/* eslint-disable */
(() => {
  'use strict';

  const SELECTORS = [
    '.header-container',
    '.side-bar',
    '.main-content.with-side-bar',
    '.feeds-page',
    '.search-area',
    '.ai-header-container',
    '.search-area-in-header',
    '.floating-btn-sets',
    '.floating-btn-sets .graphic-filter',
    '#search-input',
    'textarea[name="aiSearchTextarea"]',
    '[data-pp-search-target]',
    '.sug-box',
    '.suggestion-section',
  ];

  const describe = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] display=${cs.display} pos=${cs.position}`;
  };

  const style = 'font-weight:bold;color:#7c5cff';
  console.group('%cPurpleBook 探针', style);

  // 1) 门控状态
  const root = document.documentElement;
  const gate = root.dataset.ppPure;
  console.log('搜索脚本版本:', root.dataset.ppSearchVersion || '旧版/未加载');
  console.log('临时搜索视图:', root.dataset.ppSearch === 'on' ? '开启' : '关闭');
  console.log(
    `总开关: ${gate === 'off' ? 'data-pp-pure="off"（净化已关闭）' : '开启（净化规则生效中）'}`,
  );
  const componentAttrs = [
    ['data-pp-header', 'ppHeader', '顶部导航栏'],
    ['data-pp-sidebar', 'ppSidebar', '左侧边栏'],
    ['data-pp-ai-banner', 'ppAiBanner', 'AI 横幅'],
    ['data-pp-sticky-search', 'ppStickySearch', '吸顶搜索框'],
    ['data-pp-float-button', 'ppFloatButton', '悬浮按钮'],
  ];
  console.log('—— 分组件门控（属性缺失 = 隐藏生效；off = 显示）——');
  for (const [attr, key, label] of componentAttrs) {
    const value = root.dataset[key];
    console.log(`${label}: ${value === 'off' ? '显示（' + attr + '="off"）' : '隐藏（属性未设置）'}`);
  }

  // 2) 逐条体检净化选择器
  console.log('—— 净化选择器体检（display=none 即隐藏生效；absent 表示站点可能已改版）——');
  for (const selector of SELECTORS) {
    const el = document.querySelector(selector);
    console.log(`${selector}: ${el ? describe(el) : 'absent'}`);
  }

  // 3) .main-container 直接子元素（发现新布局元素用）
  console.log('—— .main-container 直接子元素 ——');
  const mainContainer = document.querySelector('.main-container');
  if (mainContainer) {
    console.table(
      [...mainContainer.children].map((c) => ({ desc: describe(c) })),
    );
  } else {
    console.warn('.main-container 不存在（布局可能已重构）');
  }

  // 4) 居中器相关容器
  console.log('—— 居中器容器 ——');
  for (const selector of ['#exploreFeeds', '.feeds-content', '.channel-container', '.feeds-loading']) {
    const el = document.querySelector(selector);
    console.log(`${selector}: ${el ? describe(el) : 'absent（当前路由无此容器，属正常）'}`);
  }
  const feed = document.querySelector('#exploreFeeds');
  if (feed) {
    console.log('居中门控:', root.dataset.ppFeedCentered || '关闭',
      'CSS 位移:', root.style.getPropertyValue('--pp-feed-shift') || '0px');
    console.log(`#exploreFeeds 实际偏移: left=${getComputedStyle(feed).left}; 站点内联 left=${feed.style.left || '(未设置)'}`);
    console.log(`#exploreFeeds 内 section.note-item 卡片数: ${feed.querySelectorAll('section.note-item').length}`);
  }

  console.groupEnd();

  // 5) 全局工具：按文本反查 class 链（移植自 find-selector.mjs）
  window.__ppFind = function __ppFind(needle) {
    if (!needle) return '用法：__ppFind("问点点")';
    const results = [];
    for (const el of document.querySelectorAll('body *')) {
      const text = el.innerText || '';
      if (!text.slice(0, 200).includes(needle)) continue;
      // 只取最内层含文本的祖先链起点
      if (el.querySelector('*') && [...el.children].some((c) => (c.innerText || '').includes(needle))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // 向上收集到 .feeds-page / #mfContainer / body 为止的 class 链
      const chain = [];
      let node = el;
      while (node && node !== document.body) {
        const cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
        chain.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (cls ? '.' + cls : ''));
        if (node.id === 'mfContainer' || node.classList.contains('feeds-page')) break;
        node = node.parentElement;
      }
      results.push(`${chain.join(' > ')}  [${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}]`);
      if (results.length >= 12) break;
    }
    const output = results.join('\n') || 'NOT_FOUND';
    console.log(`__ppFind("${needle}"):\n${output}`);
    try {
      copy(output);
      console.info('%c✓ 结果已复制到剪贴板', style);
    } catch {
      /* copy 仅在 DevTools 控制台可用 */
    }
    return output;
  };

  console.info(
    '%c工具已就绪：站点改版后运行 __ppFind("元素文本") 反查新 class 链，更新 content.css。',
    style,
  );
})();
