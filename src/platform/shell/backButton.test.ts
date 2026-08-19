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

import { dismissTopLayer, hasOpenOverlay } from './backButton';

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
