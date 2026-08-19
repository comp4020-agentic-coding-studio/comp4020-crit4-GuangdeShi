const stage = document.querySelector<HTMLElement>("#stage");
const hammer = document.querySelector<HTMLElement>("#hammer");

// The hammer cursor only makes sense for a real pointer; touch and coarse
// pointers keep their native behaviour (there's nothing to follow).
const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (stage && hammer && hasFinePointer) {
  stage.classList.add("has-hammer-cursor");
  stage.addEventListener("pointermove", (event) => {
    hammer.style.left = `${event.clientX}px`;
    hammer.style.top = `${event.clientY}px`;
  });
  stage.addEventListener("pointerenter", () => hammer.classList.add("visible"));
  stage.addEventListener("pointerleave", () => hammer.classList.remove("visible"));
}

// Every singer's keyboard mapping, keyed exactly as it appears in data-key
// (so "A".."Z" and ";" all match event.key without further normalising).
const singersByKey = new Map<string, HTMLElement>();
document.querySelectorAll<HTMLElement>(".singer").forEach((el) => {
  const key = el.dataset.key;
  if (key) singersByKey.set(key, el);
});

// Retriggering mid-animation forces a reflow so the CSS animation restarts
// from frame zero instead of being ignored — this is what makes rapid
// repeated hits (holding a key, clicking fast) look like a fresh bonk each
// time rather than a single animation that can't be interrupted.
function triggerBonk(singer: HTMLElement) {
  singer.classList.remove("is-hit");
  void singer.offsetWidth;
  singer.classList.add("is-hit");
}

stage?.addEventListener("click", (event) => {
  const singer = (event.target as HTMLElement).closest<HTMLElement>(".singer");
  if (singer) triggerBonk(singer);
});

// The animation lives on the inner .singer-fig; listen there and clear the
// state on the outer button once it finishes.
stage?.addEventListener("animationend", (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("singer-fig")) {
    target.closest(".singer")?.classList.remove("is-hit");
  }
});

// Global, not per-button: a singer sings when its letter is pressed
// regardless of focus, and holding or rapid-repeating a key keeps
// retriggering it — multiple keys held at once each drive their own singer
// independently, so several can sound together.
window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const singer = singersByKey.get(key);
  if (singer) triggerBonk(singer);
});
