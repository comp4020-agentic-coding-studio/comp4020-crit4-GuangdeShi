// Live drum synthesis --- every voice is built from Web Audio oscillators,
// noise and filters, no prerecorded samples. The AudioContext is created
// lazily on the player's first hit, never at page load.

export type DrumId =
  | "kick"
  | "snare"
  | "hihat-closed"
  | "hihat-open"
  | "tom-high"
  | "tom-mid"
  | "tom-floor"
  | "crash"
  | "ride";

let ctx: AudioContext | null = null;

export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// One shared noise buffer, reused (via a fresh BufferSourceNode) by every
// noise-based voice --- snare body, hi-hats, cymbals.
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function noiseSource(context: AudioContext): AudioBufferSourceNode {
  const src = context.createBufferSource();
  src.buffer = getNoiseBuffer(context);
  src.loop = true;
  return src;
}

// A membrane voice (kick / toms): a sine that drops in pitch fast, plus a
// short click transient for attack definition.
function playMembrane(
  context: AudioContext,
  time: number,
  startHz: number,
  endHz: number,
  dropSeconds: number,
  decaySeconds: number,
  clickGain: number,
  outGain: number,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startHz, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 1), time + dropSeconds);
  gain.gain.setValueAtTime(outGain, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decaySeconds);
  osc.connect(gain).connect(context.destination);
  osc.start(time);
  osc.stop(time + decaySeconds + 0.05);

  if (clickGain > 0) {
    const click = context.createOscillator();
    const clickEnv = context.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(startHz * 3, time);
    clickEnv.gain.setValueAtTime(clickGain, time);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.015);
    click.connect(clickEnv).connect(context.destination);
    click.start(time);
    click.stop(time + 0.02);
  }
}

function playKick(context: AudioContext, time: number): void {
  playMembrane(context, time, 150, 45, 0.09, 0.28, 0.4, 1.0);
}

function playTom(context: AudioContext, time: number, startHz: number, endHz: number): void {
  playMembrane(context, time, startHz, endHz, 0.12, 0.32, 0.15, 0.85);
}

function playSnare(context: AudioContext, time: number): void {
  // Noise body through a bandpass for the "crack", plus a tonal thump for body.
  const noise = noiseSource(context);
  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1800;
  bandpass.Q.value = 0.7;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.9, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  noise.connect(bandpass).connect(noiseGain).connect(context.destination);
  noise.start(time);
  noise.stop(time + 0.2);

  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(190, time);
  body.frequency.exponentialRampToValueAtTime(140, time + 0.09);
  bodyGain.gain.setValueAtTime(0.5, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  body.connect(bodyGain).connect(context.destination);
  body.start(time);
  body.stop(time + 0.12);
}

// The open hi-hat "chokes" (cuts off) when the closed hat or a fresh open
// hit fires --- realistic, and keeps rapid alternation from smearing.
let openHatChoke: { gain: GainNode; source: AudioBufferSourceNode } | null = null;

function chokeOpenHat(context: AudioContext, time: number): void {
  if (!openHatChoke) return;
  const { gain, source } = openHatChoke;
  gain.gain.cancelScheduledValues(time);
  gain.gain.setValueAtTime(gain.gain.value, time);
  gain.gain.linearRampToValueAtTime(0.0001, time + 0.03);
  source.stop(time + 0.04);
  openHatChoke = null;
}

function hihatVoice(context: AudioContext, time: number, decaySeconds: number, gainAmount: number): GainNode {
  const noise = noiseSource(context);
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 7000;
  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 10000;
  bandpass.Q.value = 0.6;
  const gain = context.createGain();
  gain.gain.setValueAtTime(gainAmount, time);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + decaySeconds);
  noise.connect(highpass).connect(bandpass).connect(gain).connect(context.destination);
  noise.start(time);
  noise.stop(time + decaySeconds + 0.05);
  return gain;
}

function playHihatClosed(context: AudioContext, time: number): void {
  chokeOpenHat(context, time);
  hihatVoice(context, time, 0.06, 0.5);
}

function playHihatOpen(context: AudioContext, time: number): void {
  chokeOpenHat(context, time);
  const noise = noiseSource(context);
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 6000;
  const gain = context.createGain();
  const decaySeconds = 0.45;
  gain.gain.setValueAtTime(0.45, time);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + decaySeconds);
  noise.connect(highpass).connect(gain).connect(context.destination);
  noise.start(time);
  noise.stop(time + decaySeconds + 0.05);
  openHatChoke = { gain, source: noise };
}

function cymbalVoice(
  context: AudioContext,
  time: number,
  decaySeconds: number,
  gainAmount: number,
  withBell: boolean,
): void {
  const noise = noiseSource(context);
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = withBell ? 4500 : 5500;
  const gain = context.createGain();
  gain.gain.setValueAtTime(gainAmount, time);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + decaySeconds);
  noise.connect(highpass).connect(gain).connect(context.destination);
  noise.start(time);
  noise.stop(time + decaySeconds + 0.05);

  if (withBell) {
    // The ride's defined "ping" --- a couple of detuned tonal partials.
    for (const [freq, amp] of [
      [560, 0.22],
      [845, 0.14],
    ] as const) {
      const partial = context.createOscillator();
      const partialGain = context.createGain();
      partial.type = "sine";
      partial.frequency.value = freq;
      partialGain.gain.setValueAtTime(amp, time);
      partialGain.gain.exponentialRampToValueAtTime(0.0005, time + decaySeconds * 0.8);
      partial.connect(partialGain).connect(context.destination);
      partial.start(time);
      partial.stop(time + decaySeconds);
    }
  }
}

function playCrash(context: AudioContext, time: number): void {
  cymbalVoice(context, time, 1.6, 0.55, false);
}

function playRide(context: AudioContext, time: number): void {
  cymbalVoice(context, time, 0.9, 0.35, true);
}

const players: Record<DrumId, (context: AudioContext, time: number) => void> = {
  kick: playKick,
  snare: playSnare,
  "hihat-closed": playHihatClosed,
  "hihat-open": playHihatOpen,
  "tom-high": (c, t) => playTom(c, t, 260, 130),
  "tom-mid": (c, t) => playTom(c, t, 180, 90),
  "tom-floor": (c, t) => playTom(c, t, 120, 60),
  crash: playCrash,
  ride: playRide,
};

// The single entry point for "make this drum's sound". Pass no time (or
// omit it) for an immediate, lowest-latency direct hit; pass a future
// AudioContext time to schedule an automatic-rhythm hit precisely.
export function playDrum(id: DrumId, time?: number): void {
  const context = getContext();
  players[id](context, time ?? context.currentTime);
}
