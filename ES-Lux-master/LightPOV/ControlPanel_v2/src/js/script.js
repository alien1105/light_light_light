// DOM elements
const fileInput = document.getElementById('fileInput');
const audio = document.getElementById('audio');
const playToggle = document.getElementById('playToggle');
const timeLabel = document.getElementById('time');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');


// fix for high-DPI screens
function resizeCanvasToDisplaySize(c) {
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
resizeCanvasToDisplaySize(canvas);

// Audio variables
let audioCtx = null;
let audioBuffer = null;
let peaks = [];
let animationId = null;
let isDragging = false;
let wasPlayingBeforeDrag = false;

// Format seconds → mm:ss
function fmt(t) {
  if (!isFinite(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Draw waveform and playhead
function drawWave(progress = 0) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#07101a';
  ctx.fillRect(0, 0, w, h);
  const mid = h / 2;
  const peakColor = '#4fb3d6';
  const playedColor = '#dff6ff';

  // all peaks
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = peakColor;
  for (let x = 0; x < w; x++) {
    const idx = Math.floor(x * (peaks.length / w));
    const p = peaks[idx] || 0;
    const y = p * (h / 2);
    ctx.moveTo(x + 0.5, mid - y);
    ctx.lineTo(x + 0.5, mid + y);
  }
  ctx.stroke();

  // played portion
  if (progress > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * progress, h);
    ctx.clip();
    ctx.strokeStyle = playedColor;
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * (peaks.length / w));
      const p = peaks[idx] || 0;
      const y = p * (h / 2);
      ctx.moveTo(x + 0.5, mid - y);
      ctx.lineTo(x + 0.5, mid + y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // playhead
  const playX = w * progress;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.moveTo(playX, 0);
  ctx.lineTo(playX, h);
  ctx.stroke();
}

// compute waveform peaks
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

// update progress animation
function animate() {
    if (!audioBuffer) return;
    const duration = audio.duration;
    const current = audio.currentTime;
    const progress = Math.min(1, current / duration);
    drawWave(progress);
    timeLabel.textContent = `${fmt(current)} / ${fmt(duration)}`;
    animationId = requestAnimationFrame(animate);
}

// convert clientX to playback progress (0–1)
function clientXToProgress(x) {
    const rect = canvas.getBoundingClientRect();
    const offset = Math.min(rect.width, Math.max(0, x - rect.left));
    return offset / rect.width;
}

// seek audio
function seek(progress) {
    if (!audioBuffer) return;
    const duration = audio.duration;
    const time = Math.min(duration, Math.max(0, progress * duration));
    audio.currentTime = time;
    drawWave(progress);
    timeLabel.textContent = `${fmt(time)} / ${fmt(duration)}`;
}

// file load
document.getElementById('music_file_load_Btn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    playToggle.disabled = false;
    playToggle.textContent = "▶ 播放";

    const buf = await file.arrayBuffer();
    try {
        audioBuffer = await audioCtx.decodeAudioData(buf.slice(0));
    } catch {
        audioBuffer = await new Promise((res, rej) => audioCtx.decodeAudioData(buf, res, rej));
    }
    const pixelWidth = canvas.width / (window.devicePixelRatio || 1);
    peaks = computePeaks(audioBuffer, Math.max(1024, Math.floor(pixelWidth * 2)));                                                                                                                                                                                                  
    /*peaks = computePeaks(audioBuffer, Math.max(1024, Math.floor(canvas.clientWidth * 2)));*/
    drawWave(0);
    timeLabel.textContent = `00:00 / ${fmt(audioBuffer.duration)}`;
});

// play / pause toggle
playToggle.addEventListener('click', async () => {
    if (!audio.src) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (audio.paused || audio.ended) {
        await audio.play();
        playToggle.textContent = "⏸ 暫停";
        cancelAnimationFrame(animationId);
        animate();
    } 
    else {
        audio.pause();
        playToggle.textContent = "▶ 播放";
        cancelAnimationFrame(animationId);
    }
});

// audio end
audio.addEventListener('ended', () => {
    cancelAnimationFrame(animationId);
    drawWave(1);
     playToggle.textContent = "▶ 播放";
});

// 拖曳時間軸
let dragProgress = 0;
let dragTarget = 0;
let dragRAF = null;

canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    wasPlayingBeforeDrag = !audio.paused && !audio.ended;
    if (wasPlayingBeforeDrag) audio.pause();
    isDragging = true;
    canvas.setPointerCapture(ev.pointerId);
    dragTarget = dragProgress = clientXToProgress(ev.clientX);
    cancelAnimationFrame(animationId);
    smoothDragAnimate(); // 啟動平滑拖曳動畫
});

canvas.addEventListener('pointermove', (ev) => {
    if (!isDragging) return;
    ev.preventDefault();
    dragTarget = clientXToProgress(ev.clientX);
});

canvas.addEventListener('pointerup', (ev) => {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture(ev.pointerId);

    const p = clientXToProgress(ev.clientX);
    audio.currentTime = (audio.duration || audioBuffer.duration) * p;
    drawWave(p);

    if (wasPlayingBeforeDrag) {
            audio.play();
            playToggle.textContent = "⏸ 暫停";
            cancelAnimationFrame(animationId);
            animate();
    } 
    else {
        playToggle.textContent = "▶ 播放";
    }
});

// 平滑拖曳動畫（使用插值避免卡頓）
function smoothDragAnimate() {
    if (!isDragging) return;
    dragProgress += (dragTarget - dragProgress); // 插值過渡
    drawWave(dragProgress);

  // 若音樂時間已載入，邊拖曳邊更新播放時間（即時預覽）
  if (audio.duration > 0) {
    audio.currentTime = audio.duration * dragProgress;
  }

  dragRAF = requestAnimationFrame(smoothDragAnimate);
}


// click seek
canvas.addEventListener('click', (ev) => {
    if (isDragging) return;
    const p = clientXToProgress(ev.clientX);
    seek(p);
});

// resize redraw
window.addEventListener('resize', () => {
    resizeCanvasToDisplaySize(canvas);
  if (audioBuffer) {
        const progress = audio.currentTime / audio.duration;
        drawWave(progress);
  }
});

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