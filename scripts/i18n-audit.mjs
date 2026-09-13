#!/usr/bin/env node
/**
 * Translation coverage audit.
 *
 *   node scripts/i18n-audit.mjs           report
 *   node scripts/i18n-audit.mjs --strict  exit 1 when English or the error
 *                                         catalog has a hole (CI gate)
 *
 * Three checks:
 *  1. Every backend code in `api-doc/error-codes.ts` has an entry under
 *     `errors.codes` in the English bundle. A missing one means a user would see
 *     the generic fallback instead of an actionable message.
 *  2. Every locale is compared key-by-key against English, which is the schema.
 *  3. Keys present in a locale but not in English are reported as stale — they
 *     survive a rename and quietly rot.
 *
 * Non-English gaps are informational: i18next falls back per key, so a locale
 * that is mid-translation is a normal state, not a build break.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const localesDir = join(root, 'src', 'i18n', 'locales');
const SOURCE_LOCALE = 'en';

const strict = process.argv.includes('--strict');

// ─── helpers ─────────────────────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// CLDR plural categories. A key authored as `shipment_one`/`shipment_other` in
// English legitimately becomes `shipment_one`/`shipment_two`/`shipment_few`/…
// in Arabic, so comparison happens on the base key — otherwise every correctly
// pluralised locale would be reported as both incomplete and stale.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * Any leading-underscore key is a note to translators, not copy — `_comment`,
 * `_pathsComment`, and whatever the next one is called. Never counted, so a
 * locale is not "incomplete" for skipping an English-only annotation.
 */
const IGNORED_LEAF = /(^|\.)_[^.]*$/;

function normalizeKey(path) {
  return path.replace(PLURAL_SUFFIX, '');
}

/** Flatten a nested bundle to dotted leaf paths, plural-normalized. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else if (!IGNORED_LEAF.test(path)) {
      out.add(normalizeKey(path));
    }
  }
  return out;
}

function localeKeys(locale) {
  const dir = join(localesDir, locale);
  const keys = new Map(); // namespace -> Set<path>
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    keys.set(file.replace(/\.json$/, ''), flatten(readJson(join(dir, file))));
  }
  return keys;
}

// ─── 1. backend error-code coverage ──────────────────────────────────────────

function backendErrorCodes() {
  const file = join(root, 'api-doc', 'error-codes.ts');
  if (!existsSync(file)) return null;
  const src = readFileSync(file, 'utf8');
  return new Set([...src.matchAll(/^\s{4}[A-Z0-9_]+:\s*'([A-Z0-9_]+)'/gm)].map((m) => m[1]));
}

/**
 * Code families raised by surfaces this dashboard cannot reach.
 *
 * `api-doc/error-codes.ts` is the WHOLE platform's catalog — every role and every
 * client. Holding this app to all of it made the check permanently red over
 * strings no agency will ever be shown, which trained everyone to ignore the
 * only signal it has. So the catalog is filtered to what an agency session can
 * actually provoke, and the excluded families are named and justified here
 * rather than being quietly dropped.
 *
 * ⚠ The test is a PREFIX match, so a new code in one of these families is
 * excluded automatically — that is intended, and it is also the risk: if any of
 * these surfaces ever becomes callable from this app, delete the prefix and map
 * what appears. Each entry says what would have to change.
 */
const OUT_OF_SCOPE_PREFIXES = [
  // Raised only inside the WhatsApp / Telegram bot and its MCP tools, which
  // resolve a messaging identity rather than a session. Verified 2026-09-09
  // against the backend: BOT_CONNECTION_ACTIVE_CHANNEL, the one that sounds
  // reachable from Settings → Notifications, is refused only for "the channel
  // THIS REQUEST ARRIVED ON" — a condition an HTTP caller cannot meet.
  // Revisit if this app ever gains a chat surface.
  'BOT_',
  // Price bargaining on a product. Customer and vendor only; an agency neither
  // sells nor negotiates. Revisit if agencies start quoting delivery fees
  // interactively.
  'NEGOTIATION_',
  // Shareable hosted payment links, minted by the seller of an order. The
  // agency's own billing calls /agency/credits/topups and /agency/plans/:id/purchase,
  // which never mint one. Revisit if agency invoices become payable by link.
  'PAYMENT_LINK_',
];

const outOfScope = (code) => OUT_OF_SCOPE_PREFIXES.some((p) => code.startsWith(p));

let failed = false;

const codes = backendErrorCodes();
if (!codes) {
  console.log('· api-doc/error-codes.ts not found — skipping error-code coverage check');
} else {
  const enErrors = readJson(join(localesDir, SOURCE_LOCALE, 'errors.json'));
  const mapped = new Set(Object.keys(enErrors.codes ?? {}));
  const inScope = [...codes].filter((c) => !outOfScope(c));
  const missing = inScope.filter((c) => !mapped.has(c));
  const skipped = codes.size - inScope.length;
  const extra = [...mapped].filter((c) => !codes.has(c));

  console.log(
    `\nBackend error codes: ${codes.size} declared, ${inScope.length} reachable from this app, ${mapped.size} mapped in en/errors.json`,
  );
  if (skipped) {
    console.log(
      `  · ${skipped} skipped as out of scope (${OUT_OF_SCOPE_PREFIXES.join(', ')}) — see the note in this script`,
    );
  }
  if (missing.length) {
    failed = true;
    console.log(`  ✗ ${missing.length} unmapped (users would see the generic message):`);
    for (const c of missing) console.log(`      ${c}`);
  } else {
    console.log('  ✓ every reachable backend code resolves to a message');
  }
  if (extra.length) {
    // Not a failure: front-end-only sentinels (NETWORK_ERROR, UNAUTHORIZED, …)
    // legitimately live here alongside the backend catalog.
    console.log(`  · ${extra.length} front-end-only / legacy codes: ${extra.join(', ')}`);
  }
}

// ─── 2 & 3. locale completeness ──────────────────────────────────────────────

const source = localeKeys(SOURCE_LOCALE);
const sourceTotal = [...source.values()].reduce((n, set) => n + set.size, 0);
console.log(`\nSource locale (${SOURCE_LOCALE}): ${source.size} namespaces, ${sourceTotal} keys`);

const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== SOURCE_LOCALE)
  .map((d) => d.name);

for (const locale of locales) {
  const target = localeKeys(locale);
  let translated = 0;
  const missingByNs = [];
  const staleByNs = [];

  for (const [ns, keys] of source) {
    const have = target.get(ns) ?? new Set();
    const missing = [...keys].filter((k) => !have.has(k));
    translated += keys.size - missing.length;
    if (missing.length) missingByNs.push([ns, missing]);
    const stale = [...have].filter((k) => !keys.has(k));
    if (stale.length) staleByNs.push([ns, stale]);
  }

  const pct = sourceTotal === 0 ? 100 : Math.round((translated / sourceTotal) * 100);
  console.log(`\n${locale}: ${translated}/${sourceTotal} keys (${pct}%)`);
  for (const [ns, missing] of missingByNs) {
    console.log(`  · ${ns}: ${missing.length} missing → falls back to ${SOURCE_LOCALE}`);
  }
  for (const [ns, stale] of staleByNs) {
    console.log(`  ✗ ${ns}: ${stale.length} stale key(s) not in ${SOURCE_LOCALE}: ${stale.slice(0, 5).join(', ')}${stale.length > 5 ? '…' : ''}`);
    failed = true;
  }
}

console.log('');
if (strict && failed) {
  console.error('i18n audit failed.');
  process.exit(1);
}
