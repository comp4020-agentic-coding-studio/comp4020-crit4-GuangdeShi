// Drives the accordion's visual bellows and key-press feedback from live
// state. The bellows visual is a *readout* of the physical lid (angle +
// bellows pressure) -- nothing here is itself an input.

const ANGLE_MIN_DEG = 80;
const ANGLE_MAX_DEG = 135;
// Widened from an earlier 100-340px range: the bellows is meant to be the
// instrument's visual heart (the "physical MacBook screen IS the bellows"),
// so it should read as unmistakably the dominant element even at rest, and
// swing through a much larger range as the lid actually opens/closes.
// Exported so drag-bellows.ts's pointer-drag fallback clamps its own
// synthetic extent to the exact same visual range, rather than a second,
// independently-drifting pair of numbers.
export const BELLOWS_MIN_PX = 140;
export const BELLOWS_MAX_PX = 460;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export class AccordionVisuals {
  #accordionEl: HTMLElement;
  #bellowsEl: HTMLElement;
  #keyEls: Map<string, HTMLElement>;

  constructor(root: ParentNode) {
    this.#accordionEl = root.querySelector<HTMLElement>("#accordion")!;
    this.#bellowsEl = root.querySelector<HTMLElement>("#bellows")!;
    this.#keyEls = new Map(
      Array.from(root.querySelectorAll<HTMLElement>(".key")).map((el) => [el.dataset.key!, el]),
    );
  }

  setAngle(angleDeg: number): void {
    const t = clamp01((angleDeg - ANGLE_MIN_DEG) / (ANGLE_MAX_DEG - ANGLE_MIN_DEG));
    this.setExtentPx(BELLOWS_MIN_PX + t * (BELLOWS_MAX_PX - BELLOWS_MIN_PX));
  }

  /**
   * Sets the bellows visual's extent directly, in pixels. `setAngle` (the
   * physical-lid path) is just one caller of this; the pointer-drag
   * fallback in main.ts drives the same property straight from
   * DragBellows's own tracked extent, since there's no lid angle to read.
   */
  setExtentPx(px: number): void {
    this.#bellowsEl.style.setProperty("--bellows-extent", `${px.toFixed(1)}px`);
  }

  setBellows(pressure: number, direction: -1 | 0 | 1): void {
    this.#bellowsEl.style.setProperty("--bellows-pressure", pressure.toFixed(3));
    this.#accordionEl.dataset.direction = direction === 1 ? "pull" : direction === -1 ? "push" : "rest";
  }

  setKeyPressed(key: string, pressed: boolean): void {
    this.#keyEls.get(key)?.classList.toggle("active", pressed);
  }

  /** Every key element, for wiring pointer/touch play alongside the physical keyboard. */
  get keyElements(): Map<string, HTMLElement> {
    return this.#keyEls;
  }
}
