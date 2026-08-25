// Physical-keyboard -> melody-key mapping.
//
// A-K is the diatonic "white key" row (C4 major scale). W/E/T/Y/U sit
// above the row the way black keys sit above white keys on a real
// keyboard, and fill in the chromatic notes -- so a stranger who knows
// nothing about the mapping can still find a recognisable row of notes
// under their left hand, with optional sharps for chords/melody colour.

export interface KeyDefinition {
  note: string;
  frequency: number;
}

const A4 = 440;

// Equal temperament relative to A4, by semitone offset.
function noteFrequency(semitonesFromA4: number): number {
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}

export const KEY_LAYOUT: Array<{ key: string } & KeyDefinition> = [
  { key: "a", note: "C4", frequency: noteFrequency(-9) },
  { key: "s", note: "D4", frequency: noteFrequency(-7) },
  { key: "d", note: "E4", frequency: noteFrequency(-5) },
  { key: "f", note: "F4", frequency: noteFrequency(-4) },
  { key: "g", note: "G4", frequency: noteFrequency(-2) },
  { key: "h", note: "A4", frequency: noteFrequency(0) },
  { key: "j", note: "B4", frequency: noteFrequency(2) },
  { key: "k", note: "C5", frequency: noteFrequency(3) },
  { key: "w", note: "C#4", frequency: noteFrequency(-8) },
  { key: "e", note: "D#4", frequency: noteFrequency(-6) },
  { key: "t", note: "F#4", frequency: noteFrequency(-3) },
  { key: "y", note: "G#4", frequency: noteFrequency(-1) },
  { key: "u", note: "A#4", frequency: noteFrequency(1) },
];

export const KEY_TO_DEF = new Map(KEY_LAYOUT.map(({ key, note, frequency }) => [key, { note, frequency }]));
