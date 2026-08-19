import type { DrumId } from "./drum-audio";
import { playDrum } from "./drum-audio";

const stage = document.querySelector<HTMLElement>("#stage");

// Every drum's keyboard mapping, keyed by event.key (space is stored as
// "Space" in the markup and normalised to " " below to match the real key).
const drumsByKey = new Map<string, HTMLElement>();
document.querySelectorAll<HTMLElement>(".drum").forEach((el) => {
  const keys = el.dataset.key?.split(",") ?? [];
  for (const key of keys) {
    drumsByKey.set(key === "Space" ? " " : key, el);
  }
});

// Retriggering mid-animation forces a reflow so the CSS animation restarts
// from frame zero instead of being ignored --- rapid repeated hits (fast
// clicking, quick alternating keys) each look like a fresh hit.
function flashVisual(id: DrumId): void {
  const drum = document.querySelector<HTMLElement>(`.drum[data-drum="${id}"]`);
  if (!drum) return;
  drum.classList.remove("is-hit");
  void drum.offsetWidth;
  drum.classList.add("is-hit");
}

// The single entry point for "this drum was hit directly" --- sound and
// visual reaction fire from the same gesture, at the lowest latency the
// Web Audio API allows (no scheduling delay). This is also where the
// AudioContext gets created, on the very first hit of a session.
function hit(id: DrumId): void {
  playDrum(id);
  flashVisual(id);
}

stage?.addEventListener("click", (event) => {
  const drum = (event.target as HTMLElement).closest<HTMLElement>(".drum");
  if (drum?.dataset.drum) hit(drum.dataset.drum as DrumId);
});

stage?.addEventListener("animationend", (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("drum-fig")) {
    target.closest(".drum")?.classList.remove("is-hit");
  }
});

// Global, not per-button: a drum sounds when its key is pressed regardless
// of focus, and several keys held at once each drive their own drum
// independently. event.repeat is ignored so holding a key down doesn't turn
// into an uncontrolled, OS-repeat-rate machine-gun roll --- each physical
// key press is one deliberate hit; sustained rolls are what the rhythm
// dials are for.
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const drum = drumsByKey.get(key === " " ? " " : key);
  if (drum?.dataset.drum) {
    event.preventDefault();
    hit(drum.dataset.drum as DrumId);
  }
});
