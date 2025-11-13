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

// 在分鐘或秒欄按 Enter 也能跳轉
minInput.addEventListener("keydown", (ev) => {
  // 按 Enter 時直接跳到秒數欄位
  if (ev.key === "Enter") {
    ev.preventDefault();
    secInput.focus();
  }
});
secInput.addEventListener("keydown", (ev) => {
  // 在秒欄按 Enter 就跳轉到該時間
  if (ev.key === "Enter") {
    ev.preventDefault();
    jumpToTime();
  }
});

function jumpToTime() {
  const minutes = parseInt(minInput.value, 10) || 0;
  const seconds = parseInt(secInput.value, 10) || 0;
  const totalSeconds = minutes * 60 + seconds;

  if (!audio.duration) return alert("請先載入音樂");
  if (totalSeconds < 0 || totalSeconds > audio.duration) {
    alert("輸入的時間超出音樂長度");
    return;
  }
  if (seconds > 59){
    alert("秒數不可大於59")
    return;
  }
  audio.currentTime = totalSeconds;
  drawWave(audio.currentTime / audio.duration);
  timeLabel.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
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
// 停止鍵
const stopBtn = document.getElementById("stopBtn");

// 當音樂載入後才啟用停止鍵
audio.addEventListener("loadeddata", () => {
  stopBtn.disabled = false;
});

// 停止鍵功能
stopBtn.addEventListener("click", () => {
  if (!audio.src) return;

  // 停止播放
  audio.pause();
  audio.currentTime = 0;
  cancelAnimationFrame(animationId);

// 音量控制
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");

// 初始音量
audio.volume = 1;

// 當滑桿改變時更新音量
volumeSlider.addEventListener("input", () => {
  const vol = volumeSlider.value / 100;
  audio.volume = vol;
  volumeValue.textContent = `${volumeSlider.value}%`;
});
  // 更新畫面與按鈕
  drawWave(0);
  timeLabel.textContent = `00:00 / ${fmt(audio.duration)}`;
  playToggle.textContent = "▶ 播放";
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
