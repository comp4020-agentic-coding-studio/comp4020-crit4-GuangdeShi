// Experiment A: does the built-in camera see coherent global image motion
// when the screen physically opens/closes? No object recognition, no ML --
// just a heavily downsampled frame compared to the previous frame.
//
// Approach: downsample each frame to a tiny WxH grayscale grid, collapse it
// to a per-row brightness profile, then find the vertical shift (in
// downsampled rows) that best aligns this frame's profile with the previous
// frame's profile. That shift is treated as "global vertical motion" --
// exactly the kind of coherent motion a camera rigidly attached to a
// rotating lid should show.

const W = 48, H = 36;
const video = document.getElementById('video');
const canvas = document.getElementById('tiny');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusEl = document.getElementById('status');

canvas.width = W;
canvas.height = H;

let prevProfile = null;
let smoothedShift = 0;
let smoothedActivity = 0;

const ALPHA = 0.3;          // exponential smoothing factor
const DEAD_ZONE = 0.35;     // below this |shift| (rows), call it STILL
const MAX_SHIFT = 3.0;      // |shift| at or above this maps to strength 1.0
const MAX_SEARCH = 6;       // search +/- this many rows for best alignment
const ACTIVITY_GATE = 4;    // minimum mean abs pixel delta to bother computing shift at all

let lastLog = 0;

function rowProfile(imageData) {
  const { data, width, height } = imageData;
  const profile = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    profile[y] = sum / width;
  }
  return profile;
}

function bestShift(prev, now) {
  let bestK = 0, bestScore = Infinity;
  for (let k = -MAX_SEARCH; k <= MAX_SEARCH; k++) {
    let score = 0, count = 0;
    for (let i = 0; i < now.length; i++) {
      const j = i + k;
      if (j < 0 || j >= prev.length) continue;
      const d = now[i] - prev[j];
      score += d * d;
      count++;
    }
    if (count < now.length * 0.5) continue;
    score /= count;
    if (score < bestScore) { bestScore = score; bestK = k; }
  }
  return bestK;
}

function meanAbsDiff(prev, now) {
  let sum = 0;
  for (let i = 0; i < now.length; i++) sum += Math.abs(now[i] - prev[i]);
  return sum / now.length;
}

async function logSample(state, strength, rawShift, activity) {
  const now = performance.now();
  if (now - lastLog < 120) return; // throttle to ~8Hz
  lastLog = now;
  try {
    await fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        t: Date.now(),
        state,
        strength: +strength.toFixed(2),
        rawShift: +rawShift.toFixed(2),
        activity: +activity.toFixed(1),
      }),
    });
  } catch (e) { /* logging server not reachable -- ignore, UI still works */ }
}

function tick() {
  requestAnimationFrame(tick);
  if (video.readyState < 2) return;
  ctx.drawImage(video, 0, 0, W, H);
  const frame = ctx.getImageData(0, 0, W, H);
  const profile = rowProfile(frame);

  if (prevProfile) {
    const activity = meanAbsDiff(prevProfile, profile);
    smoothedActivity = ALPHA * activity + (1 - ALPHA) * smoothedActivity;

    let rawShift = 0;
    if (smoothedActivity > ACTIVITY_GATE) {
      rawShift = bestShift(prevProfile, profile);
    }
    smoothedShift = ALPHA * rawShift + (1 - ALPHA) * smoothedShift;

    let state = 'STILL';
    let strength = 0;
    if (smoothedActivity > ACTIVITY_GATE && Math.abs(smoothedShift) > DEAD_ZONE) {
      state = smoothedShift > 0 ? 'OPENING' : 'CLOSING';
      strength = Math.min(1, Math.abs(smoothedShift) / MAX_SHIFT);
    }

    statusEl.textContent =
`CAMERA BELLOWS TEST

Camera: connected

Motion:
${state}

Strength:
${strength.toFixed(2)}

(raw shift ${smoothedShift.toFixed(2)}, activity ${smoothedActivity.toFixed(1)})`;

    logSample(state, strength, smoothedShift, smoothedActivity);
  }
  prevProfile = profile;
}

navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
  .then((stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      requestAnimationFrame(tick);
    };
  })
  .catch((err) => {
    statusEl.textContent = `CAMERA BELLOWS TEST\n\nCamera: ERROR\n${err.message}`;
  });
