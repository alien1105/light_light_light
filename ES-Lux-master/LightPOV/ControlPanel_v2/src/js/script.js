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
    // 1. 更新當前的模式字串 (供後續儲存使用)
    currentModeStr = MODE_MAP[name] || "MODES_PLAIN";

    // 2. 顯示參數面板，隱藏空狀態
    if (paramEmpty) paramEmpty.style.display = 'none';
    if (paramMain) paramMain.classList.remove('hidden');

    // 3. 根據 EFFECT_CONFIG 決定要顯示哪些額外參數 (Extra Groups)
    const cfg = EFFECT_CONFIG[name] || { extras: [] };

    if (extraGroups) {
        extraGroups.forEach(g => {
            const key = g.dataset.extra;
            g.style.display = cfg.extras.includes(key) ? "block" : "none";
        });
    }

    // 4. 特殊處理：如果是 "清除"，則隱藏面板
    if (name === "清除") {
        paramMain.classList.add('hidden');
    }
}

// 抓取目前面板上所有輸入框的值 (只抓取「顯示中」的參數)
function capturePanelParams() {
    const params = {};
    const inputs = document.querySelectorAll('.param_main input, .param_main select');
    
    inputs.forEach(el => {
        const key = el.id || el.dataset.param;
        if (!key) return;

        // 🛑 核心修正：過濾掉隱藏的 HSV 參數
        const parentSet = el.closest('.hsv_func_params');
        if (parentSet && !parentSet.classList.contains('active')) {
            return; 
        }

        if (el.type === 'checkbox' || el.type === 'radio') {
            params[key] = el.checked;
        } else {
            params[key] = el.value;
        }
    });
    return params;
}

// 點素材 顯示對應參數
assetItems.forEach(item => {
  item.addEventListener('click', () => {
    const name = item.textContent.trim();

    currentModeStr = MODE_MAP[name] || "MODES_PLAIN";

    document.querySelectorAll('.Asset_item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    paramEmpty.style.display = 'none';
    paramMain.classList.remove('hidden');
    paramBody.scrollTop = 0;

    resetAllParams();

    const cfg = EFFECT_CONFIG[name] || { extras: [] };

    extraGroups.forEach(g => {
      const key = g.dataset.extra;
      g.style.display = cfg.extras.includes(key) ? "block" : "none";
    });

    if (name === "清除") {
      paramMain.classList.add('hidden');
    }
  });
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
    const mode = tab.dataset.mode;

    document.querySelectorAll('.param_tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.param_body').forEach(b => {
      b.classList.toggle('active', b.classList.contains(`param_body--${mode}`));
    });
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

  const range = getParamNorm(activeSet, "range", 0);
  const lower = getParamNorm(activeSet, "lower", 0);

  switch (funcCode) {
    case 1: { // Const
      const value255 = getParamNorm(activeSet, "value", 0);
      return { func: 1, range: 0, lower: 0, p1: value255, p2: 0 };
    }

    case 2: { // Ramp
      const upper255 = getParamNorm(activeSet, "upper", 0);
      return { func: 2, range, lower, p1: upper255, p2: 0 };
    }

    case 3: { // Tri
      const upper255 = getParamNorm(activeSet, "upper", 0);
      return { func: 3, range, lower, p1: upper255, p2: 0 };
    }

    case 4: { // Pulse
      const top255 = getParamNorm(activeSet, "top", 0);
      return { func: 4, range, lower, p1: top255, p2: 0 };
    }

    case 5: { // Step
      const height255 = getParamNorm(activeSet, "height", 0);
      const stepNum255 = getParamNorm(activeSet, "step", 0);
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

function sendToSettime(jsonPath) {
  const currentPlaybackTime = 0; 

  fetch('/settime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: jsonPath,
      current_time: currentPlaybackTime
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

    // ❗ 若小於 0 → 強制回到 0
    if (newClipStart < 0) {
        newClipStart = 0;
        waveformObj.left = (0 - timelineOffset) / secondsPerPixel;
    }

    clipStartSec = newClipStart;

    ensureAudioSyncToGlobal(true);
    updateTimeUI();
    // 🎯 修正點 3: 同步三條線段的位置 (只需同步 left)
    waveformLines.forEach((line,index) => {
        if (index === 1) { // 🌟 右側框線 (index=1)
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
      // 🎯 修正點 2-2: 在此處創建三條線段 (左、右、底)
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

    // 1. 左側框線: 
    const leftLine = new fabric.Line([0, topY, 0, bottomY], strokeOpts);
    leftLine.set({ originY: 'center', top: 110 });

    // 2. 右側框線:
    const rightLine = new fabric.Line([width, topY, width, bottomY], strokeOpts);
    rightLine.set({ originY: 'center', top: 110 });

    // 3. 底部框線: (使用相對座標 [0, 0] 到 [width, 0], 然後用 top 定位在 bottomY)
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
// 🎯 同步線段的位置與縮放
  waveformLines.forEach((line, index) => {
      line.left = waveformObj.left;
      
      // 底部線段 (index=2) 繼承縮放
      if (index === 2) {
          line.scaleX = waveformObj.scaleX; 
      }
      else if (index === 1) { // 🌟 新增：針對右框線
          // 右框線的位置 = 波形圖起始位置 + 拉伸後的總寬度
          line.left = waveformObj.left + clipWidthPx;
          line.scaleX = 1; // 保持固定厚度 
      }
      else {
          // 左右框線保持自然寬度
          line.scaleX = 1; 
      }
      
  });
 // ❗ clipStartSec 不可小於 0
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

// 🌟 初始化 Asset Canvas1 的 Fabric 畫布
// 🌟 初始化 Asset Canvas1 的 Fabric 畫布
function initAsset1Fabric() {
  if (!assetCanvas1El) {
    console.error('找不到 #assetCanvas1');
    return;
  }
  
  // 1. 初始化畫布
  assetCanvas1El.width = assetCanvas1El.clientWidth;
  assetCanvas1El.height = assetCanvas1El.clientHeight;

  asset_canvas1 = new fabric.Canvas("assetCanvas1", {
    selection: true,
    renderOnAddRemove: true
  });
  
  asset_canvas1.setWidth(assetCanvas1El.clientWidth);
  asset_canvas1.setHeight(assetCanvas1El.clientHeight);

  // 2. 處理拖曳放下
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
    console.log(`放下事件觸發！素材名稱：${assetName}`);

    createAssetOnCanvas(assetName, pointer.x, pointer.y);
  });

  // 🌟 事件監聽整合區
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

  // A. 選取方塊時：讀取參數
  asset_canvas1.on('selection:created', loadAssetParams);
  asset_canvas1.on('selection:updated', loadAssetParams);
  
  // 取消選取時：隱藏面板 + 全部變回白色
  asset_canvas1.on('selection:cleared', () => {
     resetAllStrokes(); 
     paramEmpty.style.display = 'block'; 
     paramMain.classList.add('hidden');
     console.log("取消選取");
     asset_canvas1.requestRenderAll();
  });

  function loadAssetParams(e) {
    // 容錯寫法
      const activeObj = e.selected ? e.selected[0] : asset_canvas1.getActiveObject();
      
      if (!activeObj || !activeObj.effectName) return;

      console.log(`選取素材：${activeObj.effectName}，讀取參數中...`);

      // 🌟 1. 視覺回饋：先重置所有顏色，再將當前物件設為藍色
      resetAllStrokes();
      
      if (activeObj.item(0)) {
          activeObj.item(0).set({
              stroke: '#00aaff', // 🔷 設定選取色 (亮藍色)
              strokeWidth: 2     // 加粗一點讓選取更明顯
          });
      }
      // 🔒 上鎖
      isRestoring = true;

      // 1. 切換 UI
      switchEffectUI(activeObj.effectName);

      // 2. 清空面板 (避免髒數據)
      resetAllParams(); 

      // 3. 填入參數
      if (activeObj.effectParams) {
          restorePanelParams(activeObj.effectParams);
      }

      // 🔓 解鎖
      setTimeout(() => {
          isRestoring = false;
      }, 10);
  }

  // B. 面板操作時：同步回方塊
  // 先移除舊的避免重複 (保險起見)
  paramMain.removeEventListener('input', syncParamsToActiveObject);
  paramMain.removeEventListener('change', syncParamsToActiveObject);
  
  paramMain.addEventListener('input', syncParamsToActiveObject);
  paramMain.addEventListener('change', syncParamsToActiveObject);

  function syncParamsToActiveObject(e) {
      // 🛑 檢查鎖
      if (isRestoring) return;

      const activeObj = asset_canvas1.getActiveObject();
      if (!activeObj) return;

      const target = e.target;
      const key = target.id || target.dataset.param;
      
      if (key) {
          if (!activeObj.effectParams) activeObj.effectParams = {};

          if (target.type === 'checkbox' || target.type === 'radio') {
              activeObj.effectParams[key] = target.checked;
          } else {
              activeObj.effectParams[key] = target.value;
          }
          console.log(`同步參數 ${key} -> ${activeObj.effectParams[key]}`);
      }
  }

  asset_canvas1.requestRenderAll();
}

// 根據時間軸的 Offset 和 Zoom 更新素材位置
function updateAssetPositions() {
  if (!asset_canvas1) return;

  asset_canvas1.getObjects().forEach(obj => {
    // 只有當物件有記錄 startTime 時才處理
    if (obj.startTime !== undefined) {
      // 公式：(物件開始時間 - 時間軸起始時間) / 每像素代表秒數
      const newLeft = (obj.startTime - timelineOffset) / secondsPerPixel;
      
      obj.left = newLeft;
      // 更新寬度 (ScaleX)
      if (obj.duration !== undefined) {
          // 算出現在這個 zoom level 下，這個時間長度應該是多少像素
          const targetWidthPx = obj.duration / secondsPerPixel;
          
          // 更新 ScaleX
          obj.scaleX = targetWidthPx / obj.width;

          // 找出群組裡的文字物件進行修正
          const textObj = obj.item(1); 
          if (textObj) {
              textObj.set({
                  scaleX: 1 / obj.scaleX,
                  scaleY: 1 // Y 軸通常鎖定，設為 1 即可，或 1/obj.scaleY
              });
          }
      }
      obj.setCoords(); // 更新物件的控制點座標
    }
  });

  asset_canvas1.requestRenderAll();
}

function createAssetOnCanvas(assetName, x, y) {
    if (!asset_canvas1) return;

    // 1. 建立背景方塊
    const boxWidth = 100; 
    const boxHeight = 80; // 高度固定 80

    const bgRect = new fabric.Rect({
        width: boxWidth,
        height: boxHeight,
        fill: '#333333',    
        stroke: '#ffffff',  
        strokeWidth: 1,
        rx: 5,              
        ry: 5,
        originX: 'center',  
        originY: 'center',
        strokeUniform: true 
    });

    // 2. 建立文字標籤
    const textObj = new fabric.Text(assetName, {
        fontSize: 16,       
        fill: '#ffffff',    
        originX: 'center',
        originY: 'center'
    });

    // 計算垂直置中的位置
    const centerY = asset_canvas1.getHeight() / 2;

    // 3. 建立群組
    const group = new fabric.Group([bgRect, textObj], {
        left: x,                
        top: centerY,           
        originX: 'center',
        originY: 'center',
        selectable: true,
        
        // 鎖定移動與縮放限制
        lockMovementY: true,    // 只能左右移動
        lockScalingY: true,     // 只能左右縮放 
        lockRotation: true,     // 禁止旋轉 
        // 選取樣式設定
        hasBorders: false,
        // 讓控制項比較好抓
        cornerColor: 'white',
        cornerSize: 10,
        transparentCorners: false,
        objectCaching: false
    });

    // 設定控制點可見性：只保留左右兩側 (ml, mr)
    group.setControlsVisibility({
        mt: false, // 上中
        mb: false, // 下中
        ml: true,  // 左中 (允許)
        mr: true,  // 右中 (允許)
        bl: false, // 左下
        br: false, // 右下
        tl: false, // 左上
        tr: false, // 右上
        mtr: false // 旋轉控制點
    });
    // 輔助函式：取得目前這個方塊「左右兩邊的邊界限制」
    function getSafeBoundaries(activeObj) {
        let minX = 0; // 最左邊界 (畫布邊緣)
        let maxX = asset_canvas1.getWidth(); // 最右邊界 (畫布邊緣)

        const activeHalfWidth = (activeObj.width * activeObj.scaleX) / 2;
        const activeLeftEdge = activeObj.left - activeHalfWidth;
        const activeRightEdge = activeObj.left + activeHalfWidth;

        asset_canvas1.getObjects().forEach(other => {
            if (other === activeObj) return; // 跳過自己

            const otherHalfWidth = (other.width * other.scaleX) / 2;
            const otherLeftEdge = other.left - otherHalfWidth;
            const otherRightEdge = other.left + otherHalfWidth;

            // 判斷 other 是否在 activeObj 的左邊
            // 邏輯：如果 other 的中心點在 active 的左邊，我們就視為左側障礙物
            if (other.left < activeObj.left) {
                // 找出最靠近 activeObj 的左邊界 (取最大值)
                if (otherRightEdge > minX) minX = otherRightEdge;
            }
            
            // 判斷 other 是否在 activeObj 的右邊
            if (other.left > activeObj.left) {
                // 找出最靠近 activeObj 的右邊界 (取最小值)
                if (otherLeftEdge < maxX) maxX = otherLeftEdge;
            }
        });

        return { minX, maxX };
    }
// 設定預設時間長度為 1 秒
    group.duration = 1; 

    // 計算初始 ScaleX
    // 公式：目標像素寬度 = 時間長度 / 每像素秒數
    // ScaleX = 目標像素寬度 / 原始寬度(100)
    const targetWidthPx = group.duration / secondsPerPixel;
    group.scaleX = targetWidthPx / group.width;

    // 修正文字變形 (因為剛才改了 scaleX)
    textObj.set({
        scaleX: 1 / group.scaleX,
        scaleY: 1 
    });

    // -------------------------------------------------------------

    // 設定開始時間
    group.startTime = timelineOffset + (x * secondsPerPixel);

    // -------------------------------------------------------------
    // 1. 移動時的防重疊
    // -------------------------------------------------------------
    group.on('moving', () => {
        const bounds = getSafeBoundaries(group);
        const halfWidth = (group.width * group.scaleX) / 2;

        // 限制左邊：不能超過左側物件的右邊緣
        if (group.left - halfWidth < bounds.minX) {
            group.left = bounds.minX + halfWidth;
        }
        
        // 限制右邊：不能超過右側物件的左邊緣
        if (group.left + halfWidth > bounds.maxX) {
            group.left = bounds.maxX - halfWidth;
        }

        // 同步時間 (在位置修正後才計算)
        group.startTime = timelineOffset + (group.left * secondsPerPixel);
    });


    // -------------------------------------------------------------
    // 2. 縮放時的防重疊
    // -------------------------------------------------------------
    group.on('scaling', () => {
        const bounds = getSafeBoundaries(group);
        const halfWidth = (group.width * group.scaleX) / 2;

        // 文字抗拉伸
        textObj.set({
            scaleX: 1 / group.scaleX,
            scaleY: 1 / group.scaleY
        });

        // 檢查是否碰到左邊界
        if (group.left - halfWidth < bounds.minX) {
            // 如果碰到，計算允許的最大寬度
            // 最大寬度 = (中心點 - 左邊界) * 2
            const maxAllowedWidth = (group.left - bounds.minX) * 2;
            // 反推 ScaleX = 最大寬度 / 原始寬度
            group.scaleX = maxAllowedWidth / group.width;
            
            // 修正位置 (避免微小誤差導致穿越)
            group.left = bounds.minX + (group.width * group.scaleX) / 2;
        }

        // 檢查是否碰到右邊界
        if (group.left + halfWidth > bounds.maxX) {
            const maxAllowedWidth = (bounds.maxX - group.left) * 2;
            group.scaleX = maxAllowedWidth / group.width;
            group.left = bounds.maxX - (group.width * group.scaleX) / 2;
        }
        // 公式：像素寬度 * 每像素秒數
        const currentWidthPx = group.width * group.scaleX;
        group.duration = currentWidthPx * secondsPerPixel;
        // 同步時間
        group.startTime = timelineOffset + (group.left * secondsPerPixel);
    });
    // 1. 切換 UI 並重置面板 (確保抓到的是乾淨的預設值)
    switchEffectUI(assetName);
    resetAllParams();

    // 把素材名稱存進方塊裡
    group.effectName = assetName;

    // 3. 抓取當前的面板參數 (預設值)，存入方塊
    group.effectParams = capturePanelParams();
    const effect_duration = buildSegmentFromUI(group.startTime,group.duration);
    asset_canvas1.add(group);
    asset_canvas1.setActiveObject(group);
    asset_canvas1.fire('selection:created', { target: group, selected: [group] }); 
    asset_canvas1.requestRenderAll();
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
                asset_canvas1.remove(obj);
            });

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

// 自訂義加入
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
  setParamFrom255(set, "range", cfgBlock.range);
  setParamFrom255(set, "lower", cfgBlock.lower);

  // 還原各 func 的 p1/p2
  switch (cfgBlock.func) {
    case 1: // Const: p1 = value
      setParamFrom255(set, "value", cfgBlock.p1);
      break;
    case 2: // Ramp: p1 = upper
    case 3: // Tri:  p1 = upper
      setParamFrom255(set, "upper", cfgBlock.p1);
      break;
    case 4: // Pulse: p1 = top
      setParamFrom255(set, "top", cfgBlock.p1);
      break;
    case 5: // Step: p1 = height, p2 = step
      setParamFrom255(set, "height", cfgBlock.p1);
      setParamFrom255(set, "step",   cfgBlock.p2);
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
