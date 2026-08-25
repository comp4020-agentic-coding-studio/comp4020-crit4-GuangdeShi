import { describe, expect, it } from "vitest";
import { KEY_LAYOUT, KEY_TO_DEF } from "./keyboard.ts";

// The consistency checks a real chromatic keyboard must satisfy: this is
// the "every visible key is playable" guarantee from Section 8/5 of the
// piano-accordion spec, expressed as code instead of a manual visual
// check. KEY_LAYOUT is the single source of truth the DOM, the audio
// engine, and this test all read from -- if it drifts, this fails loudly
// instead of shipping a silent or mislabelled key.

const CHROMATIC_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_PITCH_CLASSES = new Set(["C", "D", "E", "F", "G", "A", "B"]);

function parseNote(note: string): { pitchClass: string; octave: number } {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) throw new Error(`unparseable note name: ${note}`);
  return { pitchClass: match[1], octave: Number(match[2]) };
}

describe("KEY_LAYOUT: chromatic piano-accordion keyboard", () => {
  it("is non-empty", () => {
    expect(KEY_LAYOUT.length).toBeGreaterThan(0);
  });

  it("has no duplicate physical key bindings", () => {
    const keys = KEY_LAYOUT.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate notes", () => {
    const notes = KEY_LAYOUT.map((entry) => entry.note);
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("gives every entry a finite, positive frequency", () => {
    for (const entry of KEY_LAYOUT) {
      expect(Number.isFinite(entry.frequency), `${entry.note} frequency`).toBe(true);
      expect(entry.frequency).toBeGreaterThan(0);
    }
  });

  it("classifies every entry as white/black to match real piano geometry (no black key between E-F or B-C)", () => {
    for (const entry of KEY_LAYOUT) {
      const { pitchClass } = parseNote(entry.note);
      const expectedType = WHITE_PITCH_CLASSES.has(pitchClass) ? "white" : "black";
      expect(entry.type, `${entry.note} (${entry.key}) should be ${expectedType}`).toBe(expectedType);
    }
  });

  it("gives every black key an offset, and no white key one", () => {
    for (const entry of KEY_LAYOUT) {
      if (entry.type === "black") {
        expect(entry.offsetPercent, `${entry.note} (${entry.key}) is black but has no offsetPercent`).toBeTypeOf(
          "number",
        );
      } else {
        expect(entry.offsetPercent, `${entry.note} (${entry.key}) is white but has an offsetPercent`).toBeUndefined();
      }
    }
  });

  it("has exactly two full chromatic octaves plus a closing C (15 white, 10 black)", () => {
    const whiteCount = KEY_LAYOUT.filter((entry) => entry.type === "white").length;
    const blackCount = KEY_LAYOUT.filter((entry) => entry.type === "black").length;
    expect(whiteCount).toBe(15);
    expect(blackCount).toBe(10);
  });

  it("ascends in strict chromatic order with no gaps, from C3", () => {
    let expectedIndex = CHROMATIC_PITCH_CLASSES.indexOf("C");
    let expectedOctave = 3;
    for (const entry of KEY_LAYOUT) {
      const { pitchClass, octave } = parseNote(entry.note);
      expect(pitchClass, `expected ${CHROMATIC_PITCH_CLASSES[expectedIndex]}, got ${entry.note}`).toBe(
        CHROMATIC_PITCH_CLASSES[expectedIndex],
      );
      expect(octave, `expected octave ${expectedOctave}, got ${entry.note}`).toBe(expectedOctave);
      expectedIndex = (expectedIndex + 1) % CHROMATIC_PITCH_CLASSES.length;
      if (expectedIndex === 0) expectedOctave += 1;
    }
  });

  it("has strictly increasing frequency across the full layout", () => {
    for (let i = 1; i < KEY_LAYOUT.length; i++) {
      expect(KEY_LAYOUT[i].frequency).toBeGreaterThan(KEY_LAYOUT[i - 1].frequency);
    }
  });
});

describe("KEY_TO_DEF: audio lookup mirrors the visual layout exactly", () => {
  it("has one entry per KEY_LAYOUT entry -- no visual key without an audio mapping", () => {
    expect(KEY_TO_DEF.size).toBe(KEY_LAYOUT.length);
  });

  it("resolves every physical key to the same note/frequency KEY_LAYOUT declares", () => {
    for (const entry of KEY_LAYOUT) {
      const def = KEY_TO_DEF.get(entry.key);
      expect(def, `no KEY_TO_DEF entry for "${entry.key}"`).toBeDefined();
      expect(def!.note).toBe(entry.note);
      expect(def!.frequency).toBe(entry.frequency);
    }
  });
});
