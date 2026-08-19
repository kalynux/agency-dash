/**
 * @vitest-environment jsdom
 *
 * Native push (CAPACITOR-PLAN.md → P4.1).
 *
 * Two things here fail silently if they are wrong, which is why they are tested
 * rather than eyeballed:
 *
 *  - `register()` resolves as soon as the *request* is made; the token arrives
 *    later on an event, or never. Without the deadline the settings screen spins
 *    forever on a device with no Play Services or no `google-services.json`.
 *  - A rotated token must be announced even on the FIRST `registration` event of
 *    a launch, because "FCM rotated while the app was closed" is exactly the
 *    case where the backend is left holding a token that accepts every send and
 *    delivers nothing.
 *
 * jsdom because the module installs its seam on `window` at load.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));

const listeners = vi.hoisted(() => new Map<string, (payload: unknown) => void>());
const register = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const checkPermissions = vi.hoisted(() => vi.fn());
const requestPermissions = vi.hoisted(() => vi.fn());
const addListener = vi.hoisted(() =>
  vi.fn((event: string, cb: (payload: unknown) => void) => {
    listeners.set(event, cb);
    return Promise.resolve({ remove: () => Promise.resolve() });
  }),
);

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { register, addListener, checkPermissions, requestPermissions },
}));

const getItem = vi.hoisted(() => vi.fn());
const setItem = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const remove = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: { getItem, setItem, remove },
}));

type PushModule = typeof import('./push');

/** A fresh module instance — `latestToken` and the listeners are module state. */
async function loadPush(): Promise<PushModule> {
  vi.resetModules();
  listeners.clear();
  return import('./push');
}

/** Fire the `registration` event the plugin would deliver. */
function emitToken(value: string): void {
  listeners.get('registration')?.({ value });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkPermissions.mockResolvedValue({ receive: 'granted' });
  requestPermissions.mockResolvedValue({ receive: 'granted' });
  getItem.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('permission', () => {
  it('normalises every Capacitor state', async () => {
    const push = await loadPush();
    const table: [string, string][] = [
      ['granted', 'granted'],
      ['denied', 'denied'],
      ['prompt', 'prompt'],
      // "denied once, you may ask again" — a prompt, not a refusal.
      ['prompt-with-rationale', 'prompt'],
    ];
    for (const [reported, expected] of table) {
      checkPermissions.mockResolvedValue({ receive: reported });
      expect(await push.getPushPermission(), reported).toBe(expected);
    }
  });

  it('treats a failed permission read as denied rather than throwing', async () => {
    const push = await loadPush();
    checkPermissions.mockRejectedValue(new Error('no plugin'));
    await expect(push.getPushPermission()).resolves.toBe('denied');
  });

  it('prompts through the plugin, not the Notification API', async () => {
    const push = await loadPush();
    requestPermissions.mockResolvedValue({ receive: 'granted' });
    await expect(push.requestPushPermission()).resolves.toBe('granted');
    expect(requestPermissions).toHaveBeenCalled();
  });
});

describe('device identity', () => {
  it('registers as the real platform, not as web (D5)', async () => {
    // A device registered as 'web' is sent a web-push payload and delivers
    // nothing — the exact bug this value exists to prevent.
    const push = await loadPush();
    expect(push.devicePlatform).toBe('android');
  });

  it('reports push as supported without a Notification API', async () => {
    // `'Notification' in window` is false in an Android WebView; the plugin is
    // linked into the binary regardless.
    const push = await loadPush();
    expect(push.pushSupported).toBe(true);
  });
});

describe('token cache', () => {
  it('round-trips through secure storage, not localStorage', async () => {
    const push = await loadPush();
    await push.cachePushToken('fcm-token-1');
    expect(setItem).toHaveBeenCalledWith('push-token', 'fcm-token-1');
    expect(localStorage.getItem('agency:pushToken')).toBeNull();

    getItem.mockResolvedValue('fcm-token-1');
    await expect(push.readCachedPushToken()).resolves.toBe('fcm-token-1');
  });

  it('reads an empty entry as no token', async () => {
    const push = await loadPush();
    getItem.mockResolvedValue('');
    await expect(push.readCachedPushToken()).resolves.toBeNull();
  });

  it('never fails the caller when storage does', async () => {
    // The device IS registered server-side by this point; throwing would report
    // a working registration as broken.
    const push = await loadPush();
    setItem.mockRejectedValueOnce(new Error('keystore'));
    await expect(push.cachePushToken('x')).resolves.toBeUndefined();

    getItem.mockRejectedValueOnce(new Error('keystore'));
    await expect(push.readCachedPushToken()).resolves.toBeNull();
  });
});

describe('token acquisition', () => {
  it('installs the provider at the seam usePushRegistration reads', async () => {
    await loadPush();
    expect(typeof window.wiMallGetPushToken).toBe('function');
  });

  it('attaches the registration listeners at load, before any request', async () => {
    // A rotation delivered shortly after launch has to land somewhere even if
    // the settings screen is never opened.
    await loadPush();
    expect(listeners.has('registration')).toBe(true);
    expect(listeners.has('registrationError')).toBe(true);
    expect(register).not.toHaveBeenCalled();
  });

  it('resolves with the token the registration event delivers', async () => {
    await loadPush();
    const pending = window.wiMallGetPushToken!();
    await Promise.resolve();
    emitToken('fcm-abc');
    await expect(pending).resolves.toBe('fcm-abc');
    expect(register).toHaveBeenCalledOnce();
  });

  it('resolves null when no token ever arrives', async () => {
    vi.useFakeTimers();
    await loadPush();
    const pending = window.wiMallGetPushToken!();
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toBeNull();
  });

  it('does not re-register once a token is in hand', async () => {
    await loadPush();
    const first = window.wiMallGetPushToken!();
    await Promise.resolve();
    emitToken('fcm-abc');
    await first;

    await expect(window.wiMallGetPushToken!()).resolves.toBe('fcm-abc');
    expect(register).toHaveBeenCalledOnce();
  });

  it('resolves null when register() itself fails', async () => {
    await loadPush();
    register.mockRejectedValueOnce(new Error('no play services'));
    await expect(window.wiMallGetPushToken!()).resolves.toBeNull();
  });
});

describe('rotation', () => {
  it('announces the first token of a launch, not only a within-launch change', async () => {
    // The in-memory value starts null on a cold start, so comparing against it
    // would classify "rotated while the app was closed" as first sight and stay
    // silent — leaving the backend on a dead token. The subscriber compares
    // against what it actually registered.
    const push = await loadPush();
    const seen: string[] = [];
    push.subscribePushTokenRotation((token) => seen.push(token));

    emitToken('fcm-new');

    expect(seen).toEqual(['fcm-new']);
  });

  it('announces every subsequent token', async () => {
    const push = await loadPush();
    const seen: string[] = [];
    push.subscribePushTokenRotation((token) => seen.push(token));

    emitToken('fcm-1');
    emitToken('fcm-2');

    expect(seen).toEqual(['fcm-1', 'fcm-2']);
  });

  it('stops announcing after unsubscribe', async () => {
    const push = await loadPush();
    const seen: string[] = [];
    const off = push.subscribePushTokenRotation((token) => seen.push(token));

    emitToken('fcm-1');
    off();
    emitToken('fcm-2');

    expect(seen).toEqual(['fcm-1']);
  });

  it('ignores an empty token value', async () => {
    const push = await loadPush();
    const seen: string[] = [];
    push.subscribePushTokenRotation((token) => seen.push(token));

    listeners.get('registration')?.({ value: '' });

    expect(seen).toEqual([]);
  });
});
