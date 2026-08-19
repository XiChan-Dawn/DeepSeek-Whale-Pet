const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 单实例：harness 重启时旧窗口还在的话，新实例直接退出，避免重复窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); }
  });
}

let win = null;
let ws = null;
let wsTimer = null;
const WS_URL = process.env.WHALE_PET_WS || 'ws://127.0.0.1:3080/api/events.mux';
const HTTP_PORT = parseInt(process.env.WHALE_PET_HTTP_PORT || '3199', 10);
const STATE_LOG = path.join(__dirname, '..', 'pet-state.log');
function log(msg) { try { fs.appendFileSync(STATE_LOG, new Date().toISOString() + ' ' + msg + '\n'); } catch {} }

function createWindow() {
  win = new BrowserWindow({
    width: 320,
    height: 260,
    useContentSize: true,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true, /* 后台运行：不显示任务栏图标 */
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('index.html');
  const wa = screen.getPrimaryDisplay().workArea;
  win.setPosition(wa.x + wa.width - 330, wa.y + wa.height - 300);
}

// DSH 事件源：主动连接 harness 的 /api/events.mux
function connect() {
  clearTimeout(wsTimer);
  try { ws = new WebSocket(WS_URL); } catch { wsTimer = setTimeout(connect, 3000); return; }
  ws.onopen = () => { log('ws open'); win?.webContents.send('pet:conn', true); };
  ws.onmessage = (m) => {
    try { win?.webContents.send('pet:event', JSON.parse(m.data)); } catch {}
  };
  ws.onclose = () => { log('ws close'); win?.webContents.send('pet:conn', false); wsTimer = setTimeout(connect, 3000); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

// 本地 HTTP 事件入口（OpenCode 等其它 harness 的适配器用）：
// POST /event  body: {"type":"turn/start","data":{...}}
// 包装成 mux 帧格式 {payload:{event:{type,data}}} 送给页面，与 DSH 共用同一套状态机。
function startHttpInlet() {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/event') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body);
          if (obj && obj.type) {
            win?.webContents.send('pet:event', { payload: { event: { type: obj.type, data: obj.data || {} } } });
            res.writeHead(200); res.end('ok');
          } else { res.writeHead(400); res.end('bad'); }
        } catch { res.writeHead(400); res.end('bad'); }
      });
    } else { res.writeHead(404); res.end(); }
  });
  server.listen(HTTP_PORT, '127.0.0.1', () => log('http inlet on 127.0.0.1:' + HTTP_PORT));
  server.on('error', (e) => log('http inlet error: ' + e.message));
}

app.whenReady().then(() => { log('app ready'); createWindow(); log('window created'); connect(); startHttpInlet(); });
app.on('window-all-closed', () => app.quit());
ipcMain.on('pet:quit', () => app.quit());
ipcMain.on('pet:topmost', (_e, v) => win?.setAlwaysOnTop(!!v, 'screen-saver'));
ipcMain.on('pet:size', (_e, w, h) => win?.setSize(w, h));
ipcMain.on('pet:log', (_e, s) => log('renderer: ' + s));
