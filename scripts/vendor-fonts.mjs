/**
 * One-shot vendoring of the three Google Fonts families into the repo (P2.7).
 * Keeps only the latin / latin-ext subsets — the app's five languages are
 * en/fr/es/pt (latin) and ar, which none of these families cover anyway and
 * which already falls back to a system face today.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.argv[2];
const FONT_DIR = path.join(ROOT, 'src/assets/fonts');
const CSS_OUT = path.join(ROOT, 'src/styles/fonts.css');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Full axis ranges on purpose: the variable file is the same either way, and a
// narrower declared range makes the browser synthesise weights it already has.
const FAMILIES = [
  { name: 'Plus Jakarta Sans', slug: 'plus-jakarta-sans', query: 'Plus+Jakarta+Sans:wght@200..800' },
  { name: 'Sora', slug: 'sora', query: 'Sora:wght@100..800' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', query: 'JetBrains+Mono:wght@100..800' },
];

const KEEP = new Set(['latin', 'latin-ext']);

const blocks = [];

for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`;
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.text();
  });

  // Each @font-face is preceded by a /* subset */ comment.
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  let found = 0;
  while ((m = re.exec(css)) !== null) {
    const [, subset, body] = m;
    if (!KEEP.has(subset)) continue;
    found++;

    const src = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(body);
    const weight = /font-weight:\s*([^;]+);/.exec(body);
    const range = /unicode-range:\s*([^;]+);/.exec(body);
    if (!src || !weight || !range) throw new Error(`${family.name}/${subset}: unexpected block`);

    const file = `${family.slug}-${subset}.woff2`;
    const bytes = Buffer.from(
      await fetch(src[1], { headers: { 'User-Agent': UA } }).then((r) => {
        if (!r.ok) throw new Error(`${src[1]} → ${r.status}`);
        return r.arrayBuffer();
      }),
    );
    await mkdir(FONT_DIR, { recursive: true });
    await writeFile(path.join(FONT_DIR, file), bytes);
    console.log(`  ${file}  ${(bytes.length / 1024).toFixed(1)} KB`);

    blocks.push(
      [
        `/* ${family.name} — ${subset} */`,
        `@font-face {`,
        `  font-family: '${family.name}';`,
        `  font-style: normal;`,
        `  font-weight: ${weight[1].trim()};`,
        `  font-display: swap;`,
        `  src: url('../assets/fonts/${file}') format('woff2-variations');`,
        `  unicode-range: ${range[1].trim()};`,
        `}`,
      ].join('\n'),
    );
  }
  console.log(`${family.name}: ${found} subset(s)`);
}

const header = `/*
 * Self-hosted typefaces (CAPACITOR-PLAN.md → P2.7).
 *
 * These three families used to load from fonts.googleapis.com at boot. In a
 * browser that is a brief FOUT; in a packaged app it is a first launch rendering
 * fallback type — or, offline, rendering fallback type forever — which reads as
 * broken in a way a website does not. The files are vendored under
 * src/assets/fonts/ and Vite fingerprints them into the bundle.
 *
 * Variable fonts, one file per family per subset: six files rather than the
 * twenty-four a static-weight vendoring would need, and no synthesised weights.
 *
 * Subsets are latin + latin-ext only. That covers en/fr/es/pt completely; ar
 * falls back to a system face, exactly as it did when these came from Google —
 * none of the three families ships Arabic glyphs.
 *
 * GENERATED — do not hand-edit. Re-run the vendoring script to refresh, and
 * update the @font-face families here only alongside tailwind.config.js.
 */
`;

await mkdir(path.dirname(CSS_OUT), { recursive: true });
await writeFile(CSS_OUT, header + '\n' + blocks.join('\n\n') + '\n');
console.log(`\nwrote ${CSS_OUT} (${blocks.length} faces)`);
