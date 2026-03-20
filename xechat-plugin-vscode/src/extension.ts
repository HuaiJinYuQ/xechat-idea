import * as crypto from "crypto";
import * as vscode from "vscode";
import WebSocket from "ws";

type MessageType =
  | "USER"
  | "SYSTEM"
  | "HISTORY_MSG"
  | "ONLINE_USERS"
  | "STATUS_UPDATE"
  | "USER_STATE"
  | "HEARTBEAT"
  | string;
type ChatAction = "LOGIN" | "CHAT" | "HEARTBEAT" | string;

interface ChatEnvelope {
  action: ChatAction;
  body: unknown;
}

interface ChatResponse {
  user?: { username?: string };
  body?: unknown;
  type?: MessageType;
  time?: string;
}

interface ChatSettings {
  serverUrl: string;
  nickname: string;
  autoReconnect: boolean;
  reconnectIntervalSeconds: number;
}

let panel: vscode.WebviewPanel | undefined;
let socket: WebSocket | undefined;
let reconnectTimer: NodeJS.Timeout | undefined;
let reconnectAttempt = 0;
let lastConnected = false;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push(
    vscode.commands.registerCommand("xechat.openChat", () => {
      openPanel(context);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("xechat")) {
        return;
      }
      sendToWebview({
        type: "settings",
        payload: getSettings()
      });
      reconnect("配置已变更，正在重连");
    })
  );
}

export function deactivate(): void {
  closeSocket();
  clearReconnectTimer();
}

function openPanel(context: vscode.ExtensionContext): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  panel = vscode.window.createWebviewPanel("xechatChat", "XEChat", vscode.ViewColumn.One, {
    enableScripts: true
  });
  panel.webview.html = getWebviewHtml(panel.webview);

  panel.webview.onDidReceiveMessage((message: { type: string; payload?: string }) => {
    if (message.type === "ready") {
      sendToWebview({ type: "settings", payload: getSettings() });
      connect();
      return;
    }
    if (message.type === "send") {
      sendChat(message.payload ?? "");
      return;
    }
    if (message.type === "reconnect") {
      reconnect("手动触发重连");
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
    closeSocket();
    clearReconnectTimer();
  });

  context.subscriptions.push(panel);
}

function getSettings(): ChatSettings {
  const config = vscode.workspace.getConfiguration("xechat");
  return {
    serverUrl: config.get<string>("serverUrl", "ws://localhost:1025/xechat").trim(),
    nickname: config.get<string>("nickname", "xechat_user").trim(),
    autoReconnect: config.get<boolean>("autoReconnect", true),
    reconnectIntervalSeconds: config.get<number>("reconnectIntervalSeconds", 3)
  };
}

function getUuid(): string {
  const key = "xechat.uuid";
  let value = extensionContext.globalState.get<string>(key);
  if (!value) {
    value = crypto.randomUUID();
    void extensionContext.globalState.update(key, value);
  }
  return value;
}

function connect(): void {
  if (!panel) {
    return;
  }
  closeSocket();
  clearReconnectTimer();

  const settings = getSettings();
  if (!settings.serverUrl) {
    updateStatus("error", "未配置服务地址");
    return;
  }
  if (!settings.nickname) {
    updateStatus("error", "未配置昵称");
    return;
  }

  updateStatus("connecting", `连接中：${settings.serverUrl}`);
  socket = new WebSocket(settings.serverUrl);

  socket.on("open", () => {
    reconnectAttempt = 0;
    updateStatus("connected", `已连接：${settings.serverUrl}`);
    sendEnvelope({
      action: "LOGIN",
      body: {
        username: settings.nickname,
        status: "FISHING",
        reconnected: lastConnected,
        pluginVersion: "vscode-0.0.1",
        token: "",
        uuid: getUuid(),
        platform: "WEB"
      }
    });
    lastConnected = true;
  });

  socket.on("message", (raw) => {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    try {
      const data = JSON.parse(text) as ChatResponse;
      handleServerMessage(data);
    } catch {
      updateStatus("error", "服务端消息解析失败");
    }
  });

  socket.on("error", (error) => {
    updateStatus("error", `连接错误：${error.message}`);
  });

  socket.on("close", () => {
    updateStatus("disconnected", "连接已断开");
    scheduleReconnect();
  });
}

function reconnect(reason: string): void {
  appendSystem(reason);
  connect();
}

function scheduleReconnect(): void {
  const settings = getSettings();
  if (!settings.autoReconnect || !panel) {
    return;
  }
  clearReconnectTimer();
  reconnectAttempt += 1;
  const seconds = Math.max(1, settings.reconnectIntervalSeconds);
  updateStatus("reconnecting", `${seconds}秒后自动重连（第${reconnectAttempt}次）`);
  reconnectTimer = setTimeout(() => {
    connect();
  }, seconds * 1000);
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = undefined;
  }
}

function sendEnvelope(data: ChatEnvelope): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    updateStatus("error", "未连接服务端，消息发送失败");
    return;
  }
  socket.send(JSON.stringify(data));
}

function sendChat(content: string): void {
  const text = content.trim();
  if (!text) {
    return;
  }
  sendEnvelope({
    action: "CHAT",
    body: {
      content: text,
      msgType: "TEXT"
    }
  });
}

function handleServerMessage(message: ChatResponse): void {
  const type = message.type ?? "";
  if (type === "HEARTBEAT") {
    return;
  }
  if (type === "HISTORY_MSG") {
    const history = (message.body as { msgList?: ChatResponse[] } | undefined)?.msgList ?? [];
    for (const item of history) {
      renderChatMessage(item);
    }
    return;
  }
  renderChatMessage(message);
}

function renderChatMessage(message: ChatResponse): void {
  const type = message.type ?? "";
  if (type === "SYSTEM") {
    appendSystem(toText(message.body));
    return;
  }
  if (type === "USER") {
    const name = message.user?.username ?? "未知用户";
    const text = getUserMessageContent(message.body);
    sendToWebview({
      type: "message",
      payload: {
        sender: name,
        content: text,
        time: message.time ?? ""
      }
    });
    return;
  }
  if (type === "USER_STATE") {
    appendSystem(getUserStateText(message.body));
    return;
  }
  if (type === "STATUS_UPDATE") {
    const name = message.user?.username ?? "用户";
    const status = getStatusName(message.user);
    appendSystem(`${name} 状态更新为 ${status}`);
    return;
  }
  if (type === "ONLINE_USERS") {
    const total = getOnlineUsersTotal(message.body);
    updateStatus("connected", `已连接，在线用户 ${total} 人`);
    return;
  }
  const fallback = toText(message.body);
  if (fallback) {
    appendSystem(fallback);
  }
}

function getUserMessageContent(body: unknown): string {
  if (typeof body === "string") {
    return body;
  }
  if (body && typeof body === "object") {
    const payload = body as { content?: unknown };
    if (payload.content !== undefined && payload.content !== null) {
      return toText(payload.content);
    }
  }
  return toText(body);
}

function getOnlineUsersTotal(body: unknown): number {
  if (!body || typeof body !== "object") {
    return 0;
  }
  const userList = (body as { userList?: unknown[] }).userList;
  if (!Array.isArray(userList)) {
    return 0;
  }
  return userList.length;
}

function getStatusName(user: ChatResponse["user"]): string {
  if (!user || typeof user !== "object") {
    return "未知";
  }
  const raw = (user as { status?: { name?: unknown } | unknown }).status;
  if (raw && typeof raw === "object") {
    const name = (raw as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }
  return "未知";
}

function getUserStateText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "用户状态变更";
  }
  const payload = body as { state?: unknown; user?: { username?: unknown } };
  const name = typeof payload.user?.username === "string" ? payload.user.username : "用户";
  const state = payload.state === "ONLINE" ? "上线" : payload.state === "OFFLINE" ? "离线" : "状态变更";
  return `${name} ${state}`;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendSystem(content: string): void {
  sendToWebview({
    type: "system",
    payload: {
      content
    }
  });
}

function updateStatus(state: string, content: string): void {
  sendToWebview({
    type: "status",
    payload: {
      state,
      content
    }
  });
}

function sendToWebview(data: unknown): void {
  if (panel) {
    void panel.webview.postMessage(data);
  }
}

function getWebviewHtml(webview: vscode.Webview): string {
  const nonce = crypto.randomBytes(16).toString("base64");
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>XEChat</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;background:#1f1f1f;color:#ddd}
.wrap{display:flex;flex-direction:column;height:100vh}
.top{padding:10px;border-bottom:1px solid #333;display:flex;gap:8px;align-items:center}
.status{font-size:12px;color:#bbb;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button{background:#0e639c;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer}
button:hover{background:#1177bb}
.list{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.item{padding:8px;border-radius:6px;background:#2b2b2b}
.meta{font-size:12px;color:#999;margin-bottom:4px}
.sys{background:#2a2332;border-left:3px solid #7f5af0}
.bottom{padding:10px;border-top:1px solid #333;display:flex;gap:8px}
input{flex:1;padding:8px;border-radius:4px;border:1px solid #555;background:#111;color:#eee}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><div id="status" class="status">初始化中...</div><button id="reconnect">重连</button></div>
<div id="list" class="list"></div>
<div class="bottom"><input id="input" type="text" placeholder="输入消息后回车发送" /><button id="send">发送</button></div>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const list = document.getElementById("list");
const statusEl = document.getElementById("status");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const reconnectBtn = document.getElementById("reconnect");
function append(sender, content, time, sys) {
  const item = document.createElement("div");
  item.className = "item" + (sys ? " sys" : "");
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = sys ? "系统" : (sender + (time ? " · " + time : ""));
  const body = document.createElement("div");
  body.textContent = content;
  item.appendChild(meta);
  item.appendChild(body);
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}
function send() {
  const value = input.value.trim();
  if (!value) return;
  vscode.postMessage({ type: "send", payload: value });
  input.value = "";
}
sendBtn.addEventListener("click", send);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
reconnectBtn.addEventListener("click", () => {
  vscode.postMessage({ type: "reconnect" });
});
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "status") {
    statusEl.textContent = msg.payload.content;
  } else if (msg.type === "system") {
    append("", msg.payload.content, "", true);
  } else if (msg.type === "message") {
    append(msg.payload.sender, msg.payload.content, msg.payload.time, false);
  } else if (msg.type === "settings") {
    append("", "当前配置：昵称 " + msg.payload.nickname + "，地址 " + msg.payload.serverUrl, "", true);
  }
});
vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}
