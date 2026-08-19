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
