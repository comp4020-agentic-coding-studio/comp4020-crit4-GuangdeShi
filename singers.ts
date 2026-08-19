// Config + SVG rendering for the eight choir members. Kept separate from
// main.ts so the interaction/audio wiring (later commits) doesn't have to
// wade through markup strings.

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
  skin: string;
  hair: string;
  clothing: string;
  clothingAccent: string;
  faceShape: "round" | "square" | "oval" | "heart" | "long";
  headRx: number;
  headRy: number;
  hairStyle: "buzz" | "mohawk" | "long-straight" | "bun" | "afro" | "bob" | "ponytail" | "pigtails";
  mouthIdle: string; // path 'd', small/closed per the idle spec
  eyeRx: number;
  eyeRy: number;
  clothingStyle: "crewneck" | "hoodie" | "turtleneck" | "cardigan-v" | "striped" | "v-sweater" | "collared" | "open-cardigan";
}

export const SINGERS: Singer[] = [
  {
    key: "A",
    role: "bass",
    label: "bass, a low boom",
    row: "front",
    x: 32,
    skin: "#e8b48a",
    hair: "#2b2118",
    clothing: "#2f3b52",
    clothingAccent: "#1f2839",
    faceShape: "round",
    headRx: 46,
    headRy: 44,
    hairStyle: "buzz",
    mouthIdle: "M92,196 Q110,202 128,196",
    eyeRx: 7,
    eyeRy: 7.5,
    clothingStyle: "crewneck",
  },
  {
    key: "S",
    role: "percussive",
    label: "a percussive puh",
    row: "back",
    x: 8,
    skin: "#c98a5e",
    hair: "#e2453f",
    clothing: "#e2453f",
    clothingAccent: "#a52f2a",
    faceShape: "square",
    headRx: 40,
    headRy: 40,
    hairStyle: "mohawk",
    mouthIdle: "M96,194 Q110,190 124,194",
    eyeRx: 6,
    eyeRy: 7,
    clothingStyle: "hoodie",
  },
  {
    key: "D",
    role: "breath-tss",
    label: "a soft tss breath",
    row: "middle",
    x: 20,
    skin: "#f0c9a0",
    hair: "#5b4636",
    clothing: "#7d8fa3",
    clothingAccent: "#5c6b7c",
    faceShape: "oval",
    headRx: 37,
    headRy: 50,
    hairStyle: "long-straight",
    mouthIdle: "M98,198 Q110,196 122,198",
    eyeRx: 5.5,
    eyeRy: 5,
    clothingStyle: "turtleneck",
  },
  {
    key: "F",
    role: "hum",
    label: "a warm mmm hum",
    row: "middle",
    x: 44,
    skin: "#8a5a3f",
    hair: "#241c14",
    clothing: "#c98fae",
    clothingAccent: "#a9678a",
    faceShape: "heart",
    headRx: 44,
    headRy: 46,
    hairStyle: "bun",
    mouthIdle: "M94,198 Q110,204 126,198",
    eyeRx: 6.5,
    eyeRy: 6,
    clothingStyle: "cardigan-v",
  },
  {
    key: "J",
    role: "open-ah",
    label: "an open ah tone",
    row: "front",
    x: 68,
    skin: "#7a4a2d",
    hair: "#151015",
    clothing: "#e8a23c",
    clothingAccent: "#c97f22",
    faceShape: "round",
    headRx: 50,
    headRy: 47,
    hairStyle: "afro",
    mouthIdle: "M90,197 Q110,206 130,197",
    eyeRx: 8,
    eyeRy: 8,
    clothingStyle: "striped",
  },
  {
    key: "K",
    role: "round-ooh",
    label: "a round ooh tone",
    row: "middle",
    x: 80,
    skin: "#e8b48a",
    hair: "#3a2418",
    clothing: "#6f5aa8",
    clothingAccent: "#503f80",
    faceShape: "long",
    headRx: 33,
    headRy: 54,
    hairStyle: "bob",
    mouthIdle: "M104,197 a6,5 0 1,0 12,0 a6,5 0 1,0 -12,0",
    eyeRx: 6,
    eyeRy: 6.5,
    clothingStyle: "v-sweater",
  },
  {
    key: "L",
    role: "bright-ee",
    label: "a bright ee tone",
    row: "back",
    x: 56,
    skin: "#f0c9a0",
    hair: "#caa23a",
    clothing: "#e8d84a",
    clothingAccent: "#c2ab2e",
    faceShape: "square",
    headRx: 39,
    headRy: 42,
    hairStyle: "ponytail",
    mouthIdle: "M92,194 Q110,204 128,194",
    eyeRx: 6.5,
    eyeRy: 7,
    clothingStyle: "collared",
  },
  {
    key: ";",
    role: "soft-airy",
    label: "a soft, airy breath",
    row: "back",
    x: 92,
    skin: "#c98a5e",
    hair: "#402a1f",
    clothing: "#a9c9d6",
    clothingAccent: "#87acbb",
    faceShape: "oval",
    headRx: 33,
    headRy: 44,
    hairStyle: "pigtails",
    mouthIdle: "M100,197 Q110,199 120,197",
    eyeRx: 5,
    eyeRy: 3.2,
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
      return `<clipPath id="clip-${s.key.replace(";", "semi")}"><path d="${TORSO_D}"/></clipPath>
        <g clip-path="url(#clip-${s.key.replace(";", "semi")})">${stripes}</g>`;
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
  const widthPct = { back: 15, middle: 19, front: 24 }[s.row];
  const topPct = { back: 4, middle: 24, front: 44 }[s.row];

  const svg = `
    <svg viewBox="0 0 220 262" class="singer-fig" aria-hidden="true">
      <g class="body-group">
        <path class="torso" d="${TORSO_D}" fill="${s.clothing}"/>
        ${clothingDetails(s)}
        <text class="chest-letter${s.key === ";" ? " chest-letter--semicolon" : ""}" x="110" y="222" text-anchor="middle">${s.key === ";" ? ";" : s.key}</text>
      </g>
      <g class="head-group">
        ${hairBack(s)}
        ${faceShapePath(s)}
        ${hairFront(s)}
        <g class="eyes">
          <ellipse class="eye eye-left" cx="92" cy="80" rx="${s.eyeRx}" ry="${s.eyeRy}"/>
          <ellipse class="eye eye-right" cx="128" cy="80" rx="${s.eyeRx}" ry="${s.eyeRy}"/>
        </g>
        <path class="mouth" d="${s.mouthIdle}" fill="none" stroke="#5a2f1e" stroke-width="4" stroke-linecap="round"/>
      </g>
    </svg>`;

  return `
    <button
      type="button"
      class="singer singer--${s.row}"
      data-key="${s.key}"
      data-role="${s.role}"
      style="left:${s.x}%; top:${topPct}%; width:${widthPct}%; z-index:${rowOrder * 10 + index};"
      aria-label="Singer ${s.key === ";" ? "semicolon" : s.key}, ${s.label}. Click or press ${s.key === ";" ? "semicolon" : s.key} to hear them sing."
    >${svg}</button>`;
}
