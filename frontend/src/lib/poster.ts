/**
 * Deterministic SVG posters for media slots.
 *
 * Generated locally as data URIs so a still always renders — no external host, no
 * broken-image state, identical output on server and client.
 */

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function buildSvg(seed: string) {
  const h = hash(seed);
  const base = 258 + (h % 60); // violet -> magenta
  const accent = 300 + ((h >> 5) % 45);
  const lightX = 26 + ((h >> 3) % 48);
  const lightY = 14 + ((h >> 7) % 34);
  const shift = -26 + ((h >> 11) % 52);
  const streak = 14 + ((h >> 13) % 20);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="0.7" y2="1">
<stop offset="0" stop-color="hsl(${accent},58%,34%)"/>
<stop offset="0.5" stop-color="hsl(${base},52%,24%)"/>
<stop offset="1" stop-color="#16121F"/>
</linearGradient>
<radialGradient id="l" cx="${lightX}%" cy="${lightY}%" r="62%">
<stop offset="0" stop-color="hsl(${accent},88%,66%)" stop-opacity="0.5"/>
<stop offset="1" stop-color="hsl(${accent},88%,66%)" stop-opacity="0"/>
</radialGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#100D18" stop-opacity="0"/>
<stop offset="1" stop-color="#100D18" stop-opacity="0.72"/>
</linearGradient>
</defs>
<rect width="400" height="500" fill="url(#b)"/>
<g opacity="0.1" fill="#F2EEE9">
<rect x="${40 + streak}" y="-160" width="30" height="820" transform="rotate(24 200 250)"/>
<rect x="${250 + streak}" y="-160" width="14" height="820" transform="rotate(24 200 250)"/>
</g>
<g opacity="0.55" fill="#0E0B16" transform="translate(${shift},0)">
<circle cx="200" cy="206" r="62"/>
<path d="M88 500 Q98 368 200 342 Q302 368 312 500 Z"/>
</g>
<g transform="translate(${shift},0)" fill="none" stroke="hsl(${accent},92%,72%)" stroke-width="3" opacity="0.5" stroke-linecap="round">
<path d="M144 182 A62 62 0 0 1 198 144"/>
<path d="M104 476 Q116 388 178 360"/>
</g>
<rect width="400" height="500" fill="url(#l)"/>
<rect y="250" width="400" height="250" fill="url(#s)"/>
</svg>`;
}

const cache = new Map<string, string>();

/** CSS `background-image` value: `url("data:image/svg+xml,...")` */
export function posterFor(seed: string) {
  const cached = cache.get(seed);
  if (cached) return cached;

  const value = `url("data:image/svg+xml,${encodeURIComponent(buildSvg(seed))}")`;
  cache.set(seed, value);
  return value;
}

/**
 * Real photos, when there are any. Drop files into `frontend/public/media/` and map
 * them here — anything not listed keeps its generated poster.
 */
export const PHOTOS: Record<string, string> = {};

export function photoFor(seed: string): string | undefined {
  return PHOTOS[seed];
}
