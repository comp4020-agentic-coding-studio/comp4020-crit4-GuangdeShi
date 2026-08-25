// Physical-keyboard -> melody-key mapping.
//
// Two full chromatic octaves (C3-C5, 25 notes), spread across three rows the
// way a real virtual-piano-on-a-QWERTY-keyboard convention does: the lower
// letter row and home row carry the white (diatonic) keys of the two
// octaves, and the row above -- QWERTYUIOP -- carries all ten black
// (sharp) keys, each one sitting above the gap between its two neighbouring
// white keys, same as a real keyboard. A stranger can still find a
// recognisable run of white notes under each hand, with the full chromatic
// set available via the row above.

export interface KeyDefinition {
  note: string;
  frequency: number;
}

export interface KeyLayoutEntry extends KeyDefinition {
  key: string;
  type: "white" | "black";
  /** Black keys only: left offset (%) within the keyboard, centred over the white-key gap it sits above. */
  offsetPercent?: number;
}

const A4 = 440;

// Equal temperament relative to A4, by semitone offset.
function noteFrequency(semitonesFromA4: number): number {
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}

const WHITE_COUNT = 15; // C3..C5 inclusive, two octaves
const WHITE_WIDTH_PERCENT = 100 / WHITE_COUNT;
const BLACK_WIDTH_PERCENT = 4.4;

// `whiteIndex` is the 0-based position (within the full 15-key white row)
// of the white key immediately *before* this black key.
function blackOffset(whiteIndex: number): number {
  return Number(((whiteIndex + 1) * WHITE_WIDTH_PERCENT - BLACK_WIDTH_PERCENT / 2).toFixed(2));
}

export const KEY_LAYOUT: KeyLayoutEntry[] = [
  // Octave 3 -- lower letter row (white) + upper row (black)
  { key: "z", note: "C3", frequency: noteFrequency(-21), type: "white" },
  { key: "q", note: "C#3", frequency: noteFrequency(-20), type: "black", offsetPercent: blackOffset(0) },
  { key: "x", note: "D3", frequency: noteFrequency(-19), type: "white" },
  { key: "w", note: "D#3", frequency: noteFrequency(-18), type: "black", offsetPercent: blackOffset(1) },
  { key: "c", note: "E3", frequency: noteFrequency(-17), type: "white" },
  { key: "v", note: "F3", frequency: noteFrequency(-16), type: "white" },
  { key: "e", note: "F#3", frequency: noteFrequency(-15), type: "black", offsetPercent: blackOffset(3) },
  { key: "b", note: "G3", frequency: noteFrequency(-14), type: "white" },
  { key: "r", note: "G#3", frequency: noteFrequency(-13), type: "black", offsetPercent: blackOffset(4) },
  { key: "n", note: "A3", frequency: noteFrequency(-12), type: "white" },
  { key: "t", note: "A#3", frequency: noteFrequency(-11), type: "black", offsetPercent: blackOffset(5) },
  { key: "m", note: "B3", frequency: noteFrequency(-10), type: "white" },

  // Octave 4 (+C5) -- home row (white) + upper row (black)
  { key: "a", note: "C4", frequency: noteFrequency(-9), type: "white" },
  { key: "y", note: "C#4", frequency: noteFrequency(-8), type: "black", offsetPercent: blackOffset(7) },
  { key: "s", note: "D4", frequency: noteFrequency(-7), type: "white" },
  { key: "u", note: "D#4", frequency: noteFrequency(-6), type: "black", offsetPercent: blackOffset(8) },
  { key: "d", note: "E4", frequency: noteFrequency(-5), type: "white" },
  { key: "f", note: "F4", frequency: noteFrequency(-4), type: "white" },
  { key: "i", note: "F#4", frequency: noteFrequency(-3), type: "black", offsetPercent: blackOffset(10) },
  { key: "g", note: "G4", frequency: noteFrequency(-2), type: "white" },
  { key: "o", note: "G#4", frequency: noteFrequency(-1), type: "black", offsetPercent: blackOffset(11) },
  { key: "h", note: "A4", frequency: noteFrequency(0), type: "white" },
  { key: "p", note: "A#4", frequency: noteFrequency(1), type: "black", offsetPercent: blackOffset(12) },
  { key: "j", note: "B4", frequency: noteFrequency(2), type: "white" },
  { key: "k", note: "C5", frequency: noteFrequency(3), type: "white" },
];

export const KEY_TO_DEF = new Map(KEY_LAYOUT.map(({ key, note, frequency }) => [key, { note, frequency }]));

/** Builds the keyboard's DOM (white + black key buttons) from KEY_LAYOUT, so the markup can never drift out of sync with the mapping. */
export function renderKeyboard(whiteRow: HTMLElement, blackRow: HTMLElement): void {
  for (const entry of KEY_LAYOUT) {
    const button = document.createElement("button");
    button.className = `key ${entry.type}`;
    button.dataset.key = entry.key;
    button.textContent = entry.key.toUpperCase();
    if (entry.type === "black") {
      button.style.setProperty("--offset", `${entry.offsetPercent}%`);
      blackRow.appendChild(button);
    } else {
      whiteRow.appendChild(button);
    }
  }
}
