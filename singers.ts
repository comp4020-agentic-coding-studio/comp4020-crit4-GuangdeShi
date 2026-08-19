// Config + SVG rendering for the choir members. Kept separate from main.ts
// so the interaction/audio wiring doesn't have to wade through markup strings.

export type SingerRole =
  | "bass"
  | "percussive"
  | "breath-tss"
  | "hum"
  | "open-ah"
  | "round-ooh"
  | "bright-ee"
  | "soft-airy";

export interface Singer {
  key: string;
  role: SingerRole;
  label: string; // human-readable role, used in the aria-label
  row: "back" | "middle" | "front";
  x: number; // percent, left position of the singer's center
  // Hz, drawn from a shared C-major-pentatonic scale (C D E G A across
  // octaves) — every singer sits on a scale tone, so any combination that
  // sounds together is consonant by construction. See audio.ts.
  pitch: number;
  skin: string;
  hair: string;
  clothing: string;
  clothingAccent: string;
  faceShape: "round" | "square" | "oval" | "heart" | "long";
  headRx: number;
  headRy: number;
  hairStyle:
    | "buzz"
    | "mohawk"
    | "long-straight"
    | "bun"
    | "afro"
    | "bob"
    | "ponytail"
    | "pigtails"
    | "flat-top"
    | "twin-buns";
  mouthIdle: string; // path 'd', small/closed per the idle spec
  eyeRx: number;
  eyeRy: number;
  clothingStyle: "crewneck" | "hoodie" | "turtleneck" | "cardigan-v" | "striped" | "v-sweater" | "collared" | "open-cardigan";
}

// Three staggered depth rows (back/middle/front). Row height and vertical
// offset are chosen so a row's chest-letter zone (near the bottom of each
// figure) never falls inside the row in front of it — that's the lesson from
// the V1 occlusion bug (2cdf745), generalised: separate rows by enough
// vertical space that head-vs-label collisions can't happen, then let
// same-row neighbours sit close/slightly overlapping for a crowded feel.
export const SINGERS: Singer[] = [
  {
    key: "Q",
    role: "bass",
    label: "bass, a low boom",
    row: "back",
    x: 10,
    pitch: 65.41,
    skin: "#e8b48a",
    hair: "#2b2118",
    clothing: "#2f3b52",
    clothingAccent: "#1f2839",
    faceShape: "round",
    headRx: 46,
    headRy: 44,
    hairStyle: "buzz",
    mouthIdle: "M90,105 Q110,112 130,105",
    eyeRx: 7,
    eyeRy: 7.5,
    clothingStyle: "crewneck",
  },
  {
    key: "W",
    role: "percussive",
    label: "a percussive puh",
    row: "middle",
    x: 1,
    pitch: 146.83,
    skin: "#c98a5e",
    hair: "#caa23a",
    clothing: "#6f5aa8",
    clothingAccent: "#503f80",
    faceShape: "oval",
    headRx: 37,
    headRy: 48,
    hairStyle: "bob",
    mouthIdle: "M94,103 Q110,99 126,103",
    eyeRx: 6,
    eyeRy: 6,
    clothingStyle: "v-sweater",
  },
  {
    key: "E",
    role: "breath-tss",
    label: "a soft tss breath",
    row: "back",
    x: 28,
    pitch: 196.0,
    skin: "#f0c9a0",
    hair: "#5b4636",
    clothing: "#e2453f",
    clothingAccent: "#a52f2a",
    faceShape: "square",
    headRx: 38,
    headRy: 38,
    hairStyle: "mohawk",
    mouthIdle: "M96,107 Q110,105 124,107",
    eyeRx: 6,
    eyeRy: 6.5,
    clothingStyle: "hoodie",
  },
  {
    key: "R",
    role: "hum",
    label: "a warm mmm hum",
    row: "middle",
    x: 19,
    pitch: 164.81,
    skin: "#8a5a3f",
    hair: "#c9a227",
    clothing: "#fdf6e3",
    clothingAccent: "#d68a3c",
    faceShape: "heart",
    headRx: 44,
    headRy: 46,
    hairStyle: "ponytail",
    mouthIdle: "M92,107 Q110,115 128,107",
    eyeRx: 6.5,
    eyeRy: 6,
    clothingStyle: "collared",
  },
  {
    key: "T",
    role: "open-ah",
    label: "an open ah tone",
    row: "back",
    x: 46,
    pitch: 261.63,
    skin: "#7a4a2d",
    hair: "#151015",
    clothing: "#7d8fa3",
    clothingAccent: "#5c6b7c",
    faceShape: "oval",
    headRx: 37,
    headRy: 50,
    hairStyle: "long-straight",
    mouthIdle: "M88,106 Q110,117 132,106",
    eyeRx: 8,
    eyeRy: 7,
    clothingStyle: "turtleneck",
  },
  {
    key: "Y",
    role: "round-ooh",
    label: "a round ooh tone",
    row: "middle",
    x: 37,
    pitch: 293.66,
    skin: "#e8b48a",
    hair: "#4a3020",
    clothing: "#a9c9d6",
    clothingAccent: "#87acbb",
    faceShape: "long",
    headRx: 33,
    headRy: 54,
    hairStyle: "pigtails",
    mouthIdle: "M103,108 a7,6 0 1,0 14,0 a7,6 0 1,0 -14,0",
    eyeRx: 6,
    eyeRy: 6.5,
    clothingStyle: "open-cardigan",
  },
  {
    key: "U",
    role: "bright-ee",
    label: "a bright ee tone",
    row: "back",
    x: 64,
    pitch: 659.25,
    skin: "#f0c9a0",
    hair: "#241c14",
    clothing: "#f6e8ee",
    clothingAccent: "#c97f22",
    faceShape: "heart",
    headRx: 42,
    headRy: 48,
    hairStyle: "bun",
    mouthIdle: "M90,103 Q110,113 130,103",
    eyeRx: 6.5,
    eyeRy: 7,
    clothingStyle: "cardigan-v",
  },
  {
    key: "I",
    role: "soft-airy",
    label: "a soft, airy breath",
    row: "middle",
    x: 55,
    pitch: 392.0,
    skin: "#d9a066",
    hair: "#8a8a8a",
    clothing: "#2f6b52",
    clothingAccent: "#1f4a39",
    faceShape: "round",
    headRx: 43,
    headRy: 41,
    hairStyle: "flat-top",
    mouthIdle: "M99,106 Q110,108 121,106",
    eyeRx: 7,
    eyeRy: 7,
    clothingStyle: "crewneck",
  },
  {
    key: "A",
    role: "bass",
    label: "bass, a low boom",
    row: "back",
    x: 82,
    pitch: 98.0,
    skin: "#4a2f1f",
    hair: "#6b2e20",
    clothing: "#e8d84a",
    clothingAccent: "#c2ab2e",
    faceShape: "long",
    headRx: 34,
    headRy: 52,
    hairStyle: "afro",
    mouthIdle: "M91,108 Q110,114 129,108",
    eyeRx: 6,
    eyeRy: 6.5,
    clothingStyle: "striped",
  },
  {
    key: "S",
    role: "percussive",
    label: "a percussive puh",
    row: "middle",
    x: 73,
    pitch: 220.0,
    skin: "#f5d7b5",
    hair: "#100c0a",
    clothing: "#3fae7a",
    clothingAccent: "#2c7d57",
    faceShape: "square",
    headRx: 39,
    headRy: 39,
    hairStyle: "twin-buns",
    mouthIdle: "M95,105 Q110,101 125,105",
    eyeRx: 6,
    eyeRy: 6.5,
    clothingStyle: "hoodie",
  },
  {
    key: "D",
    role: "breath-tss",
    label: "a soft tss breath",
    row: "front",
    x: 10,
    pitch: 293.66,
    skin: "#e8b48a",
    hair: "#2b2118",
    clothing: "#dbe8f6",
    clothingAccent: "#5a7ab0",
    faceShape: "heart",
    headRx: 46,
    headRy: 48,
    hairStyle: "mohawk",
    mouthIdle: "M97,109 Q110,107 123,109",
    eyeRx: 7,
    eyeRy: 7.5,
    clothingStyle: "cardigan-v",
  },
  {
    key: "F",
    role: "hum",
    label: "a warm mmm hum",
    row: "middle",
    x: 91,
    pitch: 220.0,
    skin: "#c98a5e",
    hair: "#6b2e20",
    clothing: "#b06a8a",
    clothingAccent: "#8a4a6b",
    faceShape: "heart",
    headRx: 41,
    headRy: 44,
    hairStyle: "buzz",
    mouthIdle: "M93,110 Q110,116 127,110",
    eyeRx: 6.5,
    eyeRy: 6,
    clothingStyle: "turtleneck",
  },
  {
    key: "G",
    role: "open-ah",
    label: "an open ah tone",
    row: "front",
    x: 28,
    pitch: 392.0,
    skin: "#8a5a3f",
    hair: "#151015",
    clothing: "#e26b6b",
    clothingAccent: "#a54a4a",
    faceShape: "round",
    headRx: 49,
    headRy: 46,
    hairStyle: "long-straight",
    mouthIdle: "M89,109 Q110,118 131,109",
    eyeRx: 8,
    eyeRy: 8,
    clothingStyle: "striped",
  },
  {
    key: "H",
    role: "round-ooh",
    label: "a round ooh tone",
    row: "front",
    x: 46,
    pitch: 440.0,
    skin: "#7a4a2d",
    hair: "#caa23a",
    clothing: "#4a7ab0",
    clothingAccent: "#33587f",
    faceShape: "square",
    headRx: 41,
    headRy: 40,
    hairStyle: "bun",
    mouthIdle: "M103,109 a6.5,5.5 0 1,0 13,0 a6.5,5.5 0 1,0 -13,0",
    eyeRx: 6.5,
    eyeRy: 7,
    clothingStyle: "v-sweater",
  },
  {
    key: "J",
    role: "bright-ee",
    label: "a bright ee tone",
    row: "front",
    x: 64,
    pitch: 880.0,
    skin: "#f0c9a0",
    hair: "#241c14",
    clothing: "#fdf6e3",
    clothingAccent: "#c9722a",
    faceShape: "long",
    headRx: 36,
    headRy: 53,
    hairStyle: "afro",
    mouthIdle: "M91,106 Q110,116 129,106",
    eyeRx: 7,
    eyeRy: 7.5,
    clothingStyle: "collared",
  },
  {
    key: "K",
    role: "soft-airy",
    label: "a soft, airy breath",
    row: "front",
    x: 82,
    pitch: 587.33,
    skin: "#d9a066",
    hair: "#4a3020",
    clothing: "#cbb8e0",
    clothingAccent: "#9a82c2",
    faceShape: "oval",
    headRx: 38,
    headRy: 49,
    hairStyle: "bob",
    mouthIdle: "M99,109 Q110,111 121,109",
    eyeRx: 6,
    eyeRy: 6,
    clothingStyle: "open-cardigan",
  },
];

const TORSO_D = "M36,262 L36,192 C36,150 68,130 110,130 C152,130 184,150 184,192 L184,262 Z";

function hairBack(s: Singer): string {
  switch (s.hairStyle) {
    case "long-straight":
      return `<path d="M60,92 C56,38 84,18 110,18 C136,18 164,38 160,92 L160,176 L150,176 L150,102 C150,62 132,36 110,36 C88,36 70,62 70,102 L70,176 L60,176 Z" fill="${s.hair}"/>`;
    case "bob":
      return `<path d="M62,82 C58,28 84,12 110,12 C136,12 162,28 158,82 C158,114 151,133 140,140 L140,92 C140,60 128,38 110,38 C92,38 80,60 80,92 L80,140 C69,133 62,114 62,82 Z" fill="${s.hair}"/>`;
    case "ponytail":
      return `<path d="M152,38 C174,48 182,82 172,114 C167,129 158,132 152,123 C161,98 158,64 142,44 Z" fill="${s.hair}"/>`;
    default:
      return "";
  }
}

function hairFront(s: Singer): string {
  switch (s.hairStyle) {
    case "buzz":
      return `<path d="M66,58 A44,42 0 0 1 154,58 L154,40 A44,46 0 0 0 66,40 Z" fill="${s.hair}"/>`;
    case "mohawk":
      return `
        <path d="M99,38 L103,6 L110,38 Z" fill="${s.hair}"/>
        <path d="M108,36 L112,2 L118,36 Z" fill="${s.hair}"/>
        <path d="M116,38 L120,6 L127,38 Z" fill="${s.hair}"/>`;
    case "long-straight":
      return `<path d="M66,58 A44,42 0 0 1 154,58 L154,44 A44,44 0 0 0 66,44 Z" fill="${s.hair}"/>`;
    case "bun":
      return `
        <path d="M66,56 A44,40 0 0 1 154,56 L154,38 A44,44 0 0 0 66,38 Z" fill="${s.hair}"/>
        <circle cx="110" cy="20" r="13" fill="${s.hair}"/>`;
    case "afro": {
      const dots = [
        [58, 55], [66, 32], [82, 16], [104, 8], [116, 8], [138, 16], [154, 32], [162, 55],
        [70, 68], [150, 68], [88, 12], [132, 12],
      ];
      return dots.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="15" fill="${s.hair}"/>`).join("");
    }
    case "bob":
      return `<path d="M64,56 A46,42 0 0 1 156,56 L156,40 A46,44 0 0 0 64,40 Z" fill="${s.hair}"/>`;
    case "ponytail":
      return `<path d="M66,56 A44,40 0 0 1 154,56 L154,38 A44,44 0 0 0 66,38 Z" fill="${s.hair}"/>`;
    case "pigtails":
      return `
        <path d="M68,58 A42,40 0 0 1 152,58 L152,42 A42,44 0 0 0 68,42 Z" fill="${s.hair}"/>
        <circle cx="58" cy="76" r="13" fill="${s.hair}"/>
        <circle cx="162" cy="76" r="13" fill="${s.hair}"/>`;
    case "flat-top":
      return `
        <path d="M68,60 A42,40 0 0 1 152,60 L152,44 A42,42 0 0 0 68,44 Z" fill="${s.hair}"/>
        <rect x="72" y="10" width="76" height="30" fill="${s.hair}"/>`;
    case "twin-buns":
      return `
        <path d="M66,58 A44,40 0 0 1 154,58 L154,42 A44,44 0 0 0 66,42 Z" fill="${s.hair}"/>
        <circle cx="86" cy="16" r="12" fill="${s.hair}"/>
        <circle cx="134" cy="16" r="12" fill="${s.hair}"/>`;
    default:
      return "";
  }
}

function faceShapePath(s: Singer): string {
  const { faceShape, skin, headRx, headRy } = s;
  if (faceShape === "square") {
    return `<rect x="${110 - headRx}" y="${78 - headRy}" width="${headRx * 2}" height="${headRy * 2}" rx="20" ry="22" fill="${skin}"/>`;
  }
  if (faceShape === "heart") {
    return `<path d="M70,72 C70,42 90,30 110,30 C130,30 150,42 150,72 C150,102 130,127 110,140 C90,127 70,102 70,72 Z" fill="${skin}"/>`;
  }
  return `<ellipse cx="110" cy="78" rx="${headRx}" ry="${headRy}" fill="${skin}"/>`;
}

function clothingDetails(s: Singer): string {
  const clothingAccent = s.clothingAccent;
  switch (s.clothingStyle) {
    case "crewneck":
      return `<path d="M90,132 Q110,150 130,132" fill="none" stroke="${clothingAccent}" stroke-width="4"/>`;
    case "hoodie":
      return `
        <path d="M70,140 Q110,110 150,140 L150,160 Q110,138 70,160 Z" fill="${clothingAccent}"/>
        <line x1="102" y1="150" x2="99" y2="172" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <line x1="118" y1="150" x2="121" y2="172" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    case "turtleneck":
      return `<rect x="86" y="124" width="48" height="22" rx="10" fill="${clothingAccent}"/>`;
    case "cardigan-v":
      return `
        <path d="M110,132 L88,168 L110,196 L132,168 Z" fill="#f6e8ee"/>
        <circle cx="110" cy="180" r="3" fill="${clothingAccent}"/>
        <circle cx="110" cy="200" r="3" fill="${clothingAccent}"/>`;
    case "striped": {
      const stripes = [150, 168, 186, 204, 222, 240]
        .map((y) => `<rect x="36" y="${y}" width="148" height="9" fill="${clothingAccent}"/>`)
        .join("");
      return `<clipPath id="clip-${s.key}"><path d="${TORSO_D}"/></clipPath>
        <g clip-path="url(#clip-${s.key})">${stripes}</g>`;
    }
    case "v-sweater":
      return `<path d="M110,132 L94,162 L110,182 L126,162 Z" fill="${clothingAccent}"/>`;
    case "collared":
      return `
        <path d="M110,132 L92,132 L104,152 Z" fill="#fdf6e3"/>
        <path d="M110,132 L128,132 L116,152 Z" fill="#fdf6e3"/>
        <path d="M108,150 L110,166 L112,150 Z" fill="${clothingAccent}"/>`;
    case "open-cardigan":
      return `
        <line x1="98" y1="134" x2="92" y2="258" stroke="${clothingAccent}" stroke-width="3"/>
        <line x1="122" y1="134" x2="128" y2="258" stroke="${clothingAccent}" stroke-width="3"/>
        <circle cx="110" cy="176" r="2.6" fill="${clothingAccent}"/>
        <circle cx="110" cy="200" r="2.6" fill="${clothingAccent}"/>`;
    default:
      return "";
  }
}

export function renderSinger(s: Singer, index: number): string {
  const rowOrder = { back: 1, middle: 2, front: 3 }[s.row];

  const svg = `
    <svg viewBox="0 0 220 262" class="singer-fig" aria-hidden="true">
      <g class="body-group">
        <path class="torso" d="${TORSO_D}" fill="${s.clothing}"/>
        ${clothingDetails(s)}
        <rect class="chest-badge" x="84" y="200" width="52" height="38" rx="10"/>
        <text class="chest-letter" x="110" y="222" text-anchor="middle">${s.key}</text>
      </g>
      <g class="head-group">
        ${hairBack(s)}
        ${faceShapePath(s)}
        ${hairFront(s)}
        <g class="eyes">
          <ellipse class="eye eye-left" cx="92" cy="80" rx="${s.eyeRx}" ry="${s.eyeRy}"/>
          <ellipse class="eye eye-right" cx="128" cy="80" rx="${s.eyeRx}" ry="${s.eyeRy}"/>
        </g>
        <path class="mouth mouth-idle" d="${s.mouthIdle}" fill="none" stroke="#5a2f1e" stroke-width="4" stroke-linecap="round"/>
        <ellipse class="mouth mouth-open" cx="110" cy="106" rx="17" ry="19" fill="#3a1810"/>
      </g>
    </svg>`;

  return `
    <button
      type="button"
      class="singer singer--${s.row}"
      data-key="${s.key}"
      data-role="${s.role}"
      data-pitch="${s.pitch}"
      style="left:${s.x}%; z-index:${rowOrder * 10 + index};"
      aria-label="Singer ${s.key}, ${s.label}. Click or press ${s.key} to hear them sing."
    >${svg}</button>`;
}
