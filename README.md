# 🐋 DS Whale Pet — 鲸鱼桌面宠物（DeepSeek Harness + OpenCode）

一个自包含的 DeepSeek Harness 插件 + OpenCode 适配器：自动拉起一只**透明、置顶、无任务栏图标**的鲸鱼桌面宠物（QQ 宠物风格），通过事件流实时跟随 agent 状态（思考中 / 运行工具 / 生成中 / 完成 / 待命）切换动画。

鲸鱼动画资源（`whale.svg` + `work-logo.css`）原样解包自 DeepSeek GUI，包含 19 组原始关键帧（波浪、水花、气泡、尾鳍独立摇摆等）。

**包里只有宠物本身（约 1.5MB）**：插件**零依赖**（`package.json` 无 dependencies），安装时不下载任何东西。Electron 由使用者**全局安装**（`npm i -g electron`），装在 harness 之外的标准位置——任何 Node 机器全局装包都会放在那里。

## 功能

- 透明无边框置顶窗口，盖在所有应用之上，任务栏无图标（`skipTaskbar`）
- 拖动窗口任意移动；点击状态气泡展开设置面板调大小（zoom 滑杆，自动记住）
- 跟随 agent 状态：思考（游泳+气泡）、工具（显示工具名）、生成（全速游泳）、完成（跳跃）、暂停（回待命）
- 单实例：多个事件源/多次重启时旧窗口复用，不会出现多个宠物

## 资源来源与许可

鲸鱼动画资源（`whale.svg` + `work-logo.css`，含 19 组原始关键帧）**原样解包**自 [DeepSeek GUI](https://deepseek-gui.com) 开源桌面应用（第三方开源项目，非 DeepSeek 官方产品），**版权归原作者所有**。

- 资源本体未做任何修改，仅调整了展示裁切参数（`desktop/work-logo.css`）；
- 使用遵循原项目的开源许可证，具体以**原仓库的 LICENSE 为准**；
- 本项目为学习/个人用途的非商业分发，如原许可证有署名要求，本声明即保留原作者版权标注；
- 如需商用或二次分发，请先查看原项目许可证或联系原作者。

## 支持的事件源

| 来源 | 机制 | 代码 |
|---|---|---|
| **DeepSeek Harness** | DSH 插件（Cordis）启动宠物 + 直连 `ws://127.0.0.1:3080/api/events.mux` | `adapters/deepseek-harness/index.js` + `desktop/main.js` |
| **OpenCode** | OpenCode 插件订阅事件总线 → 翻译 → `POST http://127.0.0.1:3199/event` | `adapters/opencode/index.js` |

## 准备 Electron（全局安装，一次性）

```powershell
npm i -g electron
```

宠物从 npm 全局位置查找运行时（Windows 默认 `%APPDATA%\npm\node_modules\electron\dist\electron.exe`；改了 npm prefix 也能自动识别；可用环境变量 `WHALE_PET_ELECTRON_DIR` 显式指定）。缺失时只打日志跳过，不影响宿主启动。

## DeepSeek Harness 安装

```powershell
# 1. 安装插件（git 地址，无空格问题；不会自动下载任何依赖）
dsh plugin --profile web add https://github.com/XiChan-Dawn/DeepSeek-Whale-Pet.git

# 2. 启用（一次性，加到 ~/.dsh/profiles/web/cordis.patch.yml）
#    - insert:
#        - id: ds-whale-pet
#          name: '@deepseek-ai/ds-whale-pet'

# 3. 重启 harness，右下角出现鲸鱼
dsh --profile web
```

> 依赖 pnpm（`npm install -g pnpm`）。

## OpenCode 安装

```bash
# 1. 克隆仓库（或直接下载源码）
git clone https://github.com/XiChan-Dawn/DeepSeek-Whale-Pet.git

# 2. 安装 OpenCode 适配插件（指向本仓库的 adapters/opencode 目录；也可把该目录单独发 npm/git 包）
opencode plugin add DeepSeek-Whale-Pet/adapters/opencode
```

插件加载时会自动拉起桌面宠物并订阅 OpenCode 事件总线，无需其它配置。事件映射：

| OpenCode 事件 | 宠物状态 |
|---|---|
| `session.created` | 思考中… |
| `message.part.updated`（流式，节流） | 生成中… |
| `file.edited` | 运行 edit |
| `permission.updated` | 等你确认… |
| `session.updated` / `session.status` 含 completed | 搞定 ✨ |
| `session.error` | 已暂停 |

## 卸载

```powershell
dsh plugin --profile web remove @deepseek-ai/ds-whale-pet
# 并从 cordis.patch.yml 删除启用行
# （可选）opencode plugin remove ds-whale-pet-opencode
# （可选）npm uninstall -g electron
```

## 目录结构

```
DeepSeek-Whale-Pet/          # 包里只有宠物本身（~1.5MB），零依赖
├── adapters/             # 各 harness 适配器（与 desktop 平级，新增适配都放这里）
│   ├── deepseek-harness/ # DeepSeek Harness 适配（Cordis 插件，拉起宠物）
│   └── opencode/         # OpenCode 适配插件（订阅事件 → 推送宠物）
├── desktop/              # 桌面宠物应用（透明置顶窗口，动画 + 状态机 + HTTP 事件入口）
├── whale-pet-assets/     # 原始动画资源（whale.svg、work-logo.css、demo）
├── package.json          # 无 dependencies，安装不下载任何东西

（harness 之外）npm 全局：%APPDATA%\npm\node_modules\electron\dist\electron.exe
```

## 开发说明

- 改动画/裁切：编辑 `desktop/work-logo.css` / `desktop/pet.css`，重启宠物窗口生效
- 调大小：点击宠物底部的状态气泡 → 拖动 zoom 滑杆（存 localStorage）
- 宠物 HTTP 事件入口：`POST http://127.0.0.1:3199/event`，body `{"type":"turn/start","data":{}}`（端口可用 `WHALE_PET_HTTP_PORT` 改）
- Electron 版本：`desktop` 应用主进程在 `desktop/main.js`；`npm i -g electron` 装的是最新稳定版
