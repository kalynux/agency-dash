/**
 * @vitest-environment jsdom
 *
 * Outbound links (CAPACITOR-PLAN.md → P3.5).
 *
 * The interceptor is the piece with real consequences: intercept too little and
 * a link navigates the WebView away with no route back; intercept too much and
 * every in-app route opens in Chrome instead of the app. So the whole file is
 * about where that line sits.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));

const open = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@capacitor/browser', () => ({ Browser: { open } }));

import { installExternalLinkInterceptor, openExternal } from './browser';

let uninstall: () => void = () => {};

/**
 * Reads the interceptor's verdict, then stops the click going any further.
 *
 * Registered on `document` in the capture phase *after* the interceptor, so it
 * runs immediately behind it and sees exactly what the interceptor left behind.
 * The `preventDefault` is only housekeeping: without it jsdom tries to follow
 * every link the interceptor correctly ignored and fills the run with "Not
 * implemented: navigation to another Document".
 */
let prevented = false;
function probe(event: Event): void {
  prevented = event.defaultPrevented;
  event.preventDefault();
}

/** Build an anchor, click it, and report whether the click was intercepted. */
function clickAnchor(attrs: Record<string, string>): { intercepted: boolean } {
  const a = document.createElement('a');
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = 'link';
  document.body.appendChild(a);

  prevented = false;
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  a.remove();
  return { intercepted: prevented };
}

describe('external link interceptor', () => {
  beforeEach(() => {
    open.mockClear();
    uninstall = installExternalLinkInterceptor();
    document.addEventListener('click', probe, { capture: true });
  });

  afterEach(() => {
    document.removeEventListener('click', probe, { capture: true });
    uninstall();
    document.body.innerHTML = '';
  });

  it('opens a cross-origin link in the in-app browser', () => {
    const { intercepted } = clickAnchor({ href: 'https://wa.me/237600000000', target: '_blank' });

    expect(intercepted).toBe(true);
    expect(open).toHaveBeenCalledWith({ url: 'https://wa.me/237600000000' });
  });

  it('intercepts a click on an element inside the anchor', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://api.wi-mall.com/files/x.pdf');
    const icon = document.createElement('span');
    a.appendChild(icon);
    document.body.appendChild(a);

    prevented = false;
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(prevented).toBe(true);
    expect(open).toHaveBeenCalledOnce();
  });

  it('leaves in-app navigation alone', () => {
    // The router owns these. Sending them to Chrome would hand the whole app
    // over to a browser tab.
    for (const href of ['/dashboard/shipments', '#section', './relative']) {
      const { intercepted } = clickAnchor({ href });
      expect(intercepted, href).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves an absolute same-origin link alone', () => {
    const { intercepted } = clickAnchor({ href: `${window.location.origin}/dashboard` });
    expect(intercepted).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves non-http schemes to the system', () => {
    // Capacitor's own WebViewClient already routes these to an Intent, which is
    // the correct destination — and Browser.open cannot load any of them.
    for (const href of ['mailto:ops@wi-mall.com', 'tel:+237600000000', 'intent://x#Intent;end']) {
      const { intercepted } = clickAnchor({ href });
      expect(intercepted, href).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores an anchor with no href', () => {
    const { intercepted } = clickAnchor({ role: 'button' });
    expect(intercepted).toBe(false);
  });

  it('defers to a handler that already dealt with the click', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://wi-mall.com/help');
    document.body.appendChild(a);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    event.preventDefault();
    a.dispatchEvent(event);

    expect(open).not.toHaveBeenCalled();
  });

  it('ignores non-primary and modified clicks', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://wi-mall.com/help');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }));
    a.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }),
    );

    expect(open).not.toHaveBeenCalled();
  });

  it('installs only once', () => {
    const second = installExternalLinkInterceptor();
    clickAnchor({ href: 'https://wi-mall.com/help' });

    expect(open).toHaveBeenCalledTimes(1);
    second();
  });

  it('swallows a failure to open rather than throwing at the call site', async () => {
    open.mockRejectedValueOnce(new Error('no browser'));
    await expect(openExternal('https://wi-mall.com')).resolves.toBeUndefined();
  });
});
