// whale-pet renderer: subscribes to the DeepSeek Harness mux event stream (via main-process IPC)
// and drives the whale animation state machine.
const stage = document.getElementById('stage');
const logo = document.getElementById('logo');
const statusText = document.getElementById('statusText');
const menu = document.getElementById('menu');

// Build the AnimatedWorkLogo DOM (same flat layer stack as the DeepSeek GUI app).
logo.innerHTML =
  ['gust', 'current', 'swell', 'wave wave-back', 'ripple', 'wave wave-front', 'breaker',
   'wake', 'foam', 'crest', 'splash', 'spray', 'bubbles']
    .map((c) => `<span class="ds-work-logo-${c}"></span>`).join('') +
  '<img class="ds-work-logo-echo" src="whale.svg" alt="" draggable="false">' +
  '<span class="ds-work-logo-track"><span class="ds-work-logo-body">' +
  '<img class="ds-work-logo-image" src="whale.svg" alt="" draggable="false">' +
  '<img class="ds-work-logo-tail" src="whale.svg" alt="" draggable="false">' +
  '</span></span>';

const ACTIVE = new Set(['thinking', 'tool', 'working', 'done']);
let state = 'offline';
let lastActivity = Date.now();
let doneTimer = null;

function setState(s, label) {
  state = s;
  stage.className = 'pet-stage state-' + s;
  logo.classList.toggle('is-active', ACTIVE.has(s));
  statusText.textContent = label;
  window.pet.logState(s + ' | ' + label);
  clearTimeout(doneTimer);
  if (s === 'done') doneTimer = setTimeout(() => { if (state === 'done') setState('idle', '待命中'); }, 2600);
}

// Map harness mux events -> pet states. All known session event types at a glance;
// only the ones that change the pet's mood are handled.
function handleEvent(obj) {
  const ev = obj.payload && obj.payload.event;
  if (!ev) return;
  lastActivity = Date.now();
  const d = ev.data || {};
  switch (ev.type) {
    case 'user/message':      setState('working', '收到，开工！'); break;
    case 'turn/start':
    case 'step/start':        setState('thinking', '思考中…'); break;
    case 'tool/call':         setState('tool', '运行 ' + (d.name || '工具')); break;
    case 'tool/result':       setState('thinking', '工具完成，继续…'); break;
    case 'assistant/chunk':
      if (d.chunk && d.chunk.type === 'text-delta') setState('working', '生成中…');
      break;
    case 'assistant/message': setState('working', '回复完成'); break;
    case 'turn/end': {
      // 暂停/停止/出错：直接回待命，不显示"搞定"
      const kind = d.reason && d.reason.kind;
      if (kind === 'aborted' || kind === 'interrupted' || kind === 'cancelled' || kind === 'error') {
        setState('idle', '已暂停');
      } else {
        setState('done', '搞定 ✨');
      }
      break;
    }
    case 'approval/asked':    setState('approval', '等你确认…'); break;
    case 'approval/decided':  setState('thinking', '继续中…'); break;
    case 'llm/retry':         setState('thinking', '重试中…'); break;
  }
}

// Main process relays mux frames + connection state.
window.pet.onEvent(handleEvent);
window.pet.onConn((ok) => {
  if (ok) setState('idle', '待命中');
  else if (state !== 'offline') setState('offline', '离线，重连中…');
});

// Idle fallback: no harness activity for a while -> back to idling.
// 8s（暂停/挂起时事件可能不再流动，缩短回退时间让它尽快回待命）
setInterval(() => {
  if (state !== 'offline' && Date.now() - lastActivity > 8000) setState('idle', '待命中');
}, 1000);

// --- interactions ---
logo.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  logo.classList.remove('pop'); void logo.offsetWidth; logo.classList.add('pop');
  setTimeout(() => logo.classList.remove('pop'), 700);
});

// --- 设置：点击文本框（状态气泡）展开/收起设置面板，滑杆调整 zoom ---
const settings = document.getElementById('settings');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');

let zoom = parseFloat(localStorage.getItem('whale-pet-zoom'));
if (!(zoom > 0)) zoom = 5;
function applyZoom(z) {
  zoom = z;
  logo.style.zoom = String(z);
  zoomSlider.value = z;
  zoomValue.textContent = z + '×';
  try { localStorage.setItem('whale-pet-zoom', String(z)); } catch {}
}
applyZoom(zoom);

statusText.closest('.pet-status').addEventListener('click', (e) => {
  e.stopPropagation();
  settings.classList.toggle('hidden');
});
settings.querySelector('.close').addEventListener('click', () => {
  settings.classList.add('hidden');
});
zoomSlider.addEventListener('input', () => {
  applyZoom(parseFloat(zoomSlider.value));
});
document.addEventListener('click', (e) => {
  if (!settings.classList.contains('hidden') && !settings.contains(e.target)) {
    settings.classList.add('hidden');
  }
});

document.addEventListener('contextmenu', (e) => { e.preventDefault(); menu.classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.classList.add('hidden'); });

menu.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const act = btn.dataset.act;
    if (act === 'quit') window.pet.quit();
    if (act === 'topmost') {
      const on = btn.textContent === '置顶窗口';
      window.pet.setTopmost(!on);
      btn.textContent = on ? '取消置顶' : '置顶窗口';
    }
    if (act === 'size-s') window.pet.setSize(220, 200);
    if (act === 'size-l') window.pet.setSize(380, 340);
    menu.classList.add('hidden');
  });
});
