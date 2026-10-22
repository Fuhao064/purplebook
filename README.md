# PurpleBook

小红书网页的纯净信息流与搜索扩展，适用于 Chrome / Microsoft Edge（Manifest V3）。

按 / 临时唤起原生搜索框，用 Esc 返回阅读；独立开关隐藏导航栏、侧栏、AI 横幅和其他入口，让首页信息流保持居中。原生 JavaScript + CSS，安装无需 Node.js、npm 或构建。

> 当前版本 **0.3.4**。本项目由 PurplePurify 更名为 PurpleBook，现以浏览器扩展形式维护。部分布局规则源自早期 PurpleBook Electron 版本。

## 功能

| 功能 | 行为 |
| --- | --- |
| 纯净信息流 | 一键隐藏或恢复页面组件，调整首页信息流居中 |
| 分组件隐藏 | 控制顶部导航栏、侧栏、AI 横幅、吸顶搜索框、图片搜索悬浮按钮 |
| 页面搜索 | 非编辑区域按 /，临时居中原生搜索框；Esc 或“返回页面”退出 |
| 弹窗搜索 | 点击扩展图标输入关键词，在新标签页打开小红书搜索结果 |
| 选中文字搜索 | 网页上选中文字，右键选择“在小红书中搜索…” |
| 独立精简 | 可隐藏猜你想搜、AI 结果卡片、直播、AI 聊天、发布、通知、小红点和 RED 视频入口 |
| 设置同步 | 浏览器账户同步可用时，通过 `chrome.storage.sync` 同步设置 |

纯净信息流默认开启，五个组件默认隐藏；/ 搜索、右键搜索和隐藏“猜你想搜”默认开启，其余独立精简项默认关闭。**关闭纯净信息流只关闭布局净化，搜索增强和独立精简开关仍按各自设置生效。**

## 安装与开始使用

1. 在 [GitHub 仓库](https://github.com/Fuhao064/purplebook) 点击 **Code → Download ZIP**，解压并保留文件夹；也可克隆仓库：

   ~~~sh
   git clone https://github.com/Fuhao064/purplebook.git
   ~~~

2. 打开 Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions`。
3. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择**直接包含 `manifest.json` 的目录**。
4. 打开或刷新 [小红书网页](https://www.xiaohongshu.com/explore)，将 PurpleBook 固定到工具栏。
5. 在页面非输入区域按 /，输入关键词后使用原生搜索；按 Esc 返回。也可点击扩展图标搜索。

总开关快捷键为 `Alt+Shift+P`，可在 `chrome://extensions/shortcuts` 或 `edge://extensions/shortcuts` 修改。

升级时，Git 安装在原目录运行 `git pull --ff-only`；ZIP 安装将新版文件覆盖到原文件夹。然后到扩展管理页点击“重新加载”，再刷新小红书标签页。保留原安装目录可避免更换本地扩展身份而丢失设置。

## 文档

- [使用指南](docs/USAGE.md)：开关含义、搜索操作、升级与常见问题。
- [开发说明](docs/DEVELOPMENT.md)：目录结构、状态约定、本地预览、回归检查和选择器维护。
- [更新记录](CHANGELOG.md)：版本变化与更名说明。

## 权限与数据

- `storage`：保存和同步开关设置。
- `contextMenus`：选中文字右键搜索，默认可在任意网页使用。
- 内容脚本仅注入 https://www.xiaohongshu.com/*，不请求读取全部标签页内容的权限。
- 代码不包含自建后端、埋点或搜索历史存储。搜索关键词会交给小红书处理，原生搜索仍遵循站点登录和访问要求。

## 开发预览

开发工具需要 Node.js 18+，无需安装依赖：

~~~sh
node qa/serve.mjs
~~~

打开 `http://127.0.0.1:8791/popup.html` 查看弹窗，`/explore` 查看搜索交互，`/explore?layout=ai` 查看新版搜索布局，`/layout` 检查居中。端口冲突时使用 `node qa/serve.mjs 0`，按终端实际地址访问。

预览使用模拟网页和浏览器 API，不能代替已加载扩展的小红书实页验证。

## 兼容性与致谢

功能依赖小红书网页 DOM 和 CSS 选择器，站点改版后可能需要更新。当前不提供 Firefox、Safari 或移动端版本。扩展不改变站点推荐算法或访问权限。

搜索增强和页面精简参考 [rednote-tweak](https://github.com/maxchang3/rednote-tweak)；早期 Electron 版本的布局与探针逻辑已适配为 MV3 内容脚本和 service worker。
