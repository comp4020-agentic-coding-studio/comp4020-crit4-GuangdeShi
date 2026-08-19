// Live synthesis for the choir — every voice is built from oscillators,
// noise, and formant-style filters at the moment a singer is hit. No
// prerecorded audio of any kind, ever.
import type { SingerRole } from "./singers";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();

    // Master bus: a fairly aggressive compressor so a big chord of up to 16
    // singers can't clip, however many land in the same instant.
    master = ctx.createGain();
    master.gain.value = 0.65;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    // Shared room ambience: three short feedback delay lines (a
    // synthesis-only "reverb" — no impulse-response sample involved) that
    // every voice sends a little signal into, so simultaneous singers sound
    // like they share a space instead of arriving dry and separate.
    reverbBus = ctx.createGain();
    reverbBus.gain.value = 1;
    for (const delayTime of [0.029, 0.037, 0.053]) {
      const delay = ctx.createDelay(0.2);
      delay.delayTime.value = delayTime;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const damping = ctx.createBiquadFilter();
      damping.type = "lowpass";
      damping.frequency.value = 2200;
      reverbBus.connect(delay);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);
      const tap = ctx.createGain();
      tap.gain.value = 0.4;
      damping.connect(tap);
      tap.connect(master);
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Every voice's final envelope connects here: straight to the master bus
// (dry) and, faintly, into the shared reverb bus (wet) — never point-blank
// dry, never drowned in ambience.
function connectVoice(node: AudioNode, wetAmount: number): GainNode {
  const context = ctx as AudioContext;
  node.connect(master as GainNode);
  const send = context.createGain();
  send.gain.value = wetAmount;
  node.connect(send);
  send.connect(reverbBus as GainNode);
  return send;
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

function cleanupOnEnded(primary: AudioScheduledSourceNode, ...rest: (AudioNode | null | undefined)[]) {
  primary.onended = () => {
    primary.disconnect();
    rest.forEach((n) => n?.disconnect());
  };
}

// A gentle vibrato: one shared LFO per voice, feeding the detune of every
// oscillator passed in. Onset is delayed and faded in, the way a sung note's
// vibrato settles in after the attack rather than starting cold.
function addVibrato(
  context: AudioContext,
  oscillators: OscillatorNode[],
  at: number,
  depthCents: number,
  rateHz: number,
  onsetDelay: number,
): OscillatorNode {
  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = rateHz;
  const depth = context.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.setValueAtTime(0, at + onsetDelay);
  depth.gain.linearRampToValueAtTime(depthCents, at + onsetDelay + 0.15);
  lfo.connect(depth);
  oscillators.forEach((osc) => depth.connect(osc.detune));
  lfo.start(at);
  return lfo;
}

interface FormantPair {
  output: GainNode;
  nodes: AudioNode[];
}

// Two parallel bandpass filters tuned to vowel-like formants, summed into
// one output — this is what gives a buzzy oscillator a human vowel colour
// instead of a flat synth tone.
function formants(context: AudioContext, source: AudioNode, f1: number, f2: number, q1: number, q2: number): FormantPair {
  const output = context.createGain();
  output.gain.value = 1;
  const filter1 = context.createBiquadFilter();
  filter1.type = "bandpass";
  filter1.frequency.value = f1;
  filter1.Q.value = q1;
  const filter2 = context.createBiquadFilter();
  filter2.type = "bandpass";
  filter2.frequency.value = f2;
  filter2.Q.value = q2;
  source.connect(filter1);
  source.connect(filter2);
  filter1.connect(output);
  filter2.connect(output);
  return { output, nodes: [filter1, filter2, output] };
}

// A pair of unison oscillators a few cents apart, mixed together — the
// subtle detune is what makes a single sustained voice sound like it has
// width/chorus to it, rather than being a single perfectly flat tone.
function unison(context: AudioContext, type: OscillatorType, pitch: number, detuneCents: number): { mix: GainNode; oscs: OscillatorNode[] } {
  const osc1 = context.createOscillator();
  osc1.type = type;
  osc1.frequency.value = pitch;
  const osc2 = context.createOscillator();
  osc2.type = type;
  osc2.frequency.value = pitch;
  osc2.detune.value = detuneCents;
  const mix = context.createGain();
  mix.gain.value = 0.5;
  osc1.connect(mix);
  osc2.connect(mix);
  return { mix, oscs: [osc1, osc2] };
}

// --- Prototype-only (C4 pass 3): a small, contained humanization pass on
// exactly two voices (hum, open-ah — see playHum/playOpenAh below) to test
// whether it moves them away from "clean synth tone" and toward "person
// singing" before considering it for the rest of the choir. These two
// helpers are new and are called by nothing else; every other voice's code
// path is untouched. ---

// A quiet, filtered noise bed mixed under a pitched voice. Real singing
// always carries a little breath/aspiration noise alongside the tone; a
// purely tonal oscillator-through-filter voice has none at all, which is
// part of why it reads as clean/synthetic rather than human.
function addBreathBed(
  context: AudioContext,
  at: number,
  centerFreq: number,
  q: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } {
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = centerFreq;
  filter.Q.value = q;
  const gain = context.createGain();
  shapeGain(gain, at, attack, hold, release, peak);
  source.connect(filter);
  filter.connect(gain);
  source.start(at);
  source.stop(at + attack + hold + release + 0.05);
  return { source, filter, gain };
}

// A second, faster/shallower LFO onto detune, independent of and additional
// to the shared addVibrato. Real pitch has small involuntary jitter even
// before deliberate vibrato kicks in; starting from perfectly flat pitch and
// only ever adding one clean, deliberate vibrato is one of the clearest
// "synthesizer" tells versus a person singing.
function addJitter(context: AudioContext, oscillators: OscillatorNode[], at: number, depthCents: number, rateHz: number): OscillatorNode {
  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = rateHz;
  const depth = context.createGain();
  depth.gain.value = depthCents;
  lfo.connect(depth);
  oscillators.forEach((osc) => depth.connect(osc.detune));
  lfo.start(at);
  return lfo;
}

// --- Lower: a deep sung "boom", not a vowel — a quick downward pitch dip
// into a chesty low-passed body. ---
function playBass(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch * 1.5, at);
  osc.frequency.exponentialRampToValueAtTime(pitch, at + 0.11);
  const sub = context.createOscillator();
  sub.type = "triangle";
  sub.frequency.value = pitch;
  sub.detune.value = -8;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  filter.Q.value = 0.7;
  const gain = context.createGain();
  shapeGain(gain, at, 0.008, 0.06, 0.32, 0.9);
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain);
  const lfo = addVibrato(context, [osc, sub], at, 5, 4.5, 0.2);
  const send = connectVoice(gain, 0.1);
  osc.start(at);
  sub.start(at);
  osc.stop(at + 0.5);
  sub.stop(at + 0.5);
  lfo.stop(at + 0.5);
  cleanupOnEnded(osc, filter, gain, send, sub, lfo);
}

// --- Breath/percussion: a noise "puh" pluck with a soft thump underneath
// for body. ---
function playPercussive(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = pitch;
  filter.Q.value = 1.1;
  const thump = context.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(pitch * 1.4, at);
  thump.frequency.exponentialRampToValueAtTime(pitch * 0.8, at + 0.06);
  const mix = context.createGain();
  mix.gain.value = 1;
  filter.connect(mix);
  thump.connect(mix);
  const gain = context.createGain();
  shapeGain(gain, at, 0.002, 0.012, 0.1, 0.75);
  mix.connect(gain);
  const send = connectVoice(gain, 0.08);
  source.connect(filter);
  source.start(at);
  source.stop(at + 0.16);
  thump.start(at);
  thump.stop(at + 0.16);
  cleanupOnEnded(source, filter, thump, mix, gain, send);
}

// --- Breath/percussion: an airy "tss" breath — bandpassed rather than raw
// highpassed noise, so it reads as breath and not as harsh hiss. ---
function playBreathTss(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = Math.max(pitch * 14, 3200);
  filter.Q.value = 0.8;
  const gain = context.createGain();
  shapeGain(gain, at, 0.018, 0.09, 0.2, 0.34);
  source.connect(filter);
  filter.connect(gain);
  const send = connectVoice(gain, 0.2);
  source.start(at);
  source.stop(at + 0.34);
  cleanupOnEnded(source, filter, gain, send);
}

// --- Hum: closed-mouth "mmm" — unison sine pair through a single narrow
// nasal resonance, the way a hum stays fixed around one resonance regardless
// of the note underneath it. ---
function playHum(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const { mix, oscs } = unison(context, "sine", pitch, 5);
  const nasal = context.createBiquadFilter();
  nasal.type = "bandpass";
  nasal.frequency.value = Math.min(pitch * 1.8, 320);
  nasal.Q.value = 4;
  mix.connect(nasal);
  const gain = context.createGain();
  shapeGain(gain, at, 0.03, 0.24, 0.34, 0.5);
  nasal.connect(gain);
  const lfo = addVibrato(context, oscs, at, 6, 4.9, 0.25);
  // Prototype-only (C4 pass 3): a touch of breath noise and pitch jitter,
  // see addBreathBed/addJitter above.
  const jitter = addJitter(context, oscs, at, 2, 7.3);
  const breath = addBreathBed(context, at, Math.max(pitch * 2.2, 450), 0.6, 0.045, 0.05, 0.2, 0.35);
  const breathSend = connectVoice(breath.gain, 0.18);
  const send = connectVoice(gain, 0.15);
  oscs.forEach((o) => o.start(at));
  oscs.forEach((o) => o.stop(at + 0.66));
  lfo.stop(at + 0.66);
  jitter.stop(at + 0.66);
  cleanupOnEnded(oscs[0], oscs[1], lfo, jitter, mix, nasal, gain, send, breath.source, breath.filter, breath.gain, breathSend);
}

// --- Round: open "ah" — unison sawtooth pair through wide-spaced formants
// for an open-throated vowel. ---
function playOpenAh(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const { mix, oscs } = unison(context, "sawtooth", pitch, 9);
  const formant = formants(context, mix, 700, 1150, 6, 7);
  // Prototype-only (C4 pass 3): a third, higher formant for extra vowel
  // presence, summed straight into formant.output (a GainNode sums whatever
  // connects to it) rather than touching the shared two-formant helper.
  const formant3 = context.createBiquadFilter();
  formant3.type = "bandpass";
  formant3.frequency.value = 2700;
  formant3.Q.value = 5;
  mix.connect(formant3);
  const formant3Gain = context.createGain();
  formant3Gain.gain.value = 0.35;
  formant3.connect(formant3Gain);
  formant3Gain.connect(formant.output);
  const gain = context.createGain();
  shapeGain(gain, at, 0.02, 0.16, 0.28, 0.55);
  formant.output.connect(gain);
  const lfo = addVibrato(context, oscs, at, 9, 5.2, 0.14);
  // Prototype-only: breath noise and pitch jitter, see addBreathBed/addJitter.
  const jitter = addJitter(context, oscs, at, 2.4, 6.8);
  const breath = addBreathBed(context, at, Math.max(pitch * 3, 900), 0.55, 0.03, 0.14, 0.24, 0.22);
  const breathSend = connectVoice(breath.gain, 0.2);
  const send = connectVoice(gain, 0.14);
  oscs.forEach((o) => o.start(at));
  oscs.forEach((o) => o.stop(at + 0.55));
  lfo.stop(at + 0.55);
  jitter.stop(at + 0.55);
  cleanupOnEnded(
    oscs[0],
    oscs[1],
    lfo,
    jitter,
    mix,
    gain,
    send,
    ...formant.nodes,
    formant3,
    formant3Gain,
    breath.source,
    breath.filter,
    breath.gain,
    breathSend,
  );
}

// --- Round: rounded "ooh" — unison triangle pair through narrow low
// formants, softer and darker than the open "ah". ---
function playRoundOoh(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const { mix, oscs } = unison(context, "triangle", pitch, 7);
  const formant = formants(context, mix, 350, 800, 5, 5);
  const gain = context.createGain();
  shapeGain(gain, at, 0.03, 0.2, 0.32, 0.5);
  formant.output.connect(gain);
  const lfo = addVibrato(context, oscs, at, 7, 4.7, 0.22);
  const send = connectVoice(gain, 0.16);
  oscs.forEach((o) => o.start(at));
  oscs.forEach((o) => o.stop(at + 0.62));
  lfo.stop(at + 0.62);
  cleanupOnEnded(oscs[0], oscs[1], lfo, mix, gain, send, ...formant.nodes);
}

// --- Bright/high: bright "ee" — unison sawtooth pair with a high, sharp
// second formant for sparkle, and the fastest vibrato onset of the choir. ---
function playBrightEe(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const { mix, oscs } = unison(context, "sawtooth", pitch, 11);
  const formant = formants(context, mix, 350, 2600, 5, 9);
  const gain = context.createGain();
  shapeGain(gain, at, 0.012, 0.1, 0.18, 0.42);
  formant.output.connect(gain);
  const lfo = addVibrato(context, oscs, at, 10, 5.6, 0.1);
  const send = connectVoice(gain, 0.13);
  oscs.forEach((o) => o.start(at));
  oscs.forEach((o) => o.stop(at + 0.36));
  lfo.stop(at + 0.36);
  cleanupOnEnded(oscs[0], oscs[1], lfo, mix, gain, send, ...formant.nodes);
}

// --- Breath/percussion: a breathy "ha" — bandpassed noise with a very soft
// sine undertone underneath, so it reads as a breathed vowel rather than
// pure air. ---
function playSoftAiry(context: AudioContext, pitch: number) {
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = Math.max(pitch * 3, 900);
  filter.Q.value = 0.6;
  const undertone = context.createOscillator();
  undertone.type = "sine";
  undertone.frequency.value = pitch;
  const undertoneGain = context.createGain();
  undertoneGain.gain.value = 0.18;
  undertone.connect(undertoneGain);
  const mix = context.createGain();
  mix.gain.value = 1;
  filter.connect(mix);
  undertoneGain.connect(mix);
  const gain = context.createGain();
  shapeGain(gain, at, 0.05, 0.12, 0.34, 0.22);
  mix.connect(gain);
  const send = connectVoice(gain, 0.22);
  source.connect(filter);
  source.start(at);
  source.stop(at + 0.5);
  undertone.start(at);
  undertone.stop(at + 0.5);
  cleanupOnEnded(source, filter, undertone, undertoneGain, mix, gain, send);
}

// Five named vocal families, each with its own synthesis approach — not
// eight copies of one oscillator at different pitches:
//   Lower             — bass:        deep sine+triangle "boom"
//   Hum               — hum:         closed-mouth "mmm", fixed nasal resonance
//   Round             — open-ah:     open "ah" vowel, wide-spaced formants
//                        round-ooh:  rounded "ooh" vowel, narrow low formants
//   Bright/high       — bright-ee:   bright "ee" vowel, sharp high formant
//   Breath/percussion — percussive:  noise+thump "puh" pluck
//                        breath-tss: airy "tss" breath
//                        soft-airy:  breathy "ha" with a soft vowel undertone
const players: Record<SingerRole, (context: AudioContext, pitch: number) => void> = {
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
// user gesture handler (click/keydown), never at page load. `pitch` comes
// from the singer's own data (a shared chord-friendly scale — see
// singers.ts), not from the role, so two singers with the same role still
// sing different notes.
export function playRole(role: SingerRole, pitch: number): void {
  const context = getContext();
  players[role](context, pitch);
}
