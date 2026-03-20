# XEChat Plugin for VSCode/Trae

## 核心命令（已迁移）

- `XEChat: 打开聊天`：打开聊天面板并在面板就绪后自动连接
- `XEChat: 连接`：主动建立连接，并将执行结果写入聊天面板系统消息
- `XEChat: 断开`：手动关闭连接并更新状态为已断开
- `XEChat: 重连`：触发断线重连流程并反馈重连原因
- `XEChat: 状态`：在聊天面板输出当前连接状态与状态文案
- `XEChat: 浏览器工具`：提示不可迁移能力后，支持通过外部浏览器打开网址
- `XEChat: 阅读工具`：提示不可迁移能力后，支持读取当前文件或指定路径文件
- `XEChat: 帮助`：在聊天面板输出可用命令清单
- `XEChat: 发送消息`：通过输入框发送消息并在面板反馈发送结果
- `XEChat: 游戏功能说明（当前阶段不迁移）`：统一输出游戏禁用提示，不影响聊天主流程

## 命令/工具迁移矩阵（IDEA → VSCode/Trae）

基线来自两端代码：
- IDEA端：`xechat-plugin` 的 `Command`、`Tools`、`Game` 枚举与对应处理器
- VSCode端：`xechat-plugin-vscode` 的 `package.json` 命令贡献与 `extension.ts` 协议动作

### 命令迁移矩阵

| 命令域 | IDEA端能力 | VSCode当前状态 | 迁移级别 | 迁移状态 |
| --- | --- | --- | --- | --- |
| 会话基础 | `#login`、`#exit` | 已有 `openChat` + 自动 `LOGIN` + `disconnect` 主动断开 | 必迁移 | 已完成 |
| 聊天消息 | 普通消息发送 | 已支持 `CHAT` 发送与消息渲染 | 必迁移 | 已完成 |
| 用户状态 | `#showStatus`、`#setStatus` | 仅展示状态变更，无状态设置入口 | 必迁移 | 未开始 |
| 帮助引导 | `#help` | 已提供 `help` 命令并输出可用命令清单 | 必迁移 | 已完成 |
| 服务信息 | `#showServer` | 无鱼塘列表能力 | 可选 | 未开始 |
| 天气能力 | `#weather` | 无对应入口 | 可选 | 未开始 |
| 模式能力 | `#showMode`、`#mode` | 无对应入口 | 可选 | 未开始 |
| 通知与活跃 | `#notify`、`#alive`、`#moyu` | 无对应入口 | 可选 | 未开始 |
| 管控与终端 | `#admin`、`#clean` | 无对应入口 | 不迁移 | 冻结 |

### 工具迁移矩阵

| 工具域 | IDEA端能力 | VSCode当前状态 | 迁移级别 | 迁移状态 |
| --- | --- | --- | --- | --- |
| 阅读工具 | `READ`（`#open`/`#over`） | 已支持读取当前文件与指定路径文件，未迁移书架/目录联动 | 可选 | 部分完成 |
| 浏览器工具 | `BROWSER`（`#open`/`#over`） | 已支持输入网址并调用外部浏览器打开 | 不迁移 | 已完成（替代方案） |

### 游戏状态矩阵

| 游戏 | 当前状态 | 结论 |
| --- | --- | --- |
| 五子棋 | 未迁移 | 不迁移（当前阶段） |
| 斗地主 | 未迁移 | 不迁移（当前阶段） |
| 不贪吃蛇 | 未迁移 | 不迁移（当前阶段） |
| 2048 | 未迁移 | 不迁移（当前阶段） |
| 数独 | 未迁移 | 不迁移（当前阶段） |
| 推箱子 | 未迁移 | 不迁移（当前阶段） |
| 中国象棋 | 未迁移 | 不迁移（当前阶段） |
| 俄罗斯方块 | 未迁移 | 不迁移（当前阶段） |
| 扫雷 | 未迁移 | 不迁移（当前阶段） |

### 游戏迁移可行性结论

- 结论：当前阶段不迁移游戏能力
- 原因：IDEA端游戏实现依赖 Swing/AWT 本地窗口、键鼠事件循环与多套本地渲染资源，VSCode/Trae 端当前仅提供聊天 Webview 容器，直接迁移会引入高耦合改造并挤占主链路迭代
- 兜底：新增统一禁用提示命令，所有游戏入口均返回同一提示文案，确保聊天、连接、重连、消息发送等核心能力不被阻塞

### 统一禁用提示命令

- `XEChat: 游戏功能说明（当前阶段不迁移）`
- `XEChat: 游戏列表（已禁用）`
- `XEChat: 开始游戏（已禁用）`
- `XEChat: 加入游戏（已禁用）`
- `XEChat: 结束游戏（已禁用）`

以上命令与聊天输入中的 `#showGame`、`#play`、`#join`、`#over` 均会输出统一禁用提示。

## 新手启动指南（双路径）

### 先看结论：启动后是否需要安装？

- 如果你走“开发调试启动”，不需要安装到编辑器市场，直接在调试窗口使用。
- 如果你走“安装后使用”，需要先打包并安装 `.vsix`，再在日常编辑器中使用。

### 前置条件

- Node.js 20+
- VSCode 或 Trae（版本支持 `^1.90.0`）
- 可用的 XEChat 服务端，并确保服务端已开启 `enableWS=true`
- 默认连接地址为 `ws://localhost:1025/xechat`

### 路径A：开发调试启动（无需安装）

1. 进入 `xechat-plugin-vscode` 目录
2. 安装依赖：`npm install`
3. 类型检查：`npm run typecheck`
4. 编译扩展：`npm run compile`
5. 在 VSCode/Trae 中按 `F5` 启动扩展开发宿主
6. 在开发宿主中执行命令：`XEChat: 打开聊天`
7. 在设置中按需修改：
  - `xechat.serverUrl`
  - `xechat.nickname`
  - `xechat.autoReconnect`
  - `xechat.reconnectIntervalSeconds`

### 路径B：安装后使用（需要安装）

1. 进入 `xechat-plugin-vscode` 目录
2. 安装依赖：`npm install`
3. 类型检查：`npm run typecheck`
4. 编译扩展：`npm run compile`
5. 全局安装打包工具：`npm install -g @vscode/vsce`
6. 执行打包：`vsce package`
7. 在 VSCode/Trae 中安装生成的 `.vsix`
8. 执行命令：`XEChat: 打开聊天`
9. 在设置中按需修改：
  - `xechat.serverUrl`
  - `xechat.nickname`
  - `xechat.autoReconnect`
  - `xechat.reconnectIntervalSeconds`

## 最小排障

### 1）命令找不到 `XEChat: 打开聊天`

- 确认扩展已安装并处于启用状态
- 开发调试场景下，确认你在扩展开发宿主窗口执行命令
- 重新编译后重开窗口：`npm run compile`

### 2）执行命令后面板未出现

- 确认命令名称使用的是 `XEChat: 打开聊天`
- 查看当前窗口是否被其他面板覆盖，切换到活动编辑组重试
- 重新加载窗口后再次执行命令

### 3）面板出现但连接失败

- 确认服务端已启动，且 WebSocket 监听端口可访问
- 确认服务端配置 `enableWS=true`
- 检查 `xechat.serverUrl` 是否与服务端地址、端口、路径一致（默认 `ws://localhost:1025/xechat`）
