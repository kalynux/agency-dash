/**
 * Camera / library → `File` (CAPACITOR-PLAN.md → P4.3).
 *
 * The conversion is the part with teeth. Everything downstream —
 * `validateMediaSelection`, `isVideoUpload`, the per-type size caps, the choice
 * between `/files/upload` and `/files/upload/video` — reads the `File`'s `type`
 * and its **filename extension**, and falls back to the extension precisely when
 * the browser leaves `type` empty, which is the normal case for `.mov`. Produce
 * a File called "image" and a QuickTime video is posted to the endpoint that
 * rejects video outright.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));
vi.mock('./permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./permissions')>()),
}));
vi.mock('capacitor-native-settings', () => ({
  NativeSettings: { open: vi.fn() },
  AndroidSettings: { ApplicationDetails: 'application_details' },
  IOSSettings: { App: 'app' },
}));

const takePhoto = vi.hoisted(() => vi.fn());
const chooseFromGallery = vi.hoisted(() => vi.fn());
const checkPermissions = vi.hoisted(() => vi.fn());
const requestPermissions = vi.hoisted(() => vi.fn());

vi.mock('@capacitor/camera', () => ({
  Camera: { takePhoto, chooseFromGallery, checkPermissions, requestPermissions },
  MediaTypeSelection: { Photo: 0, Video: 1, All: 2 },
}));

import { pickMedia } from './media';

/** A plugin error, in the shape the Capacitor bridge rejects with. */
function pluginError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/** Stub the local-file read `toFile` performs against `webPath`. */
function stubFetch(bytes: string, type: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(bytes, { headers: type ? { 'Content-Type': type } : {} }))),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  checkPermissions.mockResolvedValue({ camera: 'granted', photos: 'granted' });
  requestPermissions.mockResolvedValue({ camera: 'granted', photos: 'granted' });
});

describe('pickMedia — camera', () => {
  it('returns a JPEG File built from the capture', async () => {
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      uri: 'file:///storage/emulated/0/Android/data/cap/IMG_0001.jpg',
      webPath: 'https://agency.wi-mall.internal/_capacitor_file_/IMG_0001.jpg',
      saved: false,
      metadata: { format: 'jpg', size: 6 },
    });

    const result = await pickMedia('camera');

    expect(result.status).toBe('picked');
    if (result.status !== 'picked') return;
    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('IMG_0001.jpg');
    expect(result.files[0].type).toBe('image/jpeg');
    expect(result.files[0]).toBeInstanceOf(File);
  });

  it('fetches webPath, never the file:// uri', async () => {
    // `uri` is a filesystem path the WebView cannot read cross-origin; only
    // `webPath` is served by Capacitor's own handler on the app origin.
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      uri: 'file:///private/IMG_1.jpg',
      webPath: 'https://agency.wi-mall.internal/_capacitor_file_/IMG_1.jpg',
      saved: false,
      metadata: { format: 'jpg' },
    });

    await pickMedia('camera');

    expect(fetch).toHaveBeenCalledWith('https://agency.wi-mall.internal/_capacitor_file_/IMG_1.jpg');
  });

  it('synthesises a name with a real extension when the uri has none', async () => {
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      uri: 'content://media/external/images/media/1000',
      webPath: 'https://agency.wi-mall.internal/_capacitor_file_/1000',
      saved: false,
      metadata: { format: 'jpg' },
    });

    const result = await pickMedia('camera');

    if (result.status !== 'picked') throw new Error(result.status);
    expect(result.files[0].name).toMatch(/^capture-\d+-1\.jpg$/);
  });

  it('does not save the capture to the camera roll', async () => {
    // A delivery proof being uploaded is not the user's photo to keep.
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      webPath: 'https://x/1',
      saved: false,
      metadata: { format: 'jpg' },
    });

    await pickMedia('camera');

    expect(takePhoto).toHaveBeenCalledWith(expect.objectContaining({ saveToGallery: false }));
  });

  it('caps quality below the plugin default', async () => {
    // 100 produces an 8–12 MB file on a modern sensor, over the 10 MB agency
    // image cap — the first photo taken would fail our own validator.
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      webPath: 'https://x/1',
      saved: false,
      metadata: { format: 'jpg' },
    });

    await pickMedia('camera');

    const { quality } = takePhoto.mock.calls[0][0];
    expect(quality).toBeLessThan(100);
  });

  it('asks only for the camera permission', async () => {
    checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });
    requestPermissions.mockResolvedValue({ camera: 'granted', photos: 'prompt' });
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      webPath: 'https://x/1',
      saved: false,
      metadata: { format: 'jpg' },
    });

    await pickMedia('camera');

    expect(requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
  });
});

describe('pickMedia — gallery', () => {
  it('keeps a .mov extension so the video endpoint split still works', async () => {
    // The regression this file exists for: browsers routinely leave `File.type`
    // empty for QuickTime, and `isVideoUpload` then reads the extension.
    stubFetch('binary', '');
    chooseFromGallery.mockResolvedValue({
      results: [
        {
          type: 1,
          uri: 'file:///storage/emulated/0/DCIM/VID_0007.mov',
          webPath: 'https://agency.wi-mall.internal/_capacitor_file_/VID_0007.mov',
          saved: false,
          metadata: { format: 'mov' },
        },
      ],
    });

    const result = await pickMedia('gallery', { allowVideo: true });

    if (result.status !== 'picked') throw new Error(result.status);
    expect(result.files[0].name).toBe('VID_0007.mov');
    expect(result.files[0].type).toBe('video/quicktime');
  });

  it('returns every item of a multi-selection', async () => {
    stubFetch('binary', 'image/png');
    chooseFromGallery.mockResolvedValue({
      results: [
        { type: 0, webPath: 'https://x/1', saved: false, metadata: { format: 'png' } },
        { type: 0, webPath: 'https://x/2', saved: false, metadata: { format: 'png' } },
      ],
    });

    const result = await pickMedia('gallery', { multiple: true, limit: 10 });

    if (result.status !== 'picked') throw new Error(result.status);
    expect(result.files).toHaveLength(2);
    expect(chooseFromGallery).toHaveBeenCalledWith(
      expect.objectContaining({ allowMultipleSelection: true, limit: 10 }),
    );
  });

  it('survives one unreadable item without losing the rest', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        call += 1;
        return call === 1 ? Promise.reject(new Error('gone')) : Promise.resolve(new Response('ok'));
      }),
    );
    chooseFromGallery.mockResolvedValue({
      results: [
        { type: 0, webPath: 'https://x/1', saved: false, metadata: { format: 'png' } },
        { type: 0, webPath: 'https://x/2', saved: false, metadata: { format: 'png' } },
      ],
    });

    const result = await pickMedia('gallery', { multiple: true });

    if (result.status !== 'picked') throw new Error(result.status);
    expect(result.files).toHaveLength(1);
  });

  it('reads an empty selection as a cancellation', async () => {
    chooseFromGallery.mockResolvedValue({ results: [] });
    await expect(pickMedia('gallery')).resolves.toEqual({ status: 'cancelled' });
  });

  it('asks only for the photos permission', async () => {
    checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });
    requestPermissions.mockResolvedValue({ camera: 'prompt', photos: 'granted' });
    chooseFromGallery.mockResolvedValue({ results: [] });

    await pickMedia('gallery');

    expect(requestPermissions).toHaveBeenCalledWith({ permissions: ['photos'] });
  });
});

describe('pickMedia — outcomes', () => {
  it('reads a first-time refusal as denied', async () => {
    checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });
    requestPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });

    await expect(pickMedia('camera')).resolves.toEqual({ status: 'denied' });
    expect(takePhoto).not.toHaveBeenCalled();
  });

  it('reads an already-denied permission as blocked', async () => {
    checkPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });
    requestPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });

    await expect(pickMedia('camera')).resolves.toEqual({ status: 'blocked' });
  });

  it('skips the prompt entirely when already granted', async () => {
    stubFetch('binary', 'image/jpeg');
    takePhoto.mockResolvedValue({
      type: 0,
      webPath: 'https://x/1',
      saved: false,
      metadata: { format: 'jpg' },
    });

    await pickMedia('camera');

    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('treats iOS limited photo access as granted', async () => {
    checkPermissions.mockResolvedValue({ camera: 'granted', photos: 'limited' });
    chooseFromGallery.mockResolvedValue({ results: [] });

    await pickMedia('gallery');

    expect(requestPermissions).not.toHaveBeenCalled();
    expect(chooseFromGallery).toHaveBeenCalled();
  });

  it('reads each cancel code as a cancellation, not a failure', async () => {
    for (const code of ['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0020', 'OS-PLUG-CAMR-0017']) {
      takePhoto.mockRejectedValueOnce(pluginError(code));
      await expect(pickMedia('camera')).resolves.toEqual({ status: 'cancelled' });
    }
  });

  it('reads "no camera hardware" as unavailable', async () => {
    takePhoto.mockRejectedValue(pluginError('OS-PLUG-CAMR-0007'));
    await expect(pickMedia('camera')).resolves.toEqual({ status: 'unavailable' });
  });

  it('reads a permission refused at the point of use as blocked', async () => {
    // The grant was revoked between the check and the call.
    takePhoto.mockRejectedValue(pluginError('OS-PLUG-CAMR-0003'));
    await expect(pickMedia('camera')).resolves.toEqual({ status: 'blocked' });
  });

  it('reads an unrecognised failure as an error', async () => {
    takePhoto.mockRejectedValue(pluginError('OS-PLUG-CAMR-0010'));
    await expect(pickMedia('camera')).resolves.toEqual({ status: 'error' });
  });

  it('never throws, whatever the plugin does', async () => {
    takePhoto.mockRejectedValue('a string, not an Error');
    await expect(pickMedia('camera')).resolves.toEqual({ status: 'error' });
  });
});
