import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { KEY_LAYOUT, renderKeyboard } from "../keyboard.ts";

// C4 "An instrument" — the mechanically-checkable lines of the published spec
// (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/).
// Lines a person has to judge (does it feel discoverable, does it sound good,
// is it expressive) are left to the crit — see spec/README.md.
const DIST = resolve("dist");
const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

describe("C4: the browser is the instrument", () => {
  it("ships no prerecorded audio samples", () => {
    // "sound is made live in the page by the player, not played back" — so no
    // bundled sample files for V1, and no <audio>/<video> with a source.
    const audioExt = /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i;
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      });
    }
    const shipped = files(DIST);
    expect(shipped.filter((f) => audioExt.test(f))).toEqual([]);
    expect(doc.querySelectorAll("audio[src], video[src]")).toHaveLength(0);
  });

  it("has no score, health, or win/fail state markup", () => {
    // "there is no way to play it wrong — no score, no fail state"
    const text = doc.body.textContent?.toLowerCase() ?? "";
    for (const forbidden of ["score:", "game over", "you win", "you lose", "health:"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("ships the bellows and keyboard mount points a stranger's browser will render into", () => {
    // The keys/bellows themselves are built at runtime by renderKeyboard() (see
    // keyboard.test.ts / below), not baked into the static page — but the mount
    // points main.ts writes into must already exist in the shipped HTML.
    for (const id of ["accordion", "bellows", "keyboard", "white-row", "black-row", "mode-status"]) {
      expect(doc.getElementById(id), `#${id} missing from shipped index.html`).not.toBeNull();
    }
  });
});

describe("C4: every chromatic key, keyboard/mouse/touch playable", () => {
  it("renders exactly one button per KEY_LAYOUT entry, each keyboard-focusable and clickable", () => {
    // renderKeyboard is the single place that turns KEY_LAYOUT into DOM — this
    // exercises it directly (keyboard.test.ts already covers KEY_LAYOUT's own
    // musical consistency) to guarantee every visible key is a real <button>:
    // focusable, Enter/Space-activatable, and clickable/tappable by construction.
    // renderKeyboard calls the ambient `document`, which this test file's node
    // environment doesn't provide by default, so point it at a scratch JSDOM.
    const scratch = new JSDOM("<!doctype html><html><body></body></html>").window.document;
    const previousDocument = (globalThis as { document?: Document }).document;
    (globalThis as { document?: Document }).document = scratch;
    let whiteRow: HTMLElement, blackRow: HTMLElement;
    try {
      whiteRow = scratch.createElement("div");
      blackRow = scratch.createElement("div");
      renderKeyboard(whiteRow, blackRow);
    } finally {
      (globalThis as { document?: Document }).document = previousDocument;
    }
    const keys = [...whiteRow.querySelectorAll("button.key"), ...blackRow.querySelectorAll("button.key")];
    expect(keys).toHaveLength(KEY_LAYOUT.length);
    const renderedKeyAttrs = keys.map((el) => (el as HTMLElement).dataset.key).sort();
    expect(renderedKeyAttrs).toEqual(KEY_LAYOUT.map((entry) => entry.key).sort());
    for (const el of keys) {
      expect(el.tagName, `key "${(el as HTMLElement).dataset.key}" must be a real <button>`).toBe("BUTTON");
    }
  });
});
