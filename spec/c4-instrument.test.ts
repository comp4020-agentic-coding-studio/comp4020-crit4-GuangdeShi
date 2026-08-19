import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// C4 "An instrument" — the mechanically-checkable lines of the published spec
// (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/).
// Lines a person has to judge (does it feel discoverable, does it sound good,
// is it expressive) are left to the crit — see spec/README.md.
//
// This file covers Plan B, "Bash Kit" (branch plan-b-drums): a playable
// drum kit, not the Plan A choir on main. The drum set differs from the
// choir's sixteen singers, so the contract below is this instrument's own.
const DIST = resolve("dist");
const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

const DRUM_IDS = [
  "kick",
  "snare",
  "hihat-closed",
  "hihat-open",
  "tom-high",
  "tom-mid",
  "tom-floor",
  "crash",
  "ride",
];

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
});

describe("C4: a drum kit, every drum keyboard-playable", () => {
  it("has every required drum, each with a keyboard mapping shown on the drum", () => {
    const drums = Array.from(doc.querySelectorAll<HTMLElement>("[data-drum]"));
    const ids = drums.map((el) => el.dataset.drum).filter(Boolean);
    expect(ids.sort()).toEqual([...DRUM_IDS].sort());
    for (const drum of drums) {
      expect(drum.dataset.key, `drum "${drum.dataset.drum}" needs a keyboard mapping`).toBeTruthy();
    }
  });

  it("marks every drum as a keyboard focusable, clickable control", () => {
    const drums = doc.querySelectorAll<HTMLElement>("[data-drum]");
    expect(drums.length).toBeGreaterThan(0);
    for (const drum of drums) {
      expect(
        drum.tagName === "BUTTON" || drum.getAttribute("role") === "button",
        `drum "${drum.dataset.drum}" needs a button (or role="button") so a screen reader and keyboard user can find it`,
      ).toBe(true);
    }
  });
});

describe("C4: kick, snare, and hi-hat can loop on a shared clock", () => {
  it("gives exactly kick, snare, and hihat-closed a rhythm dial with real buttons", () => {
    const dials = Array.from(doc.querySelectorAll<HTMLElement>(".rhythm-dial"));
    const targets = dials.map((el) => el.dataset.target).filter(Boolean);
    expect(targets.sort()).toEqual(["hihat-closed", "kick", "snare"].sort());
    for (const dial of dials) {
      const buttons = Array.from(dial.querySelectorAll<HTMLElement>("button[data-subdivision]"));
      expect(buttons.length).toBeGreaterThanOrEqual(4);
      expect(buttons.some((b) => b.dataset.subdivision === "off")).toBe(true);
    }
  });
});
