// Live synthesis for the choir — every voice is built from oscillators,
// noise, and filters at the moment a singer is hit. No prerecorded audio.
import type { SingerRole } from "./singers";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function getDestination(): AudioNode {
  getContext();
  return master as GainNode;
}

// One shared noise buffer, reused by every noise-based voice — cheap, and
// random content means reusing it never sounds looped.
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = context.sampleRate * 2;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Attack/hold/release on a gain node, all as exponential ramps so there's no
// click at the edges. exponentialRampToValueAtTime can't target 0, so the
// envelope bottoms out at a small non-zero floor instead.
function shapeGain(gain: GainNode, at: number, attack: number, hold: number, release: number, peak: number) {
  const g = gain.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(peak, at + attack);
  g.setValueAtTime(peak, at + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
}

function cleanupOnEnded(node: AudioScheduledSourceNode, ...rest: AudioNode[]) {
  node.onended = () => {
    node.disconnect();
    rest.forEach((n) => n.disconnect());
  };
}

function playBass(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(95, at);
  osc.frequency.exponentialRampToValueAtTime(52, at + 0.09);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 250;
  const gain = context.createGain();
  shapeGain(gain, at, 0.006, 0.05, 0.28, 0.95);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.45);
  cleanupOnEnded(osc, filter, gain);
}

function playPercussive(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 450;
  filter.Q.value = 0.9;
  const gain = context.createGain();
  shapeGain(gain, at, 0.002, 0.01, 0.09, 0.8);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 0.14);
  cleanupOnEnded(source, filter, gain);
}

function playBreathTss(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 4200;
  const gain = context.createGain();
  shapeGain(gain, at, 0.015, 0.08, 0.18, 0.4);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 0.32);
  cleanupOnEnded(source, filter, gain);
}

function playHum(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 196;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  const gain = context.createGain();
  shapeGain(gain, at, 0.02, 0.22, 0.32, 0.55);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.62);
  cleanupOnEnded(osc, filter, gain);
}

function playOpenAh(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 147;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 750;
  filter.Q.value = 3;
  const gain = context.createGain();
  shapeGain(gain, at, 0.01, 0.14, 0.24, 0.6);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.42);
  cleanupOnEnded(osc, filter, gain);
}

function playRoundOoh(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 233;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 480;
  const gain = context.createGain();
  shapeGain(gain, at, 0.015, 0.18, 0.26, 0.55);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.5);
  cleanupOnEnded(osc, filter, gain);
}

function playBrightEe(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 349;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2400;
  filter.Q.value = 4;
  const gain = context.createGain();
  shapeGain(gain, at, 0.008, 0.1, 0.16, 0.42);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.32);
  cleanupOnEnded(osc, filter, gain);
}

function playSoftAiry(context: AudioContext, out: AudioNode) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3000;
  filter.Q.value = 0.6;
  const gain = context.createGain();
  shapeGain(gain, at, 0.04, 0.1, 0.3, 0.22);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 0.45);
  cleanupOnEnded(source, filter, gain);
}

const players: Record<SingerRole, (context: AudioContext, out: AudioNode) => void> = {
  bass: playBass,
  percussive: playPercussive,
  "breath-tss": playBreathTss,
  hum: playHum,
  "open-ah": playOpenAh,
  "round-ooh": playRoundOoh,
  "bright-ee": playBrightEe,
  "soft-airy": playSoftAiry,
};

// Creates the AudioContext on first call — always call this from inside a
// user gesture handler (click/keydown), never at page load.
export function playRole(role: SingerRole): void {
  const context = getContext();
  players[role](context, getDestination());
}
