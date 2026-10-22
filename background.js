/**
 * PurplePurify background（非持久 service worker）。
 * Alt+Shift+P 切换纯净信息流；选中文字右键搜索在新标签中打开。
 */
importScripts('shared.js');

const { normalizeState, buildSearchURL } = globalThis.PurplePurify;
const SEARCH_MENU_ID = 'purplepurify-search-selection';
let menuSync = Promise.resolve();

function syncSearchMenu() {
  // 安装、启动及设置变更可能相邻发生；顺序更新以免菜单重复。
  menuSync = menuSync.catch(() => {}).then(async () => {
    await new Promise((resolve) => chrome.contextMenus.remove(SEARCH_MENU_ID, () => {
      void chrome.runtime.lastError; // 首次安装时菜单尚不存在。
      resolve();
    }));
    const state = normalizeState(await chrome.storage.sync.get(null));
    if (!state.features.contextMenuSearch) return;
    await new Promise((resolve, reject) => chrome.contextMenus.create({
      id: SEARCH_MENU_ID,
      title: '在小红书中搜索“%s”',
      contexts: ['selection'],
    }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    }));
  });
  menuSync.catch((error) => console.warn('[PurplePurify] 更新右键搜索菜单失败。', error));
}

chrome.runtime.onInstalled.addListener(syncSearchMenu);
chrome.runtime.onStartup.addListener(syncSearchMenu);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.features) syncSearchMenu();
});
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== SEARCH_MENU_ID || !info.selectionText?.trim()) return;
  try {
    const state = normalizeState(await chrome.storage.sync.get(null));
    if (!state.features.contextMenuSearch) return;
    await chrome.tabs.create({ url: buildSearchURL(info.selectionText) });
  } catch (error) {
    console.warn('[PurplePurify] 右键搜索失败。', error);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-pure-mode') return;
  try {
    const result = await chrome.storage.sync.get({ pureMode: true });
    const current = typeof result.pureMode === 'boolean' ? result.pureMode : true;
    await chrome.storage.sync.set({ pureMode: !current });
  } catch (error) {
    console.warn('[PurplePurify] 快捷键切换失败。', error);
  }
});
