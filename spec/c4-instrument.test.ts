import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// C4 "An instrument" — the mechanically-checkable lines of the published spec
// (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/).
// Lines a person has to judge (does it feel discoverable, does it sound good,
// is it expressive) are left to the crit — see spec/README.md.
const DIST = resolve("dist");
const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

const KEYS = ["A", "S", "D", "F", "J", "K", "L", ";"];

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

describe("C4: eight singers, each keyboard-playable", () => {
  it("shows exactly one large keyboard letter per singer, matching the suggested mapping", () => {
    const chestLetters = Array.from(doc.querySelectorAll<HTMLElement>("[data-key]"))
      .map((el) => el.dataset.key)
      .filter(Boolean);
    expect(chestLetters.sort()).toEqual([...KEYS].sort());
  });

  it("marks every singer as a keyboard focusable, clickable control", () => {
    const singers = doc.querySelectorAll<HTMLElement>("[data-key]");
    expect(singers.length).toBeGreaterThan(0);
    for (const singer of singers) {
      expect(
        singer.getAttribute("role") === "button" || singer.tagName === "BUTTON",
        `singer for key "${singer.dataset.key}" needs a button role so a screen reader and keyboard user can find it`,
      ).toBe(true);
    }
  });
});
