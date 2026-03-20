# XEChat Plugin for VSCode/Trae

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
3. 编译扩展：`npm run compile`
4. 在 VSCode/Trae 中按 `F5` 启动扩展开发宿主
5. 在开发宿主中执行命令：`XEChat: 打开聊天`
6. 在设置中按需修改：
  - `xechat.serverUrl`
  - `xechat.nickname`
  - `xechat.autoReconnect`
  - `xechat.reconnectIntervalSeconds`

### 路径B：安装后使用（需要安装）

1. 进入 `xechat-plugin-vscode` 目录
2. 安装依赖：`npm install`
3. 编译扩展：`npm run compile`
4. 全局安装打包工具：`npm install -g @vscode/vsce`
5. 执行打包：`vsce package`
6. 在 VSCode/Trae 中安装生成的 `.vsix`
7. 执行命令：`XEChat: 打开聊天`
8. 在设置中按需修改：
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
