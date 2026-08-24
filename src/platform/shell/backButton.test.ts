/**
 * @vitest-environment jsdom
 *
 * The Android back button's first decision (CAPACITOR-PLAN.md → P3.1).
 *
 * Only the overlay half is testable off a device — the other two branches are a
 * `canGoBack` boolean the WebView supplies and a two-press timer — but it is the
 * half with the subtle failure: a selector that is too broad swallows every back
 * press (an Accordion left open would make back stop working entirely), and one
 * that is too narrow navigates the page out from under an open sheet.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

import { dismissTopLayer, hasOpenOverlay, nextDepth } from './backButton';

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe('dismissTopLayer', () => {
  let escapes: KeyboardEvent[];

  const record = (e: Event) => escapes.push(e as KeyboardEvent);

  beforeEach(() => {
    escapes = [];
    document.addEventListener('keydown', record);
  });

  afterEach(() => {
    document.removeEventListener('keydown', record);
    document.body.innerHTML = '';
  });

  it('does nothing when no overlay is open', () => {
    mount('<main><button>Save</button></main>');

    expect(hasOpenOverlay()).toBe(false);
    expect(dismissTopLayer()).toBe(false);
    expect(escapes).toHaveLength(0);
  });

  it('sends Escape when a dialog is open', () => {
    mount('<div role="dialog" data-state="open">Confirm</div>');

    expect(dismissTopLayer()).toBe(true);
    expect(escapes).toHaveLength(1);
    expect(escapes[0].key).toBe('Escape');
    expect(escapes[0].bubbles).toBe(true);
  });

  it('recognises alert dialogs, poppers and drawers', () => {
    for (const html of [
      '<div role="alertdialog" data-state="open">Are you sure?</div>',
      '<div data-radix-popper-content-wrapper><div data-state="open">Menu</div></div>',
      '<div vaul-drawer data-state="open">Sheet</div>',
    ]) {
      mount(html);
      expect(hasOpenOverlay(), html).toBe(true);
    }
  });

  it('ignores a closed dialog', () => {
    mount('<div role="dialog" data-state="closed">Confirm</div>');

    expect(hasOpenOverlay()).toBe(false);
    expect(dismissTopLayer()).toBe(false);
  });

  it('ignores non-modal components that also carry data-state="open"', () => {
    // Accordion, Collapsible and Tabs triggers all use the same attribute. If
    // these matched, a page with one expanded section would absorb every back
    // press and the button would look broken.
    mount(`
      <button data-state="open" aria-expanded="true">Section</button>
      <div data-state="open" role="region">Body</div>
      <div data-state="open" data-orientation="horizontal">Tabs</div>
    `);

    expect(hasOpenOverlay()).toBe(false);
    expect(dismissTopLayer()).toBe(false);
    expect(escapes).toHaveLength(0);
  });

  it('dispatches from the focused element so it reaches the layer that owns focus', () => {
    mount('<div role="dialog" data-state="open"><input id="field" /></div>');
    const field = document.getElementById('field') as HTMLInputElement;
    field.focus();

    const targets: (EventTarget | null)[] = [];
    const capture = (e: Event) => targets.push(e.target);
    field.addEventListener('keydown', capture);

    expect(dismissTopLayer()).toBe(true);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toBe(field);
  });
});

// ─── Navigation depth ─────────────────────────────────────────────────────────

describe('nextDepth', () => {
  it('counts a push as one screen deeper', () => {
    expect(nextDepth(0, 'PUSH')).toBe(1);
    expect(nextDepth(3, 'PUSH')).toBe(4);
  });

  it('counts a pop as one screen shallower', () => {
    expect(nextDepth(3, 'POP')).toBe(2);
  });

  it('leaves a replace alone', () => {
    // The redirect case: /dashboard/agents → /dashboard/agents/connections
    // swapped the entry rather than stacking a second one, so there is nothing
    // new behind it. Counting it would make back land on a URL that only ever
    // existed for one tick.
    expect(nextDepth(2, 'REPLACE')).toBe(2);
    expect(nextDepth(0, 'REPLACE')).toBe(0);
  });

  it('never goes below zero', () => {
    // Depth is the offer of somewhere to go back to; a negative one would
    // silently disarm the confirm-to-exit branch.
    expect(nextDepth(0, 'POP')).toBe(0);
  });

  it('returns to zero after a run of pushes is fully unwound', () => {
    // Three screens opened from the "More" sheet, then three presses of back.
    let depth = 0;
    for (let i = 0; i < 3; i++) depth = nextDepth(depth, 'PUSH');
    expect(depth).toBe(3);
    for (let i = 0; i < 3; i++) depth = nextDepth(depth, 'POP');
    expect(depth).toBe(0);
  });

  it('is unmoved by redirects interleaved with real navigations', () => {
    // What each "More" menu tap actually looks like: a push onto the parent
    // path, then the route's own `<Navigate replace>` onto its first tab. One
    // screen, not two — so three taps must leave exactly three to come back
    // through.
    let depth = 0;
    for (let i = 0; i < 3; i++) {
      depth = nextDepth(depth, 'PUSH');
      depth = nextDepth(depth, 'REPLACE');
    }
    expect(depth).toBe(3);
  });
});
