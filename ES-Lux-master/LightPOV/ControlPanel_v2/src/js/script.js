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
    ctx.beginPath();
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
    const duration = audio.duration || audioBuffer.duration;
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
    const duration = audio.duration || audioBuffer.duration;
    const time = Math.min(duration, Math.max(0, progress * duration));
    audio.currentTime = time;
    drawWave(progress);
    timeLabel.textContent = `${fmt(time)} / ${fmt(duration)}`;
}

// file load
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
    peaks = computePeaks(audioBuffer, Math.max(1024, Math.floor(canvas.clientWidth * 2)));
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
    dragProgress += (dragTarget - dragProgress) * 0.25; // 插值過渡
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
        const progress = audio.currentTime / (audio.duration || audioBuffer.duration);
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

// 效果設定
const EFFECT_CONFIG = {
  "清除": { extras: [] },
  "純色": { extras: [] },
  "方形": { extras: ["boxsize"] },
  "方塊": { extras: ["boxsize", "space"] },
  "DNA":   { extras: ["reverse", "space"] },
  "火焰": { extras: ["space"] },
  "鐮刀": { extras: ["position_fix", "length", "curvature"] },
  "扇形": { extras: ["bladeCount", "length", "curvature"] },
};

const assetItems = document.querySelectorAll('.Asset_item');
const paramEmpty = document.querySelector('.param_empty');
const paramMain  = document.querySelector('.param_main');
const paramBody  = document.querySelector('.param_body--param');
const extraGroups = document.querySelectorAll('.extra_group');

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
    
    assetItems.forEach(i => i.classList.remove('active'));
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

function to255(value, min, max) {
  const v = Math.min(max, Math.max(min, Number(value) || 0));
  return Math.round((v - min) / (max - min) * 255);
}

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