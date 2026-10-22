# PurpleBook 开发说明

## 环境与结构

扩展可直接加载，无构建步骤。开发预览和图标生成需要 Node.js 18+，仅使用内置模块，无需安装依赖。

| 路径 | 职责 |
| --- | --- |
| `manifest.json` | MV3 元数据、权限、脚本顺序、快捷键 |
| `shared.js` | `globalThis.PurpleBook`、默认值、状态规范化、搜索 URL |
| `content.css` | 组件隐藏、临时搜索视图、信息流位移 |
| `content.js` | 设置同步、根节点门控、居中测量 |
| `search.js` | 原生搜索框发现、快捷操作、SPA 恢复 |
| `background.js` | service worker：快捷键与选中文字右键菜单 |
| `popup/` | 设置和搜索弹窗 |
| `icons/`、`scripts/gen-icons.mjs` | 图标与零依赖生成器 |
| `debug/probe.js` | 站点 DOM 选择器探针 |
| `qa/serve.mjs` | 本地预览服务器 |
| `qa/chrome-stub.js` | 浏览器 API 模拟 |
| `qa/search-preview.html`、`qa/layout-preview.html` | 搜索与居中回归页面 |
| `qa/popup-test/` | 自动生成的预览副本，Git 忽略 |

内容脚本按 `shared.js → content.js → search.js` 在 `document_start` 加载；background 使用 `importScripts`，popup 使用脚本标签。共享脚本必须先于使用者运行。

## 状态

`chrome.storage.sync` 存储以下结构，由 `normalizeState` 补齐默认值、过滤非布尔值：

```json
{
  "pureMode": true,
  "components": {
    "header": true,
    "sidebar": true,
    "aiBanner": true,
    "stickySearch": true,
    "floatButton": true
  },
  "features": {
    "slashSearch": true,
    "contextMenuSearch": true,
    "hideSearchSuggestions": true,
    "hideAISearchResult": false,
    "hideLive": false,
    "hideAIChat": false,
    "hidePublish": false,
    "hideNotifications": false,
    "hideNotificationBadge": false,
    "hideRedVideo": false
  }
}
```

`components` 中 `true` 表示隐藏，受总开关控制；`features` 独立生效。`storage.set` 不做深合并，改一项时须带上该对象的其他现有键。状态通过 `chrome.storage.onChanged` 回流到弹窗和内容脚本。

更名保留存储键和 `data-pp-*` DOM 属性；共享命名空间统一为 `PurpleBook`。新增功能应同步默认值、UI、门控或监听，并检查旧状态缺少新键时的行为。

## 预览与基础检查

在项目根目录执行：

```sh
node qa/serve.mjs
```

| 地址 | 检查内容 |
| --- | --- |
| `http://127.0.0.1:8791/popup.html` | 弹窗、开关、搜索目标 URL |
| `http://127.0.0.1:8791/explore` | 经典搜索框、编辑区域防误触 |
| `http://127.0.0.1:8791/explore?layout=ai` | 新版搜索框、隐藏旧输入框 |
| `http://127.0.0.1:8791/layout` | 绝对定位卡片、缓存返回、替换网格 |

端口冲突时用 `node qa/serve.mjs 0`，以终端实际地址为准；Ctrl+C 停止。预览副本在启动时生成，改源码后须重启服务并刷新。

模拟设置只保存在当前页内存，刷新恢复默认，各页面间不共享。弹窗搜索仅展示 URL；真实右键菜单、快捷键、同步和登录须在实际扩展中验证。

```sh
node scripts/gen-icons.mjs
node --check shared.js
node --check background.js
node --check content.js
node --check search.js
node --check popup/popup.js
node --check qa/serve.mjs
```

## 回归清单

| 场景 | 预期 |
| --- | --- |
| 默认加载 | 五个组件隐藏，首页信息流居中 |
| 总开关、快捷键 | 即时隐藏 / 恢复，关闭后不残留偏移 |
| 单独显示侧栏 | 恢复侧栏空间，右侧卡片不裁切 |
| `/` → `Esc` | 原生输入框获焦，返回后恢复焦点、滚动和布局 |
| 新版 AI 搜索布局 | 不选中隐藏旧框，标题与提示不覆盖输入框 |
| 评论、富文本和输入法 | 斜杠不误触搜索视图 |
| 提交搜索 | 原生结果可见，中文及特殊字符编码正确 |
| 独立功能 | 总开关关闭时仍遵循自身设置 |
| 缓存返回、替换网格 | 清除旧偏移，右侧卡片仍可见 |
| 关闭 / 开启右键搜索 | 菜单消失 / 出现且不重复 |
| 原目录更新 | 新名称生效，设置保留 |

## 选择器维护

1. 在小红书页面 F12 Console 粘贴运行 `debug/probe.js`。
2. 检查命中和 `display`；对 `absent` 项用 `__ppFind("元素文字")` 反查当前 class 链。
3. 更新 `content.css`，保留总开关和组件门控，例如 `html:not([data-pp-pure='off'])`。
4. 居中异常检查 `#exploreFeeds`、`.feeds-content`、`section.note-item` 及 `content.js` 的测量目标；搜索异常检查 `search.js` 的 `findSearch` / `isUsableSearch`。
5. 重新加载扩展并刷新页面，覆盖首页、下滚后的吸顶布局和搜索结果页。

居中通过根节点 `data-pp-feed-centered` 和 `--pp-feed-shift` 控制，不写网格内联 `left` / `position`；临时搜索暂停偏移，关闭净化、显示侧栏或更换节点应重算或清除。

默认 CSS 在 `document_start` 注入。用户保存为关闭时，异步读取设置前可能短暂出现默认净化布局。

## 版本与提交

更改版本时同步 `manifest.json`、`qa/chrome-stub.js`、README 和更新记录。按实际变更拆分 `refactor:`、`fix:`、`docs:` 提交；导入快照不伪装成早期开发历史，不回填未知日期。

生成的 `qa/popup-test/`、依赖目录及日志不提交。提交前执行 `git diff --check` 并完成相关预览和实页检查。
