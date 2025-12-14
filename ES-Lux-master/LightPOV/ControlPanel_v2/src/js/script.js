// 修正 Fabric.js 對 textBaseline 使用 alphabetical 的 bug
(function () {
    const _set = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'textBaseline').set;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'textBaseline', {
        set(value) {
            if (value === 'alphabetical') {
                // 強制替換成合法值
                value = 'alphabetic';
            }
            _set.call(this, value);
        }
    });
})();

// DOM elements
const fileInput = document.getElementById('fileInput');
const musicFileLoadBtn = document.getElementById('music_file_load_Btn');
const audio = document.getElementById('audio');
const playToggle = document.getElementById('playToggle');
const stopBtn = document.getElementById('stopBtn');
const timeLabel = document.getElementById('time');

const minInput = document.getElementById('minInput');
const secInput = document.getElementById('secInput');

const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

const timelineCanvasEl = document.getElementById('timelineCanvas');
const assetCanvas1El = document.getElementById('assetCanvas1');

// asset library
document.querySelectorAll('.Asset_library_header .tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.Asset_library_header .tab')
            .forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.tab;
        document.querySelectorAll('.Asset_library_content')
            .forEach(c => c.classList.remove('active'));
        document.querySelector(`.Asset_library_content.${target}`).classList.add('active');
    });
});

const EFFECT_CONFIG = {
  "清除": { extras: [] },
  "純色": { extras: [] },
  "方形": { extras: ["boxsize"] },
  "方塊": { extras: ["boxsize", "space"] },
  "DNA":  { extras: ["reverse", "space"] },
  "火焰": { extras: ["space"] },
  "鐮刀": { extras: ["position_fix", "length", "curvature"] },
  "扇形": { extras: ["bladeCount", "length", "curvature"] },
};

const MODE_EXTRAS = {
  "MODES_CLEAR":      [],
  "MODES_PLAIN":      [],
  "MODES_SQUARE":     ["boxsize"],
  "MODES_SICKLE":     ["position_fix", "length", "curvature"],
  "MODES_FAN":        ["bladeCount", "length", "curvature"],
  "MODES_BOXES":      ["boxsize", "space"],
  "MODES_CMAP_DNA":   ["reverse", "space"],
  "MODES_CMAP_FIRE":  ["space"]
};

const assetItems = document.querySelectorAll('.Asset_item');
const paramEmpty = document.querySelector('.param_empty');
const paramMain  = document.querySelector('.param_main');
const paramBody  = document.querySelector('.param_body--param');
const extraGroups = document.querySelectorAll('.extra_group');
let currentCustomPresetId = null;   // 目前選中的自訂義 preset 的 _id
let currentModeStr = "MODES_PLAIN";
let currentLibraryAssetName = "";


// Reset
function resetAllParams() {
  paramMain.querySelectorAll('input').forEach(inp => {
    if (inp.type === "checkbox" || inp.type === "radio")
      inp.checked = inp.defaultChecked;
    else
      inp.value = inp.defaultValue;
  });



  // Reset HSV function
  paramMain.querySelectorAll('.hsv_block').forEach(block => {
    const sel = block.querySelector('.hsv_func_select');
    const sets = block.querySelectorAll('.hsv_func_params');

    sel.selectedIndex = 0;
    const func = sel.value;

    sets.forEach(s => s.classList.toggle('active', s.dataset.func === func));
  });
}

// 切換參數介面
function switchEffectUI(name) {
  console.log(`[UI切換] 原始名稱: "${name}"`);
    // 1. 更新當前的模式字串 (供後續儲存使用)
    currentModeStr = MODE_MAP[name] || "MODES_PLAIN";

    // 2. 顯示參數面板，隱藏空狀態
    if (paramEmpty) paramEmpty.style.display = 'none';
    if (paramMain) paramMain.classList.remove('hidden');

    // 3. 根據 EFFECT_CONFIG 決定要顯示哪些額外參數 (Extra Groups)
    const cfg = EFFECT_CONFIG[name] || { extras: [] };

      extraGroups.forEach(g => {
          const key = g.dataset.extra;
          g.style.display = cfg.extras.includes(key) ? "block" : "none";
      });

    // 4. 特殊處理：如果是 "清除"，則隱藏面板
    if (name === "清除") {
        paramMain.classList.add('hidden');
    }
}

// 將參數填回面板
function restorePanelParams(params) {
    if (!params) return;

    // 1. 先把所有要處理的 DOM 找出來，並分類
    let selectEls = [];
    let otherEls = [];

    Object.entries(params).forEach(([key, val]) => {
        // 尋找元素
        let els = [];
        const elById = document.getElementById(key);
        if (elById) els.push(elById);
        
        const elsByParam = document.querySelectorAll(`.param_main [data-param="${key}"]`);
        elsByParam.forEach(e => { if (!els.includes(e)) els.push(e); });

        // 分類：下拉選單優先處理
        els.forEach(el => {
            if (el.tagName === 'SELECT') {
                selectEls.push({ el, val });
            } else {
                otherEls.push({ el, val });
            }
        });
    });

    // 2. 第一階段：先還原下拉選單 (確保面板被打開)
    selectEls.forEach(({ el, val }) => {
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 3. 第二階段：填入數值 (這時候面板已經打開且不會被重置)
    otherEls.forEach(({ el, val }) => {
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = val;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

// 抓取目前面板上所有輸入框的值
function capturePanelParams() {
    const params = {};
    // 選取 input 和 select
    const inputs = document.querySelectorAll('.param_main input, .param_main select');
    
    inputs.forEach(el => {
        // 抓取 ID 或 data-param
        const key = el.id || el.dataset.param;
        if (!key) return;

        // 1. 過濾隱藏的 HSV 參數 (原本的邏輯)
        const parentSet = el.closest('.hsv_func_params');
        if (parentSet && !parentSet.classList.contains('active')) {
            return; 
        }

        // 2. [關鍵修正] 過濾隱藏的額外參數群組
        // 如果這個 input 屬於某個 extra_group，且該 group 目前被隱藏 (display: none)，就不要存它
        const extraGroup = el.closest('.extra_group');
        if (extraGroup && window.getComputedStyle(extraGroup).display === 'none') {
            return; 
        }

        // 3. 根據類型取值
        if (el.type === 'checkbox' || el.type === 'radio') {
            params[key] = el.checked;
        } 
        else if (el.type === 'number' || el.type === 'range') {
            // 轉成數字
            params[key] = parseFloat(el.value) || 0;
        } 
        else {
            // 處理 select (例如 HSV function) 或其他類型
            params[key] = el.value;
        }
    });
    return params;
}

// 點素材顯示對應參數
assetItems.forEach(item => {
  item.addEventListener('click', () => {
    const name = item.textContent.trim();
    // 記錄目前選中的素材名稱
    currentLibraryAssetName = name; 

    // 取消畫布上的選取
    if (asset_canvas1) {
        asset_canvas1.discardActiveObject();
        asset_canvas1.requestRenderAll();
        currentEditingId = null; // 清空編輯ID，告訴 syncParams 不要存檔
    }
    // 3. UI 切換與重置 (給使用者一個乾淨的開始調整)
    currentModeStr = MODE_MAP[name] || "MODES_PLAIN";
    document.querySelectorAll('.Asset_item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    paramEmpty.style.display = 'none';
    paramMain.classList.remove('hidden');
<<<<<<< HEAD

    // 初始化面板
    resetAllParams();
    switchEffectUI(name);
    });

=======
    
    // 初始化面板
    resetAllParams();
    switchEffectUI(name);
  });
    
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
  item.setAttribute('draggable', true);
  item.addEventListener('dragstart', (e) => {
    const name = item.textContent.trim();
    // 將素材名稱（如 "方形", "DNA"）儲存到 DataTransfer 物件中
    e.dataTransfer.setData('text/plain', name);
    // 設置一個拖曳圖示（可選，通常瀏覽器會提供預設圖示）
    e.dataTransfer.effectAllowed = 'copy'; 
  });
});

// HSV Function 切換
document.querySelectorAll('.hsv_block').forEach(block => {
  const select    = block.querySelector('.hsv_func_select');
  const paramSets = block.querySelectorAll('.hsv_func_params');

  if (!select) return;

  // func_number <-> func_range 
  paramSets.forEach(set => {
    const numbers = set.querySelectorAll('.func_number');

    numbers.forEach(num => {
      const paramName = num.dataset.param;
      if (!paramName) return;

      const range = set.querySelector(`.func_range[data-param="${paramName}"]`);
      if (!range) return;

      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

      // number -> range
      num.addEventListener('input', () => {
        const min = Number(num.min ?? 0);
        const max = Number(num.max ?? 255);
        let v = Number(num.value || 0);
        v = clamp(v, min, max);
        num.value = v;
        range.value = v;
      });

      // range -> number
      range.addEventListener('input', () => {
        num.value = range.value;
      });
    });
  });

  // 切換 function（Const / Ramp / Tri / Pulse / Step）
  select.addEventListener('change', () => {
    const func = select.value;

    paramSets.forEach(set => {
      const isActive = set.dataset.func === func;
      set.classList.toggle('active', isActive);

      if (isActive) {
        // 如果正在還原參數 (isRestoring)，就只要切換顯示面板(toggle active)，
        if (typeof isRestoring !== 'undefined' && isRestoring) {
            return; 
        }
        const inputs = set.querySelectorAll('input');

        inputs.forEach(inp => {
          if (inp.type === 'checkbox' || inp.type === 'radio') {
            inp.checked = inp.defaultChecked;
          } else if (inp.defaultValue !== undefined && inp.defaultValue !== '') {
            inp.value = inp.defaultValue;
          } else if (inp.min !== undefined && inp.max !== undefined) {
            inp.value = inp.min || 0;
          }
        });
      }
    });
  });

  select.dispatchEvent(new Event('change'));
});

// 額外參數 數字 <-> 滑桿 同步 

document.querySelectorAll('.extra_group').forEach(group => {
  const numbers = group.querySelectorAll('.param_number');

  numbers.forEach(num => {
    const row = num.closest('.param_input_row');
    if (!row) return;
    const range = row.querySelector('.param_range');
    if (!range) return;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // number -> range
    num.addEventListener('input', () => {
      const min = Number(num.min ?? 0);
      const max = Number(num.max ?? 255);
      let v = Number(num.value || 0);
      v = clamp(v, min, max);
      num.value = v;
      range.value = v;
    });

    // range -> number
    range.addEventListener('input', () => {
      num.value = range.value;
    });
  });
});

// 切換（參數 / 控制）
document.querySelectorAll('.param_tab').forEach(tab => {
  tab.addEventListener('click', () => {
        const mode = tab.dataset.mode; // 'param' 或 'control'

        // 1. 切換按鈕的高亮狀態
    document.querySelectorAll('.param_tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

        // 2. 切換面板內容顯示
        document.querySelectorAll('.param_body').forEach(body => {
            body.classList.toggle('active', body.classList.contains(`param_body--${mode}`));
    });

        // 3. 核心佈局切換：控制左側隱藏與右側置右
        const row2 = document.querySelector('.row2');
        if (mode === 'control') {
            row2.classList.add('mode-control');
            startControlPolling(); // 開始向 server.js 請求資料
        } else {
            row2.classList.remove('mode-control');
            stopControlPolling(); // 停止請求
        }
  });
});

const MODE_MAP = {
  "清除": "MODES_CLEAR",
  "純色": "MODES_PLAIN",
  "方形": "MODES_SQUARE",
  "鐮刀": "MODES_SICKLE",
  "扇形": "MODES_FAN",
  "方塊": "MODES_BOXES",
  "DNA":  "MODES_CMAP_DNA",
  "火焰": "MODES_CMAP_FIRE",
};

const FUNC_CODE = {
  "none": 0,
  "const": 1,
  "ramp": 2,
  "tri": 3,
  "pulse": 4,
  "step": 5
};

// mode 字串 -> 中文
const MODE_MAP_INV = {};
for (const [cn, en] of Object.entries(MODE_MAP)) {
  MODE_MAP_INV[en] = cn;
}

function normalizeTo255(value, min, max) {
  const v = Number(value) || 0;
  const lo = Number(min) || 0;
  const hi = Number(max) || 1;
  return Math.round((v - lo) / (hi - lo) * 255);
}

// 0~255 反映射回原本區間 [min, max]
function from255(v255, min, max) {
  const v  = Number(v255) || 0;
  const lo = Number(min) || 0;
  const hi = Number(max) || 1;
  return Math.round(lo + (hi - lo) * (v / 255));
}

function getParamNorm(set, name, def = 0) {
  const inp = set.querySelector(`.func_number[data-param="${name}"]`);
  if (!inp) return def;

  const v   = inp.value;
  const min = inp.min;
  const max = inp.max;

  return normalizeTo255(v, min, max);
}

function collectExtras() {
  const getNum = sel => {
    const inp = document.querySelector(sel);
    return inp ? Number(inp.value || 0) : 0;
  };
  const getChecked255 = sel => {
    const inp = document.querySelector(sel);
    return inp && inp.checked ? 255 : 0;
  };

  return {
    curvature:   getNum('[data-extra="curvature"] .param_number'),
    length:      getNum('[data-extra="length"] .param_number'),
    bladeCount:  getNum('[data-extra="bladeCount"] .param_number'),
    boxsize:     getNum('[data-extra="boxsize"] .param_number'),
    space:       getNum('[data-extra="space"] .param_number'),
    reverse:     getChecked255('[data-extra="reverse"] input[type="checkbox"]'),
    positionFix: getNum('[data-extra="position_fix"] .param_number')
  };
}

function packHsvBlock(key) {
  const block = document.querySelector(`.hsv_block[data-key="${key}"]`);
  if (!block) return { func: 0, range: 0, lower: 0, p1: 0, p2: 0 };

  const select   = block.querySelector('.hsv_func_select');
  const funcName = select.value;
  const funcCode = FUNC_CODE[funcName] ?? 0;

  if (funcCode === 0) {
    return { func: 0, range: 0, lower: 0, p1: 0, p2: 0 };
  }

  // 找當前 active function 面板
  const activeSet =
    block.querySelector(`.hsv_func_params[data-func="${funcName}"].active`) ||
    block.querySelector(`.hsv_func_params[data-func="${funcName}"]`);

  const range = getParamNorm(activeSet, `${key}_range`, 0);
  const lower = getParamNorm(activeSet, `${key}_lower`, 0);

  switch (funcCode) {
    case 1: { // Const
      const value255 = getParamNorm(activeSet, `${key}_value`, 0);
      return { func: 1, range: 0, lower: 0, p1: value255, p2: 0 };
    }

    case 2: { // Ramp
      const upper255 = getParamNorm(activeSet, `${key}_upper`, 0);
      return { func: 2, range, lower, p1: upper255, p2: 0 };
    }

    case 3: { // Tri
      const upper255 = getParamNorm(activeSet, `${key}_upper`, 0);
      return { func: 3, range, lower, p1: upper255, p2: 0 };
    }

    case 4: { // Pulse
      const top255 = getParamNorm(activeSet, `${key}_top`, 0);
      return { func: 4, range, lower, p1: top255, p2: 0 };
    }

    case 5: { // Step
      const height255 = getParamNorm(activeSet, `${key}_height`, 0);
      const stepNum255 = getParamNorm(activeSet, `${key}_step`, 0);
      return { func: 5, range, lower, p1: height255, p2: stepNum255 };
    }

    default:
      return { func: 0, range: 0, lower: 0, p1: 0, p2: 0 };
  }
}

function packModePFields(modeStr, extras) {

  let p1 = 0, p2 = 0, p3 = 0, p4 = 0;

  switch (modeStr) {

    case "MODES_CLEAR":
    case "MODES_PLAIN":
      break;

    case "MODES_SQUARE":
      p3 = normalizeTo255(extras.boxsize, 0, 300);
      break;

    case "MODES_SICKLE":
      p1 = normalizeTo255(extras.positionFix, 0, 255);
      p3 = normalizeTo255(extras.curvature, 0, 100);
      p4 = normalizeTo255(extras.length, 0, 300);
      break;

    case "MODES_FAN":
      p1 = normalizeTo255(extras.curvature, 0, 100);
      p3 = normalizeTo255(extras.bladeCount, 0, 12);
      p4 = normalizeTo255(extras.length, 0, 300);
      break;

    case "MODES_BOXES":
      p3 = normalizeTo255(extras.boxsize, 0, 300);
      p4 = normalizeTo255(extras.space, 0, 100);
      break;

    case "MODES_CMAP_DNA":
      p1 = extras.reverse ? 255 : 0;
      p4 = normalizeTo255(extras.space, 0, 100);
      break;

    case "MODES_CMAP_FIRE":
      p4 = normalizeTo255(extras.space, 0, 100);
      break;
  }

  return { p1, p2, p3, p4 };
}

function buildSegmentFromUI(startTime, duration) {
  const modeStr = currentModeStr || "MODES_PLAIN";

  // 六組 HSV
  const XH = packHsvBlock("XH");
  const XS = packHsvBlock("XS");
  const XV = packHsvBlock("XV");
  const YH = packHsvBlock("YH");
  const YS = packHsvBlock("YS");
  const YV = packHsvBlock("YV");

  // p1~p4
  const extras = collectExtras();
  const { p1, p2, p3, p4 } = packModePFields(modeStr, extras);

  return {
    mode: modeStr,
    start_time: startTime,
    duration: duration,
    XH, XS, XV,
    YH, YS, YV,
    p1, p2, p3, p4
  };
}

function buildEffectConfigFromUI() {
  const seg = buildSegmentFromUI(0, 0);
  const { start_time, duration, ...effectConfig } = seg;

  return effectConfig;
}

// 轉字串寫法
// const obj = buildEffectConfigFromUI();
// const jsonStr = JSON.stringify(obj, null, 2);

function sendToSettime() {
  const currentPlaybackTime = 0; 

  fetch('/settime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      time : currentPlaybackTime
    })
  })
}

function sendToPath(jsonPath) {

  fetch('/update_file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      time : currentPlaybackTime
    })
  })
}



// Audio / waveform state
let audioCtx = null;
let audioBuffer = null;
let peaks = [];
let audioDuration = 0;
let waveformLines = [];

// Fabric timeline state (工程時間系統)
let timescale_canvas = null;
let asset_canvas1 = null; 
let timelineOffset = 0; // seconds at left edge
let secondsPerPixel = 1 / 100; // initial: 1px = 0.01s
const minZoom = 1 / 500;
const maxZoom = 1 / 3;

let waveformObj = null;      // fabric.Image for waveform clip
let waveformImgURL = null;   // blob/dataURL
let clipStartSec = 0;        // clip start time in timeline seconds
let clipWidthPx = 0;         // width on screen in px for the clip (derived)
let globalTime = 0;          // engine time in seconds
let isPlaying = false;
let rafId = null;
let lastRAFTime = null;

let playhead = null;
let globalAssetIdCounter = 1;
let isRestoring = false;
// 記錄目前面板顯示的是哪一個 ID 的資料
let currentEditingId = null;
// 參數資料庫
window.globalEffectData = {};

// Helper utilities
function fmt(t) {
  if (!isFinite(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Timeline initialization
function initTimelineFabric() {
  timescale_canvas = new fabric.Canvas("timelineCanvas", {
    selection: false,
    renderOnAddRemove: false,
    preserveObjectStacking: true
  });

  // ensure canvas size matches element size
  timescale_canvas.setWidth(timelineCanvasEl.clientWidth);
  timescale_canvas.setHeight(timelineCanvasEl.clientHeight);

  // timeline drag (panning) when clicking empty space
  let isPanning = false;
  let lastPanX = 0;
  // 🌟 新增變數：用於判斷是否發生拖曳
  let isDraggingTimeline = false;
  timescale_canvas.on('mouse:down', (e) => {
    // if clicked an object, do nothing (object drag handlers will run)
    if (e.target) return;
    isPanning = true;
    lastPanX = e.pointer.x;
    // 🌟 記錄初始位置，並重設拖曳旗標
    initialClickX = e.pointer.x;
    isDraggingTimeline = false;
  });

  timescale_canvas.on('mouse:move', (e) => {
    if (!isPanning) return;
    const dx = e.pointer.x - lastPanX;
    isDraggingTimeline = true;
    lastPanX = e.pointer.x;
    timelineOffset -= dx * secondsPerPixel;
    if (timelineOffset < 0) timelineOffset = 0;
    drawTimeline();
  });

  timescale_canvas.on('mouse:up', (e) => {
    if (!isPanning) return;
    // 🌟 關鍵修正：檢查是否為點擊 (沒有發生拖曳)
    // 且確保 e.target 為空 (沒有點擊到 waveformObj)
    if (!isDraggingTimeline && !e.target) {
        const p = e.pointer;
        const clickedTime = timelineOffset + p.x * secondsPerPixel;
        seekGlobal(clickedTime,false);
    }
    isPanning = false;
    
  });

  // zoom with wheel - keep center time anchored
  timescale_canvas.on('mouse:wheel', (opt) => {
    const e = opt.e;
    const wheelDelta = e.deltaY;
    const rect = timelineCanvasEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left; // canvas coordinates

    const centerTime = timelineOffset + offsetX * secondsPerPixel;

    if (wheelDelta < 0) secondsPerPixel *= 0.9;
    else secondsPerPixel *= 1.1;

    secondsPerPixel = Math.max(minZoom, Math.min(maxZoom, secondsPerPixel));

    // keep same centerTime
    timelineOffset = centerTime - offsetX * secondsPerPixel;
    if (timelineOffset < 0) timelineOffset = 0;

    drawTimeline();
    e.preventDefault();
    e.stopPropagation();
  });


  // create playhead (visual only)
  playhead = new fabric.Line([0, 0, 0, timescale_canvas.getHeight()], {
    stroke: 'red',
    strokeWidth: 2,
    selectable: false,
    evented: false
  });
  timescale_canvas.add(playhead);

  drawTimeline();
}

// Draw timeline: ticks, labels, waveformObj (if present), playhead
function drawTimeline() {
  if (!timescale_canvas) return;
  const canvas = timescale_canvas;
  const w = canvas.getWidth();
  const h = canvas.getHeight();

  canvas.clear();

  // baseline
  const baseY = Math.floor(h * 0.6);
  canvas.add(new fabric.Line([0, 60, w, 60], {
    stroke: '#ffffff', strokeWidth: 2, selectable: false, evented: false
  }));

  // determine tick spacing
  let majorTick = 1;
  if (secondsPerPixel < 1 / 800) majorTick = 0.5;
  if (secondsPerPixel < 1 / 1500) majorTick = 0.2;
  if (secondsPerPixel > 1 / 40) majorTick = 5;
  if (secondsPerPixel > 1 / 20) majorTick = 10;
  if (secondsPerPixel > 1 / 10) majorTick = 30;
  if (secondsPerPixel > 1 / 5) majorTick = 60;

  const startSec = timelineOffset;
  const endSec = timelineOffset + w * secondsPerPixel;
  let firstTick = Math.ceil(startSec / majorTick) * majorTick;

  for (let t = firstTick; t <= endSec; t += majorTick) {
    const x = (t - timelineOffset) / secondsPerPixel;
    canvas.add(new fabric.Line([x, 40, x, 60], {
      stroke: '#ffffff', strokeWidth: 1, selectable: false, evented: false
    }));

    const mm = String(Math.floor(Math.abs(t) / 60)).padStart(2, '0');
    const ss = String(Math.floor(Math.abs(t) % 60)).padStart(2, '0');
    const labelText = (t < 0 ? '-' : '') + `${mm}:${ss}`;

    canvas.add(new fabric.Text(labelText, {
      left: x + 3, top: 6, fill: '#ffffff', fontSize: 12,
      selectable: false, evented: false
    }));
  }

  // add waveform object if exists
  if (waveformObj && audioBuffer) {
    updateWaveformScaleAndPos(); // ensure scale/left are correct for current zoom/offset
    canvas.add(waveformObj);

      timescale_canvas.add(waveformObj);
      
      // 依序將線段加入畫布
      waveformLines.forEach(line => timescale_canvas.add(line));
  }
  // add playhead on top
  updatePlayheadVisual();
  canvas.add(playhead);
  updateAssetPositions();
  canvas.requestRenderAll();
}

// Create waveform image from peaks and add as Fabric image (clip)
async function createWaveformImageAndAddToTimeline() {
  if (!audioBuffer || !timescale_canvas) return;

  // create a large base image width (e.g., px per second base)
  const basePxPerSec = 200; // tune: larger = more detailed waveform image
  const baseWidth = Math.max(2000, Math.floor(audioBuffer.duration * basePxPerSec));
  const height = 95;

  const cv = document.createElement('canvas');
  cv.width = baseWidth;
  cv.height = height;
  const c = cv.getContext('2d');

  // background
  c.fillStyle = "#0d1117";
  c.fillRect(0, 0, baseWidth, height);

  // draw peaks
  const mid = height / 2;
  c.strokeStyle = "#4fb3d6";
  c.lineWidth = 1;
  c.beginPath();

  for (let x = 0; x < baseWidth; x++) {
    const idx = Math.floor(x * (peaks.length / baseWidth));
    const p = peaks[idx] || 0;
    const y = p * (height / 2);
    c.moveTo(x + 0.5, mid - y);
    c.lineTo(x + 0.5, mid + y);
  }
  c.stroke();

  // convert to dataURL
  waveformImgURL = cv.toDataURL();

  // remove old waveformObj
  if (waveformObj) {
    timescale_canvas.remove(waveformObj);
    waveformObj = null;
  }

  return new Promise((resolve) => {
    fabric.Image.fromURL(waveformImgURL, (img) => {
      waveformObj = img;
      waveformObj.set({
        left: 0,
        top: 110,
        originY: 'center',
        selectable: true,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'grab'
      });


      // make sure user can only drag horizontally
    waveformObj.on('moving', () => {
    waveformObj.top = 110;

    // 計算 clipStartSec（尚未 clamp）
    let newClipStart = timelineOffset + waveformObj.left * secondsPerPixel;

    // 若小於 0 → 強制回到 0
    if (newClipStart < 0) {
        newClipStart = 0;
        waveformObj.left = (0 - timelineOffset) / secondsPerPixel;
    }

    clipStartSec = newClipStart;

    ensureAudioSyncToGlobal(true);
    updateTimeUI();
    // 同步三條線段的位置 (只需同步 left)
    waveformLines.forEach((line,index) => {
        if (index === 1) { // 右側框線 (index=1)
            // 右框線位置 = 波形圖起始位置 + 拉伸後的寬度
            line.left = waveformObj.left + clipWidthPx;
        } else {
            // 左側 (index=0) 和底部 (index=2) 框線
            line.left = waveformObj.left;
        }
        line.setCoords();
    });
    timescale_canvas.requestRenderAll();
});


      // initial scale & position
      updateWaveformScaleAndPos();
      // 在此處創建三條線段 (左、右、底)
    waveformLines = []; // 清空舊的線段
    const strokeOpts = {
      stroke: '#ffffff',
      strokeWidth: 2,
      selectable: false,
      evented: false
    };
    const topY = 110 - img.height / 2; // top 屬性是 110
    const bottomY = 110 + img.height / 2;
    const height = img.height;
    const width = img.width;

    // 左側框線: 
    const leftLine = new fabric.Line([0, topY, 0, bottomY], strokeOpts);
    leftLine.set({ originY: 'center', top: 110 });

    // 右側框線:
    const rightLine = new fabric.Line([width, topY, width, bottomY], strokeOpts);
    rightLine.set({ originY: 'center', top: 110 });

    // 底部框線: (使用相對座標 [0, 0] 到 [width, 0], 然後用 top 定位在 bottomY)
    const bottomLine = new fabric.Line([0, 0, width, 0], strokeOpts);
    bottomLine.set({ originY: 'center', top: bottomY });


    waveformLines.push(leftLine, rightLine, bottomLine);
    
    // 依序將線段加入畫布
    waveformLines.forEach(line => timescale_canvas.add(line));
      timescale_canvas.add(waveformObj);
      timescale_canvas.requestRenderAll();
      resolve();
    });
  });
}

// Update waveform scale based on secondsPerPixel and clipStartSec -> position left
function updateWaveformScaleAndPos() {
  if (!waveformObj || !audioBuffer || !timescale_canvas) return;

  const totalSec = audioBuffer.duration;
  audioDuration = totalSec;

  // compute width in px for the clip on the timeline (totalSec / secondsPerPixel)
  const totalWidthPx = totalSec / secondsPerPixel;
  const naturalW = waveformObj.width || 1;
  waveformObj.scaleX = totalWidthPx / naturalW;
  waveformObj.scaleY = 1;

  clipWidthPx = totalWidthPx;

  // left position = (clipStartSec - timelineOffset)/secondsPerPixel
  waveformObj.left = (clipStartSec - timelineOffset) / secondsPerPixel;
// 同步線段的位置與縮放
  waveformLines.forEach((line, index) => {
      line.left = waveformObj.left;
      
      // 底部線段 (index=2) 繼承縮放
      if (index === 2) {
          line.scaleX = waveformObj.scaleX; 
      }
      else if (index === 1) { // 新增：針對右框線
          // 右框線的位置 = 波形圖起始位置 + 拉伸後的總寬度
          line.left = waveformObj.left + clipWidthPx;
          line.scaleX = 1; // 保持固定厚度 
      }
      else {
          // 左右框線保持自然寬度
          line.scaleX = 1; 
      }
      
  });
 // clipStartSec 不可小於 0
if (clipStartSec < 0) clipStartSec = 0;

  // ensure left within reasonable bounds
  const canvasW = timescale_canvas.getWidth();
  if (waveformObj.left < -clipWidthPx) waveformObj.left = -clipWidthPx;
  if (waveformObj.left > canvasW) waveformObj.left = canvasW;
}

// Global play control (engine) - RAF tick advances globalTime
function playGlobal() {
  if (!audioBuffer) return;
  if (!isPlaying) {
    isPlaying = true;
    lastRAFTime = performance.now();
    rafTick(lastRAFTime);
    playToggle.textContent = "⏸ 暫停";
  }
}
function pauseGlobal() {
  isPlaying = false;
  playToggle.textContent = "▶ 播放";
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // pause audio as well
  if (!audio.paused) audio.pause();
}

function rafTick(now) {
  rafId = requestAnimationFrame(rafTick);
  if (!lastRAFTime) lastRAFTime = now || performance.now();
  const delta = ((now || performance.now()) - lastRAFTime) / 1000;
  lastRAFTime = now || performance.now();

  if (isPlaying) {
    globalTime += delta;
    if (globalTime < 0) globalTime = 0;

    // sync audio to engine: only when in clip range
    ensureAudioSyncToGlobal();
    updateTimeUI();
    updatePlayheadVisual();

    // we render once per frame when playing
    timescale_canvas.requestRenderAll();
  }
}

// Ensure audio playback is synced to globalTime and clip range (DAW logic)
// immediate=true when called during dragging for immediate seek/play
function ensureAudioSyncToGlobal(immediate = false) {
  if (!audioBuffer) return;
  const clipEnd = clipStartSec + audioBuffer.duration;
  const inClip = globalTime >= clipStartSec && globalTime < clipEnd;

  if (inClip) {
    const targetAudioTime = globalTime - clipStartSec;
    const diff = Math.abs((audio.currentTime || 0) - targetAudioTime);

    // Need to seek/play?
    if (audio.paused || diff > 0.08 || immediate) {
      audio.currentTime = Math.min(Math.max(0, targetAudioTime), audioBuffer.duration - 0.001);
      if (isPlaying) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        audio.play().catch(()=>{});
      }
    }
  } else {
    // outside clip -> pause audio
    if (!audio.paused) audio.pause();
  }
}

// Update playhead visual position
function updatePlayheadVisual() {
  if (!playhead || !timescale_canvas) return;
  const x = (globalTime - timelineOffset) / secondsPerPixel;
  playhead.set({ x1: x, x2: x, y1: 0, y2: timescale_canvas.getHeight() });
}

// Seek globalTime (click on timeline or jump input)
function seekGlobal(t,center = true) {
  // 1. 設定新的全域時間
  globalTime = Math.max(0, Math.min(t, 999999)); // cap very large values
  
  // 2. 計算讓 globalTime 位於畫布中央的新 timelineOffset
  if (center && timescale_canvas) {
    const canvasWidth = timescale_canvas.getWidth();
    // 讓 globalTime 位於畫布寬度的一半位置
    const offsetToCenter = canvasWidth * secondsPerPixel / 2; 
    
    // 計算新的 offset
    let newOffset = globalTime - offsetToCenter;
    
    // 確保 timelineOffset 不為負值
    timelineOffset = Math.max(0, newOffset);
  }

  // 3. 執行同步和重繪
  ensureAudioSyncToGlobal();
  updateTimeUI();
  drawTimeline();
}

// Time input jump handler
function jumpToTimeFromInputs() {
  const minutes = parseInt(minInput.value, 10) || 0;
  const seconds = parseInt(secInput.value, 10) || 0;
  if (seconds > 59) {
    alert('秒數不可大於59');
    return;
  }
  const total = minutes * 60 + seconds;
  if (audioBuffer && total > (audioBuffer.duration + 100000)) {
    // arbitrary large check; allow seeking outside for timeline though
    alert('輸入時間超出合理範圍');
    return;
  }
  seekGlobal(total);
  // 清空輸入欄
  minInput.value = '';
  secInput.value = '';
}

minInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    secInput.focus();
  }
});
secInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    jumpToTimeFromInputs();
  }
});

// Compute peaks (same algorithm as before)
function computePeaks(buffer, count = 2000) {
  const channelData = buffer.getChannelData(0);
  const samples = channelData.length;
  const block = Math.floor(samples / count) || 1;
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const start = i * block;
    const end = Math.min(start + block, samples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channelData[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

// File load and decode
musicFileLoadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();

  const buf = await file.arrayBuffer();
  try {
    audioBuffer = await audioCtx.decodeAudioData(buf.slice(0));
  } catch (err) {
    audioBuffer = await new Promise((res, rej) => audioCtx.decodeAudioData(buf, res, rej));
  }

  audioDuration = audioBuffer.duration;
  peaks = computePeaks(audioBuffer, Math.max(1024, Math.floor(audioBuffer.duration * 100)));

  // reset clip start to 0 and engine time to 0
  clipStartSec = 0;
  globalTime = 0;

  // create waveform image & add to timeline
  await createWaveformImageAndAddToTimeline();

  playToggle.disabled = false;
  stopBtn.disabled = false;
  updateTimeUI();
  drawTimeline();
});

// Play / Pause / Stop handlers
playToggle.addEventListener('click', async () => {
  if (!audioBuffer) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  if (!isPlaying) {
    playGlobal();
  } else {
    pauseGlobal();
  }
});

stopBtn.addEventListener('click', () => {
  pauseGlobal();
  globalTime = 0;
  ensureAudioSyncToGlobal();
  updateTimeUI();
  drawTimeline();
});

// Volume control
volumeSlider.addEventListener('input', () => {
  const vol = volumeSlider.value / 100;
  audio.volume = vol;
  volumeValue.textContent = `${volumeSlider.value}%`;
});

// Window resize: resize fabric canvas and redraw
window.addEventListener('resize', () => {
  if (!timescale_canvas) return;
  timescale_canvas.setWidth(timelineCanvasEl.clientWidth);
  timescale_canvas.setHeight(timelineCanvasEl.clientHeight);
  drawTimeline();
});

// Update time label UI
function updateTimeUI() {
  timeLabel.textContent = `當前時間:${fmt(globalTime)}`;
  volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
}

//重置效果方塊外框
function resetAllStrokes() {
      asset_canvas1.getObjects().forEach(obj => {
          // 確保它是 Group 且內部有背景方塊 (item(0))
          if (obj.type === 'group' && obj.item(0)) {
              obj.item(0).set({
                  stroke: '#ffffff', // 預設白色
                  strokeWidth: 1     // 預設細線
              });
          }
      });
  }

// 初始化 Asset Canvas1 的 Fabric 畫布
function initAsset1Fabric() {
  if (!assetCanvas1El) {
    console.error('找不到 #assetCanvas1');
    return;
  }
  // 初始化畫布
  assetCanvas1El.width = assetCanvas1El.clientWidth;
  assetCanvas1El.height = assetCanvas1El.clientHeight;

  asset_canvas1 = new fabric.Canvas("assetCanvas1", {
    selection: true,
    renderOnAddRemove: true
  });
  
  asset_canvas1.setWidth(assetCanvas1El.clientWidth);
  asset_canvas1.setHeight(assetCanvas1El.clientHeight);

  // 處理拖曳放下
  const canvasContainer = asset_canvas1.wrapperEl;

  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'copy';
  });

  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!asset_canvas1) return;

    const pointer = asset_canvas1.getPointer(e);
    const assetName = e.dataTransfer.getData('text/plain');

    createAssetOnCanvas(assetName, pointer.x, pointer.y);
  });
  // 事件監聽整合區

  // 選取方塊時：讀取參數
  asset_canvas1.on('selection:created', loadAssetParams);
  asset_canvas1.on('selection:updated', loadAssetParams);
  
  // 取消選取時：隱藏面板 + 全部變回白色
  asset_canvas1.on('selection:cleared', () => {
     resetAllStrokes(); 
     currentEditingId = null;
     paramEmpty.style.display = 'block'; 
     paramMain.classList.add('hidden');
     asset_canvas1.requestRenderAll();
  });

  function loadAssetParams(e) {
    // 容錯寫法
      const activeObj = e.selected ? e.selected[0] : asset_canvas1.getActiveObject();
      
      if (!activeObj || !activeObj.logicBlock) return;
      // 從 Fabric 物件中取出我們的 Class 實例
      const block = activeObj.logicBlock;
      console.log(`[選取 ID:${block.id}] 目前資料庫內容:`, JSON.parse(JSON.stringify(globalEffectData)))
      // 印出整個物件結構，展開來檢查
      console.dir(block);
      // 先重置所有顏色，再將當前物件設為藍色
      resetAllStrokes();
      
      if (activeObj.item(0)) {
          activeObj.item(0).set({
              stroke: '#00aaff',
              strokeWidth: 2     
          });
      }
      // 上鎖 + 記錄 ID
      isRestoring = true;
      currentEditingId = block.id;
      // 切換 UI
      switchEffectUI(block.name);
      // 清空面板
<<<<<<< HEAD
      resetAllParams(); 
=======
      resetAllParams();
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
      // 填入參數
      if (block.params) {
          restorePanelParams(block.params);
      }

      // 解鎖
      setTimeout(() => {
          isRestoring = false;
      }, 10);
  }

  // 面板操作時：同步回方塊
  paramMain.removeEventListener('input', syncParamsToActiveObject);
  paramMain.removeEventListener('change', syncParamsToActiveObject);
  
  paramMain.addEventListener('input', syncParamsToActiveObject);
  paramMain.addEventListener('change', syncParamsToActiveObject);

<<<<<<< HEAD
  function syncParamsToActiveObject(e) {
=======
function syncParamsToActiveObject(e) {
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07

      // 檢查鎖
      if (typeof isRestoring !== 'undefined' && isRestoring) return;

      // 如果目前沒有正在編輯的 Canvas ID，就不執行存檔，直接 return，讓數值保留在輸入框裡
      if (!currentEditingId) {
          return;
      }

      // 檢查選取物件
      const activeObj = asset_canvas1.getActiveObject();
      if (!activeObj || !activeObj.logicBlock) {
          return;
      }

      const block = activeObj.logicBlock;

      // 檢查 ID 是否匹配
      if (block.id !== currentEditingId) {;
        return;
    }

      // 嘗試抓取參數
      const currentParams = capturePanelParams();
      console.log("🔎 抓取到的參數內容:", currentParams);


      // 寫入資料庫
      block.params = currentParams;
      console.log(`✅ 成功寫入 ID:${block.id}。資料庫目前狀態:`, globalEffectData);
  }

  asset_canvas1.requestRenderAll();
}

// 根據時間軸的 Offset 和 Zoom 更新素材位置
function updateAssetPositions() {
  if (!asset_canvas1) return;

  asset_canvas1.getObjects().forEach(obj => {
    // 1. 檢查有沒有 logicBlock (靈魂)
    if (obj.logicBlock) {
      
      // ▼▼▼【絕對不能漏掉這一行】▼▼▼
      const block = obj.logicBlock; 
      // ▲▲▲ 定義 block 變數，不然下面會報錯 block is not defined ▲▲▲

      // 2. 現在可以使用 block 了
      if (block.startTime !== undefined) {
          
          // 計算新的 X 座標
          const newLeft = (block.startTime - timelineOffset) / secondsPerPixel;
      
      obj.left = newLeft;
          
          // 3. 更新寬度 (縮放)
          if (block.duration !== undefined && obj.width > 0) {
              const targetWidthPx = block.duration / secondsPerPixel;
              
          obj.scaleX = targetWidthPx / obj.width;

              // 修正文字變形
          const textObj = obj.item(1); 
          if (textObj) {
              textObj.set({
                  scaleX: 1 / obj.scaleX,
                      scaleY: 1 
              });
      
      // ▼▼▼【絕對不能漏掉這一行】▼▼▼
      const block = obj.logicBlock; 
      // ▲▲▲ 定義 block 變數，不然下面會報錯 block is not defined ▲▲▲

      // 2. 現在可以使用 block 了
      if (block.startTime !== undefined) {
          
          // 計算新的 X 座標
          const newLeft = (block.startTime - timelineOffset) / secondsPerPixel;
          
          obj.left = newLeft;

          // 3. 更新寬度 (縮放)
          if (block.duration !== undefined && obj.width > 0) {
              const targetWidthPx = block.duration / secondsPerPixel;
              
              obj.scaleX = targetWidthPx / obj.width;

              // 修正文字變形
              const textObj = obj.item(1); 
              if (textObj) {
                  textObj.set({
                      scaleX: 1 / obj.scaleX,
                      scaleY: 1 
                  });
              }
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
          }
          obj.setCoords(); 
      }
<<<<<<< HEAD
          obj.setCoords(); 
      }
=======
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
    }
  });

  asset_canvas1.requestRenderAll();
}

function createAssetOnCanvas(assetName, x, y) {
    if (!asset_canvas1) return;
    // 產生 ID
    const currentId = globalAssetIdCounter++;

    // 準備參數
    let finalParams = {};

    // 如果拖曳進來的素材等於目前面板顯示的素材就直接抓取面板上的數值，不要 reset
    if (assetName.trim() === currentLibraryAssetName) {
        console.log("使用面板目前的設定建立方塊");
        finalParams = capturePanelParams();
    } 
    else {
        // 如果不一樣，就進行切換並重置
        console.log("切換素材，使用預設值");
        // 為了安全，還是要切換UI
        isRestoring = true;
<<<<<<< HEAD
    switchEffectUI(assetName);
    resetAllParams();
=======
        switchEffectUI(assetName);
        resetAllParams();
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
        finalParams = capturePanelParams();
        isRestoring = false;
    }
    // 先將資料寫入全域資料庫
    globalEffectData[currentId] = {
      ...finalParams,
      id: currentId,         
      name: assetName.trim()  
    }; 
    console.log(`[資料庫] 已新增 ID:${currentId} 的數據`, globalEffectData[currentId]);

    // 2. 建立方塊 (現在不需要傳入 defaultParams 了，因為已經存到資料庫了)
    const newBlock = new EffectBlock(currentId, assetName.trim());

    // 渲染 (傳入 canvas 與 x, y)
    // 注意：原本的 y 是在函式內算，現在可以傳入函式參數的 y，或是維持內部計算
    // 如果想要精準控制在 assetCanvas1 的中間，可以這樣寫：
    const centerY = asset_canvas1.getHeight() / 2;
    const group = newBlock.render(asset_canvas1, x, centerY);

    // 選取它
    asset_canvas1.setActiveObject(group);
    asset_canvas1.fire('selection:created', { target: group, selected: [group] });
    asset_canvas1.requestRenderAll();

    console.log(`已建立 Block Class ID: ${newBlock.id}`);
}
//delete功能
window.addEventListener('keydown', (e) => {
    // 1. 檢查按鍵是否為 Delete
    if (e.key === 'Delete') {
        
        // 2. 安全檢查：如果使用者正在輸入框 (input) 或文字區域打字，忽略刪除指令
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        if (!asset_canvas1) return;

        // 3. 取得目前選取的物件
        const activeObjects = asset_canvas1.getActiveObjects();

        if (activeObjects.length) {
            // 清除目前的選取框，避免刪除後殘留藍色框線
            asset_canvas1.discardActiveObject();

            // 4. 遍歷並移除所有選取的物件
            activeObjects.forEach((obj) => {
              // 刪除效果方塊對應的資料
                if (obj.logicBlock) {
                    const idToDelete = obj.logicBlock.id;
                    delete globalEffectData[idToDelete]; // 從物件中移除
                    console.log(`[資料庫] 已移除 ID:${idToDelete} 的數據`);
                }
                asset_canvas1.remove(obj);
            });
            // 清空面板與 ID 紀錄
            currentEditingId = null;
            resetAllStrokes(); 
            if (paramEmpty) paramEmpty.style.display = 'block'; 
            if (paramMain) paramMain.classList.add('hidden');

            asset_canvas1.requestRenderAll();
        }
    }
});
// Initialization
function initAll() {
  // UI defaults
  playToggle.disabled = true;
  stopBtn.disabled = true;
  volumeValue.textContent = `${Math.round((volumeSlider.value || 100))}%`;

  // timeline init
  if (!timelineCanvasEl) {
    console.error('找不到 #timelineCanvas');
    return;
  }
  timelineCanvasEl.width = timelineCanvasEl.clientWidth;
  timelineCanvasEl.height = timelineCanvasEl.clientHeight;

  initTimelineFabric();
  initAsset1Fabric()
  // set initial audio volume
  audio.volume = (volumeSlider.value || 100) / 100;

  updateTimeUI();
}

// start
initAll();

// 自定義加入
const btnAddCustom = document.querySelector('.btn_add_custom');
const btnUpdateCustom = document.querySelector('.btn_update_custom');
const btnDeleteCustom = document.querySelector('.btn_delete_custom');

function setCustomButtonsEnabled(enabled) {
  if (btnUpdateCustom) btnUpdateCustom.disabled = !enabled;
  if (btnDeleteCustom) btnDeleteCustom.disabled = !enabled;
}

function genPresetId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'preset_' + Date.now() + '_' + Math.random().toString(16).slice(2);
}

const CUSTOM_PRESET_KEY = "luxCustomPresets_v1";

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    // 如果舊資料沒有 _id，就幫它補一個，避免衝突
    let changed = false;
    arr.forEach(p => {
      if (!p._id) {
        p._id = genPresetId();
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(arr));
    }
    return arr;
  } catch (e) {
    console.error("loadCustomPresets error", e);
    return [];
  }
}

function saveCustomPresets(list) {
  try {
    localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("saveCustomPresets error", e);
  }
}

// 還原到UI
function ensureParamPanelVisible() {
  // 切到「參數」這頁 tab
  const tabs = document.querySelectorAll('.param_tab');
  const bodies = document.querySelectorAll('.param_body');
  const paramTab = document.querySelector('.param_tab[data-target="params"]') || tabs[0];
  const paramBody = document.querySelector('.param_body[data-pane="params"]') || bodies[0];

  if (tabs.length && paramTab) {
    tabs.forEach(t => t.classList.remove('active'));
    paramTab.classList.add('active');
  }
  if (bodies.length && paramBody) {
    bodies.forEach(b => b.classList.remove('active'));
    paramBody.classList.add('active');
  }

  // 把「請從左側選擇一個素材」藏起來，顯示真正的內容
  const empty = document.querySelector('.param_empty');
  const main = document.querySelector('.param_main');
  if (empty) empty.style.display = 'none';
  if (main) main.classList.remove('hidden');
}

function setParamFrom255(setElem, paramName, value255) {
  if (!setElem) return;
  const num = setElem.querySelector(`.func_number[data-param="${paramName}"]`);
  if (!num) return;

  const min = num.min;
  const max = num.max;
  const uiVal = from255(value255, min, max);
  num.value = uiVal;

  const range = setElem.querySelector(`.func_range[data-param="${paramName}"]`);
  if (range) {
    range.value = uiVal;
  }
}

function fillHsvBlockFromConfig(key, cfgBlock) {
  const block = document.querySelector(`.hsv_block[data-key="${key}"]`);
  if (!block || !cfgBlock) return;

  const select = block.querySelector('.hsv_func_select');
  if (!select) return;

  let funcName = "none";
  for (const [name, code] of Object.entries(FUNC_CODE)) {
    if (code === cfgBlock.func) {
      funcName = name;
      break;
    }
  }

  select.value = funcName;

  select.dispatchEvent(new Event('change'));

  // 找當前這個 function 的 set
  const set = block.querySelector(`.hsv_func_params[data-func="${funcName}"]`);
  if (!set) return;

  // 還原 range / lower
  setParamFrom255(set, `${key}_range`, cfgBlock.range);
  setParamFrom255(set, `${key}_lower`, cfgBlock.lower);

  // 還原各 func 的 p1/p2
  switch (cfgBlock.func) {
    case 1: // Const: p1 = value
      setParamFrom255(set, `${key}_value`, cfgBlock.p1);
      break;
    case 2: // Ramp: p1 = upper
    case 3: // Tri:  p1 = upper
      setParamFrom255(set, `${key}_upper`, cfgBlock.p1);
      break;
    case 4: // Pulse: p1 = top
      setParamFrom255(set, `${key}_top`, cfgBlock.p1);
      break;
    case 5: // Step: p1 = height, p2 = step
      setParamFrom255(set, `${key}_height`, cfgBlock.p1);
      setParamFrom255(set, `${key}_step`,   cfgBlock.p2);
      break;
  }
}

function setExtraNumber(extraName, value255, min, max) {
  const group = document.querySelector(`[data-extra="${extraName}"]`);
  if (!group) return;

  const num = group.querySelector('.param_number');
  if (!num) return;

  const uiVal = from255(value255, min, max);
  num.value = uiVal;

  const range = group.querySelector('.param_range');
  if (range) {
    range.value = uiVal;
  }
}

function applyExtrasFromPFields(modeStr, p1, p2, p3, p4) {
  switch (modeStr) {
    case "MODES_SQUARE":
      setExtraNumber("boxsize", p3, 0, 300);
      break;

    case "MODES_SICKLE":
      setExtraNumber("position_fix", p1, 0, 255);
      setExtraNumber("curvature",    p3, 0, 100);
      setExtraNumber("length",       p4, 0, 300);
      break;

    case "MODES_FAN":
      setExtraNumber("curvature",   p1, 0, 100);
      setExtraNumber("bladeCount",  p3, 0, 12);
      setExtraNumber("length",      p4, 0, 300);
      break;

    case "MODES_BOXES":
      setExtraNumber("boxsize", p3, 0, 300);
      setExtraNumber("space",   p4, 0, 100);
      break;

    case "MODES_CMAP_DNA": {
      // reverse: 0 or 255
      const chk = document.querySelector('[data-extra="reverse"] input[type="checkbox"]');
      if (chk) chk.checked = (p1 >= 128);
      setExtraNumber("space", p4, 0, 100);
      break;
    }

    case "MODES_CMAP_FIRE":
      setExtraNumber("space", p4, 0, 100);
      break;
  }
}

function applyPresetToUI(preset) {
  if (!preset) return;

  const modeStr = preset.mode || "MODES_PLAIN";
  currentModeStr = modeStr;   

  const cnName  = MODE_MAP_INV[modeStr] || "純色";
  window.currentEffectName = cnName; 

  ensureParamPanelVisible();

  const extras = MODE_EXTRAS[modeStr] || [];
  extraGroups.forEach(g => {
    const key = g.dataset.extra;
    g.style.display = extras.includes(key) ? "block" : "none";
  });

  if (modeStr === "MODES_CLEAR") {
    paramMain.classList.add('hidden');
  } else {
    paramMain.classList.remove('hidden');
  }

  fillHsvBlockFromConfig("XH", preset.XH);
  fillHsvBlockFromConfig("XS", preset.XS);
  fillHsvBlockFromConfig("XV", preset.XV);
  fillHsvBlockFromConfig("YH", preset.YH);
  fillHsvBlockFromConfig("YS", preset.YS);
  fillHsvBlockFromConfig("YV", preset.YV);

  applyExtrasFromPFields(modeStr, preset.p1, preset.p2, preset.p3, preset.p4);
}
// 建立小方塊
function createCustomAssetElement(preset) {
  const div = document.createElement('div');
  div.className = 'Asset_item Asset_item--custom';
  div.dataset.customId = preset._id;
  div.setAttribute('draggable', true);
  const modeLabel = (preset.mode || "").replace(/^MODES_/, "");
  div.textContent = `[自訂] ${modeLabel}`;

  div.addEventListener('click', () => {
    document.querySelectorAll('.Asset_item').forEach(it => it.classList.remove('active'));
    div.classList.add('active');

    // 記錄目前選中的自訂義
    currentCustomPresetId = preset._id;
    setCustomButtonsEnabled(true);

    applyPresetToUI(preset);
  });

  return div;
}

function reloadCustomPresetsUI() {
  const container = document.querySelector('.Asset_library_content.custom');
  if (!container) return;

  const list = loadCustomPresets();
  container.innerHTML = "";

  list.forEach(preset => {
    const item = createCustomAssetElement(preset);
    container.appendChild(item);

    // 如果這顆就是 currentCustomPresetId，就讓它保持亮
    if (preset._id === currentCustomPresetId) {
      item.classList.add('active');
    }
  });

  // 如果沒有任何自訂義，就把按鈕關閉
  if (!list.length) {
    currentCustomPresetId = null;
    setCustomButtonsEnabled(false);
  }
}


// 綁定按鈕
function addCurrentToCustomLibrary() {
  const cfg = buildEffectConfigFromUI(); 
  const preset = {
    _id: genPresetId(),
    ...cfg
  };

  const list = loadCustomPresets();
  list.push(preset);
  saveCustomPresets(list);

  // 新增完，視為選中這個 preset
  currentCustomPresetId = preset._id;
  setCustomButtonsEnabled(true);
  reloadCustomPresetsUI();
}

// 綁定新增按鈕
if (btnAddCustom) {
  btnAddCustom.addEventListener('click', addCurrentToCustomLibrary);
}

// 刪除與修改自定義
function updateCurrentCustomPreset() {
  if (!currentCustomPresetId) return; 

  const list = loadCustomPresets();
  const idx = list.findIndex(p => p._id === currentCustomPresetId);
  if (idx === -1) return;

  // 讀現在 UI 的設定
  const cfg = buildEffectConfigFromUI();

  // 保留原本 _id，其他用新的設定覆蓋
  list[idx] = { _id: currentCustomPresetId, ...cfg };
  saveCustomPresets(list);

  reloadCustomPresetsUI();
}

// 綁定按鈕
if (btnUpdateCustom) {
  btnUpdateCustom.addEventListener('click', updateCurrentCustomPreset);
}

function deleteCurrentCustomPreset() {
  if (!currentCustomPresetId) return;

  let list = loadCustomPresets();
  const idx = list.findIndex(p => p._id === currentCustomPresetId);
  if (idx === -1) return;

  list.splice(idx, 1);
  saveCustomPresets(list);

  currentCustomPresetId = null;
  setCustomButtonsEnabled(false);
  reloadCustomPresetsUI();

  resetAllParams();
  paramMain.classList.add('hidden');
  paramEmpty.style.display = 'block';
}

if (btnDeleteCustom) {
  btnDeleteCustom.addEventListener('click', deleteCurrentCustomPreset);
}

//  JSON 匯出功能 (Export to JSON)

function generateProjectJson() {
    // 取出所有方塊數據並轉為陣列
    const allBlocks = Object.values(window.globalEffectData || {});

    // 根據 startTime 排序 (由早到晚)
    allBlocks.sort((a, b) => a.startTime - b.startTime);

    // 轉換格式
    const exportData = allBlocks.map(block => {
      // 宣告變數並給予預設值
        let modeStr = "MODES_CLEAR";
        // 從 MODE_MAP 找中文名稱對應的 Key
        if (block.name) {
            modeStr = MODE_MAP[block.name];
        }
        console.log(`[處理中] ID:${block.id || '?'} | 原始名字: "${block.name}" `);
        // 時間轉換 (秒 -> 毫秒)
        const startTimeMs = Math.round((block.startTime || 0) * 1000);
        const durationMs = Math.round((block.duration || 0) * 1000);

        // HSV 打包 helper
        const packHsv = (prefix) => {
            const funcStr = block[`${prefix}_func`] || "none";
            const funcCode = FUNC_CODE[funcStr] || 0;
            
            // 讀取數值 (如果沒有該欄位則預設 0)
            const range = block[`${prefix}_range`] || 0;
            const lower = block[`${prefix}_lower`] || 0;
            let p1 = 0, p2 = 0;

            // 根據 Function 決定 p1, p2 來源
            // 邏輯參照原本的 packHsvBlock
            if (funcCode === 1) { // Const
                p1 = block[`${prefix}_value`] || 0;
            } else if (funcCode === 2 || funcCode === 3) { // Ramp, Tri
                p1 = block[`${prefix}_upper`] || 0;
            } else if (funcCode === 4) { // Pulse
                p1 = block[`${prefix}_top`] || 0;
            } else if (funcCode === 5) { // Step
                p1 = block[`${prefix}_height`] || 0;
                p2 = block[`${prefix}_step`] || 0;
            }

            return { func: funcCode, range, lower, p1, p2 };
        };

        // P1-P4 額外參數打包 helper
        let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
        
        // 讀取原始數值 (raw values)
        const bladeCount = block.bladeCount || 0;
        const length     = block.length || 0;
        const curvature  = block.curvature || 0;
        const boxsize    = block.boxsize || 0;
        const space      = block.space || 0;
        const positionFix= block.position_fix || 0;
        const reverse    = block.reverse ? true : false; // boolean

        // 根據模式填入 p1~p4
        switch (modeStr) {
            case "MODES_SQUARE":
                p3 = normalizeTo255(boxsize, 0, 300);
                break;
            case "MODES_SICKLE":
                p1 = normalizeTo255(positionFix, 0, 255);
                p3 = normalizeTo255(curvature, 0, 100);
                p4 = normalizeTo255(length, 0, 300);
                break;
            case "MODES_FAN":
                p1 = normalizeTo255(curvature, 0, 100);
                p3 = normalizeTo255(bladeCount, 0, 12);
                p4 = normalizeTo255(length, 0, 300);
                break;
            case "MODES_BOXES":
                p3 = normalizeTo255(boxsize, 0, 300);
                p4 = normalizeTo255(space, 0, 100);
                break;
            case "MODES_CMAP_DNA":
                p1 = reverse ? 255 : 0;
                p4 = normalizeTo255(space, 0, 100);
                break;
            case "MODES_CMAP_FIRE":
                p4 = normalizeTo255(space, 0, 100);
                break;
        }

        // 回傳符合目標格式的物件
        return {
            mode: modeStr,
            start_time: startTimeMs,
            duration: durationMs,
            XH: packHsv("XH"),
            XS: packHsv("XS"),
            XV: packHsv("XV"),
            YH: packHsv("YH"),
            YS: packHsv("YS"),
            YV: packHsv("YV"),
            p1, p2, p3, p4
        };
    });

    return exportData;
}

// 綁定按鈕事件
const btnExport = document.getElementById('btn_export_json');

if (btnExport) {
    // 這裡加上 async 因為 showSaveFilePicker 是非同步的
    btnExport.addEventListener('click', async () => {
        
        // 生成資料
        const data = generateProjectJson();
        const jsonStr = JSON.stringify(data, null, 2); // 美化縮排

        // 嘗試使用現代 API (跳出「另存新檔」視窗)
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'effect_project.json', // 預設檔名
                    types: [{
                        description: 'JSON Project File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                
                // 使用者選好位置後，寫入檔案
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                
                console.log(`[匯出成功] 檔案已儲存`);
                return; // 成功後直接結束
            } catch (err) {
                // 如果使用者按「取消」就不做任何事
                if (err.name === 'AbortError') return;
                console.warn("SaveFilePicker 失敗或不支援，改用舊方法下載", err);
            }
        }

        // 如果 API 不支援，則詢問檔名並下載
        const userFilename = prompt("請輸入檔案名稱 (無需副檔名):", "effect_project");
        if (!userFilename) return; // 使用者按取消

        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `${userFilename}.json`; // 使用輸入的檔名
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`[匯出成功] 下載至預設資料夾`);
    });
}
// JSON 匯入功能 (Import from JSON)

// HSV 參數解包器 (將 JSON 結構轉回平面參數)
function unpackHsvToParams(prefix, hsvData) {
    if (!hsvData) return {};
    const params = {};
    
    // 反查 Function 代碼
    const FUNC_CODE_INV = {
        0: "none", 1: "const", 2: "ramp", 3: "tri", 4: "pulse", 5: "step"
    };
    const funcName = FUNC_CODE_INV[hsvData.func] || "none";
    
    params[`${prefix}_func`] = funcName;
    params[`${prefix}_range`] = hsvData.range || 0;
    params[`${prefix}_lower`] = hsvData.lower || 0;
    
    // 根據 Function 還原特定欄位
    const p1 = hsvData.p1 || 0;
    const p2 = hsvData.p2 || 0;

    switch (hsvData.func) {
        case 1: // Const (p1=value)
            params[`${prefix}_value`] = p1;
            break;
        case 2: // Ramp (p1=upper)
        case 3: // Tri
            params[`${prefix}_upper`] = p1;
            break;
        case 4: // Pulse (p1=top)
            params[`${prefix}_top`] = p1;
            break;
        case 5: // Step (p1=height, p2=step)
            params[`${prefix}_height`] = p1;
            params[`${prefix}_step`] = p2;
            break;
    }
    return params;
}

// 額外參數解包器 (將 p1~p4 轉回 bladeCount, length...)
function unpackExtrasToParams(modeStr, p1, p2, p3, p4) {
    const params = {};
    
    // 輔助函式：從 255 反推回原始區間
    const f = (v255, min, max) => from255(v255, min, max);

    switch (modeStr) {
        case "MODES_SQUARE":
            params.boxsize = f(p3, 0, 300);
            break;
        case "MODES_SICKLE":
            params.position_fix = f(p1, 0, 255);
            params.curvature    = f(p3, 0, 100);
            params.length       = f(p4, 0, 300);
            break;
        case "MODES_FAN":
            params.curvature  = f(p1, 0, 100);
            params.bladeCount = f(p3, 0, 12);
            params.length     = f(p4, 0, 300);
            break;
        case "MODES_BOXES":
            params.boxsize = f(p3, 0, 300);
            params.space   = f(p4, 0, 100);
            break;
        case "MODES_CMAP_DNA":
            params.reverse = (p1 >= 128); // Boolean
            params.space   = f(p4, 0, 100);
            break;
        case "MODES_CMAP_FIRE":
            params.space = f(p4, 0, 100);
            break;
    }
    return params;
}

// 主要匯入函式
function importProjectFromJson(jsonArray) {
    if (!Array.isArray(jsonArray)) {
        alert("格式錯誤：JSON 必須是陣列");
        return;
    }

    // 刪除所有方塊
    if (asset_canvas1) {
        asset_canvas1.clear();
        // 重設全域變數
        window.globalEffectData = {};
        currentEditingId = null;
        
        // 隱藏參數面板
        if (paramEmpty) paramEmpty.style.display = 'block'; 
        if (paramMain) paramMain.classList.add('hidden');
    }

    // 逐一重建方塊
    jsonArray.forEach(blockData => {
        // 準備基本資料
        const modeStr = blockData.mode || "MODES_PLAIN";
        const assetName = MODE_MAP_INV[modeStr] || "純色"; // 反查中文名 (如 "扇形")
        const currentId = globalAssetIdCounter++; // 產生新 ID
        
        // 時間轉換 (毫秒 -> 秒)
        const startTimeSec = (blockData.start_time || 0) / 1000;
        const durationSec  = (blockData.duration || 0) / 1000;

        // 解包參數
        let restoredParams = {};
        
        // 解包 HSV
        ["XH", "XS", "XV", "YH", "YS", "YV"].forEach(key => {
            const hsvParams = unpackHsvToParams(key, blockData[key]);
            Object.assign(restoredParams, hsvParams);
        });

        // 解包 Extras
        const extrasParams = unpackExtrasToParams(modeStr, blockData.p1, blockData.p2, blockData.p3, blockData.p4);
        Object.assign(restoredParams, extrasParams);

        // 寫入資料庫
        window.globalEffectData[currentId] = {
            ...restoredParams,
            id: currentId,
            name: assetName,
            startTime: startTimeSec,
            duration: durationSec
        };

        // 在畫布上建立實體
        const newBlock = new EffectBlock(currentId, assetName);
        
        // 設定時間
        newBlock.startTime = startTimeSec;
        newBlock.duration = durationSec;

        // 計算對應的 X 座標
        const targetX = (startTimeSec - timelineOffset) / secondsPerPixel;
        const centerY = asset_canvas1.getHeight() / 2;

        // 渲染
        const group = newBlock.render(asset_canvas1, targetX, centerY);
        
        // render內部會根據預設寬度重算 duration，我們要強制用存檔的 duration 來縮放
        newBlock.duration = durationSec;
        newBlock.updateDimensionsFromTime(); // 這是 EffectBlock 裡的方法，讓寬度符合 duration
        group.setCoords();
    });

    asset_canvas1.requestRenderAll();
    console.log(`[匯入成功] 共還原 ${jsonArray.length} 個方塊`);
}

// 綁定匯入按鈕事件
const btnImport = document.getElementById('btn_import_json');
const fileInputImport = document.getElementById('import_file_input');

if (btnImport && fileInputImport) {
    // 點擊按鈕觸發 input
    btnImport.addEventListener('click', () => {
        fileInputImport.value = ''; // 清空以允許重複選同一檔
        fileInputImport.click();
    });

    // 檔案選擇後處理
    fileInputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const rawData = JSON.parse(evt.target.result);
                let finalData = [];

                // 檢查是否為陣列
                if (Array.isArray(rawData)) {
                    
                    // 偵測是否為 2D 陣列 (檢查第一個元素是不是也是陣列)
                    if (rawData.length > 0 && Array.isArray(rawData[0])) {
                        console.log("⚠️ 偵測到 2D 陣列！正在自動攤平 (Flatten)...");
                        
                        // 使用 .flat() 將 [[A,B], [C,D]] 變成 [A,B,C,D]
                        finalData = rawData.flat(); 
                        
                        alert(`偵測到多層資料結構，已自動合併 ${rawData.length} 組資料，共 ${finalData.length} 個方塊。`);
                    } 
                    // 否則就是標準的 1D 陣列
                    else {
                        console.log("✅ 偵測到標準 1D 陣列");
                        finalData = rawData;
                    }

                    // 執行匯入
                    importProjectFromJson(finalData);

                } else {
                    // 如果根本不是陣列 (例如是單純的 Object)
                    alert("匯入失敗：JSON 格式不符 (根節點必須是 Array)");
                    console.error("收到錯誤格式:", rawData);
                }

            } catch (err) {
                console.error("JSON 解析失敗", err);
                alert("匯入失敗：檔案格式錯誤或損毀");
            }
        };
        reader.readAsText(file);
    });
}

// 控制面板邏輯

const NUM_LUX_DEVICES = 6; // 燈具數量
const row2Container = document.querySelector('.row2');
const controlListContainer = document.getElementById('control_list_container');
let controlPollingInterval = null;

// 1. 監聽 Tab 切換 (包含版面變形)
document.querySelectorAll('.param_tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        
        // UI Tab 切換
        document.querySelectorAll('.param_tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.param_body').forEach(b => {
            b.classList.toggle('active', b.classList.contains(`param_body--${mode}`));
        });

        // 版面變形與資料輪詢
        if (mode === 'control') {
            row2Container.classList.add('mode-control'); // 觸發 CSS 變形
            startControlPolling(); // 開始跟 Server 要資料
        } else {
            row2Container.classList.remove('mode-control'); // 還原
            stopControlPolling(); // 停止要資料
        }
    });
});

// 2. 初始化列表 UI
function initControlPanelUI() {
    if (!controlListContainer) return;
    controlListContainer.innerHTML = '';

    for (let i = 0; i < NUM_LUX_DEVICES; i++) {
        const row = document.createElement('div');
        row.className = 'control_row';
        row.innerHTML = `
            <div class="col-id">${i}</div>
            <div class="col-state"><span class="state_text disconnected" id="state_${i}">斷線</span></div>
            <div class="col-time"><span class="time_text" id="time_${i}">--:--:--</span></div>
            <div class="col-mode">
                <select class="mode_select" onchange="updateLuxMode(${i}, this.value)">
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>
            </div>
            <div class="col-rst">
                <input type="checkbox" class="rst_check" onchange="triggerReset(${i}, this)">
            </div>
        `;
        controlListContainer.appendChild(row);
    }
}

// 3. 呼叫 Server API

// 時間格式化工具
function formatDuration(ms) {
    if (ms < 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    // 為了節省空間，若小時為0則不顯示
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// 輪詢狀態 (/get_stat)
async function updateControlStatus() {
    const now = Date.now();
    for (let i = 0; i < NUM_LUX_DEVICES; i++) {
        try {
            // 對應 server.js: app.get("/get_stat", ...)
            const res = await fetch(`/get_stat?id=${i}`);
            if (!res.ok) continue;

            const lastSeenStr = await res.text();
            const lastSeenTime = parseInt(lastSeenStr); 

            const stateEl = document.getElementById(`state_${i}`);
            const timeEl = document.getElementById(`time_${i}`);

            // 判斷連線 (例如 5秒內有更新算連線)
            const diff = now - lastSeenTime;
            const isConnected = (lastSeenTime > 0 && diff < 5000);

            if (isConnected) {
                stateEl.textContent = "連線";
                stateEl.className = "state_text connected";
                timeEl.textContent = formatDuration(diff);
            } else {
                stateEl.textContent = "斷線";
                stateEl.className = "state_text disconnected";
                timeEl.textContent = "--:--";
            }
        } catch (e) {
            console.warn(e);
        }
    }
}

// 更新模式 (/update_lux_mode)
window.updateLuxMode = function(id, modeVal) {
    fetch(`/update_lux_mode?id=${id}&mode=${modeVal}`)
        .then(res => res.text())
        .then(txt => console.log("Mode update:", txt))
        .catch(err => console.error(err));
};

// 更新重置 (/update_lux_reset)
window.triggerReset = function(id, checkbox) {
    const isChecked = checkbox.checked;
    fetch(`/update_lux_reset?id=${id}&clear=${isChecked}`)
        .then(res => res.text())
        .then(txt => console.log("Reset update:", txt))
        .catch(err => console.error(err));
};

// 4. 啟動器
function startControlPolling() {
    if (controlPollingInterval) return;
    updateControlStatus();
    controlPollingInterval = setInterval(updateControlStatus, 1000);
}

function stopControlPolling() {
    if (controlPollingInterval) {
        clearInterval(controlPollingInterval);
        controlPollingInterval = null;
    }
}

// 初始化 UI
initControlPanelUI();
=======
}
>>>>>>> f43a1f02fb670c763e24d7fd62dd516ed2877e07
