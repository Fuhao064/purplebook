# PurplePurify — 小红书纯净信息流与搜索（Chrome 扩展）

把 [PurpleBook](../purplebook)（Electron 小红书壳）里打磨好的「首页净化」功能，
原样打包成**零构建 Chrome MV3 扩展**：不依赖 Tampermonkey，无 npm 依赖，
`chrome://extensions` 加载即用。

功能：

- **信息流总开关**：一键净化 / 还原原有信息流布局，纯 CSS 隐藏、从不删除 DOM
- **分组件隐藏**：以下元素各自独立开关，想隐藏哪个就隐藏哪个
  - 顶部导航栏（logo / 搜索框 / 登录·发布按钮）
  - 左侧边栏（频道导航 / 登录入口 / 备案信息）
  - 「问点点」AI 搜索横幅
  - 吸顶搜索框（下滑后滑入）
  - 「图片搜索」悬浮按钮
- **信息流自动居中**：隐藏侧边栏时网格居中、占满整个窗口
  （受纯净流/侧栏开关门控的 CSS 位移，MutationObserver / ResizeObserver 自适应重算；
  关闭纯净流或显示侧栏时自动回到原始布局，页面缓存不残留偏移）
- **按 `/` 进入纯净搜索**：临时隐藏页面内容、居中并聚焦小红书原生搜索框。`Esc` 或「返回页面」恢复当前页面；搜索提交后退出搜索视图，继续使用站点原生搜索。
- **弹窗搜索**：在任意网页点击插件图标，输入关键词，在新标签页打开小红书搜索结果。
- **选中文字右键搜索**：选中任意网页上的文字，通过右键菜单在小红书搜索；可独立关闭。
- **搜索与侧栏精简**：独立控制「猜你想搜」、搜索结果 AI 卡片、直播、AI 聊天、发布、通知、通知小红点及 RED 视频入口。

搜索交互及精简功能参考 [rednote-tweak](https://github.com/maxchang3/rednote-tweak)，按本拓展的零构建结构实现。默认首页继续显示纯净信息流；临时搜索视图不会写入或翻转 `pureMode`、`components`。

## 纯净搜索的使用

在小红书页面的非编辑区域按 `/`，搜索框会在页面中央出现并获得焦点。输入关键词后按 Enter，或点击原生搜索图标。按 `Esc` 返回时会恢复之前的焦点及滚动位置。

在输入框、评论框、富文本区域中键入 `/`，以及使用 Ctrl/Alt/Meta 组合键、输入法组合输入时，不触发快捷搜索。站点的登录要求、搜索联想和搜索结果仍由小红书处理。

0.3.2 修复：按实际可交互状态筛选搜索框，跳过新版布局隐藏的旧搜索框及透明、`aria-hidden` 的镜像输入；兼容非编辑区域的物理斜杠键及全角斜杠。新版大搜索框保持原生高度，标题与提示随高度调整；搜索视图也会覆盖新版卡片自身的可见样式，避免信息流漏出。

0.3.3 修复：居中偏移改为受开关约束的 CSS 变量，不再写入网格的内联 `left`。关闭纯净流、显示侧栏、缓存页面返回或替换网格时，旧偏移不会继续把右侧帖子推到窗口外；居中范围按实际内容区和视口计算，临时搜索期间暂停居中。

## 安装

1. 下载 / 克隆本目录
2. 打开 `chrome://extensions`（Edge: `edge://extensions`）
3. 右上角开启「开发者模式」
4. 「加载已解压的扩展程序」→ 选择本文件夹（含 `manifest.json` 的目录）

## 操作方式

| 方式 | 操作 |
|---|---|
| Popup | 搜索输入框 + 纯净信息流开关 + 五个组件开关；「搜索增强」「侧栏入口精简」展开后独立设置 |
| 页面搜索 | 在小红书页面按 `/`，`Esc` 返回；在编辑区域打字时不触发 |
| 右键搜索 | 任意网页选中文字 → 在小红书中搜索 |
| 快捷键 | `Alt+Shift+P`（可在 `chrome://extensions/shortcuts` 改键；Chrome 扩展禁止 `Ctrl+Alt` 组合的建议键，故无法沿用 PurpleBook 的 `Ctrl+Alt+P`） |
| 存储同步 | 状态存 `chrome.storage.sync`（键 `pureMode`，默认开），登录同一 Chrome 账号的多设备自动同步 |

## 目录说明

```
purplepurify/
├── manifest.json      # MV3：storage/contextMenus 权限；document_start 注入
├── content.css        # 净化规则（总开关 + 每组件一个豁免属性门控）
├── content.js         # 门控属性切换 + 适配缓存/重建页面的信息流居中器
├── search.js          # 原生搜索框临时居中、键盘与 SPA 导航恢复
├── shared.js          # 状态规范化、功能列表、搜索 URL（页面 / popup / background 共用）
├── background.js      # 快捷键总开关 + 选中文字右键搜索
├── popup/             # 搜索输入框 + 总开关 / 组件 / 新功能设置
├── icons/             # scripts/gen-icons.mjs 生成（零依赖 PNG 编码）
├── debug/probe.js     # 选择器漂移修复探针（F12 控制台粘贴运行）
└── qa/                # Popup 与原生搜索结构的本地交互预览（chrome API stub）
```

## 选择器 ↔ 元素对照表

| 组件开关 | 选择器 | 元素 |
|---|---|---|
| 顶部导航栏 | `.header-container` | 顶部导航栏（logo、搜索框、登录/发布按钮） |
| 左侧边栏 | `.side-bar` | 左侧边栏（频道导航、登录入口、备案信息） |
| AI 横幅 | `.search-area` | 信息流顶部「问点点」AI 搜索横幅 |
| 吸顶搜索框 | `.ai-header-container` / `.search-area-in-header` | 下滚后滑入的吸顶搜索框 |
| 悬浮按钮 | `.floating-btn-sets .graphic-filter` | 右下角「图片搜索」悬浮按钮 |

布局收回规则跟随所属组件：`.main-content.with-side-bar` 的 `padding-left: 0`
跟随**左侧边栏**开关（侧栏显示时保留预留空间，避免遮挡）；`.feeds-page` 的
`padding-top: 16px` 跟随**顶部导航栏**开关。

居中器操作对象：`#exploreFeeds`（网格）、`.channel-container`（频道栏）、
`.feeds-loading`（骨架屏），三者同步平移保持对齐。根节点的
`data-pp-feed-centered="on"` 和 `--pp-feed-shift` 控制位移；组件节点的内联
`left` / `position` 保留给站点。位移规则同时受总开关、侧栏开关和临时搜索状态约束。

## 状态结构（chrome.storage.sync）

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

组件布尔语义：**true = 隐藏**（与"净化"心智一致）。默认全部 true，
旧版本（只有 `pureMode`）升级后行为不变。注意 `storage.set` 不做深合并，
更新组件必须整包写入 `components` 对象（popup 已处理）。

`features` 同样整包写入；各功能独立于纯净信息流开关。「按 / 搜索」「右键搜索」「隐藏猜你想搜」默认开启，其余新增精简选项默认关闭。旧版设置保留并补齐新功能的默认值。

## 选择器漂移修复（站点改版后）

小红书改版后 class 可能变化，症状是"某个区块又出现了"。修复流程
（工具已内置，不再需要 PurpleBook 时代的 9223 调试端口）：

1. 在小红书页面按 F12，把 `debug/probe.js` 全文粘贴进 Console 回车
   —— 逐条报告净化与搜索选择器的命中情况及 `display` 状态；
2. 对显示 `absent` 或 `display` 不为 `none` 的条目，运行全局函数
   `__ppFind("元素文本")`（如 `__ppFind("问点点")`），按文本反查当前的
   class 祖先链；
3. 把新选择器更新进 `content.css`（注意保持
   `html:not([data-pp-pure='off'])` 前缀门控）；
4. 重新粘贴 `debug/probe.js` 确认全部命中。

若居中器失效（信息流不再居中），通常是 `#exploreFeeds` / `.feeds-content` /
`section.note-item` 漂移 —— 同样用 `__ppFind` 定位后在 `content.js` 中更新。

## 实现说明与取舍

- **零闪烁**：CSS 由 manifest 在 `document_start` 注入且默认生效；只有"关闭净化"
  的用户会在页面加载最初几毫秒看到一次净化→还原的极短闪烁（受 MV3 异步
  storage 读取所限，与默认开启体验无关）。
- **实时切换**：popup / 快捷键 / 页面三端统一由 `chrome.storage.onChanged` 驱动，
  修复了 PurpleBook 中 `eachPageView` 未定义导致运行中窗口无法实时切换的问题。
- **分组件门控**：每个组件在 `<html>` 上有独立豁免属性（如 `data-pp-header="off"`
  表示"顶部导航栏显示"），CSS 规则默认生效、属性豁免——保证默认配置零闪烁，
  组件属性由 content.js 在 document_start 尽早写入。
- **全站生效**：隐藏规则作用于 `www.xiaohongshu.com` 全部页面（与 PurpleBook
  行为一致）；居中器只在首页（存在 `#exploreFeeds`）时实际生效，其他路由自动空转。
- **原生搜索视图**：输入框留在原 DOM 中，只临时添加布局属性；退出时移除属性。不替换原生输入框或事件，不保存搜索关键词。SPA 导航、搜索节点被替换或关闭快捷搜索选项时会清理临时视图。
- **权限**：新增 `contextMenus` 仅用于选中文字右键搜索；新标签页通过 `chrome.tabs.create` 打开，不需要读取其他标签页内容。
- **与姐妹项目的关系**：`purplescript` 是从零按 resolver 架构写的"可配置 UI 定制层"
  （多开关 + 置信度识别 + 布局引擎）；PurplePurify 则是 PurpleBook 已验证规则的
  轻量直移——只求一个"装上就好"的纯净模式。两者互不依赖。

## 验证

- 加载后打开 `www.xiaohongshu.com`：首屏即为无搜索/侧边栏、信息流居中的纯净布局；
- `Alt+Shift+P` 或 Popup 切换，观察即时还原/净化，无需刷新；
- F12 粘贴 `debug/probe.js`，确认所有选择器命中；需要居中时根节点带 `data-pp-feed-centered="on"`，关闭纯净流或显示侧栏后该标记清除。
- 页面按 `/`，确认原生搜索框居中并获得焦点；按 `Esc`，确认信息流、滚动位置及组件设置恢复。
- 在评论框输入 `/`，确认不会弹出搜索；提交搜索后，确认搜索结果可见。
- Popup 与右键搜索，确认中文、空格、`&`、`#` 等关键词被正确编码。

本地交互预览：运行 `node qa/serve.mjs`，打开 `http://127.0.0.1:8791/popup.html` 或 `http://127.0.0.1:8791/explore`。端口被系统保留时用 `node qa/serve.mjs 0` 自动分配空闲端口，地址会输出到终端。`/explore?layout=ai` 复现新版隐藏旧搜索框及透明镜像输入的布局。预览使用模拟站点结构及浏览器 API，不代表已登录小红书的线上验证。

布局回归预览位于同一服务的 `/layout`：复现绝对定位瀑布流、164px 侧栏和裁剪容器；可切换纯净流/侧栏、缓存并返回首页、替换网格及缩窄内容区。重点检查“离开首页 → 关闭纯净流 → 返回首页”后右侧卡片完整可见，以及 `/`、Esc 返回后网格仍居中。
