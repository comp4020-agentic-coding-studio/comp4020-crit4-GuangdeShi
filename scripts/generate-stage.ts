// Dev-only tool: prints the static markup for the choir stage so it can be
// pasted into index.html. The choir is static HTML/SVG for the cold-open
// (renders before main.ts runs) — this script just saves hand-typing it.
// Not part of the build; run it with `node scripts/generate-stage.ts`.
import { SINGERS, renderSinger } from "../singers.ts";

process.stdout.write(SINGERS.map((s, i) => renderSinger(s, i)).join("\n"));
