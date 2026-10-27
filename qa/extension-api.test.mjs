/** 页面脚本启动回归：扩展接口缺失或失效不能阻止搜索快捷键初始化。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';

const version = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url))).version;
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const stale = () => { throw new Error('Extension context invalidated.'); };
const cases = [
  { name: '正常接口与保存设置', change() {}, saved: { pureMode: false } },
  { name: '没有 chrome 对象', noChrome: true, change() {}, unavailableVersion: true },
  { name: 'runtime 不存在', change(api) { delete api.runtime; }, unavailableVersion: true },
  { name: 'getManifest 不存在', change(api) { delete api.runtime.getManifest; }, unavailableVersion: true },
  { name: 'getManifest 同步抛错', change(api) { api.runtime.getManifest = stale; }, unavailableVersion: true },
  { name: 'storage 不存在', change(api) { delete api.storage; } },
  { name: '设置监听同步抛错', change(api) { api.storage.onChanged.addListener = stale; }, saved: { pureMode: false } },
  { name: '设置读取同步抛错', change(api) { api.storage.sync.get = stale; } },
  { name: '设置读取异步拒绝', change(api) { api.storage.sync.get = async () => stale(); } },
  { name: 'runtime 与 storage 同时失效', change(api) {
    api.runtime.getManifest = stale;
    api.storage.sync.get = stale;
    api.storage.onChanged.addListener = stale;
  }, unavailableVersion: true },
];

for (const variant of ['full', 'lite']) {
  for (const scenario of cases) {
    test(`${variant}: ${scenario.name}`, async () => {
      const events = new Map();
      const root = { dataset: {}, style: { removeProperty() {} } };
      const document = {
        documentElement: root, body: null, readyState: 'loading',
        addEventListener() {}, querySelectorAll: () => [],
      };
      const api = {
        runtime: { getManifest: () => ({ version }) },
        storage: {
          sync: { get: async () => scenario.saved || {} },
          onChanged: { addListener() {} },
        },
      };
      scenario.change(api);
      const context = createContext({
        chrome: scenario.noChrome ? undefined : api, document,
        location: { pathname: '/explore', href: 'https://www.xiaohongshu.com/explore' },
        window: {
          navigation: { addEventListener() {} },
          addEventListener(type, fn) {
            if (!events.has(type)) events.set(type, []);
            events.get(type).push(fn);
          },
        },
        console: { warn() {} },
        Element: class {}, setInterval: () => 1, clearInterval() {},
        URLSearchParams,
      });
      const shared = variant === 'lite' ? 'variants/home-search-only/shared.js' : 'shared.js';
      const content = variant === 'lite' ? 'variants/home-search-only/content.js' : 'content.js';
      for (const path of [shared, content, 'search.js']) {
        assert.doesNotThrow(() => runInContext(source(path), context, { filename: resolve(path) }));
      }
      await new Promise(setImmediate);
      assert.equal(root.dataset.ppSearchVersion, scenario.unavailableVersion ? 'unavailable' : version);
      assert.equal(root.dataset.ppHomeSearch, scenario.saved?.pureMode === false ? 'off' : 'on');
      assert.equal(events.get('keydown')?.length, 1, '搜索快捷键应继续初始化');
      document.body = {};
      assert.doesNotThrow(() => events.get('keydown')[0]({
        key: '/', code: 'Slash', composedPath: () => [],
        preventDefault() { assert.fail('页面没有搜索框时不应拦截输入'); },
        stopImmediatePropagation() {},
      }));
      assert.equal(root.dataset.ppSearch, undefined, '找不到搜索框时不残留展开状态');
    });
  }
}
